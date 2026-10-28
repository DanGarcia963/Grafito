import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, manifiestos } from '@prisma/client';
import { EventsGateway } from './events.gateway';
import { PrismaService } from './prisma.service';
import { Usuario } from './auth/auth.service';
import { escaparHtmlCorreo, logoCorreoHtml, MailjetService } from './correo/mailjet.service';
import {
  ChecklistManifiesto,
  checklistPendiente,
  pesoEnRango,
  pesoEsperado,
} from './manifiestos.logic';

type Archivo = Express.Multer.File;
const longitud = {
  no_Manifiesto: 100,
  razon_social_generadora: 200,
  nombre_residuo: 200,
  transportista: 200,
  transportista_autorizacion: 100,
  transportista_placas: 40,
  transportista_registro_sct: 80,
  destino_autorizacion: 100,
  destino_razon_social: 200,
  linea_Produccion: 80,
  numero_compra: 100,
} as const;
type CampoDatos = keyof typeof longitud;

@Injectable()
export class ManifiestosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventsGateway,
    private readonly correo: MailjetService,
  ) {}

  private texto(value: unknown, max: number, field: string, required = false) {
    if (value == null || String(value).trim() === '') {
      if (required) throw new BadRequestException(`${field} es obligatorio.`);
      return null;
    }
    const valueText = String(value).trim();
    if (valueText.length > max)
      throw new BadRequestException(`${field} no puede exceder ${max} caracteres.`);
    return valueText;
  }

  private entero(value: unknown, field: string, required = false): number | null {
    if (value == null || value === '') {
      if (required) throw new BadRequestException(`${field} es obligatorio.`);
      return null;
    }
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n <= 0)
      throw new BadRequestException(`${field} no es válido.`);
    return n;
  }

  private decimal(value: unknown, field: string, required = true) {
    if (value == null || value === '') {
      if (required) throw new BadRequestException(`${field} es obligatorio.`);
      return null;
    }
    try {
      const n = new Prisma.Decimal(String(value));
      if (!n.isFinite() || n.lte(0)) throw new Error();
      return n;
    } catch {
      throw new BadRequestException(`${field} debe ser un número mayor a cero.`);
    }
  }

  private fecha(value: unknown, field: string) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new BadRequestException(`${field} debe ser una fecha válida.`);
    const result = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(result.getTime()) || result.toISOString().slice(0, 10) !== value)
      throw new BadRequestException(`${field} debe ser una fecha válida.`);
    return result;
  }

  private datos(body: Record<string, unknown>) {
    const result: Partial<Record<CampoDatos, string | null>> = {};
    for (const key of Object.keys(longitud) as CampoDatos[]) {
      if (Object.hasOwn(body, key))
        result[key] = this.texto(body[key], longitud[key], key);
    }
    return result;
  }

  private validarCamposCompletos(
    values: Partial<Record<CampoDatos, string | null>>,
    esGkn: boolean,
  ) {
    const required: [string | null | undefined, string][] = [
      [values.razon_social_generadora, 'Razón social de la empresa generadora'],
      [values.nombre_residuo, 'Nombre del residuo'],
      [values.destino_autorizacion, 'Autorización SEMARNAT del destino final'],
      [values.destino_razon_social, 'Razón social del destino final'],
      [values.linea_Produccion, 'Línea de producción'],
      ...(!esGkn
        ? ([
            [values.transportista, 'Transportista'],
            [values.transportista_autorizacion, 'Autorización del transportista'],
            [values.transportista_placas, 'Placas del transporte'],
            [values.transportista_registro_sct, 'Número de registro SCT'],
          ] as [string | null | undefined, string][])
        : []),
    ];
    const missing = required.filter(([value]) => !value).map(([, label]) => label);
    if (missing.length)
      throw new BadRequestException(`Completa los datos obligatorios: ${missing.join(', ')}.`);
  }

  private async obtener(tx: Prisma.TransactionClient, id: number) {
    const item = await tx.manifiestos.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Manifiesto no encontrado.');
    return item;
  }

  private async auditar(
    tx: Prisma.TransactionClient,
    item: Pick<manifiestos, 'id' | 'estado'>,
    anterior: string | null,
    accion: string,
    user: Usuario,
    datos?: Prisma.InputJsonObject,
  ) {
    await tx.manifiesto_eventos.create({
      data: {
        manifiesto_id: item.id,
        estado_anterior: anterior,
        estado_nuevo: item.estado,
        accion,
        actor_persona_id: user.personaId,
        actor_usuario: user.usuario,
        ...(datos ? { datos } : {}),
      },
    });
  }

  private notificar(id: number) {
    this.eventos.notificar('MANIFIESTO_ACTUALIZADO', { id });
  }

  async listar(user: Usuario) {
    const data = await this.prisma.manifiestos.findMany({
      omit: {
        documento_llegada_contenido: true,
        documento_manifiesto_contenido: true,
      },
      include: {
        orden_venta: {
          select: {
            id: true,
            folio: true,
            cantidad: true,
            unidad: true,
            orden_cliente: true,
            estado: true,
            tipo_venta: true,
            cliente: {
              select: {
                id_Persona: true,
                nombre: true,
                crm_perfil_comercial: { select: { correo: true } },
              },
            },
            producto: { select: { nombre_Producto: true } },
            materiales_recibidos: { select: { id: true } },
          },
        },
        cliente: {
          select: {
            id_Persona: true,
            nombre: true,
            crm_perfil_comercial: { select: { correo: true } },
          },
        },
        operador: { select: { id_Persona: true, nombre: true } },
        firmado_por: { select: { id_Persona: true, nombre: true } },
        resguardado_por: { select: { id_Persona: true, nombre: true } },
        eventos: {
          orderBy: { creado_en: 'desc' },
          take: 30,
          include: { actor: { select: { nombre: true } } },
        },
      },
      orderBy: [{ actualizado_en: 'desc' }, { id: 'desc' }],
    });
    if (user.area === 'seguridad') return { success: true, data };
    const ocultarCorreo = (persona: any) => persona
      ? {
          ...persona,
          crm_perfil_comercial: persona.crm_perfil_comercial
            ? { ...persona.crm_perfil_comercial, correo: null }
            : null,
        }
      : persona;
    return {
      success: true,
      data: data.map((manifest) => ({
        ...manifest,
        cliente: ocultarCorreo(manifest.cliente),
        orden_venta: manifest.orden_venta
          ? { ...manifest.orden_venta, cliente: ocultarCorreo(manifest.orden_venta.cliente) }
          : null,
      })),
    };
  }

  async catalogos(user: Usuario) {
    const [operadores, ordenes, clientes] = await Promise.all([
      this.prisma.personas.findMany({
        where: { estatus: 'ACTIVO' },
        select: { id_Persona: true, nombre: true, tipo_persona: true },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.crm_ordenes_venta.findMany({
        where: { estado: 'CONFIRMADA' },
        select: {
          id: true,
          folio: true,
          cantidad: true,
          unidad: true,
          orden_cliente: true,
          cliente: {
            select: {
              id_Persona: true,
              nombre: true,
              crm_perfil_comercial: { select: { correo: true } },
            },
          },
          producto: { select: { nombre_Producto: true } },
        },
        orderBy: { fecha_confirmacion: 'desc' },
        take: 200,
      }),
      this.prisma.personas.findMany({
        where: {
          estatus: 'ACTIVO',
          tipo_persona: { in: ['CLIENTE', 'PROSPECTO'], mode: 'insensitive' },
          crm_perfil_comercial: { isNot: null },
        },
        select: {
          id_Persona: true,
          nombre: true,
          crm_perfil_comercial: { select: { correo: true } },
        },
        orderBy: { nombre: 'asc' },
        take: 500,
      }),
    ]);
    return {
      success: true,
      operadores,
      ordenes: user.area === 'seguridad'
        ? ordenes
        : ordenes.map((order) => ({
            ...order,
            cliente: {
              ...order.cliente,
              crm_perfil_comercial: order.cliente.crm_perfil_comercial
                ? { ...order.cliente.crm_perfil_comercial, correo: null }
                : null,
            },
          })),
      clientes: user.area === 'seguridad' ? clientes : [],
    };
  }

  async crear(body: Record<string, unknown>, user: Usuario) {
    const ordenId = this.entero(body.orden_venta_id, 'Orden de venta');
    const clienteId = this.entero(body.cliente_id, 'Cliente');
    const esGkn = body.es_gkn === true || body.es_gkn === 'true';
    if (!ordenId && !esGkn)
      throw new BadRequestException('Un manifiesto sin orden de venta debe identificarse como GKN.');
    const values = this.datos(body);
    const item = await this.prisma.$transaction(async (tx) => {
      if (ordenId)
        await tx.$queryRaw`SELECT id FROM crm_ordenes_venta WHERE id = ${ordenId} FOR UPDATE`;
      const orden = ordenId
        ? await tx.crm_ordenes_venta.findFirst({
            where: { id: ordenId, estado: 'CONFIRMADA' },
            include: { cliente: { select: { id_Persona: true, nombre: true } } },
          })
        : null;
      if (ordenId && !orden) throw new NotFoundException('Orden de venta no disponible.');
      if (orden && clienteId && clienteId !== orden.persona_id)
        throw new BadRequestException('El cliente debe coincidir con la orden de venta.');
      if (!orden && clienteId) {
        const cliente = await tx.personas.findFirst({
          where: { id_Persona: clienteId, estatus: 'ACTIVO' },
          select: { id_Persona: true },
        });
        if (!cliente) throw new NotFoundException('Cliente no encontrado o inactivo.');
      }
      const existente = orden
        ? await tx.manifiestos.findFirst({ where: { orden_venta_id: orden.id } })
        : null;
      if (existente && existente.estado !== 'PEDIDO')
        throw new ConflictException('La orden de venta ya tiene un manifiesto en proceso.');
      const data: Prisma.manifiestosUncheckedCreateInput = {
        estado: 'RECOLECCION',
        es_gkn: esGkn,
        ...(orden ? { orden_venta_id: orden.id, cliente_id: orden.persona_id } : {}),
        ...(!orden && clienteId ? { cliente_id: clienteId } : {}),
        razon_social_generadora:
          values.razon_social_generadora ?? orden?.cliente.nombre ?? null,
        nombre_residuo: values.nombre_residuo ?? null,
        numero_compra: values.numero_compra ?? orden?.orden_cliente ?? null,
        peso_pedido: this.decimal(body.peso_pedido, 'Peso del pedido', false),
        creado_por: user.usuario,
      };
      const created = existente
        ? await tx.manifiestos.update({ where: { id: existente.id }, data })
        : await tx.manifiestos.create({ data });
      await this.auditar(tx, created, existente?.estado ?? null, 'CREADO_PARA_RECOLECCION', user, {
        es_gkn: esGkn,
        orden_venta_id: orden?.id ?? null,
      });
      return created;
    });
    this.notificar(item.id);
    return { success: true, data: item, mensaje: 'Solicitud creada y asignada a Recolección.' };
  }

  async crearCompleto(
    body: Record<string, unknown>,
    archivos: { documento_manifiesto?: Archivo[]; documento_llegada?: Archivo[] },
    user: Usuario,
  ) {
    const ordenId = this.entero(body.orden_venta_id, 'Orden de venta');
    const clienteId = this.entero(body.cliente_id, 'Cliente');
    const operadorId = this.entero(body.operador_id, 'Operador', true)!;
    const numero = this.texto(body.no_Manifiesto, longitud.no_Manifiesto, 'No. manifiesto', true)!;
    const fecha = this.fecha(body.fecha_Expedicion, 'Fecha de expedición');
    const pesoLlegada = this.decimal(body.peso_llegada, 'Peso de llegada')!;
    const pesoPedidoIngresado = this.decimal(body.peso_pedido, 'Peso del pedido', false);
    const esGkn = body.es_gkn === true || body.es_gkn === 'true';
    const values = this.datos(body);
    const documento = archivos.documento_manifiesto?.[0];
    const llegada = archivos.documento_llegada?.[0];
    this.validarPdf(documento);
    this.validarPdf(llegada);
    this.validarCamposCompletos(values, esGkn);
    if (!ordenId && !esGkn)
      throw new BadRequestException('Un manifiesto completo sin orden de venta debe identificarse como GKN.');
    if (!ordenId && !clienteId)
      throw new BadRequestException('Selecciona el cliente registrado para poder enviarle el manifiesto después.');

    const item = await this.prisma.$transaction(async (tx) => {
      if (ordenId)
        await tx.$queryRaw`SELECT id FROM crm_ordenes_venta WHERE id = ${ordenId} FOR UPDATE`;
      const orden = ordenId
        ? await tx.crm_ordenes_venta.findFirst({
            where: { id: ordenId, estado: 'CONFIRMADA' },
            include: { cliente: { select: { id_Persona: true, nombre: true } } },
          })
        : null;
      if (ordenId && !orden) throw new NotFoundException('Orden de venta no disponible.');
      if (orden && clienteId && clienteId !== orden.persona_id)
        throw new BadRequestException('El cliente debe coincidir con la orden de venta.');
      const clienteFinal = orden?.persona_id ?? clienteId!;
      const cliente = await tx.personas.findFirst({
        where: { id_Persona: clienteFinal, estatus: 'ACTIVO' },
        select: { id_Persona: true },
      });
      if (!cliente) throw new NotFoundException('Cliente no encontrado o inactivo.');
      const operador = await tx.personas.findFirst({
        where: { id_Persona: operadorId, estatus: 'ACTIVO' },
        select: { id_Persona: true },
      });
      if (!operador) throw new NotFoundException('Operador no encontrado o inactivo.');

      const existente = orden
        ? await tx.manifiestos.findFirst({ where: { orden_venta_id: orden.id } })
        : null;
      if (existente && existente.estado !== 'PEDIDO')
        throw new ConflictException('La orden de venta ya tiene un manifiesto en proceso.');
      const duplicado = await tx.manifiestos.findFirst({
        where: {
          no_Manifiesto: { equals: numero, mode: 'insensitive' },
          ...(existente ? { id: { not: existente.id } } : {}),
        },
        select: { id: true },
      });
      if (duplicado) throw new ConflictException('El número de manifiesto ya está asignado.');

      const esperado = pesoEsperado(
        pesoPedidoIngresado,
        orden ? { cantidad: orden.cantidad, unidad: orden.unidad } : null,
      );
      if (esperado && !pesoEnRango(esperado, pesoLlegada))
        throw new BadRequestException('El peso de llegada difiere más de 500 kg del peso del pedido. Usa el flujo de pesaje para revisarlo.');

      const data: Prisma.manifiestosUncheckedCreateInput = {
        fecha_Expedicion: fecha,
        estado: 'VERIFICAR_DATOS',
        ...(orden ? { orden_venta_id: orden.id } : {}),
        cliente_id: clienteFinal,
        operador_id: operadorId,
        es_gkn: esGkn,
        ...values,
        no_Manifiesto: numero,
        numero_compra: values.numero_compra ?? orden?.orden_cliente ?? null,
        peso_pedido: esperado,
        peso_llegada: pesoLlegada,
        fecha_recepcion_almacen: new Date(),
        ...(documento ? {
          documento_manifiesto_nombre: this.nombreArchivo(documento.originalname),
          documento_manifiesto_mime: 'application/pdf',
          documento_manifiesto_contenido: new Uint8Array(documento.buffer),
        } : {}),
        ...(llegada ? {
          documento_llegada_nombre: this.nombreArchivo(llegada.originalname),
          documento_llegada_mime: 'application/pdf',
          documento_llegada_contenido: new Uint8Array(llegada.buffer),
        } : {}),
        creado_por: user.usuario,
      };
      const created = existente
        ? await tx.manifiestos.update({ where: { id: existente.id }, data })
        : await tx.manifiestos.create({ data });
      await this.auditar(tx, created, existente?.estado ?? null, 'REGISTRO_COMPLETO_POR_SHYMA', user, {
        orden_venta_id: orden?.id ?? null,
        documento_manifiesto: Boolean(documento),
        documento_llegada: Boolean(llegada),
      });
      return created;
    });
    this.notificar(item.id);
    return { success: true, data: item, mensaje: 'Manifiesto completo registrado; quedó pendiente la validación del checklist SHyMA.' };
  }

  async asignar(id: number, body: Record<string, unknown>, user: Usuario) {
    const numero = this.texto(body.no_Manifiesto, longitud.no_Manifiesto, 'No. manifiesto', true)!;
    const fecha = this.fecha(body.fecha_Expedicion, 'Fecha de expedición');
    const operadorId = this.entero(body.operador_id, 'Operador', true)!;
    const values = this.datos(body);
    const item = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM manifiestos WHERE id = ${id} FOR UPDATE`;
      const current = await this.obtener(tx, id);
      this.exigirEstado(current, 'PEDIDO');
      const [operador, duplicate] = await Promise.all([
        tx.personas.findFirst({ where: { id_Persona: operadorId, estatus: 'ACTIVO' }, select: { id_Persona: true } }),
        tx.manifiestos.findFirst({ where: { no_Manifiesto: { equals: numero, mode: 'insensitive' }, id: { not: id } }, select: { id: true } }),
      ]);
      if (!operador) throw new NotFoundException('Operador no encontrado o inactivo.');
      if (duplicate) throw new ConflictException('El número de manifiesto ya está asignado.');
      const updated = await tx.manifiestos.update({
        where: { id },
        data: {
          no_Manifiesto: numero,
          fecha_Expedicion: fecha,
          operador_id: operadorId,
          ...values,
          estado: 'RECOLECCION',
          motivo_correccion: null,
        },
      });
      await this.auditar(tx, updated, current.estado, 'NUMERO_ASIGNADO', user, { no_Manifiesto: numero });
      return updated;
    });
    this.notificar(id);
    return { success: true, data: item };
  }

  async recibir(id: number, user: Usuario) {
    const item = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM manifiestos WHERE id = ${id} FOR UPDATE`;
      const current = await this.obtener(tx, id);
      this.exigirEstado(current, 'RECOLECCION');
      const updated = await tx.manifiestos.update({
        where: { id },
        data: { estado: 'PESAJE', fecha_recepcion_almacen: new Date() },
      });
      await this.auditar(tx, updated, current.estado, 'RECEPCION_ALMACEN', user);
      return updated;
    });
    this.notificar(id);
    return { success: true, data: item };
  }

  async pesar(id: number, body: Record<string, unknown>, file: Archivo | undefined, user: Usuario) {
    const peso = this.decimal(body.peso_llegada, 'Peso de llegada')!;
    this.validarPdf(file);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM manifiestos WHERE id = ${id} FOR UPDATE`;
      const current = await this.obtener(tx, id);
      this.exigirEstado(current, 'PESAJE');
      const orden = current.orden_venta_id
        ? await tx.crm_ordenes_venta.findUnique({
            where: { id: current.orden_venta_id },
            select: { cantidad: true, unidad: true },
          })
        : null;
      const esperado = pesoEsperado(current.peso_pedido, orden);
      const enRango = esperado ? pesoEnRango(esperado, peso) : true;
      const updated = await tx.manifiestos.update({
        where: { id },
        data: {
          peso_llegada: peso,
          ...(file ? {
            documento_llegada_nombre: this.nombreArchivo(file.originalname),
            documento_llegada_mime: 'application/pdf',
            documento_llegada_contenido: new Uint8Array(file.buffer),
          } : {}),
          ...(enRango ? { estado: 'VERIFICAR_DATOS', motivo_correccion: null } : {}),
        },
      });
      await this.auditar(tx, updated, current.estado, enRango ? 'PESAJE_REGISTRADO' : 'PESAJE_FUERA_DE_RANGO', user, {
        peso_llegada: peso.toString(),
        peso_pedido: esperado?.toString() ?? null,
        tolerancia_kg: 500,
      });
      return { item: updated, enRango, esperado: esperado?.toString() ?? null };
    });
    this.notificar(id);
    return {
      success: true,
      data: result.item,
      en_rango: result.enRango,
      peso_pedido: result.esperado,
      mensaje: result.enRango
        ? 'Pesaje registrado. El manifiesto pasó a verificación de datos.'
        : 'El peso se guardó, pero la diferencia supera 500 kg. Corrige la captura o revisa la cantidad del pedido antes de continuar.',
    };
  }

  async verificar(id: number, body: Record<string, unknown>, user: Usuario) {
    const raw = (body.checklist && typeof body.checklist === 'object' ? body.checklist : {}) as Record<string, unknown>;
    const validKeys = new Set([
      'razonSocial', 'nombreResiduo', 'gknVerificado', 'transportistaAutorizacion',
      'transportistaPlacas', 'transportistaRegistroSct', 'destinoAutorizacion',
      'destinoRazonSocial', 'pesoDentroRango', 'lineaProduccion', 'certificadoTrazable',
      'numeroCompra', 'registroBitacora',
    ]);
    const checklist: ChecklistManifiesto = Object.fromEntries(
      Object.entries(raw).filter(([key, value]) => validKeys.has(key) && typeof value === 'boolean'),
    ) as ChecklistManifiesto;
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM manifiestos WHERE id = ${id} FOR UPDATE`;
      const current = await this.obtener(tx, id);
      this.exigirEstado(current, 'VERIFICAR_DATOS');
      const orden = current.orden_venta_id
        ? await tx.crm_ordenes_venta.findUnique({
            where: { id: current.orden_venta_id },
            select: {
              cantidad: true,
              unidad: true,
              orden_cliente: true,
              materiales_recibidos: { select: { id: true }, take: 1 },
            },
          })
        : null;
      const esperado = pesoEsperado(current.peso_pedido, orden);
      const enRango = !esperado || (current.peso_llegada != null && pesoEnRango(esperado, current.peso_llegada));
      if (esperado) checklist.pesoDentroRango = enRango;
      const faltantes = checklistPendiente(checklist, {
        esGkn: current.es_gkn,
        tieneOrdenVenta: current.orden_venta_id != null,
        tienePesoEsperado: esperado != null,
      });
      const datosObligatorios: [string | null, string][] = [
        [current.razon_social_generadora, 'Razón social de la empresa generadora'],
        [current.nombre_residuo, 'Nombre del residuo'],
        [current.destino_autorizacion, 'Autorización SEMARNAT del destino final'],
        [current.destino_razon_social, 'Razón social del destino final'],
        [current.linea_Produccion, 'Línea de producción'],
        ...(!current.es_gkn ? [
          [current.transportista, 'Transportista'],
          [current.transportista_autorizacion, 'Autorización SEMARNAT del transportista'],
          [current.transportista_placas, 'Placas del transporte'],
          [current.transportista_registro_sct, 'Número de registro SCT'],
        ] as [string | null, string][] : []),
      ];
      for (const [value, label] of datosObligatorios)
        if (!value) faltantes.push(`${label}: falta capturar el dato.`);
      if (current.orden_venta_id && !orden?.materiales_recibidos.length)
        throw new BadRequestException('El inventario de esta OV todavía no está relacionado. Almacén debe registrar o vincular la recepción para que SHyMA pueda validar la trazabilidad.');
      if (current.orden_venta_id && !current.numero_compra && !orden?.orden_cliente)
        faltantes.push('Número de compra de la venta: falta capturar el dato.');
      const next = faltantes.length ? 'CORRECCION_DATOS' : 'CONTADURIA';
      const updated = await tx.manifiestos.update({
        where: { id },
        data: {
          checklist: checklist as Prisma.InputJsonObject,
          estado: next,
          motivo_correccion: faltantes.length ? faltantes.join('\n') : null,
        },
      });
      await this.auditar(tx, updated, current.estado, faltantes.length ? 'CHECKLIST_REQUIERE_CORRECCION' : 'CHECKLIST_VALIDADO', user, {
        faltantes,
      });
      return { item: updated, faltantes };
    });
    this.notificar(id);
    return {
      success: true,
      data: result.item,
      faltantes: result.faltantes,
      mensaje: result.faltantes.length
        ? 'Se encontraron datos pendientes; el manifiesto pasó a Corrección de datos.'
        : 'Checklist validado; el manifiesto pasó a Contaduría.',
    };
  }

  async corregir(id: number, body: Record<string, unknown>, user: Usuario) {
    const values = this.datos(body);
    const destino = String(body.destino ?? 'VERIFICAR_DATOS');
    if (!['VERIFICAR_DATOS', 'CONTADURIA'].includes(destino))
      throw new BadRequestException('El destino debe ser validación SHyMA o Contaduría.');
    const item = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM manifiestos WHERE id = ${id} FOR UPDATE`;
      const current = await this.obtener(tx, id);
      this.exigirEstado(current, 'CORRECCION_DATOS');
      const esGkn = Object.hasOwn(body, 'es_gkn')
        ? body.es_gkn === true || body.es_gkn === 'true'
        : current.es_gkn;
      if (!current.orden_venta_id && !esGkn)
        throw new BadRequestException('Un manifiesto sin OV debe conservar la clasificación GKN.');
      const merged = { ...current, ...values, es_gkn: esGkn };
      const required: [string | null, string][] = [
        [merged.razon_social_generadora, 'Razón social de la empresa generadora'],
        [merged.nombre_residuo, 'Nombre del residuo'],
        [merged.destino_autorizacion, 'Autorización del destino final'],
        [merged.destino_razon_social, 'Razón social del destino final'],
        [merged.linea_Produccion, 'Línea de producción'],
        ...(!merged.es_gkn ? [
          [merged.transportista, 'Transportista'],
          [merged.transportista_autorizacion, 'Autorización del transportista'],
          [merged.transportista_placas, 'Placas del transporte'],
          [merged.transportista_registro_sct, 'Registro SCT'],
        ] as [string | null, string][] : []),
      ];
      const faltantes = required.filter(([value]) => !value).map(([, label]) => label);
      if (faltantes.length)
        throw new BadRequestException(`Completa los datos antes de enviar el manifiesto: ${faltantes.join(', ')}.`);

      if (destino === 'CONTADURIA') {
        const checklistActual = current.checklist && typeof current.checklist === 'object' && !Array.isArray(current.checklist)
          ? current.checklist as ChecklistManifiesto
          : {};
        const orden = current.orden_venta_id
          ? await tx.crm_ordenes_venta.findUnique({
              where: { id: current.orden_venta_id },
              select: {
                cantidad: true,
                unidad: true,
                orden_cliente: true,
                materiales_recibidos: { select: { id: true }, take: 1 },
              },
            })
          : null;
        const esperado = pesoEsperado(current.peso_pedido, orden);
        const dentroDelRango = !esperado || (
          current.peso_llegada != null && pesoEnRango(esperado, current.peso_llegada)
        );
        const pendientes: string[] = [];
        if (checklistActual.gknVerificado !== true)
          pendientes.push('SHyMA debe confirmar la clasificación GKN del manifiesto.');
        if (checklistActual.registroBitacora !== true)
          pendientes.push('SHyMA debe confirmar el registro en la bitácora de residuos.');
        if (current.orden_venta_id && !orden?.materiales_recibidos.length)
          pendientes.push('La OV debe quedar relacionada con el inventario recibido.');
        if (!dentroDelRango)
          pendientes.push('El peso de llegada debe estar dentro de ±500 kg del peso pedido.');
        const checklistCorregido: ChecklistManifiesto = {
          ...checklistActual,
          razonSocial: Boolean(merged.razon_social_generadora),
          nombreResiduo: Boolean(merged.nombre_residuo),
          destinoAutorizacion: Boolean(merged.destino_autorizacion),
          destinoRazonSocial: Boolean(merged.destino_razon_social),
          lineaProduccion: Boolean(merged.linea_Produccion),
          ...(esGkn ? {} : {
            transportistaAutorizacion: Boolean(merged.transportista_autorizacion),
            transportistaPlacas: Boolean(merged.transportista_placas),
            transportistaRegistroSct: Boolean(merged.transportista_registro_sct),
          }),
          ...(current.orden_venta_id ? {
            certificadoTrazable: Boolean(orden?.materiales_recibidos.length),
            numeroCompra: Boolean(merged.numero_compra ?? orden?.orden_cliente),
          } : {}),
          ...(esperado ? { pesoDentroRango: dentroDelRango } : {}),
        };
        pendientes.push(...checklistPendiente(checklistCorregido, {
          esGkn,
          tieneOrdenVenta: current.orden_venta_id != null,
          tienePesoEsperado: esperado != null,
        }));
        if (pendientes.length)
          throw new BadRequestException(`No se puede enviar a Contaduría hasta que SHyMA valide: ${pendientes.join('; ')}.`);

        const updated = await tx.manifiestos.update({
          where: { id },
          data: {
            ...values,
            ...(esGkn ? {
              transportista: null,
              transportista_autorizacion: null,
              transportista_placas: null,
              transportista_registro_sct: null,
            } : {}),
            es_gkn: esGkn,
            checklist: checklistCorregido as Prisma.InputJsonObject,
            estado: 'CONTADURIA',
            motivo_correccion: null,
          },
        });
        await this.auditar(tx, updated, current.estado, 'DATOS_CORREGIDOS_A_CONTADURIA', user, {
          destino,
          validaciones_actualizadas: true,
        });
        return updated;
      }

      const updated = await tx.manifiestos.update({
        where: { id },
        data: {
          ...values,
          ...(esGkn ? {
            transportista: null,
            transportista_autorizacion: null,
            transportista_placas: null,
            transportista_registro_sct: null,
          } : {}),
          es_gkn: esGkn,
          estado: 'VERIFICAR_DATOS',
          motivo_correccion: null,
        },
      });
      await this.auditar(
        tx,
        updated,
        current.estado,
        'DATOS_CORREGIDOS',
        user,
        { destino },
      );
      return updated;
    });
    this.notificar(id);
    return {
      success: true,
      data: item,
      mensaje: item.estado === 'CONTADURIA'
        ? 'Datos corregidos; el manifiesto pasó a Contaduría.'
        : 'Datos corregidos; el manifiesto volvió a validación SHyMA.',
    };
  }

  async firmar(id: number, user: Usuario) {
    const item = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM manifiestos WHERE id = ${id} FOR UPDATE`;
      const current = await this.obtener(tx, id);
      this.exigirEstado(current, 'CONTADURIA');
      const updated = await tx.manifiestos.update({
        where: { id },
        data: { estado: 'RESGUARDO', firmado_por_persona_id: user.personaId, firmado_en: new Date() },
      });
      await this.auditar(tx, updated, current.estado, 'FIRMA_CONTADURIA', user);
      return updated;
    });
    this.notificar(id);
    return { success: true, data: item };
  }

  async resguardar(id: number, file: Archivo | undefined, user: Usuario) {
    this.validarPdf(file);
    const item = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM manifiestos WHERE id = ${id} FOR UPDATE`;
      const current = await this.obtener(tx, id);
      this.exigirEstado(current, 'RESGUARDO');
      if (!file && !current.documento_manifiesto_contenido)
        throw new BadRequestException('Adjunta el documento PDF final del manifiesto.');
      const updated = await tx.manifiestos.update({
        where: { id },
        data: {
          ...(file ? {
            documento_manifiesto_nombre: this.nombreArchivo(file.originalname),
            documento_manifiesto_mime: 'application/pdf',
            documento_manifiesto_contenido: new Uint8Array(file.buffer),
          } : {}),
          resguardado_por_persona_id: user.personaId,
          resguardado_en: new Date(),
        },
      });
      await this.auditar(tx, updated, current.estado, 'DOCUMENTO_RESGUARDADO', user, {
        nombre: updated.documento_manifiesto_nombre!,
      });
      return updated;
    });
    this.notificar(id);
    return { success: true, data: item };
  }

  async enviarCorreo(id: number, user: Usuario) {
    const item = await this.prisma.manifiestos.findUnique({
      where: { id },
      include: {
        cliente: {
          select: {
            id_Persona: true,
            nombre: true,
            crm_perfil_comercial: { select: { correo: true } },
          },
        },
        orden_venta: {
          select: {
            folio: true,
            orden_cliente: true,
            cliente: {
              select: {
                id_Persona: true,
                nombre: true,
                crm_perfil_comercial: { select: { correo: true } },
              },
            },
          },
        },
      },
    });
    if (!item) throw new NotFoundException('Manifiesto no encontrado.');
    if (item.estado !== 'RESGUARDO' || !item.resguardado_en || !item.documento_manifiesto_contenido)
      throw new ConflictException('El PDF debe estar resguardado antes de enviarlo al cliente.');
    const cliente = item.cliente ?? item.orden_venta?.cliente;
    const destinatario = cliente?.crm_perfil_comercial?.correo?.trim();
    if (!cliente || !destinatario)
      throw new BadRequestException('El cliente no tiene correo registrado en su perfil comercial.');

    const folio = item.no_Manifiesto ?? `Manifiesto #${item.id}`;
    const orden = item.orden_venta?.folio ?? 'Recepción independiente';
    const peso = item.peso_llegada ? `${item.peso_llegada.toString()} kg` : 'No registrado';
    const nombre = escaparHtmlCorreo(cliente.nombre);
    const documento = item.documento_manifiesto_nombre ?? `Manifiesto-${item.id}.pdf`;
    const html = `
      <div style="margin:0;background:#f1f5f9;padding:32px 12px;font-family:Arial,sans-serif;color:#0f172a">
        <div style="max-width:640px;margin:0 auto;overflow:hidden;border:1px solid #dbe4ee;border-radius:16px;background:#fff">
          <div style="background:#082f49;padding:24px 28px;color:#ecfeff">
            <div style="margin-bottom:14px">${logoCorreoHtml()}</div>
            <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#67e8f9">US Technologies · SHyMA</div>
            <h1 style="margin:8px 0 0;font-size:24px">Manifiesto resguardado</h1>
          </div>
          <div style="padding:28px">
            <p>Hola ${nombre},</p>
            <p>Adjuntamos el manifiesto final correspondiente a la recepción de su material.</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0">
              <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#64748b">No. de manifiesto</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:700">${escaparHtmlCorreo(folio)}</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#64748b">Orden de venta</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${escaparHtmlCorreo(orden)}</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#64748b">Residuo</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${escaparHtmlCorreo(item.nombre_residuo ?? '—')}</td></tr>
              <tr><td style="padding:10px;color:#64748b">Peso de llegada</td><td style="padding:10px">${escaparHtmlCorreo(peso)}</td></tr>
            </table>
            <p style="font-size:13px;color:#475569">Este correo fue enviado manualmente desde el módulo de Manifiestos. El documento se adjunta en formato PDF.</p>
          </div>
          <div style="border-top:1px solid #e2e8f0;padding:16px 28px;color:#64748b;font-size:11px">US Technologies · Seguimiento y resguardo de manifiestos</div>
        </div>
      </div>`;
    await this.correo.enviar({
      destinatario,
      asunto: `Manifiesto ${folio} · US Technologies`,
      texto: `Hola ${cliente.nombre},\n\nAdjuntamos el manifiesto ${folio} correspondiente a ${item.nombre_residuo ?? 'la recepción de su material'}. Peso de llegada: ${peso}.\nOrden de venta: ${orden}.`,
      html,
      adjuntos: [{
        nombre: documento,
        mime: item.documento_manifiesto_mime ?? 'application/pdf',
        contenido: item.documento_manifiesto_contenido,
      }],
    });
    await this.prisma.manifiesto_eventos.create({
      data: {
        manifiesto_id: id,
        estado_anterior: 'RESGUARDO',
        estado_nuevo: 'RESGUARDO',
        accion: 'CORREO_MANIFIESTO_ENVIADO',
        actor_persona_id: user.personaId,
        actor_usuario: user.usuario,
        datos: { documento },
      },
    });
    this.notificar(id);
    return { success: true, mensaje: `Manifiesto enviado manualmente a ${destinatario}.`, destinatario };
  }

  async documento(id: number, tipo: 'manifiesto' | 'llegada') {
    const item = tipo === 'manifiesto'
      ? await this.prisma.manifiestos.findUnique({
          where: { id },
          select: { documento_manifiesto_nombre: true, documento_manifiesto_mime: true, documento_manifiesto_contenido: true },
        })
      : await this.prisma.manifiestos.findUnique({
          where: { id },
          select: { documento_llegada_nombre: true, documento_llegada_mime: true, documento_llegada_contenido: true },
        });
    if (!item) throw new NotFoundException('Manifiesto no encontrado.');
    const nombre = 'documento_manifiesto_nombre' in item ? item.documento_manifiesto_nombre : item.documento_llegada_nombre;
    const mime = 'documento_manifiesto_mime' in item ? item.documento_manifiesto_mime : item.documento_llegada_mime;
    const bytes = 'documento_manifiesto_contenido' in item ? item.documento_manifiesto_contenido : item.documento_llegada_contenido;
    if (!bytes || !nombre) throw new NotFoundException('El documento todavía no está disponible.');
    return { nombre, mime: mime ?? 'application/pdf', buffer: Buffer.from(bytes) };
  }

  private exigirEstado(item: manifiestos, expected: string) {
    if (item.estado !== expected)
      throw new ConflictException(`El manifiesto está en ${item.estado}; la acción requiere ${expected}.`);
  }

  private validarPdf(file: Archivo | undefined, required = false) {
    if (!file) {
      if (required) throw new BadRequestException('Adjunta el documento PDF del manifiesto.');
      return;
    }
    if (file.mimetype !== 'application/pdf' || !file.buffer?.subarray(0, 5).equals(Buffer.from('%PDF-')))
      throw new BadRequestException('El documento debe ser un PDF válido.');
    if (file.size > 10 * 1024 * 1024)
      throw new BadRequestException('El archivo no puede exceder 10 MB.');
  }

  private nombreArchivo(value: string) {
    const clean = value.replace(/[\r\n\x00-\x1F\x7F]/g, '').trim();
    if (!clean.toLowerCase().endsWith('.pdf'))
      throw new BadRequestException('El nombre del archivo debe terminar en .pdf.');
    return clean.slice(0, 255) || 'documento.pdf';
  }
}
