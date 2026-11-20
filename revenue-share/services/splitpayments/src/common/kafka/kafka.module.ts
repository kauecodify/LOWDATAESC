import { Module } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [LoggerModule],
  providers: [KafkaService],
  exports: [KafkaService],
})
export class KafkaModule {}
