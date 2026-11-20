import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { HealthService } from './health.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liveness check',
    description: 'Check if the service is running',
  })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async livenessCheck() {
    return this.healthService.livenessCheck();
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Readiness check',
    description: 'Check if the service is ready to receive requests',
  })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readinessCheck() {
    return this.healthService.readinessCheck();
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Full health status',
    description: 'Get detailed health status of all components',
  })
  @ApiResponse({ status: 200, description: 'Health status' })
  async status() {
    return this.healthService.status();
  }

  @Get('version')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Version information',
    description: 'Get service version information',
  })
  @ApiResponse({ status: 200, description: 'Version information' })
  async version() {
    return this.healthService.version();
  }
}
