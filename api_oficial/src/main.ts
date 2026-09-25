import { Logger } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ErrorExceptionFilter } from './@core/infra/filters/error-exception.filter';
import { PrismaClienteExceptionFilter } from './@core/infra/filters/prisma.filter';
import {
  DocumentBuilder,
  SwaggerDocumentOptions,
  SwaggerModule,
} from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('MainServer');
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (allowedOrigins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must be configured');
  }
  app.enableCors({ origin: allowedOrigins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new ErrorExceptionFilter());
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaClienteExceptionFilter(httpAdapter));

  if (process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Mult100 Router API')
      .setDescription('API')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addSecurityRequirements('bearer')
      .build();
    const options: SwaggerDocumentOptions = {};
    const document = SwaggerModule.createDocument(app, config, options);
    SwaggerModule.setup('swagger', app, document);
  }

  const port = Number(process.env.PORT || 6000);
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 Servidor API Oficial iniciado na porta ${port}`);
}
bootstrap();
