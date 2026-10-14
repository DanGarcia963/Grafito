import {
  construirCorreoAlertaVencimiento,
  fechaHitoVencimiento,
  hitosVencimientoPendientes,
} from './alertas-vencimiento.logic';

describe('alertas de vencimiento de la Matriz Legal', () => {
  it('calcula hitos con meses calendario, limitando fechas al fin del mes', () => {
    expect(fechaHitoVencimiento('2027-08-31', 6)).toBe('2027-02-28');
    expect(fechaHitoVencimiento('2028-08-31', 6)).toBe('2028-02-29');
  });

  it('detecta 6, 4, 2 y 1 mes, y recupera hitos pasados tras una caída', () => {
    expect(hitosVencimientoPendientes('2027-04-30', '2026-10-29')).toEqual([]);
    expect(hitosVencimientoPendientes('2027-04-30', '2026-10-30')).toEqual([6]);
    expect(hitosVencimientoPendientes('2027-04-30', '2026-12-30')).toEqual([
      6, 4,
    ]);
    expect(hitosVencimientoPendientes('2027-04-30', '2027-04-30')).toEqual([]);
  });

  it('genera un correo con detalle del trámite y escapa contenido insertado', () => {
    const correo = construirCorreoAlertaVencimiento({
      id: 7,
      nombreTramite: '<script>alert("x")</script> & permiso',
      area: 'Ambiental',
      responsable: 'Responsable',
      proveedor: 'Proveedor',
      fechaVencimiento: '2027-04-30',
      mesesAnticipacion: 6,
      urlMatriz: 'https://siust.netlify.app/matriz',
    });

    expect(correo.subject).toContain('vence en 6 meses');
    expect(correo.html).toContain('&lt;script&gt;');
    expect(correo.html).not.toContain('<script>');
    expect(correo.html).toContain('Fecha de vencimiento');
    expect(correo.text).toContain('2027-04-30');
  });
});
