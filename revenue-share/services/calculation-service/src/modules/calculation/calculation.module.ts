import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalculationService } from './services/calculation.service';
import { CalculationController } from './calculation.controller';
import { CalculationRepository } from './calculation.repository';
import { Calculation, CalculationResult, DistributionRule } from './entities/calculation.entity';
import { KafkaModule } from '../../common/kafka/kafka.module';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import { LoggerModule } from '../../common/logger/logger.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Calculation, CalculationResult, DistributionRule]),
    KafkaModule,
    IdempotencyModule,
    LoggerModule,
  ],
  controllers: [CalculationController],
  providers: [
    CalculationService,
    CalculationRepository,
  ],
  exports: [
    CalculationService,
    CalculationRepository,
  ],
})
export class CalculationModule {}
