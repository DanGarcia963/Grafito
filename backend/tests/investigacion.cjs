// Ejecutar desde backend: node tests/investigacion.cjs (requiere typescript y dependencias del proyecto).
const ts=require('typescript'),fs=require('fs'),assert=require('node:assert/strict'),crypto=require('crypto');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true}}).outputText,f);
require('reflect-metadata');
const {metricas,fichaValida}=require('../src/investigacion/id.logic.ts');
const {AuthService}=require('../src/auth/auth.service.ts');
const {InvestigacionService}=require('../src/investigacion/id.service.ts');
(async()=>{
 const m=metricas({disponible_desde:new Date(0),inicio:new Date(60000),fin:new Date(240000),estandar_segundos:120});
 assert.deepEqual(m,{duracionSegundos:180,esperaSegundos:60,desviacionSegundos:60,desviacionPorcentaje:50});
 assert.equal(metricas({inicio:new Date(),fin:null,disponible_desde:null,estandar_segundos:null}).duracionSegundos,null);
 assert.throws(()=>fichaValida({originalname:'falso.pdf',size:4,buffer:Buffer.from('xxxx')}));
 const password=crypto.randomBytes(16).toString('hex'),salt=crypto.randomBytes(16).toString('hex');
 process.env.UST_USUARIOS_JSON=JSON.stringify([{usuario:'prueba',personaId:1,areas:['ventas'],salt,hash:crypto.scryptSync(password,salt,64).toString('hex')}]);
 const auth=new AuthService();assert.throws(()=>auth.login({usuario:'prueba',password,area:'id'},'test'));
 const s=auth.login({usuario:'prueba',password,area:'ventas'},'test');assert.equal(auth.verificar(s.token).area,'ventas');auth.salir(s.token);assert.throws(()=>auth.verificar(s.token));
 const user={usuario:'laboratorio',area:'id',personaId:1,expira:Date.now()+10000};
 let sample={id_Muestra:1,area_Muestra:'INVESTIGACION_DESARROLLO',estado_Muestra:'PENDIENTE',fecha_ingreso_laboratorio:new Date(),procesos_id:[]};
 const catalog={id:1,nombre:'Filtración',estandar_segundos:120,version:1,activo:true};
 let emitted=0;
 const tx={
  $queryRaw:async()=>[],
  muestras:{findFirst:async({where})=>where.vendedor_id&&where.vendedor_id!==2?null:sample,update:async({data})=>Object.assign(sample,data)},
  id_procesos:{findMany:async()=>[catalog]},
  id_ejecuciones:{deleteMany:async()=>{sample.procesos_id=[]},createMany:async({data})=>{sample.procesos_id=data.map((p,i)=>({...p,id:i+1,inicio:null,fin:null}));},update:async({where,data})=>Object.assign(sample.procesos_id.find(p=>p.id===where.id),data)}
 };
 const service=new InvestigacionService({$transaction:async fn=>fn(tx)}, {notificar:()=>emitted++}, {evento:async()=>{},transicion:async()=>({id:1})});
 await service.planificar(1,{procesos:[1,1]},user);
 catalog.estandar_segundos=999;assert.equal(sample.procesos_id[0].estandar_segundos,120);
 const before=emitted;await assert.rejects(service.proceso(1,2,'iniciar',{},user));assert.equal(emitted,before);
 await assert.rejects(service.proceso(1,1,'iniciar',{}, {...user,area:'ventas',personaId:3}));
 await service.proceso(1,1,'iniciar',{},user);const start=sample.procesos_id[0].inicio;
 await service.proceso(1,1,'iniciar',{},user);assert.equal(sample.procesos_id[0].inicio,start);
 await assert.rejects(service.finalizar(1,{dictamen:'APROBADO'},user));
 await service.proceso(1,1,'terminar',{resultado:'Conforme'},user);assert.ok(sample.procesos_id[1].disponible_desde);
 await service.proceso(1,2,'iniciar',{},user);await service.proceso(1,2,'terminar',{resultado:'Conforme'},user);
 await service.finalizar(1,{dictamen:'APROBADO'},user);assert.equal(sample.estado_Muestra,'APROBADO');
 console.log('OK: métricas, archivos, autorización, estándar histórico, orden, idempotencia y cierre.');
})().catch(e=>{console.error(e);process.exitCode=1});
