import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '@nestjs/config';

interface CustomError extends Error {
  statusCode?: number;
  error?: string;
  message?: string;
  details?: any;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new LoggerService();

  constructor(private configService?: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Determine error details
    let statusCode: number;
    let message: string;
    let error: string;
    let details: any;
    let stack: string | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = HttpStatus[statusCode] || 'HTTP_EXCEPTION';
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || 'An error occurred';
        error = (exceptionResponse as any).error || HttpStatus[statusCode] || 'HTTP_EXCEPTION';
        details = (exceptionResponse as any).details;
      } else {
        message = 'An error occurred';
        error = HttpStatus[statusCode] || 'HTTP_EXCEPTION';
      }
    } else if (exception instanceof Error) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message || 'Internal server error';
      error = 'INTERNAL_SERVER_ERROR';
      stack = this.configService?.get('service.environment') === 'development' ? exception.stack : undefined;
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'INTERNAL_SERVER_ERROR';
    }

    // Log the error
    const errorData = {
      statusCode,
      error,
      message,
      path: request.path,
      method: request.method,
      params: request.params,
      query: request.query,
      body: this.sanitizeRequestBody(request.body),
      headers: this.sanitizeHeaders(request.headers),
      timestamp: new Date().toISOString(),
    };

    if (statusCode >= 500) {
      this.logger.error('Internal Server Error', {
        ...errorData,
        stack,
      });
    } else if (statusCode >= 400) {
      this.logger.warn('Client Error', errorData);
    } else {
      this.logger.log('Error', errorData);
    }

    // Prepare response
    const responseBody: any = {
      timestamp: new Date().toISOString(),
      path: request.path,
      method: request.method,
      error,
      message,
    };

    if (details) {
      responseBody.details = details;
    }

    // Add trace ID if available
    const traceId = request.headers['x-request-id'] || request.headers['X-Request-Id'];
    if (traceId) {
      responseBody.traceId = traceId;
    }

    // Send response
    response.status(statusCode).json(responseBody);
  }

  private sanitizeRequestBody(body: any): any {
    if (!body) return null;

    // Remove sensitive fields
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'creditCard', 'cvv', 'documentNumber'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private sanitizeHeaders(headers: any): any {
    if (!headers) return null;

    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    
    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
