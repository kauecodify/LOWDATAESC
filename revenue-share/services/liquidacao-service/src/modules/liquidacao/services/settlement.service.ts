import { Injectable, OnModuleInit, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettlementRepository } from '../settlement.repository';
import { 
  CreateSettlementInstructionDto, 
  SettlementInstructionResponseDto,
  ExecuteSettlementDto,
  ExecuteSettlementResponseDto,
  CancelSettlementDto,
  CancelSettlementResponseDto,
  ReconcileSettlementDto,
  ReconcileSettlementResponseDto,
  SettlementStatus,
  SettlementType,
  SettlementMethod,
  Currency,
  EscrowAccountDto,
  EscrowAccountResponseDto,
  TransactionDto,
} from '../dto/create-settlement.dto';
import { KafkaService, KafkaMessage } from '../../../common/kafka/kafka.service';
import { IdempotencyService } from '../../../common/idempotency/idempotency.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { GrpcService } from '../../../common/grpc/grpc.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SettlementService implements OnModuleInit {
  private readonly logger = new LoggerService('SettlementService');
  private readonly kafkaTopic: string;
  private readonly serviceName: string;
  private readonly settlementConfig: any;
  private readonly lowdataescConfig: any;

  constructor(
    private readonly settlementRepository: SettlementRepository,
    private readonly kafkaService: KafkaService,
    private readonly idempotencyService: IdempotencyService,
    private readonly grpcService: GrpcService,
    private readonly configService: ConfigService,
  ) {
    const kafkaConfig = this.configService.get('kafka');
    const serviceConfig = this.configService.get('service');
    const settlementConfig = this.configService.get('settlement');
    const lowdataescConfig = this.configService.get('lowdataesc');
    
    this.kafkaTopic = kafkaConfig.topic?.settlementResults || 'settlement-results';
    this.serviceName = serviceConfig.name || 'liquidacao-service';
    this.settlementConfig = settlementConfig;
    this.lowdataescConfig = lowdataescConfig;
  }

  async onModuleInit() {
    // Start Kafka consumer for processing settlement requests
    this.startKafkaConsumer().catch((error) => {
      this.logger.error('Failed to start Kafka consumer', error);
    });
  }

  // ============================================================================
  // MAIN SETTLEMENT METHODS
  // ============================================================================

  async createSettlementInstruction(
    createSettlementDto: CreateSettlementInstructionDto,
  ): Promise<SettlementInstructionResponseDto> {
    const idempotencyKey = createSettlementDto.idempotencyKey || this.generateIdempotencyKey();
    const operation = `create_settlement_${createSettlementDto.eventId}`;

    // Check for idempotency
    const { exists, response: cachedResponse } = await this.idempotencyService.checkKey(
      idempotencyKey,
      operation,
    );

    if (exists) {
      this.logger.log('Idempotency: Returning cached settlement response', {
        idempotencyKey,
        operation,
      });
      return cachedResponse;
    }

    // Get previous hash for chain
    const previousHash = await this.settlementRepository.getLastSettlementHash();

    // Create settlement instruction
    const settlement = await this.settlementRepository.create({
      id: createSettlementDto.id || uuidv4(),
      calculationId: createSettlementDto.calculationId,
      eventId: createSettlementDto.eventId,
      type: createSettlementDto.type || SettlementType.REVENUE_SHARE,
      sourceAccountId: createSettlementDto.sourceAccountId,
      destinationAccount: createSettlementDto.destinationAccount,
      amount: parseFloat(createSettlementDto.amount.amount),
      currency: createSettlementDto.amount.currency,
      method: createSettlementDto.method || SettlementMethod.PIX,
      status: SettlementStatus.PENDING,
      referenceId: createSettlementDto.referenceId,
      description: createSettlementDto.description,
      scheduledDate: createSettlementDto.scheduledDate ? new Date(createSettlementDto.scheduledDate) : null,
      expiryDate: createSettlementDto.expiryDate ? new Date(createSettlementDto.expiryDate) : null,
      priority: createSettlementDto.priority || 0,
      callbackUrl: createSettlementDto.callbackUrl,
      previousHash,
      correlationId: createSettlementDto.metadata?.correlationId,
      source: createSettlementDto.metadata?.source || 'api',
      metadata: createSettlementDto.metadata,
    });

    // Store response for idempotency
    await this.idempotencyService.setKey(idempotencyKey, operation, this.toSettlementResponseDto(settlement));

    // Publish to Kafka for processing
    await this.publishToKafka(settlement);

    this.logger.log('Settlement instruction created', {
      settlementId: settlement.id,
      eventId: settlement.eventId,
      amount: settlement.amount,
      currency: settlement.currency,
      method: settlement.method,
      status: settlement.status,
    });

    return this.toSettlementResponseDto(settlement);
  }

  async executeSettlement(
    executeSettlementDto: ExecuteSettlementDto,
  ): Promise<ExecuteSettlementResponseDto> {
    const idempotencyKey = executeSettlementDto.idempotencyKey || this.generateIdempotencyKey();
    const operation = `execute_settlement_${executeSettlementDto.instructionId}`;

    // Check for idempotency
    const { exists, response: cachedResponse } = await this.idempotencyService.checkKey(
      idempotencyKey,
      operation,
    );

    if (exists) {
      this.logger.log('Idempotency: Returning cached execute settlement response', {
        idempotencyKey,
        operation,
      });
      return cachedResponse;
    }

    // Get settlement instruction
    const settlement = await this.settlementRepository.findById(executeSettlementDto.instructionId);
    
    if (!settlement) {
      throw new ConflictException(`Settlement instruction not found: ${executeSettlementDto.instructionId}`);
    }

    if (settlement.status !== SettlementStatus.PENDING && 
        settlement.status !== SettlementStatus.SCHEDULED &&
        !executeSettlementDto.forceExecute) {
      throw new ConflictException(`Settlement is not in PENDING or SCHEDULED status (current: ${settlement.status})`);
    }

    if (!settlement.scheduledDate || executeSettlementDto.forceExecute || new Date() >= settlement.scheduledDate) {
      try {
        // Call LOWDATAESC gRPC service to execute settlement
        const grpcResult = await this.executeSettlementWithLowdataesc(settlement, executeSettlementDto);
        
        // Update settlement with transaction ID
        settlement.markAsExecuted(grpcResult.transactionId);
        settlement.settlementHash = settlement.calculateHash(settlement.previousHash);

        const updatedSettlement = await this.settlementRepository.update(settlement.id, settlement);

        // Store response for idempotency
        await this.idempotencyService.setKey(idempotencyKey, operation, {
          instructionId: updatedSettlement.id,
          transactionId: grpcResult.transactionId,
          status: SettlementStatus.EXECUTED,
          executedAt: updatedSettlement.executedAt.toISOString(),
          errorMessage: grpcResult.errorMessage,
          idempotencyKey,
        });

        // Publish to Kafka
        await this.publishToKafka(updatedSettlement);

        this.logger.log('Settlement executed successfully', {
          settlementId: updatedSettlement.id,
          transactionId: grpcResult.transactionId,
          amount: updatedSettlement.amount,
          currency: updatedSettlement.currency,
        });

        return {
          instructionId: updatedSettlement.id,
          transactionId: grpcResult.transactionId,
          status: SettlementStatus.EXECUTED,
          executedAt: updatedSettlement.executedAt.toISOString(),
          errorMessage: grpcResult.errorMessage,
          idempotencyKey,
        };
      } catch (error) {
        // Update settlement with error
        settlement.markAsFailed(error.message);
        await this.settlementRepository.update(settlement.id, settlement);

        this.logger.error('Failed to execute settlement', {
          settlementId: settlement.id,
          error: error.message,
        });

        throw error;
      }
    } else {
      // Schedule for later execution
      settlement.status = SettlementStatus.SCHEDULED;
      await this.settlementRepository.update(settlement.id, settlement);

      return {
        instructionId: settlement.id,
        transactionId: '',
        status: SettlementStatus.SCHEDULED,
        executedAt: '',
        errorMessage: 'Settlement scheduled for later execution',
        idempotencyKey,
      };
    }
  }

  async cancelSettlement(
    cancelSettlementDto: CancelSettlementDto,
  ): Promise<CancelSettlementResponseDto> {
    const idempotencyKey = cancelSettlementDto.idempotencyKey || this.generateIdempotencyKey();
    const operation = `cancel_settlement_${cancelSettlementDto.instructionId}`;

    // Check for idempotency
    const { exists, response: cachedResponse } = await this.idempotencyService.checkKey(
      idempotencyKey,
      operation,
    );

    if (exists) {
      return cachedResponse;
    }

    // Get settlement instruction
    const settlement = await this.settlementRepository.findById(cancelSettlementDto.instructionId);
    
    if (!settlement) {
      throw new ConflictException(`Settlement instruction not found: ${cancelSettlementDto.instructionId}`);
    }

    if (settlement.status !== SettlementStatus.PENDING && 
        settlement.status !== SettlementStatus.SCHEDULED) {
      throw new ConflictException(`Settlement cannot be cancelled in status: ${settlement.status}`);
    }

    // Cancel the settlement
    settlement.markAsCancelled(cancelSettlementDto.reason);
    settlement.settlementHash = settlement.calculateHash(settlement.previousHash);

    const updatedSettlement = await this.settlementRepository.update(settlement.id, settlement);

    // Store response for idempotency
    await this.idempotencyService.setKey(idempotencyKey, operation, {
      instructionId: updatedSettlement.id,
      status: SettlementStatus.CANCELLED,
      cancelledAt: updatedSettlement.completedAt.toISOString(),
      reason: cancelSettlementDto.reason,
      idempotencyKey,
    });

    // Publish to Kafka
    await this.publishToKafka(updatedSettlement);

    this.logger.log('Settlement cancelled', {
      settlementId: updatedSettlement.id,
      reason: cancelSettlementDto.reason,
    });

    return {
      instructionId: updatedSettlement.id,
      status: SettlementStatus.CANCELLED,
      cancelledAt: updatedSettlement.completedAt.toISOString(),
      reason: cancelSettlementDto.reason,
      idempotencyKey,
    };
  }

  async reconcileSettlement(
    reconcileSettlementDto: ReconcileSettlementDto,
  ): Promise<ReconcileSettlementResponseDto> {
    const idempotencyKey = reconcileSettlementDto.idempotencyKey || this.generateIdempotencyKey();
    const operation = `reconcile_settlement_${reconcileSettlementDto.instructionId}`;

    // Check for idempotency
    const { exists, response: cachedResponse } = await this.idempotencyService.checkKey(
      idempotencyKey,
      operation,
    );

    if (exists) {
      return cachedResponse;
    }

    // Get settlement instruction
    const settlement = await this.settlementRepository.findById(reconcileSettlementDto.instructionId);
    
    if (!settlement) {
      throw new ConflictException(`Settlement instruction not found: ${reconcileSettlementDto.instructionId}`);
    }

    if (!settlement.transactionId && !reconcileSettlementDto.transactionId) {
      throw new ConflictException('No transaction ID provided for reconciliation');
    }

    const transactionId = reconcileSettlementDto.transactionId || settlement.transactionId;

    try {
      // Get transaction details from LOWDATAESC
      const transactionDetails = await this.getTransactionDetailsFromLowdataesc(transactionId);
      
      // Compare amounts
      const expectedAmount = parseFloat(settlement.amount.toString());
      const expectedCurrency = settlement.currency;
      const actualAmount = parseFloat(transactionDetails.amount);
      const actualCurrency = transactionDetails.currency || expectedCurrency;

      const isReconciled = expectedAmount === actualAmount && expectedCurrency === actualCurrency;
      const discrepancyReason = isReconciled ? null : 
        `Amount mismatch: expected ${expectedAmount} ${expectedCurrency}, actual ${actualAmount} ${actualCurrency}`;

      // Create reconciliation record
      const reconciliation = await this.settlementRepository.reconcileSettlementWithTransaction(
        settlement.id,
        transactionId,
        expectedAmount,
        expectedCurrency as Currency,
        actualAmount,
        actualCurrency as Currency,
        isReconciled,
        discrepancyReason,
      );

      // Store response for idempotency
      await this.idempotencyService.setKey(idempotencyKey, operation, {
        instructionId: settlement.id,
        transactionId,
        isReconciled,
        expectedAmount: expectedAmount.toString(),
        expectedCurrency,
        actualAmount: actualAmount.toString(),
        actualCurrency,
        status: isReconciled ? SettlementStatus.RECONCILED : SettlementStatus.PENDING,
        reconciledAt: reconciliation.reconciledAt.toISOString(),
        discrepancyReason,
        idempotencyKey,
      });

      this.logger.log('Settlement reconciled', {
        settlementId: settlement.id,
        transactionId,
        isReconciled,
        discrepancyReason,
      });

      return {
        instructionId: settlement.id,
        transactionId,
        isReconciled,
        expectedAmount: { amount: expectedAmount.toString(), currency: expectedCurrency },
        actualAmount: isReconciled ? undefined : { amount: actualAmount.toString(), currency: actualCurrency },
        status: isReconciled ? SettlementStatus.RECONCILED : SettlementStatus.PENDING,
        reconciledAt: reconciliation.reconciledAt.toISOString(),
        discrepancyReason,
        idempotencyKey,
      };
    } catch (error) {
      this.logger.error('Failed to reconcile settlement', {
        settlementId: settlement.id,
        transactionId,
        error: error.message,
      });

      throw error;
    }
  }

  // ============================================================================
  // ESCROW ACCOUNT METHODS
  // ============================================================================

  async createEscrowAccount(
    escrowAccountDto: EscrowAccountDto,
  ): Promise<EscrowAccountResponseDto> {
    const idempotencyKey = escrowAccountDto.idempotencyKey || this.generateIdempotencyKey();
    const operation = `create_escrow_account_${escrowAccountDto.ownerId}`;

    // Check for idempotency
    const { exists, response: cachedResponse } = await this.idempotencyService.checkKey(
      idempotencyKey,
      operation,
    );

    if (exists) {
      return cachedResponse;
    }

    // Check if account already exists for this owner
    const existingAccount = await this.settlementRepository.findEscrowAccountByOwner(
      escrowAccountDto.ownerId,
      escrowAccountDto.ownerType,
    );

    if (existingAccount) {
      throw new ConflictException(`Escrow account already exists for owner: ${escrowAccountDto.ownerId}`);
    }

    // Create escrow account
    const account = await this.settlementRepository.createEscrowAccount({
      id: escrowAccountDto.id || uuidv4(),
      ownerId: escrowAccountDto.ownerId,
      ownerType: escrowAccountDto.ownerType,
      name: escrowAccountDto.name,
      description: escrowAccountDto.description,
      currency: escrowAccountDto.currency || Currency.BRL,
      balance: escrowAccountDto.initialBalance?.amount ? parseFloat(escrowAccountDto.initialBalance.amount) : 0,
      availableBalance: escrowAccountDto.initialBalance?.amount ? parseFloat(escrowAccountDto.initialBalance.amount) : 0,
      reservedBalance: 0,
      status: 'ACTIVE',
      isFrozen: false,
      isClosed: false,
      metadata: escrowAccountDto.metadata,
    });

    // Try to create in LOWDATAESC
    try {
      const lowdataescAccount = await this.createEscrowAccountInLowdataesc(account);
      account.externalId = lowdataescAccount.account_id;
      await this.settlementRepository.updateEscrowAccount(account.id, { externalId: lowdataescAccount.account_id });
    } catch (error) {
      this.logger.warn('Failed to create escrow account in LOWDATAESC, will retry later', {
        accountId: account.id,
        error: error.message,
      });
    }

    // Store response for idempotency
    await this.idempotencyService.setKey(idempotencyKey, operation, this.toEscrowAccountResponseDto(account));

    this.logger.log('Escrow account created', {
      accountId: account.id,
      ownerId: account.ownerId,
      ownerType: account.ownerType,
      balance: account.balance,
      currency: account.currency,
    });

    return this.toEscrowAccountResponseDto(account);
  }

  async getEscrowAccount(id: string): Promise<EscrowAccountResponseDto> {
    const account = await this.settlementRepository.findEscrowAccountById(id);
    
    if (!account) {
      throw new ConflictException(`Escrow account not found: ${id}`);
    }

    return this.toEscrowAccountResponseDto(account);
  }

  async listEscrowAccounts(
    page: number = 1,
    limit: number = 100,
    ownerId?: string,
    ownerType?: string,
    status?: string,
    currency?: Currency,
  ): Promise<{ data: EscrowAccountResponseDto[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const result = await this.settlementRepository.findAllEscrowAccounts(
      page,
      limit,
      ownerId,
      ownerType,
      status,
      currency,
    );

    return {
      data: result.data.map((a) => this.toEscrowAccountResponseDto(a)),
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  async getEscrowAccountBalance(accountId: string): Promise<{ balance: number; availableBalance: number; reservedBalance: number; currency: Currency }> {
    const balance = await this.settlementRepository.getEscrowAccountBalance(accountId);
    
    if (!balance) {
      throw new ConflictException(`Escrow account not found: ${accountId}`);
    }

    return balance;
  }

  async depositToEscrowAccount(
    accountId: string,
    amount: number,
    referenceId: string,
    description: string,
  ): Promise<EscrowAccountResponseDto> {
    const account = await this.settlementRepository.depositToEscrowAccount(
      accountId,
      amount,
      referenceId,
      description,
    );

    if (!account) {
      throw new ConflictException(`Escrow account not found: ${accountId}`);
    }

    this.logger.log('Deposited to escrow account', {
      accountId,
      amount,
      currency: account.currency,
      referenceId,
    });

    return this.toEscrowAccountResponseDto(account);
  }

  async withdrawFromEscrowAccount(
    accountId: string,
    amount: number,
    referenceId: string,
    description: string,
    settlementInstructionId?: string,
  ): Promise<EscrowAccountResponseDto> {
    const account = await this.settlementRepository.withdrawFromEscrowAccount(
      accountId,
      amount,
      referenceId,
      description,
      settlementInstructionId,
    );

    if (!account) {
      throw new ConflictException(`Escrow account not found: ${accountId}`);
    }

    this.logger.log('Withdrew from escrow account', {
      accountId,
      amount,
      currency: account.currency,
      referenceId,
    });

    return this.toEscrowAccountResponseDto(account);
  }

  async transferBetweenEscrowAccounts(
    sourceAccountId: string,
    destinationAccountId: string,
    amount: number,
    referenceId: string,
    description: string,
  ): Promise<{ sourceAccount: EscrowAccountResponseDto; destinationAccount: EscrowAccountResponseDto }> {
    const result = await this.settlementRepository.transferBetweenEscrowAccounts(
      sourceAccountId,
      destinationAccountId,
      amount,
      referenceId,
      description,
    );

    if (!result) {
      throw new ConflictException('Failed to transfer between escrow accounts');
    }

    this.logger.log('Transferred between escrow accounts', {
      sourceAccountId,
      destinationAccountId,
      amount,
      referenceId,
    });

    return {
      sourceAccount: this.toEscrowAccountResponseDto(result.sourceAccount),
      destinationAccount: this.toEscrowAccountResponseDto(result.destinationAccount),
    };
  }

  async freezeEscrowAccount(accountId: string, reason: string): Promise<EscrowAccountResponseDto> {
    const account = await this.settlementRepository.findEscrowAccountById(accountId);
    
    if (!account) {
      throw new ConflictException(`Escrow account not found: ${accountId}`);
    }

    account.freeze(reason);
    const updated = await this.settlementRepository.updateEscrowAccount(accountId, account);

    this.logger.log('Froze escrow account', {
      accountId,
      reason,
    });

    return this.toEscrowAccountResponseDto(updated);
  }

  async unfreezeEscrowAccount(accountId: string, reason: string): Promise<EscrowAccountResponseDto> {
    const account = await this.settlementRepository.findEscrowAccountById(accountId);
    
    if (!account) {
      throw new ConflictException(`Escrow account not found: ${accountId}`);
    }

    account.unfreeze(reason);
    const updated = await this.settlementRepository.updateEscrowAccount(accountId, account);

    this.logger.log('Unfroze escrow account', {
      accountId,
      reason,
    });

    return this.toEscrowAccountResponseDto(updated);
  }

  // ============================================================================
  // TRANSACTION METHODS
  // ============================================================================

  async getTransactionHistory(
    accountId: string,
    page: number = 1,
    limit: number = 100,
    type?: string,
    status?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{ data: TransactionDto[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const result = await this.settlementRepository.findTransactionsByAccountId(
      accountId,
      page,
      limit,
      type,
      status,
      startDate,
      endDate,
    );

    return {
      data: result.data.map((t) => this.toTransactionDto(t)),
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  // ============================================================================
  // RETRY AND REPROCESSING
  // ============================================================================

  async retrySettlement(instructionId: string): Promise<SettlementInstructionResponseDto> {
    const settlement = await this.settlementRepository.findById(instructionId);
    
    if (!settlement) {
      throw new ConflictException(`Settlement instruction not found: ${instructionId}`);
    }

    if (settlement.status !== SettlementStatus.FAILED) {
      throw new ConflictException(`Settlement is not in FAILED status (current: ${settlement.status})`);
    }

    if (settlement.retryCount >= (settlement.maxRetries || this.settlementConfig.maxRetries || 5)) {
      throw new ConflictException('Maximum retry attempts reached');
    }

    // Reset status and increment retry count
    settlement.status = SettlementStatus.PENDING;
    settlement.retryCount++;
    settlement.errorMessage = null;
    settlement.settlementHash = settlement.calculateHash(settlement.previousHash);

    const updatedSettlement = await this.settlementRepository.update(instructionId, settlement);

    // Re-queue for processing
    await this.publishToKafka(updatedSettlement);

    return this.toSettlementResponseDto(updatedSettlement);
  }

  async retryAllFailedSettlements(): Promise<{ successCount: number; errorCount: number; results: any[]; errors: any[] }> {
    const failedSettlements = await this.settlementRepository.getFailedSettlements(100);
    const results = [];
    const errors = [];

    for (const settlement of failedSettlements) {
      try {
        if (settlement.retryCount >= (settlement.maxRetries || this.settlementConfig.maxRetries || 5)) {
          errors.push({
            settlementId: settlement.id,
            error: 'Maximum retry attempts reached',
          });
          continue;
        }

        const updated = await this.retrySettlement(settlement.id);
        results.push(updated);
      } catch (error) {
        errors.push({
          settlementId: settlement.id,
          error: error.message,
        });
      }
    }

    return {
      successCount: results.length,
      errorCount: errors.length,
      results,
      errors,
    };
  }

  // ============================================================================
  // HASH CHAIN OPERATIONS
  // ============================================================================

  async getSettlementHashChain(settlementId: string, depth: number = 10): Promise<any> {
    const settlement = await this.settlementRepository.findById(settlementId);
    
    if (!settlement) {
      throw new ConflictException(`Settlement instruction not found: ${settlementId}`);
    }

    const chain = await this.settlementRepository.getHashChain(settlementId, depth);

    return {
      settlementId: settlement.id,
      chain: chain.map((s) => ({
        id: s.id,
        hash: s.settlementHash,
        previousHash: s.previousHash,
        timestamp: s.createdAt,
        amount: s.amount,
        currency: s.currency,
        status: s.status,
      })),
      isValid: await this.settlementRepository.verifyHashChain(settlementId),
    };
  }

  async verifySettlementHashChain(settlementId: string): Promise<boolean> {
    return this.settlementRepository.verifyHashChain(settlementId);
  }

  // ============================================================================
  // STATISTICS AND METRICS
  // ============================================================================

  async getStats(): Promise<any> {
    const stats = await this.settlementRepository.getStats();
    
    return {
      ...stats,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
    };
  }

  async listSettlementInstructions(
    page: number = 1,
    limit: number = 100,
    status?: SettlementStatus,
    type?: SettlementType,
    method?: SettlementMethod,
    calculationId?: string,
    eventId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{ data: any[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const result = await this.settlementRepository.findAll(
      page,
      limit,
      status,
      type,
      method,
      startDate,
      endDate,
      undefined,
      eventId,
      calculationId,
    );

    return {
      data: result.data.map((s) => this.toSettlementResponseDto(s)),
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  async getSettlementInstruction(instructionId: string): Promise<any> {
    const settlement = await this.settlementRepository.findById(instructionId);
    
    if (!settlement) {
      throw new ConflictException(`Settlement instruction not found: ${instructionId}`);
    }

    return this.toSettlementResponseDto(settlement);
  }

  // ============================================================================
  // LOWDATAESC INTEGRATION
  // ============================================================================

  private async executeSettlementWithLowdataesc(
    settlement: any,
    executeSettlementDto: ExecuteSettlementDto,
  ): Promise<{ transactionId: string; errorMessage?: string }> {
    try {
      // Prepare request for LOWDATAESC
      const request = {
        instruction_id: settlement.id,
        source_account_id: settlement.sourceAccountId,
        destination_account: settlement.destinationAccount,
        amount: {
          amount: settlement.amount.toString(),
          currency: settlement.currency,
        },
        method: settlement.method,
        reference_id: settlement.referenceId || settlement.id,
        description: settlement.description || `Settlement for event ${settlement.eventId}`,
        idempotency_key: executeSettlementDto.idempotencyKey || this.generateIdempotencyKey(),
        callback_url: settlement.callbackUrl,
      };

      // Call LOWDATAESC gRPC service
      const response = await this.grpcService.executeSettlement(
        request.instruction_id,
        request.idempotency_key,
        executeSettlementDto.forceExecute || false,
      );

      this.logger.log('LOWDATAESC settlement executed', {
        settlementId: settlement.id,
        transactionId: response.transaction_id,
      });

      return {
        transactionId: response.transaction_id,
      };
    } catch (error) {
      this.logger.error('LOWDATAESC settlement execution failed', {
        settlementId: settlement.id,
        error: error.message,
      });

      return {
        transactionId: '',
        errorMessage: error.message,
      };
    }
  }

  private async getTransactionDetailsFromLowdataesc(transactionId: string): Promise<any> {
    try {
      const response = await this.grpcService.getSettlementInstruction(transactionId);
      
      return {
        transactionId: response.transaction_id,
        amount: response.amount,
        currency: response.currency,
        status: response.status,
        executedAt: response.executed_at,
      };
    } catch (error) {
      this.logger.error('Failed to get transaction details from LOWDATAESC', {
        transactionId,
        error: error.message,
      });

      throw error;
    }
  }

  private async createEscrowAccountInLowdataesc(account: any): Promise<any> {
    try {
      const request = {
        account_id: account.id,
        owner_id: account.ownerId,
        owner_type: account.ownerType,
        name: account.name,
        description: account.description || '',
        currency: account.currency,
        idempotency_key: this.generateIdempotencyKey(),
      };

      const response = await this.grpcService.createEscrowAccount(request);
      
      this.logger.log('LOWDATAESC escrow account created', {
        accountId: account.id,
        externalId: response.account_id,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to create escrow account in LOWDATAESC', {
        accountId: account.id,
        error: error.message,
      });

      throw error;
    }
  }

  // ============================================================================
  // KAFKA INTEGRATION
  // ============================================================================

  private async startKafkaConsumer(): Promise<void> {
    const kafkaConfig = this.configService.get('kafka');
    const groupId = kafkaConfig.groupId || 'liquidacao-service-group';
    const topics = [
      kafkaConfig.topic?.settlementInstructions || 'settlement-instructions',
      kafkaConfig.topic?.settlementResults || 'settlement-results',
    ];

    this.logger.log('Starting Kafka consumer...', { groupId, topics });

    for (const topic of topics) {
      await this.kafkaService.consume(
        `${groupId}-${topic}`,
        [topic],
        async (message) => {
          try {
            this.logger.debug('Processing Kafka message', {
              topic: message.topic,
              key: message.key,
              offset: message.offset,
            });

            // Process the message
            if (message.topic === (kafkaConfig.topic?.settlementInstructions || 'settlement-instructions')) {
              await this.processSettlementInstruction(message.value);
            } else if (message.topic === (kafkaConfig.topic?.settlementResults || 'settlement-results')) {
              await this.processSettlementResult(message.value);
            }

            // Commit offset
            // Note: In a real implementation, you would commit after successful processing
          } catch (error) {
            this.logger.error('Failed to process Kafka message', error);
          }
        },
      );
    }

    this.logger.log('Kafka consumer started successfully');
  }

  private async processSettlementInstruction(instruction: any): Promise<void> {
    this.logger.log('Processing settlement instruction from Kafka', {
      instructionId: instruction.id,
      eventId: instruction.eventId,
      amount: instruction.amount,
    });

    // In a real implementation, this would create or update a settlement instruction
    // For now, just log it
  }

  private async processSettlementResult(result: any): Promise<void> {
    this.logger.log('Processing settlement result from Kafka', {
      instructionId: result.instructionId,
      transactionId: result.transactionId,
      status: result.status,
    });

    // Update settlement status based on result
    if (result.status === 'EXECUTED' || result.status === 'COMPLETED') {
      const settlement = await this.settlementRepository.findById(result.instructionId);
      
      if (settlement) {
        settlement.transactionId = result.transactionId;
        settlement.status = result.status as SettlementStatus;
        settlement.executedAt = new Date(result.executedAt);
        settlement.completedAt = result.completedAt ? new Date(result.completedAt) : null;
        settlement.settlementHash = settlement.calculateHash(settlement.previousHash);

        await this.settlementRepository.update(settlement.id, settlement);

        // Notify callback if configured
        if (settlement.callbackUrl) {
          await this.grpcService.notifyCallback('SETTLEMENT_EXECUTED', result);
        }
      }
    }
  }

  private async publishToKafka(settlement: any): Promise<void> {
    try {
      const message: KafkaMessage = {
        topic: this.kafkaTopic,
        key: settlement.id,
        value: {
          settlementId: settlement.id,
          calculationId: settlement.calculationId,
          eventId: settlement.eventId,
          type: settlement.type,
          sourceAccountId: settlement.sourceAccountId,
          destinationAccount: settlement.destinationAccount,
          amount: settlement.amount,
          currency: settlement.currency,
          method: settlement.method,
          status: settlement.status,
          transactionId: settlement.transactionId,
          referenceId: settlement.referenceId,
          createdAt: settlement.createdAt.toISOString(),
          executedAt: settlement.executedAt?.toISOString(),
          completedAt: settlement.completedAt?.toISOString(),
          hash: settlement.settlementHash,
          previousHash: settlement.previousHash,
          errorMessage: settlement.errorMessage,
          retryCount: settlement.retryCount,
          correlationId: settlement.correlationId,
          metadata: settlement.metadata,
        },
        headers: {
          'x-service': this.serviceName,
          'x-version': '1.0',
          'x-timestamp': new Date().toISOString(),
        },
      };

      await this.kafkaService.send(message);
    } catch (error) {
      this.logger.error('Failed to publish settlement to Kafka', error);
      throw new InternalServerErrorException('Failed to publish settlement to Kafka');
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private generateIdempotencyKey(): string {
    return `settle_${Date.now()}_${uuidv4().substring(0, 12)}`;
  }

  private toSettlementResponseDto(settlement: any): SettlementInstructionResponseDto {
    return {
      id: settlement.id,
      calculationId: settlement.calculationId,
      eventId: settlement.eventId,
      type: settlement.type,
      sourceAccountId: settlement.sourceAccountId,
      destinationAccount: settlement.destinationAccount,
      amount: {
        amount: settlement.amount.toString(),
        currency: settlement.currency,
      },
      method: settlement.method,
      status: settlement.status,
      transactionId: settlement.transactionId,
      referenceId: settlement.referenceId,
      scheduledDate: settlement.scheduledDate?.toISOString(),
      expiryDate: settlement.expiryDate?.toISOString(),
      executedAt: settlement.executedAt?.toISOString(),
      completedAt: settlement.completedAt?.toISOString(),
      errorMessage: settlement.errorMessage,
      retryCount: settlement.retryCount,
      description: settlement.description,
      priority: settlement.priority,
      callbackUrl: settlement.callbackUrl,
      settlementHash: settlement.settlementHash,
      previousHash: settlement.previousHash,
      metadata: settlement.metadata,
      createdAt: settlement.createdAt.toISOString(),
      updatedAt: settlement.updatedAt.toISOString(),
    };
  }

  private toEscrowAccountResponseDto(account: any): EscrowAccountResponseDto {
    return {
      id: account.id,
      ownerId: account.ownerId,
      ownerType: account.ownerType,
      name: account.name,
      description: account.description,
      currency: account.currency,
      balance: {
        amount: account.balance.toString(),
        currency: account.currency,
      },
      availableBalance: {
        amount: account.availableBalance.toString(),
        currency: account.currency,
      },
      reservedBalance: {
        amount: account.reservedBalance.toString(),
        currency: account.currency,
      },
      status: account.status,
      isFrozen: account.isFrozen,
      isClosed: account.isClosed,
      externalId: account.externalId,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
      metadata: account.metadata,
    };
  }

  private toTransactionDto(transaction: any): TransactionDto {
    return {
      id: transaction.id,
      accountId: transaction.accountId,
      transactionId: transaction.transactionId,
      type: transaction.type,
      direction: transaction.direction,
      amount: {
        amount: transaction.amount.toString(),
        currency: transaction.currency,
      },
      balanceAfter: {
        amount: transaction.balanceAfter.toString(),
        currency: transaction.currency,
      },
      referenceId: transaction.referenceId,
      description: transaction.description,
      status: transaction.status,
      settlementInstructionId: transaction.settlementInstructionId,
      createdAt: transaction.createdAt.toISOString(),
      metadata: transaction.metadata,
    };
  }
}
