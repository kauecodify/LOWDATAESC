import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { KafkaService } from './common/kafka/kafka.service';
import { ConfigService } from '@nestjs/config';
import { GrpcService } from './common/grpc/grpc.service';

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
    .setTitle('Revenue Share Liquidação Service')
    .setDescription('API for settlement operations with LOWDATAESC integration - TR8 Compliant')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addServer('/api/v1')
    .addTag('liquidacao', 'Settlement operations')
    .addTag('escrow', 'Escrow account operations')
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

  const port = process.env.PORT || 8445;
  await app.listen(port);

  const logger = new LoggerService();
  const configService = app.get(ConfigService);
  const kafkaService = app.get(KafkaService);
  const grpcService = app.get(GrpcService);

  // Initialize gRPC client for LOWDATAESC
  grpcService.initialize().catch((error) => {
    logger.error('Failed to initialize gRPC client', error);
  });

  // Initialize Kafka consumer on startup
  const kafkaConfig = configService.get('kafka');
  const groupId = kafkaConfig?.groupId || 'liquidacao-service-group';
  const topics = [
    kafkaConfig?.topic?.settlementInstructions || 'settlement-instructions',
    kafkaConfig?.topic?.settlementResults || 'settlement-results',
  ];

  // Start Kafka consumers for event processing
  for (const topic of topics) {
    kafkaService.consume(
      `${groupId}-${topic}`,
      [topic],
      async (message) => {
        logger.log('Processing Kafka message for settlement', {
          topic: message.topic,
          key: message.key,
          offset: message.offset,
        });
        // Message processing is handled by LiquidaçãoService
      },
      false,
    ).catch((error) => {
      logger.error(`Failed to start Kafka consumer for topic: ${topic}`, error);
    });
  }

  logger.log(`Liquidação Service is running on: ${await app.getUrl()}`);
  logger.log(`Swagger docs available at: ${await app.getUrl()}/api`);
  logger.log(`Health check available at: ${await app.getUrl()}/api/v1/health`);
  logger.log(`gRPC server running on: ${configService.get('grpc.server.host')}:${configService.get('grpc.server.port')}`);
  logger.log(`Environment: ${configService.get('service.environment') || 'development'}`);
}

bootstrap().catch((error) => {
  const logger = new LoggerService();
  logger.error('Failed to start Liquidação Service', error);
  process.exit(1);
});
