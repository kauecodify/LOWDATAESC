import { Controller, Post, Body, Get, Put, Delete, Param, Query, Headers, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { SplitService } from './services/split.service';
import { CreateSplitTransactionDto, SplitTransactionResponseDto, QuerySplitTransactionDto, WebhookCallbackDto, GenerateSPEDDto, FallbackToEscrowDto } from './dto/create-split-transaction.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiHeader } from '@nestjs/swagger';
import { MtlsGuard } from '../../common/guards/mtls.guard';
import { RbacGuard, Permissions } from '../../common/guards/rbac.guard';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../common/logger/logger.service';

@ApiTags('split')
@ApiBearerAuth()
@Controller('api/v1/split')
@UseGuards(MtlsGuard)
@UseGuards(RbacGuard)
export class SplitController {
  private readonly logger = new LoggerService();

  constructor(
    private readonly splitService: SplitService,
    private configService: ConfigService,
  ) {}

  @Post('transactions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create split transaction',
    description: 'Create a new split payment transaction with CBS/IBS tax calculation',
  })
  @ApiResponse({ status: 201, description: 'Split transaction created', type: SplitTransactionResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Duplicate transaction' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key for idempotency',
    required: false,
  })
  @ApiHeader({
    name: 'X-Consortium-Id',
    description: 'Consortium/tenant ID',
    required: true,
  })
  @Permissions('split:create')
  async createTransaction(
    @Body() dto: CreateSplitTransactionDto,
    @Headers('Idempotency-Key') idempotencyKey?: string,
    @Headers('X-Consortium-Id') consortiumId?: string,
    @Headers('X-Request-Id') requestId?: string,
    @Headers('X-Forwarded-For') ipAddress?: string,
    @Headers('User-Agent') userAgent?: string,
  ): Promise<SplitTransactionResponseDto> {
    try {
      // Override consortium ID from header if not in DTO
      if (consortiumId && !dto.consortiumId) {
        dto.consortiumId = consortiumId;
      }

      // Override idempotency key if provided in header
      if (idempotencyKey && !dto.idempotencyKey) {
        dto.idempotencyKey = idempotencyKey;
      }

      const result = await this.splitService.createSplitTransaction(
        dto,
        requestId,
        ipAddress?.split(',')[0],
        userAgent
      );

      this.logger.log('Split transaction created via API', {
        transactionId: result.id,
        consortiumId: result.consortiumId,
        paymentId: result.paymentId,
        amount: dto.originalAmount,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to create split transaction via API', {
        dto: JSON.stringify(dto),
        error: error.message,
      });
      throw error;
    }
  }

  @Get('transactions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get split transaction by ID',
    description: 'Get details of a split payment transaction',
  })
  @ApiResponse({ status: 200, description: 'Split transaction details', type: SplitTransactionResponseDto })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiParam({ name: 'id', description: 'Transaction ID', type: 'string', format: 'uuid' })
  @Permissions('split:read')
  async getTransactionById(
    @Param('id') id: string,
    @Headers('X-Consortium-Id') consortiumId?: string,
  ): Promise<SplitTransactionResponseDto | null> {
    try {
      const result = await this.splitService.findById(id, consortiumId);
      
      if (!result) {
        this.logger.warn('Split transaction not found', { id, consortiumId });
        return null;
      }

      this.logger.debug('Split transaction retrieved', { id, consortiumId });
      return result;
    } catch (error) {
      this.logger.error('Failed to get split transaction by ID', {
        id,
        consortiumId,
        error: error.message,
      });
      throw error;
    }
  }

  @Get('transactions/payment/:paymentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get split transaction by payment ID',
    description: 'Get split transaction details by original payment ID',
  })
  @ApiResponse({ status: 200, description: 'Split transaction details', type: SplitTransactionResponseDto })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiParam({ name: 'paymentId', description: 'Payment ID', type: 'string', format: 'uuid' })
  @Permissions('split:read')
  async getTransactionByPaymentId(
    @Param('paymentId') paymentId: string,
    @Headers('X-Consortium-Id') consortiumId?: string,
  ): Promise<SplitTransactionResponseDto | null> {
    try {
      const result = await this.splitService.findByPaymentId(paymentId, consortiumId);
      
      if (!result) {
        this.logger.warn('Split transaction not found for payment ID', { paymentId, consortiumId });
        return null;
      }

      this.logger.debug('Split transaction retrieved by payment ID', { paymentId, consortiumId });
      return result;
    } catch (error) {
      this.logger.error('Failed to get split transaction by payment ID', {
        paymentId,
        consortiumId,
        error: error.message,
      });
      throw error;
    }
  }

  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List split transactions',
    description: 'List split payment transactions with optional filters',
  })
  @ApiResponse({ status: 200, description: 'List of split transactions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'consortiumId', description: 'Filter by consortium ID', required: false })
  @ApiQuery({ name: 'paymentId', description: 'Filter by payment ID', required: false })
  @ApiQuery({ name: 'status', description: 'Filter by status', required: false })
  @ApiQuery({ name: 'method', description: 'Filter by payment method', required: false })
  @ApiQuery({ name: 'startDate', description: 'Filter by start date', required: false })
  @ApiQuery({ name: 'endDate', description: 'Filter by end date', required: false })
  @ApiQuery({ name: 'page', description: 'Page number', required: false })
  @ApiQuery({ name: 'pageSize', description: 'Page size', required: false })
  @Permissions('split:list')
  async listTransactions(
    @Query() query: QuerySplitTransactionDto,
    @Headers('X-Consortium-Id') consortiumId?: string,
  ): Promise<{ transactions: SplitTransactionResponseDto[]; total: number; page: number; pageSize: number }> {
    try {
      // Override consortium ID from header if not in query
      if (consortiumId && !query.consortiumId) {
        query.consortiumId = consortiumId;
      }

      const result = await this.splitService.findAll(query);
      
      this.logger.debug('Split transactions listed', {
        query: JSON.stringify(query),
        count: result.transactions.length,
        total: result.total,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to list split transactions', {
        query: JSON.stringify(query),
        error: error.message,
      });
      throw error;
    }
  }

  @Put('transactions/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update transaction status',
    description: 'Update the status of a split payment transaction',
  })
  @ApiResponse({ status: 200, description: 'Transaction status updated', type: SplitTransactionResponseDto })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiParam({ name: 'id', description: 'Transaction ID', type: 'string', format: 'uuid' })
  @Permissions('split:update')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; errorInfo?: any },
    @Headers('X-Consortium-Id') consortiumId?: string,
  ): Promise<SplitTransactionResponseDto | null> {
    try {
      const result = await this.splitService.updateStatus(
        id,
        body.status as any,
        consortiumId,
        body.errorInfo
      );

      if (!result) {
        this.logger.warn('Split transaction not found for status update', { id, consortiumId });
        return null;
      }

      this.logger.log('Split transaction status updated', {
        id,
        consortiumId,
        oldStatus: result.status,
        newStatus: body.status,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to update split transaction status', {
        id,
        consortiumId,
        error: error.message,
      });
      throw error;
    }
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process webhook callback',
    description: 'Process webhook callback from payment gateway',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 400, description: 'Invalid webhook' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Permissions('webhook:process')
  async processWebhook(
    @Body() webhookDto: WebhookCallbackDto,
    @Headers('X-Signature') signature?: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      // Verify webhook signature if configured
      const webhookConfig = this.configService.get('webhook');
      if (webhookConfig?.internal?.secretToken) {
        const expectedSignature = this.generateWebhookSignature(
          JSON.stringify(webhookDto),
          webhookConfig.internal.secretToken
        );
        
        if (signature !== expectedSignature) {
          this.logger.error('Invalid webhook signature', {
            expected: expectedSignature,
            received: signature,
          });
          throw new Error('Invalid webhook signature');
        }
      }

      await this.splitService.processWebhook(webhookDto);

      this.logger.log('Webhook processed', {
        eventType: webhookDto.eventType,
        transactionId: webhookDto.transactionId,
        gateway: webhookDto.gateway,
      });

      return { success: true, message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error('Failed to process webhook', {
        webhook: JSON.stringify(webhookDto),
        error: error.message,
      });
      throw error;
    }
  }

  private generateWebhookSignature(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  @Post('sped/generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate SPED file',
    description: 'Generate SPED Contribuições file for transactions',
  })
  @ApiResponse({ status: 200, description: 'SPED file generation initiated' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Permissions('sped:generate')
  async generateSPED(
    @Body() generateDto: GenerateSPEDDto,
    @Headers('X-Consortium-Id') consortiumId?: string,
  ): Promise<{ fileId: string; fileUrl?: string; status: string }> {
    try {
      // Override consortium ID from header if not in DTO
      if (consortiumId && !generateDto.consortiumId) {
        generateDto.consortiumId = consortiumId;
      }

      const result = await this.splitService.generateSPED(generateDto);

      this.logger.log('SPED file generation initiated', {
        fileId: result.fileId,
        consortiumId: generateDto.consortiumId,
        status: result.status,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to generate SPED file', {
        generateDto: JSON.stringify(generateDto),
        error: error.message,
      });
      throw error;
    }
  }

  @Post('fallback/escrow')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manual fallback to escrow',
    description: 'Manually trigger fallback to escrow for a transaction',
  })
  @ApiResponse({ status: 200, description: 'Fallback to escrow initiated' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Permissions('escrow:fallback')
  async fallbackToEscrow(
    @Body() fallbackDto: FallbackToEscrowDto,
    @Headers('X-Consortium-Id') consortiumId?: string,
  ): Promise<SplitTransactionResponseDto | null> {
    try {
      const result = await this.splitService.fallbackToEscrow(fallbackDto);

      if (!result) {
        this.logger.warn('Transaction not found for escrow fallback', {
          transactionId: fallbackDto.transactionId,
          consortiumId,
        });
        return null;
      }

      this.logger.log('Manual fallback to escrow initiated', {
        transactionId: fallbackDto.transactionId,
        consortiumId,
        reason: fallbackDto.reason,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to fallback to escrow', {
        fallbackDto: JSON.stringify(fallbackDto),
        error: error.message,
      });
      throw error;
    }
  }

  @Get('tax-rates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get current tax rates',
    description: 'Get current CBS and IBS tax rates',
  })
  @ApiResponse({ status: 200, description: 'Current tax rates' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Permissions('tax:read')
  async getTaxRates(
    @Headers('X-Consortium-Id') consortiumId?: string,
  ): Promise<{ cbs: number; ibs: number }> {
    try {
      const rates = await this.splitService.getTaxRates(consortiumId || '');
      
      this.logger.debug('Tax rates retrieved', {
        consortiumId,
        rates,
      });

      return rates;
    } catch (error) {
      this.logger.error('Failed to get tax rates', {
        consortiumId,
        error: error.message,
      });
      throw error;
    }
  }

  @Post('tax-rates/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh tax rates',
    description: 'Refresh tax rates from BACEN',
  })
  @ApiResponse({ status: 200, description: 'Tax rates refreshed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Permissions('tax:refresh')
  async refreshTaxRates(): Promise<{ success: boolean; message?: string }> {
    try {
      await this.splitService.refreshTaxRates();

      this.logger.log('Tax rates refresh initiated');

      return { success: true, message: 'Tax rates refresh initiated' };
    } catch (error) {
      this.logger.error('Failed to refresh tax rates', {
        error: error.message,
      });
      throw error;
    }
  }
}
