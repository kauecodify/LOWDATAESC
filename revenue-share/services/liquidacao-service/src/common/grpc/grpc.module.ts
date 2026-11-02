import { Module, Global } from '@nestjs/common';
import { GrpcService } from './grpc.service';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [GrpcService],
  exports: [GrpcService],
})
export class GrpcModule {}
