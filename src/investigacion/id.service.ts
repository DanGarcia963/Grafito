import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { abierta, bloquearOportunidad, cerradas, eventoCrm, reiniciarTecnico } from '../ventas/crm.workflow';
import { randomUUID } from 'crypto';
import { Prisma, muestras_estado_Muestra, productos_materiales_UM } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events.gateway';
import { TrazabilidadService } from '../trazabilidad/trazabilidad.service';
import { Usuario } from '../auth/auth.service';
import { texto, idValido, estandar, metricas, fichaValida, analisisEstructuradoValido, procesamientoEstructuradoValido } from './id.logic';
const seleccion = {id_Muestra:true,no_Muestra:true,area_Muestra:true,
  crm_oportunidades:{select:{etapa:true}},oportunidad_id:true,estado_Muestra:true,categoria_Muestra:true,etapa_Muestra:true,
 producto_id:true,cliente_id:true,vendedor_id:true,caracterizacion:true,
 id_flujo_estructurado:true,id_analisis_preliminar:true,id_procesamiento:true,id_analisis_final:true,
 cantidad_proyecto:true,unidad_proyecto:true,
 viabilidad_nombre:true,viabilidad_id:true,fecha_recoleccion:true,
 fecha_ingreso_laboratorio:true,ficha_nombre:true,observaciones:true,
 productos_materiales:{select:{nombre_Producto:true}},
 personas_muestras_cliente_idTopersonas:{select:{nombre:true}},
 personas_muestras_vendedor_idTopersonas:{select:{nombre:true}},
 id_ejecuciones:{select:{id:true,ciclo:true,orden:true,nombre:true,
  estandar_segundos:true,estandar_version:true,disponible_desde:true,
  inicio:true,fin:true,inicio_por:true,fin_por:true,resultado:true},
  orderBy:[{ciclo:'asc' as const},{orden:'asc' as const}]}
} satisfies Prisma.muestrasSelect;
@Injectable()
export class InvestigacionService {
 constructor(private prisma:PrismaService,private eventos:EventsGateway,private tiempos:TrazabilidadService){}
 private filtro(u:Usuario):Prisma.muestrasWhereInput{return {area_Muestra:'INVESTIGACION_DESARROLLO',...(u.area==='ventas'?{vendedor_id:u.personaId}:{})};}
 private async muestra(db:Prisma.TransactionClient,id:number,u:Usuario){
  const m=await db.muestras.findFirst({where:{...this.filtro(u),id_Muestra:id},select:seleccion});
  if(!m)throw new NotFoundException('Muestra de I+D no encontrada');return m;
 }
 private async bloquear(tx:Prisma.TransactionClient,id:number,u:Usuario){
  const ref=await tx.muestras.findFirst({where:{...this.filtro(u),id_Muestra:id},select:{oportunidad_id:true}});
  if(ref?.oportunidad_id){await bloquearOportunidad(tx,ref.oportunidad_id,u);}
  await tx.$queryRaw`SELECT "id_Muestra" FROM muestras WHERE "id_Muestra"=${id} FOR UPDATE`;
 }
 private ctx(id:number){return {entidad:'MUESTRA_ID' as const,entidad_id:id};}
 private avisar(id:number){this.eventos.notificar('ID_MUESTRA_ACTUALIZADA',{id_Muestra:id});}
 
