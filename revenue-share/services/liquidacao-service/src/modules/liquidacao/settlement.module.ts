import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SettlementController } from './settlement.controller';
import { SettlementService } from './services/settlement.service';
import { SettlementRepository } from './settlement.repository';
import { SettlementInstruction, EscrowAccount, Transaction, Reconciliation } from './entities/settlement.entity';
import { LoggerModule } from '../../common/logger/logger.module';
import { KafkaModule } from '../../common/kafka/kafka.module';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import { GrpcModule } from '../../common/grpc/grpc.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      SettlementInstruction,
      EscrowAccount,
      Transaction,
      Reconciliation,
    ]),
    LoggerModule,
    KafkaModule,
    IdempotencyModule,
    GrpcModule,
  ],
  controllers: [SettlementController],
  providers: [
    SettlementService,
    SettlementRepository,
    ConfigService,
  ],
  exports: [
    SettlementService,
    SettlementRepository,
  ],
})
export class SettlementModule {}
