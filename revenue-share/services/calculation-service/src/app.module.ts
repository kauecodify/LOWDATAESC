import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalculationModule } from './modules/calculation/calculation.module';
import { HealthModule } from './modules/health/health.module';
import { LoggerModule } from './common/logger/logger.module';
import { KafkaModule } from './common/kafka/kafka.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { Configuration } from './config/configuration';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
      load: [Configuration],
    }),

    // Database
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'revenue_user',
      password: process.env.DB_PASSWORD || 'revenue_pass',
      database: process.env.DB_NAME || 'revenue_share',
      schema: process.env.DB_SCHEMA || 'calculation',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      entities: [__dirname + '/modules/**/*.entity{.ts,.js}'],
      synchronize: process.env.DB_SYNC === 'true',
      migrationsRun: process.env.DB_MIGRATIONS === 'true',
      logging: process.env.DB_LOGGING === 'true' ? ['query', 'error'] : ['error'],
      connectTimeoutMS: 5000,
      connectionLimit: 10,
    }),

    // Modules
    CalculationModule,
    HealthModule,
    LoggerModule,
    KafkaModule,
    IdempotencyModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