 async catalogos(){return {success:true,
  viabilidades:await this.prisma.id_viabilidades.findMany({orderBy:{nombre:'asc'}}),
  procesos:await this.prisma.id_procesos.findMany({orderBy:{nombre:'asc'}})};}
 async referencias(q:string){
  const whereNombre={contains:String(q||'').slice(0,100),mode:'insensitive' as const};
  return {success:true,productos:await this.prisma.productos_materiales.findMany({where:{nombre_Producto:whereNombre},select:{id_Produc_Mater:true,nombre_Producto:true,UM:true},take:50}),
   clientes:await this.prisma.personas.findMany({where:{tipo_persona:{in:['CLIENTE','PROSPECTO'],mode:'insensitive'},nombre:whereNombre},select:{id_Persona:true,nombre:true},take:50})};
 }
 async crearProducto(body:any,u:Usuario){
  const nombre=texto(body?.nombre,150);
  if(!Object.values(productos_materiales_UM).includes(body?.UM))throw new BadRequestException('Unidad de medida inválida');
  const producto=await this.prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${nombre.toLocaleLowerCase('es-MX')}))::text`;
   const existente=await tx.productos_materiales.findFirst({where:{nombre_Producto:{equals:nombre,mode:'insensitive'}}});
   if(existente){if(existente.UM!==body.UM)throw new BadRequestException('Ya existe un producto con ese nombre y otra unidad; selecciónalo del catálogo.');return existente;}
   const creado=await tx.productos_materiales.create({data:{nombre_Producto:nombre,UM:body.UM as productos_materiales_UM}});
   await this.tiempos.evento(tx,{entidad:'MUESTRA_ID',entidad_id:0},1,'PRODUCTO_CATALOGO_CREADO',{id:creado.id_Produc_Mater,nombre:creado.nombre_Producto,usuario:u.usuario});
   return creado;
  });
  return {success:true,data:producto};
 }
 async guardarCatalogo(tipo:'proceso'|'viabilidad',body:any,u:Usuario){
  const nombre=texto(body?.nombre),activo=body.activo==null?true:body.activo;
  if(typeof activo!=='boolean')throw new BadRequestException('Activo debe ser booleano');
  const id=body.id==null?null:idValido(body.id);
  const result=await this.prisma.$transaction(async tx=>{
   let row:any;
   if(tipo==='proceso'){
    const data={nombre,activo,estandar_segundos:estandar(body.estandar_segundos)};
    row=id?await tx.id_procesos.update({where:{id},data:{...data,version:{increment:1}}}):await tx.id_procesos.create({data});
   }else row=id?await tx.id_viabilidades.update({where:{id},data:{nombre,activo}}):await tx.id_viabilidades.create({data:{nombre,activo}});
   await this.tiempos.evento(tx,{entidad:'MUESTRA_ID',entidad_id:0},1,'CATALOGO_ACTUALIZADO',{tipo,id:row.id,usuario:u.usuario,nombre});
   return row;
  });this.eventos.notificar('ID_CATALOGO_ACTUALIZADO',{});return {success:true,data:result};
 }
 async crear(body:any,file:Parameters<typeof fichaValida>[0],u:Usuario){
  const f=fichaValida(file),producto=idValido(body.producto_id),cliente=idValido(body.cliente_id),viabilidad=idValido(body.viabilidad_id);
  if(!['FILTRACION','REGENERACION'].includes(body.caracterizacion))throw new BadRequestException('Caracterización inválida');
  const cantidad=String(body.cantidad_proyecto??'');
  if(!/^\d{1,10}(\.\d{1,4})?$/.test(cantidad)||Number(cantidad)<=0)throw new BadRequestException('Cantidad positiva con hasta 4 decimales');
  const unidad=texto(body.unidad_proyecto,30),recoleccion=new Date(body.fecha_recoleccion);
  if(isNaN(+recoleccion)||+recoleccion>Date.now())throw new BadRequestException('Fecha de recolección inválida o futura');
  const result=await this.prisma.$transaction(async tx=>{
   const oportunidad=await bloquearOportunidad(tx,idValido(body.oportunidad_id),u);abierta(oportunidad);
   if(oportunidad.persona_id!==cliente)throw new BadRequestException('La muestra debe pertenecer a la cuenta de la oportunidad');
   const [prod,cli,vend,v]=await Promise.all([tx.productos_materiales.findUnique({where:{id_Produc_Mater:producto}}),tx.personas.findFirst({where:{id_Persona:cliente,tipo_persona:{in:['CLIENTE','PROSPECTO'],mode:'insensitive'}}}),tx.personas.findUnique({where:{id_Persona:u.personaId}}),tx.id_viabilidades.findFirst({where:{id:viabilidad,activo:true}})]);
   if (!prod) throw new BadRequestException(`Producto no encontrado para id: ${producto}`);
if (!cli) throw new BadRequestException(`Prospecto o cliente no encontrado para id: ${cliente}`);
if (!vend) throw new BadRequestException(`Vendedor (personaId: ${u.personaId}) no encontrado`);
if (!v) throw new BadRequestException(`Viabilidad no encontrada o inactiva para id: ${viabilidad}`);
   // Solo aceptar campos explícitos. lote_id, tanque_id y procedencia_Origen quedan NULL.
   const m=await tx.muestras.create({data:{oportunidad_id:oportunidad.id,no_Muestra:`ID-${randomUUID()}`,area_Muestra:'INVESTIGACION_DESARROLLO',producto_id:producto,cliente_id:cliente,vendedor_id:u.personaId,
    fecha_Toma:recoleccion,Hora_Toma:recoleccion,fecha_recoleccion:recoleccion,caracterizacion:body.caracterizacion,cantidad_proyecto:new Prisma.Decimal(cantidad),unidad_proyecto:unidad,
    viabilidad_id:viabilidad,viabilidad_nombre:v.nombre,ficha_nombre:f.nombre,ficha_mime:f.mime,ficha_contenido:new Uint8Array(file!.buffer),id_flujo_estructurado:true,observaciones:body.observaciones?texto(body.observaciones,4000):null},select:{id_Muestra:true}});
   await reiniciarTecnico(tx,oportunidad,u,`Muestra registrada: ${m.id_Muestra}`,{etapa:'MUESTRA_RECOLECTADA',estado_tecnico:'PENDIENTE'});
   const tramo=await this.tiempos.transicion(tx,this.ctx(m.id_Muestra),'TRASLADO');
   await tx.proceso_tramos.update({where:{id:tramo!.id},data:{inicio:recoleccion}});
   await this.tiempos.evento(tx,this.ctx(m.id_Muestra),1,'REGISTRO_VENTAS',{usuario:u.usuario,fechaRecoleccionDeclarada:recoleccion.toISOString()});return m;
  });this.avisar(result.id_Muestra);return {success:true,data:result};
 }
 async listar(u:Usuario,paginaEntrada?:string){
  const pagina=paginaEntrada?idValido(paginaEntrada):1,where=this.filtro(u);
  const resultado=await this.prisma.$transaction(async tx=>{
   const total=await tx.muestras.count({where});
   if(u.area!=='id'){
    const data=await tx.muestras.findMany({where,select:seleccion,orderBy:{id_Muestra:'desc'},take:50,skip:(pagina-1)*50});
    return {total,data,prioridadPorMuestra:new Map<number,string|null>()};
   }
   const ids=await tx.$queryRaw<Array<{id_Muestra:number;prioridad:string|null}>>`
    SELECT m."id_Muestra", o.prioridad::text AS prioridad
    FROM public.muestras AS m
    LEFT JOIN public.crm_oportunidades AS o ON o.id=m.oportunidad_id
    WHERE m."area_Muestra"='INVESTIGACION_DESARROLLO'
    ORDER BY CASE o.prioridad::text
     WHEN 'URGENTE' THEN 0
     WHEN 'ALTA' THEN 1
     WHEN 'MEDIA' THEN 2
     WHEN 'BAJA' THEN 3
     ELSE 4
    END ASC, m."id_Muestra" DESC
    LIMIT ${50} OFFSET ${(pagina-1)*50}
   `;
   const registros=ids.length?await tx.muestras.findMany({where:{...where,id_Muestra:{in:ids.map(x=>x.id_Muestra)}},select:seleccion}):[];
   const porId=new Map(registros.map(m=>[m.id_Muestra,m] as const));
   const prioridadPorMuestra=new Map<number,string|null>();
   for(const row of ids)prioridadPorMuestra.set(row.id_Muestra,row.prioridad);
   const data=ids.flatMap(({id_Muestra})=>{const muestra=porId.get(id_Muestra);return muestra?[muestra]:[];});
   return {total,data,prioridadPorMuestra};
  });
  return {success:true,total:resultado.total,pagina,data:resultado.data.map(m=>({...m,...(u.area==='id'?{prioridad_oportunidad:resultado.prioridadPorMuestra.get(m.id_Muestra)??null}:{}),procesos_id:m.id_ejecuciones.map(p=>({...p,...metricas(p)}))}))};
 }
 async detalle(id:number,u:Usuario){const m=await this.muestra(this.prisma,id,u);return {success:true,data:{...m,procesos_id:m.id_ejecuciones.map(p=>({...p,...metricas(p)})),eventos:await this.prisma.proceso_eventos.findMany({where:{entidad:'MUESTRA_ID',entidad_id:id},orderBy:{id:'desc'},take:500})}};}
 async ficha(id:number,u:Usuario){await this.muestra(this.prisma,id,u);const f=await this.prisma.muestras.findUnique({where:{id_Muestra:id},select:{ficha_contenido:true,ficha_nombre:true,ficha_mime:true}});if(!f?.ficha_contenido)throw new NotFoundException('Sin ficha técnica');return f;}
 async planificar(id:number,body:any,u:Usuario){
  if(!Array.isArray(body?.procesos)||!body.procesos.length||body.procesos.length>50)throw new BadRequestException('Selecciona entre 1 y 50 procesos en orden');
  const ids=body.procesos.map(idValido);
  const result=await this.prisma.$transaction(async tx=>{
   await this.bloquear(tx,id,u);
   const m=await this.muestra(tx,id,u),ciclo=m.id_ejecuciones.at(-1)?.ciclo??1;
   const anteriores=m.id_ejecuciones.filter(p=>p.ciclo===ciclo);
   const nuevo=body.nuevoCiclo===true;
   if(nuevo&&!['APROBADO','RECHAZADO'].includes(m.estado_Muestra))throw new BadRequestException('Finaliza el ciclo antes de abrir otro');
   if(!nuevo&&(anteriores.some(p=>p.inicio)||['APROBADO','RECHAZADO'].includes(m.estado_Muestra)))throw new BadRequestException('El plan ya inició. Abre otro ciclo al finalizar');
   if(nuevo&&!anteriores.length)throw new BadRequestException('No hay un ciclo anterior');
   const num=nuevo?ciclo+1:ciclo;
   const cat=await tx.id_procesos.findMany({where:{id:{in:ids},activo:true}});
   if(ids.some((pid:number)=>!cat.some(c=>c.id===pid)))throw new BadRequestException('Proceso inexistente o inactivo');
   if(!nuevo)await tx.id_ejecuciones.deleteMany({where:{muestra_id:id,ciclo}});
   const ahora=new Date();
   await tx.id_ejecuciones.createMany({data:ids.map((pid:number,i:number)=>{const p=cat.find(c=>c.id===pid)!;return {muestra_id:id,proceso_id:pid,ciclo:num,orden:i+1,nombre:p.nombre,estandar_segundos:p.estandar_segundos,estandar_version:p.version,disponible_desde:i===0?(nuevo?ahora:m.fecha_ingreso_laboratorio):null};})});
   if(nuevo){if(m.oportunidad_id){const o=await bloquearOportunidad(tx,m.oportunidad_id,u);await reiniciarTecnico(tx,o,u,`Nuevo ciclo en muestra ${id}`);}await tx.muestras.update({where:{id_Muestra:id},data:{estado_Muestra:'PENDIENTE',...(m.id_flujo_estructurado?{id_analisis_preliminar:Prisma.DbNull,id_procesamiento:Prisma.DbNull,id_analisis_final:Prisma.DbNull}:{})}});await this.tiempos.transicion(tx,this.ctx(id),'ESPERA_ANALISIS',true);}
   await this.tiempos.evento(tx,this.ctx(id),num,'PLAN_PROCESOS',{usuario:u.usuario,procesos:ids,nuevoCiclo:nuevo});return {success:true};
  });this.avisar(id);return result;
 }
 async recibir(id:number,u:Usuario){
  const r=await this.prisma.$transaction(async tx=>{
   await this.bloquear(tx,id,u);
   const m=await this.muestra(tx,id,u);if(m.fecha_ingreso_laboratorio)return {success:true,repetida:true};
   if(m.id_flujo_estructurado){
    const faltantes=[
     !m.producto_id&&'producto',!m.cliente_id&&'cliente',!m.vendedor_id&&'vendedor',
     !m.viabilidad_id&&'viabilidad',!m.cantidad_proyecto&&'volumen',!m.unidad_proyecto&&'unidad',
     !m.fecha_recoleccion&&'fecha de recolección',!m.ficha_nombre&&'ficha técnica',
    ].filter(Boolean);
    if(faltantes.length)throw new BadRequestException(`No se puede validar la muestra; faltan: ${faltantes.join(', ')}.`);
   }
   if(m.oportunidad_id){const o=await bloquearOportunidad(tx,m.oportunidad_id,u);await eventoCrm(tx,o,u,'RECEPCION_ID',`Recepción de muestra ${id}`,cerradas.includes(o.etapa)?{}:{etapa:'EN_ANALISIS_ID',estado_tecnico:'EN_ANALISIS'});}
   const ahora=new Date();await tx.muestras.update({where:{id_Muestra:id},data:{fecha_ingreso_laboratorio:ahora}});
   await tx.id_ejecuciones.updateMany({where:{muestra_id:id,ciclo:1,orden:1,inicio:null},data:{disponible_desde:ahora}});
   await this.tiempos.transicion(tx,this.ctx(id),'ESPERA_ANALISIS');await this.tiempos.evento(tx,this.ctx(id),1,m.id_flujo_estructurado?'RECEPCION_Y_VALIDACION_ID':'RECEPCION_LABORATORIO',{usuario:u.usuario,...(m.id_flujo_estructurado?{validacionInformacion:['cliente','producto','vendedor','viabilidad','volumen','unidad','fecha_recoleccion','ficha_tecnica']}: {})});return {success:true};
  });this.avisar(id);return r;
 }
 async proceso(id:number,ejecucion:number,accion:'iniciar'|'terminar',body:any,u:Usuario){
  const r=await this.prisma.$transaction(async tx=>{
   await this.bloquear(tx,id,u);
   const m=await this.muestra(tx,id,u);if(!m.fecha_ingreso_laboratorio)throw new BadRequestException('Registra la recepción primero');
   const ciclo=m.id_ejecuciones.at(-1)?.ciclo,lista=m.id_ejecuciones.filter(p=>p.ciclo===ciclo),p=lista.find(p=>p.id===ejecucion);
   if(!p)throw new NotFoundException('Proceso no pertenece al ciclo actual');
   const ahora=new Date();
   if(accion==='iniciar'){
    if(p.inicio)return {success:true,repetida:true};
    if(lista.some(x=>x.orden<p.orden&&!x.fin))throw new BadRequestException('Termina los procesos previos');
    if(['APROBADO','RECHAZADO'].includes(m.estado_Muestra))throw new BadRequestException('Ciclo finalizado');
    await tx.id_ejecuciones.update({where:{id:p.id},data:{inicio:ahora,inicio_por:u.usuario}});
    await tx.muestras.update({where:{id_Muestra:id},data:{estado_Muestra:'EN_ANALISIS'}});
    await this.tiempos.transicion(tx,this.ctx(id),`PROCESO_ID_${p.id}`);
   }else{
    if(p.fin)return {success:true,repetida:true};if(!p.inicio)throw new BadRequestException('Inicia el proceso primero');
    await tx.id_ejecuciones.update({where:{id:p.id},data:{fin:ahora,fin_por:u.usuario,resultado:texto(body?.resultado,8000)}});
    const siguiente=lista.find(x=>x.orden===p.orden+1);
    if(siguiente)await tx.id_ejecuciones.update({where:{id:siguiente.id},data:{disponible_desde:ahora}});
    await this.tiempos.transicion(tx,this.ctx(id),siguiente?'ESPERA_ANALISIS':'ESPERA_DICTAMEN');
   }
   await this.tiempos.evento(tx,this.ctx(id),p.ciclo,accion==='iniciar'?'INICIO_PROCESO':'FIN_PROCESO',{ejecucion:p.id,nombre:p.nombre,usuario:u.usuario});return {success:true};
  });this.avisar(id);return r;
 }
 async guardarAnalisisEstructurado(id:number,body:any,u:Usuario){
  const etapa=String(body?.etapa??'');
  if(!['PRELIMINAR','PROCESAMIENTO','FINAL'].includes(etapa))throw new BadRequestException('Etapa de análisis inválida');
  const result=await this.prisma.$transaction(async tx=>{
   await this.bloquear(tx,id,u);
   const m=await this.muestra(tx,id,u);
   if(!m.id_flujo_estructurado||!m.oportunidad_id)throw new BadRequestException('La muestra no usa el flujo estructurado de I+D');
   if(!m.fecha_ingreso_laboratorio)throw new BadRequestException('I+D debe registrar primero el ingreso al laboratorio');
   if(['APROBADO','RECHAZADO'].includes(m.estado_Muestra))throw new BadRequestException('El ciclo quedó cerrado al emitir dictamen. Abre un nuevo ciclo para registrar otro análisis.');
   const ahora=new Date();
   if(etapa==='PRELIMINAR'){
    if(m.id_procesamiento||m.id_analisis_final)throw new BadRequestException('El análisis preliminar ya no puede editarse después del procesamiento');
    const datos=analisisEstructuradoValido(body.datos);
    const guardado={...datos,registrado_por:u.usuario,registrado_en:ahora.toISOString()};
    await tx.muestras.update({where:{id_Muestra:id},data:{id_analisis_preliminar:guardado}});
    await this.tiempos.evento(tx,this.ctx(id),m.id_ejecuciones.at(-1)?.ciclo??1,'ID_ANALISIS_PRELIMINAR',guardado);
   }else if(etapa==='PROCESAMIENTO'){
    if(!m.id_analisis_preliminar)throw new BadRequestException('Guarda primero la caracterización preliminar');
    if(m.id_analisis_final)throw new BadRequestException('El procesamiento ya no puede editarse después de la caracterización final');
    const datos=procesamientoEstructuradoValido(body.datos);
    if(datos.tipo!==m.caracterizacion)throw new BadRequestException('El procesamiento debe coincidir con la caracterización registrada por Ventas');
    const guardado={...datos,registrado_por:u.usuario,registrado_en:ahora.toISOString()};
    await tx.muestras.update({where:{id_Muestra:id},data:{id_procesamiento:guardado}});
    await this.tiempos.evento(tx,this.ctx(id),m.id_ejecuciones.at(-1)?.ciclo??1,'ID_PROCESAMIENTO_REGISTRADO',guardado);
   }else{
    if(!m.id_procesamiento)throw new BadRequestException('Guarda primero el procesamiento realizado');
    const datos=analisisEstructuradoValido(body.datos);
    const guardado={...datos,registrado_por:u.usuario,registrado_en:ahora.toISOString()};
    await tx.muestras.update({where:{id_Muestra:id},data:{id_analisis_final:guardado}});
    await this.tiempos.evento(tx,this.ctx(id),m.id_ejecuciones.at(-1)?.ciclo??1,'ID_ANALISIS_FINAL',guardado);
   }
   return {success:true};
  });this.avisar(id);return result;
 }
 async finalizar(id:number,body:any,u:Usuario){
  if(!['APROBADO','RECHAZADO'].includes(body?.dictamen))throw new BadRequestException('Dictamen inválido');
  const r=await this.prisma.$transaction(async tx=>{
   await this.bloquear(tx,id,u);
   const m=await this.muestra(tx,id,u);
   if(['APROBADO','RECHAZADO'].includes(m.estado_Muestra))throw new BadRequestException('Ciclo ya finalizado');
   if(m.id_flujo_estructurado&&(!m.id_analisis_preliminar||!m.id_procesamiento||!m.id_analisis_final))throw new BadRequestException('Completa caracterización preliminar, procesamiento y caracterización final antes de dictaminar');
   const ciclo=m.id_ejecuciones.at(-1)?.ciclo,lista=m.id_ejecuciones.filter(p=>p.ciclo===ciclo);
   if(!lista.length||lista.some(p=>!p.fin))throw new BadRequestException('Completa todos los procesos');
   await tx.muestras.update({where:{id_Muestra:id},data:{estado_Muestra:body.dictamen as muestras_estado_Muestra}});
   await this.tiempos.transicion(tx,this.ctx(id),null);
   await this.tiempos.evento(tx,this.ctx(id),ciclo!,'FIN_ANALISIS',{dictamen:body.dictamen,observaciones:body.observaciones?texto(body.observaciones,4000):null,usuario:u.usuario});return {success:true};
  });this.avisar(id);return r;
 }
 async reporte(q:{desde?:string;hasta?:string;pagina?:string}){
  const desde=q.desde?new Date(q.desde):undefined,hasta=q.hasta?new Date(q.hasta):undefined;
  if((desde&&isNaN(+desde))||(hasta&&isNaN(+hasta))||(desde&&hasta&&desde>hasta))throw new BadRequestException('Fechas inválidas');
  const where:Prisma.id_ejecucionesWhereInput={muestras:{area_Muestra:'INVESTIGACION_DESARROLLO'},...(desde||hasta?{inicio:{gte:desde,lt:hasta}}:{})};
  const pagina=q.pagina?idValido(q.pagina):1;
  const [total,data]=await this.prisma.$transaction([this.prisma.id_ejecuciones.count({where}),this.prisma.id_ejecuciones.findMany({where,orderBy:{id:'asc'},take:200,skip:(pagina-1)*200,include:{muestras:{select:{no_Muestra:true,producto_id:true,cliente_id:true}}}})]);
  return {success:true,total,pagina,data:data.map(p=>({...p,...metricas(p)}))};
 }
}
