import { Controller, Post, Get, Body, Param, Query, UseGuards, Req, HttpCode, HttpStatus, Patch, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiHeader, ApiBody } from '@nestjs/swagger';
import { CalculationService } from './services/calculation.service';
import { 
  CreateCalculationDto, 
  CalculationResponseDto,
  CalculationType, 
  CalculationStatus,
  DistributionRuleDto,
} from './dto/create-calculation.dto';
import { MtlsGuard } from '../../common/guards/mtls.guard';
import { RbacGuard, Roles, Permissions } from '../../common/guards/rbac.guard';
import { Request } from 'express';
import { LoggerService } from '../../common/logger/logger.service';

@ApiTags('Calculations')
@ApiBearerAuth('JWT')
@UseGuards(MtlsGuard, RbacGuard)
@Controller('api/v1/calculations')
@Header('X-Service', 'calculation-service')
@Header('X-Version', '1.0.0')
export class CalculationController {
  private readonly logger = new LoggerService('CalculationController');

  constructor(private readonly calculationService: CalculationService) {}

  // ============================================================================
  // CALCULATION ENDPOINTS
  // ============================================================================

  @Post()
  @Roles(['calculation:write', 'admin'], false)
  @Permissions(['calculation:create'], false)
  @ApiOperation({
    summary: 'Create a new calculation',
    description: 'Creates a new calculation request with idempotency check and hash chain integration.',
  })
  @ApiBody({ type: CreateCalculationDto })
  @ApiResponse({ status: 201, description: 'Calculation created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Conflict - duplicate calculation' })
  @HttpCode(HttpStatus.CREATED)
  async createCalculation(
    @Body() createCalculationDto: CreateCalculationDto,
    @Req() request: Request,
  ): Promise<CalculationResponseDto> {
    this.logger.log('Creating calculation', {
      eventId: createCalculationDto.eventId,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.calculationService.createCalculation(createCalculationDto);
      
      this.logger.log('Calculation created successfully', {
        calculationId: result.id,
        status: result.status,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to create calculation', error);
      throw error;
    }
  }

  @Post('revenue-share')
  @Roles(['calculation:write', 'admin'], false)
  @Permissions(['calculation:revenue_share'], false)
  @ApiOperation({
    summary: 'Calculate revenue share distribution',
    description: 'Calculates revenue share distribution for a specific event using the specified distribution rule.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'The event ID to calculate' },
        distributionRuleId: { type: 'string', description: 'The distribution rule to use' },
        input: { $ref: '#/components/schemas/CalculationInputDto' },
        idempotencyKey: { type: 'string', description: 'Idempotency key' },
      },
      required: ['eventId', 'distributionRuleId', 'input'],
    },
  })
  @ApiResponse({ status: 201, description: 'Revenue share calculated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @HttpCode(HttpStatus.CREATED)
  async calculateRevenueShare(
    @Body() body: {
      eventId: string;
      distributionRuleId: string;
      input: any;
      idempotencyKey?: string;
    },
    @Req() request: Request,
  ): Promise<CalculationResponseDto> {
    this.logger.log('Calculating revenue share', {
      eventId: body.eventId,
      distributionRuleId: body.distributionRuleId,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.calculationService.calculateRevenueShare(
        body.eventId,
        body.distributionRuleId,
        body.input,
        {
          idempotencyKey: body.idempotencyKey,
          correlationId: request.headers['x-correlation-id'] as string,
          source: request.headers['x-service'] as string || 'api',
        },
      );

      this.logger.log('Revenue share calculated successfully', {
        calculationId: result.id,
        totalAmount: result.totalAmount,
        resultCount: result.results.length,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to calculate revenue share', error);
      throw error;
    }
  }

  @Get(':id')
  @Roles(['calculation:read', 'audit:read', 'admin'], false)
  @Permissions(['calculation:read'], false)
  @ApiOperation({
    summary: 'Get a calculation by ID',
    description: 'Retrieves a calculation by its ID with full details including results and hash chain information.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The calculation ID' })
  @ApiResponse({ status: 200, description: 'Calculation details' })
  @ApiResponse({ status: 404, description: 'Calculation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCalculation(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<CalculationResponseDto> {
    this.logger.log('Fetching calculation', {
      id,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.calculationService.getCalculation(id);
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch calculation', { id, error: error.message });
      throw error;
    }
  }

  @Get()
  @Roles(['calculation:read', 'audit:read', 'admin'], false)
  @Permissions(['calculation:list'], false)
  @ApiOperation({
    summary: 'List calculations with pagination and filtering',
    description: 'Returns a paginated list of calculations with optional filtering by status, type, and date range.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 100)' })
  @ApiQuery({ name: 'status', required: false, enum: CalculationStatus, description: 'Filter by calculation status' })
  @ApiQuery({ name: 'type', required: false, enum: CalculationType, description: 'Filter by calculation type' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Filter by start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Filter by end date (ISO 8601)' })
  @ApiQuery({ name: 'eventId', required: false, type: String, description: 'Filter by event ID' })
  @ApiResponse({ status: 200, description: 'Paginated list of calculations' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listCalculations(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 100,
    @Query('status') status?: CalculationStatus,
    @Query('type') type?: CalculationType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('eventId') eventId?: string,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Listing calculations', {
      page,
      limit,
      status,
      type,
      startDate,
      endDate,
      eventId,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.calculationService.listCalculations(
        page,
        limit,
        status,
        type,
        startDate,
        endDate,
        eventId,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to list calculations', error);
      throw error;
    }
  }

  @Patch(':id')
  @Roles(['calculation:write', 'admin'], false)
  @Permissions(['calculation:update'], false)
  @ApiOperation({
    summary: 'Update a calculation',
    description: 'Updates a calculation with new data. Only certain fields can be updated.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The calculation ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: { enum: CalculationStatus, description: 'New status' },
        metadata: { type: 'object', description: 'Updated metadata' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Calculation updated successfully' })
  @ApiResponse({ status: 404, description: 'Calculation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateCalculation(
    @Param('id') id: string,
    @Body() updateData: any,
    @Req() request: Request,
  ): Promise<CalculationResponseDto> {
    this.logger.log('Updating calculation', {
      id,
      updateData: Object.keys(updateData),
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.calculationService.updateCalculation(id, updateData);
      return result;
    } catch (error) {
      this.logger.error('Failed to update calculation', { id, error: error.message });
      throw error;
    }
  }

  @Delete(':id')
  @Roles(['calculation:write', 'admin'], false)
  @Permissions(['calculation:delete'], false)
  @ApiOperation({
    summary: 'Delete a calculation',
    description: 'Soft deletes a calculation. The calculation can be recovered if needed.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The calculation ID' })
  @ApiResponse({ status: 200, description: 'Calculation deleted successfully' })
  @ApiResponse({ status: 404, description: 'Calculation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async deleteCalculation(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<void> {
    this.logger.log('Deleting calculation', {
      id,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      await this.calculationService.deleteCalculation(id);
    } catch (error) {
      this.logger.error('Failed to delete calculation', { id, error: error.message });
      throw error;
    }
  }

  // ============================================================================
  // RETRY OPERATIONS
  // ============================================================================

  @Post(':id/retry')
  @Roles(['calculation:write', 'admin'], false)
  @Permissions(['calculation:retry'], false)
  @ApiOperation({
    summary: 'Retry a failed calculation',
    description: 'Retries processing of a failed calculation. Increments retry count and re-queues the calculation.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The calculation ID to retry' })
  @ApiResponse({ status: 200, description: 'Calculation retried successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - calculation cannot be retried' })
  @ApiResponse({ status: 404, description: 'Calculation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async retryCalculation(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<CalculationResponseDto> {
    this.logger.log('Retrying calculation', {
      id,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.calculationService.retryCalculation(id);
      
      this.logger.log('Calculation retried successfully', {
        calculationId: result.id,
        retryCount: result.retryCount,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to retry calculation', { id, error: error.message });
      throw error;
    }
  }

  @Post('retry-all')
  @Roles(['calculation:write', 'admin'], false)
  @Permissions(['calculation:retry_all'], false)
  @ApiOperation({
    summary: 'Retry all failed calculations',
    description: 'Retries all failed calculations in the system. Returns statistics about the retry operation.',
  })
  @ApiQuery({ name: 'maxCalculations', required: false, type: Number, description: 'Maximum number of calculations to retry (default: 100)' })
  @ApiResponse({ status: 200, description: 'Batch retry completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async retryAllFailedCalculations(
    @Query('maxCalculations') maxCalculations: number = 100,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Retrying all failed calculations', {
      maxCalculations,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.calculationService.retryAllFailedCalculations();
      
      this.logger.log('Batch retry completed', {
        successCount: result.successCount,
        errorCount: result.errorCount,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to retry all calculations', error);
      throw error;
    }
  }

  // ============================================================================
  // HASH CHAIN OPERATIONS
  // ============================================================================

  @Get(':id/hash-chain')
  @Roles(['audit:read', 'admin'], false)
  @Permissions(['calculation:hash_chain:read'], false)
  @ApiOperation({
    summary: 'Get hash chain for a calculation',
    description: 'Retrieves the hash chain for a specific calculation, showing the cryptographic linkage to previous calculations.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The calculation ID' })
  @ApiQuery({ name: 'depth', required: false, type: Number, description: 'Number of previous calculations to include in chain (default: 10)' })
  @ApiResponse({ status: 200, description: 'Hash chain information' })
  @ApiResponse({ status: 404, description: 'Calculation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCalculationHashChain(
    @Param('id') id: string,
    @Query('depth') depth: number = 10,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Fetching hash chain for calculation', {
      id,
      depth,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.calculationService.getCalculationHashChain(id);
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch hash chain', { id, error: error.message });
      throw error;
    }
  }

  @Get(':id/hash-chain/verify')
  @Roles(['audit:read', 'admin'], false)
  @Permissions(['calculation:hash_chain:verify'], false)
  @ApiOperation({
    summary: 'Verify hash chain for a calculation',
    description: 'Verifies the integrity of the hash chain for a specific calculation.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The calculation ID' })
  @ApiResponse({ status: 200, description: 'Verification result' })
  @ApiResponse({ status: 404, description: 'Calculation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async verifyCalculationHashChain(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<{ isValid: boolean }> {
    this.logger.log('Verifying hash chain for calculation', {
      id,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const isValid = await this.calculationService.verifyCalculationHashChain(id);
      return { isValid };
    } catch (error) {
      this.logger.error('Failed to verify hash chain', { id, error: error.message });
      throw error;
    }
  }

  // ============================================================================
  // STATISTICS AND METRICS
  // ============================================================================

  @Get('stats')
  @Roles(['calculation:read', 'admin', 'monitoring:read'], false)
  @Permissions(['calculation:stats:read'], false)
  @ApiOperation({
    summary: 'Get calculation statistics',
    description: 'Returns statistics about calculations including counts by status, processing times, and error rates.',
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
    this.logger.log('Fetching calculation statistics', {
      startDate,
      endDate,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.calculationService.getStats();
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch statistics', error);
      throw error;
    }
  }

  // ============================================================================
  // DISTRIBUTION RULE ENDPOINTS
  // ============================================================================

  @Post('distribution-rules')
  @Roles(['calculation:write', 'admin'], false)
  @Permissions(['distribution_rule:create'], false)
  @ApiOperation({
    summary: 'Create a new distribution rule',
    description: 'Creates a new distribution rule for revenue sharing.',
  })
  @ApiBody({ type: DistributionRuleDto })
  @ApiResponse({ status: 201, description: 'Distribution rule created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Conflict - rule already exists' })
  @HttpCode(HttpStatus.CREATED)
  async createDistributionRule(
    @Body() distributionRuleDto: DistributionRuleDto,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Creating distribution rule', {
      name: distributionRuleDto.name,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.calculationService.createDistributionRule(distributionRuleDto);
      
      this.logger.log('Distribution rule created successfully', {
        ruleId: result.id,
        name: result.name,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to create distribution rule', error);
      throw error;
    }
  }

  @Get('distribution-rules/:id')
  @Roles(['calculation:read', 'audit:read', 'admin'], false)
  @Permissions(['distribution_rule:read'], false)
  @ApiOperation({
    summary: 'Get a distribution rule by ID',
    description: 'Retrieves a distribution rule by its ID with full details.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The distribution rule ID' })
  @ApiResponse({ status: 200, description: 'Distribution rule details' })
  @ApiResponse({ status: 404, description: 'Distribution rule not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getDistributionRule(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Fetching distribution rule', {
      id,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.calculationService.getDistributionRule(id);
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch distribution rule', { id, error: error.message });
      throw error;
    }
  }

  @Get('distribution-rules')
  @Roles(['calculation:read', 'audit:read', 'admin'], false)
  @Permissions(['distribution_rule:list'], false)
  @ApiOperation({
    summary: 'List distribution rules with pagination',
    description: 'Returns a paginated list of distribution rules with optional filtering.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 100)' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter by active status' })
  @ApiResponse({ status: 200, description: 'Paginated list of distribution rules' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listDistributionRules(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 100,
    @Query('isActive') isActive?: boolean,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Listing distribution rules', {
      page,
      limit,
      isActive,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.calculationService.listDistributionRules(page, limit, isActive);
      return result;
    } catch (error) {
      this.logger.error('Failed to list distribution rules', error);
      throw error;
    }
  }

  @Patch('distribution-rules/:id')
  @Roles(['calculation:write', 'admin'], false)
  @Permissions(['distribution_rule:update'], false)
  @ApiOperation({
    summary: 'Update a distribution rule',
    description: 'Updates a distribution rule with new data.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The distribution rule ID' })
  @ApiBody({ type: DistributionRuleDto })
  @ApiResponse({ status: 200, description: 'Distribution rule updated successfully' })
  @ApiResponse({ status: 404, description: 'Distribution rule not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateDistributionRule(
    @Param('id') id: string,
    @Body() distributionRuleDto: Partial<DistributionRuleDto>,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Updating distribution rule', {
      id,
      updateData: Object.keys(distributionRuleDto),
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.calculationService.updateDistributionRule(id, distributionRuleDto);
      return result;
    } catch (error) {
      this.logger.error('Failed to update distribution rule', { id, error: error.message });
      throw error;
    }
  }

  @Delete('distribution-rules/:id')
  @Roles(['calculation:write', 'admin'], false)
  @Permissions(['distribution_rule:delete'], false)
  @ApiOperation({
    summary: 'Delete a distribution rule',
    description: 'Deletes a distribution rule.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The distribution rule ID' })
  @ApiResponse({ status: 200, description: 'Distribution rule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Distribution rule not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async deleteDistributionRule(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<void> {
    this.logger.log('Deleting distribution rule', {
      id,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      await this.calculationService.deleteDistributionRule(id);
    } catch (error) {
      this.logger.error('Failed to delete distribution rule', { id, error: error.message });
      throw error;
    }
  }
}
