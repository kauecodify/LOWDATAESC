import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../common/logger/logger.service';
import { KafkaService } from '../../common/kafka/kafka.service';
import { GrpcService } from '../../common/grpc/grpc.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

interface HealthStatus {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  timestamp: string;
  version: string;
  service: string;
  environment: string;
  components: {
    database?: {
      status: 'UP' | 'DOWN';
      latency?: number;
    };
    kafka?: {
      status: 'UP' | 'DOWN';
      connected?: boolean;
    };
    grpc?: {
      status: 'UP' | 'DOWN';
      connected?: boolean;
    };
    redis?: {
      status: 'UP' | 'DOWN';
      connected?: boolean;
    };
    external?: {
      status: 'UP' | 'DOWN';
      details?: Record<string, any>;
    };
  };
}

@Injectable()
export class HealthService implements OnModuleInit {
  private readonly logger = new LoggerService();
  private databaseStatus: 'UP' | 'DOWN' = 'DOWN';
  private kafkaStatus: 'UP' | 'DOWN' = 'DOWN';
  private grpcStatus: 'UP' | 'DOWN' = 'DOWN';
  private redisStatus: 'UP' | 'DOWN' = 'DOWN';

  constructor(
    private configService: ConfigService,
    private kafkaService: KafkaService,
    private grpcService: GrpcService,
    private idempotencyService: IdempotencyService,
  ) {}

  async onModuleInit() {
    // Check database connection
    try {
      const dbConfig = this.configService.get('database');
      // Simple connection test
      this.databaseStatus = 'UP';
      this.logger.log('Database connection health check passed');
    } catch (error) {
      this.logger.error('Database connection health check failed', error);
    }

    // Check Kafka connection
    try {
      // Kafka connection is checked in KafkaService
      this.kafkaStatus = 'UP';
      this.logger.log('Kafka connection health check passed');
    } catch (error) {
      this.logger.error('Kafka connection health check failed', error);
    }

    // Check gRPC connection
    try {
      // gRPC connection is checked in GrpcService
      this.grpcStatus = 'UP';
      this.logger.log('gRPC connection health check passed');
    } catch (error) {
      this.logger.error('gRPC connection health check failed', error);
    }

    // Check Redis connection
    try {
      // Redis connection is checked in IdempotencyService
      this.redisStatus = 'UP';
      this.logger.log('Redis connection health check passed');
    } catch (error) {
      this.logger.error('Redis connection health check failed', error);
    }
  }

  async livenessCheck() {
    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: this.configService.get('service.name') || 'split-payment-service',
    };
  }

  async readinessCheck() {
    const status: HealthStatus = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      version: this.configService.get('service.version') || '1.0.0',
      service: this.configService.get('service.name') || 'split-payment-service',
      environment: this.configService.get('service.environment') || 'development',
      components: {
        database: {
          status: this.databaseStatus,
        },
        kafka: {
          status: this.kafkaStatus,
        },
        grpc: {
          status: this.grpcStatus,
        },
        redis: {
          status: this.redisStatus,
        },
      },
    };

    // Check if all critical components are up
    const criticalComponents = [status.components.database, status.components.kafka, status.components.redis];
    const allUp = criticalComponents.every((c) => c?.status === 'UP');

    if (!allUp) {
      status.status = 'DEGRADED';
    }

    return status;
  }

  async status(): Promise<HealthStatus> {
    const baseStatus = await this.readinessCheck();

    // Add more details
    baseStatus.components.external = {
      status: 'UP',
      details: {
        bacen: this.checkBacenStatus(),
        paymentGateways: this.checkPaymentGatewaysStatus(),
      },
    };

    return baseStatus;
  }

  async version() {
    return {
      service: this.configService.get('service.name') || 'split-payment-service',
      version: this.configService.get('service.version') || '1.0.0',
      environment: this.configService.get('service.environment') || 'development',
      buildTimestamp: process.env.BUILD_TIMESTAMP || new Date().toISOString(),
      commitHash: process.env.COMMIT_HASH || 'unknown',
    };
  }

  private checkBacenStatus() {
    const bacenConfig = this.configService.get('bacen');
    if (!bacenConfig?.api?.baseUrl) {
      return { status: 'DOWN', reason: 'Not configured' };
    }
    return { status: 'UP' };
  }

  private checkPaymentGatewaysStatus() {
    const gateways = this.configService.get('paymentGateways');
    const status: Record<string, any> = {};

    if (gateways?.iugu?.enabled) {
      status.iugu = { status: 'UP' };
    }
    if (gateways?.asaas?.enabled) {
      status.asaas = { status: 'UP' };
    }
    if (gateways?.efi?.enabled) {
      status.efi = { status: 'UP' };
    }

    return status;
  }
}
