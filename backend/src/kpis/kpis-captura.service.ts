import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma, type kpi_resultados } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import type { Usuario } from '../auth/auth.service';
import { evaluate, iso } from './kpis.logic';
import {
  fechaValida, periodoConfigurado, validarCapturaHistorica,
} from './kpis-captura.logic';

type KpiArchivo = Express.Multer.File | undefined;
const date = (s: string) => new Date(s + 'T00:00:00.000Z');

function evidenciaValida(file: KpiArchivo) {
  if (!file) return null;
  if (!file.buffer?.length || file.size > 8 * 1024 * 1024)
    throw new BadRequestException('La evidencia debe ser un archivo no vacío de máximo 8 MB.');
  const nombre = (file.originalname ?? '').replace(/[\\/\r\n\x00-\x1f\x7f]/g,'_').slice(0,255);
  const lower = nombre.toLowerCase(), bytes = file.buffer;
  const pdf = lower.endsWith('.pdf') && bytes.subarray(0,5).toString() === '%PDF-';
  const png = lower.endsWith('.png') && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg = (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) &&
    bytes.length>3 && bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff;
  const xlsx = lower.endsWith('.xlsx') && bytes.length>4 &&
    bytes[0]===0x50 && bytes[1]===0x4b && bytes[2]===0x03 && bytes[3]===0x04;
  if (!pdf&&!png&&!jpg&&!xlsx) throw new BadRequestException('Evidencia permitida: PDF, PNG, JPG o XLSX.');
  const mime = pdf ? 'application/pdf' : png ? 'image/png' :
    jpg ? 'image/jpeg' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return {nombre, mime, buffer:Buffer.from(bytes)};
}

@Injectable()
export class KpisCapturaService {
  constructor(private readonly prisma: PrismaService) {}

