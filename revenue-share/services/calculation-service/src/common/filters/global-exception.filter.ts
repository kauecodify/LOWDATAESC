import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new LoggerService('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Extract information from request
    const { method, url, headers, body, query, params } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const correlationId = headers['x-correlation-id'] || headers['x-request-id'] || 'unknown';
    const ip = headers['x-forwarded-for'] || request.ip || 'unknown';

    // Process the exception
    const status = this.getStatus(exception);
    const message = this.getMessage(exception);
    const code = this.getCode(exception);
    const details = this.getDetails(exception);

    // Log the error
    this.logger.error('Unhandled exception', {
      exception: exception instanceof Error ? exception.stack : String(exception),
      status,
      code,
      message,
      path: url,
      method,
      correlationId,
      userAgent,
      ip,
      body: this.sanitizeBody(body),
      query,
      params,
    });

    // Security logging for sensitive errors
    if (status >= 500 || code === 'INTERNAL_SERVER_ERROR') {
      this.logger.security('Internal server error detected', {
        status,
        code,
        message,
        path: url,
        method,
        correlationId,
        ip,
      });
    }

    // Build error response
    const errorResponse = {
      success: false,
      error: {
        code,
        message,
        status,
        timestamp: new Date().toISOString(),
        path: url,
        method,
        correlationId,
      },
      ...(details && { details }),
    };

    // Set response headers
    response.setHeader('X-Correlation-ID', correlationId);
    response.setHeader('X-Request-ID', correlationId);
    response.setHeader('Content-Type', 'application/json');

    // Send response
    response.status(status).json(errorResponse);
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (exception instanceof Error) {
      const errorMap: Record<string, number> = {
        'Bad Request': HttpStatus.BAD_REQUEST,
        'Unauthorized': HttpStatus.UNAUTHORIZED,
        'Forbidden': HttpStatus.FORBIDDEN,
        'Not Found': HttpStatus.NOT_FOUND,
        'Conflict': HttpStatus.CONFLICT,
        'Too Many Requests': HttpStatus.TOO_MANY_REQUESTS,
        'Internal Server Error': HttpStatus.INTERNAL_SERVER_ERROR,
        'Service Unavailable': HttpStatus.SERVICE_UNAVAILABLE,
        'Gateway Timeout': HttpStatus.GATEWAY_TIMEOUT,
      };

      return errorMap[exception.message] || HttpStatus.INTERNAL_SERVER_ERROR;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (typeof response === 'object' && response !== null) {
        return (response as any).message || JSON.stringify(response);
      }
      return 'Http Exception';
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return String(exception);
  }

  private getCode(exception: unknown): string {
    if (exception instanceof HttpException) {
      return this.getHttpExceptionCode(exception);
    }

    if (exception instanceof Error) {
      const errorCodeMap: Record<string, string> = {
        'Bad Request': 'BAD_REQUEST',
        'Unauthorized': 'UNAUTHORIZED',
        'Forbidden': 'FORBIDDEN',
        'Not Found': 'NOT_FOUND',
        'Conflict': 'CONFLICT',
        'Too Many Requests': 'RATE_LIMITED',
        'Internal Server Error': 'INTERNAL_SERVER_ERROR',
        'Service Unavailable': 'SERVICE_UNAVAILABLE',
        'Gateway Timeout': 'GATEWAY_TIMEOUT',
      };

      return errorCodeMap[exception.message] || 'INTERNAL_SERVER_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  private getHttpExceptionCode(exception: HttpException): string {
    const status = exception.getStatus();
    const codeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      405: 'METHOD_NOT_ALLOWED',
      406: 'NOT_ACCEPTABLE',
      408: 'REQUEST_TIMEOUT',
      409: 'CONFLICT',
      410: 'GONE',
      413: 'PAYLOAD_TOO_LARGE',
      415: 'UNSUPPORTED_MEDIA_TYPE',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT',
    };

    return codeMap[status] || 'HTTP_ERROR';
  }

  private getDetails(exception: unknown): any {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        const details: any = { ...(response as any) };
        delete details.message;
        delete details.error;
        delete details.statusCode;
        if (Object.keys(details).length > 0) {
          return details;
        }
      }
    }

    if (exception instanceof Error && exception.stack) {
      return {
        stack: process.env.NODE_ENV === 'development' ? exception.stack.split('\n') : undefined,
      };
    }

    return null;
  }

  private sanitizeBody(body: any): any {
    if (!body) return null;

    // Create a copy to avoid modifying the original
    const sanitized = { ...body };

    // Remove sensitive fields
    const sensitiveFields = [
      'password', 'passwd', 'secret', 'token', 'apiKey', 'apikey',
      'authorization', 'auth', 'credential', 'credentials', 'privateKey',
      'cardNumber', 'cardnumber', 'cvv', 'expiry', 'pin', 'ssn',
      'bankAccount', 'bankaccount', 'routingNumber', 'routingnumber',
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '**REDACTED**';
      }
      if (sanitized[field.toLowerCase()]) {
        sanitized[field.toLowerCase()] = '**REDACTED**';
      }
      if (sanitized[field.toUpperCase()]) {
        sanitized[field.toUpperCase()] = '**REDACTED**';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeBody(sanitized[key]);
      }
    }

    return sanitized;
  }
}
