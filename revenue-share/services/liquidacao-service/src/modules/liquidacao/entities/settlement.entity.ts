import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn, OneToMany, RelationId } from 'typeorm';
import { SettlementStatus, SettlementMethod, SettlementType, Currency } from '../dto/create-settlement.dto';

@Entity({ name: 'settlement_instructions', schema: 'liquidacao' })
@Index(['calculationId'])
@Index(['eventId'])
@Index(['sourceAccountId'])
@Index(['transactionId'])
@Index(['status'])
@Index(['type'])
@Index(['method'])
@Index(['settlementHash'], { unique: true })
@Index(['referenceId'])
export class SettlementInstruction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Reference to the calculation that generated this settlement
  @Column({ type: 'uuid', nullable: false })
  @Index()
  calculationId: string;

  // Reference to the revenue event
  @Column({ type: 'uuid', nullable: false })
  @Index()
  eventId: string;

  // Type of settlement
  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: SettlementType.REVENUE_SHARE,
  })
  @Index()
  type: SettlementType;

  // Source escrow account
  @Column({ type: 'uuid', nullable: false })
  @Index()
  sourceAccountId: string;

  // Destination account information (stored as JSON for flexibility)
  @Column({ type: 'jsonb', nullable: false })
  destinationAccount: {
    accountType: string;
    bankAccount?: {
      bankCode: string;
      agency: string;
      accountNumber: string;
      accountDigit?: string;
      accountType: string;
      documentNumber: string;
      documentType: string;
      holderName: string;
    };
    pixAccount?: {
      keyType: string;
      keyValue: string;
      holderName: string;
      documentNumber: string;
    };
    cryptoAddress?: string;
    cryptoNetwork?: string;
    walletId?: string;
    externalId: string;
    metadata?: Record<string, any>;
  };

  // Amount information
  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  amount: number;

  @Column({ type: 'varchar', length: 3, nullable: false, default: 'BRL' })
  currency: Currency;

  // Settlement method
  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: SettlementMethod.PIX,
  })
  @Index()
  method: SettlementMethod;

  // Status
  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    default: SettlementStatus.PENDING,
  })
  @Index()
  status: SettlementStatus;

  // LOWDATAESC transaction ID
  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  transactionId: string;

  // Timestamps
  @Column({ type: 'timestamp', nullable: true })
  @Index()
  scheduledDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  @Index()
  expiryDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  @Index()
  executedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  @Index()
  completedAt: Date;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;

  // Reference ID for tracking
  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  referenceId: string;

  // Description
  @Column({ type: 'text', nullable: true })
  description: string;

  // Priority (0 = normal, 1 = high, 2 = urgent)
  @Column({ type: 'integer', nullable: false, default: 0 })
  @Index()
  priority: number;

  // Callback URL
  @Column({ type: 'varchar', length: 1024, nullable: true })
  callbackUrl: string;

  // Error tracking
  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'integer', nullable: false, default: 0 })
  retryCount: number;

  @Column({ type: 'integer', nullable: true })
  maxRetries: number;

  // Hash chain for audit
  @Column({ type: 'varchar', length: 64, nullable: true })
  @Index()
  settlementHash: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  previousHash: string;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // Version for optimistic locking
  @Column({ type: 'integer', nullable: false, default: 1 })
  @Index()
  version: number;

  // Soft delete
  @Column({ type: 'boolean', nullable: false, default: false })
  isDeleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;

  // Correlation ID for tracing
  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  correlationId: string;

  // Source of the settlement request
  @Column({ type: 'varchar', length: 100, nullable: true })
  source: string;

  // Constructor for easy initialization
  constructor(partial: Partial<SettlementInstruction> = {}) {
    Object.assign(this, partial);
    
    // Set defaults
    if (!this.status) {
      this.status = SettlementStatus.PENDING;
    }
    if (!this.type) {
      this.type = SettlementType.REVENUE_SHARE;
    }
    if (!this.method) {
      this.method = SettlementMethod.PIX;
    }
    if (!this.currency) {
      this.currency = 'BRL';
    }
    if (!this.retryCount) {
      this.retryCount = 0;
    }
    if (!this.priority) {
      this.priority = 0;
    }
    if (!this.version) {
      this.version = 1;
    }
    if (!this.isDeleted) {
      this.isDeleted = false;
    }
  }

  // Method to calculate hash
  calculateHash(previousHash?: string): string {
    const crypto = require('crypto');
    
    const data = {
      id: this.id,
      calculationId: this.calculationId,
      eventId: this.eventId,
      type: this.type,
      sourceAccountId: this.sourceAccountId,
      destinationAccount: this.destinationAccount,
      amount: this.amount.toString(),
      currency: this.currency,
      method: this.method,
      status: this.status,
      transactionId: this.transactionId,
      referenceId: this.referenceId,
      createdAt: this.createdAt.toISOString(),
      executedAt: this.executedAt?.toISOString(),
      completedAt: this.completedAt?.toISOString(),
      previousHash: previousHash || this.previousHash,
    };

    const canonical = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  // Method to mark as executed
  markAsExecuted(transactionId: string): void {
    this.status = SettlementStatus.EXECUTED;
    this.transactionId = transactionId;
    this.executedAt = new Date();
    this.errorMessage = null;
    this.version++;
  }

  // Method to mark as completed
  markAsCompleted(): void {
    this.status = SettlementStatus.COMPLETED;
    this.completedAt = new Date();
    this.version++;
  }

  // Method to mark as failed
  markAsFailed(errorMessage: string, retryCount?: number): void {
    this.status = SettlementStatus.FAILED;
    this.errorMessage = errorMessage;
    this.retryCount = retryCount !== undefined ? retryCount : this.retryCount + 1;
    this.version++;
  }

  // Method to mark as cancelled
  markAsCancelled(reason: string): void {
    this.status = SettlementStatus.CANCELLED;
    this.errorMessage = reason;
    this.completedAt = new Date();
    this.version++;
  }

  // Method to mark as reconciled
  markAsReconciled(): void {
    this.status = SettlementStatus.RECONCILED;
    this.completedAt = new Date();
    this.version++;
  }

  // Method to increment retry count
  incrementRetryCount(): void {
    this.retryCount++;
    this.version++;
  }

  // Method to soft delete
  softDelete(): void {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.version++;
  }

  // Method to update status
  updateStatus(newStatus: SettlementStatus): void {
    this.status = newStatus;
    this.version++;
  }
}

