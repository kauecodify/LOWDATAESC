import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { SettlementInstruction, EscrowAccount, Transaction, Reconciliation } from '../liquidacao/entities/settlement.entity';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule } from '../../common/kafka/kafka.module';
import { LoggerModule } from '../../common/logger/logger.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      SettlementInstruction,
      EscrowAccount,
      Transaction,
      Reconciliation,
    ]),
    KafkaModule,
    LoggerModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
