const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  calcularGraficasGrafito, identificarVuelta, identificarPrensa,
} = require('../dist/portal-cliente/portal-cliente-graficas.logic');

const lote = (id, condicion, origen, prensa, vuelta, lp = null) => ({
  id, condicion, origen, lote_produccion_id: lp, unidad: 'Kilogramos',
  especificaciones: { atributos: { tipo_prensa: prensa, numero_vuelta: vuelta } },
});
let idMovimiento = 1;
function movimiento(loteId, tipo, kg, extra = {}) {
  return {
    id_Movi_Invent: idMovimiento++,
    lote_inventario_id: loteId, lote_produccion_id: null,
    reversa_de_id: null, tipo, cantidad: kg,
    ubicacion_origen_id: null, ubicacion_destino_id: null,
    fecha: '2026-11-18T12:00:00.000Z', ...extra,
  };
}
const entrada = (id, kg, tipo = 'APERTURA', extra = {}) =>
  movimiento(id, tipo, kg, { ubicacion_destino_id: 1, ...extra });
const salida = (id, kg, tipo = 'SALIDA_CONSUMO', extra = {}) =>
  movimiento(id, tipo, kg, { ubicacion_origen_id: 1, ...extra });

test('Reconoce vueltas históricas 4TA, 7MA, 8VA y actuales numéricas', () => {
  for (const [valor, esperado] of [[4, 4], ['4TA', 4], ['7MA', 7], ['8VA', 8], [11, 11], ['11VA', 11], ['', null], [null, null], ['cualquiera', null]]) {
    assert.equal(identificarVuelta({ atributos: { numero_vuelta: valor } }), esperado);
  }
  assert.equal(identificarPrensa({ atributos: { tipo_prensa: 'Forgemaster' } }), 'Forgemaster');
});

test('Distribución de sucio, activo y liberado; acumulados incluyen entregado', () => {
  idMovimiento = 1;
  const lotes = [
    lote(1, 'SUCIO', 'APERTURA', 'Fagor', '4TA'),
    lote(2, 'SUCIO', 'RECEPCION', 'Forgemaster', '5TA'),
    lote(3, 'REGENERADO', 'PRODUCCION', 'Polymaster', '8VA', 10),
  ];
  const movimientos = [
    entrada(1, 2000),
    entrada(2, 1000, 'ENTRADA_RECEPCION'),
    salida(2, 600, 'SALIDA_CONSUMO', { lote_produccion_id: 9 }),
    entrada(3, 500, 'ENTRADA_PRODUCCION', { lote_produccion_id: 10 }),
    salida(3, 200, 'SALIDA_ENTREGA'),
  ];
  const p = [
    { id_Lote_Produccion: 9, estado: 'EN_PROCESO', estado_Calida: 'PROCESANDO' },
    { id_Lote_Produccion: 10, estado: 'FINALIZADO', estado_Calida: 'LIBERADO' },
  ];
  const out = calcularGraficasGrafito(lotes, movimientos, p);
  assert.deepEqual(out.estadoActual.map(x => x.kg), [2400, 600, 300]);
  assert.deepEqual(out.estadoActualPorPrensa.map(x => ({
    Fagor: x.Fagor, Forgemaster: x.Forgemaster,
    Polymaster: x.Polymaster, sinIdentificar: x.sinIdentificar, total: x.total,
  })), [
    { Fagor: 2000, Forgemaster: 400, Polymaster: 0, sinIdentificar: 0, total: 2400 },
    { Fagor: 0, Forgemaster: 600, Polymaster: 0, sinIdentificar: 0, total: 600 },
    { Fagor: 0, Forgemaster: 0, Polymaster: 300, sinIdentificar: 0, total: 300 },
  ]);
  assert.ok(out.estadoActualPorPrensa.every((fila, i) =>
    fila.Fagor + fila.Forgemaster + fila.Polymaster + fila.sinIdentificar === out.estadoActual[i].kg));
  assert.deepEqual(out.acumulados.map(x => x.kg), [1000, 500]);
  assert.equal(out.anillosVueltas.find(x => x.etapa === 'PROCESANDO' && x.prensa === 'Forgemaster').maxVuelta, 5);
  assert.equal(out.anillosVueltas.find(x => x.etapa === 'LIBERADO' && x.prensa === 'Polymaster').maxVuelta, 8);
});

test('Un movimiento revertido no aumenta entradas ni material activo', () => {
  idMovimiento = 1;
  const initial = entrada(1, 1000, 'ENTRADA_RECEPCION');
  const consumido = salida(1, 300, 'SALIDA_CONSUMO', { lote_produccion_id: 5 });
  const revertido = movimiento(1, 'REVERSION', 300, {
    ubicacion_destino_id: 1, reversa_de_id: consumido.id_Movi_Invent,
  });
  const out = calcularGraficasGrafito(
    [lote(1, 'SUCIO', 'RECEPCION', 'Fagor', 4)],
    [initial, consumido, revertido],
    [{ id_Lote_Produccion: 5, estado: 'EN_PROCESO', estado_Calida: 'PROCESANDO' }],
  );
  assert.equal(out.estadoActual[0].kg, 1000);
  assert.equal(out.estadoActual[1].kg, 0);
  assert.equal(out.acumulados[0].kg, 1000);
});

