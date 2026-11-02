import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';
import { ConfigService } from '@nestjs/config';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly winstonLogger: WinstonLogger;
  private readonly context: string;

  constructor(context: string = 'Application') {
    this.context = context;
    this.winstonLogger = this.createWinstonLogger();
  }

  private createWinstonLogger(): WinstonLogger {
    const configService = new ConfigService();
    const logConfig = configService.get('logging');
    
    const logLevel = logConfig?.level || 'info';
    const logFormat = logConfig?.format || 'json';
    const maxFiles = logConfig?.maxFiles || 10;
    const maxSize = logConfig?.maxSize || '100m';
    const logDir = logConfig?.dir || './logs';

    // Create log directory if it doesn't exist
    const logDirectory = path.resolve(process.cwd(), logDir);
    
    // Format configuration
    const formats = [
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      format.errors({ stack: true }),
      format.splat(),
      format.json(),
    ];

    if (logFormat === 'combined') {
      formats.push(format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, context, ...meta }) => {
          return `${timestamp} [${level}] [${context || this.context}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        }),
      ));
    }

    // Create transports
    const transportList = [
      // Console transport
      new transports.Console({
        level: logLevel,
        format: format.combine(
          format.colorize(),
          format.printf(({ level, message, timestamp, context, ...meta }) => {
            return `${timestamp} [${level}] [${context || this.context}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
          }),
        ),
      }),
    ];

    // File transports
    if (process.env.NODE_ENV === 'production') {
      transportList.push(
        new DailyRotateFile({
          level: logLevel,
          filename: path.join(logDirectory, 'application-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxFiles: parseInt(maxFiles.toString()),
          maxSize: maxSize,
          format: format.combine(...formats),
        }),
        new DailyRotateFile({
          level: 'error',
          filename: path.join(logDirectory, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxFiles: parseInt(maxFiles.toString()),
          maxSize: maxSize,
          format: format.combine(...formats),
        }),
        new DailyRotateFile({
          level: 'warn',
          filename: path.join(logDirectory, 'warn-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxFiles: parseInt(maxFiles.toString()),
          maxSize: maxSize,
          format: format.combine(...formats),
        }),
      );
    }

    return createLogger({
      level: logLevel,
      levels: this.getCustomLevels(),
      format: format.combine(...formats),
      transports: transportList,
      exitOnError: false,
      handleExceptions: true,
      handleRejections: true,
    });
  }

  private getCustomLevels() {
    return {
      error: 0,
      warn: 1,
      info: 2,
      http: 3,
      verbose: 4,
      debug: 5,
      silly: 6,
      // Custom levels
      audit: 2,
      security: 0,
      performance: 3,
      grpc: 3,
    };
  }

  // NestJS LoggerService interface methods
  log(message: string, context?: string, ...args: any[]): void {
    this.winstonLogger.info(message, {
      context: context || this.context,
      ...args,
    });
  }

  error(message: string, trace?: string, context?: string, ...args: any[]): void {
    this.winstonLogger.error(message, {
      context: context || this.context,
      trace,
      ...args,
    });
  }

  warn(message: string, context?: string, ...args: any[]): void {
    this.winstonLogger.warn(message, {
      context: context || this.context,
      ...args,
    });
  }

  debug?(message: string, context?: string, ...args: any[]): void {
    this.winstonLogger.debug(message, {
      context: context || this.context,
      ...args,
    });
  }

  verbose?(message: string, context?: string, ...args: any[]): void {
    this.winstonLogger.verbose(message, {
      context: context || this.context,
      ...args,
    });
  }

  // Additional methods
  audit(message: string, context?: string, ...args: any[]): void {
    this.winstonLogger.log('audit', message, {
      context: context || this.context,
      ...args,
    });
  }

  security(message: string, context?: string, ...args: any[]): void {
    this.winstonLogger.log('security', message, {
      context: context || this.context,
      ...args,
    });
  }

  performance(message: string, context?: string, duration?: number, ...args: any[]): void {
    this.winstonLogger.log('performance', message, {
      context: context || this.context,
      duration,
      ...args,
    });
  }

  grpc(message: string, context?: string, ...args: any[]): void {
    this.winstonLogger.log('grpc', message, {
      context: context || this.context,
      ...args,
    });
  }

  // Winston logger methods
  info(message: string, meta?: any): void {
    this.winstonLogger.info(message, meta);
  }

  http(message: string, meta?: any): void {
    this.winstonLogger.http(message, meta);
  }

  silly(message: string, meta?: any): void {
    this.winstonLogger.silly(message, meta);
  }

  // Child logger
  child(options: any): WinstonLogger {
    return this.winstonLogger.child(options);
  }

  // Flush logs (for testing)
  async flush(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.winstonLogger.on('finish', resolve);
      this.winstonLogger.end();
    });
  }
}
