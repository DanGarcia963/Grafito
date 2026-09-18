import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('lotes-queue')
export class LotesProcessor extends WorkerHost {
  private readonly logger = new Logger(LotesProcessor.name);

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Procesando lote ID: ${job.id} - No. Lote: ${job.data.noLote}`);

    // Aseguramos que el objeto tenga un estado por defecto si no lo traía
    const loteProcesado = {
      ...job.data,
      estado: job.data.estado || 'PENDIENTE_CALIDAD',
      procesadoEn: new Date().toISOString(),
    };

    // Simulamos un procesamiento asíncrono (por ejemplo, guardar en BD)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    this.logger.log(`Lote ${loteProcesado.noLote} procesado exitosamente.`);

    return loteProcesado;
  }
}