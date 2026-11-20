import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../services/logger.service';
import { PoolQueue } from './pool.queue';
import { PoolWorker } from './pool.worker';
import { PoolMetrics } from './pool.metrics';
import { PoolHealthService } from './pool.health.service';
import { v4 as uuidv4 } from 'uuid';

interface PoolTransaction {
  id: string;
  consortiumId: string;
  paymentId: string;
  amount: number;
  currency: string;
  method: string;
  supplierAccount: any;
  cbsAccount: any;
  ibsAccount: any;
  taxRates?: any[];
  metadata?: Record<string, any>;
  priority: number;
  createdAt: Date;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error?: string;
  retries: number;
}

interface PoolGateway {
  name: string;
  type: string;
  enabled: boolean;
  maxConnections: number;
  currentConnections: number;
  healthStatus: 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED';
  lastHealthCheck: Date;
  weight: number;
  metadata: Record<string, any>;
}

interface PoolAllocation {
  transactionId: string;
  gateway: PoolGateway;
  allocatedAt: Date;
  completedAt?: Date;
  error?: string;
}

@Injectable()
export class PoolEngine implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new LoggerService();
  private gateways: Map<string, PoolGateway> = new Map();
  private transactions: Map<string, PoolTransaction> = new Map();
  private allocations: Map<string, PoolAllocation> = new Map();
  private queue: PoolQueue;
  private workers: PoolWorker[] = [];
  private metrics: PoolMetrics;
  private healthService: PoolHealthService;
  private isRunning: boolean = false;
  private currentIndex: number = 0;

  constructor(
    private configService: ConfigService,
    private poolLogger: LoggerService,
  ) {
    this.queue = new PoolQueue(configService, poolLogger);
    this.metrics = new PoolMetrics(configService, poolLogger);
    this.healthService = new PoolHealthService(configService, poolLogger);
  }

  async onModuleInit() {
    try {
      // Initialize gateways
      await this.initializeGateways();

      // Initialize workers
      await this.initializeWorkers();

      // Start pool
      await this.start();

      this.logger.log('Pool Engine initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Pool Engine', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.stop();
      this.logger.log('Pool Engine shutdown complete');
    } catch (error) {
      this.logger.error('Failed to shutdown Pool Engine', error);
    }
  }

  private async initializeGateways(): Promise<void> {
    try {
      const allocationConfig = this.configService.get('allocation');

      // BACEN gateway
      this.gateways.set('bacen', {
        name: 'bacen',
        type: 'BACEN',
        enabled: this.configService.get('paymentGateways.bacen.enabled') === true,
        maxConnections: 100,
        currentConnections: 0,
        healthStatus: 'HEALTHY',
        lastHealthCheck: new Date(),
        weight: allocationConfig?.weights?.bacen || 0.4,
        metadata: {
          apiUrl: this.configService.get('bacen.api.baseUrl'),
          pixUrl: this.configService.get('bacen.api.pixBaseUrl'),
        },
      });

      // Iugu gateway
      this.gateways.set('iugu', {
        name: 'iugu',
        type: 'IUGU',
        enabled: this.configService.get('paymentGateways.iugu.enabled') === true,
        maxConnections: 50,
        currentConnections: 0,
        healthStatus: 'HEALTHY',
        lastHealthCheck: new Date(),
        weight: allocationConfig?.weights?.iugu || 0.3,
        metadata: {
          apiUrl: this.configService.get('paymentGateways.iugu.apiUrl'),
        },
      });

      // Asaas gateway
      this.gateways.set('asaas', {
        name: 'asaas',
        type: 'ASAAS',
        enabled: this.configService.get('paymentGateways.asaas.enabled') === true,
        maxConnections: 50,
        currentConnections: 0,
        healthStatus: 'HEALTHY',
        lastHealthCheck: new Date(),
        weight: allocationConfig?.weights?.asaas || 0.2,
        metadata: {
          apiUrl: this.configService.get('paymentGateways.asaas.apiUrl'),
        },
      });

      // Efi gateway
      this.gateways.set('efi', {
        name: 'efi',
        type: 'EFI',
        enabled: this.configService.get('paymentGateways.efi.enabled') === true,
        maxConnections: 50,
        currentConnections: 0,
        healthStatus: 'HEALTHY',
        lastHealthCheck: new Date(),
        weight: allocationConfig?.weights?.efi || 0.1,
        metadata: {
          apiUrl: this.configService.get('paymentGateways.efi.apiUrl'),
        },
      });

      this.logger.log('Pool gateways initialized', {
        count: this.gateways.size,
      });
    } catch (error) {
      this.logger.error('Failed to initialize gateways', error);
      throw error;
    }
  }

  private async initializeWorkers(): Promise<void> {
    try {
      const workerConfig = this.configService.get('worker');
      const workerCount = workerConfig?.count || 4;
      const concurrency = workerConfig?.concurrency || 10;

      for (let i = 0; i < workerCount; i++) {
        const worker = new PoolWorker(
          i,
          concurrency,
          this.configService,
          this.poolLogger,
          this.queue,
          this
        );
        this.workers.push(worker);
      }

      this.logger.log('Pool workers initialized', {
        count: workerCount,
        concurrency,
      });
    } catch (error) {
      this.logger.error('Failed to initialize workers', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Pool Engine is already running');
      return;
    }

    try {
      // Start queue
      await this.queue.start();

      // Start workers
      for (const worker of this.workers) {
        await worker.start();
      }

      // Start health checks
      await this.healthService.start();

      // Start metrics collection
      await this.metrics.start();

      this.isRunning = true;
      this.logger.log('Pool Engine started successfully');
    } catch (error) {
      this.logger.error('Failed to start Pool Engine', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Pool Engine is not running');
      return;
    }

    try {
      // Stop workers
      for (const worker of this.workers) {
        await worker.stop();
      }

      // Stop queue
      await this.queue.stop();

      // Stop health checks
      await this.healthService.stop();

      // Stop metrics collection
      await this.metrics.stop();

      this.isRunning = false;
      this.logger.log('Pool Engine stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop Pool Engine', error);
      throw error;
    }
  }

  // Transaction management
  async submitTransaction(transaction: Omit<PoolTransaction, 'id' | 'createdAt' | 'status' | 'retries'> & { priority?: number }): Promise<string> {
    try {
      const transactionId = uuidv4();
      const poolTransaction: PoolTransaction = {
        id: transactionId,
        consortiumId: transaction.consortiumId,
        paymentId: transaction.paymentId,
        amount: transaction.amount,
        currency: transaction.currency,
        method: transaction.method,
        supplierAccount: transaction.supplierAccount,
        cbsAccount: transaction.cbsAccount,
        ibsAccount: transaction.ibsAccount,
        taxRates: transaction.taxRates,
        metadata: transaction.metadata,
        priority: transaction.priority || 0,
        createdAt: new Date(),
        status: 'PENDING',
        retries: 0,
      };

      this.transactions.set(transactionId, poolTransaction);
      await this.queue.addTransaction(poolTransaction);
      this.metrics.incrementTransactionsSubmitted();

      this.logger.log('Transaction submitted to pool', {
        transactionId,
        consortiumId: transaction.consortiumId,
        amount: transaction.amount,
      });

      return transactionId;
    } catch (error) {
      this.logger.error('Failed to submit transaction to pool', {
        transaction: JSON.stringify(transaction),
        error: error.message,
      });
      throw error;
    }
  }

  async getTransaction(transactionId: string): Promise<PoolTransaction | null> {
    return this.transactions.get(transactionId) || null;
  }

  async updateTransactionStatus(transactionId: string, status: PoolTransaction['status'], error?: string): Promise<void> {
    try {
      const transaction = this.transactions.get(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      transaction.status = status;
      if (error) {
        transaction.error = error;
      }

      this.transactions.set(transactionId, transaction);
      this.metrics.incrementTransactionsByStatus(status);

      this.logger.debug('Transaction status updated', {
        transactionId,
        status,
      });
    } catch (error) {
      this.logger.error('Failed to update transaction status', {
        transactionId,
        status,
        error: error.message,
      });
      throw error;
    }
  }

  async incrementTransactionRetries(transactionId: string): Promise<void> {
    try {
      const transaction = this.transactions.get(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      transaction.retries++;
      this.transactions.set(transactionId, transaction);

      this.logger.debug('Transaction retry count incremented', {
        transactionId,
        retries: transaction.retries,
      });
    } catch (error) {
      this.logger.error('Failed to increment transaction retries', {
        transactionId,
        error: error.message,
      });
      throw error;
    }
  }

  // Gateway management
  getGateways(): Map<string, PoolGateway> {
    return new Map(this.gateways);
  }

  getGateway(name: string): PoolGateway | undefined {
    return this.gateways.get(name);
  }

  async updateGatewayHealth(name: string, status: PoolGateway['healthStatus']): Promise<void> {
    try {
      const gateway = this.gateways.get(name);
      if (!gateway) {
        throw new Error(`Gateway ${name} not found`);
      }

      gateway.healthStatus = status;
      gateway.lastHealthCheck = new Date();
      this.gateways.set(name, gateway);

      this.logger.log('Gateway health updated', {
        name,
        status,
      });
    } catch (error) {
      this.logger.error('Failed to update gateway health', {
        name,
        status,
        error: error.message,
      });
      throw error;
    }
  }

  async incrementGatewayConnections(name: string): Promise<void> {
    try {
      const gateway = this.gateways.get(name);
      if (!gateway) {
        throw new Error(`Gateway ${name} not found`);
      }

      gateway.currentConnections++;
      this.gateways.set(name, gateway);

      this.logger.debug('Gateway connection count incremented', {
        name,
        connections: gateway.currentConnections,
      });
    } catch (error) {
      this.logger.error('Failed to increment gateway connections', {
        name,
        error: error.message,
      });
      throw error;
    }
  }

  async decrementGatewayConnections(name: string): Promise<void> {
    try {
      const gateway = this.gateways.get(name);
      if (!gateway) {
        throw new Error(`Gateway ${name} not found`);
      }

      gateway.currentConnections = Math.max(0, gateway.currentConnections - 1);
      this.gateways.set(name, gateway);

      this.logger.debug('Gateway connection count decremented', {
        name,
        connections: gateway.currentConnections,
      });
    } catch (error) {
      this.logger.error('Failed to decrement gateway connections', {
        name,
        error: error.message,
      });
      throw error;
    }
  }

  // Allocation management
  async allocateTransaction(transactionId: string, gatewayName: string): Promise<PoolAllocation> {
    try {
      const transaction = this.transactions.get(transactionId);
      const gateway = this.gateways.get(gatewayName);

      if (!transaction) {
        throw new Error('Transaction not found');
      }
      if (!gateway) {
        throw new Error('Gateway not found');
      }

      const allocation: PoolAllocation = {
        transactionId,
        gateway,
        allocatedAt: new Date(),
      };

      this.allocations.set(transactionId, allocation);
      await this.incrementGatewayConnections(gatewayName);

      this.logger.log('Transaction allocated to gateway', {
        transactionId,
        gateway: gatewayName,
      });

      return allocation;
    } catch (error) {
      this.logger.error('Failed to allocate transaction', {
        transactionId,
        gatewayName,
        error: error.message,
      });
      throw error;
    }
  }

  async completeAllocation(transactionId: string): Promise<void> {
    try {
      const allocation = this.allocations.get(transactionId);
      if (!allocation) {
        throw new Error('Allocation not found');
      }

      allocation.completedAt = new Date();
      this.allocations.set(transactionId, allocation);
      await this.decrementGatewayConnections(allocation.gateway.name);

      this.logger.log('Transaction allocation completed', {
        transactionId,
        gateway: allocation.gateway.name,
      });
    } catch (error) {
      this.logger.error('Failed to complete allocation', {
        transactionId,
        error: error.message,
      });
      throw error;
    }
  }

  async failAllocation(transactionId: string, error: string): Promise<void> {
    try {
      const allocation = this.allocations.get(transactionId);
      if (!allocation) {
        throw new Error('Allocation not found');
      }

      allocation.error = error;
      allocation.completedAt = new Date();
      this.allocations.set(transactionId, allocation);
      await this.decrementGatewayConnections(allocation.gateway.name);

      this.logger.error('Transaction allocation failed', {
        transactionId,
        gateway: allocation.gateway.name,
        error,
      });
    } catch (error) {
      this.logger.error('Failed to fail allocation', {
        transactionId,
        error: error.message,
      });
      throw error;
    }
  }

  // Allocation strategy
  selectGateway(transaction: PoolTransaction): PoolGateway | null {
    try {
      const allocationConfig = this.configService.get('allocation');
      const strategy = allocationConfig?.strategy || 'ROUND_ROBIN';

      switch (strategy) {
        case 'ROUND_ROBIN':
          return this.selectGatewayRoundRobin(transaction);
        case 'LEAST_CONNECTIONS':
          return this.selectGatewayLeastConnections(transaction);
        case 'RANDOM':
          return this.selectGatewayRandom(transaction);
        case 'WEIGHTED':
          return this.selectGatewayWeighted(transaction);
        default:
          return this.selectGatewayRoundRobin(transaction);
      }
    } catch (error) {
      this.logger.error('Failed to select gateway', {
        transactionId: transaction.id,
        error: error.message,
      });
      return null;
    }
  }

  private selectGatewayRoundRobin(transaction: PoolTransaction): PoolGateway | null {
    const enabledGateways = Array.from(this.gateways.values())
      .filter((g) => g.enabled && g.healthStatus === 'HEALTHY');

    if (enabledGateways.length === 0) {
      this.logger.error('No healthy gateways available');
      return null;
    }

    const gateway = enabledGateways[this.currentIndex % enabledGateways.length];
    this.currentIndex++;

    return gateway;
  }

  private selectGatewayLeastConnections(transaction: PoolTransaction): PoolGateway | null {
    const enabledGateways = Array.from(this.gateways.values())
      .filter((g) => g.enabled && g.healthStatus === 'HEALTHY');

    if (enabledGateways.length === 0) {
      this.logger.error('No healthy gateways available');
      return null;
    }

    // Sort by current connections
    enabledGateways.sort((a, b) => a.currentConnections - b.currentConnections);

    return enabledGateways[0];
  }

  private selectGatewayRandom(transaction: PoolTransaction): PoolGateway | null {
    const enabledGateways = Array.from(this.gateways.values())
      .filter((g) => g.enabled && g.healthStatus === 'HEALTHY');

    if (enabledGateways.length === 0) {
      this.logger.error('No healthy gateways available');
      return null;
    }

    const randomIndex = Math.floor(Math.random() * enabledGateways.length);
    return enabledGateways[randomIndex];
  }

  private selectGatewayWeighted(transaction: PoolTransaction): PoolGateway | null {
    const enabledGateways = Array.from(this.gateways.values())
      .filter((g) => g.enabled && g.healthStatus === 'HEALTHY');

    if (enabledGateways.length === 0) {
      this.logger.error('No healthy gateways available');
      return null;
    }

    // Calculate total weight
    const totalWeight = enabledGateways.reduce((sum, g) => sum + g.weight, 0);

    // Select gateway based on weight
    let random = Math.random() * totalWeight;
    for (const gateway of enabledGateways) {
      random -= gateway.weight;
      if (random <= 0) {
        return gateway;
      }
    }

    return enabledGateways[0];
  }

  // Pool statistics
  getStatistics(): {
    transactions: {
      total: number;
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    };
    gateways: {
      total: number;
      healthy: number;
      unhealthy: number;
    };
    queue: {
      size: number;
    };
    workers: {
      total: number;
      active: number;
    };
  } {
    const transactions = Array.from(this.transactions.values());
    const gateways = Array.from(this.gateways.values());

    return {
      transactions: {
        total: transactions.length,
        pending: transactions.filter((t) => t.status === 'PENDING').length,
        processing: transactions.filter((t) => t.status === 'PROCESSING').length,
        completed: transactions.filter((t) => t.status === 'COMPLETED').length,
        failed: transactions.filter((t) => t.status === 'FAILED').length,
      },
      gateways: {
        total: gateways.length,
        healthy: gateways.filter((g) => g.healthStatus === 'HEALTHY').length,
        unhealthy: gateways.filter((g) => g.healthStatus !== 'HEALTHY').length,
      },
      queue: {
        size: this.queue.size(),
      },
      workers: {
        total: this.workers.length,
        active: this.workers.filter((w) => w.isRunning()).length,
      },
    };
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED';
    details: any;
  }> {
    try {
      const stats = this.getStatistics();
      const health = await this.healthService.getHealth();

      // Check if all gateways are healthy
      const allGatewaysHealthy = stats.gateways.healthy === stats.gateways.total;

      // Check if there are too many failed transactions
      const failedThreshold = this.configService.get('engine.circuitBreaker.failureThreshold') || 5;
      const tooManyFailures = stats.transactions.failed > failedThreshold;

      if (tooManyFailures || !allGatewaysHealthy) {
        return {
          status: 'UNHEALTHY',
          details: {
            stats,
            health,
            issues: [
              tooManyFailures ? 'Too many failed transactions' : null,
              !allGatewaysHealthy ? 'Not all gateways are healthy' : null,
            ].filter(Boolean),
          },
        };
      }

      return {
        status: 'HEALTHY',
        details: {
          stats,
          health,
        },
      };
    } catch (error) {
      this.logger.error('Failed to perform health check', error);
      return {
        status: 'UNHEALTHY',
        details: {
          error: error.message,
        },
      };
    }
  }

  // Get engine configuration
  getConfig() {
    return {
      maxConcurrentTransactions: this.configService.get('engine.maxConcurrentTransactions'),
      transactionTimeout: this.configService.get('engine.transactionTimeout'),
      retry: this.configService.get('engine.retry'),
      allocation: this.configService.get('allocation'),
    };
  }
}
