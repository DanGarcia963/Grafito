"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let AuthService = class AuthService {
    sesiones = new Map();
    intentos = new Map();
    login(body, origen) {
        let cuentas;
        try {
            cuentas = JSON.parse(process.env.UST_USUARIOS_JSON || '[]');
            if (!Array.isArray(cuentas) || !cuentas.length)
                throw new Error();
        }
        catch {
            throw new common_1.ServiceUnavailableException('Configura las cuentas del servidor antes de iniciar sesión.');
        }
        const ahora = Date.now();
        for (const [k, v] of this.sesiones)
            if (v.expira <= ahora)
                this.sesiones.delete(k);
        for (const [k, v] of this.intentos)
            if (v.hasta <= ahora)
                this.intentos.delete(k);
        const clave = String(origen);
        const intento = this.intentos.get(clave) || { n: 0, hasta: ahora + 60000 };
        if (intento.n >= 10)
            throw new common_1.UnauthorizedException('Demasiados intentos. Espera un minuto.');
        intento.n++;
        this.intentos.set(clave, intento);
        const cuenta = cuentas.find(c => c.usuario === String(body?.usuario ?? '').trim() && Array.isArray(c.areas) && c.areas.includes(body?.area));
        if (!cuenta || typeof body?.password !== 'string' || body.password.length > 256 || !['calidad', 'id', 'ventas', 'produccion'].includes(body?.area))
            throw new common_1.UnauthorizedException('Usuario, área o contraseña incorrectos.');
        const esperado = Buffer.from(String(cuenta.hash), 'hex');
        const actual = (0, crypto_1.scryptSync)(body.password, String(cuenta.salt), 64);
        if (esperado.length !== actual.length || !(0, crypto_1.timingSafeEqual)(actual, esperado))
            throw new common_1.UnauthorizedException('Usuario, área o contraseña incorrectos.');
        if (!Number.isSafeInteger(cuenta.personaId) || cuenta.personaId <= 0)
            throw new common_1.ServiceUnavailableException('La cuenta no tiene una persona asignada.');
        const sesion = { usuario: cuenta.usuario, area: body.area, personaId: cuenta.personaId, expira: ahora + 8 * 60 * 60 * 1000 };
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        this.sesiones.set(token, sesion);
        this.intentos.delete(clave);
        return { success: true, token, ...sesion };
    }
    verificar(token) {
        const sesion = typeof token === 'string' ? this.sesiones.get(token) : undefined;
        if (!sesion || sesion.expira <= Date.now())
            throw new common_1.UnauthorizedException('Inicia sesión nuevamente.');
        return sesion;
    }
    salir(token) { this.sesiones.delete(token); return { success: true }; }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)()
], AuthService);
//# sourceMappingURL=auth.service.js.map