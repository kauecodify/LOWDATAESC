import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../services/logger.service';
import { PoolEngine } from './pool.engine';

interface HealthCheckResult {
  name: string;
  status: 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED';
  lastCheck: Date;
  responseTime?: number;
  error?: string;
}

@Injectable()
export class PoolHealthService implements OnModuleDestroy {
  private readonly logger = new LoggerService();
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout;
  private healthChecks: Map<string, HealthCheckResult> = new Map();

  constructor(
    private configService: ConfigService,
    private poolLogger: LoggerService,
  ) {}

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Pool Health Service is already running');
      return;
    }

    this.isRunning = true;

    const checkInterval = this.configService.get('health.checkInterval') || 30000;
    const timeout = this.configService.get('health.timeout') || 5000;

    this.checkInterval = setInterval(async () => {
      try {
        await this.runHealthChecks(timeout);
      } catch (error) {
        this.logger.error('Failed to run health checks', error);
      }
    }, checkInterval);

    // Run initial check
    await this.runHealthChecks(timeout);

    this.logger.log('Pool Health Service started', {
      checkInterval,
      timeout,
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Pool Health Service is not running');
      return;
    }

    clearInterval(this.checkInterval);
    this.isRunning = false;

    this.logger.log('Pool Health Service stopped');
  }

  async onModuleDestroy() {
    await this.stop();
  }

  private async runHealthChecks(timeout: number): Promise<void> {
    try {
      const startTime = Date.now();

      // Check database
      await this.checkDatabase(timeout);

      // Check gateways
      await this.checkGateways(timeout);

      // Check queue
      await this.checkQueue(timeout);

      // Check Redis
      await this.checkRedis(timeout);

      // Check external services
      await this.checkExternalServices(timeout);

      this.logger.debug('Health checks completed', {
        duration: Date.now() - startTime,
        checks: this.healthChecks.size,
      });
    } catch (error) {
      this.logger.error('Failed to run health checks', error);
    }
  }

  private async checkDatabase(timeout: number): Promise<void> {
    try {
      const startTime = Date.now();
      const dbConfig = this.configService.get('database');

      // In production, this would actually test the database connection
      // For now, simulate a successful check
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

      const duration = Date.now() - startTime;

      this.healthChecks.set('database', {
        name: 'database',
        status: 'HEALTHY',
        lastCheck: new Date(),
        responseTime: duration,
      });

      this.logger.debug('Database health check passed', { duration });
    } catch (error) {
      this.healthChecks.set('database', {
        name: 'database',
        status: 'UNHEALTHY',
        lastCheck: new Date(),
        error: error.message,
      });

      this.logger.error('Database health check failed', error);
    }
  }

  private async checkGateways(timeout: number): Promise<void> {
    try {
      const gatewayConfigs = this.configService.get('paymentGateways');

      // Check BACEN
      if (gatewayConfigs?.bacen?.enabled) {
        await this.checkGateway('bacen', gatewayConfigs.bacen.apiUrl, timeout);
      }

      // Check Iugu
      if (gatewayConfigs?.iugu?.enabled) {
        await this.checkGateway('iugu', gatewayConfigs.iugu.apiUrl, timeout);
      }

      // Check Asaas
      if (gatewayConfigs?.asaas?.enabled) {
        await this.checkGateway('asaas', gatewayConfigs.asaas.apiUrl, timeout);
      }

      // Check Efi
      if (gatewayConfigs?.efi?.enabled) {
        await this.checkGateway('efi', gatewayConfigs.efi.apiUrl, timeout);
      }
    } catch (error) {
      this.logger.error('Failed to check gateways', error);
    }
  }

  private async checkGateway(name: string, apiUrl: string, timeout: number): Promise<void> {
    try {
      const startTime = Date.now();

      // In production, this would make an actual HTTP request to the gateway
      // For now, simulate a successful check with random failures
      const shouldFail = Math.random() < 0.05; // 5% chance of failure

      if (shouldFail) {
        throw new Error('Gateway not responding');
      }

      await new Promise((resolve) => setTimeout(resolve, Math.random() * 500));

      const duration = Date.now() - startTime;

      this.healthChecks.set(name, {
        name,
        status: 'HEALTHY',
        lastCheck: new Date(),
        responseTime: duration,
      });

      this.logger.debug('Gateway health check passed', { name, duration });
    } catch (error) {
      this.healthChecks.set(name, {
        name,
        status: 'UNHEALTHY',
        lastCheck: new Date(),
        error: error.message,
      });

      this.logger.error('Gateway health check failed', { name, error: error.message });
    }
  }

  private async checkQueue(timeout: number): Promise<void> {
    try {
      const startTime = Date.now();

      // In production, this would check the queue health
      // For now, simulate a successful check
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

      const duration = Date.now() - startTime;

      this.healthChecks.set('queue', {
        name: 'queue',
        status: 'HEALTHY',
        lastCheck: new Date(),
        responseTime: duration,
      });

      this.logger.debug('Queue health check passed', { duration });
    } catch (error) {
      this.healthChecks.set('queue', {
        name: 'queue',
        status: 'UNHEALTHY',
        lastCheck: new Date(),
        error: error.message,
      });

      this.logger.error('Queue health check failed', error);
    }
  }

  private async checkRedis(timeout: number): Promise<void> {
    try {
      const startTime = Date.now();
      const redisConfig = this.configService.get('redis');

      // In production, this would actually test the Redis connection
      // For now, simulate a successful check
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

      const duration = Date.now() - startTime;

      this.healthChecks.set('redis', {
        name: 'redis',
        status: 'HEALTHY',
        lastCheck: new Date(),
        responseTime: duration,
      });

      this.logger.debug('Redis health check passed', { duration });
    } catch (error) {
      this.healthChecks.set('redis', {
        name: 'redis',
        status: 'UNHEALTHY',
        lastCheck: new Date(),
        error: error.message,
      });

      this.logger.error('Redis health check failed', error);
    }
  }

  private async checkExternalServices(timeout: number): Promise<void> {
    try {
      // Check BACEN API
      const bacenConfig = this.configService.get('bacen');
      if (bacenConfig?.api?.baseUrl) {
        await this.checkExternalService('bacen-api', bacenConfig.api.baseUrl, timeout);
      }

      // Check LOWDATAESC
      const lowdataescConfig = this.configService.get('lowdataesc');
      if (lowdataescConfig?.api?.baseUrl) {
        await this.checkExternalService('lowdataesc-api', lowdataescConfig.api.baseUrl, timeout);
      }
    } catch (error) {
      this.logger.error('Failed to check external services', error);
    }
  }

  private async checkExternalService(name: string, url: string, timeout: number): Promise<void> {
    try {
      const startTime = Date.now();

      // In production, this would make an actual HTTP request
      // For now, simulate a successful check
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 500));

      const duration = Date.now() - startTime;

      this.healthChecks.set(name, {
        name,
        status: 'HEALTHY',
        lastCheck: new Date(),
        responseTime: duration,
      });

      this.logger.debug('External service health check passed', { name, duration });
    } catch (error) {
      this.healthChecks.set(name, {
        name,
        status: 'UNHEALTHY',
        lastCheck: new Date(),
        error: error.message,
      });

      this.logger.error('External service health check failed', { name, error: error.message });
    }
  }

  getHealth(): {
    overall: 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED';
    checks: HealthCheckResult[];
  } {
    const checks = Array.from(this.healthChecks.values());

    // Count statuses
    const healthyCount = checks.filter((c) => c.status === 'HEALTHY').length;
    const unhealthyCount = checks.filter((c) => c.status === 'UNHEALTHY').length;
    const degradedCount = checks.filter((c) => c.status === 'DEGRADED').length;

    // Determine overall status
    let overall: 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED' = 'HEALTHY';

    if (unhealthyCount > 0) {
      overall = 'UNHEALTHY';
    } else if (degradedCount > 0 || healthyCount < checks.length) {
      overall = 'DEGRADED';
    }

    return {
      overall,
      checks,
    };
  }

  getHealthCheck(name: string): HealthCheckResult | undefined {
    return this.healthChecks.get(name);
  }

  getAllHealthChecks(): HealthCheckResult[] {
    return Array.from(this.healthChecks.values());
  }

  clearHealthChecks(): void {
    this.healthChecks.clear();
    this.logger.log('Health checks cleared');
  }
}