  async capturar(raw: Record<string,unknown>, file: KpiArchivo, user: Usuario) {
    if (user.area !== 'seguridad') throw new ForbiddenException('Solo SHyMA puede capturar indicadores.');
    const periodo_inicio=fechaValida(raw.periodo_inicio);
    const periodo_fin=fechaValida(raw.periodo_fin);
    const indicadorId=Number(raw.indicador_id), configId=Number(raw.configuracion_id);
    if(!Number.isSafeInteger(indicadorId)||indicadorId<=0||
       !Number.isSafeInteger(configId)||configId<=0)
      throw new BadRequestException('Indicador o configuración inválidos.');
    const adjunto=evidenciaValida(file);
    // Bloquear el indicador serializa capturas históricas concurrentes del mismo KPI.
    return this.prisma.$transaction(async tx=>{
      const bloqueado=await tx.$queryRawUnsafe<Array<{id_Indicador:number}>>(
        'SELECT "id_Indicador" FROM kpi_indicadores WHERE "id_Indicador"=$1 FOR UPDATE',indicadorId,
      );
      if(!bloqueado.length) throw new NotFoundException('Indicador no encontrado.');
      const indicador=await tx.kpi_indicadores.findUnique({where:{id_Indicador:indicadorId}});
      if(!indicador||!indicador.activo) throw new ConflictException('El indicador está inactivo.');
      const config=await tx.kpi_configuraciones.findFirst({
        where:{id_Configuracion:configId,indicador_id:indicadorId},
      });
      if(!config) throw new BadRequestException('La configuración no pertenece al indicador.');
      const periodo=periodoConfigurado(config,periodo_inicio,periodo_fin,indicador);
      const compatibles=await tx.kpi_configuraciones.findMany({
        where:{
          indicador_id:indicadorId,
          vigente_desde:{lte:date(periodo.fin)},
          OR:[{vigente_hasta:null},{vigente_hasta:{gte:date(periodo.inicio)}}],
        },
        select:{id_Configuracion:true},
      });
      if(compatibles.length!==1 || compatibles[0].id_Configuracion!==configId)
        throw new ConflictException('Existen configuraciones superpuestas o cambios dentro del periodo.');
      const r=validarCapturaHistorica(raw,config);
      const existente=await tx.kpi_resultados.findFirst({
        where:{
          indicador_id:indicadorId,
          periodo_inicio:date(periodo.inicio),
          periodo_fin:date(periodo.fin),
        },
      });
      if(existente && !['PENDIENTE','BORRADOR'].includes(existente.estado))
        throw new ConflictException('Este periodo está en revisión, aprobado o no aplica. No puede sobrescribirse.');
      if(r.revision_esperada!==(existente?.revision_actual??0))
        throw new ConflictException('La revisión cambió. Actualiza el calendario antes de guardar.');
      if(existente && r.motivo.trim().length<10)
        throw new BadRequestException('Documenta el motivo de corrección (mínimo 10 caracteres).');
      if(r.estado==='EN_REVISION' && config.requiere_evidencia && !adjunto)
        throw new BadRequestException('Este indicador requiere evidencia para enviar a revisión.');
      const now=new Date();
      const referencia=JSON.stringify({
        tipo:'CAPTURA_HISTORICA_CALENDARIO',
        fuente:r.fuente,fecha_documento:r.fecha_documento,
        periodo_inicio:periodo.inicio,periodo_fin:periodo.fin,
      });
      const values={
        configuracion_id:configId,fecha_limite_captura:date(periodo.limite),
        valor_numerico:r.valor_numerico,valor_booleano:r.valor_booleano,
        valor_opcion:r.valor_opcion,datos_base:r.datos_base,
        origen:'MANUAL' as const,referencia_origen:referencia,
        estado:r.estado,evaluacion:r.evaluacion,
        observaciones:r.observaciones,analisis:r.analisis,
        acciones_propuestas:r.acciones_propuestas,
        justificacion_no_aplica:null,
        capturado_por:user.usuario,capturado_en:now,
        revisado_por:null,revisado_en:null,actualizado_en:now,
      };
      let resultado:kpi_resultados;
      if(existente){
        resultado=await tx.kpi_resultados.update({
          where:{id_Resultado:existente.id_Resultado},
          data:{...values,revision_actual:existente.revision_actual+1},
        });
      }else{
        resultado=await tx.kpi_resultados.create({
          data:{
            ...values,indicador_id:indicadorId,
            periodo_inicio:date(periodo.inicio),periodo_fin:date(periodo.fin),
            revision_actual:1,
          },
        });
      }
      const snapshot=JSON.stringify({
        periodo_inicio:periodo.inicio,periodo_fin:periodo.fin,
        fecha_limite_captura:periodo.limite,indicador_id:indicadorId,
        configuracion_id:configId,version_configuracion:config.version,
        tipo_dato:config.tipo_dato,unidad:config.unidad,
        metodo_calculo:config.metodo_calculo,
        valor_numerico:r.valor_numerico?.toString()??null,
        valor_booleano:r.valor_booleano,valor_opcion:r.valor_opcion,
        datos_base:r.datos_base?JSON.parse(r.datos_base):null,
        fuente:r.fuente,fecha_documento:r.fecha_documento,
        observaciones:r.observaciones,analisis:r.analisis,
        acciones_propuestas:r.acciones_propuestas,evaluacion:r.evaluacion,
        estado:r.estado,origen:'MANUAL',
        evidencia:adjunto?{nombre:adjunto.nombre,mime:adjunto.mime,bytes:adjunto.buffer.length}:null,
      });
      const h=await tx.kpi_resultado_historial.create({
        data:{
          resultado_id:resultado.id_Resultado,revision:resultado.revision_actual,
          accion:existente?'CORRECCION':'CREACION',datos_revision:snapshot,
          motivo:r.motivo,realizado_por:user.usuario,realizado_en:now,
        },
      });
      if(adjunto){
        await tx.kpi_evidencias.create({
          data:{
            historial_id:h.id_Historial,nombre_original:adjunto.nombre,
            tipo_mime:adjunto.mime,contenido:new Uint8Array(adjunto.buffer),
            descripcion:'Respaldo de resultado histórico',
            subido_por:user.usuario,subido_en:now,
          },
        });
      }
      return {
        success:true,id:resultado.id_Resultado,revision:resultado.revision_actual,
        estado:resultado.estado,evaluacion:resultado.evaluacion,
        periodo_inicio:periodo.inicio,periodo_fin:periodo.fin,
      };
    },{timeout:20000});
  }

