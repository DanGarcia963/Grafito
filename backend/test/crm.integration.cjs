// npm run test:crm — PostgreSQL en memoria; nunca usa la base productiva.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { PGlite } = require('@electric-sql/pglite');
const { PrismaPGlite } = require('pglite-prisma-adapter');
const { PrismaClient } = require('@prisma/client');
const { CrmService } = require('../dist/ventas/crm.service');
const { InvestigacionService } = require('../dist/investigacion/id.service');
const {
  TrazabilidadService,
} = require('../dist/trazabilidad/trazabilidad.service');
const { recurrencia } = require('../dist/ventas/crm.workflow');
const seller = { usuario: 'vendedor', personaId: 1, area: 'ventas' },
  lab = { usuario: 'laboratorio', personaId: 2, area: 'id' };
const pdf = {
  buffer: Buffer.from('%PDF-1.4\nprueba'),
  size: 14,
  originalname: 'ficha.pdf',
};
const future = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);
test('CRM integral: prospecto, varias muestras, reporte, revisiones, compra, recompra, cancelación y aislamiento', async () => {
  const sql = process.env.CRM_TEST_SCHEMA
    ? require('fs').readFileSync(process.env.CRM_TEST_SCHEMA, 'utf8')
    : execFileSync(
        process.execPath,
        [
          'node_modules/prisma/build/index.js',
          'migrate',
          'diff',
          '--from-empty',
          '--to-schema-datamodel',
          'prisma/schema.prisma',
          '--script',
        ],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            DIRECT_URL: 'postgresql://test:test@localhost/test',
            DATABASE_URL: 'postgresql://test:test@localhost/test',
          },
          maxBuffer: 5 * 1024 * 1024,
        },
      );
  const pg = new PGlite();
  await pg.exec(sql);
  // Adapter 0.6 does not serialize Prisma DateTime values for PostgreSQL TIME.
  // Normalize only the TIME input at the driver boundary (production uses native Prisma).
  const factory = new PrismaPGlite(pg),
    connect = factory.connect.bind(factory);
  const wrap = (a) => {
    const original = a.queryRaw.bind(a);
    a.queryRaw = (q) => {
      const match = q.sql.match(
        /INSERT INTO "public"\."muestras" \((.*?)\) VALUES/,
      );
      if (match) {
        const index = match[1]
          .split(',')
          .findIndex((c) => c.trim() === '"Hora_Toma"');
        if (index >= 0 && q.args[index])
          q = {
            ...q,
            args: q.args.map((v, i) =>
              i === index ? String(v).slice(11, 23) : v,
            ),
          };
      }
      return original(q);
    };
    if (a.startTransaction) {
      const start = a.startTransaction.bind(a);
      a.startTransaction = async (...args) => wrap(await start(...args));
    }
    return a;
  };
  factory.connect = async () => wrap(await connect());
  const p = new PrismaClient({ adapter: factory });
  const ev = { notificar: () => {} };
  const crm = new CrmService(p, ev),
    id = new InvestigacionService(p, ev, new TrazabilidadService(p));
  try {
    await p.personas.createMany({
      data: [
        { nombre: 'Vendedor', tipo_persona: 'VENDEDOR' },
        { nombre: 'Laboratorio', tipo_persona: 'EMPLEADO' },
      ],
    });
    const prod = await p.productos_materiales.create({
      data: { nombre_Producto: 'Aceite prueba', UM: 'Litros' },
    });
    const v = await p.id_viabilidades.create({ data: { nombre: 'Evaluar' } }),
      proc = await p.id_procesos.create({
        data: { nombre: 'Filtración', estandar_segundos: 60 },
      });
    const account = (
      await crm.guardarCuenta(
        {
          nombre: 'Alfa',
          nombre_contacto: 'Contacto',
          frecuencia_esperada_dias: '30',
        },
        seller,
      )
    ).data;
    const same = (await crm.guardarCuenta({ nombre: 'ALFA' }, seller)).data;
    assert.equal(same.persona_id, account.persona_id);
    const open = async () =>
      (
        await crm.crear(
          {
            persona_id: account.persona_id,
            titulo: 'Purificación',
            producto_id: prod.id_Produc_Mater,
            cantidad_estimada: '100',
            unidad: 'L',
            fecha_recoleccion_agendada: new Date().toISOString(),
          },
          seller,
        )
      ).data;
    const version = async (oid) =>
      (await crm.detalle(oid, seller)).data.version;
    const sample = async (oid) =>
      (
        await id.crear(
          {
            oportunidad_id: oid,
            producto_id: prod.id_Produc_Mater,
            cliente_id: account.persona_id,
            viabilidad_id: v.id,
            caracterizacion: 'FILTRACION',
            cantidad_proyecto: '100',
            unidad_proyecto: 'L',
            fecha_recoleccion: new Date(Date.now() - 1000).toISOString(),
          },
          pdf,
          seller,
        )
      ).data.id_Muestra;
    const finish = async (mid) => {
      await id.planificar(mid, { procesos: [proc.id] }, lab);
      await id.recibir(mid, lab);
      const m = (await id.detalle(mid, lab)).data;
      const eid = m.procesos_id.at(-1).id;
      await id.proceso(mid, eid, 'iniciar', {}, lab);
      await id.proceso(mid, eid, 'terminar', { resultado: 'Conforme' }, lab);
      await id.finalizar(mid, { dictamen: 'APROBADO' }, lab);
    };
    const report = async (oid) =>
      crm.reporte(
        oid,
        {
          version: await version(oid),
          resultado: 'VIABLE',
          resumen: 'Apto para purificación',
        },
        pdf,
        lab,
      );
    const quote = async (oid) =>
      (
        await crm.cotizar(
          oid,
          {
            version: await version(oid),
            moneda: 'MXN',
            total: '1160',
            subtotal: '1000',
            impuestos: '160',
            vigencia_hasta: future,
            condiciones_comerciales: 'Pago 30 días',
          },
          pdf,
          seller,
        )
      ).data;
    const accept = async (oid, cid) => {
      for (const estado of ['ENVIADA', 'ACEPTADA'])
        await crm.estadoCotizacion(
          oid,
          cid,
          {
            version: await version(oid),
            estado,
            nota: 'Confirmación documentada',
          },
          seller,
        );
    };
    const o = await open();
    assert.equal(o.etapa, 'RECOLECCION_AGENDADA');
    assert.equal(await p.muestras.count(), 0);
    await assert.rejects(
      crm.detalle(o.id, { ...seller, personaId: 999 }),
      (e) => e.status === 404,
    );
    await assert.rejects(quote(o.id), (e) => e.status === 400);
    const m1 = await sample(o.id),
      m2 = await sample(o.id);
    assert.equal(
      (await crm.detalle(o.id, seller)).data.etapa,
      'EN_ANALISIS_ID',
    );
    assert.equal(
      (await p.muestras.findUnique({ where: { id_Muestra: m1 } }))
        .fecha_ingreso_laboratorio,
      null,
    );
    assert.equal(await p.id_ejecuciones.count(), 0);
    assert.equal(
      (
        await p.personas.findUnique({
          where: { id_Persona: account.persona_id },
        })
      ).tipo_persona,
      'PROSPECTO',
    );
    await finish(m1);
    await assert.rejects(report(o.id), (e) => e.status === 400);
    await finish(m2);
    await report(o.id);
    assert.equal((await crm.detalle(o.id, seller)).data.etapa, 'COTIZACION');
    const c1 = await quote(o.id),
      c2 = await quote(o.id);
    assert.equal(c2.version, 2);
    assert.equal(
      (await p.crm_cotizaciones.findUnique({ where: { id: c1.id } })).estado,
      'CANCELADA',
    );
    await accept(o.id, c2.id);
    const body = {
      version: await version(o.id),
      cotizacion_id: c2.id,
      orden_cliente: 'OC-001',
    };
    const venta = (await crm.confirmar(o.id, body, seller)).data;
    assert.equal(venta.tipo_compra, 'PRIMERA_COMPRA');
    assert.equal((await crm.confirmar(o.id, body, seller)).data.id, venta.id);
    assert.equal(await p.crm_ordenes_venta.count(), 1);
    assert.equal(
      (
        await p.personas.findUnique({
          where: { id_Persona: account.persona_id },
        })
      ).tipo_persona,
      'CLIENTE',
    );
    assert.equal((await crm.detalle(o.id, seller)).data.etapa, 'GANADA');
    const times = await p.id_ejecuciones.findMany();
    const op = (
      await crm.produccion(venta.id, { servicio: 'Purificación' }, seller)
    ).data;
    assert.equal(op.orden_venta_id, venta.id);
    assert.equal(
      (await crm.produccion(venta.id, { servicio: 'Purificación' }, seller))
        .data.id_Orden_Produc,
      op.id_Orden_Produc,
    );
    await assert.rejects(
      crm.cancelarOrden(venta.id, { motivo: 'Prueba' }, seller),
      (e) => e.status === 409,
    );
    await assert.rejects(
      id.planificar(m1, { procesos: [proc.id], nuevoCiclo: true }, lab),
      (e) => e.status === 409,
    );
    const o2 = await open(),
      m3 = await sample(o2.id);
    await finish(m3);
    await report(o2.id);
    const c3 = await quote(o2.id);
    await accept(o2.id, c3.id);
    const venta2 = (
      await crm.confirmar(
        o2.id,
        {
          version: await version(o2.id),
          cotizacion_id: c3.id,
          orden_cliente: 'OC-002',
        },
        seller,
      )
    ).data;
    assert.equal(venta2.tipo_compra, 'RECOMPRA');
    let metrics = (await crm.metricas(seller, {})).data;
    assert.equal(metrics.convertidos, 1);
    assert.equal(metrics.clientes_recompra, 1);
    assert.equal(metrics.ganadas, 2);
    await crm.cancelarOrden(venta2.id, { motivo: 'Compra cancelada' }, seller);
    metrics = (await crm.metricas(seller, {})).data;
    assert.equal(metrics.clientes_recompra, 0);
    assert.equal(metrics.ordenes_periodo, 1);
    assert.equal(metrics.ganadas, 1);
    assert.equal(
      (
        await p.personas.findUnique({
          where: { id_Persona: account.persona_id },
        })
      ).tipo_persona,
      'CLIENTE',
    );
    const o3 = await open(),
      m4 = await sample(o3.id);
    await finish(m4);
    await report(o3.id);
    await quote(o3.id);
    await id.planificar(m4, { procesos: [proc.id], nuevoCiclo: true }, lab);
    assert.equal(
      (await crm.detalle(o3.id, seller)).data.etapa,
      'EN_ANALISIS_ID',
    );
    await assert.rejects(quote(o3.id), (e) => e.status === 400);
    assert.equal(
      await p.id_reportes_oportunidad.count({
        where: { oportunidad_id: o3.id, estado: 'PUBLICADO' },
      }),
      0,
    );
    assert.deepEqual(
      (await p.id_ejecuciones.findMany()).filter((x) =>
        times.some((y) => y.id === x.id),
      ),
      times,
    );
    const stale = await version(o3.id);
    await crm.guardar(
      o3.id,
      { version: stale, nota: 'Pendiente nueva evaluación' },
      seller,
    );
    await assert.rejects(
      crm.guardar(
        o3.id,
        { version: stale, nota: 'Cambio desactualizado' },
        seller,
      ),
      (e) => e.status === 409,
    );
    await assert.rejects(
      crm.guardar(
        o3.id,
        {
          version: await version(o3.id),
          etapa: 'GANADA',
          nota: 'Intento de omitir orden',
        },
        seller,
      ),
      (e) => e.status === 400,
    );
    await crm.guardar(
      o3.id,
      {
        version: await version(o3.id),
        etapa: 'PERDIDA',
        nota: 'Cliente no acepta',
      },
      seller,
    );
    assert.equal((await crm.metricas(seller, {})).data.efectividad, 50);
    console.log('Flujo completo validado con Prisma y PostgreSQL en memoria');
  } finally {
    await p.$disconnect();
    await pg.close();
  }
});
test('recurrencia exige tres compras y detecta irregularidad', () => {
  const d = (n) => new Date(n * 86400000);
  assert.equal(
    recurrencia([d(0), d(30)], null).frecuencia_observada,
    'DATOS_INSUFICIENTES',
  );
  assert.equal(
    recurrencia([d(0), d(30), d(60)], null).frecuencia_observada,
    'MENSUAL',
  );
  assert.equal(
    recurrencia([d(0), d(10), d(150)], null).frecuencia_observada,
    'IRREGULAR',
  );
  assert.equal(
    recurrencia([d(0), d(10), d(150)], null).proxima_compra_estimada,
    null,
  );
});
