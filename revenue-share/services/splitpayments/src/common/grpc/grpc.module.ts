import { Module } from '@nestjs/common';
import { GrpcService } from './grpc.service';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [LoggerModule],
  providers: [GrpcService],
  exports: [GrpcService],
})
export class GrpcModule {}