  async aprobar(id:number, body:Record<string,unknown>, user:Usuario) {
    if(user.area!=='seguridad')throw new ForbiddenException('Solo SHyMA puede revisar indicadores.');
    if(!Number.isSafeInteger(id)||id<=0)throw new BadRequestException('Resultado inválido.');
    const motivo=String(body.motivo??'').trim();
    if(motivo.length<10||motivo.length>2000)
      throw new BadRequestException('La aprobación requiere justificación de 10 a 2000 caracteres.');
    const esperado=Number(body.revision_esperada);
    if(!Number.isSafeInteger(esperado)||esperado<=0)
      throw new BadRequestException('Revisión esperada inválida.');
    return this.prisma.$transaction(async tx=>{
      const lock=await tx.$queryRawUnsafe<Array<{id_Resultado:number}>>(
        'SELECT "id_Resultado" FROM kpi_resultados WHERE "id_Resultado"=$1 FOR UPDATE',id,
      );
      if(!lock.length)throw new NotFoundException('Resultado no encontrado.');
      const r=await tx.kpi_resultados.findUnique({
        where:{id_Resultado:id},include:{kpi_configuraciones:true},
      });
      if(!r)throw new NotFoundException('Resultado no encontrado.');
      if(r.revision_actual!==esperado||r.estado!=='EN_REVISION')
        throw new ConflictException('La revisión cambió o no está pendiente de aprobación.');
      if(r.capturado_por===user.usuario)
        throw new ForbiddenException('Quien captura no puede aprobar su propio registro.');
      const previo=await tx.kpi_resultado_historial.findUnique({
        where:{resultado_id_revision:{resultado_id:id,revision:r.revision_actual}},
        include:{kpi_evidencias:true},
      });
      if(!previo)throw new ConflictException('Falta el historial de la medición.');
      if(r.kpi_configuraciones.requiere_evidencia && !previo.kpi_evidencias.length)
        throw new ConflictException('La revisión actual no tiene evidencia requerida.');
      const evaluacion=evaluate(r.kpi_configuraciones as any,r as any);
      if(evaluacion==='NO_EVALUABLE')
        throw new ConflictException('La medición no puede evaluarse con su configuración.');
      const now=new Date(),revision=r.revision_actual+1;
      await tx.kpi_resultados.update({
        where:{id_Resultado:id},data:{
          estado:'APROBADO',evaluacion,revisado_por:user.usuario,
          revisado_en:now,revision_actual:revision,actualizado_en:now,
        },
      });
      const historia=await tx.kpi_resultado_historial.create({
        data:{
          resultado_id:id,revision,accion:'APROBACION',
          realizado_por:user.usuario,realizado_en:now,motivo,
          datos_revision:JSON.stringify({
            estado:'APROBADO',evaluacion,revision_de_captura:previo.revision,
            indicador_id:r.indicador_id,configuracion_id:r.configuracion_id,
            valor_numerico:r.valor_numerico?.toString()??null,
            valor_booleano:r.valor_booleano,valor_opcion:r.valor_opcion,
            aprobado_por:user.usuario,aprobado_en:now.toISOString(),
          }),
        },
      });
      // Mantener las evidencias en la revisión actual para la matriz del KPI.
      for(const e of previo.kpi_evidencias) {
        await tx.kpi_evidencias.create({
          data:{
            historial_id:historia.id_Historial,nombre_original:e.nombre_original,
            tipo_mime:e.tipo_mime,contenido:e.contenido,
            descripcion:'Evidencia revisada y aprobada (revisión '+previo.revision+')',
            subido_por:user.usuario,subido_en:now,
          },
        });
      }
      return {success:true,id,revision,estado:'APROBADO',evaluacion};
    },{timeout:20000});
  }
}
