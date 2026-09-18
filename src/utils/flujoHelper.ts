import { Area, EstadoFlujo, ESTADOS_FLUJO } from '@/types/flujo';

const ORDEN_AREAS: Area[] = [
  'ventas',
  'plan_produccion',
  'produccion',
  'calidad',
  'almacen',
  'logistica',
  'cliente',
];

export function getIndiceArea(area: Area): number {
  return ORDEN_AREAS.indexOf(area);
}

/**
 * Determina si un área puede VER la tarjeta.
 * Regla: Un área ve la tarjeta si es su área actual, o si la tarjeta ya pasó por su área, 
 * o si es la SIGUIENTE área inmediata y el estado previo ya fue de TÉRMINO.
 */
export function puedeVerTarjeta(areaUsuario: Area, estadoActual: EstadoFlujo): boolean {
  const idxUsuario = getIndiceArea(areaUsuario);
  const idxEstado = getIndiceArea(estadoActual.area);

  // Si la tarjeta está en un área previa a la del usuario
  if (idxUsuario > idxEstado) {
    // Solo puede verla si está en el área INMEDIATAMENTE anterior Y además el estado es de Término
    if (idxUsuario === idxEstado + 1 && estadoActual.esTermino) {
      return true;
    }
    return false;
  }

  // Si está en la misma área o en una posterior, sí la puede visualizar
  return true;
}

/**
 * Determina si el usuario puede EDITAR la tarjeta.
 * Regla:
 * 1. Debe tener rol 'editor'.
 * 2. Si el estado actual es de su misma área, puede editar mientras no sea término o para pasarlo a término.
 * 3. Si el estado actual es de término de la área INMEDIATAMENTE anterior, el área actual toma el control para iniciar su proceso.
 */
export function puedeEditarTarjeta(
  areaUsuario: Area,
  rolUsuario: string,
  estadoActual: EstadoFlujo
): boolean {
  if (rolUsuario !== 'editor') return false;

  const idxUsuario = getIndiceArea(areaUsuario);
  const idxEstado = getIndiceArea(estadoActual.area);

  // Misma área actual
  if (idxUsuario === idxEstado) return true;

  // Siguiente área inmediata habilitada porque la anterior terminó
  if (idxUsuario === idxEstado + 1 && estadoActual.esTermino) return true;

  return false;
}