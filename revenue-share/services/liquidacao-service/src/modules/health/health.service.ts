import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../common/logger/logger.service';
import { KafkaService } from '../../common/kafka/kafka.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettlementInstruction, EscrowAccount, Transaction, Reconciliation } from '../liquidacao/entities/settlement.entity';

@Injectable()
export class HealthService {
  private readonly logger = new LoggerService('HealthService');
  private readonly serviceName: string;
  private readonly serviceVersion: string;
  private readonly buildTimestamp: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly kafkaService: KafkaService,
    @InjectRepository(SettlementInstruction)
    private readonly settlementRepository: Repository<SettlementInstruction>,
    @InjectRepository(EscrowAccount)
    private readonly escrowAccountRepository: Repository<EscrowAccount>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Reconciliation)
    private readonly reconciliationRepository: Repository<Reconciliation>,
  ) {
    const serviceConfig = this.configService.get('service');
    this.serviceName = serviceConfig?.name || 'liquidacao-service';
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
      const settlementStats = await this.getSettlementStatistics();
      const escrowStats = await this.getEscrowStatistics();
      const kafkaStats = await this.getKafkaStatistics();
      const systemStats = this.getSystemStatistics();

      return {
        service: this.serviceName,
        timestamp: new Date().toISOString(),
        settlements: settlementStats,
        escrow: escrowStats,
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
      const dbConfig = this.configService.get('database');
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

    // LOWDATAESC gRPC check
    try {
      const lowdataescCheck = await this.checkLowdataesc();
      checks.lowdataesc = {
        status: lowdataescCheck.success ? 'up' : 'down',
        ...lowdataescCheck,
      };
    } catch (error) {
      checks.lowdataesc = {
        status: 'down',
        error: error.message,
      };
    }

    return checks;
  }

  private async checkDatabase(): Promise<any> {
    try {
      const startTime = Date.now();
      const [settlementCount, escrowCount, transactionCount] = await Promise.all([
        this.settlementRepository.count(),
        this.escrowAccountRepository.count(),
        this.transactionRepository.count(),
      ]);
      const latency = Date.now() - startTime;

      return {
        success: true,
        latencyMs: latency,
        settlementCount,
        escrowCount,
        transactionCount,
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

      // Simulate Redis check (in real implementation, use Redis client)
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

  private async checkLowdataesc(): Promise<any> {
    try {
      const lowdataescConfig = this.configService.get('lowdataesc');
      const startTime = Date.now();

      // In a real implementation, we would ping the LOWDATAESC gRPC service
      // For now, simulate a successful check
      const latency = Date.now() - startTime;

      return {
        success: true,
        latencyMs: latency,
        host: lowdataescConfig?.host || 'lowdataesc-service',
        port: lowdataescConfig?.port || 50051,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async getSettlementStatistics(): Promise<any> {
    try {
      const [total, pending, executed, completed, failed, cancelled] = await Promise.all([
        this.settlementRepository.count(),
        this.settlementRepository.count({ where: { status: 'PENDING', isDeleted: false } }),
        this.settlementRepository.count({ where: { status: 'EXECUTED', isDeleted: false } }),
        this.settlementRepository.count({ where: { status: 'COMPLETED', isDeleted: false } }),
        this.settlementRepository.count({ where: { status: 'FAILED', isDeleted: false } }),
        this.settlementRepository.count({ where: { status: 'CANCELLED', isDeleted: false } }),
      ]);

      return {
        total,
        byStatus: {
          pending,
          executed,
          completed,
          failed,
          cancelled,
          scheduled: 0,
          reconciled: 0,
        },
        processingRate: await this.calculateSettlementProcessingRate(),
        errorRate: total > 0 ? ((failed + cancelled) / total) * 100 : 0,
      };
    } catch (error) {
      this.logger.error('Failed to get settlement statistics', error);
      return {
        total: 0,
        byStatus: {
          pending: 0,
          executed: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          scheduled: 0,
          reconciled: 0,
        },
        processingRate: 0,
        errorRate: 0,
      };
    }
  }

  private async calculateSettlementProcessingRate(): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const executedCount = await this.settlementRepository.count({
        where: {
          status: 'EXECUTED',
          executedAt: MoreThan(oneHourAgo),
          isDeleted: false,
        },
      });

      return executedCount / 60; // Settlements per minute
    } catch (error) {
      return 0;
    }
  }

  private async getEscrowStatistics(): Promise<any> {
    try {
      const [total, active, frozen, closed, totalBalance] = await Promise.all([
        this.escrowAccountRepository.count(),
        this.escrowAccountRepository.count({ where: { status: 'ACTIVE', isDeleted: false } }),
        this.escrowAccountRepository.count({ where: { isFrozen: true, isDeleted: false } }),
        this.escrowAccountRepository.count({ where: { isClosed: true, isDeleted: false } }),
        this.getTotalEscrowBalance(),
      ]);

      return {
        total,
        byStatus: {
          active,
          frozen,
          closed,
        },
        totalBalance,
      };
    } catch (error) {
      this.logger.error('Failed to get escrow statistics', error);
      return {
        total: 0,
        byStatus: {
          active: 0,
          frozen: 0,
          closed: 0,
        },
        totalBalance: 0,
      };
    }
  }

  private async getTotalEscrowBalance(): Promise<number> {
    try {
      const accounts = await this.escrowAccountRepository.find();
      return accounts.reduce((sum, account) => sum + parseFloat(account.balance.toString()), 0);
    } catch (error) {
      return 0;
    }
  }

  private async getKafkaStatistics(): Promise<any> {
    try {
      const kafkaConfig = this.configService.get('kafka');
      const settlementTopic = kafkaConfig?.topic?.settlementResults || 'settlement-results';

      // In a real implementation, we would get actual Kafka metrics
      // For now, return placeholder data
      return {
        settlementTopic,
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
        grpc: packageJson.dependencies?.['@grpc/grpc-js'] || 'unknown',
      };
    } catch (error) {
      return {
        nestjs: 'unknown',
        typeorm: 'unknown',
        kafka: 'unknown',
        redis: 'unknown',
        grpc: 'unknown',
      };
    }
  }
}

// Import TypeORM functions
import { MoreThan } from 'typeorm';
