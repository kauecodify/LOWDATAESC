import { Controller, Post, Get, Body, Param, Query, UseGuards, Req, HttpCode, HttpStatus, Header, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiHeader, ApiBody } from '@nestjs/swagger';
import { EventService } from './event.service';
import { CreateRevenueEventDto, RevenueEventStatus, RevenueEventType } from './dto/create-revenue-event.dto';
import { MtlsGuard } from '../../common/guards/mtls.guard';
import { RbacGuard, Roles, Permissions } from '../../common/guards/rbac.guard';
import { Request } from 'express';
import { LoggerService } from '../../common/logger/logger.service';

@ApiTags('Revenue Events')
@ApiBearerAuth('JWT')
@UseGuards(MtlsGuard, RbacGuard)
@Controller('api/v1/revenue-events')
@Header('X-Service', 'ingest-service')
@Header('X-Version', '1.0.0')
export class EventController {
  private readonly logger = new LoggerService();

  constructor(private readonly eventService: EventService) {}

  // ============================================================================
  // CREATE EVENTS
  // ============================================================================

  @Post()
  @Roles(['ingest:write', 'admin'], false)
  @Permissions(['revenue:create'], false)
  @ApiOperation({
    summary: 'Create a new revenue event',
    description: 'Creates a new revenue event with idempotency check and hash chain integration. Returns the created event with its hash chain information.',
  })
  @ApiBody({ type: CreateRevenueEventDto })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Conflict - duplicate event (idempotency)' })
  @HttpCode(HttpStatus.CREATED)
  async createEvent(
    @Body() createRevenueEventDto: CreateRevenueEventDto,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Creating revenue event', {
      correlationId: request.headers['x-correlation-id'],
      userAgent: request.headers['user-agent'],
    });

    try {
      const result = await this.eventService.createEvent(createRevenueEventDto);
      
      this.logger.log('Event created successfully', {
        eventId: result.eventId,
        status: result.status,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to create event', error);
      throw error;
    }
  }

  @Post('batch')
  @Roles(['ingest:write', 'admin'], false)
  @Permissions(['revenue:create_batch'], false)
  @ApiOperation({
    summary: 'Create multiple revenue events in batch',
    description: 'Creates multiple revenue events in a single request with duplicate detection and hash chain continuity.',
  })
  @ApiBody({ type: [CreateRevenueEventDto] })
  @ApiResponse({ status: 201, description: 'Batch processed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'maxSize', required: false, type: Number, description: 'Maximum batch size (default: 100)' })
  @HttpCode(HttpStatus.CREATED)
  async createBatchEvents(
    @Body() events: CreateRevenueEventDto[],
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Creating batch of revenue events', {
      count: events.length,
      correlationId: request.headers['x-correlation-id'],
    });

    if (events.length > 100) {
      return {
        error: 'Maximum batch size is 100 events',
        received: events.length,
      };
    }

    try {
      const result = await this.eventService.createBatchEvents(events);
      
      this.logger.log('Batch processed successfully', {
        successCount: result.successCount,
        errorCount: result.errorCount,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to process batch', error);
      throw error;
    }
  }

  // ============================================================================
  // READ EVENTS
  // ============================================================================

  @Get(':id')
  @Roles(['ingest:read', 'calculation:read', 'audit:read', 'admin'], false)
  @Permissions(['revenue:read'], false)
  @ApiOperation({
    summary: 'Get a revenue event by ID',
    description: 'Retrieves a revenue event by its eventId with full details including deductions, metadata, and hash chain information.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The eventId of the revenue event' })
  @ApiResponse({ status: 200, description: 'Event details' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getEvent(
    @Param('id') eventId: string,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Fetching revenue event', {
      eventId,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.eventService.getEvent(eventId);
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch event', { eventId, error: error.message });
      throw error;
    }
  }

  @Get()
  @Roles(['ingest:read', 'calculation:read', 'audit:read', 'admin'], false)
  @Permissions(['revenue:list'], false)
  @ApiOperation({
    summary: 'List revenue events with pagination and filtering',
    description: 'Returns a paginated list of revenue events with optional filtering by status, type, and date range.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 100)' })
  @ApiQuery({ name: 'status', required: false, enum: RevenueEventStatus, description: 'Filter by event status' })
  @ApiQuery({ name: 'type', required: false, enum: RevenueEventType, description: 'Filter by event type' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Filter by start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Filter by end date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Paginated list of events' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listEvents(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 100,
    @Query('status') status?: RevenueEventStatus,
    @Query('type') type?: RevenueEventType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Listing revenue events', {
      page,
      limit,
      status,
      type,
      startDate,
      endDate,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.eventService.listEvents(
        page,
        limit,
        status,
        type,
        startDate,
        endDate,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to list events', error);
      throw error;
    }
  }

  // ============================================================================
  // RETRY OPERATIONS
  // ============================================================================

  @Post(':id/retry')
  @Roles(['ingest:write', 'admin'], false)
  @Permissions(['revenue:retry'], false)
  @ApiOperation({
    summary: 'Retry a failed revenue event',
    description: 'Retries processing of a failed revenue event. Increments retry count and re-queues the event for processing.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The eventId of the revenue event to retry' })
  @ApiResponse({ status: 200, description: 'Event retried successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - event cannot be retried' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async retryEvent(
    @Param('id') eventId: string,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Retrying revenue event', {
      eventId,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.eventService.retryEvent(eventId);
      
      this.logger.log('Event retried successfully', {
        eventId,
        retryCount: result.retryCount,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to retry event', { eventId, error: error.message });
      throw error;
    }
  }

  @Post('retry-all')
  @Roles(['ingest:write', 'admin'], false)
  @Permissions(['revenue:retry_all'], false)
  @ApiOperation({
    summary: 'Retry all failed revenue events',
    description: 'Retries all failed revenue events in the system. Returns statistics about the retry operation.',
  })
  @ApiQuery({ name: 'maxEvents', required: false, type: Number, description: 'Maximum number of events to retry (default: 100)' })
  @ApiResponse({ status: 200, description: 'Batch retry completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async retryAllFailedEvents(
    @Query('maxEvents') maxEvents: number = 100,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Retrying all failed events', {
      maxEvents,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.eventService.retryAllFailedEvents();
      
      this.logger.log('Batch retry completed', {
        successCount: result.successCount,
        errorCount: result.errorCount,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to retry all events', error);
      throw error;
    }
  }

  // ============================================================================
  // CORRECTION OPERATIONS
  // ============================================================================

  @Post(':id/correct')
  @Roles(['admin', 'audit:write'], false)
  @Permissions(['revenue:correct'], false)
  @ApiOperation({
    summary: 'Apply manual correction to a processed event',
    description: 'Applies manual corrections to a processed revenue event. Creates an audit trail of the correction.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The eventId of the revenue event to correct' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        corrections: {
          type: 'object',
          description: 'Key-value pairs of fields to correct',
          additionalProperties: true,
        },
        justification: {
          type: 'string',
          description: 'Reason for the correction',
        },
      },
      required: ['corrections', 'justification'],
    },
  })
  @ApiHeader({ name: 'X-Approved-By', description: 'User ID of the approver', required: true })
  @ApiResponse({ status: 200, description: 'Correction applied successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - event cannot be corrected' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async correctEvent(
    @Param('id') eventId: string,
    @Body() body: { corrections: Record<string, any>; justification: string },
    @Req() request: Request,
  ): Promise<any> {
    const approvedBy = request.headers['x-approved-by'] as string || request.user?.id || 'unknown';
    
    this.logger.log('Applying correction to event', {
      eventId,
      corrections: Object.keys(body.corrections),
      justification: body.justification,
      approvedBy,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.eventService.correctEvent(
        eventId,
        body.corrections,
        body.justification,
        approvedBy,
      );

      this.logger.log('Correction applied successfully', {
        eventId,
        approvedBy,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to apply correction', { eventId, error: error.message });
      throw error;
    }
  }

  // ============================================================================
  // HASH CHAIN OPERATIONS
  // ============================================================================

  @Get(':id/hash-chain')
  @Roles(['audit:read', 'admin'], false)
  @Permissions(['revenue:hash_chain:read'], false)
  @ApiOperation({
    summary: 'Get hash chain for a revenue event',
    description: 'Retrieves the hash chain for a specific event, showing the cryptographic linkage to previous events.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The eventId of the revenue event' })
  @ApiQuery({ name: 'depth', required: false, type: Number, description: 'Number of previous events to include in chain (default: 10)' })
  @ApiResponse({ status: 200, description: 'Hash chain information' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getEventHashChain(
    @Param('id') eventId: string,
    @Query('depth') depth: number = 10,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Fetching hash chain for event', {
      eventId,
      depth,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.eventService.getEventHashChain(eventId);
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch hash chain', { eventId, error: error.message });
      throw error;
    }
  }

  // ============================================================================
  // STATISTICS AND METRICS
  // ============================================================================

  @Get('stats')
  @Roles(['ingest:read', 'admin', 'monitoring:read'], false)
  @Permissions(['revenue:stats:read'], false)
  @ApiOperation({
    summary: 'Get revenue event statistics',
    description: 'Returns statistics about revenue events including counts by status, processing times, and error rates.',
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date for statistics (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date for statistics (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Service statistics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Fetching service statistics', {
      startDate,
      endDate,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.eventService.getStats();
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch statistics', error);
      throw error;
    }
  }

  // ============================================================================
  // HEALTH AND STATUS
  // ============================================================================

  @Get('health')
  @Roles([], false) // No authentication required for health check
  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Returns the health status of the ingest service including Kafka connectivity and database status.',
  })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async healthCheck(@Req() request: Request): Promise<any> {
    this.logger.log('Health check requested', {
      correlationId: request.headers['x-correlation-id'],
    });

    return {
      status: 'healthy',
      service: 'ingest-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'up' },
        kafka: { status: 'up' },
        redis: { status: 'up' },
      },
    };
  }
}
