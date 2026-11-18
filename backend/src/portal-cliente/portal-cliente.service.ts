import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Usuario } from '../auth/auth.service';
import { PrismaService } from '../prisma.service';

type Movimiento = {
  id_Movi_Invent: number;
  lote_inventario_id: number;
  lote_produccion_id: number | null;
  tipo: string;
  cantidad: unknown;
  ubicacion_origen_id: number | null;
  ubicacion_destino_id: number | null;
  reversa_de_id: number | null;
};
type Prensa = 'Forgemaster' | 'Polymaster' | 'Fagor' | 'Sin identificar';
const CONDICIONES_LIBERADAS = ['REGENERADO', 'TERMINADO'];

function numero(valor: unknown): number {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function redondear(n: number) {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}
function prensaDe(especificaciones: unknown): Prensa {
  const valor = (especificaciones as { atributos?: { tipo_prensa?: unknown } } | null)?.atributos?.tipo_prensa;
  const p = String(valor ?? '').toLowerCase().trim();
  if (p.includes('forge')) return 'Forgemaster';
  if (p.includes('poly')) return 'Polymaster';
  if (p.includes('fagor')) return 'Fagor';
  return 'Sin identificar';
}
function fechaLocalISO(valor: unknown, campo: string): Date | null {
  if (valor == null || valor === '') return null;
  const texto = String(valor);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw new BadRequestException(campo + ' debe tener formato AAAA-MM-DD.');
  const d = new Date(texto + 'T00:00:00-06:00');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== texto) {
    throw new BadRequestException(campo + ' no es una fecha válida.');
  }
  return d;
}
function reversiones(movimientos: Movimiento[]): Set<number> {
  return new Set(movimientos.filter(m => m.tipo === 'REVERSION' && m.reversa_de_id != null)
    .map(m => Number(m.reversa_de_id)));
}
function agruparCantidad(movs: Movimiento[], tipo: string, revertidos: Set<number>): number {
  return movs.reduce((total, m) => total + (m.tipo === tipo && !revertidos.has(m.id_Movi_Invent) ? numero(m.cantidad) : 0), 0);
}
function saldoActual(movs: Movimiento[]) {
  return movs.reduce((total, m) => {
    const c = numero(m.cantidad);
    if (m.ubicacion_origen_id == null && m.ubicacion_destino_id != null) return total + c;
    if (m.ubicacion_origen_id != null && m.ubicacion_destino_id == null) return total - c;
    return total;
  }, 0);
}
const sinDatos = (unidad: string) => ({
  unidad, recibido: 0, procesado: 0, liberado: 0, liberadoSinVinculo: 0,
  entregado: 0, saldoRecepciones: 0, humedadPonderada: null as number | null,
  aguaEstimadaKg: null as number | null, lotesMuestreados: 0, lotesRecibidos: 0,
  rendimiento: null as number | null,
  prensas: [] as Array<{ prensa: Prensa; recibido: number; procesado: number; saldo: number; liberado: number }>,
  lotes: [] as Array<{
    recepcion: string; lote: string; fecha: string; prensa: Prensa;
    recibido: number; procesado: number; saldo: number; humedad: number | null;
    muestra: string | null; origenHumedad: string | null;
    masaConHumedad: number | null; lotesProduccion: number[]; unidad: string;
  }>,
});

@Injectable()
export class PortalClienteService {
  constructor(private readonly prisma: PrismaService) {}

