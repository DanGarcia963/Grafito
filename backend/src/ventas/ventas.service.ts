import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Usuario } from '../auth/auth.service';
@Injectable()
export class VentasService {
  constructor(private readonly prisma: PrismaService) {}
  async obtenerTodasLasOrdenes(u: Usuario) {
    const result = await this.prisma.crm_ordenes_venta.findMany({
      where: u.area === 'ventas' ? { vendedor_id: u.personaId } : {},
      include: {
        cliente: true,
        vendedor: true,
        producto: true,
        ordenes_produccion: { include: { lotes_produccion: true } },
      },
      orderBy: { fecha_confirmacion: 'desc' },
    });
    return { success: true, result };
  }
}
