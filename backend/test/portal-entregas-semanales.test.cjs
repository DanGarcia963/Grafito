const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  totalSemanasISO, semanaISODeFecha, fechaEnMexico, calcularEntregasSemanales,
} = require('../dist/portal-cliente/portal-entregas-semanales.logic');

function movimiento(id, fecha, cantidad, prensa) {
  return {
    id_Movi_Invent: id, fecha, cantidad,
    especificaciones: { atributos: { tipo_prensa: prensa } },
  };
}

test('Semanas ISO: 2026 contiene 53 y 2025 contiene 52', () => {
  assert.equal(totalSemanasISO(2026), 53);
  assert.equal(totalSemanasISO(2025), 52);
  assert.deepEqual(semanaISODeFecha('2026-01-01'), { anio: 2026, semana: 1 });
  assert.deepEqual(semanaISODeFecha('2026-12-31'), { anio: 2026, semana: 53 });
  assert.deepEqual(semanaISODeFecha('2027-01-01'), { anio: 2026, semana: 53 });
  assert.deepEqual(semanaISODeFecha('2024-12-30'), { anio: 2025, semana: 1 });
});

test('Siempre construye las 53 semanas sin inventar entregas', () => {
  const ahora = new Date('2026-11-24T19:42:00Z');
  const datos = calcularEntregasSemanales(2026, [], new Set(), ahora);
  assert.equal(datos.anio, 2026);
  assert.equal(datos.semanas.length, 53);
  assert.equal(datos.semanas[0].etiqueta, '1/53');
  assert.equal(datos.semanas[52].etiqueta, '53/53');
  assert.equal(datos.semanas[0].inicio, '2025-12-29');
  assert.equal(datos.semanas[52].fin, '2027-01-03');
  assert.equal(datos.anterior.semana, 47);
  assert.equal(datos.anterior.anio, 2026);
  assert.equal(datos.anterior.inicio, '2026-11-16');
  assert.equal(datos.anterior.fin, '2026-11-22');
  assert.equal(datos.acumuladoAnual.total, 0);
  assert.ok(datos.semanas.every(x => x.total === 0));
});

test('Suma por Fagor, Forgemaster, Polymaster y sin prensa en la semana correcta', () => {
  const ahora = new Date('2026-11-24T19:42:00Z');
  const movimientos = [
    movimiento(1, '2026-11-16T10:00:00Z', 100, 'Fagor'),
    movimiento(2, '2026-11-18T12:00:00Z', 200, 'Forgemaster'),
    movimiento(3, '2026-11-22T20:00:00Z', 300, 'Polymaster'),
    movimiento(4, '2026-11-18T12:00:00Z', 40, 'Otra'),
    movimiento(5, '2026-11-23T10:00:00Z', 500, 'Fagor'),
  ];
  const datos = calcularEntregasSemanales(2026, movimientos, new Set(), ahora);
  const semana47 = datos.semanas[46];
  assert.deepEqual([semana47.Fagor, semana47.Forgemaster, semana47.Polymaster,
    semana47.sinIdentificar, semana47.total], [100, 200, 300, 40, 640]);
  assert.equal(datos.anterior.total, 640);
  assert.equal(datos.semanas[47].Fagor, 500);
  assert.equal(datos.acumuladoAnual.total, 1140);
  assert.equal(datos.movimientosAnuales, 5);
});

test('Ignora un movimiento revertido y evita duplicar IDs', () => {
  const m1 = movimiento(11, '2026-11-18T12:00:00Z', 1000, 'Fagor');
  const m2 = movimiento(12, '2026-11-19T12:00:00Z', 200, 'Polymaster');
  const datos = calcularEntregasSemanales(
    2026, [m1, m1, m2], new Set([11]), new Date('2026-11-24T19:42:00Z'),
  );
  assert.equal(datos.anterior.total, 200);
  assert.equal(datos.acumuladoAnual.total, 200);
  assert.equal(datos.movimientosAnuales, 1);
});

test('Corte por zona de Ciudad de México y cambio de año ISO', () => {
  assert.equal(fechaEnMexico('2026-12-29T03:00:00Z'), '2026-12-28');
  const datos = calcularEntregasSemanales(2026, [
    movimiento(1, '2027-01-01T05:30:00Z', 900, 'Forgemaster'),
    movimiento(2, '2027-01-04T08:00:00Z', 200, 'Fagor'),
  ], new Set(), new Date('2027-01-07T19:00:00Z'));
  assert.equal(datos.semanas[52].Forgemaster, 900);
  assert.equal(datos.acumuladoAnual.total, 900);
  assert.equal(datos.anterior.anio, 2026);
  assert.equal(datos.anterior.semana, 53);
  assert.equal(datos.anterior.total, 900);
  assert.equal(datos.semanas[0].total, 0);
});

test('Al consultar un año histórico, la semana anterior siempre se refiere a la actual', () => {
  const datos = calcularEntregasSemanales(2025, [
    movimiento(1, '2025-02-04T13:00:00Z', 50, 'Polymaster'),
    movimiento(2, '2026-11-18T12:00:00Z', 30, 'Fagor'),
  ], new Set(), new Date('2026-11-24T19:42:00Z'));
  assert.equal(datos.numeroSemanas, 52);
  assert.equal(datos.acumuladoAnual.total, 50);
  assert.equal(datos.anterior.total, 30);
  assert.equal(datos.anterior.anio, 2026);
});