// Escrow Account entity
@Entity({ name: 'escrow_accounts', schema: 'liquidacao' })
@Index(['ownerId'])
@Index(['ownerType'])
@Index(['status'])
@Index(['currency'])
export class EscrowAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  ownerId: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  @Index()
  ownerType: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 3, nullable: false, default: 'BRL' })
  @Index()
  currency: Currency;

  // Store balance as decimal for precision
  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false, default: 0 })
  balance: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false, default: 0 })
  availableBalance: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false, default: 0 })
  reservedBalance: number;

  @Column({ type: 'varchar', length: 50, nullable: false, default: 'ACTIVE' })
  @Index()
  status: string; // ACTIVE, FROZEN, CLOSED

  @Column({ type: 'boolean', nullable: false, default: false })
  @Index()
  isFrozen: boolean;

  @Column({ type: 'boolean', nullable: false, default: false })
  @Index()
  isClosed: boolean;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;

  // External account ID in LOWDATAESC
  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  externalId: string;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // Version for optimistic locking
  @Column({ type: 'integer', nullable: false, default: 1 })
  @Index()
  version: number;

  // Soft delete
  @Column({ type: 'boolean', nullable: false, default: false })
  isDeleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;

  constructor(partial: Partial<EscrowAccount> = {}) {
    Object.assign(this, partial);
    
    if (!this.status) {
      this.status = 'ACTIVE';
    }
    if (!this.currency) {
      this.currency = 'BRL';
    }
    if (!this.balance) {
      this.balance = 0;
    }
    if (!this.availableBalance) {
      this.availableBalance = 0;
    }
    if (!this.reservedBalance) {
      this.reservedBalance = 0;
    }
    if (!this.version) {
      this.version = 1;
    }
    if (!this.isDeleted) {
      this.isDeleted = false;
    }
    if (!this.isFrozen) {
      this.isFrozen = false;
    }
    if (!this.isClosed) {
      this.isClosed = false;
    }
  }

  // Method to deposit funds
  deposit(amount: number): void {
    this.balance += amount;
    this.availableBalance += amount;
    this.updatedAt = new Date();
    this.version++;
  }

  // Method to withdraw funds
  withdraw(amount: number): boolean {
    if (this.availableBalance >= amount) {
      this.balance -= amount;
      this.availableBalance -= amount;
      this.updatedAt = new Date();
      this.version++;
      return true;
    }
    return false;
  }

  // Method to reserve funds
  reserve(amount: number): boolean {
    if (this.availableBalance >= amount) {
      this.availableBalance -= amount;
      this.reservedBalance += amount;
      this.updatedAt = new Date();
      this.version++;
      return true;
    }
    return false;
  }

  // Method to release reserved funds
  releaseReservation(amount: number): void {
    if (this.reservedBalance >= amount) {
      this.reservedBalance -= amount;
      this.availableBalance += amount;
      this.updatedAt = new Date();
      this.version++;
    }
  }

  // Method to freeze account
  freeze(reason: string): void {
    this.isFrozen = true;
    this.status = 'FROZEN';
    this.updatedAt = new Date();
    this.version++;
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata.frozenReason = reason;
    this.metadata.frozenAt = new Date().toISOString();
  }

  // Method to unfreeze account
  unfreeze(reason: string): void {
    this.isFrozen = false;
    this.status = 'ACTIVE';
    this.updatedAt = new Date();
    this.version++;
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata.unfrozenReason = reason;
    this.metadata.unfrozenAt = new Date().toISOString();
  }

  // Method to close account
  close(reason: string): void {
    this.isClosed = true;
    this.status = 'CLOSED';
    this.updatedAt = new Date();
    this.version++;
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata.closedReason = reason;
    this.metadata.closedAt = new Date().toISOString();
  }

  // Method to soft delete
  softDelete(): void {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.version++;
  }
}

