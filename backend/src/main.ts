import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  
  // Escuchar en '0.0.0.0' expone la app a la red local
  await app.listen(4002, '0.0.0.0'); 
  console.log('Backend escuchando en la red local en el puerto 4002');
}
bootstrap();
