import { ServiceUnavailableException } from '@nestjs/common';
import { MailjetService, escaparHtmlCorreo } from './mailjet.service';

describe('MailjetService', () => {
  const variables = [
    'MAILJET_API_KEY',
    'MAILJET_API_SECRET',
    'MAILJET_SENDER',
    'MAILJET_SEND_NAME',
  ] as const;
  const original = Object.fromEntries(
    variables.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    jest.restoreAllMocks();
    for (const key of variables) {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('envía adjuntos codificados como Base64 por Send API v3.1', async () => {
    process.env.MAILJET_API_KEY = 'test-key';
    process.env.MAILJET_API_SECRET = 'test-secret';
    process.env.MAILJET_SENDER = 'avisos@example.com';
    const respuesta = {
      ok: true,
      json: async () => ({ Messages: [{ Status: 'success' }] }),
    } as Response;
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(respuesta);

    await new MailjetService().enviar({
      destinatario: 'cliente@example.com',
      asunto: 'Documento',
      texto: 'Adjunto',
      html: '<p>Adjunto</p>',
      adjuntos: [{ nombre: 'manifiesto.pdf', mime: 'application/pdf', contenido: Buffer.from('%PDF-test') }],
    });

    const payload = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(fetch).toHaveBeenCalledWith(
      'https://api.mailjet.com/v3.1/send',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(payload.Messages[0].Attachments[0]).toEqual({
      ContentType: 'application/pdf',
      Filename: 'manifiesto.pdf',
      Base64Content: Buffer.from('%PDF-test').toString('base64'),
    });
  });

  it('reporta cuando faltan las credenciales ya usadas por Matriz Legal', async () => {
    delete process.env.MAILJET_API_KEY;
    delete process.env.MAILJET_API_SECRET;
    delete process.env.MAILJET_SENDER;

    await expect(
      new MailjetService().enviar({
        destinatario: 'cliente@example.com',
        asunto: 'Prueba',
        texto: 'Prueba',
        html: '<p>Prueba</p>',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('escapa texto que se inserta en plantillas HTML', () => {
    expect(escaparHtmlCorreo('<cliente & "empresa">')).toBe(
      '&lt;cliente &amp; &quot;empresa&quot;&gt;',
    );
  });
});
