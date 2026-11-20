import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../services/logger.service';
import { PoolTransaction } from './pool.engine';

interface QueueItem {
  transaction: PoolTransaction;
  priority: number;
  addedAt: Date;
}

@Injectable()
export class PoolQueue {
  private readonly logger = new LoggerService();
  private queue: QueueItem[] = [];
  private isRunning: boolean = false;
  private processing: boolean = false;

  constructor(
    private configService: ConfigService,
    private poolLogger: LoggerService,
  ) {}

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Pool Queue is already running');
      return;
    }

    this.isRunning = true;
    this.logger.log('Pool Queue started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Pool Queue is not running');
      return;
    }

    this.isRunning = false;
    this.logger.log('Pool Queue stopped');
  }

  async addTransaction(transaction: PoolTransaction): Promise<void> {
    try {
      const queueConfig = this.configService.get('queue');
      const priorityLevels = queueConfig?.priorityLevels || 5;

      // Normalize priority (0-4 for 5 levels)
      const priority = Math.min(Math.max(0, transaction.priority), priorityLevels - 1);

      const item: QueueItem = {
        transaction,
        priority,
        addedAt: new Date(),
      };

      // Add to queue based on priority
      this.queue.push(item);
      this.sortQueue();

      this.logger.debug('Transaction added to queue', {
        transactionId: transaction.id,
        priority,
        queueSize: this.queue.length,
      });
    } catch (error) {
      this.logger.error('Failed to add transaction to queue', {
        transactionId: transaction.id,
        error: error.message,
      });
      throw error;
    }
  }

  private sortQueue(): void {
    // Sort by priority (higher priority first) and then by addedAt (older first for same priority)
    this.queue.sort((a, b) => {
      // Higher priority comes first
      if (a.priority > b.priority) return -1;
      if (a.priority < b.priority) return 1;
      
      // For same priority, older items come first
      return a.addedAt.getTime() - b.addedAt.getTime();
    });
  }

  async getNextTransaction(): Promise<PoolTransaction | null> {
    try {
      if (this.queue.length === 0) {
        return null;
      }

      // Get the first transaction from the sorted queue
      const item = this.queue.shift();

      if (item) {
        this.logger.debug('Transaction retrieved from queue', {
          transactionId: item.transaction.id,
          priority: item.priority,
          queueSize: this.queue.length,
        });

        return item.transaction;
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get next transaction from queue', {
        error: error.message,
      });
      throw error;
    }
  }

  async peekNextTransaction(): Promise<PoolTransaction | null> {
    try {
      if (this.queue.length === 0) {
        return null;
      }

      // Peek without removing
      return this.queue[0].transaction;
    } catch (error) {
      this.logger.error('Failed to peek next transaction from queue', {
        error: error.message,
      });
      throw error;
    }
  }

  size(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  clear(): void {
    this.queue = [];
    this.logger.log('Queue cleared');
  }

  // Priority queue methods
  async getTransactionsByPriority(priority: number): Promise<PoolTransaction[]> {
    try {
      return this.queue
        .filter((item) => item.priority === priority)
        .map((item) => item.transaction);
    } catch (error) {
      this.logger.error('Failed to get transactions by priority', {
        priority,
        error: error.message,
      });
      throw error;
    }
  }

  async getHighestPriorityTransactions(): Promise<PoolTransaction[]> {
    try {
      if (this.queue.length === 0) {
        return [];
      }

      const highestPriority = Math.max(...this.queue.map((item) => item.priority));
      return this.queue
        .filter((item) => item.priority === highestPriority)
        .map((item) => item.transaction);
    } catch (error) {
      this.logger.error('Failed to get highest priority transactions', {
        error: error.message,
      });
      throw error;
    }
  }

  // Statistics
  getStatistics(): {
    size: number;
    byPriority: Record<number, number>;
    oldestItemAge?: number;
    newestItemAge?: number;
  } {
    const byPriority: Record<number, number> = {};
    let oldestAge: number | undefined;
    let newestAge: number | undefined;

    const now = Date.now();

    for (const item of this.queue) {
      // Count by priority
      byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;

      // Calculate ages
      const age = now - item.addedAt.getTime();
      if (oldestAge === undefined || age > oldestAge) {
        oldestAge = age;
      }
      if (newestAge === undefined || age < newestAge) {
        newestAge = age;
      }
    }

    return {
      size: this.queue.length,
      byPriority,
      oldestItemAge: oldestAge,
      newestItemAge: newestAge,
    };
  }
}
