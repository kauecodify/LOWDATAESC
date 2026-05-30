//nestJS
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { KafkaModule } from './kafka/kafka.module';
import { OtelModule } from './otel/otel.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({ ttl: 60, limit: 100 }),
    PrismaModule,
    AuthModule,
    KafkaModule,
    OtelModule, // OpenTelemetry tracing
  ],
})
export class AppModule {}
