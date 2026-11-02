import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'IDEMPOTENCY_CONFIG',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const idempotencyConfig = configService.get('idempotency');
        return {
          enabled: idempotencyConfig.enabled !== false,
          ttl: idempotencyConfig.ttl || 86400, // 24 hours
          header: idempotencyConfig.header || 'Idempotency-Key',
        };
      },
    },
    IdempotencyService,
    IdempotencyInterceptor,
  ],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}
