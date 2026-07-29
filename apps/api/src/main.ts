import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import 'reflect-metadata';

import { configureApp } from './app-setup';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Shared config: helmet, cookie-parser, global prefix, Zod-validated (no global pipe),
  // response envelope + error filter. See app-setup.ts.
  configureApp(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('OSES API')
    .setDescription('On-Screen Exam System API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  app.enableCors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
    credentials: true,
  });

  app.enableShutdownHooks();

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);

  console.log(`OSES API running on http://localhost:${port}/api/v1`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

void bootstrap();
