import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('api')
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('test-db')
  async testDb() {
    try {
      // Ejecuta una consulta nativa rápida a tu MySQL en XAMPP
      const result = await this.prisma.$queryRaw`SELECT NOW() as fecha_servidor`;
      return {
        success: true,
        message: '¡Conexión exitosa a MySQL en XAMPP usando Prisma y NestJS!',
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