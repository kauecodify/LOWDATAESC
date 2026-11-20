import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../services/logger.service';
import { PoolQueue } from './pool.queue';
import { PoolEngine, PoolTransaction, PoolGateway } from './pool.engine';

@Injectable()
export class PoolWorker {
  private readonly logger = new LoggerService();
  private id: number;
  private concurrency: number;
  private isRunning: boolean = false;
  private processingCount: number = 0;
  private currentTransactions: Map<string, PoolTransaction> = new Map();

  constructor(
    id: number,
    concurrency: number,
    private configService: ConfigService,
    private poolLogger: LoggerService,
    private queue: PoolQueue,
    private engine: PoolEngine,
  ) {
    this.id = id;
    this.concurrency = concurrency;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(`Worker ${this.id} is already running`);
      return;
    }

    this.isRunning = true;
    this.logger.log(`Worker ${this.id} started with concurrency ${this.concurrency}`);

    // Start processing loop
    this.processLoop();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn(`Worker ${this.id} is not running`);
      return;
    }

    this.isRunning = false;
    this.logger.log(`Worker ${this.id} stopped`);

    // Wait for current transactions to complete
    const shutdownTimeout = this.configService.get('worker.shutdownTimeout') || 30000;
    const startTime = Date.now();

    while (this.processingCount > 0 && Date.now() - startTime < shutdownTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.logger.log(`Worker ${this.id} shutdown complete, remaining transactions: ${this.processingCount}`);
  }

  private async processLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // Check if we can process more transactions
        if (this.processingCount >= this.concurrency) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }

        // Get next transaction from queue
        const transaction = await this.queue.getNextTransaction();

        if (!transaction) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }

        // Process the transaction
        this.processTransaction(transaction).catch((error) => {
          this.logger.error(`Worker ${this.id} failed to process transaction`, {
            transactionId: transaction.id,
            error: error.message,
          });
        });
      } catch (error) {
        this.logger.error(`Worker ${this.id} error in process loop`, {
          error: error.message,
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async processTransaction(transaction: PoolTransaction): Promise<void> {
    try {
      this.processingCount++;
      this.currentTransactions.set(transaction.id, transaction);

      // Update transaction status
      await this.engine.updateTransactionStatus(transaction.id, 'PROCESSING');

      this.logger.log(`Worker ${this.id} processing transaction`, {
        transactionId: transaction.id,
        consortiumId: transaction.consortiumId,
        amount: transaction.amount,
      });

      // Select gateway
      const gateway = this.engine.selectGateway(transaction);

      if (!gateway) {
        throw new Error('No available gateway for transaction');
      }

      this.logger.log(`Worker ${this.id} selected gateway for transaction`, {
        transactionId: transaction.id,
        gateway: gateway.name,
      });

      // Allocate transaction to gateway
      await this.engine.allocateTransaction(transaction.id, gateway.name);

      // Process the transaction through the gateway
      const result = await this.processThroughGateway(transaction, gateway);

      if (result.success) {
        // Transaction completed successfully
        await this.engine.updateTransactionStatus(transaction.id, 'COMPLETED');
        await this.engine.completeAllocation(transaction.id);

        this.logger.log(`Worker ${this.id} completed transaction`, {
          transactionId: transaction.id,
          gateway: gateway.name,
        });
      } else {
        // Transaction failed
        await this.engine.updateTransactionStatus(transaction.id, 'FAILED', result.error);
        await this.engine.failAllocation(transaction.id, result.error || 'Unknown error');
        await this.engine.incrementTransactionRetries(transaction.id);

        this.logger.error(`Worker ${this.id} failed transaction`, {
          transactionId: transaction.id,
          gateway: gateway.name,
          error: result.error,
        });

        // Check if we should retry
        const maxRetries = this.configService.get('engine.retry.maxAttempts') || 3;
        const transactionData = await this.engine.getTransaction(transaction.id);

        if (transactionData && transactionData.retries < maxRetries) {
          // Re-add to queue
          await this.queue.addTransaction(transactionData);
          this.logger.log(`Worker ${this.id} requeued transaction for retry`, {
            transactionId: transaction.id,
            retries: transactionData.retries + 1,
          });
        }
      }
    } catch (error) {
      this.logger.error(`Worker ${this.id} error processing transaction`, {
        transactionId: transaction.id,
        error: error.message,
      });

      await this.engine.updateTransactionStatus(transaction.id, 'FAILED', error.message);
    } finally {
      this.processingCount--;
      this.currentTransactions.delete(transaction.id);
    }
  }

  private async processThroughGateway(
    transaction: PoolTransaction,
    gateway: PoolGateway
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      const engineConfig = this.configService.get('engine');
      const timeout = engineConfig?.transactionTimeout || 60000;

      // Simulate processing (in production, this would call the actual gateway)
      const startTime = Date.now();

      // Check if gateway is healthy
      if (gateway.healthStatus !== 'HEALTHY') {
        throw new Error(`Gateway ${gateway.name} is not healthy`);
      }

      // Check if gateway has capacity
      if (gateway.currentConnections >= gateway.maxConnections) {
        throw new Error(`Gateway ${gateway.name} is at capacity`);
      }

      // Simulate processing delay
      const processingDelay = Math.random() * 1000; // 0-1 second
      await new Promise((resolve) => setTimeout(resolve, processingDelay));

      // Check for timeout
      if (Date.now() - startTime > timeout) {
        throw new Error('Transaction processing timeout');
      }

      // In production, this would call the actual gateway API
      // For now, simulate success
      this.logger.log(`Worker ${this.id} processed transaction through gateway`, {
        transactionId: transaction.id,
        gateway: gateway.name,
        processingTime: Date.now() - startTime,
      });

      return {
        success: true,
        data: {
          gateway: gateway.name,
          transactionId: transaction.id,
          processingTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.logger.error(`Worker ${this.id} gateway processing error`, {
        transactionId: transaction.id,
        gateway: gateway.name,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Worker management
  getId(): number {
    return this.id;
  }

  getConcurrency(): number {
    return this.concurrency;
  }

  isRunning(): boolean {
    return this.isRunning;
  }

  getProcessingCount(): number {
    return this.processingCount;
  }

  getCurrentTransactions(): PoolTransaction[] {
    return Array.from(this.currentTransactions.values());
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'HEALTHY' | 'UNHEALTHY';
    processingCount: number;
    currentTransactions: string[];
  }> {
    return {
      status: this.isRunning ? 'HEALTHY' : 'UNHEALTHY',
      processingCount: this.processingCount,
      currentTransactions: Array.from(this.currentTransactions.keys()),
    };
  }
}
