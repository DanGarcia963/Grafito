"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthGuard = exports.Areas = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const auth_service_1 = require("./auth.service");
const Areas = (...areas) => (0, common_1.SetMetadata)('areas_ust', areas);
exports.Areas = Areas;
let AuthGuard = class AuthGuard {
    auth;
    reflector;
    constructor(auth, reflector) {
        this.auth = auth;
        this.reflector = reflector;
    }
    canActivate(ctx) {
        const req = ctx.switchToHttp().getRequest();
        req.usuario = this.auth.verificar(String(req.headers.authorization || '').replace(/^Bearer /, ''));
        const areas = this.reflector.getAllAndOverride('areas_ust', [ctx.getHandler(), ctx.getClass()]);
        if (areas && !areas.includes(req.usuario.area))
            throw new common_1.ForbiddenException('Tu área no tiene acceso a esta operación.');
        return true;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService, core_1.Reflector])
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map