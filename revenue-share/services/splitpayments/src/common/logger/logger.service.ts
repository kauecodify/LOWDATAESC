import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: winston.Logger;
  private readonly config: any;

  constructor() {
    const configService = new ConfigService();
    this.config = {
      level: configService.get('logging.level') || 'info',
      format: configService.get('logging.format') || 'json',
      maxFiles: configService.get('logging.maxFiles') || '10',
      maxSize: configService.get('logging.maxSize') || '100m',
      dir: configService.get('logging.dir') || './logs',
      audit: configService.get('logging.audit') || {},
    };

    // Ensure logs directory exists
    if (!fs.existsSync(this.config.dir)) {
      fs.mkdirSync(this.config.dir, { recursive: true });
    }

    // Create audit directory if enabled
    if (this.config.audit?.enabled) {
      const auditDir = path.join(this.config.dir, 'audit');
      if (!fs.existsSync(auditDir)) {
        fs.mkdirSync(auditDir, { recursive: true });
      }
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
        service: 'split-payment-service',
        version: configService.get('service.version') || '1.0.0',
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
          filename: path.join(this.config.dir, 'split-payment-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: this.config.maxSize,
          maxFiles: this.config.maxFiles,
          auditFile: path.join(this.config.dir, 'split-payment-audit.json'),
        }),
        // Error log
        new DailyRotateFile({
          level: 'error',
          filename: path.join(this.config.dir, 'split-payment-error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: this.config.maxSize,
          maxFiles: this.config.maxFiles,
        }),
      ],
      exceptionHandlers: [
        new DailyRotateFile({
          filename: path.join(this.config.dir, 'split-payment-exceptions-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: this.config.maxSize,
          maxFiles: this.config.maxFiles,
        }),
      ],
      rejectionHandlers: [
        new DailyRotateFile({
          filename: path.join(this.config.dir, 'split-payment-rejections-%DATE%.log'),
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

  // Audit logging for compliance
  audit(action: string, data: any, context?: string): void {
    const auditData = {
      timestamp: new Date().toISOString(),
      action,
      data,
      context,
      service: 'split-payment-service',
    };

    this.logger.info('AUDIT', auditData);

    // Also log to separate audit file
    if (this.config.audit?.enabled) {
      const auditLogger = winston.createLogger({
        level: 'info',
        format: winston.format.json(),
        transports: [
          new DailyRotateFile({
            filename: path.join(this.config.dir, 'audit', 'audit-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: this.config.maxSize,
            maxFiles: this.config.maxFiles,
          }),
        ],
      });
      auditLogger.info('AUDIT', auditData);
    }
  }

  // S3 WORM Audit logging
  async auditToS3(action: string, data: any, context?: string): Promise<void> {
    try {
      const auditData = {
        timestamp: new Date().toISOString(),
        action,
        data,
        context,
        service: 'split-payment-service',
        version: this.config.version,
      };

      // For now, just log to file
      // In production, this would upload to S3 with WORM enabled
      this.audit(action, data, context);
    } catch (error) {
      this.error('Failed to log audit to S3', error);
    }
  }
}
