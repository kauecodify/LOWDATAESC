import { Controller, Get, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { MtlsGuard } from '../../common/guards/mtls.guard';
import { Request } from 'express';
import { LoggerService } from '../../common/logger/logger.service';

@ApiTags('Health')
@ApiBearerAuth('JWT')
@Controller('api/v1/health')
@Header('X-Service', 'ingest-service')
@Header('X-Version', '1.0.0')
export class HealthController {
  private readonly logger = new LoggerService();

  constructor(private readonly healthService: HealthService) {}

  @Get('liveness')
  @UseGuards(MtlsGuard)
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Simple liveness check to verify the service is running. Returns 200 if the application is alive.',
  })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  @HttpCode(HttpStatus.OK)
  async livenessProbe(@Req() request: Request): Promise<any> {
    this.logger.debug('Liveness probe requested', {
      correlationId: request.headers['x-correlation-id'],
    });

    return await this.healthService.checkLiveness();
  }

  @Get('readiness')
  @UseGuards(MtlsGuard)
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Readiness check to verify all dependencies (database, Kafka, Redis) are available. Returns 200 if all checks pass, 503 otherwise.',
  })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  @HttpCode(HttpStatus.OK)
  async readinessProbe(@Req() request: Request): Promise<any> {
    this.logger.debug('Readiness probe requested', {
      correlationId: request.headers['x-correlation-id'],
    });

    return await this.healthService.checkReadiness();
  }

  @Get()
  @UseGuards(MtlsGuard)
  @ApiOperation({
    summary: 'Full health check',
    description: 'Comprehensive health check with detailed status of all components including database, Kafka, Redis, and service metrics.',
  })
  @ApiResponse({ status: 200, description: 'Service is healthy with details' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  @HttpCode(HttpStatus.OK)
  async fullHealthCheck(@Req() request: Request): Promise<any> {
    this.logger.debug('Full health check requested', {
      correlationId: request.headers['x-correlation-id'],
    });

    return await this.healthService.checkFullHealth();
  }

  @Get('metrics')
  @UseGuards(MtlsGuard)
  @ApiOperation({
    summary: 'Service metrics',
    description: 'Returns service metrics including event counts, processing times, error rates, and resource usage.',
  })
  @ApiResponse({ status: 200, description: 'Service metrics' })
  @ApiResponse({ status: 503, description: 'Metrics unavailable' })
  @HttpCode(HttpStatus.OK)
  async getMetrics(@Req() request: Request): Promise<any> {
    this.logger.debug('Metrics requested', {
      correlationId: request.headers['x-correlation-id'],
    });

    return await this.healthService.getMetrics();
  }

  @Get('version')
  @ApiOperation({
    summary: 'Service version',
    description: 'Returns the service version information including build details and dependencies.',
  })
  @ApiResponse({ status: 200, description: 'Version information' })
  @HttpCode(HttpStatus.OK)
  async getVersion(@Req() request: Request): Promise<any> {
    this.logger.debug('Version info requested', {
      correlationId: request.headers['x-correlation-id'],
    });

    return await this.healthService.getVersionInfo();
  }
}
