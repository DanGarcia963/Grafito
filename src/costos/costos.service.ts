import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, crm_moneda } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events.gateway';
import { Usuario } from '../auth/auth.service';

@Injectable()
export class CostosService {
  constructor(private readonly prisma: PrismaService, private readonly eventos: EventsGateway) {}

  async formulas() {
    const data = await this.prisma.crm_costos_oportunidad.findMany({
      where: { reporte: { is: { estado: 'PUBLICADO', resultado: 'VIABLE' } } },
      include: {
        reporte: { select: { version: true, publicado_en: true } },
        oportunidad: {
          select: {
            id: true, folio: true, titulo: true, etapa: true,
            cliente: { select: { nombre: true } },
            producto: { select: { nombre_Producto: true } },
            vendedor: { select: { nombre: true } },
          },
        },
      },
      orderBy: [{ precio_emitido_en: 'asc' }, { formula_enviada_en: 'desc' }],
    });
    return { success: true, data };
  }

  async emitirPrecio(id: number, body: any, usuario: Usuario) {
    const raw = String(body?.precio_objetivo_litro ?? '').trim();
    if (!/^\d{1,12}(\.\d{1,6})?$/.test(raw))
      throw new BadRequestException('El precio debe ser positivo y admitir hasta 6 decimales');
    const precio = new Prisma.Decimal(raw);
    if (!precio.isFinite() || precio.lte(0))
      throw new BadRequestException('El precio objetivo debe ser mayor que cero');
    const moneda = String(body?.moneda ?? 'MXN');
    if (!Object.values(crm_moneda).includes(moneda as crm_moneda))
      throw new BadRequestException('Moneda inválida');

    const data = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM crm_costos_oportunidad WHERE id=${id} FOR UPDATE`;
      const formula = await tx.crm_costos_oportunidad.findUnique({
        where: { id },
        include: { reporte: true },
      });
      if (!formula) throw new NotFoundException('Fórmula no encontrada');
      if (formula.reporte.estado !== 'PUBLICADO' || formula.reporte.resultado !== 'VIABLE')
        throw new ConflictException('El reporte asociado ya no está vigente');
      if (formula.precio_objetivo_litro !== null)
        throw new ConflictException('Esta versión ya tiene un precio emitido; solicita una nueva fórmula para generar otra versión');
      return tx.crm_costos_oportunidad.update({
        where: { id },
        data: {
          precio_objetivo_litro: precio,
          moneda: moneda as crm_moneda,
          precio_emitido_por: usuario.usuario,
          precio_emitido_en: new Date(),
        },
        include: {
          reporte: { select: { version: true } },
          oportunidad: { select: { id: true, folio: true, titulo: true } },
        },
      });
    });
    this.eventos.notificar('COSTOS_PRECIO_EMITIDO', { oportunidad_id: data.oportunidad_id });
    this.eventos.notificar('CRM_OPORTUNIDAD_ACTUALIZADA', { oportunidad_id: data.oportunidad_id });
    return { success: true, data };
  }
}
