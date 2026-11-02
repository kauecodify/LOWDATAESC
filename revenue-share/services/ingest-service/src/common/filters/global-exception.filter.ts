import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new LoggerService();

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Handle HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const responseBody = exception.getResponse();

      this.logException(request, status, responseBody, 'HttpException');

      return response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        error: typeof responseBody === 'string' ? responseBody : responseBody,
      });
    }

    // Handle validation errors
    if (exception instanceof Error && exception.name === 'ValidationError') {
      this.logException(request, HttpStatus.BAD_REQUEST, exception.message, 'ValidationError');

      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        error: 'Validation Error',
        message: exception.message,
      });
    }

    // Handle TypeORM errors
    if (exception instanceof Error && exception.name === 'QueryFailedError') {
      this.logException(request, HttpStatus.BAD_REQUEST, exception.message, 'QueryFailedError');

      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        error: 'Database Error',
        message: 'A database error occurred',
      });
    }

    // Handle Kafka errors
    if (exception instanceof Error && exception.message.includes('Kafka')) {
      this.logException(request, HttpStatus.SERVICE_UNAVAILABLE, exception.message, 'KafkaError');

      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        error: 'Service Unavailable',
        message: 'Kafka service is unavailable',
      });
    }

    // Handle Redis errors
    if (exception instanceof Error && exception.message.includes('Redis')) {
      this.logException(request, HttpStatus.SERVICE_UNAVAILABLE, exception.message, 'RedisError');

      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        error: 'Service Unavailable',
        message: 'Redis service is unavailable',
      });
    }

    // Handle unknown errors
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const error = exception as Error;

    this.logException(request, status, error?.message || 'Unknown error', 'InternalServerError');

    return response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  }

  private logException(request: Request, status: number, message: any, type: string) {
    const logData = {
      status,
      path: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body,
      query: request.query,
      params: request.params,
      ip: request.ip,
      userAgent: request.get('User-Agent'),
      errorType: type,
      errorMessage: typeof message === 'string' ? message : JSON.stringify(message),
    };

    if (status >= 500) {
      this.logger.error(`[${type}] ${request.method} ${request.url}`, logData);
    } else if (status >= 400) {
      this.logger.warn(`[${type}] ${request.method} ${request.url}`, logData);
    } else {
      this.logger.log(`[${type}] ${request.method} ${request.url}`, logData);
    }
  }
}
