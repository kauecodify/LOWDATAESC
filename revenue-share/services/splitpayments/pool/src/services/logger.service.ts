import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class LoggerService {
  private readonly logger: winston.Logger;
  private readonly config: any;

  constructor() {
    const configService = new ConfigService();
    this.config = {
      level: configService.get('logging.level') || 'info',
      format: configService.get('logging.format') || 'json',
      maxFiles: configService.get('logging.maxFiles') || '10',
      maxSize: configService.get('logging.maxSize') || '100m',
      dir: configService.get('logging.dir') || './logs/pool',
    };

    // Ensure logs directory exists
    if (!fs.existsSync(this.config.dir)) {
      fs.mkdirSync(this.config.dir, { recursive: true });
    }

    // Define log format
    const logFormat = this.config.format === 'json'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf(({ level, message, timestamp, ...meta }) => {
            return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''}`;
          })
        );

    // Create logger
    this.logger = winston.createLogger({
      level: this.config.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        logFormat
      ),
      defaultMeta: {
        service: 'split-payment-pool',
        version: configService.get('pool.version') || '1.0.0',
      },
      transports: [
        // Console transport
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            logFormat
          ),
        }),
        // File transport with rotation
        new DailyRotateFile({
          filename: path.join(this.config.dir, 'pool-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: this.config.maxSize,
          maxFiles: this.config.maxFiles,
          auditFile: path.join(this.config.dir, 'pool-audit.json'),
        }),
        // Error log
        new DailyRotateFile({
          level: 'error',
          filename: path.join(this.config.dir, 'pool-error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: this.config.maxSize,
          maxFiles: this.config.maxFiles,
        }),
      ],
      exceptionHandlers: [
        new DailyRotateFile({
          filename: path.join(this.config.dir, 'pool-exceptions-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: this.config.maxSize,
          maxFiles: this.config.maxFiles,
        }),
      ],
      rejectionHandlers: [
        new DailyRotateFile({
          filename: path.join(this.config.dir, 'pool-rejections-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: this.config.maxSize,
          maxFiles: this.config.maxFiles,
        }),
      ],
      exitOnError: false,
    });
  }

  log(message: string, context?: string | object): void {
    if (typeof context === 'string') {
      this.logger.info(message, { context });
    } else {
      this.logger.info(message, context);
    }
  }

  error(message: string, trace?: string | object, context?: string): void {
    if (typeof trace === 'string') {
      this.logger.error(message, { trace, context });
    } else {
      this.logger.error(message, { ...trace, context });
    }
  }

  warn(message: string, context?: string | object): void {
    if (typeof context === 'string') {
      this.logger.warn(message, { context });
    } else {
      this.logger.warn(message, context);
    }
  }

  debug?(message: string, context?: string | object): void {
    if (typeof context === 'string') {
      this.logger.debug(message, { context });
    } else {
      this.logger.debug(message, context);
    }
  }

  verbose?(message: string, context?: string | object): void {
    if (typeof context === 'string') {
      this.logger.verbose(message, { context });
    } else {
      this.logger.verbose(message, context);
    }
  }

  // Pool-specific logging
  logTransaction(transactionId: string, action: string, data?: any, error?: string): void {
    const logData = {
      transactionId,
      action,
      ...data,
    };

    if (error) {
      this.logger.error(`Transaction ${action} failed`, { ...logData, error });
    } else {
      this.logger.info(`Transaction ${action}`, logData);
    }
  }

  logGateway(gateway: string, action: string, data?: any, error?: string): void {
    const logData = {
      gateway,
      action,
      ...data,
    };

    if (error) {
      this.logger.error(`Gateway ${action} failed`, { ...logData, error });
    } else {
      this.logger.info(`Gateway ${action}`, logData);
    }
  }

  logWorker(workerId: number, action: string, data?: any, error?: string): void {
    const logData = {
      workerId,
      action,
      ...data,
    };

    if (error) {
      this.logger.error(`Worker ${action} failed`, { ...logData, error });
    } else {
      this.logger.info(`Worker ${action}`, logData);
    }
  }

  // Audit logging
  audit(action: string, data: any, context?: string): void {
    const auditData = {
      timestamp: new Date().toISOString(),
      action,
      data,
      context,
      service: 'split-payment-pool',
    };

    this.logger.info('POOL_AUDIT', auditData);
  }
}
