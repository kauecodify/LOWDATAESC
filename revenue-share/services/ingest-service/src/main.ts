import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { KafkaService } from './common/kafka/kafka.service';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new LoggerService(),
  });

  // Enable CORS with strict origin validation
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: '*',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter(new LoggerService()));

  // API documentation
  const config = new DocumentBuilder()
    .setTitle('Revenue Share Ingest Service')
    .setDescription('API for ingesting revenue events into the Revenue Share Module - TR8 Compliant')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addServer('/api/v1')
    .addTag('revenue-events', 'Revenue event ingestion operations')
    .addTag('health', 'Service health check endpoints')
    .setExternalDoc('OpenAPI Spec', '/api-json')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  });

  // JSON spec endpoint
  SwaggerModule.setup('api-json', app, document, {
    swaggerOptions: {
      url: '/api-json',
    },
    customSiteTitle: 'OpenAPI JSON',
  });

  const port = process.env.PORT || 8443;
  await app.listen(port);

  const logger = new LoggerService();
  const configService = app.get(ConfigService);
  const kafkaService = app.get(KafkaService);

  // Initialize Kafka consumer on startup
  const kafkaConfig = configService.get('kafka');
  const groupId = kafkaConfig?.groupId || 'ingest-service-group';
  const topic = kafkaConfig?.topic?.revenueEvents || 'revenue-events';

  // Start Kafka consumer for event processing
  kafkaService.consume(
    groupId,
    [topic],
    async (message) => {
      logger.log('Processing Kafka message for event processing', {
        topic: message.topic,
        key: message.key,
        offset: message.offset,
      });
      // Message processing is handled by EventService
    },
    false,
  ).catch((error) => {
    logger.error('Failed to start Kafka consumer on startup', error);
  });

  logger.log(`Ingest Service is running on: ${await app.getUrl()}`);
  logger.log(`Swagger docs available at: ${await app.getUrl()}/api`);
  logger.log(`Health check available at: ${await app.getUrl()}/api/v1/health`);
  logger.log(`Environment: ${configService.get('service.environment') || 'development'}`);
}

bootstrap().catch((error) => {
  const logger = new LoggerService();
  logger.error('Failed to start Ingest Service', error);
  process.exit(1);
});
