import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SplitController } from './split.controller';
import { SplitService } from './services/split.service';
import { SplitRepository } from './split.repository';
import { SplitTransaction, SplitEscrowAccount, TaxRateCache, SplitAuditLog } from './entities/split-transaction.entity';
import { LoggerModule } from '../../common/logger/logger.module';
import { KafkaModule } from '../../common/kafka/kafka.module';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import { GrpcModule } from '../../common/grpc/grpc.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      SplitTransaction,
      SplitEscrowAccount,
      TaxRateCache,
      SplitAuditLog,
    ]),
    LoggerModule,
    KafkaModule,
    IdempotencyModule,
    GrpcModule,
  ],
  controllers: [SplitController],
  providers: [
    SplitService,
    SplitRepository,
    ConfigService,
  ],
  exports: [
    SplitService,
    SplitRepository,
  ],
})
export class SplitModule {}
