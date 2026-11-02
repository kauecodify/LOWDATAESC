import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException, HttpStatus } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { IdempotencyService } from './idempotency.service';
import { LoggerService } from '../logger/logger.service';
import { Reflector } from '@nestjs/core';

// Metadata key for idempotency
const IDEMPOTENCY_METADATA_KEY = 'idempotency';

export interface IdempotencyMetadata {
  operation: string;
  extractKey?: (request: any) => string;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new LoggerService();

  constructor(
    private readonly idempotencyService: IdempotencyService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Check if idempotency is enabled for this route
    const metadata = this.reflector.get<IdempotencyMetadata>(
      IDEMPOTENCY_METADATA_KEY,
      context.getHandler(),
    );

    if (!metadata || !this.idempotencyService.isEnabled()) {
      return next.handle();
    }

    // Extract or generate idempotency key
    let idempotencyKey: string;
    
    if (metadata.extractKey) {
      idempotencyKey = metadata.extractKey(request);
    } else {
      idempotencyKey = this.idempotencyService.extractKeyFromRequest(request);
    }

    if (!idempotencyKey) {
      // No idempotency key provided - allow request to proceed
      // but log a warning
      this.logger.warn('No idempotency key provided for idempotent operation', {
        path: request.path,
        method: request.method,
      });
      return next.handle();
    }

    // Check if this key has been used before
    return this.idempotencyService.checkKey(idempotencyKey, metadata.operation).pipe(
      switchMap(({ exists, response: cachedResponse }) => {
        if (exists) {
          // Return cached response
          this.logger.log('Idempotency: Returning cached response', {
            key: idempotencyKey,
            operation: metadata.operation,
          });
          
          // Set response headers
          response.setHeader('X-Idempotency-Key', idempotencyKey);
          response.setHeader('X-Idempotency-Cached', 'true');
          
          return throwError(() => new HttpException(cachedResponse, HttpStatus.OK));
        }

        // Process the request
        return next.handle().pipe(
          catchError((error) => {
            // Store error response for idempotency
            this.storeResponse(idempotencyKey, metadata.operation, error);
            return throwError(() => error);
          }),
          switchMap((result) => {
            // Store successful response for idempotency
            this.storeResponse(idempotencyKey, metadata.operation, result);
            
            // Set response headers
            response.setHeader('X-Idempotency-Key', idempotencyKey);
            response.setHeader('X-Idempotency-Cached', 'false');
            
            return [result];
          }),
        );
      }),
    );
  }

  private async storeResponse(key: string, operation: string, response: any): Promise<void> {
    try {
      // Normalize response for storage
      const normalizedResponse = this.normalizeResponse(response);
      await this.idempotencyService.setKey(key, operation, normalizedResponse);
    } catch (error) {
      this.logger.error('Failed to store idempotency response', error);
    }
  }

  private normalizeResponse(response: any): any {
    if (response instanceof HttpException) {
      return {
        statusCode: response.getStatus(),
        message: response.getResponse(),
        error: response.name,
      };
    }

    if (response instanceof Error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: response.message,
        error: response.name,
      };
    }

    // For successful responses, return the data
    return {
      statusCode: HttpStatus.OK,
      data: response,
    };
  }
}

// Decorator to mark routes as idempotent
export function Idempotent(metadata?: Partial<IdempotencyMetadata>) {
  return applyIdempotencyMetadata({
    operation: metadata?.operation || '',
    extractKey: metadata?.extractKey,
  });
}

function applyIdempotencyMetadata(metadata: IdempotencyMetadata): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata(IDEMPOTENCY_METADATA_KEY, metadata, descriptor.value);
    return descriptor;
  };
}
