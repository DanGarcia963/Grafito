import { TrazabilidadService } from '../trazabilidad/trazabilidad.service';
import { EventsGateway } from '../events.gateway';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'; 
import { PrismaService } from '../prisma.service'; 
import { equipos_tanques_estatus_proceso, lotes_produccion_estado_Calida, muestras_estado_Muestra, muestras_etapa_Muestra, ordenes_produccion_estatus_flujo } from '@prisma/client'; // <-- 1. Importar el Enum de Prisma

@Injectable() 
export class ProductionService { 
  constructor(private readonly prisma: PrismaService, private readonly tiempos: TrazabilidadService, private readonly eventos: EventsGateway) {} 

  async obtenerTodasLasOrdenesGrafito() { 
    try { 
      const grafitos = await this.prisma.ordenes_produccion.findMany({ 
        include: { 
          personas_ordenes_produccion_vendedor_idTopersonas: { 
            select: { 
              id_Persona: true, 
              nombre: true, 
              tipo_persona: true, 
            }, 
          }, 
   
          lotes_produccion: { 
            select: { 
              id_Lote_Produccion: true, 
              no_Lote: true, 
              cantidad_Total_Producida: true, 
              tanque_id: true,
              bitacora: true, 
            }, 
          }, 
   
          personas_ordenes_produccion_cliente_idTopersonas: { 
            select: { 
              id_Persona: true, 
              nombre: true, 
              tipo_persona: true, 
            }, 
          }, 
          productos_materiales: { 
            select: { 
              id_Produc_Mater: true, 
              nombre_Producto: true, 
              UM: true, 
              presentacion: true, 
            }, 
          }, 
        },
        where: { 
          linea_Produccion: 'GRAFITO',
          lotes_produccion:{
            some: {},
          }
         },
        orderBy: { fecha_Confirmacion: 'desc' } 
      }); 
      return { success: true, result: grafitos, bitacora: grafitos.flatMap(o => o.lotes_produccion.flatMap(l => {
        try { const lista = l.bitacora ? JSON.parse(l.bitacora) : []; return Array.isArray(lista) ? lista : []; } catch { return []; }
      })) }; 
    } catch (error: any) { 
      return { success: false, error: error.message }; 
    } 
  } 
 
async tanquesAreaProduccion(tipo: string) { 
  try { 
    // Usamos queryRaw o ignoramos la validación estricta del Enum mapeando la respuesta
    const tanques = await this.prisma.$queryRaw`
      SELECT 
        id_Equipos_Tanques, 
        codigo_Equipo, 
        nombre_Equipo, 
        status, 
        estatus_proceso 
      FROM equipos_tanques 
      WHERE tipo = ${tipo}
    `;

    return { success: true, result: tanques }; 
  } catch (error: any) { 
    return { success: false, error: error.message }; 
  }  
}

  async actualizarTanque({ idLoteProduccion, tanqueId }: { idLoteProduccion: number; tanqueId: number | null }) {
    const id = this.tiempos.id(idLoteProduccion);
    const destino = tanqueId == null ? null : this.tiempos.id(tanqueId);
    await this.prisma.$transaction(async tx => {
      // Orden de bloqueo consistente con las transiciones de tanque.
      await tx.$queryRaw`SELECT id_Equipos_Tanques FROM equipos_tanques ORDER BY id_Equipos_Tanques FOR UPDATE`;
      const lote = await tx.lotes_produccion.findUnique({ where: { id_Lote_Produccion: id } });
      if (!lote) throw new NotFoundException('Lote no encontrado');
      if (lote.tanque_id === destino) return;
      if (destino) {
        const tanque = await tx.equipos_tanques.findUnique({ where: { id_Equipos_Tanques: destino } });
        if (!tanque || tanque.status !== 'OPERATIVO') throw new BadRequestException('Tanque no disponible');
        if (await tx.lotes_produccion.findFirst({ where: { tanque_id: destino, id_Lote_Produccion: { not: id } } })) throw new BadRequestException('El tanque ya tiene otro lote');
      }
      if (lote.tanque_id) {
        await this.tiempos.transicion(tx, { entidad: 'TANQUE', entidad_id: lote.tanque_id, lote_id: id, tanque_id: lote.tanque_id }, null);
        await tx.equipos_tanques.update({ where: { id_Equipos_Tanques: lote.tanque_id }, data: { estatus_proceso: 'VACIO' } });
      }
      await tx.lotes_produccion.update({ where: { id_Lote_Produccion: id }, data: { tanque_id: destino } });
      if (destino) {
        await tx.equipos_tanques.update({ where: { id_Equipos_Tanques: destino }, data: { estatus_proceso: 'CARGANDO_TANQUE' } });
        await this.tiempos.transicion(tx, { entidad: 'TANQUE', entidad_id: destino, lote_id: id, tanque_id: destino }, 'CARGANDO_TANQUE', true);
      }
      const ctx = { entidad: 'TANQUE' as const, entidad_id: destino ?? lote.tanque_id!, lote_id: id, tanque_id: destino ?? lote.tanque_id };
      const ultimo = await this.tiempos.ultimo(tx, ctx);
      await this.tiempos.evento(tx, ctx, ultimo?.ciclo ?? 1, 'ASIGNACION_LOTE', { origen: lote.tanque_id, destino });
    });
    this.eventos.notificar('TANQUE_ACTUALIZADO', { idLoteProduccion: id });
    return { idLoteProduccion: id, tanqueId: destino };
  }

