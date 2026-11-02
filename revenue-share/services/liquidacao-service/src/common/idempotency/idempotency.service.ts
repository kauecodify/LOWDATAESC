import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../logger/logger.service';
import Redis from 'ioredis';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export interface IdempotencyCheckResult {
  exists: boolean;
  response: any;
}

@Injectable()
export class IdempotencyService implements OnModuleInit {
  private readonly redis: Redis;
  private readonly logger = new LoggerService('IdempotencyService');
  private readonly enabled: boolean;
  private readonly ttl: number;
  private readonly header: string;

  constructor(private readonly configService: ConfigService) {
    const idempotencyConfig = this.configService.get('idempotency');
    const redisConfig = this.configService.get('redis');
    
    this.enabled = idempotencyConfig?.enabled !== false;
    this.ttl = parseInt(idempotencyConfig?.ttl?.toString() || '86400');
    this.header = idempotencyConfig?.header || 'Idempotency-Key';
    
    this.redis = new Redis({
      host: redisConfig?.host || 'redis',
      port: parseInt(redisConfig?.port?.toString() || '6379'),
      password: redisConfig?.password || '',
      db: parseInt(redisConfig?.db?.toString() || '0'),
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        this.logger.error(`Redis connection failed, attempt ${times}`);
        return Math.min(times * 100, 5000);
      },
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis error', error);
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis for idempotency');
    });
  }

  async onModuleInit() {
    if (this.enabled) {
      this.logger.log('Idempotency service initialized', {
        enabled: this.enabled,
        ttl: this.ttl,
        header: this.header,
      });
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  extractKeyFromRequest(request: any): string | null {
    // Check header first
    const headerKey = request.headers?.[this.header.toLowerCase()] ||
                      request.headers?.[this.header] ||
                      request.headers?.[`x-${this.header.toLowerCase()}`];
    
    if (headerKey) {
      return Array.isArray(headerKey) ? headerKey[0] : headerKey;
    }

    // Check body
    if (request.body && request.body.idempotencyKey) {
      return request.body.idempotencyKey;
    }

    // Check query params
    if (request.query && request.query.idempotencyKey) {
      return request.query.idempotencyKey;
    }

    return null;
  }

  async checkKey(key: string, operation: string): Promise<IdempotencyCheckResult> {
    if (!this.enabled) {
      return { exists: false, response: null };
    }

    try {
      const redisKey = this.getRedisKey(key, operation);
      const cached = await this.redis.get(redisKey);
      
      if (cached) {
        this.logger.debug('Idempotency cache hit', { key, operation });
        return { exists: true, response: JSON.parse(cached) };
      }

      return { exists: false, response: null };
    } catch (error) {
      this.logger.error('Failed to check idempotency key', { key, operation, error });
      // On error, allow the request to proceed
      return { exists: false, response: null };
    }
  }

  checkKeyObservable(key: string, operation: string): Observable<IdempotencyCheckResult> {
    return of(this.checkKey(key, operation)).pipe(
      switchMap((result) => of(result)),
    );
  }

  async setKey(key: string, operation: string, response: any): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const redisKey = this.getRedisKey(key, operation);
      await this.redis.setex(redisKey, this.ttl, JSON.stringify(response));
      
      this.logger.debug('Stored idempotency response', { key, operation, ttl: this.ttl });
    } catch (error) {
      this.logger.error('Failed to store idempotency response', { key, operation, error });
    }
  }

  async deleteKey(key: string, operation: string): Promise<void> {
    try {
      const redisKey = this.getRedisKey(key, operation);
      await this.redis.del(redisKey);
      
      this.logger.debug('Deleted idempotency key', { key, operation });
    } catch (error) {
      this.logger.error('Failed to delete idempotency key', { key, operation, error });
    }
  }

  async clearExpiredKeys(): Promise<number> {
    try {
      // Use SCAN to find and delete expired keys
      let cursor = '0';
      let count = 0;
      const pattern = this.getRedisKey('*', '*');
      
      do {
        const result = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
        cursor = result[0];
        const keys = result[1];
        
        if (keys.length > 0) {
          const deleted = await this.redis.del(keys);
          count += deleted;
        }
      } while (cursor !== '0');

      this.logger.log('Cleared expired idempotency keys', { count });
      return count;
    } catch (error) {
      this.logger.error('Failed to clear expired idempotency keys', error);
      return 0;
    }
  }

  private getRedisKey(key: string, operation: string): string {
    return `idempotency:${operation}:${key}`;
  }

  async getStats(): Promise<any> {
    try {
      const info = await this.redis.info('memory');
      const keys = await this.redis.keys(this.getRedisKey('*', '*'));
      
      return {
        enabled: this.enabled,
        ttl: this.ttl,
        cachedKeys: keys.length,
        memoryUsage: info?.used_memory || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get idempotency stats', error);
      return {
        enabled: this.enabled,
        ttl: this.ttl,
        cachedKeys: 0,
        memoryUsage: 0,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      return false;
    }
  }
}
