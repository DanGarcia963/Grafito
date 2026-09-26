import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, Area } from './auth.service';
export declare const Areas: (...areas: Area[]) => import("@nestjs/common", { with: { "resolution-mode": "import" } }).CustomDecorator<string>;
export declare class AuthGuard implements CanActivate {
    private auth;
    private reflector;
    constructor(auth: AuthService, reflector: Reflector);
    canActivate(ctx: ExecutionContext): boolean;
}
