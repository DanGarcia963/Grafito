import { AppController } from './app.controller';
import { PrismaService } from './prisma.service';
describe('AppController', () => {
  it('devuelve salud sin consultar la base', () => {
    const controller = new AppController({} as PrismaService);
    expect(controller.health()).toEqual({ status: 'ok' });
  });
  it('identifica PostgreSQL en la comprobación de conexión', async () => {
    const db = { $queryRaw: jest.fn().mockResolvedValue([{ fecha_servidor: new Date(0) }]) };
    const result = await new AppController(db as unknown as PrismaService).testDb();
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('message', '¡Conexión exitosa a PostgreSQL en Supabase usando Prisma y NestJS!');
  });
});
