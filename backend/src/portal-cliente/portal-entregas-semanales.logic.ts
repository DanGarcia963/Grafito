import { identificarPrensa, type PrensaGrafito } from './portal-cliente-graficas.logic';

export const ZONA_SEMANAS = 'America/Mexico_City';
const DIA_MS = 86400000;
const SEMANA_MS = 7 * DIA_MS;
export type ResumenPrensas = Record<PrensaGrafito | 'sinIdentificar', number> & { total: number };
export type SemanaEntrega = ResumenPrensas & {
  semana: number; etiqueta: string; inicio: string; fin: string;
};
export type MovimientoEntrega = {
  id_Movi_Invent: number; fecha: Date | string;
  cantidad: unknown; especificaciones: unknown;
};
export type ResumenEntregasSemanales = {
  anio: number;
  anioActual: number;
  semanaActual: number;
  numeroSemanas: number;
  unidad: 'Kilogramos';
  zonaHoraria: string;
  semanas: SemanaEntrega[];
  anterior: SemanaEntrega & { anio: number };
  acumuladoAnual: ResumenPrensas;
  movimientosAnuales: number;
  fuente: 'SALIDA_ENTREGA';
  nota: string;
};

export function inicioAnioISO(anio: number): Date {
  const enero4 = new Date(Date.UTC(anio, 0, 4));
  const dia = (enero4.getUTCDay() + 6) % 7;
  return new Date(enero4.getTime() - dia * DIA_MS);
}
export function totalSemanasISO(anio: number): number {
  return Math.round((inicioAnioISO(anio + 1).getTime() - inicioAnioISO(anio).getTime()) / SEMANA_MS);
}
function fechaUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function semanaISODeFecha(fechaCalendario: string): { anio: number; semana: number } {
  const partes = fechaCalendario.split('-').map(Number);
  const anio = partes[0], mes = partes[1], dia = partes[2];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (!Number.isFinite(fecha.getTime()) || fechaUTC(fecha) !== fechaCalendario) {
    throw new Error('Fecha ISO inválida');
  }
  const lunes = new Date(fecha.getTime() - ((fecha.getUTCDay() + 6) % 7) * DIA_MS);
  const jueves = new Date(lunes.getTime() + 3 * DIA_MS);
  const anioISO = jueves.getUTCFullYear();
  return {
    anio: anioISO,
    semana: Math.round((lunes.getTime() - inicioAnioISO(anioISO).getTime()) / SEMANA_MS) + 1,
  };
}
export function fechaEnMexico(fecha: Date | string): string {
  const d = new Date(fecha);
  if (!Number.isFinite(d.getTime())) throw new Error('Fecha de movimiento inválida');
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_SEMANAS, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const p = (tipo: string) => partes.find(x => x.type === tipo)?.value || '';
  return p('year') + '-' + p('month') + '-' + p('day');
}
function enBlanco(): ResumenPrensas {
  return { Fagor: 0, Forgemaster: 0, Polymaster: 0, sinIdentificar: 0, total: 0 };
}
function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}
function consolidar(registro: ResumenPrensas): ResumenPrensas {
  return {
    Fagor: redondear(registro.Fagor),
    Forgemaster: redondear(registro.Forgemaster),
    Polymaster: redondear(registro.Polymaster),
    sinIdentificar: redondear(registro.sinIdentificar),
    total: redondear(registro.total),
  };
}
function sumar(registro: ResumenPrensas, prensa: PrensaGrafito | 'sinIdentificar', kg: number) {
  registro[prensa] += kg;
  registro.total += kg;
}
export function fechaInicioSemanaISO(anio: number, semana: number): Date {
  return new Date(inicioAnioISO(anio).getTime() + (semana - 1) * SEMANA_MS);
}
export function calcularEntregasSemanales(
  anio: number,
  movimientos: MovimientoEntrega[],
  idsRevertidos: ReadonlySet<number> = new Set<number>(),
  ahora = new Date(),
): ResumenEntregasSemanales {
  if (!Number.isSafeInteger(anio) || anio < 2000 || anio > 2100) throw new Error('Año inválido');
  const totalSemanas = totalSemanasISO(anio);
  const semanaActual = semanaISODeFecha(fechaEnMexico(ahora));
  const lunesHoy = fechaInicioSemanaISO(semanaActual.anio, semanaActual.semana);
  const anterior = semanaISODeFecha(fechaUTC(new Date(lunesHoy.getTime() - DIA_MS)));
  const anteriorLlave = anterior.anio + ':' + anterior.semana;
  const semanas: SemanaEntrega[] = Array.from({ length: totalSemanas }, (_, i) => {
    const lunes = fechaInicioSemanaISO(anio, i + 1);
    const domingo = new Date(lunes.getTime() + 6 * DIA_MS);
    return {
      semana: i + 1, etiqueta: (i + 1) + '/' + totalSemanas,
      inicio: fechaUTC(lunes), fin: fechaUTC(domingo), ...enBlanco(),
    };
  });
  const anteriorBase: SemanaEntrega & { anio: number } = {
    anio: anterior.anio, semana: anterior.semana,
    etiqueta: anterior.semana + '/' + totalSemanasISO(anterior.anio),
    inicio: fechaUTC(fechaInicioSemanaISO(anterior.anio, anterior.semana)),
    fin: fechaUTC(new Date(fechaInicioSemanaISO(anterior.anio, anterior.semana).getTime() + 6 * DIA_MS)),
    ...enBlanco(),
  };
  const acumuladoAnual = enBlanco();
  let movimientosAnuales = 0;
  const usados = new Set<number>();
  for (const m of movimientos) {
    if (idsRevertidos.has(m.id_Movi_Invent) || usados.has(m.id_Movi_Invent)) continue;
    usados.add(m.id_Movi_Invent);
    const cantidad = Number(m.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
    const semana = semanaISODeFecha(fechaEnMexico(m.fecha));
    const prensa = identificarPrensa(m.especificaciones) ?? 'sinIdentificar';
    if (semana.anio === anio && semana.semana >= 1 && semana.semana <= totalSemanas) {
      const r = semanas[semana.semana - 1];
      sumar(r, prensa, cantidad);
      sumar(acumuladoAnual, prensa, cantidad);
      movimientosAnuales++;
    }
    if (semana.anio + ':' + semana.semana === anteriorLlave) {
      sumar(anteriorBase, prensa, cantidad);
    }
  }
  return {
    anio, anioActual: semanaActual.anio, semanaActual: semanaActual.semana,
    numeroSemanas: totalSemanas,
    unidad: 'Kilogramos', zonaHoraria: ZONA_SEMANAS,
    semanas: semanas.map(s => ({ ...s, ...consolidar(s) })),
    anterior: { ...anteriorBase, ...consolidar(anteriorBase) },
    acumuladoAnual: consolidar(acumuladoAnual),
    movimientosAnuales, fuente: 'SALIDA_ENTREGA',
    nota: 'Solo salidas de entrega físicas registradas, no revertidas, de grafito regenerado de este cliente. La semana ISO inicia el lunes y termina el domingo en horario de Ciudad de México. Liberación de calidad, ajustes de salida y planeaciones de camiones no cuentan como entregas. Los años ISO pueden tener 52 o 53 semanas.',
  };
}
