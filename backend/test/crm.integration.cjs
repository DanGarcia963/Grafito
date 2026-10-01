// npm run build && node --test test/crm.integration.cjs
// PostgreSQL local en memoria; no usa DATABASE_URL ni toca Supabase.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { Prisma } = require('@prisma/client');
const { CrmService } = require('../dist/ventas/crm.service');
const { filtrosCrm } = require('../dist/ventas/crm.logic');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
const { scryptSync } = require('node:crypto');
const usuario = { usuario: 'vendedor', personaId: 10, area: 'ventas' };

async function fixture() {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE productos_materiales ("id_Produc_Mater" int PRIMARY KEY,"nombre_Producto" text);
 CREATE TABLE personas ("id_Persona" int PRIMARY KEY,nombre text);
 CREATE TABLE muestras ("id_Muestra" int PRIMARY KEY,"no_Muestra" text,"area_Muestra" text,vendedor_id int,producto_id int,cliente_id int,cantidad_proyecto numeric,unidad_proyecto text,"estado_Muestra" text,fecha_recoleccion timestamp,fecha_ingreso_laboratorio timestamp);
 CREATE TABLE proceso_eventos (id serial PRIMARY KEY,entidad text,entidad_id int,accion text,ciclo int,fecha timestamp,detalle text);
 CREATE TABLE proceso_tramos (id int PRIMARY KEY,etapa text,inicio timestamp,fin timestamp);
 CREATE TABLE id_ejecuciones (id int PRIMARY KEY,inicio timestamp,fin timestamp,estandar_segundos int);
 INSERT INTO productos_materiales VALUES(1,'Aceite'); INSERT INTO personas VALUES(1,'Cliente 100%_real');
 INSERT INTO muestras SELECT n,'ID-'||n,'INVESTIGACION_DESARROLLO',10,1,1,100,'L','PENDIENTE','2026-09-10 12:00',null FROM generate_series(1,61) n;
 INSERT INTO muestras VALUES(62,'OTRO','INVESTIGACION_DESARROLLO',20,1,1,100,'L','PENDIENTE','2026-09-10',null),(63,'CALIDAD','CALIDAD',10,1,1,100,'L','PENDIENTE','2026-09-10',null);
 UPDATE muestras SET fecha_ingreso_laboratorio='2026-09-11',"estado_Muestra"='APROBADO' WHERE "id_Muestra"=1;
 INSERT INTO proceso_tramos VALUES(1,'PROCESO_ID_1','2026-09-11','2026-09-12');
 INSERT INTO id_ejecuciones VALUES(1,'2026-09-11','2026-09-12',100);`);
  const adapter = (db) => ({
    $queryRaw: async (first, ...values) => {
      const sql = Array.isArray(first) ? Prisma.sql(first, ...values) : first;
      return (await db.query(sql.text, sql.values)).rows;
    },
    proceso_eventos: {
      create: async ({ data: d }) =>
        (
          await db.query(
            'INSERT INTO proceso_eventos(entidad,entidad_id,accion,ciclo,fecha,detalle) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
            [d.entidad, d.entidad_id, d.accion, d.ciclo, d.fecha, d.detalle],
          )
        ).rows[0],
      findMany: async ({ where: w, take }) =>
        (
          await db.query(
            'SELECT * FROM proceso_eventos WHERE entidad=$1 AND entidad_id=$2 AND accion=$3 ORDER BY id DESC LIMIT $4',
            [w.entidad, w.entidad_id, w.accion, take],
          )
        ).rows,
    },
  });
  const prisma = {
    ...adapter(pg),
    $transaction: (fn) => pg.transaction((tx) => fn(adapter(tx))),
  };
  const eventos = [];
  const crm = new CrmService(prisma, { notificar: (...v) => eventos.push(v) });
  return { pg, prisma, crm, eventos };
}
const guardar = (crm, id, actual, etapa, nota = 'Seguimiento de prueba') =>
  crm.guardar(
    id,
    {
      version: actual.version,
      etapaActual: actual.etapa,
      etapa,
      nota,
      proximoContacto: '2026-10-10T12:00:00Z',
    },
    usuario,
  );

test('CRM PostgreSQL: conversión global, aislamiento, historial, reapertura y tiempos intactos', async () => {
  const { pg, crm, eventos } = await fixture();
  try {
    const tiemposAntes = await pg.query('SELECT * FROM id_ejecuciones');
    const tramosAntes = await pg.query('SELECT * FROM proceso_tramos');
    const primera = await crm.listar(usuario, {});
    assert.equal(primera.total, 61);
    assert.equal(primera.data.length, 50);
    assert.equal(primera.resumen.conversion, 0);
    assert.equal(
      primera.resumen.porEtapa.EN_ANALISIS,
      1,
      'Aprobada en ID no equivale a venta',
    );
    assert.equal((await crm.listar(usuario, { pagina: '2' })).data.length, 11);
    assert.equal((await crm.listar(usuario, { q: '100%_real' })).total, 61);
    assert.equal((await crm.listar(usuario, { q: "' OR 1=1 --" })).total, 0);
    assert.equal((await crm.listar(usuario, { desde: '2026-09-11' })).total, 0);
    assert.equal(
      (await crm.listar(usuario, { desde: '2026-09-10', hasta: '2026-09-10' }))
        .total,
      61,
    );
    await assert.rejects(crm.detalle(62, usuario), (e) => e.status === 404);
    await assert.rejects(
      guardar(crm, 62, { version: 0, etapa: 'RECOLECCION' }, 'VENTA_ASEGURADA'),
      (e) => e.status === 404,
    );
    await assert.rejects(crm.detalle(63, usuario), (e) => e.status === 404);
    let d = (await crm.detalle(2, usuario)).data;
    await guardar(crm, 2, d, 'COTIZACION');
    await assert.rejects(
      guardar(crm, 2, d, 'VENTA_ASEGURADA'),
      (e) => e.status === 409,
    );
    d = (await crm.detalle(2, usuario)).data;
    await guardar(crm, 2, d, 'VENTA_ASEGURADA', 'Cliente confirmó compra');
    const ganada = await crm.detalle(2, usuario);
    assert.equal(ganada.data.proximoContacto, null);
    assert.equal(ganada.historial.length, 2);
    const filtrada = await crm.listar(usuario, {
      etapa: 'RECOLECCION',
      pagina: '2',
    });
    assert.equal(filtrada.resumen.total, 61);
    assert.equal(filtrada.resumen.aseguradas, 1);
    assert.equal(filtrada.resumen.conversion, 1.64);
    await guardar(
      crm,
      2,
      ganada.data,
      'COTIZACION',
      'Cliente reabre negociación',
    );
    assert.equal((await crm.listar(usuario, {})).resumen.aseguradas, 0);
    d = (await crm.detalle(3, usuario)).data;
    await guardar(crm, 3, d, 'RECOLECCION', 'Se entregará al laboratorio');
    d = (await crm.detalle(3, usuario)).data;
    await pg.exec(
      `UPDATE muestras SET fecha_ingreso_laboratorio='2026-09-12' WHERE "id_Muestra"=3`,
    );
    assert.equal(
      (await crm.detalle(3, usuario)).data.etapa,
      'EN_ANALISIS',
      'Recibir en ID actualiza incluso si ya hay notas',
    );
    await assert.rejects(
      guardar(crm, 3, d, 'COTIZACION'),
      (e) => e.status === 409,
    );
    await assert.rejects(
      guardar(crm, 4, { version: 0, etapa: 'RECOLECCION' }, 'EN_ANALISIS'),
      (e) => e.status === 400,
    );
    await assert.rejects(
      guardar(
        crm,
        4,
        { version: 0, etapa: 'RECOLECCION' },
        'VENTA_NO_ASEGURADA',
        '',
      ),
      (e) => e.status === 400,
    );
    const actual = (await crm.detalle(4, usuario)).data;
    const simultaneas = await Promise.allSettled([
      guardar(crm, 4, actual, 'VENTA_NO_ASEGURADA'),
      guardar(crm, 4, actual, 'COTIZACION'),
    ]);
    assert.equal(simultaneas.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(
      simultaneas.find((r) => r.status === 'rejected').reason.status,
      409,
    );
    assert.deepEqual(
      await pg.query('SELECT * FROM id_ejecuciones'),
      tiemposAntes,
    );
    assert.deepEqual(
      await pg.query('SELECT * FROM proceso_tramos'),
      tramosAntes,
    );
    assert.equal(
      (
        await pg.query(
          'SELECT "estado_Muestra" FROM muestras WHERE "id_Muestra"=2',
        )
      ).rows[0].estado_Muestra,
      'PENDIENTE',
    );
    assert.equal(
      eventos.length,
      5,
      'Solo se notifica después de guardar correctamente',
    );
    assert.throws(() => filtrosCrm({ desde: '2026-02-30' }));
    assert.throws(() => filtrosCrm({ pagina: '0' }));
    assert.throws(() => filtrosCrm({ etapa: 'APROBADO' }));
  } finally {
    await pg.close();
  }
});

test('CRM HTTP: Bearer, área Ventas y propiedad de la muestra', async () => {
  process.env.REDIS_ENABLED = 'false';
  const password = 'prueba-local',
    salt = 'test';
  process.env.UST_USUARIOS_JSON = JSON.stringify([
    {
      usuario: 'prueba',
      personaId: 10,
      areas: ['ventas', 'id', 'seguridad'],
      salt,
      hash: scryptSync(password, salt, 64).toString('hex'),
    },
  ]);
  const { AppModule } = require('../dist/app.module');
  const { PrismaService } = require('../dist/prisma.service');
  const { pg, prisma } = await fixture();
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();
  const app = module.createNestApplication();
  await app.init();
  const api = request(app.getHttpServer());
  try {
    const login = async (area) =>
      (
        await api
          .post('/api/auth/login')
          .send({ usuario: 'prueba', password, area })
          .expect(201)
      ).body.token;
    const ventas = await login('ventas'),
      id = await login('id');
    await api.get('/api/ventas/crm/oportunidades').expect(401);
    await api
      .get('/api/ventas/crm/oportunidades')
      .set('Authorization', `Bearer ${id}`)
      .expect(403);
    await api
      .post('/api/ventas/crm/oportunidades/2/seguimiento')
      .set('Authorization', `Bearer ${id}`)
      .send({})
      .expect(403);
    const result = await api
      .get('/api/ventas/crm/oportunidades')
      .set('Authorization', `Bearer ${ventas}`)
      .expect(200);
    assert.equal(result.body.resumen.total, 61);
    await api
      .get('/api/ventas/crm/oportunidades/62')
      .set('Authorization', `Bearer ${ventas}`)
      .expect(404);
    await api
      .post('/api/ventas/crm/oportunidades/2/seguimiento')
      .set('Authorization', `Bearer ${ventas}`)
      .send({
        version: 0,
        etapaActual: 'RECOLECCION',
        etapa: 'VENTA_ASEGURADA',
        nota: 'Compra confirmada',
      })
      .expect(201);
    const updated = await api
      .get('/api/ventas/crm/oportunidades?etapa=VENTA_ASEGURADA')
      .set('Authorization', `Bearer ${ventas}`)
      .expect(200);
    assert.equal(updated.body.total, 1);
    assert.equal(updated.body.resumen.aseguradas, 1);
  } finally {
    await app.close();
    await pg.close();
  }
});
