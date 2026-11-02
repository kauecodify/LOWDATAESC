import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KafkaService } from './kafka.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'KAFKA_CONFIG',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const kafkaConfig = configService.get('kafka');
        return {
          brokers: kafkaConfig.brokers || ['kafka:9092'],
          clientId: kafkaConfig.clientId || 'ingest-service',
          groupId: kafkaConfig.groupId || 'ingest-service-group',
          ssl: kafkaConfig.ssl || false,
          sasl: kafkaConfig.sasl || { mechanism: 'plain', username: '', password: '' },
          retries: kafkaConfig.retries || 3,
          retryDelay: kafkaConfig.retryDelay || 1000,
        };
      },
    },
    KafkaService,
  ],
  exports: [KafkaService],
})
export class KafkaModule {}
