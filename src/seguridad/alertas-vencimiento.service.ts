import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  construirCorreoAlertaVencimiento,
  fechaActualEnZona,
  hitosVencimientoPendientes,
  MesesAlertaVencimiento,
} from './alertas-vencimiento.logic';

const DESTINATARIO_PREDETERMINADO = 'coordinadorshyma@ust.com.mx';
const INTERVALO_REVISION_MS = 15 * 60 * 1000;
const DURACION_BLOQUEO_MS = 2 * 60 * 1000;

type ConfiguracionMailjet = {
  apiKey: string;
  apiSecret: string;
  remitente: string;
  nombreRemitente: string;
  destinatario: string;
  urlMatriz: string;
};

const condicionesDisponibles = (
  ahora: Date,
): Prisma.tramites_alertas_vencimientoWhereInput => ({
  OR: [
    {
      estado: 'PENDIENTE',
      OR: [
        { siguiente_intento_en: null },
        { siguiente_intento_en: { lte: ahora } },
      ],
    },
    {
      estado: 'EN_PROCESO',
      bloqueado_hasta: { lte: ahora },
    },
  ],
});

function fechaComoDate(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

function baseMatrizUrl(): string {
  const especifica = process.env.MATRIZ_LEGAL_URL?.trim();
  if (especifica) return especifica;
  const origen = process.env.FRONTEND_URL?.split(',')[0]?.trim();
  if (origen) return `${origen.replace(/\/$/, '')}/matriz`;
  return 'https://siust.netlify.app/matriz';
}

@Injectable()
export class AlertasVencimientoService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AlertasVencimientoService.name);
  private temporizador?: NodeJS.Timeout;
  private cicloEnCurso = false;
  private avisoConfiguracionMostrado = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Ejecutar al arrancar también recupera hitos pendientes tras una caída.
    void this.procesarCiclo();
    this.temporizador = setInterval(
      () => void this.procesarCiclo(),
      INTERVALO_REVISION_MS,
    );
    this.temporizador.unref?.();
  }

  onModuleDestroy() {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  private configuracion(): ConfiguracionMailjet | null {
    const apiKey = process.env.MAILJET_API_KEY?.trim();
    const apiSecret = process.env.MAILJET_API_SECRET?.trim();
    const remitente = process.env.MAILJET_SENDER?.trim();
    if (!apiKey || !apiSecret || !remitente) return null;

    return {
      apiKey,
      apiSecret,
      remitente,
      nombreRemitente:
        process.env.MAILJET_SEND_NAME?.trim() ||
        'US Technologies · Matriz Legal',
      destinatario:
        process.env.MATRIZ_LEGAL_ALERT_EMAIL?.trim() ||
        DESTINATARIO_PREDETERMINADO,
      urlMatriz: baseMatrizUrl(),
    };
  }

  async procesarCiclo(): Promise<void> {
    if (this.cicloEnCurso) return;
    this.cicloEnCurso = true;
    try {
      const configuracion = this.configuracion();
      if (!configuracion) {
        if (!this.avisoConfiguracionMostrado) {
          this.logger.warn(
            'Alertas de Matriz Legal en espera: configura MAILJET_API_KEY, MAILJET_API_SECRET y MAILJET_SENDER.',
          );
          this.avisoConfiguracionMostrado = true;
        }
        return;
      }
      this.avisoConfiguracionMostrado = false;

      const hoy = fechaActualEnZona();
      await this.registrarHitosVencidos(hoy, configuracion.destinatario);
      await this.procesarPendientes(configuracion);
    } catch (error) {
      this.logger.error(
        'No se pudo completar la revisión de alertas de la Matriz Legal.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.cicloEnCurso = false;
    }
  }

  private async registrarHitosVencidos(hoy: string, destinatario: string) {
    const vencimientoMinimo = fechaComoDate(hoy);
    const tramites = await this.prisma.tramites_legales.findMany({
      where: {
        fecha_Vencimiento: { gte: vencimientoMinimo },
        estatus_Tramite: { not: 'VENCIDO' },
      },
      select: {
        id_Tramite_Legal: true,
        fecha_Vencimiento: true,
      },
    });

    const alertas = tramites.flatMap((tramite) =>
      hitosVencimientoPendientes(tramite.fecha_Vencimiento, hoy).map(
        (meses) => ({
          tramite_id: tramite.id_Tramite_Legal,
          fecha_vencimiento: tramite.fecha_Vencimiento,
          meses_anticipacion: meses,
          destinatario,
        }),
      ),
    );

    if (alertas.length) {
      await this.prisma.tramites_alertas_vencimiento.createMany({
        data: alertas,
        skipDuplicates: true,
      });
    }
  }

  private async procesarPendientes(configuracion: ConfiguracionMailjet) {
    const ahora = new Date();
    const disponibles = condicionesDisponibles(ahora);
    const alertas = await this.prisma.tramites_alertas_vencimiento.findMany({
      where: disponibles,
      include: {
        tramite: {
          include: {
            catalogo_tramites: {
              include: { areas_legales: true },
            },
          },
        },
      },
      orderBy: { creado_en: 'asc' },
      take: 50,
    });

    for (const alerta of alertas) {
      const reclamo = await this.prisma.tramites_alertas_vencimiento.updateMany(
        {
          where: { id: alerta.id, ...condicionesDisponibles(new Date()) },
          data: {
            estado: 'EN_PROCESO',
            bloqueado_hasta: new Date(Date.now() + DURACION_BLOQUEO_MS),
            intentos: { increment: 1 },
            ultimo_error: null,
          },
        },
      );
      if (reclamo.count !== 1) continue;

      const fechaActual = alerta.tramite.fecha_Vencimiento
        .toISOString()
        .slice(0, 10);
      const fechaRegistrada = alerta.fecha_vencimiento
        .toISOString()
        .slice(0, 10);
      if (
        fechaActual !== fechaRegistrada ||
        fechaActualEnZona() >= fechaRegistrada ||
        alerta.tramite.estatus_Tramite === 'VENCIDO'
      ) {
        await this.prisma.tramites_alertas_vencimiento.update({
          where: { id: alerta.id },
          data: {
            estado: 'CANCELADA',
            bloqueado_hasta: null,
            siguiente_intento_en: null,
          },
        });
        continue;
      }

      try {
        const correo = construirCorreoAlertaVencimiento({
          id: alerta.tramite.id_Tramite_Legal,
          nombreTramite: alerta.tramite.catalogo_tramites.nombre_Tramite,
          area: alerta.tramite.catalogo_tramites.areas_legales.nombre_Area,
          responsable: alerta.tramite.responsable_Interno,
          proveedor: alerta.tramite.proveedor,
          fechaVencimiento: alerta.fecha_vencimiento,
          mesesAnticipacion:
            alerta.meses_anticipacion as MesesAlertaVencimiento,
          urlMatriz: configuracion.urlMatriz,
        });
        await this.enviarMailjet(correo, configuracion);
        await this.prisma.tramites_alertas_vencimiento.update({
          where: { id: alerta.id },
          data: {
            estado: 'ENVIADA',
            enviado_en: new Date(),
            bloqueado_hasta: null,
            siguiente_intento_en: null,
            ultimo_error: null,
          },
        });
        this.logger.log(
          `Alerta de vencimiento enviada para el trámite ${alerta.tramite.id_Tramite_Legal} (${alerta.meses_anticipacion} meses).`,
        );
      } catch (error) {
        const intento = alerta.intentos + 1;
        const esperaMinutos = Math.min(360, 5 * 2 ** Math.min(intento - 1, 6));
        const mensaje =
          error instanceof Error
            ? error.message
            : 'Error desconocido al enviar correo';
        await this.prisma.tramites_alertas_vencimiento.update({
          where: { id: alerta.id },
          data: {
            estado: 'PENDIENTE',
            bloqueado_hasta: null,
            siguiente_intento_en: new Date(
              Date.now() + esperaMinutos * 60 * 1000,
            ),
            ultimo_error: mensaje.slice(0, 1000),
          },
        });
        this.logger.error(
          `No se pudo enviar la alerta ${alerta.id}; se reintentará en ${esperaMinutos} minutos.`,
        );
      }
    }
  }

  private async enviarMailjet(
    correo: ReturnType<typeof construirCorreoAlertaVencimiento>,
    configuracion: ConfiguracionMailjet,
  ) {
    const controlador = new AbortController();
    const timeout = setTimeout(() => controlador.abort(), 20_000);
    try {
      const credenciales = Buffer.from(
        `${configuracion.apiKey}:${configuracion.apiSecret}`,
      ).toString('base64');
      const respuesta = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credenciales}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Messages: [
            {
              From: {
                Email: configuracion.remitente,
                Name: configuracion.nombreRemitente,
              },
              To: [{ Email: configuracion.destinatario }],
              Subject: correo.subject,
              HTMLPart: correo.html,
              TextPart: correo.text,
            },
          ],
        }),
        signal: controlador.signal,
      });
      const cuerpo = await respuesta.json().catch(() => null);
      if (!respuesta.ok || cuerpo?.Messages?.[0]?.Status !== 'success') {
        const detalle = JSON.stringify(
          cuerpo?.Messages?.[0]?.Errors ?? cuerpo,
        ).slice(0, 700);
        throw new Error(
          `Mailjet rechazó el correo (HTTP ${respuesta.status}): ${detalle}`,
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
