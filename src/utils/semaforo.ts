type SemaforoTramite = 'rojo' | 'naranja' | 'amarillo' | 'verde';

export function calcularSemaforo(fechaVencimientoStr: string): SemaforoTramite {
  const hoy = new Date();
  const vencimiento = new Date(fechaVencimientoStr);
  const diferenciaDias = Math.ceil(
    (vencimiento.getTime() - hoy.getTime()) / (1000 * 3600 * 24)
  );

  if (diferenciaDias <= 15) return 'rojo';
  if (diferenciaDias <= 30) return 'naranja';
  if (diferenciaDias <= 60) return 'amarillo';
  return 'verde';
}