// Transaction entity
@Entity({ name: 'transactions', schema: 'liquidacao' })
@Index(['accountId'])
@Index(['transactionId'])
@Index(['type'])
@Index(['status'])
@Index(['createdAt'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  accountId: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  @Index()
  transactionId: string; // External transaction ID from LOWDATAESC

  @Column({ type: 'varchar', length: 50, nullable: false })
  @Index()
  type: string; // DEPOSIT, WITHDRAWAL, TRANSFER

  @Column({ type: 'varchar', length: 10, nullable: false })
  @Index()
  direction: string; // IN, OUT

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  amount: number;

  @Column({ type: 'varchar', length: 3, nullable: false, default: 'BRL' })
  currency: Currency;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  balanceAfter: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  referenceId: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50, nullable: false, default: 'PENDING' })
  @Index()
  status: string; // PENDING, COMPLETED, FAILED

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;

  // Related settlement instruction ID
  @Column({ type: 'uuid', nullable: true })
  @Index()
  settlementInstructionId: string;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // Version for optimistic locking
  @Column({ type: 'integer', nullable: false, default: 1 })
  version: number;

  constructor(partial: Partial<Transaction> = {}) {
    Object.assign(this, partial);
    
    if (!this.currency) {
      this.currency = 'BRL';
    }
    if (!this.status) {
      this.status = 'PENDING';
    }
    if (!this.version) {
      this.version = 1;
    }
  }

  // Method to mark as completed
  markAsCompleted(): void {
    this.status = 'COMPLETED';
    this.updatedAt = new Date();
    this.version++;
  }

  // Method to mark as failed
  markAsFailed(errorMessage: string): void {
    this.status = 'FAILED';
    this.updatedAt = new Date();
    this.version++;
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata.errorMessage = errorMessage;
  }
}

// Reconciliation entity
@Entity({ name: 'reconciliations', schema: 'liquidacao' })
@Index(['settlementInstructionId'])
@Index(['transactionId'])
@Index(['status'])
@Index(['reconciledAt'])
export class Reconciliation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  settlementInstructionId: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  @Index()
  transactionId: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  expectedAmount: number;

  @Column({ type: 'varchar', length: 3, nullable: false, default: 'BRL' })
  expectedCurrency: Currency;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  actualAmount: number;

  @Column({ type: 'varchar', length: 3, nullable: false, default: 'BRL' })
  actualCurrency: Currency;

  @Column({ type: 'boolean', nullable: false, default: false })
  @Index()
  isReconciled: boolean;

  @Column({ type: 'text', nullable: true })
  discrepancyReason: string;

  @Column({ type: 'varchar', length: 50, nullable: false, default: 'PENDING' })
  @Index()
  status: string; // PENDING, RECONCILED, DISCREPANCY

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  @Index()
  reconciledAt: Date;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // Version for optimistic locking
  @Column({ type: 'integer', nullable: false, default: 1 })
  version: number;

  constructor(partial: Partial<Reconciliation> = {}) {
    Object.assign(this, partial);
    
    if (!this.expectedCurrency) {
      this.expectedCurrency = 'BRL';
    }
    if (!this.actualCurrency) {
      this.actualCurrency = 'BRL';
    }
    if (!this.status) {
      this.status = 'PENDING';
    }
    if (!this.version) {
      this.version = 1;
    }
  }

  // Method to mark as reconciled
  markAsReconciled(): void {
    this.isReconciled = true;
    this.status = 'RECONCILED';
    this.reconciledAt = new Date();
    this.version++;
  }

  // Method to mark as discrepancy
  markAsDiscrepancy(reason: string): void {
    this.isReconciled = false;
    this.status = 'DISCREPANCY';
    this.discrepancyReason = reason;
    this.reconciledAt = new Date();
    this.version++;
  }
}
