const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, ConflictException } = require('@nestjs/common');
const { Prisma } = require('@prisma/client');
const {
  fechaValida, periodoConfigurado, validarCapturaHistorica,
} = require('../dist/kpis/kpis-captura.logic');

function conf(overrides={}) {
  return {
    id_Configuracion: 34, indicador_id: 5,
    vigente_desde: new Date('2020-01-01T00:00:00Z'),
    vigente_hasta: null, periodicidad:'MENSUAL', tipo_dato:'NUMERICO',
    decimales:2, unidad:'%', metodo_calculo:'DIRECTO', opciones_permitidas:null,
    dias_limite_captura:10, requiere_evidencia:true, regla_evaluacion:'MAYOR_IGUAL',
    meta_minima:new Prisma.Decimal(90), meta_maxima:null, meta_booleano:null, meta_opcion:null,
    ...overrides,
  };
}
const indicador = {activo_desde:new Date('2020-01-01T00:00:00Z'),activo_hasta:null};
function raw(overrides={}) {
  return {
    indicador_id:'5',configuracion_id:'34',periodo_inicio:'2024-02-01',periodo_fin:'2024-02-29',
    valor:'92.25',fuente:'Concentrado histórico del sistema',fecha_documento:'2024-03-05',
    datos_base:'',observaciones:'Notas históricas',analisis:'En meta',
    acciones_propuestas:'Conservar seguimiento',motivo:'Captura histórica',estado:'EN_REVISION',
    revision_esperada:'0',...overrides,
  };
}
test('Valida fechas y meses bisiestos exactos',()=>{
  assert.equal(fechaValida('2024-02-29'),'2024-02-29');
  assert.throws(()=>fechaValida('2025-02-29'),BadRequestException);
  assert.throws(()=>fechaValida('2024-02-31'),BadRequestException);
  const p=periodoConfigurado(conf(), '2024-02-01','2024-02-29',indicador);
  assert.equal(p.limite,'2024-03-10');
  assert.throws(()=>periodoConfigurado(conf(),'2024-02-01','2024-03-31',indicador),BadRequestException);
});
test('Respeta trimestral y versiones de configuración',()=>{
  const trimestral=conf({periodicidad:'TRIMESTRAL'});
  assert.equal(periodoConfigurado(trimestral,'2024-01-01','2024-03-31',indicador).fin,'2024-03-31');
  assert.throws(()=>periodoConfigurado(trimestral,'2024-02-01','2024-04-30',indicador),BadRequestException);
  assert.throws(()=>periodoConfigurado(conf({vigente_desde:new Date('2024-02-10T00:00:00Z')}),
    '2024-02-01','2024-02-29',indicador),ConflictException);
});
test('Captura numérica con metas y precisión definidas para la versión',()=>{
  const result=validarCapturaHistorica(raw(),conf());
  assert.equal(result.valor_numerico.toString(),'92.25');
  assert.equal(result.evaluacion,'CUMPLE');
  assert.equal(result.revision_esperada,0);
  assert.throws(()=>validarCapturaHistorica(raw({valor:'92.251'}),conf()),BadRequestException);
  assert.throws(()=>validarCapturaHistorica(raw({valor:'Infinity'}),conf()),BadRequestException);
  assert.throws(()=>validarCapturaHistorica(raw({configuracion_id:'35'}),conf()),BadRequestException);
});
test('Desviaciones requieren análisis y plan de acciones al enviar a revisión',()=>{
  assert.throws(()=>validarCapturaHistorica(raw({
    valor:'30',analisis:'',acciones_propuestas:'',
  }),conf()),BadRequestException);
  const historico=validarCapturaHistorica(raw({
    valor:'30',estado:'BORRADOR',analisis:'',acciones_propuestas:'',
  }),conf());
  assert.equal(historico.evaluacion,'NO_CUMPLE');
});
test('Métodos indirectos exigen datos base y los validan como JSON',()=>{
  const indirecto=conf({metodo_calculo:'RAZON'});
  assert.throws(()=>validarCapturaHistorica(raw(),indirecto),BadRequestException);
  assert.throws(()=>validarCapturaHistorica(raw({datos_base:'[]'}),indirecto),BadRequestException);
  assert.deepEqual(JSON.parse(validarCapturaHistorica(raw({
    datos_base:'{"numerador": 12, "denominador": 20}',
  }),indirecto).datos_base),{numerador:12,denominador:20});
});
test('Soporta valor booleano y opciones de catálogo sin valores inventados',()=>{
  const booleana=conf({tipo_dato:'BOOLEANO',meta_booleano:true});
  const b=validarCapturaHistorica(raw({valor:'false'}),booleana);
  assert.equal(b.valor_booleano,false);
  assert.equal(b.evaluacion,'NO_CUMPLE');
  const opcion=conf({tipo_dato:'OPCION',meta_opcion:'VERDE',opciones_permitidas:'["VERDE","ROJO"]'});
  assert.equal(validarCapturaHistorica(raw({valor:'VERDE'}),opcion).evaluacion,'CUMPLE');
  assert.throws(()=>validarCapturaHistorica(raw({valor:'AZUL'}),opcion),BadRequestException);
});
test('No permite revisiones inválidas ni periodos futuros',()=>{
  assert.throws(()=>validarCapturaHistorica(raw({revision_esperada:'-1'}),conf()),BadRequestException);
  assert.throws(()=>periodoConfigurado(conf(), '2099-01-01','2099-01-31',indicador),ConflictException);
});

test('Un periodo no aplicable requiere motivo y no inventa resultados',()=>{
  assert.throws(()=>validarCapturaHistorica(raw({no_aplica:'true',justificacion_no_aplica:'corta',valor:''}),conf()),BadRequestException);
  const resultado=validarCapturaHistorica(raw({no_aplica:'true',justificacion_no_aplica:'No hubo operación durante este periodo completo.',valor:''}),conf());
  assert.equal(resultado.justificacion_no_aplica,'No hubo operación durante este periodo completo.');
  assert.equal(resultado.valor_numerico,null);
  assert.equal(resultado.evaluacion,'NO_EVALUABLE');
});
