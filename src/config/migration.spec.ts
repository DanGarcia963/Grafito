import { CalidadService } from '../calidad/calidad.service';
import { ProductionService } from '../production/production.service';
import { booleanInput } from './inputs';
import { redisConnection, allowedOrigins } from './runtime';

describe('Compatibilidad PostgreSQL', () => {
  it('interpreta false y 0 sin convertirlos en true', () => {
    for (const value of [false, 0, 'false', '0']) expect(booleanInput(value)).toBe(false);
    for (const value of [true, 1, 'true', '1']) expect(booleanInput(value)).toBe(true);
    expect(() => booleanInput('no')).toThrow();
  });
  it('consulta tanques usando el enum y selección Prisma', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ProductionService({ equipos_tanques: { findMany } } as any, {} as any, {} as any);
    await service.tanquesAreaProduccion('grafito');
    expect(findMany.mock.calls[0][0].where).toEqual({ tipo: 'GRAFITO' });
    const invalid = await service.tanquesAreaProduccion('inexistente');
    expect(invalid.success).toBe(false);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
  it('conserva resultados de texto y numéricos en columnas distintas', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 2 });
    const db = {
      muestras: { findUnique: async () => ({ producto_id: 1 }) },
      parametros_laboratorio: { findUnique: async ({ where }: any) => ({ tipo_Dato: where.id_Parametro === 1 ? 'NUMERICO' : 'TEXTO' }) },
      especificaciones_producto: { findFirst: async () => null },
      resultado_analisis: { createMany },
    };
    const service = new CalidadService(db as any, {} as any, {} as any);
    const result = await (service as any).crearResultadosMuestraCalidad({ id_Muestra: 1, ciclo_analisis: 1,
      mediciones: [{ id_Parametro: 1, valor: '12.5' }, { id_Parametro: 2, valor: 'Ámbar' }] });
    expect(result.success).toBe(true);
    const rows = createMany.mock.calls[0][0].data;
    expect(rows[0].valor_Obtenido_Num.toString()).toBe('12.5');
    expect(rows[0].valor_Obtenido_Texto).toBeNull();
    expect(rows[1].valor_Obtenido_Num).toBeNull();
    expect(rows[1].valor_Obtenido_Texto).toBe('Ámbar');
  });
  it('actualiza el checklist de una recepción independiente de producción', async () => {
    const createMany = jest.fn().mockResolvedValue({count:1});
    const tx = { $queryRaw: jest.fn(), lotes_llegada: { findUnique: async()=>({id:42,estado_recepcion:'CONFIRMADA',estado_checklist:'PENDIENTE'}), update: async()=>({id:42}) }, checklist_contenedor: {createMany} };
    const db = { $transaction: jest.fn(async callback=>callback(tx)) };
    const service = new CalidadService(db as any, {id:(v:unknown)=>Number(v)} as any, {} as any);
    const result = await service.crearLoteConChecklist({recepcion_id:42,reviso_nombre:'Ana',estado_checklist:'COMPLETADO',contenedores:[{no_consecutivo:1,numero_contenedor:'C1',tapa_valvula:false,rejilla_danada:false,base_danada:false,derrame:false}]});
    expect(result.success).toBe(true);
    expect(createMany.mock.calls[0][0].data[0].lote_llegada_id).toBe(42);
  });
});
