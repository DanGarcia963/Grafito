const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { PGlite } = require('@electric-sql/pglite');
const { PrismaPGlite } = require('pglite-prisma-adapter');
const { PrismaClient, Prisma } = require('@prisma/client');
const { ProductionService } = require('../dist/production/production.service');
const { CalidadService } = require('../dist/calidad/calidad.service');
const {
  TrazabilidadService,
} = require('../dist/trazabilidad/trazabilidad.service');
const {
  especificacionesValidas,
} = require('../dist/inventario/especificaciones.logic');
const config = {
  campos: [
    {
      clave: 'tipo_prensa',
      etiqueta: 'Prensa',
      opciones: ['Forgemaster', 'Polymaster', 'Fagor'],
      requerido: true,
    },
  ],
  peso_min_kg: 850,
  peso_max_kg: 1000,
};
const detalle = (peso) => ({
  version: 1,
  atributos: { tipo_prensa: 'Fagor' },
  contenedores: [1, 2, 3].map((n) => ({
    codigo: 'C' + n,
    peso_kg: String(peso),
  })),
});
test('Pesos reales: 2550/3000 kg, límites, suma y prensas por producto', () => {
  for (const peso of [850, 1000])
    assert.equal(
      especificacionesValidas(
        detalle(peso),
        config,
        'Kilogramos',
        new Prisma.Decimal(peso * 3),
      ).contenedores.length,
      3,
    );
  assert.throws(
    () =>
      especificacionesValidas(
        detalle(850),
        config,
        'Kilogramos',
        new Prisma.Decimal(3000),
      ),
    /suma/,
  );
  assert.throws(
    () =>
      especificacionesValidas(
        detalle(849),
        config,
        'Kilogramos',
        new Prisma.Decimal(2547),
      ),
    /intervalo/,
  );
  assert.throws(
    () =>
      especificacionesValidas(
        { ...detalle(850), atributos: { tipo_prensa: 'Otra' } },
        config,
        'Kilogramos',
        new Prisma.Decimal(2550),
      ),
    /inválido/,
  );
});
test('Inventario cliente sin venta, descarga F.E., reproceso y vinculación posterior', async () => {
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
  await pg.exec("SET TIME ZONE 'UTC'");
  await pg.exec(sql);
  await pg.exec(
    require('fs').readFileSync('prisma/restricciones_modelo.sql', 'utf8'),
  );
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

  const ev = { notificar: () => {} },
    tiempos = new TrazabilidadService(p);
  const prod = new ProductionService(p, tiempos, ev);
  const calidad = new CalidadService(p, tiempos, ev);
  const user = { usuario: 'operador', personaId: 1, area: 'produccion' };
  try {
    await p.personas.createMany({
      data: [
        { nombre: 'Operador', tipo_persona: 'EMPLEADO' },
        { nombre: 'Cliente', tipo_persona: 'CLIENTE' },
        { nombre: 'Otro', tipo_persona: 'CLIENTE' },
      ],
    });
    const producto = await p.productos_materiales.create({
      data: {
        nombre_Producto: 'ORSA VFG - R',
        UM: 'Kilogramos',
        configuracion_operativa: config,
      },
    });
    const ubicacion = await p.inventario_ubicaciones.create({
      data: { codigo: 'A', nombre: 'Almacén', tipo: 'ALMACEN' },
    });
    const tanque = await p.equipos_tanques.create({
      data: {
        codigo_Equipo: 'T1',
        nombre_Equipo: 'Tanque 1',
        tipo: 'GRAFITO',
        capacidad: 10000,
        unidad_capacidad: 'Kilogramos',
        estatus_proceso: 'VACIO',
      },
    });
    const apertura = (
      await prod.registrarApertura(
        {
          folio: 'AP0',
          cantidad: '900',
          producto_id: producto.id_Produc_Mater,
          propiedad: 'PROPIO',
          condicion: 'NUEVO',
          estado_calidad_recepcion: 'LIBERADO',
          ubicacion_id: ubicacion.id,
          observaciones: 'Inventario de apertura verificado físicamente',
          especificaciones: {
            version: 1,
            atributos: { tipo_prensa: 'Fagor' },
            contenedores: [{ codigo: 'AP-C1', peso_kg: '900' }],
          },
        },
        user,
      )
    ).data;
    assert.equal(apertura.origen, 'APERTURA');
    assert.equal(
      await p.muestras.count({ where: { lote_inventario_id: apertura.id } }),
      0,
    );
    assert.equal(
      await p.movimientos_inventario.count({
        where: { lote_inventario_id: apertura.id, tipo: 'APERTURA' },
      }),
      1,
    );
    await prod.recibirMaterial(
      {
        folio: 'R1',
        cantidad: '2550',
        producto_id: producto.id_Produc_Mater,
        remitente_id: 2,
        propiedad: 'DE_CLIENTE',
        ubicacion_id: ubicacion.id,
        especificaciones: detalle(850),
      },
      user,
    );
    const material = await p.lotes_inventario.findFirstOrThrow();
    assert.equal(material.especificaciones.contenedores.length, 3);
    const base = {
      producto_id: producto.id_Produc_Mater,
      cantidad: '2550',
      tipo_Operacion: 'Regeneración',
      linea_Produccion: 'GRAFITO',
      responsable_id: 1,
      materiales_completos: true,
      materiales: [
        {
          lote_inventario_id: material.id,
          ubicacion_id: ubicacion.id,
          cantidad: '2550',
        },
      ],
    };
    await assert.rejects(
      prod.crearOrden({ ...base, no_Orden_Produc: 'OP0' }, user),
      /insuficiente/,
    );
    await p.lotes_inventario.update({
      where: { id: material.id },
      data: { estado_calidad_recepcion: 'LIBERADO' },
    });
    const op = (
      await prod.crearOrden({ ...base, no_Orden_Produc: 'OP1' }, user)
    ).data;
    assert.equal(op.orden_venta_id, null);
    assert.equal(op.propietario_id, 2);
    const reserva = await p.inventario_reservas.findFirstOrThrow({
      where: { orden_produccion_id: op.id_Orden_Produc },
    });
    const lote = (
      await prod.iniciarLote(
        {
          no_Lote: 'L1',
          orden_produccion_id: op.id_Orden_Produc,
          tanque_id: tanque.id_Equipos_Tanques,
          consumos: [{ reserva_id: reserva.id, cantidad: '2550' }],
        },
        user,
      )
    ).data;
    const descarga = {
      cantidad: '2550',
      ubicacion_id: ubicacion.id,
      especificaciones: detalle(850),
      destino_calidad: 'FE',
    };
    await assert.rejects(
      prod.descargar(lote.id_Lote_Produccion, descarga, user),
      /última muestra/,
    );
    await p.lotes_produccion.update({
      where: { id_Lote_Produccion: lote.id_Lote_Produccion },
      data: { estado_Calida: 'RECHAZADO' },
    });
    const muestra = await p.muestras.create({
      data: {
        fecha_Toma: new Date(),
        producto_id: producto.id_Produc_Mater,
        lote_id: lote.id_Lote_Produccion,
        estado_Muestra: 'RECHAZADO',
        categoria_Muestra: 'MUESTRA_AJUSTADO',
        area_Muestra: 'CALIDAD',
      },
    });
    await assert.rejects(
      prod.descargar(
        lote.id_Lote_Produccion,
        { ...descarga, destino_calidad: 'LIBERADO' },
        user,
      ),
      /Libera/,
    );
    const fe = (await prod.descargar(lote.id_Lote_Produccion, descarga, user))
      .data;
    assert.equal(fe.condicion, 'FUERA_DE_ESPECIFICACION');
    assert.equal(fe.propietario_id, 2);
    assert.equal(
      (
        await p.equipos_tanques.findUnique({
          where: { id_Equipos_Tanques: tanque.id_Equipos_Tanques },
        })
      ).estatus_proceso,
      'VACIO',
    );
    const saldo = (await prod.stock()).data.find(
      (s) => s.lote_inventario_id === fe.id,
    );
    assert.equal(String(saldo.disponible), '0');
    assert.equal(String(saldo.disponible_reproceso), '2550');
    await assert.rejects(
      calidad.actualizarEstatusMuestra({
        id_Muestra: muestra.id_Muestra,
        estatus_Muestra: 'APROBADO',
      }),
      /F.E./,
    );
    const reproceso = {
      ...base,
      materiales: [
        {
          lote_inventario_id: fe.id,
          ubicacion_id: ubicacion.id,
          cantidad: '2550',
        },
      ],
      no_Orden_Produc: 'OP2',
    };
    await assert.rejects(prod.crearOrden(reproceso, user), /insuficiente/);
    const op2 = (
      await prod.crearOrden(
        {
          ...reproceso,
          es_reproceso: true,
          motivo_reproceso: 'Recuperar material fuera de especificación',
        },
        user,
      )
    ).data;
    const reserva2 = await p.inventario_reservas.findFirstOrThrow({
      where: { orden_produccion_id: op2.id_Orden_Produc },
    });
    const l2 = (
      await prod.iniciarLote(
        {
          no_Lote: 'L2',
          orden_produccion_id: op2.id_Orden_Produc,
          tanque_id: tanque.id_Equipos_Tanques,
          consumos: [{ reserva_id: reserva2.id, cantidad: '2550' }],
        },
        user,
      )
    ).data;
    assert.notEqual(l2.id_Lote_Produccion, lote.id_Lote_Produccion);
    assert.equal(
      (await prod.stock()).data.find((s) => s.lote_inventario_id === fe.id),
      undefined,
    );
    // Crear una venta posterior sin simular recepción ni duplicar existencias.
    const oportunidad = await p.crm_oportunidades.create({
      data: {
        folio: 'O1',
        persona_id: 2,
        vendedor_id: 1,
        titulo: 'Regeneración',
      },
    });
    const reporte = await p.id_reportes_oportunidad.create({
      data: {
        oportunidad_id: oportunidad.id,
        version: 1,
        resultado: 'VIABLE',
        creado_por: 'lab',
        muestras_ciclos: [],
      },
    });
    const cot = await p.crm_cotizaciones.create({
      data: {
        reporte_id: reporte.id,
        folio: 'C1',
        vigencia_hasta: new Date(),
        condiciones_comerciales: 'Contado',
        creado_por: 'operador',
        oportunidad_id: oportunidad.id,
        version: 1,
        producto_id: producto.id_Produc_Mater,
        tipo_venta: 'SERVICIO_REGENERACION',
        servicio: 'Regeneración',
        cantidad: 2550,
        unidad: 'Kilogramos',
        subtotal: 100,
        impuestos: 16,
        total: 116,
      },
    });
    const ov = await p.crm_ordenes_venta.create({
      data: {
        folio: 'OV1',
        oportunidad_id: oportunidad.id,
        cotizacion_id: cot.id,
        persona_id: 2,
        vendedor_id: 1,
        producto_id: producto.id_Produc_Mater,
        tipo_venta: 'SERVICIO_REGENERACION',
        servicio: 'Regeneración',
        cantidad: 2550,
        unidad: 'Kilogramos',
        orden_cliente: 'OC1',
        subtotal: 100,
        impuestos: 16,
        importe_total: 116,
        creado_por: 'operador',
      },
    });
    await p.crm_ordenes_venta.update({
      where: { id: ov.id },
      data: { persona_id: 3 },
    });
    await assert.rejects(
      prod.vincularVenta(op2.id_Orden_Produc, { orden_venta_id: ov.id }, user),
      /propietario/,
    );
    await p.crm_ordenes_venta.update({
      where: { id: ov.id },
      data: { persona_id: 2 },
    });
    await prod.vincularVenta(
      op2.id_Orden_Produc,
      { orden_venta_id: ov.id },
      user,
    );
    assert.equal(
      (
        await p.ordenes_produccion.findUnique({
          where: { id_Orden_Produc: op2.id_Orden_Produc },
        })
      ).orden_venta_id,
      ov.id,
    );
    await p.lotes_produccion.update({
      where: { id_Lote_Produccion: l2.id_Lote_Produccion },
      data: { estado_Calida: 'LIBERADO' },
    });
    const salida = (
      await prod.descargar(
        l2.id_Lote_Produccion,
        { ...descarga, destino_calidad: 'LIBERADO' },
        user,
      )
    ).data;
    await prod.marcarRezagado(
      salida.id,
      { motivo: 'Remanente almacenado' },
      user,
    );
    const rez = await p.lotes_inventario.findUnique({
      where: { id: salida.id },
    });
    assert.equal(rez.condicion, 'REZAGADO');
    assert.equal(
      (
        await p.lotes_produccion.findUnique({
          where: { id_Lote_Produccion: l2.id_Lote_Produccion },
        })
      ).estado_Calida,
      'LIBERADO',
    );
  } finally {
    await p.$disconnect();
    await pg.close();
  }
});

