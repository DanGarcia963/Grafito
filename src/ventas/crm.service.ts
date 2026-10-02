import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  Prisma,
  crm_oportunidad_etapa,
  crm_moneda,
  id_reporte_resultado,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events.gateway';
import { Usuario } from '../auth/auth.service';
import { texto, idValido, fichaValida } from '../investigacion/id.logic';
import {
  abierta,
  bloquearOportunidad,
  cerradas,
  decimalCrm,
  eventoCrm,
  fechaCrm,
  recurrencia,
  reiniciarTecnico,
  versionValida,
} from './crm.workflow';
type Archivo = Parameters<typeof fichaValida>[0];
const opc = (v: unknown, max = 4000) =>
  v == null || v === '' ? null : texto(v, max);
const sinArchivo = { contenido: true } as const;
const incluir = {
  cliente: { select: { id_Persona: true, nombre: true } },
  producto: { select: { id_Produc_Mater: true, nombre_Producto: true } },
  _count: { select: { muestras: true } },
  orden_venta: true,
} satisfies Prisma.crm_oportunidadesInclude;
@Injectable()
export class CrmService {
  constructor(
    private prisma: PrismaService,
    private eventos: EventsGateway,
  ) {}
  private avisar(id?: number) {
    this.eventos.notificar('CRM_OPORTUNIDAD_ACTUALIZADA', {
      oportunidad_id: id,
    });
  }
  private scope(u: Usuario) {
    return u.area === 'ventas' ? { vendedor_id: u.personaId } : {};
  }
  private archivo(f: Archivo) {
    if (!f) return {};
    const a = fichaValida(f);
    return {
      nombre_archivo: a.nombre,
      tipo_mime: a.mime,
      contenido: new Uint8Array(f.buffer),
    };
  }
  async listar(u: Usuario, q: Record<string, unknown>) {
    const pagina = q.pagina ? idValido(q.pagina) : 1;
    const etapa = q.etapa ? String(q.etapa) : undefined;
    if (
      etapa &&
      !Object.values(crm_oportunidad_etapa).includes(
        etapa as crm_oportunidad_etapa,
      )
    )
      throw new BadRequestException('Etapa inválida');
    const desde = fechaCrm(q.desde),
      hasta = fechaCrm(q.hasta);
    if (hasta) hasta.setUTCDate(hasta.getUTCDate() + 1);
    if (desde && hasta && desde >= hasta)
      throw new BadRequestException('Rango de fechas inválido');
    const busqueda = opc(q.q, 180);
    const where: Prisma.crm_oportunidadesWhereInput = {
      ...this.scope(u),
      ...(etapa ? { etapa: etapa as crm_oportunidad_etapa } : {}),
      ...(q.persona_id ? { persona_id: idValido(q.persona_id) } : {}),
      ...(desde || hasta
        ? {
            fecha_apertura: { gte: desde ?? undefined, lt: hasta ?? undefined },
          }
        : {}),
      ...(busqueda
        ? {
            OR: [
              { titulo: { contains: busqueda, mode: 'insensitive' } },
              { folio: { contains: busqueda, mode: 'insensitive' } },
              {
                cliente: {
                  nombre: { contains: busqueda, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.crm_oportunidades.count({ where }),
      this.prisma.crm_oportunidades.findMany({
        where,
        include: incluir,
        orderBy: { id: 'desc' },
        take: 50,
        skip: (pagina - 1) * 50,
      }),
    ]);
    return { success: true, data, total, pagina };
  }
  async detalle(id: number, u: Usuario) {
    const data = await this.prisma.crm_oportunidades.findFirst({
      where: { id, ...this.scope(u) },
      include: {
        ...incluir,
        historial: { orderBy: { id: 'desc' } },
        muestras: {
          select: {
            id_Muestra: true,
            no_Muestra: true,
            estado_Muestra: true,
            fecha_recoleccion: true,
            fecha_ingreso_laboratorio: true,
            producto_id: true,
            id_ejecuciones: true,
          },
        },
        cotizaciones: { omit: sinArchivo, orderBy: { version: 'desc' } },
        reportes_id: { omit: sinArchivo, orderBy: { version: 'desc' } },
      },
    });
    if (!data) throw new NotFoundException('Oportunidad no encontrada');
    return { success: true, data };
  }
  async cuentas(u: Usuario, q: string) {
    const data = await this.prisma.personas.findMany({
      where: {
        AND: [
          {
            OR: [
              {
                tipo_persona: {
                  in: ['CLIENTE', 'PROSPECTO'],
                  mode: 'insensitive',
                },
              },
              { crm_perfil_comercial: { isNot: null } },
            ],
          },
          ...(q
            ? [
                {
                  nombre: {
                    contains: q.slice(0, 150),
                    mode: 'insensitive' as const,
                  },
                },
              ]
            : []),
        ],
      },
      select: {
        id_Persona: true,
        nombre: true,
        tipo_persona: true,
        crm_perfil_comercial: true,
      },
      orderBy: { nombre: 'asc' },
      take: 100,
    });
    return { success: true, data };
  }
  async guardarCuenta(body: any, u: Usuario) {
    const data = await this.prisma.$transaction(async (tx) => {
      // Serializa altas con el mismo nombre sin cambiar el modelo compartido.
      const nombre = texto(body.nombre, 255);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${nombre.toLocaleLowerCase('es-MX')}))::text`;
      let p = body.persona_id
        ? await tx.personas.findUnique({
            where: { id_Persona: idValido(body.persona_id) },
          })
        : await tx.personas.findFirst({
            where: { nombre: { equals: nombre, mode: 'insensitive' } },
          });
      if (body.persona_id && !p)
        throw new NotFoundException('Persona no encontrada');
      if (!p)
        p = await tx.personas.create({
          data: { nombre, tipo_persona: 'PROSPECTO' },
        });
      if (
        !['CLIENTE', 'PROSPECTO'].includes(p.tipo_persona.toUpperCase()) &&
        !(await tx.crm_perfiles_comerciales.count({
          where: { persona_id: p.id_Persona },
        }))
      )
        throw new BadRequestException(
          'Selecciona un prospecto o cliente; no se puede convertir un empleado o proveedor desde CRM',
        );
      if (body.persona_id && p.nombre !== nombre) {
        const duplicada = await tx.personas.findFirst({
          where: {
            id_Persona: { not: p.id_Persona },
            nombre: { equals: nombre, mode: 'insensitive' },
          },
        });
        if (duplicada)
          throw new ConflictException(
            'Ya existe otra persona con ese nombre; selecciona la cuenta existente',
          );
        await tx.personas.update({
          where: { id_Persona: p.id_Persona },
          data: { nombre },
        });
      }
      const anterior = await tx.crm_perfiles_comerciales.findUnique({
        where: { persona_id: p.id_Persona },
      });
      if (
        anterior?.vendedor_responsable_id &&
        anterior.vendedor_responsable_id !== u.personaId
      )
        throw new ConflictException(
          'La cuenta tiene otro vendedor responsable',
        );
      const frecuencia = body.frecuencia_esperada_dias
        ? idValido(body.frecuencia_esperada_dias)
        : null;
      const campos = {
        nombre_contacto: opc(body.nombre_contacto, 150),
        puesto_contacto: opc(body.puesto_contacto, 120),
        correo: opc(body.correo, 180),
        telefono: opc(body.telefono, 60),
        origen_prospecto: opc(body.origen_prospecto, 120),
        frecuencia_esperada_dias: frecuencia,
        frecuencia_esperada_descripcion: opc(
          body.frecuencia_esperada_descripcion,
          120,
        ),
        observaciones: opc(body.observaciones),
      };
      return tx.crm_perfiles_comerciales.upsert({
        where: { persona_id: p.id_Persona },
        create: {
          ...campos,
          persona_id: p.id_Persona,
          vendedor_responsable_id: u.personaId,
          estado_comercial:
            p.tipo_persona.toUpperCase() === 'CLIENTE'
              ? 'CLIENTE'
              : 'PROSPECTO',
        },
        update: Object.fromEntries(
          Object.entries(campos).filter(([key]) => body[key] !== undefined),
        ),
      });
    });
    return { success: true, data };
  }
  async cuenta(id: number, u: Usuario) {
    const persona = await this.prisma.personas.findUnique({
      where: { id_Persona: id },
      include: { crm_perfil_comercial: true },
    });
    if (!persona) throw new NotFoundException('Cuenta no encontrada');
    const ordenes = await this.prisma.crm_ordenes_venta.findMany({
      where: { persona_id: id, ...this.scope(u) },
      include: { ordenes_produccion: true },
      orderBy: { fecha_confirmacion: 'desc' },
    });
    const oportunidades = await this.prisma.crm_oportunidades.findMany({
      where: { persona_id: id, ...this.scope(u) },
      orderBy: { id: 'desc' },
    });
    return {
      success: true,
      data: {
        persona,
        ordenes,
        oportunidades,
        recurrencia: recurrencia(
          ordenes
            .filter((x) => !['CANCELADA', 'BORRADOR'].includes(x.estado))
            .map((x) => x.fecha_confirmacion),
          persona.crm_perfil_comercial?.frecuencia_esperada_dias ?? null,
        ),
      },
    };
  }
  async crear(body: any, u: Usuario) {
    const data = await this.prisma.$transaction(async (tx) => {
      const persona_id = idValido(body.persona_id);
      await tx.$queryRaw`SELECT "id_Persona" FROM personas WHERE "id_Persona"=${persona_id} FOR UPDATE`;
      const p = await tx.personas.findUnique({
        where: { id_Persona: persona_id },
        include: { crm_perfil_comercial: true },
      });
      if (
        !p ||
        (!['CLIENTE', 'PROSPECTO'].includes(p.tipo_persona.toUpperCase()) &&
          !p.crm_perfil_comercial)
      )
        throw new BadRequestException('Selecciona una cuenta comercial');
      if (p.crm_perfil_comercial && !p.crm_perfil_comercial.activo)
        throw new BadRequestException('Cuenta inactiva');
      await tx.crm_perfiles_comerciales.upsert({
        where: { persona_id },
        create: {
          persona_id,
          vendedor_responsable_id: u.personaId,
          estado_comercial:
            p.tipo_persona.toUpperCase() === 'CLIENTE'
              ? 'CLIENTE'
              : 'PROSPECTO',
        },
        update: {},
      });
      const o = await tx.crm_oportunidades.create({
        data: {
          folio: `OP-${randomUUID()}`,
          persona_id,
          vendedor_id: u.personaId,
          titulo: texto(body.titulo, 180),
          necesidad: opc(body.necesidad),
          producto_id: body.producto_id ? idValido(body.producto_id) : null,
          cantidad_estimada: body.cantidad_estimada
            ? decimalCrm(body.cantidad_estimada, 4)
            : null,
          unidad: opc(body.unidad, 30),
          fecha_recoleccion_agendada: fechaCrm(
            body.fecha_recoleccion_agendada,
            true,
          ),
          proximo_contacto: fechaCrm(body.proximo_contacto),
          creado_por: u.usuario,
        },
      });
      await tx.crm_oportunidad_historial.create({
        data: {
          oportunidad_id: o.id,
          accion: 'CREACION',
          etapa_nueva: o.etapa,
          realizado_por: u.usuario,
          nota: 'Oportunidad abierta sin muestra física',
        },
      });
      return o;
    });
    this.avisar(data.id);
    return { success: true, data };
  }
  async guardar(id: number, b: any, u: Usuario) {
    const data = await this.prisma.$transaction(async (tx) => {
      const o = await bloquearOportunidad(tx, id, u);
      abierta(o);
      versionValida(o, b.version);
      if (b.etapa && !['PERDIDA', 'CANCELADA', o.etapa].includes(b.etapa))
        throw new BadRequestException(
          'Las etapas de análisis, cotización y ganada se actualizan por sus eventos',
        );
      const cierre = b.etapa === 'PERDIDA' || b.etapa === 'CANCELADA';
      if (cierre)
        await tx.crm_cotizaciones.updateMany({
          where: {
            oportunidad_id: id,
            estado: { in: ['BORRADOR', 'ENVIADA', 'ACEPTADA'] },
          },
          data: { estado: 'CANCELADA' },
        });
      return eventoCrm(
        tx,
        o,
        u,
        cierre
          ? b.etapa === 'PERDIDA'
            ? 'CIERRE_PERDIDA'
            : 'CANCELACION'
          : 'SEGUIMIENTO',
        texto(b.nota, 4000),
        {
          ...(cierre
            ? {
                etapa: b.etapa,
                fecha_cierre: new Date(),
                motivo_cierre: texto(b.nota, 4000),
              }
            : {}),
          ...(b.proximo_contacto !== undefined
            ? { proximo_contacto: fechaCrm(b.proximo_contacto) }
            : {}),
          ...(b.fecha_recoleccion_agendada !== undefined
            ? {
                fecha_recoleccion_agendada: fechaCrm(
                  b.fecha_recoleccion_agendada,
                  true,
                ),
              }
            : {}),
        },
      );
    });
    this.avisar(id);
    return { success: true, data };
  }
  async asociar(id: number, b: any, u: Usuario) {
    await this.prisma.$transaction(async (tx) => {
      const o = await bloquearOportunidad(tx, id, u);
      abierta(o);
      versionValida(o, b.version);
      const mid = idValido(b.muestra_id);
      await tx.$queryRaw`SELECT "id_Muestra" FROM muestras WHERE "id_Muestra"=${mid} FOR UPDATE`;
      const m = await tx.muestras.findFirst({
        where: {
          id_Muestra: mid,
          area_Muestra: 'INVESTIGACION_DESARROLLO',
          vendedor_id: o.vendedor_id,
          cliente_id: o.persona_id,
        },
      });
      if (!m || m.oportunidad_id)
        throw new BadRequestException(
          'Muestra no disponible para esta cuenta y vendedor',
        );
      await tx.muestras.update({
        where: { id_Muestra: mid },
        data: { oportunidad_id: id },
      });
      await reiniciarTecnico(
        tx,
        o,
        u,
        `Muestra histórica asociada: ${m.no_Muestra}`,
      );
    });
    this.avisar(id);
    return { success: true };
  }
  async reporte(id: number, b: any, f: Archivo, u: Usuario) {
    const data = await this.prisma.$transaction(async (tx) => {
      const o = await bloquearOportunidad(tx, id, u);
      abierta(o);
      versionValida(o, b.version);
      if (!Object.values(id_reporte_resultado).includes(b.resultado))
        throw new BadRequestException('Resultado inválido');
      const muestras = await tx.muestras.findMany({
        where: { oportunidad_id: id },
        include: { id_ejecuciones: true },
      });
      if (
        !muestras.length ||
        muestras.some(
          (m) =>
            !m.fecha_ingreso_laboratorio ||
            !['APROBADO', 'RECHAZADO'].includes(m.estado_Muestra) ||
            !m.id_ejecuciones.length ||
            m.id_ejecuciones.some((p) => !p.fin),
        )
      )
        throw new BadRequestException(
          'Finaliza los análisis de todas las muestras asociadas',
        );
      // Toda muestra asociada es requerida. Rechazos previos pueden quedar resueltos por una nueva muestra aprobada.
      if (
        b.resultado === 'VIABLE' &&
        !muestras.some((m) => m.estado_Muestra === 'APROBADO')
      )
        throw new BadRequestException(
          'Se requiere al menos una muestra aprobada',
        );
      const last = await tx.id_reportes_oportunidad.findFirst({
        where: { oportunidad_id: id },
        orderBy: { version: 'desc' },
      });
      await tx.id_reportes_oportunidad.updateMany({
        where: { oportunidad_id: id, estado: 'PUBLICADO' },
        data: {
          estado: 'ANULADO',
          anulado_en: new Date(),
          motivo_anulacion: 'Sustituido por nueva versión',
        },
      });
      await tx.crm_cotizaciones.updateMany({
        where: {
          oportunidad_id: id,
          estado: { in: ['BORRADOR', 'ENVIADA', 'ACEPTADA'] },
        },
        data: { estado: 'CANCELADA' },
      });
      const r = await tx.id_reportes_oportunidad.create({
        data: {
          oportunidad_id: id,
          version: (last?.version ?? 0) + 1,
          estado: 'PUBLICADO',
          resultado: b.resultado,
          resumen: texto(b.resumen, 8000),
          observaciones: opc(b.observaciones),
          ...this.archivo(f),
          creado_por: u.usuario,
          publicado_por: u.usuario,
          publicado_en: new Date(),
        },
        omit: sinArchivo,
      });
      await eventoCrm(
        tx,
        o,
        u,
        'REPORTE_ID_PUBLICADO',
        `Reporte v${r.version}: ${r.resultado}`,
        {
          estado_tecnico: r.resultado,
          etapa: r.resultado === 'VIABLE' ? 'COTIZACION' : 'EN_ANALISIS_ID',
        },
      );
      return r;
    });
    this.avisar(id);
    return { success: true, data };
  }
  async anularReporte(id: number, rid: number, b: any, u: Usuario) {
    await this.prisma.$transaction(async (tx) => {
      const o = await bloquearOportunidad(tx, id, u);
      abierta(o);
      versionValida(o, b.version);
      const motivo = texto(b.motivo, 4000);
      const r = await tx.id_reportes_oportunidad.findFirst({
        where: { id: rid, oportunidad_id: id, estado: 'PUBLICADO' },
      });
      if (!r) throw new BadRequestException('Reporte no publicado');
      await tx.id_reportes_oportunidad.update({
        where: { id: rid },
        data: {
          estado: 'ANULADO',
          anulado_en: new Date(),
          motivo_anulacion: motivo,
        },
      });
      await tx.crm_cotizaciones.updateMany({
        where: {
          oportunidad_id: id,
          estado: { in: ['BORRADOR', 'ENVIADA', 'ACEPTADA'] },
        },
        data: { estado: 'CANCELADA' },
      });
      await eventoCrm(tx, o, u, 'REPORTE_ID_ANULADO', motivo, {
        estado_tecnico: 'PENDIENTE',
        etapa: 'EN_ANALISIS_ID',
      });
    });
    this.avisar(id);
    return { success: true };
  }
  private async habilitada(
    tx: Prisma.TransactionClient,
    o: { id: number; etapa: string; estado_tecnico: string },
  ) {
    abierta(o);
    if (
      o.estado_tecnico !== 'VIABLE' ||
      !(await tx.id_reportes_oportunidad.count({
        where: {
          oportunidad_id: o.id,
          estado: 'PUBLICADO',
          resultado: 'VIABLE',
        },
      }))
    )
      throw new BadRequestException(
        'ID debe publicar un reporte viable antes de cotizar',
      );
  }
  async cotizar(id: number, b: any, f: Archivo, u: Usuario) {
    const data = await this.prisma.$transaction(async (tx) => {
      const o = await bloquearOportunidad(tx, id, u);
      versionValida(o, b.version);
      await this.habilitada(tx, o);
      if (!Object.values(crm_moneda).includes(b.moneda))
        throw new BadRequestException('Moneda inválida');
      const total = decimalCrm(b.total),
        subtotal = b.subtotal ? decimalCrm(b.subtotal, 2, true) : null,
        impuestos = b.impuestos ? decimalCrm(b.impuestos, 2, true) : null;
      if (subtotal && impuestos && !subtotal.add(impuestos).eq(total))
        throw new BadRequestException(
          'Subtotal más impuestos debe coincidir con total',
        );
      const vigencia = fechaCrm(b.vigencia_hasta, true);
      if (
        vigencia!.toISOString().slice(0, 10) <
        new Date().toISOString().slice(0, 10)
      )
        throw new BadRequestException('Vigencia vencida');
      const last = await tx.crm_cotizaciones.findFirst({
        where: { oportunidad_id: id },
        orderBy: { version: 'desc' },
      });
      await tx.crm_cotizaciones.updateMany({
        where: {
          oportunidad_id: id,
          estado: { in: ['BORRADOR', 'ENVIADA', 'ACEPTADA'] },
        },
        data: { estado: 'CANCELADA' },
      });
      const c = await tx.crm_cotizaciones.create({
        data: {
          oportunidad_id: id,
          version: (last?.version ?? 0) + 1,
          folio: `COT-${randomUUID()}`,
          moneda: b.moneda,
          total,
          subtotal,
          impuestos,
          vigencia_hasta: vigencia,
          condiciones_comerciales: texto(b.condiciones_comerciales, 8000),
          notas: opc(b.notas),
          ...this.archivo(f),
          creado_por: u.usuario,
        },
        omit: sinArchivo,
      });
      await eventoCrm(
        tx,
        o,
        u,
        'COTIZACION_CREADA',
        `Cotización v${c.version}`,
        { etapa: 'COTIZACION' },
      );
      return c;
    });
    this.avisar(id);
    return { success: true, data };
  }
  async estadoCotizacion(id: number, cid: number, b: any, u: Usuario) {
    await this.prisma.$transaction(async (tx) => {
      const o = await bloquearOportunidad(tx, id, u);
      versionValida(o, b.version);
      await this.habilitada(tx, o);
      const c = await tx.crm_cotizaciones.findFirst({
        where: { id: cid, oportunidad_id: id },
      });
      if (!c) throw new NotFoundException('Cotización no encontrada');
      if (
        !['ENVIADA', 'ACEPTADA', 'RECHAZADA'].includes(b.estado) ||
        (b.estado === 'ENVIADA'
          ? c.estado !== 'BORRADOR'
          : c.estado !== 'ENVIADA')
      )
        throw new BadRequestException('Transición de cotización inválida');
      if (
        c.vigencia_hasta &&
        c.vigencia_hasta.toISOString().slice(0, 10) <
          new Date().toISOString().slice(0, 10)
      )
        throw new BadRequestException(
          'La cotización venció; crea una nueva versión',
        );
      await tx.crm_cotizaciones.update({
        where: { id: cid },
        data: {
          estado: b.estado,
          ...(b.estado === 'ENVIADA'
            ? { enviado_en: new Date() }
            : b.estado === 'ACEPTADA'
              ? { aceptado_en: new Date() }
              : { rechazado_en: new Date() }),
        },
      });
      await eventoCrm(
        tx,
        o,
        u,
        b.estado === 'ENVIADA'
          ? 'COTIZACION_ENVIADA'
          : b.estado === 'ACEPTADA'
            ? 'COTIZACION_ACEPTADA'
            : 'COTIZACION_RECHAZADA',
        texto(b.nota, 4000),
        {
          etapa: 'SEGUIMIENTO_COTIZACION',
          ...(b.proximo_contacto
            ? { proximo_contacto: fechaCrm(b.proximo_contacto) }
            : {}),
        },
      );
    });
    this.avisar(id);
    return { success: true };
  }
  async confirmar(id: number, b: any, u: Usuario) {
    const data = await this.prisma.$transaction(async (tx) => {
      const o = await bloquearOportunidad(tx, id, u);
      const existente = await tx.crm_ordenes_venta.findUnique({
        where: { oportunidad_id: id },
      });
      if (existente) {
        if (
          existente.cotizacion_id !== idValido(b.cotizacion_id) ||
          existente.estado === 'CANCELADA'
        )
          throw new ConflictException('La oportunidad ya tiene orden');
        return existente;
      }
      versionValida(o, b.version);
      await this.habilitada(tx, o);
      const c = await tx.crm_cotizaciones.findFirst({
        where: {
          id: idValido(b.cotizacion_id),
          oportunidad_id: id,
          estado: 'ACEPTADA',
        },
      });
      if (!c)
        throw new BadRequestException('Selecciona la cotización aceptada');
      if (
        c.vigencia_hasta &&
        c.vigencia_hasta.toISOString().slice(0, 10) <
          new Date().toISOString().slice(0, 10)
      )
        throw new BadRequestException('Cotización vencida');
      // Bloqueo por persona evita dos primeras compras simultáneas en oportunidades distintas.
      await tx.$queryRaw`SELECT "id_Persona" FROM personas WHERE "id_Persona"=${o.persona_id} FOR UPDATE`;
      const anteriores = await tx.crm_ordenes_venta.count({
        where: {
          persona_id: o.persona_id,
          estado: { notIn: ['BORRADOR', 'CANCELADA'] },
        },
      });
      const perfil = await tx.crm_perfiles_comerciales.findUnique({
        where: { persona_id: o.persona_id },
      });
      const orden = await tx.crm_ordenes_venta.create({
        data: {
          folio: `OV-${randomUUID()}`,
          oportunidad_id: id,
          cotizacion_id: c.id,
          persona_id: o.persona_id,
          vendedor_id: o.vendedor_id,
          producto_id: o.producto_id,
          orden_cliente: texto(b.orden_cliente, 100),
          cantidad: b.cantidad
            ? decimalCrm(b.cantidad, 4)
            : o.cantidad_estimada,
          unidad: opc(b.unidad, 30) ?? o.unidad,
          moneda: c.moneda,
          importe_total: c.total,
          tipo_compra:
            anteriores ||
            (perfil?.estado_comercial === 'CLIENTE' &&
              !perfil.fecha_primera_conversion)
              ? 'RECOMPRA'
              : 'PRIMERA_COMPRA',
          fecha_compromiso: fechaCrm(b.fecha_compromiso),
          observaciones: opc(b.observaciones),
          creado_por: u.usuario,
        },
      });
      await tx.crm_perfiles_comerciales.upsert({
        where: { persona_id: o.persona_id },
        create: {
          persona_id: o.persona_id,
          estado_comercial: 'CLIENTE',
          vendedor_responsable_id: o.vendedor_id,
          fecha_primera_conversion: orden.fecha_confirmacion,
        },
        update: {
          estado_comercial: 'CLIENTE',
          ...(!perfil?.fecha_primera_conversion &&
          perfil?.estado_comercial !== 'CLIENTE'
            ? { fecha_primera_conversion: orden.fecha_confirmacion }
            : {}),
        },
      });
      await tx.personas.update({
        where: { id_Persona: o.persona_id },
        data: { tipo_persona: 'CLIENTE' },
      });
      await eventoCrm(tx, o, u, 'CIERRE_GANADA', `Orden ${orden.folio}`, {
        etapa: 'GANADA',
        fecha_cierre: orden.fecha_confirmacion,
        proximo_contacto: null,
      });
      return orden;
    });
    this.avisar(id);
    return { success: true, data };
  }
  async ordenes(u: Usuario) {
    return {
      success: true,
      data: await this.prisma.crm_ordenes_venta.findMany({
        where: this.scope(u),
        include: {
          cliente: { select: { nombre: true } },
          ordenes_produccion: true,
        },
        orderBy: { id: 'desc' },
      }),
    };
  }
  async produccion(id: number, b: any, u: Usuario) {
    const data = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM crm_ordenes_venta WHERE id=${id} FOR UPDATE`;
      const ov = await tx.crm_ordenes_venta.findFirst({
        where: { id, ...this.scope(u) },
        include: { ordenes_produccion: true },
      });
      if (!ov) throw new NotFoundException('Orden no encontrada');
      if (ov.estado === 'CANCELADA')
        throw new BadRequestException('Orden cancelada');
      if (ov.ordenes_produccion.length) return ov.ordenes_produccion[0];
      const cantidad = decimalCrm(b.cantidad ?? ov.cantidad?.toString(), 4);
      if (!cantidad.isInteger() || cantidad.gt(2147483647))
        throw new BadRequestException(
          'Producción requiere cantidad entera por el modelo actual',
        );
      const producto = ov.producto_id ?? idValido(b.producto_id);
      const op = await tx.ordenes_produccion.create({
        data: {
          orden_venta_id: ov.id,
          id_Venta_Origen: ov.id,
          vendedor_id: ov.vendedor_id,
          cliente_id: ov.persona_id,
          producto_id: producto,
          servicio: texto(b.servicio, 50),
          linea_Produccion: opc(b.linea_Produccion, 50),
          cantidad_Venta: cantidad.toNumber(),
          cantidad_Producida: 0,
          status_Produccion: 'PENDIENTE',
          fecha_Confirmacion: ov.fecha_confirmacion,
          fecha_Compromiso: ov.fecha_compromiso,
          observaciones: ov.observaciones,
        },
      });
      await tx.crm_ordenes_venta.update({
        where: { id },
        data: { estado: 'EN_PRODUCCION', producto_id: producto },
      });
      return op;
    });
    this.avisar();
    return { success: true, data };
  }
  async cancelarOrden(id: number, b: any, u: Usuario) {
    await this.prisma.$transaction(async (tx) => {
      const previa = await tx.crm_ordenes_venta.findFirst({
        where: { id, ...this.scope(u) },
      });
      if (!previa) throw new NotFoundException('Orden no encontrada');
      const o = await bloquearOportunidad(tx, previa.oportunidad_id, u);
      await tx.$queryRaw`SELECT id FROM crm_ordenes_venta WHERE id=${id} FOR UPDATE`;
      const orden = await tx.crm_ordenes_venta.findUniqueOrThrow({
        where: { id },
        include: { ordenes_produccion: true },
      });
      if (orden.estado === 'CANCELADA') return;
      if (orden.ordenes_produccion.some((x) => x.estado_Plan !== 'CANCELADA'))
        throw new ConflictException(
          'Cancela las órdenes de producción antes de cancelar la venta',
        );
      const motivo = texto(b.motivo, 4000);
      await tx.crm_ordenes_venta.update({
        where: { id },
        data: {
          estado: 'CANCELADA',
          fecha_cancelacion: new Date(),
          motivo_cancelacion: motivo,
        },
      });
      await tx.crm_cotizaciones.update({
        where: { id: orden.cotizacion_id },
        data: { estado: 'CANCELADA' },
      });
      await eventoCrm(tx, o, u, 'CANCELACION', motivo, {
        etapa: 'CANCELADA',
        motivo_cierre: motivo,
        fecha_cierre: new Date(),
      });
    });
    this.avisar();
    return { success: true };
  }
  async documento(tipo: 'cotizacion' | 'reporte', id: number, u: Usuario) {
    const f =
      tipo === 'cotizacion'
        ? await this.prisma.crm_cotizaciones.findFirst({
            where: { id, oportunidad: this.scope(u) },
          })
        : await this.prisma.id_reportes_oportunidad.findFirst({
            where: { id, oportunidad: this.scope(u) },
          });
    if (!f?.contenido) throw new NotFoundException('Documento no disponible');
    return f;
  }
  async metricas(u: Usuario, q: any) {
    const desde = fechaCrm(q.desde),
      hasta = fechaCrm(q.hasta);
    if (hasta) hasta.setUTCDate(hasta.getUTCDate() + 1);
    if (desde && hasta && desde >= hasta)
      throw new BadRequestException('Rango inválido');
    const dentro = (d: Date | null) =>
      !!d && (!desde || d >= desde) && (!hasta || d < hasta);
    const [ops, perfiles, ordenes] = await Promise.all([
      this.prisma.crm_oportunidades.findMany({ where: this.scope(u) }),
      this.prisma.crm_perfiles_comerciales.findMany({
        where: { vendedor_responsable_id: u.personaId },
      }),
      this.prisma.crm_ordenes_venta.findMany({
        where: {
          ...this.scope(u),
          estado: { notIn: ['CANCELADA', 'BORRADOR'] },
        },
        orderBy: { fecha_confirmacion: 'asc' },
      }),
    ]);
    const cohorte = perfiles.filter(
      (p) =>
        dentro(p.fecha_alta_prospecto) &&
        !(p.estado_comercial === 'CLIENTE' && !p.fecha_primera_conversion),
    );
    const convertidos = cohorte.filter((p) =>
      ordenes.some(
        (o) =>
          o.persona_id === p.persona_id &&
          (!hasta || o.fecha_confirmacion < hasta),
      ),
    ).length;
    const ganadas = ops.filter(
        (o) => o.etapa === 'GANADA' && dentro(o.fecha_cierre),
      ).length,
      perdidas = ops.filter(
        (o) => o.etapa === 'PERDIDA' && dentro(o.fecha_cierre),
      ).length;
    const porCliente = new Map<number, Date[]>();
    ordenes
      .filter((o) => !hasta || o.fecha_confirmacion < hasta)
      .forEach((o) =>
        porCliente.set(o.persona_id, [
          ...(porCliente.get(o.persona_id) ?? []),
          o.fecha_confirmacion,
        ]),
      );
    const duraciones = ops
      .filter((o) => cerradas.includes(o.etapa) && dentro(o.fecha_cierre))
      .map((o) => (+o.fecha_cierre! - +o.fecha_apertura) / 86400000);
    return {
      success: true,
      data: {
        cohorte: cohorte.length,
        convertidos,
        conversion_prospectos: cohorte.length
          ? (100 * convertidos) / cohorte.length
          : null,
        ganadas,
        perdidas,
        efectividad:
          ganadas + perdidas ? (100 * ganadas) / (ganadas + perdidas) : null,
        abiertas: ops.filter(
          (o) => !cerradas.includes(o.etapa) && dentro(o.fecha_apertura),
        ).length,
        canceladas: ops.filter(
          (o) => o.etapa === 'CANCELADA' && dentro(o.fecha_cierre),
        ).length,
        ordenes_periodo: ordenes.filter((o) => dentro(o.fecha_confirmacion))
          .length,
        clientes_recompra: [...porCliente.values()].filter((x) => x.length >= 2)
          .length,
        duracion_comercial_dias: duraciones.length
          ? duraciones.reduce((a, b) => a + b, 0) / duraciones.length
          : null,
        recurrencia: [...porCliente].map(([persona_id, fechas]) => ({
          persona_id,
          ...recurrencia(
            fechas,
            perfiles.find((p) => p.persona_id === persona_id)
              ?.frecuencia_esperada_dias ?? null,
          ),
        })),
      },
    };
  }
}
