import {
  normalizarNombreTramite,
  porcentajeCoincidenciaNombre,
  umbralCoincidenciaNombre,
} from './catalogo-tramites.logic';

describe('coincidencias de nombres del catálogo legal', () => {
  it('normaliza acentos, mayúsculas y signos sin usar el área', () => {
    expect(normalizarNombreTramite('  LICENCIA Ambiental Única (LAU) ')).toBe(
      'licencia ambiental unica lau',
    );
    expect(
      porcentajeCoincidenciaNombre(
        'Licencia Ambiental Única (LAU)',
        'LICENCIA ambiental unica - LAU',
      ),
    ).toBe(100);
  });

  it('calcula la coincidencia solo sobre el nombre y aplica el umbral del 50%', () => {
    const parecido = porcentajeCoincidenciaNombre(
      'Autorización para el reciclaje de residuos peligrosos',
      'Autorización para reciclado de residuos peligrosos',
    );
    const distinto = porcentajeCoincidenciaNombre(
      'Autorización para el reciclaje de residuos peligrosos',
      'Mantenimiento anual de extintores',
    );

    expect(parecido).toBeGreaterThanOrEqual(umbralCoincidenciaNombre);
    expect(distinto).toBeLessThan(umbralCoincidenciaNombre);
  });
});
