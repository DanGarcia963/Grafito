import { AuthGuard } from './auth/auth.guard';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('api')
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  health() { return { status: 'ok' }; }

  @UseGuards(AuthGuard)
  @Get('test-db')
  async testDb() {
    try {
      // Ejecuta una consulta nativa rápida a tu PostgreSQL en Supabase
      const result = await this.prisma.$queryRaw`SELECT NOW() as fecha_servidor`;
      return {
        success: true,
        message: '¡Conexión exitosa a PostgreSQL en Supabase usando Prisma y NestJS!',
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}