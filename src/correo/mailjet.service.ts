import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

export type AdjuntoMailjet = {
  nombre: string;
  mime: string;
  contenido: Uint8Array;
};

export type CorreoMailjet = {
  destinatario: string;
  asunto: string;
  texto: string;
  html: string;
  adjuntos?: AdjuntoMailjet[];
};

export function escaparHtmlCorreo(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    const entidades: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entidades[character];
  });
}

@Injectable()
export class MailjetService {
  async enviar(correo: CorreoMailjet): Promise<void> {
    const destinatario = correo.destinatario.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinatario))
      throw new BadRequestException('El cliente no tiene un correo válido registrado.');

    const apiKey = process.env.MAILJET_API_KEY?.trim();
    const apiSecret = process.env.MAILJET_API_SECRET?.trim();
    const remitente = process.env.MAILJET_SENDER?.trim();
    if (!apiKey || !apiSecret || !remitente)
      throw new ServiceUnavailableException(
        'El servicio de correo no está configurado. Revisa MAILJET_API_KEY, MAILJET_API_SECRET y MAILJET_SENDER en Railway.',
      );

    const controlador = new AbortController();
    const timeout = setTimeout(() => controlador.abort(), 20_000);
    try {
      const credenciales = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
      const message = {
        From: {
          Email: remitente,
          Name: process.env.MAILJET_SEND_NAME?.trim() || 'US Technologies',
        },
        To: [{ Email: destinatario }],
        Subject: correo.asunto,
        TextPart: correo.texto,
        HTMLPart: correo.html,
        ...(correo.adjuntos?.length
          ? {
              Attachments: correo.adjuntos.map((adjunto) => ({
                ContentType: adjunto.mime,
                Filename: adjunto.nombre,
                Base64Content: Buffer.from(adjunto.contenido).toString('base64'),
              })),
            }
          : {}),
      };
      const respuesta = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credenciales}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ Messages: [message] }),
        signal: controlador.signal,
      });
      const cuerpo = await respuesta.json().catch(() => null);
      if (!respuesta.ok || cuerpo?.Messages?.[0]?.Status !== 'success') {
        const detalle = JSON.stringify(cuerpo?.Messages?.[0]?.Errors ?? cuerpo).slice(0, 700);
        throw new Error(`Mailjet rechazó el correo (HTTP ${respuesta.status}): ${detalle}`);
      }
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException)
        throw error;
      throw new ServiceUnavailableException(
        error instanceof Error && error.name === 'AbortError'
          ? 'Mailjet tardó demasiado en responder. Intenta de nuevo.'
          : error instanceof Error
            ? error.message
            : 'No se pudo enviar el correo por Mailjet.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
