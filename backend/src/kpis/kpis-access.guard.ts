import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Usuario } from '../auth/auth.service';
export interface KpiScope { all: boolean; areas: number[]; }
export interface KpiRequest { usuario?: Usuario; kpiScope: KpiScope; }
@Injectable()
export class KpisAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<KpiRequest>();
    if (!req.usuario) throw new UnauthorizedException('Se requiere una sesión autenticada.');
    if (req.usuario.area !== 'seguridad') throw new ForbiddenException('Solo Seguridad puede consultar KPIs.');
    req.kpiScope = { all: true, areas: [] };
    return true;
  }
}
