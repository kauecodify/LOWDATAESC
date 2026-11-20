import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { LoggerService } from '../logger/logger.service';

interface IdempotencyOptions {
  ttl?: number;
  header?: string;
}

@Injectable()
export class IdempotencyService implements OnModuleDestroy {
  private redis: Redis;
  private readonly logger = new LoggerService();
  private readonly options: IdempotencyOptions;

  constructor(private configService: ConfigService) {
    const idempotencyConfig = this.configService.get('idempotency');
    const redisConfig = this.configService.get('redis');

    this.options = {
      ttl: idempotencyConfig?.ttl || 86400, // 24 hours
      header: idempotencyConfig?.header || 'Idempotency-Key',
    };

    this.redis = new Redis({
      host: redisConfig?.host || 'redis',
      port: redisConfig?.port || 6379,
      password: redisConfig?.password || '',
      db: redisConfig?.db || 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 5000);
        return delay;
      },
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected for idempotency');
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
    this.logger.log('Redis connection closed for idempotency');
  }

  async checkAndSet(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const existing = await this.redis.get(key);
      
      if (existing) {
        this.logger.debug('Idempotency key already exists', { key });
        return false; // Already processed
      }

      // Store the value with TTL
      const effectiveTtl = ttl || this.options.ttl;
      await this.redis.set(key, JSON.stringify(value), 'EX', effectiveTtl);
      
      this.logger.debug('Idempotency key set', { key, ttl: effectiveTtl });
      return true; // New request, can be processed
    } catch (error) {
      this.logger.error('Failed to check/set idempotency key', { key, error: error.message });
      throw error;
    }
  }

  async get(key: string): Promise<any | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error('Failed to get idempotency value', { key, error: error.message });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.logger.debug('Idempotency key deleted', { key });
    } catch (error) {
      this.logger.error('Failed to delete idempotency key', { key, error: error.message });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.error('Failed to check idempotency key existence', { key, error: error.message });
      throw error;
    }
  }

  async extendTtl(key: string, ttl: number): Promise<void> {
    try {
      await this.redis.expire(key, ttl);
      this.logger.debug('Idempotency key TTL extended', { key, ttl });
    } catch (error) {
      this.logger.error('Failed to extend idempotency key TTL', { key, ttl, error: error.message });
      throw error;
    }
  }

  getHeader(): string {
    return this.options.header || 'Idempotency-Key';
  }

  generateKey(prefix: string, identifier: string): string {
    return `${prefix}:${identifier}`;
  }

  // Transaction-specific methods
  async checkAndSetTransaction(transactionId: string, data: any, ttl?: number): Promise<boolean> {
    const key = this.generateKey('split-transaction', transactionId);
    return this.checkAndSet(key, data, ttl);
  }

  async getTransaction(transactionId: string): Promise<any | null> {
    const key = this.generateKey('split-transaction', transactionId);
    return this.get(key);
  }

  // Payment-specific methods
  async checkAndSetPayment(paymentId: string, data: any, ttl?: number): Promise<boolean> {
    const key = this.generateKey('split-payment', paymentId);
    return this.checkAndSet(key, data, ttl);
  }

  async getPayment(paymentId: string): Promise<any | null> {
    const key = this.generateKey('split-payment', paymentId);
    return this.get(key);
  }

  // Tenant-specific methods
  async checkAndSetTenant(tenantId: string, key: string, data: any, ttl?: number): Promise<boolean> {
    const fullKey = this.generateKey(`tenant-${tenantId}`, key);
    return this.checkAndSet(fullKey, data, ttl);
  }

  async getTenant(tenantId: string, key: string): Promise<any | null> {
    const fullKey = this.generateKey(`tenant-${tenantId}`, key);
    return this.get(fullKey);
  }
}
