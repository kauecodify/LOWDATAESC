import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { LoggerModule } from '../../common/logger/logger.module';
import { KafkaModule } from '../../common/kafka/kafka.module';
import { GrpcModule } from '../../common/grpc/grpc.module';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';

@Module({
  imports: [LoggerModule, KafkaModule, GrpcModule, IdempotencyModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
