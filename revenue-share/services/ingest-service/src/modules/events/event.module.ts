import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { RevenueEventRepository } from './revenue-event.repository';
import { RevenueEvent } from './entities/revenue-event.entity';
import { KafkaModule } from '../../common/kafka/kafka.module';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import { LoggerModule } from '../../common/logger/logger.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([RevenueEvent]),
    KafkaModule,
    IdempotencyModule,
    LoggerModule,
  ],
  controllers: [EventController],
  providers: [
    EventService,
    RevenueEventRepository,
  ],
  exports: [
    EventService,
    RevenueEventRepository,
  ],
})
export class EventModule {}