  async actualizarEstatusCalidad({ idLoteProduccion }: { idLoteProduccion: number; estadoCalidad: 'LIBERADO' }) {
    const id = this.tiempos.id(idLoteProduccion);
    const result = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id_Lote_Produccion FROM lotes_produccion WHERE id_Lote_Produccion = ${id} FOR UPDATE`;
      const lote = await tx.lotes_produccion.findUnique({ where: { id_Lote_Produccion: id } });
      if (!lote) throw new NotFoundException('Lote no encontrado');
      if (lote.estado_Calida !== 'LIBERADO' && lote.tanque_id) {
        const ctx = { entidad: 'TANQUE' as const, entidad_id: lote.tanque_id, tanque_id: lote.tanque_id, lote_id: id };
        const ultimo = await this.tiempos.ultimo(tx, ctx);
        await this.tiempos.evento(tx, ctx, ultimo?.ciclo ?? 1, 'LIBERACION_LOTE', { anterior: lote.estado_Calida });
      }
      return tx.lotes_produccion.update({ where: { id_Lote_Produccion: id }, data: { estado_Calida: 'LIBERADO' } });
    });
    this.eventos.notificar('TANQUE_ACTUALIZADO', { idLoteProduccion });
    return result;
  }

  async agregarRegistroBitacora({ idLoteProduccion, registro }: { idLoteProduccion: number; registro: any }) {
    const id = this.tiempos.id(idLoteProduccion);
    const result = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id_Lote_Produccion FROM lotes_produccion WHERE id_Lote_Produccion = ${id} FOR UPDATE`;
      const lote = await tx.lotes_produccion.findUnique({ where: { id_Lote_Produccion: id } });
      if (!lote) throw new NotFoundException('Lote no encontrado');
      // No reemplazar silenciosamente una bitácora ilegible.
      const anterior = lote.bitacora ? JSON.parse(lote.bitacora) : [];
      if (!Array.isArray(anterior)) throw new BadRequestException('Formato de bitácora inválido');
      const bitacora = [...anterior, { ...registro, fechaHora: new Date().toISOString() }];
      await tx.lotes_produccion.update({ where: { id_Lote_Produccion: id }, data: { bitacora: JSON.stringify(bitacora) } });
      return { id_Lote_Produccion: id, bitacora };
    });
    this.eventos.notificar('TANQUE_ACTUALIZADO', { idLoteProduccion: id });
    return result;
  }

  async actualizarEstatusTanque({ tanqueId, estatus_proceso }: { tanqueId: number; estatus_proceso: string; idVentaOrigen?: number }) {
    const id = this.tiempos.id(tanqueId);
    const estado = String(estatus_proceso ?? '').trim().toUpperCase().replace(/\s+/g, '_');
    if (!Object.values(equipos_tanques_estatus_proceso).includes(estado as equipos_tanques_estatus_proceso)) throw new BadRequestException('Etapa de tanque inválida');
    const result = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id_Equipos_Tanques FROM equipos_tanques WHERE id_Equipos_Tanques = ${id} FOR UPDATE`;
      const tanque = await tx.equipos_tanques.findUnique({ where: { id_Equipos_Tanques: id } });
      if (!tanque) throw new NotFoundException('Tanque no encontrado');
      const lote = await tx.lotes_produccion.findFirst({ where: { tanque_id: id }, include: { ordenes_produccion: true } });
      if (estado !== 'VACIO' && !lote) throw new BadRequestException('Asigna un lote al tanque primero');
      if (estado === 'VACIO' && lote) throw new BadRequestException('Usa Vaciar para retirar el lote del tanque');
      if (tanque.estatus_proceso === estado) return { muestraId: null, cambio: false };
      const ctx = { entidad: 'TANQUE' as const, entidad_id: id, tanque_id: id, lote_id: lote?.id_Lote_Produccion };
      const tramo = await this.tiempos.transicion(tx, ctx, estado === 'VACIO' ? null : estado);
      await this.tiempos.evento(tx, ctx, tramo?.ciclo ?? 1, 'CAMBIO_PROCESO', { anterior: tanque.estatus_proceso, nuevo: estado });
      let muestraId: number | null = null;
      if (estado === 'MUESTREO' && lote) {
        // Repetir la petición/etapa no crea otra muestra ni reinicia el reloj.
        const pendiente = await tx.muestras.findFirst({ where: { tanque_id: id, lote_id: lote.id_Lote_Produccion, estado_Muestra: { notIn: ['APROBADO', 'RECHAZADO'] } } });
        if (!pendiente) {
          const muestra = await tx.muestras.create({ data: {
            no_Muestra: lote.no_Lote, fecha_Toma: new Date(), Hora_Toma: new Date(), tanque_id: id,
            lote_id: lote.id_Lote_Produccion, producto_id: lote.producto_id,
            cliente_id: lote.ordenes_produccion.cliente_id,
          } });
          muestraId = muestra.id_Muestra;
          const mctx = { entidad: 'MUESTRA' as const, entidad_id: muestraId, tanque_id: id, lote_id: lote.id_Lote_Produccion };
          await this.tiempos.transicion(tx, mctx, 'TRASLADO');
          await this.tiempos.evento(tx, mctx, 1, 'TOMA_MUESTRA');
        }
      }
      if (estado === 'ESPERA_CALIDAD' && lote) await tx.ordenes_produccion.update({ where: { id_Orden_Produc: lote.orden_Produccion_id }, data: { estatus_flujo: 'calidad' } });
      // La recepción y el inicio de análisis los confirma Laboratorio.
      await tx.equipos_tanques.update({ where: { id_Equipos_Tanques: id }, data: { estatus_proceso: estado as equipos_tanques_estatus_proceso } });
      return { muestraId, cambio: true };
    });
    if (result.cambio) this.eventos.notificar('ESTATUS_TANQUE_CAMBIADO', { tanqueId: id, estatus: estado, estatus_proceso: estado });
    if (result.muestraId) this.eventos.notificar('MUESTRA_CREADA', { id_Muestra: result.muestraId });
    return result;
  }
}
