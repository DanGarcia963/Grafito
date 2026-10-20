const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calcularCumplimientoOV } = require('../dist/ventas/crm.fulfillment');

function op(folio, aporte, carga = 3400) {
  return {
    id_Orden_Produc: Number(folio),
    no_Orden_Produc: folio,
    estado_Plan: 'FINALIZADA',
    cantidad_Planificada: carga,
    cantidad_producto_terminado: aporte,
    lotes_produccion: [
      {
        id_Lote_Produccion: Number(folio),
        estado: 'FINALIZADO',
        estado_Calida: 'LIBERADO',
      },
    ],
  };
}

function orden(folio, cantidad, ordenes_produccion) {
  return {
    folio,
    estado: 'CONFIRMADA',
    tipo_venta: 'PRODUCTO_NUEVO',
    cantidad,
    unidad: 'Kilogramos',
    ordenes_produccion,
    materiales_recibidos: [],
    entregas: [],
  };
}

test('La OV suma producto terminado aportado por varias OP; no suma la carga planificada', () => {
  const cumplimiento = calcularCumplimientoOV(
    orden('8023', 3400, [op('32182', 1700, 1700), op('32183', 1700, 3400)]),
  ).cumplimiento;

  assert.equal(cumplimiento.cantidad_producto_terminado_asignada, 3400);
  assert.equal(cumplimiento.cantidad_producto_terminado_pendiente, 0);
  assert.equal(cumplimiento.producto_terminado_asignado_completo, true);
  assert.equal(cumplimiento.estado, 'LISTA_PARA_ENTREGA');
});

test('La misma OP puede aportar producto a otra OV sin duplicar sus kg dentro de la OV original', () => {
  const primera = calcularCumplimientoOV(
    orden('8023', 3400, [op('32182', 1700, 1700), op('32183', 1700, 3400)]),
  ).cumplimiento;
  const segunda = calcularCumplimientoOV(
    orden('8030', 1700, [op('32183', 1700, 3400)]),
  ).cumplimiento;

  assert.equal(primera.cantidad_producto_terminado_asignada, 3400);
  assert.equal(segunda.cantidad_producto_terminado_asignada, 1700);
  assert.equal(segunda.estado, 'LISTA_PARA_ENTREGA');
});

test('La OV queda parcialmente cubierta hasta asignar toda la cantidad pedida', () => {
  const cumplimiento = calcularCumplimientoOV(
    orden('8023', 3400, [op('32183', 1700, 3400)]),
  ).cumplimiento;

  assert.equal(cumplimiento.cantidad_producto_terminado_asignada, 1700);
  assert.equal(cumplimiento.cantidad_producto_terminado_pendiente, 1700);
  assert.equal(cumplimiento.porcentaje_producto_terminado_asignado, 50);
  assert.equal(cumplimiento.estado, 'AVANCE_PARCIAL');
});

test('Una OV en borrador no refleja avance operativo antes de confirmarse', () => {
  const resultado = calcularCumplimientoOV({
    ...orden('8031', 2550, [op('32185', 2550)]),
    estado: 'BORRADOR',
  });
  assert.deepEqual(resultado.ordenes_produccion, []);
  assert.equal(resultado.cumplimiento.estado, 'BORRADOR');
  assert.equal(resultado.cumplimiento.cantidad_producto_terminado_asignada, 0);
  assert.equal(resultado.cumplimiento.cantidad_producto_terminado_pendiente, 2550);
});

test('Una OP cerrada con salida liberada aparece como pendiente de asignación', () => {
  const cumplimiento = calcularCumplimientoOV(
    orden('8023', 3400, [op('32183', 0, 3400)]),
  ).cumplimiento;

  assert.equal(cumplimiento.estado, 'PENDIENTE_ASIGNACION');
  assert.equal(
    cumplimiento.pasos.find((paso) => paso.key === 'ASIGNACION_PRODUCTO').estado,
    'PENDIENTE_ASIGNACION',
  );
});
