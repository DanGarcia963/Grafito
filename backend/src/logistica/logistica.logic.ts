import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type TipoVehiculo = 'TORTON' | 'TRAILER';
export const CAPACIDADES_CONTENEDORES: Record<TipoVehiculo, number> = {
  TORTON: 12, TRAILER: 22,
};
export function tipoVehiculo(valor: unknown): TipoVehiculo {
  if (valor !== 'TORTON' && valor !== 'TRAILER') {
    throw new BadRequestException('Tipo de vehículo: TORTON o TRAILER.');
  }
  return valor;
}
export function idSeguro(valor: unknown, nombre = 'Identificador'): number {
  const num = Number(valor);
  if (!Number.isSafeInteger(num) || num <= 0 || String(valor ?? '').trim() === '') {
    throw new BadRequestException(nombre + ' inválido.');
  }
  return num;
}
export function decimalPositivo(valor: unknown, nombre: string): Prisma.Decimal {
  try {
    const valorDecimal = new Prisma.Decimal(String(valor ?? ''));
    if (!valorDecimal.isFinite() || !valorDecimal.gt(0) ||
      valorDecimal.decimalPlaces() > 4) throw new Error();
    return valorDecimal;
  } catch {
    throw new BadRequestException(nombre + ' debe ser mayor a cero, con máximo 4 decimales.');
  }
}
export function decimalNoNegativo(valor: unknown, nombre: string): Prisma.Decimal {
  try {
    const v = new Prisma.Decimal(String(valor ?? ''));
    if (!v.isFinite() || v.lt(0) || v.decimalPlaces() > 4) throw new Error();
    return v;
  } catch {
    throw new BadRequestException(nombre + ' debe ser no negativo, con máximo 4 decimales.');
  }
}
export function textoSeguro(valor: unknown, nombre: string, max = 150): string {
  const v = String(valor ?? '').trim();
  if (!v || v.length > max) throw new BadRequestException(nombre + ' obligatorio (máximo ' + max + ' caracteres).');
  return v;
}
export function compararCarga(
  cantidadContenedores: number, cantidadKg: Prisma.Decimal,
  tipo: TipoVehiculo, pesoMaximo: Prisma.Decimal,
) {
  if (cantidadContenedores < 1) throw new ConflictException('Agrega contenedores antes de cargar.');
  if (cantidadContenedores > CAPACIDADES_CONTENEDORES[tipo]) {
    throw new ConflictException('La cantidad de contenedores excede la capacidad del ' + tipo + '.');
  }
  if (cantidadKg.gt(pesoMaximo)) {
    throw new ConflictException('El peso asignado excede la capacidad real del vehículo.');
  }
}
export function saldoFisicoUbicacion(movimientos: Array<{
  cantidad: Prisma.Decimal; ubicacion_origen_id: number | null; ubicacion_destino_id: number | null;
}>, ubicacionId: number): Prisma.Decimal {
  return movimientos.reduce((total, m) =>
    total.add(m.ubicacion_destino_id === ubicacionId ? m.cantidad : 0)
      .sub(m.ubicacion_origen_id === ubicacionId ? m.cantidad : 0),
  new Prisma.Decimal(0));
}
export function verificarRecepcion(
  embarcado: Prisma.Decimal,
  recibido: Prisma.Decimal,
): { diferencia: Prisma.Decimal; conciliado: boolean } {
  if (recibido.gt(embarcado)) throw new BadRequestException('No se puede recibir más de lo despachado.');
  const diferencia = embarcado.sub(recibido);
  return { diferencia, conciliado: diferencia.isZero() };
}
export function expedienteComercialApto(
  lp: { estado: string; estado_Calida: string },
  certificados: Array<{ estatus: string | null; estatus_Calidad: string | null; documento_contenido: unknown }>,
  legado: { estado: string; documento_contenido: unknown } | null,
): boolean {
  if (lp.estado !== 'FINALIZADO' || lp.estado_Calida !== 'LIBERADO') return false;
  return certificados.some(c =>
    c.estatus === 'EMITIDO' && c.estatus_Calidad === 'APROBADO' && !!c.documento_contenido) ||
    (legado?.estado === 'VALIDADA' && !!legado.documento_contenido);
}
