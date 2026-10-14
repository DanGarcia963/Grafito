import { Prisma } from '@prisma/client';
import { checklistPendiente, pesoEnRango, pesoEsperado } from './manifiestos.logic';

describe('reglas del flujo de manifiestos', () => {
  it('acepta la tolerancia de ±500 kg, incluidos los límites', () => {
    expect(pesoEnRango(new Prisma.Decimal(3000), new Prisma.Decimal(2500))).toBe(true);
    expect(pesoEnRango(3000, 3500)).toBe(true);
    expect(pesoEnRango(3000, '3500.0001')).toBe(false);
    expect(pesoEnRango(3000, 2499.99)).toBe(false);
  });

  it('usa la cantidad de la OV solo cuando está expresada en kilogramos', () => {
    expect(pesoEsperado(null, { cantidad: 1200, unidad: 'Kilogramos' })?.toString()).toBe('1200');
    expect(pesoEsperado(null, { cantidad: 1200, unidad: 'Litros' })).toBeNull();
    expect(pesoEsperado(950, { cantidad: 1200, unidad: 'Litros' })?.toString()).toBe('950');
    expect(pesoEnRango(null, 1250)).toBe(true);
  });

  it('no pide datos de transportista en GKN ni datos de OV cuando no hay OV', () => {
    const pendientes = checklistPendiente(
      { razonSocial: true, nombreResiduo: true, gknVerificado: true, destinoAutorizacion: true,
        destinoRazonSocial: true, lineaProduccion: true, registroBitacora: true },
      { esGkn: true, tieneOrdenVenta: false, tienePesoEsperado: false },
    );
    expect(pendientes).toEqual([]);
  });

  it('exige transportista e inventario trazable cuando aplica', () => {
    const pendientes = checklistPendiente({
      razonSocial: true, nombreResiduo: true, gknVerificado: true, destinoAutorizacion: true,
      destinoRazonSocial: true, lineaProduccion: true, registroBitacora: true,
    }, { esGkn: false, tieneOrdenVenta: true, tienePesoEsperado: true });
    expect(pendientes).toContain('Autorización SEMARNAT del transportista');
    expect(pendientes).toContain('Certificado trazable con el inventario de la OV');
    expect(pendientes).toContain('Peso del pedido dentro de ±500 kg del peso de llegada');
  });
});
