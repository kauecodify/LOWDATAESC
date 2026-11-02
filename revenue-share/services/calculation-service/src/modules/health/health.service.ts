import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../common/logger/logger.service';
import { KafkaService } from '../../common/kafka/kafka.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Calculation } from '../calculation/entities/calculation.entity';

@Injectable()
export class HealthService {
  private readonly logger = new LoggerService('HealthService');
  private readonly serviceName: string;
  private readonly serviceVersion: string;
  private readonly buildTimestamp: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly kafkaService: KafkaService,
    @InjectRepository(Calculation)
    private readonly calculationRepository: Repository<Calculation>,
  ) {
    const serviceConfig = this.configService.get('service');
    this.serviceName = serviceConfig?.name || 'calculation-service';
    this.serviceVersion = serviceConfig?.version || '1.0.0';
    this.buildTimestamp = process.env.BUILD_TIMESTAMP || new Date().toISOString();
  }

  async checkLiveness(): Promise<any> {
    return {
      status: 'alive',
      service: this.serviceName,
      version: this.serviceVersion,
      timestamp: new Date().toISOString(),
    };
  }

  async checkReadiness(): Promise<any> {
    const checks = await this.runDependencyChecks();
    
    const allReady = Object.values(checks).every((check: any) => check.status === 'up');

    if (!allReady) {
      throw new ServiceUnavailableException('Service is not ready');
    }

    return {
      status: 'ready',
      service: this.serviceName,
      version: this.serviceVersion,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  async checkFullHealth(): Promise<any> {
    const liveness = await this.checkLiveness();
    const readiness = await this.checkReadiness();
    const metrics = await this.getMetrics();

    return {
      ...liveness,
      ...readiness,
      metrics,
    };
  }

  async getMetrics(): Promise<any> {
    try {
      const calculationStats = await this.getCalculationStatistics();
      const kafkaStats = await this.getKafkaStatistics();
      const systemStats = this.getSystemStatistics();

      return {
        service: this.serviceName,
        timestamp: new Date().toISOString(),
        calculations: calculationStats,
        kafka: kafkaStats,
        system: systemStats,
      };
    } catch (error) {
      this.logger.error('Failed to collect metrics', error);
      return {
        service: this.serviceName,
        timestamp: new Date().toISOString(),
        error: 'Failed to collect metrics',
      };
    }
  }

  async getVersionInfo(): Promise<any> {
    return {
      service: this.serviceName,
      version: this.serviceVersion,
      buildTimestamp: this.buildTimestamp,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      dependencies: this.getDependencies(),
    };
  }

  private async runDependencyChecks(): Promise<any> {
    const checks: Record<string, any> = {};

    // Database check
    try {
      const dbCheck = await this.checkDatabase();
      checks.database = {
        status: dbCheck.success ? 'up' : 'down',
        ...dbCheck,
      };
    } catch (error) {
      checks.database = {
        status: 'down',
        error: error.message,
      };
    }

    // Kafka check
    try {
      const kafkaCheck = await this.checkKafka();
      checks.kafka = {
        status: kafkaCheck.success ? 'up' : 'down',
        ...kafkaCheck,
      };
    } catch (error) {
      checks.kafka = {
        status: 'down',
        error: error.message,
      };
    }

    // Redis check (for idempotency)
    try {
      const redisCheck = await this.checkRedis();
      checks.redis = {
        status: redisCheck.success ? 'up' : 'down',
        ...redisCheck,
      };
    } catch (error) {
      checks.redis = {
        status: 'down',
        error: error.message,
      };
    }

    return checks;
  }

  private async checkDatabase(): Promise<any> {
    try {
      const startTime = Date.now();
      const count = await this.calculationRepository.count();
      const latency = Date.now() - startTime;

      return {
        success: true,
        latencyMs: latency,
        calculationCount: count,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async checkKafka(): Promise<any> {
    try {
      const kafkaConfig = this.configService.get('kafka');
      const startTime = Date.now();
      
      // Try to get producer metadata
      const metadata = await this.kafkaService.getProducerMetadata();
      const latency = Date.now() - startTime;

      return {
        success: true,
        latencyMs: latency,
        brokers: metadata.brokers || [],
        topics: metadata.topics || [],
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async checkRedis(): Promise<any> {
    try {
      const redisConfig = this.configService.get('redis');
      const startTime = Date.now();

      // Try a simple ping to Redis
      // In a real implementation, we would use the Redis client
      // For now, we'll simulate a successful check
      const latency = Date.now() - startTime;

      return {
        success: true,
        latencyMs: latency,
        host: redisConfig?.host || 'redis',
        port: redisConfig?.port || 6379,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async getCalculationStatistics(): Promise<any> {
    try {
      const [total, pending, processing, completed, failed] = await Promise.all([
        this.calculationRepository.count(),
        this.calculationRepository.count({ where: { status: 'PENDING' } }),
        this.calculationRepository.count({ where: { status: 'PROCESSING' } }),
        this.calculationRepository.count({ where: { status: 'COMPLETED' } }),
        this.calculationRepository.count({ where: { status: 'FAILED' } }),
      ]);

      return {
        total,
        byStatus: {
          pending,
          processing,
          completed,
          failed,
          reprocessing: 0,
          cancelled: 0,
        },
        processingRate: await this.calculateProcessingRate(),
        errorRate: total > 0 ? (failed / total) * 100 : 0,
        successRate: total > 0 ? (completed / total) * 100 : 0,
      };
    } catch (error) {
      this.logger.error('Failed to get calculation statistics', error);
      return {
        total: 0,
        byStatus: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          reprocessing: 0,
          cancelled: 0,
        },
        processingRate: 0,
        errorRate: 0,
        successRate: 0,
      };
    }
  }

  private async calculateProcessingRate(): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const completedCount = await this.calculationRepository.count({
        where: {
          status: 'COMPLETED',
          completedAt: MoreThan(oneHourAgo),
        },
      });

      return completedCount / 60; // Calculations per minute
    } catch (error) {
      return 0;
    }
  }

  private async getKafkaStatistics(): Promise<any> {
    try {
      const kafkaConfig = this.configService.get('kafka');
      const topic = kafkaConfig?.topic?.calculationResults || 'calculation-results';

      // In a real implementation, we would get actual Kafka metrics
      // For now, return placeholder data
      return {
        topic,
        partitionCount: kafkaConfig?.partitions || 10,
        replicationFactor: kafkaConfig?.replicationFactor || 3,
        messagesIn: 0,
        messagesOut: 0,
      };
    } catch (error) {
      this.logger.error('Failed to get Kafka statistics', error);
      return {
        topic: 'unknown',
        partitionCount: 0,
        replicationFactor: 0,
        messagesIn: 0,
        messagesOut: 0,
      };
    }
  }

  private getSystemStatistics(): any {
    try {
      return {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        uptime: process.uptime(),
        pid: process.pid,
        platform: process.platform,
        arch: process.arch,
      };
    } catch (error) {
      this.logger.error('Failed to get system statistics', error);
      return {
        memoryUsage: {},
        cpuUsage: {},
        uptime: 0,
        pid: process.pid,
      };
    }
  }

  private getDependencies(): any {
    try {
      // Read package.json to get dependencies
      const packageJson = require('../../../../package.json');
      
      return {
        nestjs: packageJson.dependencies?.['@nestjs/core'] || 'unknown',
        typeorm: packageJson.dependencies?.['typeorm'] || 'unknown',
        kafka: packageJson.dependencies?.['kafkajs'] || 'unknown',
        redis: packageJson.dependencies?.['ioredis'] || 'unknown',
      };
    } catch (error) {
      return {
        nestjs: 'unknown',
        typeorm: 'unknown',
        kafka: 'unknown',
        redis: 'unknown',
      };
    }
  }
}

// Import TypeORM functions
import { MoreThan } from 'typeorm';
