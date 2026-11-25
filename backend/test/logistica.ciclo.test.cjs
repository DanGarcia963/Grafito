const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const {
  tipoVehiculo, idSeguro, decimalPositivo, compararCarga, saldoFisicoUbicacion,
  expedienteComercialApto, verificarRecepcion,
} = require('../dist/logistica/logistica.logic');
const D = (s) => new Prisma.Decimal(String(s));

test('Capacidades fijas por tipo y rechazo de sobrecarga por contenedor', () => {
  assert.equal(tipoVehiculo('TORTON'), 'TORTON');
  assert.equal(tipoVehiculo('TRAILER'), 'TRAILER');
  assert.throws(() => tipoVehiculo('CAMIONETA'));
  assert.doesNotThrow(() => compararCarga(12,D(12500),'TORTON',D(16000)));
  assert.throws(() => compararCarga(13,D(12500),'TORTON',D(16000)));
  assert.doesNotThrow(() => compararCarga(22,D(25000),'TRAILER',D(32000)));
  assert.throws(() => compararCarga(23,D(26000),'TRAILER',D(32000)));
  assert.throws(() => compararCarga(5,D(36000),'TRAILER',D(32000)));
});

test('Identificadores y cantidades no admiten negativos ni fracciones de contenedor', () => {
  assert.equal(idSeguro('100'),100);
  assert.throws(() => idSeguro('1.4'));
  assert.throws(() => idSeguro(-1));
  assert.throws(() => decimalPositivo(0,'cantidad'));
  assert.throws(() => decimalPositivo('1.00001','cantidad'));
  assert.equal(decimalPositivo('0.1250','cantidad').toString(),'0.125');
});

test('Kardex físico contabiliza entradas y salidas; transferencias no crean masa', () => {
  const movs=[
    {cantidad:D(120),ubicacion_origen_id:null,ubicacion_destino_id:1},
    {cantidad:D(40),ubicacion_origen_id:1,ubicacion_destino_id:2},
    {cantidad:D(15),ubicacion_origen_id:2,ubicacion_destino_id:null},
  ];
  assert.equal(saldoFisicoUbicacion(movs,1).toString(),'80');
  assert.equal(saldoFisicoUbicacion(movs,2).toString(),'25');
});

test('No se despacha un lote sin liberación final y evidencia documentada', () => {
  const lp={estado:'FINALIZADO',estado_Calida:'LIBERADO'};
  assert.equal(expedienteComercialApto(lp,[],null),false);
  assert.equal(expedienteComercialApto(lp,[],{estado:'PENDIENTE',documento_contenido:Buffer.from('pdf')}),false);
  assert.equal(expedienteComercialApto(lp,[],{estado:'VALIDADA',documento_contenido:Buffer.from('pdf')}),true);
  assert.equal(expedienteComercialApto(lp,[{
    estatus:'EMITIDO',estatus_Calidad:'APROBADO',documento_contenido:Buffer.from('pdf'),
  }],null),true);
  assert.equal(expedienteComercialApto({estado:'EN_PROCESO',estado_Calida:'LIBERADO'},[{
    estatus:'EMITIDO',estatus_Calidad:'APROBADO',documento_contenido:Buffer.from('pdf'),
  }],null),false);
});

test('Recepción registra discrepancia y no inventa entrada física', () => {
  assert.equal(verificarRecepcion(D(1300),D(1295)).diferencia.toString(),'5');
  assert.equal(verificarRecepcion(D(1300),D(1300)).conciliado,true);
  assert.throws(() => verificarRecepcion(D(1300),D(1301)));
});
