import { Prisma } from '@prisma/client';

/** Comparación de la carga neta al tanque contra el producto descargado. */
export function calcularBalanceProduccion(
  cantidadCargada: Prisma.Decimal,
  cantidadProducida: Prisma.Decimal,
) {
  return {
    diferencia_neta: cantidadCargada.sub(cantidadProducida),
    rendimiento_porcentaje: cantidadCargada.gt(0)
      ? cantidadProducida.mul(100).div(cantidadCargada).toDecimalPlaces(2)
      : null,
  };
}
