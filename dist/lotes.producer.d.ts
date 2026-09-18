import { Queue } from 'bullmq';
export declare class LotesProducer {
    private readonly lotesQueue;
    constructor(lotesQueue: Queue);
    agregarTareaCrearLote(datosLote: any): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
}
