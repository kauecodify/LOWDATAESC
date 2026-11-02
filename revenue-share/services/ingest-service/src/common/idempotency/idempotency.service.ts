import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { LoggerService } from '../logger/logger.service';

export interface IdempotencyKeyOptions {
  service: string;
  operation: string;
  userId?: string;
  resourceId?: string;
}

@Injectable()
export class IdempotencyService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;
  private readonly enabled: boolean;
  private readonly ttl: number;
  private readonly header: string;
  private readonly logger = new LoggerService();

  constructor(private readonly configService: ConfigService) {
    const idempotencyConfig = this.configService.get('idempotency');
    const redisConfig = this.configService.get('redis');

    this.enabled = idempotencyConfig.enabled !== false;
    this.ttl = idempotencyConfig.ttl || 86400; // 24 hours
    this.header = idempotencyConfig.header || 'Idempotency-Key';

    this.redis = new Redis({
      host: redisConfig.host || 'redis',
      port: redisConfig.port || 6379,
      password: redisConfig.password || '',
      db: redisConfig.db || 0,
      retryStrategy: (times) => {
        return Math.min(times * 100, 5000);
      },
      reconnectOnError: true,
      lazyConnect: true,
    });
  }

  async onModuleInit() {
    if (this.enabled) {
      try {
        await this.redis.connect();
        this.logger.log('Idempotency service connected to Redis');
      } catch (error) {
        this.logger.error('Failed to connect to Redis for idempotency', error);
        this.enabled = false;
      }
    }
  }

  async onModuleDestroy() {
    if (this.enabled) {
      try {
        await this.redis.quit();
        this.logger.log('Idempotency service disconnected from Redis');
      } catch (error) {
        this.logger.error('Failed to disconnect from Redis', error);
      }
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getHeader(): string {
    return this.header;
  }

  async checkKey(key: string, operation: string): Promise<{ exists: boolean; response: any }> {
    if (!this.enabled) {
      return { exists: false, response: null };
    }

    try {
      const redisKey = this.getRedisKey(key, operation);
      const value = await this.redis.get(redisKey);

      if (value) {
        this.logger.debug(`Idempotency key found: ${key}`, { operation });
        return { exists: true, response: JSON.parse(value) };
      }

      return { exists: false, response: null };
    } catch (error) {
      this.logger.error(`Failed to check idempotency key: ${key}`, error);
      // Fail open - allow request to proceed
      return { exists: false, response: null };
    }
  }

  async setKey(key: string, operation: string, response: any): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const redisKey = this.getRedisKey(key, operation);
      await this.redis.setex(redisKey, this.ttl, JSON.stringify(response));
      this.logger.debug(`Idempotency key stored: ${key}`, { operation, ttl: this.ttl });
    } catch (error) {
      this.logger.error(`Failed to store idempotency key: ${key}`, error);
    }
  }

  async deleteKey(key: string, operation: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const redisKey = this.getRedisKey(key, operation);
      await this.redis.del(redisKey);
      this.logger.debug(`Idempotency key deleted: ${key}`, { operation });
    } catch (error) {
      this.logger.error(`Failed to delete idempotency key: ${key}`, error);
    }
  }

  generateKey(options: IdempotencyKeyOptions): string {
    const parts = [
      options.service,
      options.operation,
      options.userId || 'anonymous',
      options.resourceId || '',
      Date.now().toString(),
    ];

    return parts.join(':');
  }

  private getRedisKey(key: string, operation: string): string {
    return `idempotency:${operation}:${key}`;
  }

  // Helper method to extract idempotency key from request
  extractKeyFromRequest(request: any): string | null {
    const header = this.header.toLowerCase();
    
    // Check headers
    const headerValue = request.headers?.[header] || 
                        request.headers?.[header.replace(/-/g, '_')] ||
                        request.headers?.[this.header];
    
    if (headerValue) {
      return Array.isArray(headerValue) ? headerValue[0] : headerValue;
    }

    // Check body
    if (request.body?.idempotencyKey) {
      return request.body.idempotencyKey;
    }

    return null;
  }
}
