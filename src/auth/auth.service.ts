import { Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
export type Area = 'produccion' | 'calidad' | 'id' | 'ventas';
export type Usuario = { usuario: string; area: Area; personaId: number; expira: number };
@Injectable()
export class AuthService {
 private readonly sesiones = new Map<string, Usuario>();
 private readonly intentos = new Map<string, { n: number; hasta: number }>();
 login(body: any, origen: string) {
  let cuentas: any[];
  try { cuentas = JSON.parse(process.env.UST_USUARIOS_JSON || '[]'); if (!Array.isArray(cuentas) || !cuentas.length) throw new Error(); }
  catch { throw new ServiceUnavailableException('Configura las cuentas del servidor antes de iniciar sesión.'); }
  const ahora=Date.now();
  for (const [k,v] of this.sesiones) if(v.expira<=ahora)this.sesiones.delete(k);
  for (const [k,v] of this.intentos) if(v.hasta<=ahora)this.intentos.delete(k);
  const clave=String(origen);
  const intento=this.intentos.get(clave) || {n:0,hasta:ahora+60000};
  if(intento.n>=10)throw new UnauthorizedException('Demasiados intentos. Espera un minuto.');
  intento.n++;this.intentos.set(clave,intento);
  const cuenta=cuentas.find(c=>c.usuario===String(body?.usuario??'').trim() && Array.isArray(c.areas) && c.areas.includes(body?.area));
  if(!cuenta || typeof body?.password!=='string' || body.password.length>256 || !['calidad','id','ventas','produccion'].includes(body?.area))throw new UnauthorizedException('Usuario, área o contraseña incorrectos.');
  const esperado=Buffer.from(String(cuenta.hash),'hex');
  const actual=scryptSync(body.password,String(cuenta.salt),64);
  if(esperado.length!==actual.length || !timingSafeEqual(actual,esperado))throw new UnauthorizedException('Usuario, área o contraseña incorrectos.');
  if(!Number.isSafeInteger(cuenta.personaId)||cuenta.personaId<=0)throw new ServiceUnavailableException('La cuenta no tiene una persona asignada.');
  const sesion:Usuario={usuario:cuenta.usuario,area:body.area,personaId:cuenta.personaId,expira:ahora+8*60*60*1000};
  const token=randomBytes(32).toString('hex');this.sesiones.set(token,sesion);this.intentos.delete(clave);
  return {success:true,token,...sesion};
 }
 verificar(token: unknown): Usuario {
  const sesion=typeof token==='string'?this.sesiones.get(token):undefined;
  if(!sesion || sesion.expira<=Date.now())throw new UnauthorizedException('Inicia sesión nuevamente.');
  return sesion;
 }
 salir(token:string){this.sesiones.delete(token);return {success:true};}
}
