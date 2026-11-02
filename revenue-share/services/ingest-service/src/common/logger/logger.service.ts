import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: winston.Logger;

  constructor(private readonly configService: ConfigService = null) {
    const logConfig = this.configService?.get('logging') || {};
    const serviceConfig = this.configService?.get('service') || {};

    const logLevel = logConfig.level || 'info';
    const logFormat = logConfig.format || 'json';
    const maxFiles = logConfig.maxFiles || 10;
    const maxSize = logConfig.maxSize || '100m';
    const logDir = logConfig.dir || './logs';

    const serviceName = serviceConfig.name || 'ingest-service';
    const serviceVersion = serviceConfig.version || '1.0.0';

    // Create log directory if it doesn't exist
    const fs = require('fs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Define transports
    const transports: winston.transport[] = [
      new winston.transports.Console({
        level: logLevel,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.splat(),
          winston.format.json(),
        ),
      }),
    ];

    // Add file transports for different levels
    transports.push(
      new DailyRotateFile({
        level: 'error',
        filename: `${logDir}/${serviceName}-error-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxFiles: maxFiles,
        maxSize: maxSize,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.splat(),
          winston.format.json(),
        ),
      }),
    );

    transports.push(
      new DailyRotateFile({
        level: 'info',
        filename: `${logDir}/${serviceName}-combined-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxFiles: maxFiles,
        maxSize: maxSize,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.splat(),
          winston.format.json(),
        ),
      }),
    );

    // Create logger
    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
      ),
      defaultMeta: {
        service: serviceName,
        version: serviceVersion,
        environment: process.env.NODE_ENV || 'development',
      },
      transports,
      exitOnError: false,
    });
  }

  log(message: string, context?: string): void {
    this.logger.info(message, context ? { context } : {});
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, {
      trace,
      context: context ? { context } : {},
    });
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, context ? { context } : {});
  }

  debug?(message: string, context?: string): void {
    this.logger.debug(message, context ? { context } : {});
  }

  verbose?(message: string, context?: string): void {
    this.logger.verbose(message, context ? { context } : {});
  }

  // Additional methods for structured logging
  info(message: string, meta?: Record<string, any>): void {
    this.logger.info(message, meta);
  }

  warnWithMeta(message: string, meta?: Record<string, any>): void {
    this.logger.warn(message, meta);
  }

  errorWithMeta(message: string, meta?: Record<string, any>): void {
    this.logger.error(message, meta);
  }

  // Method to create a child logger with additional context
  child(context: Record<string, any>): winston.Logger {
    return this.logger.child(context);
  }
}
