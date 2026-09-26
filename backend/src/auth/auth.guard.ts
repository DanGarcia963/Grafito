import { CanActivate, ExecutionContext, Injectable, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, Area } from './auth.service';
export const Areas=(...areas:Area[])=>SetMetadata('areas_ust',areas);
@Injectable()
export class AuthGuard implements CanActivate {
 constructor(private auth:AuthService,private reflector:Reflector){}
 canActivate(ctx:ExecutionContext){
  const req=ctx.switchToHttp().getRequest();
  req.usuario=this.auth.verificar(String(req.headers.authorization||'').replace(/^Bearer /,''));
  const areas=this.reflector.getAllAndOverride<Area[]>('areas_ust',[ctx.getHandler(),ctx.getClass()]);
  if(areas&&!areas.includes(req.usuario.area))throw new ForbiddenException('Tu área no tiene acceso a esta operación.');
  return true;
 }
}
