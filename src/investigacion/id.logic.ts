import { BadRequestException } from '@nestjs/common';
export function texto(v:unknown,max=100):string {
 if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new BadRequestException(`Texto requerido (máximo ${max} caracteres)`);
 return v.trim();
}
export function idValido(v:unknown):number {
 if(!['number','string'].includes(typeof v)||!/^\d+$/.test(String(v)))throw new BadRequestException('ID inválido');
 const n=Number(v);if(!Number.isSafeInteger(n)||n<=0)throw new BadRequestException('ID inválido');return n;
}
export function estandar(v:unknown):number|null {
 if(v==null||v==='')return null;
 const n=Number(v);if(!Number.isSafeInteger(n)||n<=0||n>2147483647)throw new BadRequestException('El estándar debe ser segundos enteros positivos');return n;
}
export function metricas(t:{inicio:Date|null;fin:Date|null;disponible_desde:Date|null;estandar_segundos:number|null}){
 const real=t.inicio&&t.fin?(+t.fin-+t.inicio)/1000:null;
 return {duracionSegundos:real,esperaSegundos:t.inicio&&t.disponible_desde?(+t.inicio-+t.disponible_desde)/1000:null,
 desviacionSegundos:real!=null&&t.estandar_segundos!=null?real-t.estandar_segundos:null,
 desviacionPorcentaje:real!=null&&t.estandar_segundos?100*(real-t.estandar_segundos)/t.estandar_segundos:null};
}
export function fichaValida(file?:{buffer:Buffer;originalname:string;size:number}){
 if(!file||file.size<1||file.size>10*1024*1024)throw new BadRequestException('Adjunta Word o PDF de hasta 10 MB');
 const n=file.originalname.toLowerCase(),b=file.buffer;
 const pdf=n.endsWith('.pdf')&&b.subarray(0,5).toString()==='%PDF-';
 const doc=n.endsWith('.doc')&&b.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11ae1','hex'));
 const docx=n.endsWith('.docx')&&b.subarray(0,2).toString()==='PK'&&b.includes(Buffer.from('word/document.xml'));
 if(!pdf&&!doc&&!docx)throw new BadRequestException('El archivo no corresponde a un Word o PDF admitido');
 return {nombre:file.originalname.replace(/[\r\n\\/]/g,'_').slice(0,200),mime:pdf?'application/pdf':doc?'application/msword':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
}

export type MedicionId = {
 clave: string;
 nombre: string;
 valor: string;
 unidad: string | null;
};

export function analisisEstructuradoValido(entrada: unknown) {
 if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada))
  throw new BadRequestException('Captura los resultados del análisis.');
 const body = entrada as Record<string, unknown>;
 if (!Array.isArray(body.metricas) || body.metricas.length < 1 || body.metricas.length > 40)
  throw new BadRequestException('Registra entre 1 y 40 parámetros del análisis.');
 const claves = new Set<string>();
 const metricas: MedicionId[] = body.metricas.map((raw, i) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
   throw new BadRequestException(`Parámetro ${i + 1} inválido.`);
  const item = raw as Record<string, unknown>;
  const clave = texto(item.clave, 60).toLocaleLowerCase('es-MX');
  if (!/^[a-z0-9_-]+$/.test(clave) || claves.has(clave))
   throw new BadRequestException(`La clave del parámetro ${i + 1} no es válida o está repetida.`);
  claves.add(clave);
  const valor = String(item.valor ?? '').trim();
  if (!valor || valor.length > 120)
   throw new BadRequestException(`Captura un valor de hasta 120 caracteres para ${clave}.`);
  return {
   clave,
   nombre: texto(item.nombre, 100),
   valor,
   unidad: item.unidad == null || item.unidad === '' ? null : texto(item.unidad, 40),
  };
 });
 const observaciones = body.observaciones == null || body.observaciones === ''
  ? null
  : texto(body.observaciones, 4000);
 return { metricas, observaciones };
}

export function procesamientoEstructuradoValido(entrada: unknown) {
 if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada))
  throw new BadRequestException('Selecciona el procesamiento realizado.');
 const body = entrada as Record<string, unknown>;
 const tipo = body.tipo;
 const nota = body.observaciones == null || body.observaciones === ''
  ? null
  : texto(body.observaciones, 4000);
 if (tipo === 'FILTRACION') {
  const filtracion = String(body.filtracion ?? '');
  if (!['ESTANDAR', 'CODIGO_LIMPIEZA', 'FILTRACION_CV'].includes(String(filtracion)))
   throw new BadRequestException('Selecciona el tipo de filtración.');
  return { tipo, filtracion, regeneracion: null, observaciones: nota };
 }
 if (tipo === 'REGENERACION') {
  const regeneracion = String(body.regeneracion ?? '');
  if (!['AJUSTE_ACIDO_BASICO', 'ADITIVACION', 'AMBOS', 'EXCESO_CONTAMINACION'].includes(String(regeneracion)))
   throw new BadRequestException('Selecciona el tipo de regeneración.');
  return { tipo, filtracion: null, regeneracion, observaciones: nota };
 }
 throw new BadRequestException('El tipo de procesamiento debe ser FILTRACION o REGENERACION.');
}
