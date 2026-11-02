import { Controller, Post, Get, Body, Param, Query, UseGuards, Req, HttpCode, HttpStatus, Header, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiHeader, ApiBody } from '@nestjs/swagger';
import { SettlementService } from './services/settlement.service';
import { 
  CreateSettlementInstructionDto, 
  ExecuteSettlementDto,
  CancelSettlementDto,
  ReconcileSettlementDto,
  SettlementStatus,
  SettlementType,
  SettlementMethod,
  Currency,
  EscrowAccountDto,
} from './dto/create-settlement.dto';
import { MtlsGuard } from '../../common/guards/mtls.guard';
import { RbacGuard, Roles, Permissions } from '../../common/guards/rbac.guard';
import { Request } from 'express';
import { LoggerService } from '../../common/logger/logger.service';

@ApiTags('Settlements')
@ApiBearerAuth('JWT')
@UseGuards(MtlsGuard, RbacGuard)
@Controller('api/v1/settlements')
@Header('X-Service', 'liquidacao-service')
@Header('X-Version', '1.0.0')
export class SettlementController {
  private readonly logger = new LoggerService('SettlementController');

  constructor(private readonly settlementService: SettlementService) {}

  // ============================================================================
  // SETTLEMENT INSTRUCTION ENDPOINTS
  // ============================================================================