test('SQL incremental conserva inventario y configura ORSA; admite reejecución', async () => {
  const fs = require('node:fs'),
    os = require('node:os'),
    path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grafito-migracion-'));
  const archivo = path.join(dir, 'schema.prisma');
  fs.writeFileSync(
    archivo,
    execFileSync('git', ['show', '8d3f6f9:backend/prisma/schema.prisma'], {
      encoding: 'utf8',
    }),
  );
  const pg = new PGlite();
  try {
    const ddl = execFileSync(
      process.execPath,
      [
        'node_modules/prisma/build/index.js',
        'migrate',
        'diff',
        '--from-empty',
        '--to-schema-datamodel',
        archivo,
        '--script',
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          DATABASE_URL: 'postgresql://test:test@localhost/test',
          DIRECT_URL: 'postgresql://test:test@localhost/test',
        },
      },
    );
    await pg.exec(ddl);
    await pg.exec(`INSERT INTO productos_materiales ("nombre_Producto", "UM") VALUES ('ORSA VFG - R', 'Kilogramos');
      INSERT INTO lotes_inventario (folio, producto_id, unidad, propiedad, condicion, origen, estado_calidad_recepcion)
      VALUES ('HISTORICO',1,'Kilogramos','PROPIO','INSUMO','APERTURA','LIBERADO');`);
    const sql = fs.readFileSync(
      'prisma/actualizaciones/20261007_inventario_reproceso.sql',
      'utf8',
    );
    await pg.exec(sql);
    await pg.exec(sql);
    const { rows } = await pg.query(
      'SELECT especificaciones, folio FROM lotes_inventario',
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].folio, 'HISTORICO');
    assert.equal(rows[0].especificaciones, null);
    const productos = await pg.query(
      'SELECT configuracion_operativa FROM productos_materiales',
    );
    assert.deepEqual(
      productos.rows[0].configuracion_operativa.campos[0].opciones,
      ['Forgemaster', 'Polymaster', 'Fagor'],
    );
    await pg.exec(
      `UPDATE lotes_inventario SET condicion='FUERA_DE_ESPECIFICACION';`,
    );
  } finally {
    await pg.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
