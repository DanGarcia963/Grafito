// Ejecutar después de npm run build: node --test test/seguridad.integration.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scryptSync } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
process.env.REDIS_ENABLED = 'false';
const password = 'solo-prueba-local';
process.env.UST_USUARIOS_JSON = JSON.stringify([{usuario:'prueba',personaId:1,areas:['seguridad','ventas'],salt:'test',hash:scryptSync(password,'test',64).toString('hex')}]);
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/prisma.service');

test('Seguridad: sesión, permisos de matriz/KPIs y descarga autenticada', async () => {
  const pdf = Buffer.from('%PDF-1.4\nprueba');
  const prisma = {
    $queryRaw: async () => [],
    catalogo_tramites: {findMany: async () => []},
    tramites_legales: {
      findMany: async () => [],
      findUnique: async () => ({documentos_legales:{nombre_archivo:'prueba.pdf',contenido_pdf:pdf}}),
    },
  };
  const module = await Test.createTestingModule({imports:[AppModule]}).overrideProvider(PrismaService).useValue(prisma).compile();
  const app = module.createNestApplication();
  await app.init();
  const api = request(app.getHttpServer());
  try {
    const login = async area => {
      const response = await api.post('/api/auth/login').send({usuario:'prueba',password,area}).expect(201);
      return response.body.token;
    };
    const seguridad = await login('seguridad');
    const ventas = await login('ventas');
    const paths = ['/api/seguridad/catalogo-tramites','/api/seguridad/tramites','/api/seguridad/tramites/1/documento','/api/kpis/catalogos','/api/kpis/dashboard','/api/kpis/resultados/1','/api/kpis/evidencias/1/archivo'];
    for (const path of paths) {
      await api.get(path).expect(401);
      await api.get(path).set('Authorization', `Bearer ${ventas}`).expect(403);
    }
    for (const path of ['/api/seguridad/catalogo-tramites','/api/seguridad/tramites','/api/kpis/catalogos','/api/kpis/dashboard']) {
      await api.get(path).set('Authorization', `Bearer ${seguridad}`).expect(200);
    }
    const response = await api.get('/api/seguridad/tramites/1/documento').set('Authorization', `Bearer ${seguridad}`).expect(200);
    assert.match(response.headers['content-type'], /application\/pdf/);
    assert.deepEqual(response.body,pdf);
    await api.post('/api/seguridad/tramites').set('Authorization', `Bearer ${ventas}`).expect(403);
    await api.post('/api/seguridad/tramites').set('Authorization', `Bearer ${seguridad}`).field('id_tramite_catalogo','1').expect(400);
    await api.post('/api/auth/salir').set('Authorization', `Bearer ${seguridad}`).expect(201);
    await api.get('/api/kpis/catalogos').set('Authorization', `Bearer ${seguridad}`).expect(401);
  } finally { await app.close(); }
});
