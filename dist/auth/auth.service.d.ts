export type Area = 'produccion' | 'calidad' | 'id' | 'ventas';
export type Usuario = {
    usuario: string;
    area: Area;
    personaId: number;
    expira: number;
};
export declare class AuthService {
    private readonly sesiones;
    private readonly intentos;
    login(body: any, origen: string): {
        usuario: string;
        area: Area;
        personaId: number;
        expira: number;
        success: boolean;
        token: string;
    };
    verificar(token: unknown): Usuario;
    salir(token: string): {
        success: boolean;
    };
}
