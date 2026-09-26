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
