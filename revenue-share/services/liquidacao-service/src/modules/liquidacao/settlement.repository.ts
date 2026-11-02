import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Between, MoreThan, LessThan } from 'typeorm';
import { SettlementInstruction, EscrowAccount, Transaction, Reconciliation } from './entities/settlement.entity';
import { SettlementStatus, SettlementType, SettlementMethod, Currency } from './dto/create-settlement.dto';
import { LoggerService } from '../../common/logger/logger.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SettlementRepository {
  private readonly logger = new LoggerService('SettlementRepository');

  constructor(
    @InjectRepository(SettlementInstruction)
    private readonly settlementRepository: Repository<SettlementInstruction>,
    @InjectRepository(EscrowAccount)
    private readonly escrowAccountRepository: Repository<EscrowAccount>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Reconciliation)
    private readonly reconciliationRepository: Repository<Reconciliation>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  // ============================================================================
  // SETTLEMENT INSTRUCTION OPERATIONS
  // ============================================================================

  async create(settlementData: Partial<SettlementInstruction>): Promise<SettlementInstruction> {
    const settlement = this.settlementRepository.create(settlementData);
    
    // Calculate hash before saving
    const previousHash = await this.getLastSettlementHash();
    settlement.previousHash = previousHash;
    settlement.settlementHash = settlement.calculateHash(previousHash);

    const saved = await this.settlementRepository.save(settlement);
    
    this.logger.log('Created settlement instruction', {
      id: saved.id,
      calculationId: saved.calculationId,
      eventId: saved.eventId,
      type: saved.type,
      status: saved.status,
      amount: saved.amount,
      currency: saved.currency,
    });

    return saved;
  }

  async findById(id: string): Promise<SettlementInstruction | null> {
    return this.settlementRepository.findOne({
      where: { id, isDeleted: false },
    });
  }

  async findByCalculationId(calculationId: string): Promise<SettlementInstruction[]> {
    return this.settlementRepository.find({
      where: { calculationId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  async findByEventId(eventId: string): Promise<SettlementInstruction[]> {
    return this.settlementRepository.find({
      where: { eventId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  async findByTransactionId(transactionId: string): Promise<SettlementInstruction | null> {
    return this.settlementRepository.findOne({
      where: { transactionId, isDeleted: false },
    });
  }

  async findByReferenceId(referenceId: string): Promise<SettlementInstruction | null> {
    return this.settlementRepository.findOne({
      where: { referenceId, isDeleted: false },
    });
  }

  async findBySettlementHash(hash: string): Promise<SettlementInstruction | null> {
    return this.settlementRepository.findOne({
      where: { settlementHash: hash, isDeleted: false },
    });
  }

  async findAll(
    page: number = 1,
    limit: number = 100,
    status?: SettlementStatus,
    type?: SettlementType,
    method?: SettlementMethod,
    startDate?: string,
    endDate?: string,
    sourceAccountId?: string,
    eventId?: string,
    calculationId?: string,
  ): Promise<{ data: SettlementInstruction[]; total: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const where: any = { isDeleted: false };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (method) {
      where.method = method;
    }

    if (sourceAccountId) {
      where.sourceAccountId = sourceAccountId;
    }

    if (eventId) {
      where.eventId = eventId;
    }

    if (calculationId) {
      where.calculationId = calculationId;
    }

    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      where.createdAt = MoreThan(new Date(startDate));
    } else if (endDate) {
      where.createdAt = LessThan(new Date(endDate));
    }

    const [data, total] = await Promise.all([
      this.settlementRepository.find({
        where,
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      }),
      this.settlementRepository.count({ where }),
    ]);

    return {
      data,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(id: string, updateData: Partial<SettlementInstruction>): Promise<SettlementInstruction | null> {
    const settlement = await this.findById(id);
    
    if (!settlement) {
      this.logger.warn('Settlement not found for update', { id });
      return null;
    }

    // Update version for optimistic locking
    updateData.version = settlement.version + 1;

    const updated = await this.settlementRepository.save({
      ...settlement,
      ...updateData,
    });

    this.logger.log('Updated settlement instruction', {
      id: updated.id,
      status: updated.status,
    });

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const settlement = await this.findById(id);
    
    if (!settlement) {
      this.logger.warn('Settlement not found for deletion', { id });
      return false;
    }

    settlement.softDelete();
    await this.settlementRepository.save(settlement);

    this.logger.log('Soft deleted settlement instruction', { id });
    return true;
  }

  async hardDelete(id: string): Promise<boolean> {
    const result = await this.settlementRepository.delete(id);
    
    if (result.affected && result.affected > 0) {
      this.logger.log('Hard deleted settlement instruction', { id });
      return true;
    }
    
    return false;
  }

  async getLastSettlementHash(): Promise<string | null> {
    const lastSettlement = await this.settlementRepository.findOne({
      where: { isDeleted: false },
      order: { createdAt: 'DESC' },
    });

    return lastSettlement?.settlementHash || null;
  }

  async verifyHashChain(settlementId: string): Promise<boolean> {
    const settlement = await this.findById(settlementId);
    
    if (!settlement) {
      return false;
    }

    // Verify current hash
    const expectedHash = settlement.calculateHash(settlement.previousHash);
    if (expectedHash !== settlement.settlementHash) {
      this.logger.error('Hash chain verification failed - current hash mismatch', {
        settlementId,
        expectedHash,
        actualHash: settlement.settlementHash,
      });
      return false;
    }

    // Verify chain by checking previous settlements
    if (settlement.previousHash) {
      const previousSettlement = await this.findBySettlementHash(settlement.previousHash);
      
      if (!previousSettlement) {
        this.logger.error('Hash chain verification failed - previous settlement not found', {
          settlementId,
          previousHash: settlement.previousHash,
        });
        return false;
      }

      return this.verifyHashChain(previousSettlement.id);
    }

    return true;
  }

  async getHashChain(settlementId: string, depth: number = 10): Promise<SettlementInstruction[]> {
    const chain: SettlementInstruction[] = [];
    let current = await this.findById(settlementId);

    while (current && chain.length < depth) {
      chain.push(current);
      if (current.previousHash) {
        current = await this.findBySettlementHash(current.previousHash);
      } else {
        current = null;
      }
    }

    return chain;
  }

  async getPendingSettlements(limit: number = 100): Promise<SettlementInstruction[]> {
    return this.settlementRepository.find({
      where: {
        status: In([SettlementStatus.PENDING, SettlementStatus.SCHEDULED]),
        isDeleted: false,
      },
      order: { priority: 'DESC', createdAt: 'ASC' },
      take: limit,
    });
  }

  async getFailedSettlements(limit: number = 100): Promise<SettlementInstruction[]> {
    return this.settlementRepository.find({
      where: {
        status: SettlementStatus.FAILED,
        isDeleted: false,
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getSettlementsByStatus(status: SettlementStatus, limit: number = 100): Promise<SettlementInstruction[]> {
    return this.settlementRepository.find({
      where: { status, isDeleted: false },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // ============================================================================
  // ESCROW ACCOUNT OPERATIONS
  // ============================================================================

  async createEscrowAccount(accountData: Partial<EscrowAccount>): Promise<EscrowAccount> {
    const account = this.escrowAccountRepository.create(accountData);
    return this.escrowAccountRepository.save(account);
  }

  async findEscrowAccountById(id: string): Promise<EscrowAccount | null> {
    return this.escrowAccountRepository.findOne({
      where: { id, isDeleted: false },
    });
  }

  async findEscrowAccountByOwner(ownerId: string, ownerType: string): Promise<EscrowAccount | null> {
    return this.escrowAccountRepository.findOne({
      where: { ownerId, ownerType, isDeleted: false },
    });
  }

  async findEscrowAccountByExternalId(externalId: string): Promise<EscrowAccount | null> {
    return this.escrowAccountRepository.findOne({
      where: { externalId, isDeleted: false },
    });
  }

  async findAllEscrowAccounts(
    page: number = 1,
    limit: number = 100,
    ownerId?: string,
    ownerType?: string,
    status?: string,
    currency?: Currency,
  ): Promise<{ data: EscrowAccount[]; total: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const where: any = { isDeleted: false };

    if (ownerId) {
      where.ownerId = ownerId;
    }

    if (ownerType) {
      where.ownerType = ownerType;
    }

    if (status) {
      where.status = status;
    }

    if (currency) {
      where.currency = currency;
    }

    const [data, total] = await Promise.all([
      this.escrowAccountRepository.find({
        where,
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      }),
      this.escrowAccountRepository.count({ where }),
    ]);

    return {
      data,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateEscrowAccount(id: string, updateData: Partial<EscrowAccount>): Promise<EscrowAccount | null> {
    const account = await this.findEscrowAccountById(id);
    
    if (!account) {
      return null;
    }

    updateData.version = account.version + 1;
    updateData.updatedAt = new Date();

    return this.escrowAccountRepository.save({
      ...account,
      ...updateData,
    });
  }

  async deleteEscrowAccount(id: string): Promise<boolean> {
    const result = await this.escrowAccountRepository.delete(id);
    return result.affected && result.affected > 0;
  }

  async getEscrowAccountBalance(accountId: string): Promise<{ balance: number; availableBalance: number; reservedBalance: number; currency: Currency } | null> {
    const account = await this.findEscrowAccountById(accountId);
    
    if (!account) {
      return null;
    }

    return {
      balance: account.balance,
      availableBalance: account.availableBalance,
      reservedBalance: account.reservedBalance,
      currency: account.currency,
    };
  }

  async depositToEscrowAccount(accountId: string, amount: number, referenceId: string, description: string): Promise<EscrowAccount | null> {
    const account = await this.findEscrowAccountById(accountId);
    
    if (!account) {
      return null;
    }

    account.deposit(amount);
    
    // Create transaction record
    const transaction = this.transactionRepository.create({
      accountId: account.id,
      transactionId: referenceId,
      type: 'DEPOSIT',
      direction: 'IN',
      amount,
      currency: account.currency,
      balanceAfter: account.balance,
      referenceId,
      description,
      status: 'COMPLETED',
      metadata: {
        source: 'external',
      },
    });

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(EscrowAccount, account);
      await transactionalEntityManager.save(Transaction, transaction);
    });

    return account;
  }

  async withdrawFromEscrowAccount(
    accountId: string,
    amount: number,
    referenceId: string,
    description: string,
    settlementInstructionId?: string,
  ): Promise<EscrowAccount | null> {
    const account = await this.findEscrowAccountById(accountId);
    
    if (!account) {
      return null;
    }

    if (!account.withdraw(amount)) {
      throw new Error('Insufficient funds');
    }

    // Create transaction record
    const transaction = this.transactionRepository.create({
      accountId: account.id,
      transactionId: referenceId,
      type: 'WITHDRAWAL',
      direction: 'OUT',
      amount,
      currency: account.currency,
      balanceAfter: account.balance,
      referenceId,
      description,
      status: 'COMPLETED',
      settlementInstructionId,
      metadata: {
        destination: 'external',
      },
    });

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(EscrowAccount, account);
      await transactionalEntityManager.save(Transaction, transaction);
    });

    return account;
  }

  async transferBetweenEscrowAccounts(
    sourceAccountId: string,
    destinationAccountId: string,
    amount: number,
    referenceId: string,
    description: string,
  ): Promise<{ sourceAccount: EscrowAccount; destinationAccount: EscrowAccount } | null> {
    const sourceAccount = await this.findEscrowAccountById(sourceAccountId);
    const destinationAccount = await this.findEscrowAccountById(destinationAccountId);
    
    if (!sourceAccount || !destinationAccount) {
      return null;
    }

    if (!sourceAccount.withdraw(amount)) {
      throw new Error('Insufficient funds in source account');
    }

    destinationAccount.deposit(amount);

    // Create transaction records
    const sourceTransaction = this.transactionRepository.create({
      accountId: sourceAccount.id,
      transactionId: referenceId,
      type: 'TRANSFER',
      direction: 'OUT',
      amount,
      currency: sourceAccount.currency,
      balanceAfter: sourceAccount.balance,
      referenceId,
      description,
      status: 'COMPLETED',
      metadata: {
        destinationAccountId,
      },
    });

    const destinationTransaction = this.transactionRepository.create({
      accountId: destinationAccount.id,
      transactionId: referenceId,
      type: 'TRANSFER',
      direction: 'IN',
      amount,
      currency: destinationAccount.currency,
      balanceAfter: destinationAccount.balance,
      referenceId,
      description,
      status: 'COMPLETED',
      metadata: {
        sourceAccountId,
      },
    });

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(EscrowAccount, sourceAccount);
      await transactionalEntityManager.save(EscrowAccount, destinationAccount);
      await transactionalEntityManager.save(Transaction, sourceTransaction);
      await transactionalEntityManager.save(Transaction, destinationTransaction);
    });

    return { sourceAccount, destinationAccount };
  }

  // ============================================================================
  // TRANSACTION OPERATIONS
  // ============================================================================

  async createTransaction(transactionData: Partial<Transaction>): Promise<Transaction> {
    const transaction = this.transactionRepository.create(transactionData);
    return this.transactionRepository.save(transaction);
  }

  async findTransactionById(id: string): Promise<Transaction | null> {
    return this.transactionRepository.findOne({
      where: { id },
    });
  }

  async findTransactionByTransactionId(transactionId: string): Promise<Transaction | null> {
    return this.transactionRepository.findOne({
      where: { transactionId },
    });
  }

  async findTransactionsByAccountId(
    accountId: string,
    page: number = 1,
    limit: number = 100,
    type?: string,
    status?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{ data: Transaction[]; total: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const where: any = { accountId };

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      where.createdAt = MoreThan(new Date(startDate));
    } else if (endDate) {
      where.createdAt = LessThan(new Date(endDate));
    }

    const [data, total] = await Promise.all([
      this.transactionRepository.find({
        where,
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      }),
      this.transactionRepository.count({ where }),
    ]);

    return {
      data,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateTransaction(id: string, updateData: Partial<Transaction>): Promise<Transaction | null> {
    const transaction = await this.findTransactionById(id);
    
    if (!transaction) {
      return null;
    }

    updateData.version = transaction.version + 1;
    updateData.updatedAt = new Date();

    return this.transactionRepository.save({
      ...transaction,
      ...updateData,
    });
  }

  // ============================================================================
  // RECONCILIATION OPERATIONS
  // ============================================================================

  async createReconciliation(reconciliationData: Partial<Reconciliation>): Promise<Reconciliation> {
    const reconciliation = this.reconciliationRepository.create(reconciliationData);
    return this.reconciliationRepository.save(reconciliation);
  }

  async findReconciliationById(id: string): Promise<Reconciliation | null> {
    return this.reconciliationRepository.findOne({
      where: { id },
    });
  }

  async findReconciliationBySettlementInstructionId(settlementInstructionId: string): Promise<Reconciliation | null> {
    return this.reconciliationRepository.findOne({
      where: { settlementInstructionId },
    });
  }

  async findReconciliationByTransactionId(transactionId: string): Promise<Reconciliation | null> {
    return this.reconciliationRepository.findOne({
      where: { transactionId },
    });
  }

  async findAllReconciliations(
    page: number = 1,
    limit: number = 100,
    isReconciled?: boolean,
    status?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{ data: Reconciliation[]; total: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (isReconciled !== undefined) {
      where.isReconciled = isReconciled;
    }

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      where.createdAt = MoreThan(new Date(startDate));
    } else if (endDate) {
      where.createdAt = LessThan(new Date(endDate));
    }

    const [data, total] = await Promise.all([
      this.reconciliationRepository.find({
        where,
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      }),
      this.reconciliationRepository.count({ where }),
    ]);

    return {
      data,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateReconciliation(id: string, updateData: Partial<Reconciliation>): Promise<Reconciliation | null> {
    const reconciliation = await this.findReconciliationById(id);
    
    if (!reconciliation) {
      return null;
    }

    updateData.version = reconciliation.version + 1;

    return this.reconciliationRepository.save({
      ...reconciliation,
      ...updateData,
    });
  }

  // ============================================================================
  // STATISTICS AND METRICS
  // ============================================================================

  async getStats(): Promise<any> {
    const [
      totalSettlements,
      pending,
      scheduled,
      processing,
      executed,
      completed,
      failed,
      cancelled,
      reconciled,
      byType,
      byMethod,
      byCurrency,
      byStatus,
      recentSettlements,
      totalEscrowAccounts,
      totalTransactions,
    ] = await Promise.all([
      this.settlementRepository.count({ where: { isDeleted: false } }),
      this.settlementRepository.count({ where: { status: SettlementStatus.PENDING, isDeleted: false } }),
      this.settlementRepository.count({ where: { status: SettlementStatus.SCHEDULED, isDeleted: false } }),
      this.settlementRepository.count({ where: { status: SettlementStatus.PROCESSING, isDeleted: false } }),
      this.settlementRepository.count({ where: { status: SettlementStatus.EXECUTED, isDeleted: false } }),
      this.settlementRepository.count({ where: { status: SettlementStatus.COMPLETED, isDeleted: false } }),
      this.settlementRepository.count({ where: { status: SettlementStatus.FAILED, isDeleted: false } }),
      this.settlementRepository.count({ where: { status: SettlementStatus.CANCELLED, isDeleted: false } }),
      this.settlementRepository.count({ where: { status: SettlementStatus.RECONCILED, isDeleted: false } }),
      this.getStatsByType(),
      this.getStatsByMethod(),
      this.getStatsByCurrency(),
      this.getStatsByStatus(),
      this.getRecentSettlements(),
      this.escrowAccountRepository.count({ where: { isDeleted: false } }),
      this.transactionRepository.count(),
    ]);

    return {
      settlements: {
        total: totalSettlements,
        byStatus: {
          pending,
          scheduled,
          processing,
          executed,
          completed,
          failed,
          cancelled,
          reconciled,
          disputed: 0,
        },
        byType,
        byMethod,
        byCurrency,
        byStatus,
        recentSettlements,
        errorRate: totalSettlements > 0 ? (failed / totalSettlements) * 100 : 0,
        successRate: totalSettlements > 0 ? (completed / totalSettlements) * 100 : 0,
      },
      escrowAccounts: {
        total: totalEscrowAccounts,
      },
      transactions: {
        total: totalTransactions,
      },
    };
  }

  private async getStatsByType(): Promise<Record<string, number>> {
    const results = await this.settlementRepository
      .createQueryBuilder('settlement')
      .select('settlement.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('settlement.isDeleted = :isDeleted', { isDeleted: false })
      .groupBy('settlement.type')
      .getRawMany();

    const stats: Record<string, number> = {};
    results.forEach((r) => {
      stats[r.type] = parseInt(r.count);
    });

    return stats;
  }

  private async getStatsByMethod(): Promise<Record<string, number>> {
    const results = await this.settlementRepository
      .createQueryBuilder('settlement')
      .select('settlement.method', 'method')
      .addSelect('COUNT(*)', 'count')
      .where('settlement.isDeleted = :isDeleted', { isDeleted: false })
      .groupBy('settlement.method')
      .getRawMany();

    const stats: Record<string, number> = {};
    results.forEach((r) => {
      stats[r.method] = parseInt(r.count);
    });

    return stats;
  }

  private async getStatsByCurrency(): Promise<Record<string, number>> {
    const results = await this.settlementRepository
      .createQueryBuilder('settlement')
      .select('settlement.currency', 'currency')
      .addSelect('COUNT(*)', 'count')
      .where('settlement.isDeleted = :isDeleted', { isDeleted: false })
      .groupBy('settlement.currency')
      .getRawMany();

    const stats: Record<string, number> = {};
    results.forEach((r) => {
      stats[r.currency] = parseInt(r.count);
    });

    return stats;
  }

  private async getStatsByStatus(): Promise<Record<string, number>> {
    const results = await this.settlementRepository
      .createQueryBuilder('settlement')
      .select('settlement.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('settlement.isDeleted = :isDeleted', { isDeleted: false })
      .groupBy('settlement.status')
      .getRawMany();

    const stats: Record<string, number> = {};
    results.forEach((r) => {
      stats[r.status] = parseInt(r.count);
    });

    return stats;
  }

  private async getRecentSettlements(limit: number = 10): Promise<SettlementInstruction[]> {
    return this.settlementRepository.find({
      where: { isDeleted: false },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // ============================================================================
  // TRANSACTION OPERATIONS
  // ============================================================================

  async createWithTransaction(
    settlementData: Partial<SettlementInstruction>,
    escrowUpdate?: (account: EscrowAccount) => void,
  ): Promise<SettlementInstruction> {
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      // Create settlement
      const settlement = transactionalEntityManager.create(SettlementInstruction, settlementData);
      
      // Calculate hash
      const previousHash = await this.getLastSettlementHash();
      settlement.previousHash = previousHash;
      settlement.settlementHash = settlement.calculateHash(previousHash);

      const savedSettlement = await transactionalEntityManager.save(SettlementInstruction, settlement);

      // Update escrow account if needed
      if (escrowUpdate) {
        const account = await transactionalEntityManager.findOne(EscrowAccount, {
          where: { id: settlementData.sourceAccountId },
        });
        
        if (account) {
          escrowUpdate(account);
          account.version++;
          await transactionalEntityManager.save(EscrowAccount, account);
        }
      }

      return savedSettlement;
    });
  }

  async executeSettlementWithTransaction(
    settlementId: string,
    transactionId: string,
    escrowUpdate?: (account: EscrowAccount) => void,
  ): Promise<SettlementInstruction> {
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const settlement = await transactionalEntityManager.findOne(SettlementInstruction, {
        where: { id: settlementId, isDeleted: false },
      });

      if (!settlement) {
        throw new Error(`Settlement not found: ${settlementId}`);
      }

      // Update settlement
      settlement.markAsExecuted(transactionId);

      // Update escrow account if needed
      if (escrowUpdate) {
        const account = await transactionalEntityManager.findOne(EscrowAccount, {
          where: { id: settlement.sourceAccountId },
        });
        
        if (account) {
          escrowUpdate(account);
          account.version++;
          await transactionalEntityManager.save(EscrowAccount, account);
        }
      }

      // Recalculate hash
      settlement.settlementHash = settlement.calculateHash(settlement.previousHash);

      const updated = await transactionalEntityManager.save(SettlementInstruction, settlement);

      this.logger.log('Executed settlement with transaction', {
        settlementId: updated.id,
        transactionId: updated.transactionId,
      });

      return updated;
    });
  }

  async completeSettlementWithTransaction(
    settlementId: string,
    transactionId: string,
  ): Promise<SettlementInstruction> {
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const settlement = await transactionalEntityManager.findOne(SettlementInstruction, {
        where: { id: settlementId, isDeleted: false },
      });

      if (!settlement) {
        throw new Error(`Settlement not found: ${settlementId}`);
      }

      // Update settlement
      settlement.markAsCompleted();
      settlement.transactionId = transactionId;
      settlement.settlementHash = settlement.calculateHash(settlement.previousHash);

      const updated = await transactionalEntityManager.save(SettlementInstruction, settlement);

      this.logger.log('Completed settlement with transaction', {
        settlementId: updated.id,
        transactionId: updated.transactionId,
      });

      return updated;
    });
  }

  async reconcileSettlementWithTransaction(
    settlementId: string,
    transactionId: string,
    expectedAmount: number,
    expectedCurrency: Currency,
    actualAmount: number,
    actualCurrency: Currency,
    isReconciled: boolean,
    discrepancyReason?: string,
  ): Promise<Reconciliation> {
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const settlement = await transactionalEntityManager.findOne(SettlementInstruction, {
        where: { id: settlementId, isDeleted: false },
      });

      if (!settlement) {
        throw new Error(`Settlement not found: ${settlementId}`);
      }

      // Create reconciliation
      const reconciliation = transactionalEntityManager.create(Reconciliation, {
        id: this.generateId(),
        settlementInstructionId: settlementId,
        transactionId,
        expectedAmount,
        expectedCurrency,
        actualAmount,
        actualCurrency,
        isReconciled,
        discrepancyReason,
        status: isReconciled ? 'RECONCILED' : 'DISCREPANCY',
        metadata: {
          settlementType: settlement.type,
          method: settlement.method,
        },
      });

      const savedReconciliation = await transactionalEntityManager.save(Reconciliation, reconciliation);

      // Update settlement if reconciled
      if (isReconciled) {
        settlement.markAsReconciled();
        settlement.settlementHash = settlement.calculateHash(settlement.previousHash);
        await transactionalEntityManager.save(SettlementInstruction, settlement);
      }

      this.logger.log('Reconciled settlement with transaction', {
        settlementId,
        transactionId,
        isReconciled,
      });

      return savedReconciliation;
    });
  }

  private generateId(): string {
    const crypto = require('crypto');
    return crypto.randomUUID();
  }

  // ============================================================================
  // CLEANUP OPERATIONS
  // ============================================================================

  async cleanupOldSettlements(days: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const result = await this.settlementRepository.update(
      {
        isDeleted: false,
        status: In([SettlementStatus.COMPLETED, SettlementStatus.RECONCILED, SettlementStatus.CANCELLED]),
        completedAt: LessThan(cutoffDate),
      },
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
    );

    this.logger.log('Cleaned up old settlements', {
      count: result.affected,
      days,
    });

    return result.affected || 0;
  }

  async cleanupOrphanedTransactions(): Promise<number> {
    // Find settlements that don't exist
    const query = `
      DELETE FROM liquidacao.transactions
      WHERE settlement_instruction_id IS NOT NULL
      AND settlement_instruction_id NOT IN (
        SELECT id FROM liquidacao.settlement_instructions
      )
    `;

    const result = await this.dataSource.query(query);
    
    this.logger.log('Cleaned up orphaned transactions', {
      count: result?.affectedRows || 0,
    });

    return result?.affectedRows || 0;
  }
}