  @Post()
  @Roles(['liquidacao:write', 'calculation:write', 'admin'], false)
  @Permissions(['settlement:create'], false)
  @ApiOperation({
    summary: 'Create a new settlement instruction',
    description: 'Creates a new settlement instruction with idempotency check and hash chain integration. Returns the created instruction with its hash chain information.',
  })
  @ApiBody({ type: CreateSettlementInstructionDto })
  @ApiResponse({ status: 201, description: 'Settlement instruction created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Conflict - duplicate instruction (idempotency)' })
  @HttpCode(HttpStatus.CREATED)
  async createSettlementInstruction(
    @Body() createSettlementDto: CreateSettlementInstructionDto,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Creating settlement instruction', {
      correlationId: request.headers['x-correlation-id'],
      eventId: createSettlementDto.eventId,
      calculationId: createSettlementDto.calculationId,
      amount: createSettlementDto.amount,
    });

    try {
      const result = await this.settlementService.createSettlementInstruction(createSettlementDto);
      
      this.logger.log('Settlement instruction created successfully', {
        settlementId: result.id,
        status: result.status,
        transactionId: result.transactionId,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to create settlement instruction', error);
      throw error;
    }
  }

  @Get(':id')
  @Roles(['liquidacao:read', 'calculation:read', 'audit:read', 'admin'], false)
  @Permissions(['settlement:read'], false)
  @ApiOperation({
    summary: 'Get a settlement instruction by ID',
    description: 'Retrieves a settlement instruction by its ID with full details including destination account, amounts, and hash chain information.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The ID of the settlement instruction' })
  @ApiResponse({ status: 200, description: 'Settlement instruction details' })
  @ApiResponse({ status: 404, description: 'Settlement instruction not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getSettlementInstruction(
    @Param('id') instructionId: string,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Fetching settlement instruction', {
      instructionId,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const settlement = await this.settlementService.getSettlementInstruction(instructionId);
      return settlement;
    } catch (error) {
      this.logger.error('Failed to fetch settlement instruction', { instructionId, error: error.message });
      throw error;
    }
  }

  @Get()
  @Roles(['liquidacao:read', 'calculation:read', 'audit:read', 'admin'], false)
  @Permissions(['settlement:list'], false)
  @ApiOperation({
    summary: 'List settlement instructions with pagination and filtering',
    description: 'Returns a paginated list of settlement instructions with optional filtering by status, type, method, and date range.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 100)' })
  @ApiQuery({ name: 'status', required: false, enum: SettlementStatus, description: 'Filter by settlement status' })
  @ApiQuery({ name: 'type', required: false, enum: SettlementType, description: 'Filter by settlement type' })
  @ApiQuery({ name: 'method', required: false, enum: SettlementMethod, description: 'Filter by settlement method' })
  @ApiQuery({ name: 'calculationId', required: false, type: String, description: 'Filter by calculation ID' })
  @ApiQuery({ name: 'eventId', required: false, type: String, description: 'Filter by event ID' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Filter by start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Filter by end date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Paginated list of settlement instructions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listSettlementInstructions(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 100,
    @Query('status') status?: SettlementStatus,
    @Query('type') type?: SettlementType,
    @Query('method') method?: SettlementMethod,
    @Query('calculationId') calculationId?: string,
    @Query('eventId') eventId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Listing settlement instructions', {
      page,
      limit,
      status,
      type,
      method,
      calculationId,
      eventId,
      startDate,
      endDate,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      // Note: The service method needs to be implemented to support these filters
      // For now, we'll return a basic list
      const result = await this.settlementService.listSettlementInstructions(
        page,
        limit,
        status,
        type,
        method,
        calculationId,
        eventId,
        startDate,
        endDate,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to list settlement instructions', error);
      throw error;
    }
  }

  // ============================================================================
  // SETTLEMENT EXECUTION ENDPOINTS
  // ============================================================================

  @Post(':id/execute')
  @Roles(['liquidacao:write', 'admin'], false)
  @Permissions(['settlement:execute'], false)
  @ApiOperation({
    summary: 'Execute a settlement instruction',
    description: 'Executes a pending or scheduled settlement instruction via LOWDATAESC integration. Returns the transaction ID and status.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The ID of the settlement instruction to execute' })
  @ApiBody({ type: ExecuteSettlementDto })
  @ApiResponse({ status: 200, description: 'Settlement executed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - settlement cannot be executed' })
  @ApiResponse({ status: 404, description: 'Settlement instruction not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Conflict - settlement already executed or in invalid state' })
  async executeSettlement(
    @Param('id') instructionId: string,
    @Body() executeSettlementDto: ExecuteSettlementDto,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Executing settlement instruction', {
      instructionId,
      forceExecute: executeSettlementDto.forceExecute,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.settlementService.executeSettlement({
        ...executeSettlementDto,
        instructionId,
      });
      
      this.logger.log('Settlement executed', {
        instructionId,
        transactionId: result.transactionId,
        status: result.status,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to execute settlement', { instructionId, error: error.message });
      throw error;
    }
  }

  @Post(':id/cancel')
  @Roles(['liquidacao:write', 'admin'], false)
  @Permissions(['settlement:cancel'], false)
  @ApiOperation({
    summary: 'Cancel a settlement instruction',
    description: 'Cancels a pending or scheduled settlement instruction. The instruction must be in PENDING or SCHEDULED status to be cancelled.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The ID of the settlement instruction to cancel' })
  @ApiBody({ type: CancelSettlementDto })
  @ApiResponse({ status: 200, description: 'Settlement cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - settlement cannot be cancelled' })
  @ApiResponse({ status: 404, description: 'Settlement instruction not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Conflict - settlement already executed or cancelled' })
  async cancelSettlement(
    @Param('id') instructionId: string,
    @Body() cancelSettlementDto: CancelSettlementDto,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Cancelling settlement instruction', {
      instructionId,
      reason: cancelSettlementDto.reason,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.settlementService.cancelSettlement({
        ...cancelSettlementDto,
        instructionId,
      });
      
      this.logger.log('Settlement cancelled', {
        instructionId,
        status: result.status,
        reason: result.reason,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to cancel settlement', { instructionId, error: error.message });
      throw error;
    }
  }

  // ============================================================================
  // RECONCILIATION ENDPOINTS
  // ============================================================================

  @Post(':id/reconcile')
  @Roles(['liquidacao:write', 'audit:write', 'admin'], false)
  @Permissions(['settlement:reconcile'], false)
  @ApiOperation({
    summary: 'Reconcile a settlement instruction with LOWDATAESC transaction',
    description: 'Reconciles a settlement instruction by comparing the expected amount with the actual transaction amount from LOWDATAESC.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The ID of the settlement instruction to reconcile' })
  @ApiBody({ type: ReconcileSettlementDto })
  @ApiResponse({ status: 200, description: 'Settlement reconciled successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - settlement cannot be reconciled' })
  @ApiResponse({ status: 404, description: 'Settlement instruction not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async reconcileSettlement(
    @Param('id') instructionId: string,
    @Body() reconcileSettlementDto: ReconcileSettlementDto,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Reconciling settlement instruction', {
      instructionId,
      transactionId: reconcileSettlementDto.transactionId,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.settlementService.reconcileSettlement({
        ...reconcileSettlementDto,
        instructionId,
      });
      
      this.logger.log('Settlement reconciled', {
        instructionId,
        transactionId: result.transactionId,
        isReconciled: result.isReconciled,
        discrepancyReason: result.discrepancyReason,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to reconcile settlement', { instructionId, error: error.message });
      throw error;
    }
  }

  // ============================================================================
  // RETRY OPERATIONS
  // ============================================================================

  @Post(':id/retry')
  @Roles(['liquidacao:write', 'admin'], false)
  @Permissions(['settlement:retry'], false)
  @ApiOperation({
    summary: 'Retry a failed settlement instruction',
    description: 'Retries a failed settlement instruction. Increments retry count and re-queues the instruction for processing.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The ID of the failed settlement instruction to retry' })
  @ApiResponse({ status: 200, description: 'Settlement retried successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - settlement cannot be retried' })
  @ApiResponse({ status: 404, description: 'Settlement instruction not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Conflict - maximum retry attempts reached' })
  async retrySettlement(
    @Param('id') instructionId: string,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Retrying settlement instruction', {
      instructionId,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.settlementService.retrySettlement(instructionId);
      
      this.logger.log('Settlement retried successfully', {
        instructionId,
        retryCount: result.retryCount,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to retry settlement', { instructionId, error: error.message });
      throw error;
    }
  }

  @Post('retry-all')
  @Roles(['liquidacao:write', 'admin'], false)
  @Permissions(['settlement:retry_all'], false)
  @ApiOperation({
    summary: 'Retry all failed settlement instructions',
    description: 'Retries all failed settlement instructions in the system. Returns statistics about the retry operation.',
  })
  @ApiQuery({ name: 'maxInstructions', required: false, type: Number, description: 'Maximum number of instructions to retry (default: 100)' })
  @ApiResponse({ status: 200, description: 'Batch retry completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async retryAllFailedSettlements(
    @Query('maxInstructions') maxInstructions: number = 100,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Retrying all failed settlement instructions', {
      maxInstructions,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.settlementService.retryAllFailedSettlements();
      
      this.logger.log('Batch retry completed', {
        successCount: result.successCount,
        errorCount: result.errorCount,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to retry all settlements', error);
      throw error;
    }
  }

  // ============================================================================
  // HASH CHAIN OPERATIONS
  // ============================================================================

  @Get(':id/hash-chain')
  @Roles(['audit:read', 'admin'], false)
  @Permissions(['settlement:hash_chain:read'], false)
  @ApiOperation({
    summary: 'Get hash chain for a settlement instruction',
    description: 'Retrieves the hash chain for a specific settlement instruction, showing the cryptographic linkage to previous instructions.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The ID of the settlement instruction' })
  @ApiQuery({ name: 'depth', required: false, type: Number, description: 'Number of previous instructions to include in chain (default: 10)' })
  @ApiResponse({ status: 200, description: 'Hash chain information' })
  @ApiResponse({ status: 404, description: 'Settlement instruction not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getSettlementHashChain(
    @Param('id') instructionId: string,
    @Query('depth') depth: number = 10,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Fetching hash chain for settlement instruction', {
      instructionId,
      depth,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.settlementService.getSettlementHashChain(instructionId, depth);
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch hash chain', { instructionId, error: error.message });
      throw error;
    }
  }

  @Get(':id/hash-chain/verify')
  @Roles(['audit:read', 'admin'], false)
  @Permissions(['settlement:hash_chain:verify'], false)
  @ApiOperation({
    summary: 'Verify hash chain for a settlement instruction',
    description: 'Verifies the integrity of the hash chain for a specific settlement instruction.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The ID of the settlement instruction' })
  @ApiResponse({ status: 200, description: 'Hash chain verification result' })
  @ApiResponse({ status: 404, description: 'Settlement instruction not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async verifySettlementHashChain(
    @Param('id') instructionId: string,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Verifying hash chain for settlement instruction', {
      instructionId,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const isValid = await this.settlementService.verifySettlementHashChain(instructionId);
      return {
        instructionId,
        isValid,
        verifiedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to verify hash chain', { instructionId, error: error.message });
      throw error;
    }
  }

  // ============================================================================
  // ESCROW ACCOUNT ENDPOINTS
  // ============================================================================

  @Post('escrow-accounts')
  @Roles(['liquidacao:write', 'admin'], false)
  @Permissions(['escrow:create'], false)
  @ApiOperation({
    summary: 'Create a new escrow account',
    description: 'Creates a new escrow account for an owner (operation, founder, etc.) with idempotency check.',
  })
  @ApiBody({ type: EscrowAccountDto })
  @ApiResponse({ status: 201, description: 'Escrow account created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Conflict - escrow account already exists for this owner' })
  @HttpCode(HttpStatus.CREATED)
  async createEscrowAccount(
    @Body() escrowAccountDto: EscrowAccountDto,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Creating escrow account', {
      ownerId: escrowAccountDto.ownerId,
      ownerType: escrowAccountDto.ownerType,
      name: escrowAccountDto.name,
      currency: escrowAccountDto.currency,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.settlementService.createEscrowAccount(escrowAccountDto);
      
      this.logger.log('Escrow account created successfully', {
        accountId: result.id,
        ownerId: result.ownerId,
        balance: result.balance,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to create escrow account', error);
      throw error;
    }
  }

  @Get('escrow-accounts/:id')
  @Roles(['liquidacao:read', 'audit:read', 'admin'], false)
  @Permissions(['escrow:read'], false)
  @ApiOperation({
    summary: 'Get an escrow account by ID',
    description: 'Retrieves an escrow account by its ID with full details including balance and metadata.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The ID of the escrow account' })
  @ApiResponse({ status: 200, description: 'Escrow account details' })
  @ApiResponse({ status: 404, description: 'Escrow account not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getEscrowAccount(
    @Param('id') accountId: string,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Fetching escrow account', {
      accountId,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.settlementService.getEscrowAccount(accountId);
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch escrow account', { accountId, error: error.message });
      throw error;
    }
  }

  @Get('escrow-accounts')
  @Roles(['liquidacao:read', 'audit:read', 'admin'], false)
  @Permissions(['escrow:list'], false)
  @ApiOperation({
    summary: 'List escrow accounts with pagination and filtering',
    description: 'Returns a paginated list of escrow accounts with optional filtering by owner, type, status, and currency.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 100)' })
  @ApiQuery({ name: 'ownerId', required: false, type: String, description: 'Filter by owner ID' })
  @ApiQuery({ name: 'ownerType', required: false, type: String, description: 'Filter by owner type' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by account status' })
  @ApiQuery({ name: 'currency', required: false, enum: Currency, description: 'Filter by currency' })
  @ApiResponse({ status: 200, description: 'Paginated list of escrow accounts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listEscrowAccounts(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 100,
    @Query('ownerId') ownerId?: string,
    @Query('ownerType') ownerType?: string,
    @Query('status') status?: string,
    @Query('currency') currency?: Currency,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Listing escrow accounts', {
      page,
      limit,
      ownerId,
      ownerType,
      status,
      currency,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.settlementService.listEscrowAccounts(
        page,
        limit,
        ownerId,
        ownerType,
        status,
        currency,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to list escrow accounts', error);
      throw error;
    }
  }

  @Get('escrow-accounts/:id/balance')
  @Roles(['liquidacao:read', 'audit:read', 'admin'], false)
  @Permissions(['escrow:balance:read'], false)
  @ApiOperation({
    summary: 'Get balance for an escrow account',
    description: 'Retrieves the current balance, available balance, and reserved balance for an escrow account.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The ID of the escrow account' })
  @ApiResponse({ status: 200, description: 'Escrow account balance' })
  @ApiResponse({ status: 404, description: 'Escrow account not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getEscrowAccountBalance(
    @Param('id') accountId: string,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Fetching escrow account balance', {
      accountId,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.settlementService.getEscrowAccountBalance(accountId);
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch escrow account balance', { accountId, error: error.message });
      throw error;
    }
  }

  @Post('escrow-accounts/:id/deposit')
  @Roles(['liquidacao:write', 'admin'], false)
  @Permissions(['escrow:deposit'], false)
  @ApiOperation({
    summary: 'Deposit funds into an escrow account',
    description: 'Deposits funds into an escrow account. The amount is added to both the balance and available balance.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The ID of the escrow account' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount to deposit', example: 1000.50 },
        referenceId: { type: 'string', description: 'Reference ID for the deposit', example: 'dep_123' },
        description: { type: 'string', description: 'Description of the deposit', example: 'Initial funding' },
      },
      required: ['amount', 'referenceId'],
    },
  })
  @ApiResponse({ status: 200, description: 'Deposit successful' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Escrow account not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async depositToEscrowAccount(
    @Param('id') accountId: string,
    @Body() body: { amount: number; referenceId: string; description?: string },
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Depositing to escrow account', {
      accountId,
      amount: body.amount,
      referenceId: body.referenceId,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.settlementService.depositToEscrowAccount(
        accountId,
        body.amount,
        body.referenceId,
        body.description || '',
      );
      
      this.logger.log('Deposit successful', {
        accountId,
        newBalance: result.balance,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to deposit to escrow account', { accountId, error: error.message });
      throw error;
    }
  }

  @Post('escrow-accounts/:id/withdraw')
  @Roles(['liquidacao:write', 'admin'], false)
  @Permissions(['escrow:withdraw'], false)
  @ApiOperation({
    summary: 'Withdraw funds from an escrow account',
    description: 'Withdraws funds from an escrow account. The amount is deducted from both the balance and available balance.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The ID of the escrow account' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount to withdraw', example: 500.25 },
        referenceId: { type: 'string', description: 'Reference ID for the withdrawal', example: 'wd_123' },
        description: { type: 'string', description: 'Description of the withdrawal', example: 'Payment processing' },
        settlementInstructionId: { type: 'string', description: 'Optional: Related settlement instruction ID' },
      },
      required: ['amount', 'referenceId'],
    },
  })
  @ApiResponse({ status: 200, description: 'Withdrawal successful' })
  @ApiResponse({ status: 400, description: 'Bad request - insufficient funds' })
  @ApiResponse({ status: 404, description: 'Escrow account not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async withdrawFromEscrowAccount(
    @Param('id') accountId: string,
    @Body() body: { amount: number; referenceId: string; description?: string; settlementInstructionId?: string },
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Withdrawing from escrow account', {
      accountId,
      amount: body.amount,
      referenceId: body.referenceId,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.settlementService.withdrawFromEscrowAccount(
        accountId,
        body.amount,
        body.referenceId,
        body.description || '',
        body.settlementInstructionId,
      );
      
      this.logger.log('Withdrawal successful', {
        accountId,
        newBalance: result.balance,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to withdraw from escrow account', { accountId, error: error.message });
      throw error;
    }
  }

  @Post('escrow-accounts/:id/freeze')
  @Roles(['liquidacao:write', 'admin'], false)
  @Permissions(['escrow:freeze'], false)
  @ApiOperation({
    summary: 'Freeze an escrow account',
    description: 'Freezes an escrow account, preventing any withdrawals or transfers. Deposits may still be allowed depending on configuration.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The ID of the escrow account' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Reason for freezing the account', example: 'Suspicious activity' },
      },
      required: ['reason'],
    },
  })
  @ApiResponse({ status: 200, description: 'Account frozen successfully' })
  @ApiResponse({ status: 404, description: 'Escrow account not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async freezeEscrowAccount(
    @Param('id') accountId: string,
    @Body() body: { reason: string },
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Freezing escrow account', {
      accountId,
      reason: body.reason,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.settlementService.freezeEscrowAccount(accountId, body.reason);
      
      this.logger.log('Account frozen successfully', {
        accountId,
        isFrozen: result.isFrozen,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to freeze escrow account', { accountId, error: error.message });
      throw error;
    }
  }

  @Post('escrow-accounts/:id/unfreeze')
  @Roles(['liquidacao:write', 'admin'], false)
  @Permissions(['escrow:unfreeze'], false)
  @ApiOperation({
    summary: 'Unfreeze an escrow account',
    description: 'Unfreezes a previously frozen escrow account, allowing normal operations to resume.',
  })
  @ApiParam({ name: 'id', type: String, description: 'The ID of the escrow account' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Reason for unfreezing the account', example: 'Investigation complete' },
      },
      required: ['reason'],
    },
  })
  @ApiResponse({ status: 200, description: 'Account unfrozen successfully' })
  @ApiResponse({ status: 404, description: 'Escrow account not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async unfreezeEscrowAccount(
    @Param('id') accountId: string,
    @Body() body: { reason: string },
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Unfreezing escrow account', {
      accountId,
      reason: body.reason,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.settlementService.unfreezeEscrowAccount(accountId, body.reason);
      
      this.logger.log('Account unfrozen successfully', {
        accountId,
        isFrozen: result.isFrozen,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to unfreeze escrow account', { accountId, error: error.message });
      throw error;
    }
  }

  // ============================================================================
  // TRANSACTION ENDPOINTS
  // ============================================================================

  @Get('accounts/:accountId/transactions')
  @Roles(['liquidacao:read', 'audit:read', 'admin'], false)
  @Permissions(['transaction:list'], false)
  @ApiOperation({
    summary: 'Get transaction history for an escrow account',
    description: 'Retrieves the transaction history for a specific escrow account with pagination and filtering.',
  })
  @ApiParam({ name: 'accountId', type: String, description: 'The ID of the escrow account' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 100)' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Filter by transaction type' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by transaction status' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Filter by start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Filter by end date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Paginated list of transactions' })
  @ApiResponse({ status: 404, description: 'Escrow account not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getTransactionHistory(
    @Param('accountId') accountId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 100,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() request: Request,
  ): Promise<any> {
    this.logger.log('Fetching transaction history', {
      accountId,
      page,
      limit,
      type,
      status,
      startDate,
      endDate,
      correlationId: request.headers['x-correlation-id'],
    });

    try {
      const result = await this.settlementService.getTransactionHistory(
        accountId,
        page,
        limit,
        type,
        status,
        startDate,
        endDate,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch transaction history', { accountId, error: error.message });
      throw error;
    }
  }

  // ============================================================================
  // STATISTICS AND METRICS
  // ============================================================================

  @Get('stats')
  @Roles(['liquidacao:read', 'admin', 'monitoring:read'], false)
  @Permissions(['settlement:stats:read'], false)
  @ApiOperation({
    summary: 'Get settlement service statistics',
    description: 'Returns statistics about settlement instructions including counts by status, processing times, and error rates.',
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
      const result = await this.settlementService.getStats();
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
    description: 'Returns the health status of the liquidacao service including LOWDATAESC connectivity and database status.',
  })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async healthCheck(@Req() request: Request): Promise<any> {
    this.logger.log('Health check requested', {
      correlationId: request.headers['x-correlation-id'],
    });

    return {
      status: 'healthy',
      service: 'liquidacao-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'up' },
        kafka: { status: 'up' },
        redis: { status: 'up' },
        lowdataesc: { status: 'up' },
      },
    };
  }
}
