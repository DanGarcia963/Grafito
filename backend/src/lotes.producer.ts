import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class LotesProducer {
  constructor(@InjectQueue('cola-lotes') private readonly lotesQueue: Queue) {}

  async agregarTareaCrearLote(datosLote: any) {
    // Agrega el objeto completo a la cola de BullMQ en lugar de solo la cadena 'noLote'
    const job = await this.lotesQueue.add('procesar-lote', datosLote);
    return job;
  }
}