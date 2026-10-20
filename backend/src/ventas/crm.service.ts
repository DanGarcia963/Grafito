import { especificacionesValidas } from '../inventario/especificaciones.logic';
import {
  crearOrdenProduccion,
  existencias,
} from '../inventario/inventario.logic';
import { productos_materiales_UM, crm_tipo_venta } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import {
  Prisma,
  crm_oportunidad_etapa,
  crm_moneda,
  id_reporte_resultado,
  crm_tipo_contacto,
  crm_documento_cliente_tipo,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events.gateway';
import { Usuario } from '../auth/auth.service';
import { escaparHtmlCorreo, MailjetService } from '../correo/mailjet.service';
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
import { calcularCumplimientoOV } from './crm.fulfillment';
type Archivo = Parameters<typeof fichaValida>[0];
const opc = (v: unknown, max = 4000) =>
  v == null || v === '' ? null : texto(v, max);
const sinArchivo = { contenido: true } as const;
type ArchivoCuenta = { buffer: Buffer; originalname: string; size: number; mimetype?: string };
const correoValido = (value: unknown): value is string =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
function datosArchivoCuenta(file?: ArchivoCuenta) {
  if (!file || file.size < 1 || file.size > 10 * 1024 * 1024)
    throw new BadRequestException('Adjunta un documento de hasta 10 MB.');
  const nombre = file.originalname.toLowerCase();
  const bytes = file.buffer;
  const pdf = nombre.endsWith('.pdf') && bytes.subarray(0, 5).toString() === '%PDF-';
  const jpg = /\.jpe?g$/.test(nombre) && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = nombre.endsWith('.png') && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const doc = nombre.endsWith('.doc') && bytes.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'));
  const docx = nombre.endsWith('.docx') && bytes.subarray(0, 2).toString() === 'PK' && bytes.includes(Buffer.from('word/document.xml'));
  if (!pdf && !jpg && !png && !doc && !docx)
    throw new BadRequestException('Formato no admitido. Usa PDF, Word, JPG o PNG.');
  const mime = pdf ? 'application/pdf' : jpg ? 'image/jpeg' : png ? 'image/png' : doc ? 'application/msword' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return { nombre: file.originalname.replace(/[\r\n\\/]/g, '_').slice(0, 255), mime };
}
function correoVendedorConfigurado(personaId: number): string | null {
  try {
    const users = JSON.parse(process.env.UST_USUARIOS_JSON || '[]');
    if (!Array.isArray(users)) return null;
    const user = users.find((item: any) => Number(item?.personaId) === personaId && Array.isArray(item?.areas) && item.areas.includes('ventas'));
    return correoValido(user?.correo) ? user.correo.trim() : null;
  } catch {
    return null;
  }
}
function origenFrontend(): string {
  const configured = process.env.FRONTEND_URL?.split(',')[0]?.trim();
  const fallback = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000';
  const raw = configured || fallback;
  if (!raw) throw new ServiceUnavailableException('Configura FRONTEND_URL en Railway para crear enlaces de respuesta a cotizaciones.');
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    return url.origin;
  } catch {
    throw new ServiceUnavailableException('FRONTEND_URL debe ser una URL HTTP/HTTPS válida.');
  }
}
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
    private correo: MailjetService,
  ) {}
  private avisar(id?: number) {
    this.eventos.notificar('CRM_OPORTUNIDAD_ACTUALIZADA', {
      oportunidad_id: id,
    });
  }
  private scope(u: Usuario) {
    return u.area === 'ventas'
      ? {
          vendedor_id: u.personaId,
          cliente: {
            crm_perfil_comercial: {
              is: { vendedor_responsable_id: u.personaId },
            },
          },
        }
      : {};
  }
  private cuentaScope(u: Usuario): Prisma.personasWhereInput {
    return u.area === 'ventas'
      ? {
          crm_perfil_comercial: {
            is: { vendedor_responsable_id: u.personaId },
          },
        }
      : {};
  }
  private async validarAsignacionCuenta(
    tx: Prisma.TransactionClient,
    personaId: number,
    vendedorId: number,
    responsableActual?: number | null,
  ) {
    if (responsableActual != null && responsableActual !== vendedorId)
      throw new NotFoundException('Cuenta no encontrada');
    if (responsableActual == null) {
      const [otraOportunidad, otraOrden] = await Promise.all([
        tx.crm_oportunidades.findFirst({
          where: {
            persona_id: personaId,
            vendedor_id: { not: vendedorId },
          },
          select: { id: true },
        }),
        tx.crm_ordenes_venta.findFirst({
          where: {
            persona_id: personaId,
            vendedor_id: { not: vendedorId },
          },
          select: { id: true },
        }),
      ]);
      if (otraOportunidad || otraOrden)
        throw new NotFoundException('Cuenta no encontrada');
    }
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
    const costosSelect: Prisma.crm_costos_oportunidadFindManyArgs['select'] =
      u.area === 'id'
        ? {
            id: true,
            version: true,
            formula: true,
            formula_enviada_por: true,
            formula_enviada_en: true,
            precio_objetivo_litro: true,
            moneda: true,
            precio_emitido_por: true,
            precio_emitido_en: true,
            reporte: { select: { version: true } },
          }
        : {
            id: true,
            version: true,
            precio_objetivo_litro: true,
            moneda: true,
            precio_emitido_en: true,
            reporte: { select: { version: true } },
          };

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
            id_flujo_estructurado: true,
            id_analisis_preliminar: true,
            id_procesamiento: true,
            id_analisis_final: true,
            id_ejecuciones: true,
          },
        },
        cotizaciones: {
          omit: sinArchivo,
          include: { producto: true },
          orderBy: { version: 'desc' },
        },
        reportes_id: { omit: sinArchivo, orderBy: { version: 'desc' } },
        costos_oportunidad: {
          where: { reporte: { is: { estado: 'PUBLICADO' } } },
          orderBy: { version: 'desc' },
          select: costosSelect,
        },
      },
    });
    if (!data) throw new NotFoundException('Oportunidad no encontrada');
    return { success: true, data };
  }
  async cuentas(u: Usuario, q: string) {
    const data = await this.prisma.personas.findMany({
      where: {
        ...this.cuentaScope(u),
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
      await tx.$queryRaw`SELECT "id_Persona" FROM personas WHERE "id_Persona"=${p.id_Persona} FOR UPDATE`;
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
      await this.validarAsignacionCuenta(
        tx,
        p.id_Persona,
        u.personaId,
        anterior?.vendedor_responsable_id,
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
        update: {
          ...Object.fromEntries(
            Object.entries(campos).filter(([key]) => body[key] !== undefined),
          ),
          ...(anterior?.vendedor_responsable_id == null
            ? { vendedor_responsable_id: u.personaId }
            : {}),
        },
      });
    });
    return { success: true, data };
  }
  async cuenta(id: number, u: Usuario) {
    const persona = await this.prisma.personas.findFirst({
      where: { id_Persona: id, ...this.cuentaScope(u) },
      include: { crm_perfil_comercial: true },
    });
    if (!persona) throw new NotFoundException('Cuenta no encontrada');
    const documentos = await this.prisma.crm_documentos_cliente.findMany({
      where: { persona_id: id },
      select: {
        id: true,
        tipo_documento: true,
        version: true,
        nombre_archivo: true,
        tipo_mime: true,
        vigente: true,
        subido_por: true,
        subido_en: true,
      },
      orderBy: [{ tipo_documento: 'asc' }, { version: 'desc' }],
    });
    const ordenes = await this.prisma.crm_ordenes_venta.findMany({
      where: { persona_id: id, ...this.scope(u) },
      include: {
        produccion_asignada: { include: { orden_produccion: true } },
      },
      orderBy: { fecha_confirmacion: 'desc' },
    });
    const ordenesConProduccion = ordenes.map(
      ({ produccion_asignada, ...orden }) => ({
        ...orden,
        ordenes_produccion: produccion_asignada.map(
          (asignacion) => ({
            ...asignacion.orden_produccion,
            cantidad_producto_terminado:
              asignacion.cantidad_producto_terminado,
          }),
        ),
      }),
    );
    const oportunidades = await this.prisma.crm_oportunidades.findMany({
      where: { persona_id: id, ...this.scope(u) },
      orderBy: { id: 'desc' },
    });
    return {
      success: true,
      data: {
        persona,
        documentos,
        ordenes: await this.clasificarCompras(ordenesConProduccion),
        oportunidades,
        recurrencia: recurrencia(
          ordenes
            .filter((x) => !['CANCELADA'].includes(x.estado))
            .map((x) => x.fecha_confirmacion),
          persona.crm_perfil_comercial?.frecuencia_esperada_dias ?? null,
        ),
      },
    };
  }
  async subirDocumentoCuenta(id: number, tipoEntrada: unknown, file: ArchivoCuenta, u: Usuario) {
    if (!Object.values(crm_documento_cliente_tipo).includes(tipoEntrada as crm_documento_cliente_tipo))
      throw new BadRequestException('Tipo de documento comercial inválido.');
    const a = datosArchivoCuenta(file);
    const data = await this.prisma.$transaction(async (tx) => {
      const persona = await tx.personas.findFirst({
        where: { id_Persona: id, ...this.cuentaScope(u) },
        select: { id_Persona: true },
      });
      if (!persona) throw new NotFoundException('Cuenta no encontrada.');
      await tx.$queryRaw`SELECT "id_Persona" FROM personas WHERE "id_Persona"=${id} FOR UPDATE`;
      const previo = await tx.crm_documentos_cliente.findFirst({
        where: { persona_id: id, tipo_documento: tipoEntrada as crm_documento_cliente_tipo },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      await tx.crm_documentos_cliente.updateMany({
        where: { persona_id: id, tipo_documento: tipoEntrada as crm_documento_cliente_tipo, vigente: true },
        data: { vigente: false },
      });
      return tx.crm_documentos_cliente.create({
        data: {
          persona_id: id,
          tipo_documento: tipoEntrada as crm_documento_cliente_tipo,
          version: (previo?.version ?? 0) + 1,
          vigente: true,
          nombre_archivo: a.nombre,
          tipo_mime: a.mime,
          contenido: new Uint8Array(file.buffer),
          subido_por: u.usuario,
        },
        select: { id: true, tipo_documento: true, version: true, nombre_archivo: true, subido_en: true },
      });
    });
    return { success: true, data };
  }
  async documentoCuenta(id: number, u: Usuario) {
    const doc = await this.prisma.crm_documentos_cliente.findUnique({
      where: { id },
      select: { persona_id: true, nombre_archivo: true, tipo_mime: true, contenido: true },
    });
    if (!doc || !(await this.prisma.personas.findFirst({
      where: { id_Persona: doc.persona_id, ...this.cuentaScope(u) },
      select: { id_Persona: true },
    }))) throw new NotFoundException('Documento de cuenta no encontrado.');
    return doc;
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
      await this.validarAsignacionCuenta(
        tx,
        persona_id,
        u.personaId,
        p.crm_perfil_comercial?.vendedor_responsable_id,
      );
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
        update: { vendedor_responsable_id: u.personaId },
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
          etapa: body.fecha_recoleccion_agendada
            ? 'RECOLECCION_AGENDADA'
            : 'REGISTRADA',
          fecha_recoleccion_agendada: fechaCrm(body.fecha_recoleccion_agendada),
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
      const tipoContacto = b.tipo_contacto == null || b.tipo_contacto === ''
        ? null
        : String(b.tipo_contacto);
      if (tipoContacto && !Object.values(crm_tipo_contacto).includes(tipoContacto as crm_tipo_contacto))
        throw new BadRequestException('Tipo de seguimiento inválido.');
      const fechaContacto = b.fecha_contacto
        ? fechaCrm(b.fecha_contacto, true)
        : tipoContacto
          ? new Date()
          : null;
      if (cierre)
        await tx.crm_cotizaciones.updateMany({
          where: {
            oportunidad_id: id,
            estado: { in: ['BORRADOR', 'ENVIADA', 'ACEPTADA'] },
          },
          data: { estado: 'CANCELADA', token_respuesta_hash: null, token_respuesta_expira: null },
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
        tipoContacto
          ? {
              tipo_contacto: tipoContacto as crm_tipo_contacto,
              fecha_contacto: fechaContacto,
            }
          : {},
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
      if (o.etapa === 'GANADA')
        throw new ConflictException(
          'El reporte respalda una venta confirmada y no puede modificarse',
        );
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
      if (muestras.some((m) => m.id_flujo_estructurado && (!m.id_analisis_preliminar || !m.id_procesamiento || !m.id_analisis_final)))
        throw new BadRequestException('Completa el análisis preliminar, procesamiento y análisis final de I+D antes de publicar el reporte.');
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
        data: { estado: 'CANCELADA', token_respuesta_hash: null, token_respuesta_expira: null },
      });
      const r = await tx.id_reportes_oportunidad.create({
        data: {
          oportunidad_id: id,
          version: (last?.version ?? 0) + 1,
          estado: 'PUBLICADO',
          resultado: b.resultado,
          resumen: texto(b.resumen, 8000),
          observaciones: opc(b.observaciones),
          muestras_ciclos: muestras.map((m) => ({
            muestra_id: m.id_Muestra,
            ficha_nombre: m.ficha_nombre,
            ciclo: Math.max(...m.id_ejecuciones.map((e) => e.ciclo)),
            dictamen: m.estado_Muestra,
            analisis_preliminar: m.id_analisis_preliminar,
            procesamiento: m.id_procesamiento,
            analisis_final: m.id_analisis_final,
          })),
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
          ...(cerradas.includes(o.etapa)
            ? {}
            : {
                etapa:
                  r.resultado === 'VIABLE'
                    ? ('COTIZACION' as const)
                    : ('EN_ANALISIS_ID' as const),
              }),
        },
      );
      return r;
    });
    this.avisar(id);
    return { success: true, data };
  }

  async enviarFormulaCostos(id: number, b: any, u: Usuario) {
    const formula = texto(b.formula, 12000);
    if (!formula)
      throw new BadRequestException('Captura la fórmula para Costos');
    const data = await this.prisma.$transaction(async (tx) => {
      const o = await bloquearOportunidad(tx, id, u);
      versionValida(o, b.version);
      const reporte = await tx.id_reportes_oportunidad.findFirst({
        where: { oportunidad_id: id, estado: 'PUBLICADO' },
        orderBy: { version: 'desc' },
      });
      if (!reporte || reporte.resultado !== 'VIABLE')
        throw new BadRequestException(
          'Se requiere un reporte viable publicado',
        );
      const enviada = await tx.crm_costos_oportunidad.findFirst({
        where: { reporte_id: reporte.id, oportunidad_id: id },
      });
      if (enviada)
        throw new ConflictException(
          'Ya se envió una fórmula para este reporte; publica una nueva versión del reporte para reenviarla',
        );
      const previa = await tx.crm_costos_oportunidad.findFirst({
        where: { oportunidad_id: id },
        orderBy: { version: 'desc' },
      });
      return tx.crm_costos_oportunidad.create({
        data: {
          oportunidad_id: id,
          reporte_id: reporte.id,
          version: (previa?.version ?? 0) + 1,
          formula,
          formula_enviada_por: u.usuario,
        },
        select: {
          id: true,
          version: true,
          formula: true,
          formula_enviada_por: true,
          formula_enviada_en: true,
          reporte: { select: { version: true } },
        },
      });
    });
    this.avisar(id);
    this.eventos.notificar('COSTOS_FORMULA_RECIBIDA', { oportunidad_id: id });
    return { success: true, data };
  }

  async anularReporte(id: number, rid: number, b: any, u: Usuario) {
    await this.prisma.$transaction(async (tx) => {
      const o = await bloquearOportunidad(tx, id, u);
      if (o.etapa === 'GANADA')
        throw new ConflictException(
          'El reporte respalda una venta confirmada y no puede modificarse',
        );
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
        data: { estado: 'CANCELADA', token_respuesta_hash: null, token_respuesta_expira: null },
      });
      await eventoCrm(tx, o, u, 'REPORTE_ID_ANULADO', motivo, {
        estado_tecnico: 'PENDIENTE',
        ...(cerradas.includes(o.etapa)
          ? {}
          : { etapa: 'EN_ANALISIS_ID' as const }),
      });
    });
    this.avisar(id);
    return { success: true };
  }
  async enviarReporteAVentas(id: number, rid: number, u: Usuario) {
    const resultado = await this.prisma.$transaction(async (tx) => {
      const oportunidad = await bloquearOportunidad(tx, id, u);
      const reporte = await tx.id_reportes_oportunidad.findFirst({
        where: { id: rid, oportunidad_id: id, estado: 'PUBLICADO' },
      });
      if (!reporte) throw new NotFoundException('Reporte publicado no encontrado.');
      const perfilVendedor = await tx.crm_perfiles_comerciales.findUnique({
        where: { persona_id: oportunidad.vendedor_id },
        select: { correo: true },
      });
      const destinatario = correoVendedorConfigurado(oportunidad.vendedor_id) ?? perfilVendedor?.correo?.trim() ?? '';
      if (!correoValido(destinatario))
        throw new BadRequestException('Agrega el correo del vendedor en UST_USUARIOS_JSON para poder enviarle el reporte.');
      const muestras = Array.isArray(reporte.muestras_ciclos) ? reporte.muestras_ciclos as any[] : [];
      const resumenMediciones = muestras.map((m) => {
        const valores = (analisis: any) => Array.isArray(analisis?.metricas)
          ? analisis.metricas.map((x: any) => `${x.nombre}: ${x.valor}${x.unidad ? ` ${x.unidad}` : ''}`).join('; ')
          : 'Sin datos';
        return `Muestra #${m.muestra_id} · preliminar: ${valores(m.analisis_preliminar)} · final: ${valores(m.analisis_final)}`;
      });
      const cliente = await tx.personas.findUnique({
        where: { id_Persona: oportunidad.persona_id },
        select: { nombre: true },
      });
      const lineas = [
        `Oportunidad: ${oportunidad.folio} · ${oportunidad.titulo}`,
        `Cliente: ${cliente?.nombre ?? '—'}`,
        `Resultado: ${reporte.resultado}`,
        `Resumen: ${reporte.resumen ?? '—'}`,
        ...resumenMediciones,
      ];
      const html = `<div style="margin:0;background:#f1f5f9;padding:28px 12px;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:640px;margin:auto;background:#fff;border:1px solid #dbe4ee;border-radius:14px;overflow:hidden"><header style="background:#082f49;padding:22px 26px;color:#ecfeff"><small style="color:#67e8f9;letter-spacing:2px">US Technologies · Investigación y Desarrollo</small><h1 style="margin:8px 0 0;font-size:22px">Reporte de análisis · v${reporte.version}</h1></header><div style="padding:26px"><p>Se publicó un reporte de I+D para la oportunidad <b>${escaparHtmlCorreo(oportunidad.folio)}</b>.</p><p><b>Cliente:</b> ${escaparHtmlCorreo(cliente?.nombre ?? '—')}</p><p><b>Resultado:</b> ${escaparHtmlCorreo(reporte.resultado)}</p><p>${escaparHtmlCorreo(reporte.resumen ?? '—')}</p>${resumenMediciones.length ? `<h2 style="font-size:15px">Resultados de caracterización</h2><ul>${resumenMediciones.map((x) => `<li style="margin:8px 0">${escaparHtmlCorreo(x)}</li>`).join('')}</ul>` : ''}<p>${reporte.nombre_archivo ? 'El reporte se adjunta a este correo.' : 'Consulta el resumen anterior; este reporte no incluye un archivo adjunto.'}</p><p style="font-size:12px;color:#64748b">Este envío fue solicitado manualmente por I+D.</p></div></div></div>`;
      await this.correo.enviar({
        destinatario,
        asunto: `Reporte de I+D v${reporte.version} · ${oportunidad.folio}`,
        texto: lineas.join('\n\n'),
        html,
        ...(reporte.contenido && reporte.nombre_archivo
          ? { adjuntos: [{ nombre: reporte.nombre_archivo, mime: reporte.tipo_mime ?? 'application/pdf', contenido: reporte.contenido }] }
          : {}),
      });
      const enviado = new Date();
      await tx.id_reportes_oportunidad.update({
        where: { id: rid },
        data: { enviado_ventas_en: enviado, enviado_ventas_por: u.usuario, enviado_ventas_correo: destinatario },
      });
      await eventoCrm(tx, oportunidad, u, 'REPORTE_ID_ENVIADO_VENTAS', `Reporte v${reporte.version} enviado manualmente a ${destinatario}`);
      return { destinatario, version: reporte.version };
    }, { maxWait: 5_000, timeout: 30_000 });
    this.avisar(id);
    return { success: true, mensaje: `Reporte v${resultado.version} enviado a ${resultado.destinatario}.`, ...resultado };
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
        subtotal = decimalCrm(b.subtotal, 2, true),
        impuestos = decimalCrm(b.impuestos, 2, true);
      if (subtotal && impuestos && !subtotal.add(impuestos).eq(total))
        throw new BadRequestException(
          'Subtotal más impuestos debe coincidir con total',
        );
      const vigencia = fechaCrm(b.vigencia_hasta, true)!;
      if (
        !Object.values(crm_tipo_venta).includes(b.tipo_venta) ||
        !Object.values(productos_materiales_UM).includes(b.unidad)
      )
        throw new BadRequestException('Tipo de venta o unidad inválidos');
      const reporte = await tx.id_reportes_oportunidad.findFirstOrThrow({
        where: { oportunidad_id: id, estado: 'PUBLICADO', resultado: 'VIABLE' },
        orderBy: { version: 'desc' },
      });
      const costo = await tx.crm_costos_oportunidad.findFirst({
        where: { reporte_id: reporte.id, oportunidad_id: id },
      });
      if (!costo?.precio_objetivo_litro)
        throw new BadRequestException(
          'Costos debe emitir el precio objetivo antes de cotizar',
        );
      const producto = await tx.productos_materiales.findUnique({
        where: { id_Produc_Mater: idValido(b.producto_id) },
      });
      if (!producto || producto.UM !== b.unidad)
        throw new BadRequestException('Producto o unidad incompatible');
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
        data: { estado: 'CANCELADA', token_respuesta_hash: null, token_respuesta_expira: null },
      });
      const c = await tx.crm_cotizaciones.create({
        data: {
          oportunidad_id: id,
          version: (last?.version ?? 0) + 1,
          folio: `COT-${randomUUID()}`,
          reporte_id: reporte.id,
          tipo_venta: b.tipo_venta,
          producto_id: producto.id_Produc_Mater,
          servicio: texto(b.servicio, 100),
          cantidad: decimalCrm(b.cantidad, 4),
          unidad: b.unidad,
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
          ...(b.estado === 'ENVIADA' ? {} : { token_respuesta_hash: null, token_respuesta_expira: null }),
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

  async enviarCotizacion(id: number, cid: number, b: any, u: Usuario) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const frontend = origenFrontend();
    const resultado = await this.prisma.$transaction(
      async (tx) => {
        const oportunidad = await bloquearOportunidad(tx, id, u);
        versionValida(oportunidad, b.version);
        await this.habilitada(tx, oportunidad);
        const cotizacion = await tx.crm_cotizaciones.findFirst({
          where: { id: cid, oportunidad_id: id },
          include: { producto: { select: { nombre_Producto: true } } },
        });
        if (!cotizacion) throw new NotFoundException('Cotización no encontrada.');
        if (!['BORRADOR', 'ENVIADA'].includes(cotizacion.estado))
          throw new ConflictException('Solo se puede enviar o reenviar por correo una cotización vigente.');
        const reenvio = cotizacion.estado === 'ENVIADA';
        if (
          cotizacion.vigencia_hasta &&
          cotizacion.vigencia_hasta.toISOString().slice(0, 10) <
            new Date().toISOString().slice(0, 10)
        )
          throw new BadRequestException('La cotización venció; crea una nueva versión.');

        const perfil = await tx.crm_perfiles_comerciales.findUnique({
          where: { persona_id: oportunidad.persona_id },
          select: { correo: true, nombre_contacto: true },
        });
        const destinatario = perfil?.correo?.trim();
        if (!destinatario)
          throw new BadRequestException('El cliente no tiene correo registrado en su perfil comercial.');

        const producto = cotizacion.producto.nombre_Producto;
        const vigencia = cotizacion.vigencia_hasta.toISOString().slice(0, 10);
        const precio = `${cotizacion.moneda} ${cotizacion.total.toFixed(2)}`;
        const cantidad = `${cotizacion.cantidad.toString()} ${cotizacion.unidad}`;
        const condiciones = cotizacion.condiciones_comerciales;
        const contacto = perfil?.nombre_contacto?.trim() || 'cliente';
        const respuesta = (accion: 'ACEPTAR' | 'RECHAZAR') => {
          const url = new URL('/cotizacion/respuesta', frontend);
          url.searchParams.set('token', token);
          url.searchParams.set('accion', accion);
          return url.toString();
        };
        const finVigencia = new Date(Date.UTC(
          cotizacion.vigencia_hasta.getUTCFullYear(),
          cotizacion.vigencia_hasta.getUTCMonth(),
          cotizacion.vigencia_hasta.getUTCDate(),
          23, 59, 59, 999,
        ));
        const html = `
          <div style="margin:0;background:#f1f5f9;padding:32px 12px;font-family:Arial,sans-serif;color:#0f172a">
            <div style="max-width:640px;margin:0 auto;overflow:hidden;border:1px solid #dbe4ee;border-radius:16px;background:#fff">
              <div style="background:#082f49;padding:24px 28px;color:#ecfeff">
                <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#67e8f9">US Technologies · Ventas</div>
                <h1 style="margin:8px 0 0;font-size:24px">Cotización ${escaparHtmlCorreo(cotizacion.folio)}</h1>
              </div>
              <div style="padding:28px">
                <p>Hola ${escaparHtmlCorreo(contacto)},</p>
                <p>Te compartimos la cotización preparada para tu solicitud.</p>
                <table style="width:100%;border-collapse:collapse;margin:20px 0">
                  <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#64748b">Producto</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:700">${escaparHtmlCorreo(producto)}</td></tr>
                  <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#64748b">Servicio</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${escaparHtmlCorreo(cotizacion.servicio)}</td></tr>
                  <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#64748b">Cantidad</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${escaparHtmlCorreo(cantidad)}</td></tr>
                  <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#64748b">Importe total</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:700">${escaparHtmlCorreo(precio)}</td></tr>
                  <tr><td style="padding:10px;color:#64748b">Vigencia</td><td style="padding:10px">${escaparHtmlCorreo(vigencia)}</td></tr>
                </table>
                <h2 style="margin:22px 0 8px;font-size:15px">Condiciones comerciales</h2>
                <div style="white-space:pre-line;border-radius:10px;background:#f8fafc;padding:14px;font-size:13px;line-height:1.6">${escaparHtmlCorreo(condiciones)}</div>
                <h2 style="margin:24px 0 10px;font-size:15px">Respuesta a la propuesta</h2>
                <p style="font-size:13px;color:#475569">Abre el enlace correspondiente y confirma tu respuesta en la página segura.</p>
                <p style="margin:18px 0"><a href="${escaparHtmlCorreo(respuesta('ACEPTAR'))}" style="display:inline-block;background:#047857;color:#fff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:700">Aceptar cotización</a> <a href="${escaparHtmlCorreo(respuesta('RECHAZAR'))}" style="display:inline-block;background:#475569;color:#fff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:700">Rechazar cotización</a></p>
                ${cotizacion.nombre_archivo ? '<p style="font-size:13px;color:#475569">El documento PDF de la cotización se adjunta a este correo.</p>' : '<p style="font-size:13px;color:#475569">Esta cotización se incluye en el cuerpo del correo; no tiene un archivo adjunto.</p>'}
                <p style="margin-top:22px;font-size:13px;color:#475569">Responde a este correo o contacta a tu vendedor para confirmar o comentar la propuesta.</p>
              </div>
              <div style="border-top:1px solid #e2e8f0;padding:16px 28px;color:#64748b;font-size:11px">US Technologies · Seguimiento de oportunidades</div>
            </div>
          </div>`;
        const texto = [
          `Hola ${contacto},`,
          '',
          `Cotización ${cotizacion.folio}`,
          `Producto: ${producto}`,
          `Servicio: ${cotizacion.servicio}`,
          `Cantidad: ${cantidad}`,
          `Importe total: ${precio}`,
          `Vigencia: ${vigencia}`,
          '',
          'Condiciones comerciales:',
          condiciones,
          '',
          cotizacion.nombre_archivo
            ? 'El documento de la cotización se adjunta a este correo.'
            : 'La cotización no tiene un archivo adjunto.',
          `Para aceptar, visita: ${respuesta('ACEPTAR')}`,
          `Para rechazar, visita: ${respuesta('RECHAZAR')}`,
          'El enlace abre una página que solicita confirmar la acción; no registra una respuesta al abrirlo.',
        ].join('\n');

        await this.correo.enviar({
          destinatario,
          asunto: `Cotización ${cotizacion.folio} · US Technologies`,
          texto,
          html,
          ...(cotizacion.contenido && cotizacion.nombre_archivo
            ? {
                adjuntos: [{
                  nombre: cotizacion.nombre_archivo,
                  mime: cotizacion.tipo_mime ?? 'application/pdf',
                  contenido: cotizacion.contenido,
                }],
              }
            : {}),
        });

        await tx.crm_cotizaciones.update({
          where: { id: cotizacion.id },
          data: { estado: 'ENVIADA', enviado_en: new Date(), token_respuesta_hash: tokenHash, token_respuesta_expira: finVigencia },
        });
        await eventoCrm(
          tx,
          oportunidad,
          u,
          'COTIZACION_ENVIADA',
          `Cotización ${cotizacion.folio} ${reenvio ? 'reenviada' : 'enviada'} por correo a ${destinatario}`,
          { etapa: 'SEGUIMIENTO_COTIZACION' },
        );
        return { destinatario, folio: cotizacion.folio, reenvio };
      },
      { maxWait: 5_000, timeout: 30_000 },
    );
    this.avisar(id);
    return {
      success: true,
      destinatario: resultado.destinatario,
      mensaje: `Cotización ${resultado.folio} ${resultado.reenvio ? 'reenviada' : 'enviada'} manualmente a ${resultado.destinatario}.`,
    };
  }
  async responderCotizacion(body: any) {
    const token = String(body?.token ?? '').trim();
    const accion = String(body?.accion ?? '').toUpperCase();
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token) || !['ACEPTAR', 'RECHAZAR'].includes(accion))
      throw new BadRequestException('Enlace de respuesta inválido.');
    const hash = createHash('sha256').update(token).digest('hex');
    const resultado = await this.prisma.$transaction(async (tx) => {
      // Use the same lock order as sales operations: opportunity first, then quote.
      // The first lookup is non-locking and only discovers which opportunity to lock.
      const referencia = await tx.crm_cotizaciones.findUnique({
        where: { token_respuesta_hash: hash },
        select: { id: true, oportunidad_id: true },
      });
      if (!referencia) throw new ConflictException('Este enlace ya fue utilizado o dejó de estar vigente.');
      await tx.$queryRaw`SELECT id FROM crm_oportunidades WHERE id=${referencia.oportunidad_id} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM crm_cotizaciones WHERE id=${referencia.id} AND token_respuesta_hash=${hash} FOR UPDATE`;
      const cotizacion = await tx.crm_cotizaciones.findUnique({ where: { token_respuesta_hash: hash } });
      if (!cotizacion || cotizacion.estado !== 'ENVIADA' || !cotizacion.token_respuesta_expira)
        throw new ConflictException('Este enlace ya fue utilizado o dejó de estar vigente.');
      if (cotizacion.token_respuesta_expira.getTime() < Date.now())
        throw new ConflictException('La vigencia de esta cotización terminó. Contacta a tu vendedor.');
      const oportunidad = await tx.crm_oportunidades.findUnique({ where: { id: cotizacion.oportunidad_id } });
      if (!oportunidad || cerradas.includes(oportunidad.etapa))
        throw new ConflictException('La oportunidad ya no está disponible para responder.');
      const estado = accion === 'ACEPTAR' ? 'ACEPTADA' : 'RECHAZADA';
      await tx.crm_cotizaciones.update({
        where: { id: cotizacion.id },
        data: {
          estado,
          ...(estado === 'ACEPTADA' ? { aceptado_en: new Date() } : { rechazado_en: new Date() }),
          token_respuesta_hash: null,
          token_respuesta_expira: null,
        },
      });
      const interno: Usuario = { usuario: 'RESPUESTA_CLIENTE', area: 'id', personaId: oportunidad.vendedor_id, expira: 0 };
      await eventoCrm(
        tx,
        oportunidad,
        interno,
        estado === 'ACEPTADA' ? 'COTIZACION_ACEPTADA' : 'COTIZACION_RECHAZADA',
        `El cliente ${estado === 'ACEPTADA' ? 'aceptó' : 'rechazó'} la cotización ${cotizacion.folio} desde el enlace de correo.`,
        { etapa: 'SEGUIMIENTO_COTIZACION' },
      );
      return { id: cotizacion.id, folio: cotizacion.folio, estado, oportunidad_id: oportunidad.id };
    });
    this.avisar(resultado.oportunidad_id);
    return { success: true, folio: resultado.folio, estado: resultado.estado };
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
      const perfil = await tx.crm_perfiles_comerciales.findUnique({
        where: { persona_id: o.persona_id },
      });
      if (perfil?.vendedor_responsable_id !== o.vendedor_id)
        throw new ConflictException(
          'La cuenta y la oportunidad deben pertenecer al mismo vendedor',
        );
      const productoOrden = await tx.productos_materiales.findUniqueOrThrow({
        where: { id_Produc_Mater: c.producto_id },
      });
      const especificaciones =
        b.especificaciones == null
          ? undefined
          : especificacionesValidas(
              b.especificaciones,
              productoOrden.configuracion_operativa,
              c.unidad,
              c.cantidad,
            );
      const orden = await tx.crm_ordenes_venta.create({
        data: {
          folio: `OV-${randomUUID()}`,
          especificaciones,
          oportunidad_id: id,
          cotizacion_id: c.id,
          persona_id: o.persona_id,
          vendedor_id: o.vendedor_id,
          producto_id: c.producto_id,
          tipo_venta: c.tipo_venta,
          servicio: c.servicio,
          orden_cliente: texto(b.orden_cliente, 100),
          cantidad: c.cantidad,
          unidad: c.unidad,
          moneda: c.moneda,
          subtotal: c.subtotal,
          impuestos: c.impuestos,
          importe_total: c.total,
          fecha_compromiso: fechaCrm(b.fecha_compromiso),
          observaciones: opc(b.observaciones),
          creado_por: u.usuario,
        },
      });
      const cliente = await tx.personas.findUniqueOrThrow({
        where: { id_Persona: orden.persona_id },
        select: { nombre: true },
      });
      const manifiesto = await tx.manifiestos.create({
        data: {
          orden_venta_id: orden.id,
          cliente_id: orden.persona_id,
          estado: 'PEDIDO',
          es_gkn: false,
          razon_social_generadora: cliente.nombre,
          numero_compra: orden.orden_cliente,
          ...(orden.unidad === 'Kilogramos' ? { peso_pedido: orden.cantidad } : {}),
          creado_por: u.usuario,
        },
      });
      await tx.manifiesto_eventos.create({
        data: {
          manifiesto_id: manifiesto.id,
          estado_nuevo: 'PEDIDO',
          accion: 'CREADO_DESDE_ORDEN_VENTA',
          actor_persona_id: u.personaId,
          actor_usuario: u.usuario,
          datos: { orden_venta_id: orden.id, folio_orden: orden.folio },
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
    this.eventos.notificar('MANIFIESTO_ACTUALIZADO', { ordenVentaId: data.id });
    return { success: true, data };
  }
  private async clasificarCompras<
    T extends {
      id: number;
      persona_id: number;
      estado: string;
      fecha_confirmacion: Date;
    },
  >(ordenes: T[]) {
    const primeras = await this.prisma.crm_ordenes_venta.findMany({
      where: {
        persona_id: { in: [...new Set(ordenes.map((o) => o.persona_id))] },
        estado: 'CONFIRMADA',
      },
      select: { id: true, persona_id: true },
      orderBy: [{ fecha_confirmacion: 'asc' }, { id: 'asc' }],
    });
    const ids = new Map<number, number>();
    for (const o of primeras)
      if (!ids.has(o.persona_id)) ids.set(o.persona_id, o.id);
    return ordenes.map((o) => ({
      ...o,
      tipo_compra:
        o.estado === 'CANCELADA'
          ? null
          : ids.get(o.persona_id) === o.id
            ? 'PRIMERA_COMPRA'
            : 'RECOMPRA',
    }));
  }
  async ordenes(u: Usuario) {
    const ordenes = await this.prisma.crm_ordenes_venta.findMany({
      where: this.scope(u),
      include: {
        cliente: { select: { nombre: true } },
        produccion_asignada: {
          select: {
            cantidad_producto_terminado: true,
            orden_produccion: {
              select: {
                id_Orden_Produc: true,
                no_Orden_Produc: true,
                producto_id: true,
                tipo_Operacion: true,
                linea_Produccion: true,
                cantidad_Planificada: true,
                unidad: true,
                estado_Plan: true,
                fecha_Inicio_Plan: true,
                fecha_Termino_Plan: true,
                fecha_Inicio_Produccion: true,
                fecha_Termino_Real: true,
                lotes_produccion: {
                  orderBy: { id_Lote_Produccion: 'asc' },
                  select: {
                    id_Lote_Produccion: true,
                    no_Lote: true,
                    estado: true,
                    fecha_inicio: true,
                    fecha_fin: true,
                    estado_Calida: true,
                    observaciones_Calidad: true,
                    tanque_id: true,
                    cantidad_Cargada: true,
                    muestras: {
                      orderBy: { id_Muestra: 'asc' },
                      select: {
                        id_Muestra: true,
                        no_Muestra: true,
                        categoria_Muestra: true,
                        estado_Muestra: true,
                        fecha_Toma: true,
                        fecha_ingreso_laboratorio: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        materiales_recibidos: {
          select: {
            id: true,
            folio: true,
            origen: true,
            condicion: true,
            unidad: true,
            recepcion: {
              select: {
                id: true,
                no_lote: true,
                fecha_llegada: true,
                fecha_Revision: true,
                reviso_nombre: true,
                estado_recepcion: true,
                estado_checklist: true,
                checklist_contenedor: {
                  orderBy: { no_consecutivo: 'asc' },
                  select: {
                    no_consecutivo: true,
                    numero_contenedor: true,
                    tapa_valvula: true,
                    rejilla_danada: true,
                    base_danada: true,
                    derrame: true,
                    observaciones: true,
                  },
                },
              },
            },
          },
        },
        entregas: {
          orderBy: { creado_en: 'asc' },
          select: {
            id_Entrega: true,
            folio: true,
            estado_entrega: true,
            destino: true,
            fecha_programada: true,
            fecha_Salida_Transporte: true,
            fecha_Entrega_Cliente: true,
            recibido_por: true,
            transportista_id: true,
            observaciones: true,
            detalles: {
              select: {
                id: true,
                cantidad: true,
                cantidad_recibida: true,
                observaciones: true,
                lote: {
                  select: {
                    id: true,
                    folio: true,
                    lote_produccion_id: true,
                  },
                },
              },
            },
            transportista: { select: { nombre: true } },
          },
        },
      },
      orderBy: { id: 'desc' },
    });
    const ordenesConProduccion = ordenes.map(
      ({ produccion_asignada, ...orden }) => ({
        ...orden,
        ordenes_produccion: produccion_asignada.map(
          (asignacion) => ({
            ...asignacion.orden_produccion,
            cantidad_producto_terminado:
              asignacion.cantidad_producto_terminado,
          }),
        ),
      }),
    );
    const clasificadas = await this.clasificarCompras(
      ordenesConProduccion.map((o) => ({
        ...o,
        cantidad_entregada: o.entregas
          .filter((e) => e.estado_entrega === 'ENTREGADA')
          .flatMap((e) => e.detalles)
          .reduce(
            (a, d) => a.add(d.cantidad_recibida ?? 0),
            new Prisma.Decimal(0),
          ),
      })),
    );
    return {
      success: true,
      data: clasificadas.map((orden) => ({
        ...orden,
        ...calcularCumplimientoOV(orden),
      })),
    };
  }
  async produccion(id: number, b: any, u: Usuario) {
    const data = await this.prisma.$transaction(async (tx) => {
      if (u.area === 'ventas') {
        const orden = await tx.crm_ordenes_venta.findFirst({
          where: { id, ...this.scope(u) },
          select: { id: true },
        });
        if (!orden) throw new NotFoundException('Orden no encontrada');
      }
      return crearOrdenProduccion(tx, b, u, id);
    });
    this.avisar();
    return { success: true, data };
  }
  async materiales(id: number, u: Usuario) {
    const ov = await this.prisma.crm_ordenes_venta.findFirst({
      where: { id, ...this.scope(u) },
    });
    if (!ov) throw new NotFoundException('Orden no encontrada');
    return { success: true, data: await existencias(this.prisma, ov) };
  }
  async cancelarOrden(id: number, b: any, u: Usuario) {
    await this.prisma.$transaction(async (tx) => {
      const previa = await tx.crm_ordenes_venta.findFirst({
        where: { id, ...this.scope(u) },
      });
      if (!previa) throw new NotFoundException('Orden no encontrada');
      if (previa.oportunidad_id == null)
        throw new NotFoundException(
          'La orden no tiene una oportunidad asociada',
        );
      const o = await bloquearOportunidad(tx, previa.oportunidad_id, u);
      await tx.$queryRaw`SELECT id FROM crm_ordenes_venta WHERE id=${id} FOR UPDATE`;
      const orden = await tx.crm_ordenes_venta.findUniqueOrThrow({
        where: { id },
        include: {
          produccion_asignada: {
            include: { orden_produccion: { select: { estado_Plan: true } } },
          },
          entregas: true,
          pagos: true,
          facturas: true,
        },
      });
      if (orden.estado === 'CANCELADA') return;
      if (
        orden.produccion_asignada.some(
          (x) => x.orden_produccion.estado_Plan !== 'CANCELADA',
        )
      )
        throw new ConflictException(
          'Cancela las órdenes de producción antes de cancelar la venta',
        );
      if (
        orden.entregas.some((e) => e.estado_entrega !== 'CANCELADA') ||
        orden.pagos.some((p) => p.estado !== 'ANULADO') ||
        orden.facturas.some((f) => f.estado !== 'CANCELADA')
      )
        throw new ConflictException(
          'Resuelve las entregas, pagos y facturas antes de cancelar la venta',
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
      if (orden.cotizacion_id == null)
        throw new NotFoundException('Cotización no encontrada');
      await tx.crm_cotizaciones.update({
        where: { id: orden.cotizacion_id },
        data: { estado: 'CANCELADA', token_respuesta_hash: null, token_respuesta_expira: null },
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
          estado: { notIn: ['CANCELADA'] },
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
