import { Prisma } from '@prisma/client';

export const ETAPAS_MANIFIESTO = [
  'PEDIDO',
  'RECOLECCION',
  'PESAJE',
  'VERIFICAR_DATOS',
  'CORRECCION_DATOS',
  'CONTADURIA',
  'RESGUARDO',
] as const;

export type EtapaManifiesto = (typeof ETAPAS_MANIFIESTO)[number];

export const ROLES_ETAPA: Record<EtapaManifiesto, string> = {
  PEDIDO: 'logistica',
  RECOLECCION: 'almacen',
  PESAJE: 'almacen',
  VERIFICAR_DATOS: 'seguridad',
  CORRECCION_DATOS: 'logistica',
  CONTADURIA: 'contaduria',
  RESGUARDO: 'seguridad',
};

export const ETIQUETAS_CHECKLIST = {
  razonSocial: 'Razón social de la empresa generadora',
  nombreResiduo: 'Nombre del residuo',
  gknVerificado: 'Confirmar si el manifiesto corresponde a GKN',
  transportistaAutorizacion: 'Autorización SEMARNAT del transportista',
  transportistaPlacas: 'Placas del transporte',
  transportistaRegistroSct: 'Número de registro SCT',
  destinoAutorizacion: 'Autorización SEMARNAT del destino final',
  destinoRazonSocial: 'Razón social del destino final',
  pesoDentroRango: 'Peso del pedido dentro de ±500 kg del peso de llegada',
  lineaProduccion: 'Línea de producción identificada',
  certificadoTrazable: 'Certificado trazable con el inventario de la OV',
  numeroCompra: 'Número de compra de la venta',
  registroBitacora: 'Registro en bitácora de residuos',
} as const;

export type ChecklistManifiesto = Partial<Record<keyof typeof ETIQUETAS_CHECKLIST, boolean>>;

/** La tolerancia es inclusiva: el peso puede diferir hasta 500 kg en cualquiera de los dos sentidos. */
export function pesoEnRango(
  pedido: Prisma.Decimal | number | string | null | undefined,
  llegada: Prisma.Decimal | number | string,
  tolerancia: Prisma.Decimal | number | string = 500,
): boolean {
  if (pedido == null) return true;
  const esperado = new Prisma.Decimal(pedido);
  const recibido = new Prisma.Decimal(llegada);
  const margen = new Prisma.Decimal(tolerancia);
  return recibido.gte(esperado.sub(margen)) && recibido.lte(esperado.add(margen));
}

export function pesoEsperado(
  override: Prisma.Decimal | number | string | null | undefined,
  orden: { cantidad: Prisma.Decimal | number | string; unidad: string } | null | undefined,
) {
  if (override != null) return new Prisma.Decimal(override);
  if (orden?.unidad === 'Kilogramos') return new Prisma.Decimal(orden.cantidad);
  return null;
}

export function checklistPendiente(
  checklist: ChecklistManifiesto,
  options: {
    esGkn: boolean;
    tieneOrdenVenta: boolean;
    tienePesoEsperado: boolean;
  },
): string[] {
  const keys: (keyof typeof ETIQUETAS_CHECKLIST)[] = [
    'razonSocial',
    'nombreResiduo',
    'gknVerificado',
    'destinoAutorizacion',
    'destinoRazonSocial',
    'lineaProduccion',
    'registroBitacora',
  ];
  if (!options.esGkn)
    keys.push('transportistaAutorizacion', 'transportistaPlacas', 'transportistaRegistroSct');
  if (options.tieneOrdenVenta) keys.push('certificadoTrazable', 'numeroCompra');
  if (options.tienePesoEsperado) keys.push('pesoDentroRango');
  return keys.filter((key) => checklist[key] !== true).map((key) => ETIQUETAS_CHECKLIST[key]);
}

export function textoManifiesto(value: unknown, max: number): string | null {
  if (value == null || String(value).trim() === '') return null;
  const valueText = String(value).trim();
  if (valueText.length > max) throw new Error(`El texto excede ${max} caracteres.`);
  return valueText;
}