test('Cuando excede diez vueltas el indicador se marca excedido, y no se pierde inventario sin vuelta', () => {
  idMovimiento = 1;
  const out = calcularGraficasGrafito([
    lote(1, 'SUCIO', 'RECEPCION', 'Fagor', 11),
    lote(2, 'SUCIO', 'RECEPCION', 'Fagor', null),
    lote(3, 'SUCIO', 'RECEPCION', 'Polymaster', 7),
  ], [entrada(1, 850), entrada(2, 850), entrada(3, 850)], []);
  const a = out.anillosVueltas.find(x => x.etapa === 'SUCIO' && x.prensa === 'Fagor');
  assert.equal(a.excedida, true);
  assert.equal(a.maxVuelta, 11);
  assert.equal(a.sinVueltaKg, 850);
  assert.equal(out.sinVueltaKg.SUCIO, 850);
  assert.equal(out.estadoActual[0].kg, 2550);
});

test('Filtro de fechas sólo modifica acumulados, no fotografía de existencias actuales', () => {
  idMovimiento = 1;
  const m = [
    entrada(1, 850, 'ENTRADA_RECEPCION', { fecha: '2026-10-18T00:00:00Z' }),
    entrada(2, 800, 'ENTRADA_PRODUCCION', { fecha: '2026-11-18T00:00:00Z' }),
  ];
  const out = calcularGraficasGrafito(
    [lote(1, 'SUCIO', 'RECEPCION', 'Fagor', 4), lote(2, 'REGENERADO', 'PRODUCCION', 'Fagor', 4, 9)],
    m, [{ id_Lote_Produccion: 9, estado: 'FINALIZADO', estado_Calida: 'LIBERADO' }],
    new Date('2026-11-01T00:00:00Z'), new Date('2026-12-01T00:00:00Z'),
  );
  assert.deepEqual(out.estadoActual.map(x => x.kg), [850, 0, 800]);
  assert.deepEqual(out.acumulados.map(x => x.kg), [0, 800]);
});

test('No anuncia liberación sólo porque el inventario indica REGENERADO', () => {
  idMovimiento = 1;
  const out = calcularGraficasGrafito(
    [lote(1, 'REGENERADO', 'PRODUCCION', 'Fagor', 4, 3)],
    [entrada(1, 1000, 'ENTRADA_PRODUCCION')],
    [{ id_Lote_Produccion: 3, estado: 'FINALIZADO', estado_Calida: 'RECHAZADO' }],
  );
  assert.equal(out.estadoActual[2].kg, 0);
  assert.equal(out.acumulados[1].kg, 0);
});

test('El material sin prensa no se omite en el desglose ni cambia los totales', () => {
  idMovimiento = 1;
  const salidaGrafito = calcularGraficasGrafito([
    lote(1, 'SUCIO', 'RECEPCION', 'Desconocida', 5),
    lote(2, 'SUCIO', 'RECEPCION', 'Fagor', 7),
  ], [entrada(1, 125), entrada(2, 875)], []);
  assert.deepEqual(salidaGrafito.estadoActualPorPrensa[0], {
    clave: 'SUCIO', etiqueta: 'Inventario sucio',
    Fagor: 875, Forgemaster: 0, Polymaster: 0, sinIdentificar: 125, total: 1000,
  });
  assert.equal(salidaGrafito.estadoActual[0].kg, 1000);
});

test('Los acumulados se desglosan por prensa y sin identificar, sin alterar totales ni el filtro de fechas', () => {
  idMovimiento = 1;
  const lotes = [
    lote(1, 'SUCIO', 'RECEPCION', 'Fagor', 1),
    lote(2, 'SUCIO', 'RECEPCION', 'Forgemaster', 2),
    lote(3, 'SUCIO', 'RECEPCION', 'Desconocida', 3),
    lote(4, 'REGENERADO', 'PRODUCCION', 'Polymaster', 4, 10),
    lote(5, 'REGENERADO', 'PRODUCCION', 'Desconocida', 5, 11),
  ];
  const movements = [
    entrada(1, 500, 'ENTRADA_RECEPCION'),
    entrada(2, 300, 'ENTRADA_RECEPCION'),
    entrada(3, 200, 'ENTRADA_RECEPCION'),
    entrada(4, 120, 'ENTRADA_PRODUCCION'),
    entrada(5, 80, 'ENTRADA_PRODUCCION'),
    entrada(1, 600, 'ENTRADA_RECEPCION', { fecha: '2026-10-01T00:00:00Z' }),
  ];
  const produccion = [
    { id_Lote_Produccion: 10, estado: 'FINALIZADO', estado_Calida: 'LIBERADO' },
    { id_Lote_Produccion: 11, estado: 'FINALIZADO', estado_Calida: 'LIBERADO' },
  ];
  const result = calcularGraficasGrafito(lotes, movements, produccion,
    new Date('2026-11-01T00:00:00Z'), new Date('2026-12-01T00:00:00Z'));
  assert.deepEqual(result.acumulados.map(x => x.kg), [1000, 200]);
  assert.deepEqual(result.acumuladosPorPrensa, [
    { clave: 'ENTRADAS', etiqueta: 'Entradas acumuladas', Fagor: 500, Forgemaster: 300, Polymaster: 0, sinIdentificar: 200, total: 1000 },
    { clave: 'LIBERADO', etiqueta: 'Liberado acumulado', Fagor: 0, Forgemaster: 0, Polymaster: 120, sinIdentificar: 80, total: 200 },
  ]);
});
