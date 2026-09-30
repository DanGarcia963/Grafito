import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomBytes, scryptSync } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { corsOptions } from '../src/config/runtime';

describe('HTTP, CORS y autorización (base simulada)', () => {
  let app: INestApplication;
  let token: string;
  const password = randomBytes(20).toString('hex');
  const previousUsers = process.env.UST_USUARIOS_JSON;
  const previousOrigins = process.env.CORS_ORIGINS;
  beforeAll(async () => {
    const salt = randomBytes(16).toString('hex');
    process.env.CORS_ORIGINS = 'http://localhost:3000';
    process.env.UST_USUARIOS_JSON = JSON.stringify([{ usuario: 'test', personaId: 1,
      areas: ['calidad'], salt, hash: scryptSync(password, salt, 64).toString('hex') }]);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({
        $connect: async () => {}, $disconnect: async () => {},
        $queryRaw: async () => [{ fecha_servidor: new Date(0) }],
        ordenes_produccion: { findMany: async () => [] },
      }).compile();
    app = module.createNestApplication(); app.enableCors(corsOptions); await app.init();
    const response = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ usuario: 'test', password, area: 'calidad' }).expect(201);
    token = response.body.token;
  });
  afterAll(async () => {
    await app?.close();
    if (previousUsers === undefined) delete process.env.UST_USUARIOS_JSON;
    else process.env.UST_USUARIOS_JSON = previousUsers;
    if (previousOrigins === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = previousOrigins;
  });
  it('salud pública', () => request(app.getHttpServer()).get('/api/health').expect(200));
  it('lectura sin sesión rechazada', () => request(app.getHttpServer()).get('/api/ventas/test').expect(401));
  it('test-db requiere sesión', () => request(app.getHttpServer()).get('/api/test-db').expect(401));
  it('test-db con sesión', () => request(app.getHttpServer()).get('/api/test-db').set('Authorization', `Bearer ${token}`).expect(200));
  it('calidad no puede crear ventas', () => request(app.getHttpServer()).post('/api/ventas/crear').set('Authorization', `Bearer ${token}`).send({}).expect(403));
  it('preflight permite Authorization desde origen configurado', async () => {
    const r = await request(app.getHttpServer()).options('/api/ventas/test')
      .set('Origin', 'http://localhost:3000').set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization').expect(204);
    expect(r.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(r.headers['access-control-allow-headers']).toContain('Authorization');
  });
  it('origen ajeno no obtiene autorización CORS', async () => {
    const r = await request(app.getHttpServer()).get('/api/health').set('Origin', 'https://ajeno.example');
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });
});
