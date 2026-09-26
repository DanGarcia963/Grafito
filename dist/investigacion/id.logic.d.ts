export declare function texto(v: unknown, max?: number): string;
export declare function idValido(v: unknown): number;
export declare function estandar(v: unknown): number | null;
export declare function metricas(t: {
    inicio: Date | null;
    fin: Date | null;
    disponible_desde: Date | null;
    estandar_segundos: number | null;
}): {
    duracionSegundos: number | null;
    esperaSegundos: number | null;
    desviacionSegundos: number | null;
    desviacionPorcentaje: number | null;
};
export declare function fichaValida(file?: {
    buffer: Buffer;
    originalname: string;
    size: number;
}): {
    nombre: string;
    mime: string;
};
