import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { RevenueEvent } from '../events/entities/revenue-event.entity';
import { KafkaModule } from '../../common/kafka/kafka.module';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../../common/logger/logger.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([RevenueEvent]),
    KafkaModule,
    LoggerModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
