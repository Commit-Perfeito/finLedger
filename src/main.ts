import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.useGlobalFilters(new AllExceptionsFilter());

    app.setGlobalPrefix('api');

    const config = new DocumentBuilder()
      .setTitle('FinLedger API')
      .setDescription('API de ledger financeiro com partidas dobradas')
      .setVersion('1.0')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.PORT || 3000;

    console.log('ANTES DO LISTEN');

    await app.listen(port);

    console.log('DEPOIS DO LISTEN');
  } catch (err) {
    console.error('ERRO NO BOOTSTRAP');
    console.error(err);
  }
}

void bootstrap();
