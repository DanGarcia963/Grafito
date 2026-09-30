import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { allowedOrigins, corsOptions, integerEnv } from './config/runtime';

async function bootstrap() {
  allowedOrigins();
  const app = await NestFactory.create(AppModule);
  app.enableCors(corsOptions);
  app.enableShutdownHooks();
  const port = integerEnv('PORT', 4002);
  await app.listen(port, process.env.HOST || '0.0.0.0');
  console.log(`Backend escuchando en el puerto ${port}`);
}
bootstrap().catch(error => { console.error('No se pudo iniciar el backend:', error.message); process.exitCode = 1; });
