import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { decimalCrm } from '../ventas/crm.workflow';

export type ConfiguracionOperativa = {
  campos?: {
    clave: string;
    etiqueta: string;
    opciones: string[];
    requerido?: boolean;
  }[];
  peso_min_kg?: number;
  peso_max_kg?: number;
};

/** JSON con contrato validado; nunca interpreta observaciones ni inventa pesos. */
export function especificacionesValidas(
  entrada: unknown,
  configuracion: Prisma.JsonValue | null,
  unidad: string,
  cantidad: Prisma.Decimal,
): Prisma.InputJsonObject | undefined {
  const config = (configuracion ?? {}) as ConfiguracionOperativa;
  if (entrada == null) {
    if (config.campos?.some((c) => c.requerido))
      throw new BadRequestException(
        'Captura las especificaciones del producto',
      );
    return undefined;
  }
  if (typeof entrada !== 'object' || Array.isArray(entrada))
    throw new BadRequestException('Especificaciones inválidas');
  const e = entrada as Record<string, any>;
  if (
    Object.keys(e).some(
      (k) => !['version', 'atributos', 'contenedores'].includes(k),
    ) ||
    e.version !== 1
  )
    throw new BadRequestException(
      'Versión o campos de especificaciones inválidos',
    );
  const atributos = e.atributos ?? {};
  if (!atributos || typeof atributos !== 'object' || Array.isArray(atributos))
    throw new BadRequestException('Atributos inválidos');
  const campos = config.campos ?? [];
  if (Object.keys(atributos).some((k) => !campos.some((c) => c.clave === k)))
    throw new BadRequestException('Atributo no configurado para este producto');
  for (const c of campos) {
    const valor = atributos[c.clave];
    if ((c.requerido && !valor) || (valor && !c.opciones.includes(valor)))
      throw new BadRequestException(`Valor inválido: ${c.etiqueta}`);
  }
  if (!Array.isArray(e.contenedores) || e.contenedores.length > 500)
    throw new BadRequestException('Captura hasta 500 contenedores');
  let total = new Prisma.Decimal(0);
  const codigos = new Set<string>();
  const contenedores = e.contenedores.map((c: any) => {
    if (
      !c ||
      typeof c.codigo !== 'string' ||
      !c.codigo.trim() ||
      c.codigo.trim().length > 100
    )
      throw new BadRequestException('Identifica cada contenedor');
    const codigo = c.codigo.trim();
    if (codigos.has(codigo.toUpperCase()))
      throw new BadRequestException('Contenedor duplicado');
    codigos.add(codigo.toUpperCase());
    const peso = decimalCrm(c.peso_kg, 4);
    if (unidad !== 'Kilogramos')
      throw new BadRequestException('Los pesos requieren un producto en Kg');
    if (
      (config.peso_min_kg != null && peso.lt(config.peso_min_kg)) ||
      (config.peso_max_kg != null && peso.gt(config.peso_max_kg))
    )
      throw new BadRequestException(
        'Peso fuera del intervalo configurado para el producto',
      );
    total = total.add(peso);
    return { codigo, peso_kg: peso.toString() };
  });
  if (contenedores.length && !total.eq(cantidad))
    throw new BadRequestException(
      'La suma de pesos debe coincidir con la cantidad total en kg',
    );
  return { version: 1, atributos, contenedores };
}

/** F.E. solo es insumo de reproceso, nunca existencia liberada para entregar. */
export function aptitudMaterial(l: {
  origen: string;
  condicion: string;
  fecha_caducidad: Date | null;
  estado_calidad_recepcion: string | null;
  lote_produccion?: { estado_Calida: string } | null;
}) {
  const calidad =
    l.origen === 'PRODUCCION'
      ? l.lote_produccion?.estado_Calida
      : l.estado_calidad_recepcion;
  const vigente = !l.fecha_caducidad || l.fecha_caducidad >= new Date();
  const liberado =
    calidad === 'LIBERADO' &&
    l.condicion !== 'FUERA_DE_ESPECIFICACION' &&
    l.condicion !== 'RESIDUO';
  const reprocesable =
    vigente &&
    (liberado ||
      (l.condicion === 'FUERA_DE_ESPECIFICACION' &&
        ['RECHAZADO', 'FUERA_DE_ESPECIFICACION'].includes(calidad ?? '')));
  return { liberado, venta: vigente && liberado, reprocesable };
}