  async clientes() {
    const data = await this.prisma.personas.findMany({
      where: { tipo_persona: 'CLIENTE' },
      select: { id_Persona: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
    return { success: true, data };
  }

  private async clientePermitido(usuario: Usuario, clienteId?: string) {
    let id: number;
    if (usuario.area === 'cliente') {
      id = usuario.personaId;
      if (clienteId && Number(clienteId) !== id) {
        throw new ForbiddenException('No puedes consultar información de otro cliente.');
      }
    } else if (usuario.area === 'produccion') {
      id = Number(clienteId);
      if (!Number.isSafeInteger(id) || id <= 0) {
        throw new BadRequestException('Selecciona el cliente del reporte.');
      }
    } else {
      throw new ForbiddenException('No tienes acceso al portal de clientes.');
    }
    const persona = await this.prisma.personas.findUnique({
      where: { id_Persona: id },
      select: { id_Persona: true, nombre: true, tipo_persona: true },
    });
    if (!persona || persona.tipo_persona !== 'CLIENTE') {
      throw new NotFoundException('No existe el cliente configurado.');
    }
    return { id: persona.id_Persona, nombre: persona.nombre };
  }

  async resumen(usuario: Usuario, params: { clienteId?: string; desde?: string; hasta?: string }) {
    const cliente = await this.clientePermitido(usuario, params.clienteId);
    const desde = fechaLocalISO(params.desde, 'desde');
    const hasta = fechaLocalISO(params.hasta, 'hasta');
    if (desde && hasta && desde > hasta) throw new BadRequestException('El inicio no puede ser posterior al fin.');
    const hastaExclusivo = hasta ? new Date(hasta.getTime() + 86400000) : null;
    // Cohorte: seleccionar recepciones reales del cliente. Los movimientos posteriores
    // se siguen incluyendo para medir qué ocurrió finalmente con esa misma materia prima.
    const recepciones = await this.prisma.lotes_llegada.findMany({
      where: {
        remitente_id: cliente.id,
        estado_recepcion: 'CONFIRMADA',
        estado_checklist: 'COMPLETADO',
        ...(desde || hastaExclusivo ? {
          fecha_llegada: {
            ...(desde ? { gte: desde } : {}),
            ...(hastaExclusivo ? { lt: hastaExclusivo } : {}),
          },
        } : {}),
      },
      select: { id: true, no_lote: true, fecha_llegada: true },
      orderBy: { fecha_llegada: 'desc' },
    });
    const recepcionPorId = new Map(recepciones.map(r => [r.id, r]));
    const recepcionIds = recepciones.map(r => r.id);
    const lotes = recepcionIds.length ? await this.prisma.lotes_inventario.findMany({
      where: { recepcion_id: { in: recepcionIds }, origen: 'RECEPCION', propiedad: 'DE_CLIENTE', propietario_id: cliente.id },
      select: { id: true, folio: true, unidad: true, especificaciones: true, recepcion_id: true },
    }) : [];
    const ids = lotes.map(l => l.id);
    const movimientos = ids.length ? await this.prisma.movimientos_inventario.findMany({
      where: { lote_inventario_id: { in: ids } },
      select: {
        id_Movi_Invent: true, lote_inventario_id: true, lote_produccion_id: true,
        tipo: true, cantidad: true, ubicacion_origen_id: true,
        ubicacion_destino_id: true, reversa_de_id: true,
      },
    }) as Movimiento[] : [];
    const movsPorLote = new Map<number, Movimiento[]>();
    for (const m of movimientos) {
      const arr = movsPorLote.get(m.lote_inventario_id) ?? [];
      arr.push(m);
      movsPorLote.set(m.lote_inventario_id, arr);
    }
    // Dos tipos de humedad: directa del lote de inventario, o muestra inicial
    // tomada en un LP que consumió material del lote. Nunca asumir que una
    // muestra de mezcla representa la humedad original de cada entrada.
    const consumosCohorte = movimientos.filter(m => m.tipo === 'SALIDA_CONSUMO' && m.lote_produccion_id != null);
    const produccionIds = [...new Set(consumosCohorte.map(m => m.lote_produccion_id!))];
    const [todosLosConsumos, reversasDeConsumo] = await Promise.all([
      produccionIds.length ? this.prisma.movimientos_inventario.findMany({
        where: { lote_produccion_id: { in: produccionIds }, tipo: 'SALIDA_CONSUMO' },
        select: {
          id_Movi_Invent: true, lote_inventario_id: true, lote_produccion_id: true,
          tipo: true, cantidad: true, ubicacion_origen_id: true,
          ubicacion_destino_id: true, reversa_de_id: true,
        },
      }) as Promise<Movimiento[]> : Promise.resolve([]),
      produccionIds.length ? this.prisma.movimientos_inventario.findMany({
        where: { reversa_de_id: { in: consumosCohorte.map(m => m.id_Movi_Invent) } },
        select: { reversa_de_id: true },
      }) : Promise.resolve([]),
    ]);
    const reversasOtros = todosLosConsumos.length
      ? await this.prisma.movimientos_inventario.findMany({
          where: { reversa_de_id: { in: todosLosConsumos.map(m => m.id_Movi_Invent) } },
          select: { reversa_de_id: true },
        })
      : [];
    const revertidosConsumo = new Set(
      [...reversasDeConsumo, ...reversasOtros].map(r => r.reversa_de_id).filter((id): id is number => id != null),
    );
    const fuentesPorProduccion = new Map<number, Movimiento[]>();
    for (const m of todosLosConsumos) {
      if (m.lote_produccion_id == null || revertidosConsumo.has(m.id_Movi_Invent)) continue;
      const lista = fuentesPorProduccion.get(m.lote_produccion_id) ?? [];
      lista.push(m);
      fuentesPorProduccion.set(m.lote_produccion_id, lista);
    }
    const muestras = ids.length ? await this.prisma.muestras.findMany({
      where: {
        categoria_Muestra: 'MUESTRA_INICIAL',
        area_Muestra: 'CALIDAD',
        estado_Muestra: 'APROBADO',
        OR: [
          { lote_inventario_id: { in: ids } },
          ...(produccionIds.length ? [{ lote_id: { in: produccionIds } }] : []),
        ],
      },
      select: { id_Muestra: true, no_Muestra: true, lote_inventario_id: true, lote_id: true, cliente_id: true },
      orderBy: { id_Muestra: 'desc' },
    }) : [];
    const resultados = muestras.length ? await this.prisma.resultado_analisis.findMany({
      where: { muestra_id: { in: muestras.map(m => m.id_Muestra) }, parametro_id: 4 },
      select: {
        muestra_id: true, valor_Obtenido_Num: true, fecha_Resultado: true,
        id_Resultado_Analisis: true,
      },
      orderBy: [{ fecha_Resultado: 'desc' }, { id_Resultado_Analisis: 'desc' }],
    }) : [];
    const resultadosPorMuestra = new Map<number, number>();
    for (const r of resultados) {
      const valor = Number(r.valor_Obtenido_Num);
      if (!resultadosPorMuestra.has(r.muestra_id) && r.valor_Obtenido_Num != null &&
          Number.isFinite(valor) && valor >= 0 && valor <= 100) {
        resultadosPorMuestra.set(r.muestra_id, valor);
      }
    }
    const humedadPorLote = new Map<number, {
      humedad: number; muestra: string; origen: 'DIRECTA_RECEPCION' | 'INFERIDA_PRODUCCION';
      masaMedida: number; lotesProduccion: number[];
    }>();
    // Si existe resultado directo, es el dato representativo de recepción.
    for (const m of muestras) {
      const valor = resultadosPorMuestra.get(m.id_Muestra);
      if (m.lote_inventario_id != null && ids.includes(m.lote_inventario_id) &&
          (m.cliente_id == null || m.cliente_id === cliente.id) &&
          valor != null && !humedadPorLote.has(m.lote_inventario_id)) {
        const movs = movsPorLote.get(m.lote_inventario_id) ?? [];
        const recibido = agruparCantidad(movs, 'ENTRADA_RECEPCION', reversiones(movs));
        humedadPorLote.set(m.lote_inventario_id, {
          humedad: valor, muestra: m.no_Muestra ?? String(m.id_Muestra),
          origen: 'DIRECTA_RECEPCION', masaMedida: recibido, lotesProduccion: [],
        });
      }
    }
    // Consolidar muestras de producción únicamente si un LP consumió
    // exclusivamente UN lote origen, sin mezclas ni consumos de otro cliente.
    // La misma recepción puede alimentar varios LP, cada cual con su medida.
    const medidasLP = new Map<number, { valor: number; muestra: string }>();
    for (const m of muestras) {
      const valor = resultadosPorMuestra.get(m.id_Muestra);
      if (m.lote_id == null || valor == null || medidasLP.has(m.lote_id) ||
          (m.cliente_id != null && m.cliente_id !== cliente.id)) continue;
      medidasLP.set(m.lote_id, { valor, muestra: m.no_Muestra ?? String(m.id_Muestra) });
    }
    const medicionesInferidas = new Map<number, {
      total: number; ponderado: number; muestras: string[]; produccionIds: number[];
    }>();
    for (const [lpId, medida] of medidasLP) {
      const fuentes = fuentesPorProduccion.get(lpId) ?? [];
      const origenIds = [...new Set(fuentes.map(f => f.lote_inventario_id))];
      if (origenIds.length !== 1 || !ids.includes(origenIds[0])) continue;
      const loteId = origenIds[0];
      if (humedadPorLote.get(loteId)?.origen === 'DIRECTA_RECEPCION') continue;
      const cantidad = fuentes.reduce((sum, f) => sum + numero(f.cantidad), 0);
      if (cantidad <= 0) continue;
      const acumulado = medicionesInferidas.get(loteId) ?? {
        total: 0, ponderado: 0, muestras: [], produccionIds: [],
      };
      acumulado.total += cantidad;
      acumulado.ponderado += medida.valor * cantidad;
      acumulado.muestras.push(medida.muestra);
      acumulado.produccionIds.push(lpId);
      medicionesInferidas.set(loteId, acumulado);
    }
    for (const [loteId, m] of medicionesInferidas) {
      if (m.total > 0) {
        humedadPorLote.set(loteId, {
          humedad: redondear(m.ponderado / m.total), muestra: m.muestras.join(', '),
          origen: 'INFERIDA_PRODUCCION', masaMedida: m.total, lotesProduccion: m.produccionIds,
        });
      }
    }
    const unidades = new Map<string, ReturnType<typeof sinDatos>>();
    const matriz = new Map<string, Map<Prensa, { prensa: Prensa; recibido: number; procesado: number; saldo: number; liberado: number }>>();
    const pesoHumedad = new Map<string, { peso: number; suma: number; agua: number }>();
    const obtener = (unidad: string) => {
      if (!unidades.has(unidad)) unidades.set(unidad, sinDatos(unidad));
      if (!matriz.has(unidad)) matriz.set(unidad, new Map());
      return unidades.get(unidad)!;
    };
    const grupo = (unidad: string, prensa: Prensa) => {
      const m = matriz.get(unidad)!;
      if (!m.has(prensa)) m.set(prensa, { prensa, recibido: 0, procesado: 0, saldo: 0, liberado: 0 });
      return m.get(prensa)!;
    };
    const recepcionesAcreditadas = new Set<number>();
    for (const lote of lotes) {
      const m = movsPorLote.get(lote.id) ?? [];
      const rev = reversiones(m);
      const recibido = agruparCantidad(m, 'ENTRADA_RECEPCION', rev);
      const procesado = agruparCantidad(m, 'SALIDA_CONSUMO', rev);
      const saldo = saldoActual(m);
      if (recibido > 0) recepcionesAcreditadas.add(lote.id);
      const unidad = String(lote.unidad);
      const p = prensaDe(lote.especificaciones);
      const registro = obtener(unidad);
      registro.recibido += recibido;
      registro.procesado += procesado;
      registro.saldoRecepciones += saldo;
      registro.lotesRecibidos += recibido > 0 ? 1 : 0;
      const g = grupo(unidad, p);
      g.recibido += recibido; g.procesado += procesado; g.saldo += saldo;
      const h = humedadPorLote.get(lote.id);
      if (h && recibido > 0) {
        registro.lotesMuestreados++;
        const ponderacion = pesoHumedad.get(unidad) ?? { peso: 0, suma: 0, agua: 0 };
        const masaPonderada = h.origen === 'DIRECTA_RECEPCION' ? recibido : Math.min(recibido, h.masaMedida);
        ponderacion.peso += masaPonderada; ponderacion.suma += masaPonderada * h.humedad;
        if (unidad === 'Kilogramos') ponderacion.agua += masaPonderada * h.humedad / 100;
        registro.masaConHumedad += masaPonderada;
        pesoHumedad.set(unidad, ponderacion);
      }
      const llegada = recepcionPorId.get(lote.recepcion_id!);
      registro.lotes.push({
        recepcion: llegada?.no_lote ?? 'Sin referencia',
        lote: lote.folio,
        fecha: llegada?.fecha_llegada.toISOString().slice(0, 10) ?? '',
        prensa: p, recibido: redondear(recibido), procesado: redondear(procesado),
        saldo: redondear(saldo), humedad: h?.humedad ?? null,
        muestra: h?.muestra ?? null, origenHumedad: h?.origen ?? null,
        masaConHumedad: h?.masaMedida ?? null, lotesProduccion: h?.lotesProduccion ?? [], unidad,
      });
    }
    // Producto liberado solo se atribuye a la cohorte cuando TODOS los consumos
    // comprobados de su LP proceden de los lotes recibidos seleccionados.
    const salidas = await this.prisma.lotes_inventario.findMany({
      where: { propiedad: 'DE_CLIENTE', propietario_id: cliente.id, origen: 'PRODUCCION',
        condicion: { in: CONDICIONES_LIBERADAS as any } },
      select: { id: true, folio: true, unidad: true, especificaciones: true, lote_produccion_id: true },
    });
    const lpIds = [...new Set(salidas.map(s => s.lote_produccion_id).filter((x): x is number => x != null))];
    const [produccion, entradasProduccion, consumosOrigen] = await Promise.all([
      lpIds.length ? this.prisma.lotes_produccion.findMany({
        where: { id_Lote_Produccion: { in: lpIds } },
        select: { id_Lote_Produccion: true, estado: true, estado_Calida: true },
      }) : Promise.resolve([]),
      salidas.length ? this.prisma.movimientos_inventario.findMany({
        where: { lote_inventario_id: { in: salidas.map(s => s.id) } },
        select: {
          id_Movi_Invent: true, lote_inventario_id: true, lote_produccion_id: true,
          tipo: true, cantidad: true, ubicacion_origen_id: true,
          ubicacion_destino_id: true, reversa_de_id: true,
        },
      }) as Promise<Movimiento[]> : Promise.resolve([]),
      lpIds.length ? this.prisma.movimientos_inventario.findMany({
        where: { lote_produccion_id: { in: lpIds }, tipo: 'SALIDA_CONSUMO' },
        select: {
          id_Movi_Invent: true, lote_inventario_id: true, lote_produccion_id: true,
          tipo: true, cantidad: true, ubicacion_origen_id: true,
          ubicacion_destino_id: true, reversa_de_id: true,
        },
      }) as Promise<Movimiento[]> : Promise.resolve([]),
    ]);
    const origenesRevertidos = consumosOrigen.length ? await this.prisma.movimientos_inventario.findMany({
      where: { reversa_de_id: { in: consumosOrigen.map(m => m.id_Movi_Invent) } },
      select: { reversa_de_id: true },
    }) : [];
    const fuenteRevertida = new Set(origenesRevertidos.map(x => x.reversa_de_id));
    const fuentePorLP = new Map<number, Movimiento[]>();
    for (const m of consumosOrigen) {
      if (m.lote_produccion_id == null || fuenteRevertida.has(m.id_Movi_Invent)) continue;
      const lista = fuentePorLP.get(m.lote_produccion_id) ?? [];
      lista.push(m); fuentePorLP.set(m.lote_produccion_id, lista);
    }
    const calidadPorLP = new Map(produccion.map(p => [p.id_Lote_Produccion, p]));
    const movimientosSalida = new Map<number, Movimiento[]>();
    for (const m of entradasProduccion) {
      const lista = movimientosSalida.get(m.lote_inventario_id) ?? [];
      lista.push(m); movimientosSalida.set(m.lote_inventario_id, lista);
    }
    for (const salida of salidas) {
      const lp = salida.lote_produccion_id;
      const calidad = lp == null ? null : calidadPorLP.get(lp);
      if (!calidad || calidad.estado !== 'FINALIZADO' || calidad.estado_Calida !== 'LIBERADO') continue;
      const movs = movimientosSalida.get(salida.id) ?? [];
      const rev = reversiones(movs);
      const liberado = agruparCantidad(movs, 'ENTRADA_PRODUCCION', rev);
      const entregado = agruparCantidad(movs, 'SALIDA_ENTREGA', rev);
      if (liberado <= 0) continue;
      const unidad = String(salida.unidad);
      const registro = obtener(unidad);
      const fuentes = fuentePorLP.get(lp!) ?? [];
      const vinculado = fuentes.length > 0 && fuentes.every(f =>
        recepcionesAcreditadas.has(f.lote_inventario_id) &&
        lotes.some(l => l.id === f.lote_inventario_id && String(l.unidad) === unidad));
      if (vinculado) {
        registro.liberado += liberado;
        registro.entregado += entregado;
        grupo(unidad, prensaDe(salida.especificaciones)).liberado += liberado;
      } else {
        registro.liberadoSinVinculo += liberado;
      }
    }
    for (const [unidad, registro] of unidades) {
      const hum = pesoHumedad.get(unidad);
      registro.humedadPonderada = hum && hum.peso > 0 ? redondear(hum.suma / hum.peso) : null;
      registro.aguaEstimadaKg = unidad === 'Kilogramos' && hum && hum.peso > 0 ? redondear(hum.agua) : null;
      registro.rendimiento = registro.procesado > 0 ? redondear(registro.liberado / registro.procesado * 100) : null;
      registro.recibido = redondear(registro.recibido);
      registro.procesado = redondear(registro.procesado);
      registro.liberado = redondear(registro.liberado);
      registro.liberadoSinVinculo = redondear(registro.liberadoSinVinculo);
      registro.entregado = redondear(registro.entregado);
      registro.saldoRecepciones = redondear(registro.saldoRecepciones);
      registro.masaConHumedad = redondear(registro.masaConHumedad);
      registro.prensas = [...matriz.get(unidad)!.values()].map(p => ({
        ...p, recibido: redondear(p.recibido), procesado: redondear(p.procesado),
        saldo: redondear(p.saldo), liberado: redondear(p.liberado),
      })).sort((a, b) => a.prensa.localeCompare(b.prensa));
    }
    // Fotografía del inventario actual del cliente, sin mezclarla con la cohorte de recepciones.
    // Las aperturas históricas sí cuentan en la fotografía física; no se consideran entradas nuevas.
    const existenciasCliente = await this.prisma.lotes_inventario.findMany({
      where: {
        propiedad: 'DE_CLIENTE',
        propietario_id: cliente.id,
        producto: { nombre_Producto: { contains: 'ORSA VFG', mode: 'insensitive' } },
      },
      select: { id: true, folio: true, unidad: true, condicion: true, especificaciones: true },
    });
    const movimientosExistencias = existenciasCliente.length
      ? await this.prisma.movimientos_inventario.findMany({
          where: { lote_inventario_id: { in: existenciasCliente.map(l => l.id) } },
          select: {
            id_Movi_Invent: true, lote_inventario_id: true, lote_produccion_id: true,
            tipo: true, cantidad: true, ubicacion_origen_id: true,
            ubicacion_destino_id: true, reversa_de_id: true,
          },
        }) as Movimiento[]
      : [];
    const detallePorLote = new Map<number, Movimiento[]>();
    for (const m of movimientosExistencias) {
      const actual = detallePorLote.get(m.lote_inventario_id) ?? [];
      actual.push(m);
      detallePorLote.set(m.lote_inventario_id, actual);
    }
    const gruposActuales = new Map<string, {
      condicion: string; prensa: Prensa; unidad: string; saldo: number; lotes: number;
    }>();
    for (const l of existenciasCliente) {
      const saldo = saldoActual(detallePorLote.get(l.id) ?? []);
      if (saldo <= 0) continue;
      const prensa = prensaDe(l.especificaciones);
      const clave = [l.unidad, l.condicion, prensa].join('|');
      const actual = gruposActuales.get(clave) ?? {
        unidad: String(l.unidad), condicion: String(l.condicion),
        prensa, saldo: 0, lotes: 0,
      };
      actual.saldo += saldo;
      actual.lotes++;
      gruposActuales.set(clave, actual);
    }
    const inventarioActual = [...gruposActuales.values()].map(x => ({
      ...x, saldo: redondear(x.saldo),
    })).sort((a, b) => a.condicion.localeCompare(b.condicion) || a.prensa.localeCompare(b.prensa));
    const [manifiestos, resguardados] = await Promise.all([
      this.prisma.manifiestos.count({ where: { cliente_id: cliente.id } }),
      this.prisma.manifiestos.count({ where: { cliente_id: cliente.id, resguardado_en: { not: null } } }),
    ]);
    return {
      success: true, cliente, periodo: { desde: params.desde || null, hasta: params.hasta || null,
        descripcion: 'Cohorte de recepciones confirmadas con checklist completo. Procesamiento acumulado de esos mismos lotes.' },
      unidades: [...unidades.values()],
      inventarioActual,
      documentos: { manifiestos, resguardados },
      trazabilidad: {
        recepcionesConfirmadas: recepciones.length,
        lotesSinEntrada: lotes.filter(l => !(movsPorLote.get(l.id) ?? []).some(m => m.tipo === 'ENTRADA_RECEPCION')).length,
        nota: 'Las aperturas históricas sin recepción, mezclas de lotes y salidas sin enlace de producción NO se atribuyen a esta cohorte.',
      },
    };
  }
}
