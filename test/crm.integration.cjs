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
        /INSERT INTO "public"\."(muestras|certificado_calidad)" \((.*?)\) VALUES/,
      );
      if (match) {
        const timeColumn = match[1] === 'muestras' ? '"Hora_Toma"' : '"hora_Liberacion"';
        const index = match[2]
          .split(',')
          .findIndex((c) => c.trim() === timeColumn);
        if (index >= 0 && q.args[index])
          q = {
            ...q,
            args: q.args.map((v, i) =>
              i === index ? String(v).slice(11, 19) : v,
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
  const enviados = [];
  const correo = { enviar: async (mensaje) => { enviados.push(mensaje); } };
  process.env.FRONTEND_URL = 'https://siust.netlify.app';
  process.env.UST_USUARIOS_JSON = JSON.stringify([
    { usuario: 'vendedor', personaId: 1, areas: ['ventas'], correo: 'vendedor@example.com' },
  ]);
  const crm = new CrmService(p, ev, correo),
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
          correo: 'contacto@alfa.example',
          frecuencia_esperada_dias: '30',
        },
        seller,
      )
    ).data;
    const same = (await crm.guardarCuenta({ nombre: 'ALFA' }, seller)).data;
    assert.equal(same.persona_id, account.persona_id);
    const productoRegistrado = await id.crearProducto({ nombre: 'Producto por texto', UM: 'Litros' }, seller);
    const productoDuplicado = await id.crearProducto({ nombre: 'PRODUCTO POR TEXTO', UM: 'Litros' }, seller);
    assert.equal(productoRegistrado.data.id_Produc_Mater, productoDuplicado.data.id_Produc_Mater);
    const documento = await crm.subirDocumentoCuenta(
      account.persona_id,
      'CONSTANCIA_FISCAL',
      { ...pdf, originalname: 'constancia.pdf' },
      seller,
    );
    assert.equal(documento.data.version, 1);
    const reemplazo = await crm.subirDocumentoCuenta(
      account.persona_id,
      'CONSTANCIA_FISCAL',
      { ...pdf, originalname: 'constancia-actualizada.pdf' },
      seller,
    );
    assert.equal(reemplazo.data.version, 2);
    const documentosCuenta = (await crm.cuenta(account.persona_id, seller)).data.documentos;
    assert.equal(documentosCuenta.length, 2);
    assert.equal(documentosCuenta.filter((doc) => doc.vigente).length, 1);
    assert.equal((await crm.documentoCuenta(reemplazo.data.id, seller)).nombre_archivo, 'constancia-actualizada.pdf');
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
      if (m.id_flujo_estructurado) {
        const structured = async (etapa, datos) =>
          id.guardarAnalisisEstructurado(mid, { etapa, datos }, lab);
        await structured('PRELIMINAR', {
          metricas: [{ clave: 'viscosidad_40', nombre: 'Viscosidad a 40°', valor: '42', unidad: 'cSt' }],
        });
        await structured('PROCESAMIENTO', { tipo: 'FILTRACION', filtracion: 'ESTANDAR' });
        await structured('FINAL', {
          metricas: [{ clave: 'viscosidad_40', nombre: 'Viscosidad a 40°', valor: '40', unidad: 'cSt' }],
        });
      }
      const analizada = (await id.detalle(mid, lab)).data;
      const eid = analizada.procesos_id.at(-1).id;
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
    const objetivo = async (oid) => {
      const reporteViable = await p.id_reportes_oportunidad.findFirstOrThrow({
        where: { oportunidad_id: oid, estado: 'PUBLICADO', resultado: 'VIABLE' },
        orderBy: { version: 'desc' },
      });
      const previa = await p.crm_costos_oportunidad.findFirst({
        where: { oportunidad_id: oid },
        orderBy: { version: 'desc' },
      });
      const formulaCostos = await p.crm_costos_oportunidad.create({
        data: {
          oportunidad_id: oid,
          reporte_id: reporteViable.id,
          version: (previa?.version ?? 0) + 1,
          formula: 'Fórmula de prueba',
          formula_enviada_por: 'ID',
        },
      });
      await p.crm_costos_oportunidad.update({
        where: { id: formulaCostos.id },
        data: {
          precio_objetivo_litro: '10',
          precio_emitido_por: 'Costos',
          precio_emitido_en: new Date(),
        },
      });
    };
    const quote = async (oid) =>
      (
        await crm.cotizar(
          oid,
          {
            version: await version(oid),
            tipo_venta: 'PRODUCTO_NUEVO',
            producto_id: prod.id_Produc_Mater,
            servicio: 'Fabricación',
            cantidad: '100',
            unidad: 'Litros',
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
    await crm.guardar(o.id, {
      version: await version(o.id),
      nota: 'Visita de presentación con el cliente',
      tipo_contacto: 'PRESENTACION',
      fecha_contacto: new Date().toISOString(),
    }, seller);
    const seguimiento = (await crm.detalle(o.id, seller)).data.historial[0];
    assert.equal(seguimiento.tipo_contacto, 'PRESENTACION');
    assert.ok(seguimiento.fecha_contacto);
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
      'MUESTRA_RECOLECTADA',
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
    assert.equal((await crm.detalle(o.id, seller)).data.etapa, 'EN_ANALISIS_ID');
    await assert.rejects(
      id.guardarAnalisisEstructurado(m1, {
        etapa: 'FINAL',
        datos: { metricas: [{ clave: 'viscosidad_40', nombre: 'Viscosidad a 40°', valor: '99', unidad: 'cSt' }] },
      }, lab),
    );
    await assert.rejects(report(o.id), (e) => e.status === 400);
    await finish(m2);
    const reportePublicado = await report(o.id);
    await crm.enviarReporteAVentas(o.id, reportePublicado.data.id, lab);
    assert.equal(enviados.length, 1);
    assert.equal(enviados[0].destinatario, 'vendedor@example.com');
    assert.equal((await p.id_reportes_oportunidad.findUnique({ where: { id: reportePublicado.data.id } })).enviado_ventas_correo, 'vendedor@example.com');
    assert.equal((await crm.detalle(o.id, seller)).data.etapa, 'COTIZACION');
    await objetivo(o.id);
    const c1 = await quote(o.id),
      c2 = await quote(o.id);
    assert.equal(c2.version, 2);
    assert.equal(
      (await p.crm_cotizaciones.findUnique({ where: { id: c1.id } })).estado,
      'CANCELADA',
    );
    await crm.enviarCotizacion(o.id, c2.id, { version: await version(o.id) }, seller);
    assert.equal(enviados.length, 2);
    const token = enviados.at(-1).html.match(/token=([A-Za-z0-9_-]+)/)?.[1];
    assert.ok(token, 'el enlace de correo debe incluir el token de un solo uso');
    assert.equal((await crm.responderCotizacion({ token, accion: 'ACEPTAR' })).estado, 'ACEPTADA');
    await assert.rejects(crm.responderCotizacion({ token, accion: 'ACEPTAR' }));
    const body = {
      version: await version(o.id),
      cotizacion_id: c2.id,
      orden_cliente: 'OC-001',
    };
    const borradorVenta = (await crm.confirmar(o.id, body, seller)).data;
    assert.equal(borradorVenta.estado, 'BORRADOR');
    assert.equal(borradorVenta.fecha_confirmacion, null);
    assert.equal(borradorVenta.orden_cliente, null);
    assert.equal(await p.manifiestos.count(), 0);
    assert.equal(
      (await crm.ordenes(seller)).data.find((x) => x.id === borradorVenta.id)
        .tipo_compra,
      null,
    );
    const metricasAntesDeConfirmar = (await crm.metricas(seller, {})).data;
    assert.equal(metricasAntesDeConfirmar.convertidos, 1);
    assert.equal(metricasAntesDeConfirmar.ordenes_periodo, 0);
    await assert.rejects(
      crm.produccion(borradorVenta.id, {}, seller),
      (e) => e.status === 400,
    );
    const venta = (await crm.confirmarOrdenVenta(
      borradorVenta.id,
      { orden_cliente: 'OC-001' },
      seller,
    )).data;
    assert.equal(venta.estado, 'CONFIRMADA');
    assert.ok(venta.fecha_confirmacion);
    assert.equal(await p.manifiestos.count(), 1);
    await crm.confirmarOrdenVenta(venta.id, { orden_cliente: 'OC-001' }, seller);
    assert.equal(await p.manifiestos.count(), 1);
    assert.equal(
      (await crm.ordenes(seller)).data.find((o) => o.id === venta.id)
        .tipo_compra,
      'PRIMERA_COMPRA',
    );
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
    const plantillas = (await crm.plantillasVenta(account.persona_id, seller)).data;
    assert.ok(plantillas.some((x) => x.id === c2.id));
    const recompraReutilizada = (await crm.crearRecompra(
      account.persona_id,
      {
        cotizacion_origen_id: c2.id,
        titulo: 'Recompra con análisis anterior',
        cantidad_estimada: '100',
        unidad: 'Litros',
      },
      seller,
    )).data;
    assert.equal(recompraReutilizada.etapa, 'COTIZACION');
    assert.equal(recompraReutilizada.estado_tecnico, 'VIABLE');
    const reporteReutilizado = await p.id_reportes_oportunidad.findFirstOrThrow({
      where: { oportunidad_id: recompraReutilizada.id },
    });
    assert.equal(reporteReutilizado.reutilizado_de_id, reportePublicado.data.id);
    assert.equal(reporteReutilizado.reutilizado_de_cotizacion_id, c2.id);
    assert.equal(await p.muestras.count({ where: { oportunidad_id: recompraReutilizada.id } }), 0);
    const [archivoOriginal, archivoReutilizado] = await Promise.all([
      crm.documento('reporte', reportePublicado.data.id, seller),
      crm.documento('reporte', reporteReutilizado.id, seller),
    ]);
    assert.deepEqual(Buffer.from(archivoReutilizado.contenido), Buffer.from(archivoOriginal.contenido));
    const costoReutilizado = await p.crm_costos_oportunidad.findFirstOrThrow({
      where: { oportunidad_id: recompraReutilizada.id },
    });
    assert.ok(costoReutilizado.reutilizado_de_id);
    await assert.rejects(
      crm.cotizar(
        recompraReutilizada.id,
        {
          version: await version(recompraReutilizada.id),
          tipo_venta: 'PRODUCTO_NUEVO',
          producto_id: prod.id_Produc_Mater,
          servicio: 'Servicio diferente',
          cantidad: '100',
          unidad: 'Litros',
          moneda: 'MXN',
          total: '1160',
          subtotal: '1000',
          impuestos: '160',
          vigencia_hasta: future,
          condiciones_comerciales: 'Pago 30 días',
        },
        pdf,
        seller,
      ),
      (e) => e.status === 400,
    );
    const cotizacionRecompra = await quote(recompraReutilizada.id);
    assert.equal(cotizacionRecompra.estado, 'BORRADOR');
    assert.equal(cotizacionRecompra.reporte_id, reporteReutilizado.id);
    assert.equal((await crm.ordenes(seller)).data.find((x) => x.id === venta.id).tipo_compra, 'PRIMERA_COMPRA');
    const times = await p.id_ejecuciones.findMany();
    const ubicacion = await p.inventario_ubicaciones.create({
      data: { codigo: 'ALM', nombre: 'Almacén', tipo: 'ALMACEN' },
    });
    const material = await p.lotes_inventario.create({
      data: {
        folio: 'BASE',
        producto_id: prod.id_Produc_Mater,
        unidad: 'Litros',
        propiedad: 'PROPIO',
        condicion: 'INSUMO',
        origen: 'APERTURA',
        estado_calidad_recepcion: 'LIBERADO',
      },
    });
    await p.movimientos_inventario.create({
      data: {
        folio_Movi: 'AP1',
        clave_evento: 'ap1',
        lote_inventario_id: material.id,
        tipo: 'APERTURA',
        cantidad: '100',
        ubicacion_destino_id: ubicacion.id,
        realizado_por: 'test',
        motivo: 'Saldo inicial',
      },
    });
    const plan = {
      no_Orden_Produc: 'OP-1',
      cantidad: '100',
      tipo_Operacion: 'Fabricación',
      linea_Produccion: 'GRAFITO',
      responsable_id: seller.personaId,
      materiales_completos: true,
      materiales: [
        {
          lote_inventario_id: material.id,
          ubicacion_id: ubicacion.id,
          cantidad: '100',
        },
      ],
    };
    const op = (await crm.produccion(venta.id, plan, seller)).data;
    const asignacion = await p.crm_ordenes_venta_produccion.findUnique({
      where: {
        orden_venta_id_orden_produccion_id: {
          orden_venta_id: venta.id,
          orden_produccion_id: op.id_Orden_Produc,
        },
      },
    });
    assert.equal(asignacion.orden_produccion_id, op.id_Orden_Produc);
    assert.equal(
      (await crm.produccion(venta.id, plan, seller)).data.id_Orden_Produc,
      op.id_Orden_Produc,
    );
    const {
      ProductionService,
    } = require('../dist/production/production.service');
    const { CalidadService } = require('../dist/calidad/calidad.service');
    const tiempos = new TrazabilidadService(p),
      produccion = new ProductionService(p, tiempos, ev),
      calidad = new CalidadService(p, tiempos, ev);
    const operario = { ...seller, area: 'produccion' };
    const tanque = await p.equipos_tanques.create({
      data: {
        codigo_Equipo: 'T1',
        nombre_Equipo: 'Tanque 1',
        tipo: 'GRAFITO',
        estatus_proceso: 'VACIO',
        capacidad: '60',
        unidad_capacidad: 'Litros',
      },
    });
    const reserva = await p.inventario_reservas.findFirst({
      where: { orden_produccion_id: op.id_Orden_Produc },
    });
    await assert.rejects(
      crm.produccion(
        venta.id,
        { ...plan, no_Orden_Produc: 'OP-exceso' },
        seller,
      ),
    );
    await assert.rejects(
      produccion.iniciarLote(
        {
          orden_produccion_id: op.id_Orden_Produc,
          tanque_id: tanque.id_Equipos_Tanques,
          no_Lote: 'EXCESO',
          consumos: [{ reserva_id: reserva.id, cantidad: '61' }],
        },
        operario,
      ),
    );
    assert.equal(await p.lotes_produccion.count(), 0);
    const inicio = {
      orden_produccion_id: op.id_Orden_Produc,
      tanque_id: tanque.id_Equipos_Tanques,
      no_Lote: 'L-1',
      consumos: [{ reserva_id: reserva.id, cantidad: '40' }],
    };
    const lote1 = (await produccion.iniciarLote(inicio, operario)).data;
    assert.equal(
      (await produccion.iniciarLote(inicio, operario)).data.id_Lote_Produccion,
      lote1.id_Lote_Produccion,
    );
    assert.equal(
      await p.movimientos_inventario.count({
        where: { tipo: 'SALIDA_CONSUMO' },
      }),
      1,
    );
    await produccion.actualizarEstatusTanque({
      tanqueId: tanque.id_Equipos_Tanques,
      estatus_proceso: 'MUESTREO',
    });
    await produccion.actualizarEstatusTanque({
      tanqueId: tanque.id_Equipos_Tanques,
      estatus_proceso: 'MUESTREO',
    });
    const muestra = await p.muestras.findFirst({
      where: { lote_id: lote1.id_Lote_Produccion },
    });
    assert.equal(
      await p.muestras.count({ where: { lote_id: lote1.id_Lote_Produccion } }),
      1,
    );
    assert.equal(muestra.producto_id, prod.id_Produc_Mater);
    assert.equal(muestra.cliente_id, account.persona_id);
    await assert.rejects(
      produccion.actualizarEstatusTanque({
        tanqueId: tanque.id_Equipos_Tanques,
        estatus_proceso: 'LIBERADO_CALIDAD',
      }),
    );
    await p.muestras.update({
      where: { id_Muestra: muestra.id_Muestra },
      data: { categoria_Muestra: 'MUESTRA_AJUSTADO' },
    });
    const parametro = await p.parametros_laboratorio.create({
      data: { nombre_Parametro: 'Densidad', tipo_Dato: 'NUMERICO' },
    });
    await calidad.cambiarEtapaMuestra(muestra.id_Muestra, 'RECIBIR');
    await calidad.cambiarEtapaMuestra(muestra.id_Muestra, 'INICIAR');
    await calidad.finalizarAnalisis({
      idMuestra: muestra.id_Muestra,
      tipoMuestra: 'MUESTRA_AJUSTADO',
      dictamen: 'APROBADO',
      analistaNombre: 'Laboratorio',
      mediciones: [{ id_Parametro: parametro.id_Parametro, valor: '1.1' }],
    });
    await calidad.subirCertificadoCalidad(
      muestra.id_Muestra,
      { folio_Certificado: 'CERT-1', no_Certificado: 'N-1', fecha_Emision: new Date().toISOString().slice(0, 10) },
      { ...pdf, mimetype: 'application/pdf', originalname: 'certificado.pdf' },
      { personaId: 2 },
    );
    await produccion.actualizarEstatusTanque({
      tanqueId: tanque.id_Equipos_Tanques,
      estatus_proceso: 'LIBERADO_CALIDAD',
    });
    const salida = (
      await produccion.descargar(
        lote1.id_Lote_Produccion,
        { cantidad: '39.5', ubicacion_id: ubicacion.id },
        operario,
      )
    ).data;
    await produccion.descargar(
      lote1.id_Lote_Produccion,
      { cantidad: '39.5', ubicacion_id: ubicacion.id },
      operario,
    );
    assert.equal(
      await p.movimientos_inventario.count({
        where: { tipo: 'ENTRADA_PRODUCCION' },
      }),
      1,
    );
    assert.equal(
      (await produccion.stock()).data
        .find((x) => x.lote_inventario_id === salida.id)
        .disponible.toString(),
      '39.5',
    );
    const lote2 = (
      await produccion.iniciarLote(
        {
          ...inicio,
          no_Lote: 'L-2',
          consumos: [{ reserva_id: reserva.id, cantidad: '60' }],
        },
        operario,
      )
    ).data;
    await produccion.descargar(
      lote2.id_Lote_Produccion,
      { cantidad: '58', ubicacion_id: ubicacion.id },
      operario,
    );
    const material2 = await p.lotes_inventario.findFirst({
      where: { lote_produccion_id: lote2.id_Lote_Produccion },
    });
    assert.equal(
      (await produccion.stock()).data
        .find((x) => x.lote_inventario_id === material2.id)
        .disponible.toString(),
      '0',
    );
    const recepcionBody = {
      folio: 'REC-1',
      remitente_id: account.persona_id,
      producto_id: prod.id_Produc_Mater,
      propiedad: 'PROPIO',
      cantidad: '50',
      ubicacion_id: ubicacion.id,
    };
    const recepcion = (
      await produccion.recibirMaterial(recepcionBody, operario)
    ).data;
    await produccion.recibirMaterial(recepcionBody, operario);
    assert.equal(await p.lotes_llegada.count(), 1);
    const entrada = await p.lotes_inventario.findFirst({
      where: { recepcion_id: recepcion.id },
    });
    assert.equal(
      (await produccion.stock()).data
        .find((x) => x.lote_inventario_id === entrada.id)
        .disponible.toString(),
      '0',
    );
    await calidad.crearLoteConChecklist({
      recepcion_id: recepcion.id,
      reviso_nombre: 'Laboratorio',
      estado_checklist: 'COMPLETADO',
      contenedores: [
        {
          no_consecutivo: 1,
          numero_contenedor: 'C1',
          tapa_valvula: false,
          rejilla_danada: false,
          base_danada: false,
          derrame: false,
        },
      ],
    });
    const mp = await p.muestras.findFirst({
      where: { lote_inventario_id: entrada.id },
    });
    await calidad.cambiarEtapaMuestra(mp.id_Muestra, 'RECIBIR');
    await calidad.cambiarEtapaMuestra(mp.id_Muestra, 'INICIAR');
    await calidad.finalizarAnalisis({
      idMuestra: mp.id_Muestra,
      tipoMuestra: 'MUESTRA_AJUSTADO',
      dictamen: 'APROBADO',
      analistaNombre: 'Laboratorio',
      mediciones: [{ id_Parametro: parametro.id_Parametro, valor: '1.1' }],
    });
    assert.equal(
      (await produccion.stock()).data
        .find((x) => x.lote_inventario_id === entrada.id)
        .disponible.toString(),
      '50',
    );
    const propia = (
      await produccion.crearOrden(
        {
          ...plan,
          no_Orden_Produc: 'OP-PROPIA',
          producto_id: prod.id_Produc_Mater,
          cantidad: '50',
          materiales: [
            {
              lote_inventario_id: entrada.id,
              ubicacion_id: ubicacion.id,
              cantidad: '50',
            },
          ],
        },
        operario,
      )
    ).data;
    assert.deepEqual(
      await p.crm_ordenes_venta_produccion.findMany({
        where: { orden_produccion_id: propia.id_Orden_Produc },
      }),
      [],
    );
    await produccion.cerrarOrden(
      propia.id_Orden_Produc,
      { estado: 'CANCELADA', motivo: 'Liberar reserva de prueba' },
      operario,
    );
    assert.equal(
      (await produccion.stock()).data
        .find((x) => x.lote_inventario_id === entrada.id)
        .disponible.toString(),
      '50',
    );
    const grafito = await produccion.obtenerTodasLasOrdenesGrafito();
    assert.equal(
      grafito.result.find((x) => x.id_Orden_Produc === op.id_Orden_Produc)
        .lotes_produccion.length,
      2,
    );
    assert.equal(
      grafito.result
        .find((x) => x.id_Orden_Produc === op.id_Orden_Produc)
        .lotes_produccion[0].cantidad_producida.toString(),
      '39.5',
    );
    await produccion.cerrarOrden(
      op.id_Orden_Produc,
      { estado: 'FINALIZADA', motivo: 'Dos lotes terminados' },
      operario,
    );
    assert.equal(
      (
        await p.ordenes_produccion.findUnique({
          where: { id_Orden_Produc: op.id_Orden_Produc },
        })
      ).estado_Plan,
      'FINALIZADA',
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
    await objetivo(o2.id);
    const c3 = await quote(o2.id);
    await accept(o2.id, c3.id);
    const venta2Borrador = (
      await crm.confirmar(
        o2.id,
        {
          version: await version(o2.id),
          cotizacion_id: c3.id,
        },
        seller,
      )
    ).data;
    assert.equal(venta2Borrador.estado, 'BORRADOR');
    const venta2 = (await crm.confirmarOrdenVenta(
      venta2Borrador.id,
      { orden_cliente: 'OC-002' },
      seller,
    )).data;
    assert.equal(
      (await crm.ordenes(seller)).data.find((o) => o.id === venta2.id)
        .tipo_compra,
      'RECOMPRA',
    );
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
    const grafitoKg = await p.productos_materiales.create({
      data: { nombre_Producto: 'Grafito preparado', UM: 'Kilogramos' },
    });
    const ordenesProduccionAntesDelAviso = await p.ordenes_produccion.count();
    const reservasAntesDelAviso = await p.inventario_reservas.count();
    const aviso = (await crm.crearPedidoPreparacion({
      cliente_id: account.persona_id,
      fecha_requerida: future,
      observaciones: 'Preparar antes de confirmar las OVs.',
      detalles: [
        {
          producto_id: grafitoKg.id_Produc_Mater,
          tipo_prensa: 'Fagor',
          cantidad_solicitada: '2550',
          contenedores_solicitados: 3,
          peso_estimado_contenedor: '850',
        },
        {
          producto_id: grafitoKg.id_Produc_Mater,
          tipo_prensa: 'Polymaster',
          cantidad_solicitada: '1700',
          contenedores_solicitados: 2,
          peso_estimado_contenedor: '850',
        },
      ],
    }, seller)).data;
    assert.equal(aviso.detalles.length, 2);
    assert.equal(await p.ordenes_produccion.count(), ordenesProduccionAntesDelAviso);
    assert.equal(await p.inventario_reservas.count(), reservasAntesDelAviso);
    await assert.rejects(
      crm.pedidosPreparacionCuenta(account.persona_id, { ...seller, personaId: 999 }),
      (e) => e.status === 404,
    );
    const avisoEnProduccion = (await crm.pedidosPreparacionProduccion()).data.find((x) => x.id === aviso.id);
    assert.ok(avisoEnProduccion);
    const produccionUser = { ...seller, area: 'produccion' };
    const avisoParcial = (await crm.actualizarPedidoPreparacion(aviso.id, {
      estado: 'RECIBIDO',
      detalles: [
        { id: aviso.detalles[0].id, cantidad_preparada: '1700' },
        { id: aviso.detalles[1].id, cantidad_preparada: '850' },
      ],
    }, produccionUser)).data;
    assert.equal(avisoParcial.estado, 'PARCIAL');
    const crearOVPreparacion = async (folio, cantidad, detalleId) => {
      const borrador = await p.crm_ordenes_venta.create({
        data: {
          folio,
          persona_id: account.persona_id,
          vendedor_id: seller.personaId,
          producto_id: grafitoKg.id_Produc_Mater,
          tipo_venta: 'PRODUCTO_NUEVO',
          servicio: 'Preparación de grafito',
          estado: 'BORRADOR',
          cantidad,
          unidad: 'Kilogramos',
          subtotal: 100,
          impuestos: 16,
          importe_total: 116,
          fecha_confirmacion: null,
          creado_por: seller.usuario,
        },
      });
      return crm.confirmarOrdenVenta(borrador.id, {
        orden_cliente: `OC-${folio}`,
        pedido_preparacion_detalle_id: detalleId,
      }, seller);
    };
    const [ovPreparacionA, ovPreparacionB] = await Promise.all([
      crearOVPreparacion('OV-PREP-A', '1700', aviso.detalles[0].id),
      crearOVPreparacion('OV-PREP-B', '850', aviso.detalles[0].id),
    ]);
    assert.equal(ovPreparacionA.data.pedido_preparacion_detalle_id, aviso.detalles[0].id);
    assert.equal(ovPreparacionB.data.pedido_preparacion_detalle_id, aviso.detalles[0].id);
    const avisoConOVs = (await crm.pedidosPreparacionProduccion()).data.find((x) => x.id === aviso.id);
    assert.deepEqual(
      avisoConOVs.detalles[0].ordenes_venta.map((x) => x.folio).sort(),
      ['OV-PREP-A', 'OV-PREP-B'],
    );
    const avisoPreparado = (await crm.actualizarPedidoPreparacion(aviso.id, {
      detalles: [
        { id: aviso.detalles[0].id, cantidad_preparada: '2550' },
        { id: aviso.detalles[1].id, cantidad_preparada: '1700' },
      ],
      respuesta_produccion: 'Listo para programar.',
    }, produccionUser)).data;
    assert.equal(avisoPreparado.estado, 'PREPARADO');
    const o3 = await open(),
      m4 = await sample(o3.id);
    await finish(m4);
    await report(o3.id);
    await objetivo(o3.id);
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
    // El cierre comercial no interrumpe un ciclo técnico pendiente.
    const enCurso = (await id.detalle(m4, lab)).data.procesos_id.at(-1);
    await id.proceso(m4, enCurso.id, 'iniciar', {}, lab);
    await id.proceso(
      m4,
      enCurso.id,
      'terminar',
      { resultado: 'Conforme' },
      lab,
    );
    await id.guardarAnalisisEstructurado(m4, {
      etapa: 'PRELIMINAR',
      datos: { metricas: [{ clave: 'viscosidad_40', nombre: 'Viscosidad a 40°', valor: '44', unidad: 'cSt' }] },
    }, lab);
    await id.guardarAnalisisEstructurado(m4, {
      etapa: 'PROCESAMIENTO',
      datos: { tipo: 'FILTRACION', filtracion: 'ESTANDAR' },
    }, lab);
    await id.guardarAnalisisEstructurado(m4, {
      etapa: 'FINAL',
      datos: { metricas: [{ clave: 'viscosidad_40', nombre: 'Viscosidad a 40°', valor: '40', unidad: 'cSt' }] },
    }, lab);
    await id.finalizar(m4, { dictamen: 'APROBADO' }, lab);
    await report(o3.id);
    await objetivo(o3.id);
    assert.equal((await crm.detalle(o3.id, seller)).data.etapa, 'PERDIDA');
    await assert.rejects(quote(o3.id), (e) => e.status === 409);
    await id.planificar(m4, { procesos: [proc.id], nuevoCiclo: true }, lab);
    assert.equal((await crm.detalle(o3.id, seller)).data.etapa, 'PERDIDA');
    assert.equal(
      await p.id_reportes_oportunidad.count({
        where: { oportunidad_id: o3.id, estado: 'PUBLICADO' },
      }),
      0,
    );

    // Recepción, dictamen y reporte siguen disponibles después de cancelar.
    const o4 = await open(),
      m5 = await sample(o4.id);
    await crm.guardar(
      o4.id,
      {
        version: await version(o4.id),
        etapa: 'CANCELADA',
        nota: 'Cancelación comercial',
      },
      seller,
    );
    await finish(m5);
    await report(o4.id);
    const cerrada = (await crm.detalle(o4.id, seller)).data;
    assert.equal(cerrada.etapa, 'CANCELADA');
    assert.equal(cerrada.muestras[0].estado_Muestra, 'APROBADO');
    assert.equal(
      await p.proceso_tramos.count({
        where: { entidad: 'MUESTRA_ID', entidad_id: m5, fin: null },
      }),
      0,
    );
    await crm.anularReporte(
      o4.id,
      cerrada.reportes_id[0].id,
      {
        version: cerrada.version,
        motivo: 'Corrección documental',
      },
      lab,
    );
    assert.equal((await crm.detalle(o4.id, seller)).data.etapa, 'CANCELADA');

    // Muestras históricas sin oportunidad conservan sus ciclos y sus tiempos.
    const o5 = await open(),
      m6 = await sample(o5.id);
    await p.muestras.update({
      where: { id_Muestra: m6 },
      data: { oportunidad_id: null, id_flujo_estructurado: false },
    });
    await finish(m6);
    const historialAntes = await p.id_ejecuciones.findMany({
      where: { muestra_id: m6 },
    });
    await id.planificar(m6, { procesos: [proc.id], nuevoCiclo: true }, lab);
    await crm.asociar(
      o5.id,
      { version: await version(o5.id), muestra_id: m6 },
      seller,
    );
    const procesoHistorico = (await id.detalle(m6, lab)).data.procesos_id.at(
      -1,
    );
    await id.proceso(m6, procesoHistorico.id, 'iniciar', {}, lab);
    await id.proceso(
      m6,
      procesoHistorico.id,
      'terminar',
      { resultado: 'Verificado' },
      lab,
    );
    await id.finalizar(m6, { dictamen: 'APROBADO' }, lab);
    await report(o5.id);
    assert.deepEqual(
      await p.id_ejecuciones.findMany({ where: { muestra_id: m6, ciclo: 1 } }),
      historialAntes,
    );
    assert.equal((await crm.detalle(o5.id, seller)).data.etapa, 'COTIZACION');
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
