import { Prisma } from '@prisma/client';
import {
  especificacionesValidas,
  saldosContenedoresRestantes,
} from '../inventario/especificaciones.logic';
import { calcularBalanceProduccion } from './production.logic';

describe('balance y saldos de contenedores de Grafito', () => {
  it('separa la carga de 3000 kg del producto obtenido de 1500 kg', () => {
    const balance = calcularBalanceProduccion(
      new Prisma.Decimal(3000),
      new Prisma.Decimal(1500),
    );

    expect(balance.diferencia_neta.toString()).toBe('1500');
    expect(balance.rendimiento_porcentaje?.toString()).toBe('50');
  });

  it('cuenta solo los contenedores que conservan saldo físico', () => {
    const restantes = saldosContenedoresRestantes(
      {
        contenedores: [
          { codigo: 'T1', peso_kg: '1000' },
          { codigo: 'T2', peso_kg: '1000' },
          { codigo: 'T3', peso_kg: '1000' },
        ],
      },
      new Prisma.Decimal(1500),
    );

    expect(restantes).toEqual([
      { codigo: 'T1', peso_kg: '1000', saldo_kg: '1000' },
      { codigo: 'T2', peso_kg: '1000', saldo_kg: '500' },
    ]);
    expect(
      saldosContenedoresRestantes(
        { contenedores: [{ codigo: 'T1', peso_kg: '1000' }] },
        new Prisma.Decimal(0),
      ),
    ).toEqual([]);
  });

  it('permite un último contenedor parcialmente lleno al descargar Grafito', () => {
    const result = especificacionesValidas(
      {
        version: 1,
        atributos: {},
        contenedores: [
          { codigo: 'PT-1', peso_kg: '850' },
          { codigo: 'PT-2', peso_kg: '650' },
        ],
      },
      { peso_min_kg: 850, peso_max_kg: 1000 },
      'Kilogramos',
      new Prisma.Decimal(1500),
      { permitirContenedorParcial: true },
    );

    expect(result?.contenedores).toHaveLength(2);
    expect(() =>
      especificacionesValidas(
        {
          version: 1,
          atributos: {},
          contenedores: [
            { codigo: 'PT-1', peso_kg: '850' },
            { codigo: 'PT-2', peso_kg: '650' },
          ],
        },
        { peso_min_kg: 850, peso_max_kg: 1000 },
        'Kilogramos',
        new Prisma.Decimal(1500),
      ),
    ).toThrow('intervalo');
  });
});
