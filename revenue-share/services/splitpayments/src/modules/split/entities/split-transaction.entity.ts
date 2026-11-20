import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn, OneToMany, RelationId } from 'typeorm';
import { PaymentStatus, PaymentMethod, TaxType, TransactionType, Currency } from '../dto/create-split-transaction.dto';

@Entity({ name: 'split_transactions', schema: 'split_payments' })
@Index(['consortiumId'])
@Index(['paymentId'])
@Index(['transactionId'])
@Index(['status'])
@Index(['method'])
@Index(['splitHash'], { unique: true })
@Index(['referenceId'])
@Index(['createdAt'])
export class SplitTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Consortium/tenant reference (multi-tenant)
  @Column({ type: 'uuid', nullable: false })
  @Index()
  consortiumId: string;

  // Reference to the original payment
  @Column({ type: 'uuid', nullable: false })
  @Index()
  paymentId: string;

  // Transaction type
  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: TransactionType.PAYMENT,
  })
  @Index()
  transactionType: TransactionType;

  // Payment method
  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
  })
  @Index()
  method: PaymentMethod;

  // Status
  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    default: PaymentStatus.PENDING,
  })
  @Index()
  status: PaymentStatus;

  // Original amount (before tax split)
  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  originalAmount: number;

  // Currency
  @Column({ type: 'varchar', length: 3, nullable: false, default: 'BRL' })
  currency: Currency;

  // Tax information
  @Column({ type: 'jsonb', nullable: false })
  taxInfo: {
    cbs: {
      rate: number; // Percentage (e.g., 0.01 for 1%)
      amount: number; // Calculated amount
      accountId: string; // Account to receive CBS
    };
    ibs: {
      rate: number; // Percentage (e.g., 0.02 for 2%)
      amount: number; // Calculated amount
      accountId: string; // Account to receive IBS
    };
    totalTaxRate: number;
    totalTaxAmount: number;
  };

  // Split amounts
  @Column({ type: 'jsonb', nullable: false })
  splitAmounts: {
    supplier: {
      amount: number;
      accountId: string;
      accountType: string;
      bankDetails?: {
        bankCode: string;
        agency: string;
        accountNumber: string;
        accountDigit?: string;
        accountType: string;
        documentNumber: string;
        documentType: string;
        holderName: string;
      };
      pixDetails?: {
        keyType: string;
        keyValue: string;
        holderName: string;
        documentNumber: string;
      };
    };
    cbs: {
      amount: number;
      accountId: string;
      accountType: string;
    };
    ibs: {
      amount: number;
      accountId: string;
      accountType: string;
    };
  };

  // Gateway information
  @Column({ type: 'jsonb', nullable: true })
  gatewayInfo?: {
    gateway: string; // 'bacen', 'iugu', 'asaas', 'efi'
    transactionId: string;
    splitTransactionId?: string;
    status: string;
    response?: any;
    error?: string;
  };

  // LOWDATAESC transaction ID
  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  transactionId: string;

  // Reference ID (for external systems)
  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  referenceId: string;

  // Unique hash for idempotency
  @Column({ type: 'varchar', length: 512, nullable: false, unique: true })
  @Index()
  splitHash: string;

  // SPED information
  @Column({ type: 'jsonb', nullable: true })
  spedInfo?: {
    fileId: string;
    batchId: string;
    status: string;
    generatedAt?: Date;
    sentAt?: Date;
    response?: any;
  };

  // Webhook information
  @Column({ type: 'jsonb', nullable: true })
  webhookInfo?: {
    receitaFederal: {
      sent: boolean;
      sentAt?: Date;
      response?: any;
      error?: string;
    };
    internal: {
      sent: boolean;
      sentAt?: Date;
      response?: any;
      error?: string;
    };
  };

  // Escrow information (for fallback)
  @Column({ type: 'jsonb', nullable: true })
  escrowInfo?: {
    accountId: string;
    amount: number;
    retainedAt: Date;
    status: string;
    releaseAttempts: number;
    lastReleaseAttempt?: Date;
  };

  // Error information
  @Column({ type: 'jsonb', nullable: true })
  errorInfo?: {
    code: string;
    message: string;
    details: any;
    timestamp: Date;
  };

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  // Timestamps
  @CreateDateColumn({ type: 'timestamp with time zone', nullable: false })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', nullable: false })
  updatedAt: Date;

  // Audit fields
  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updatedBy: string;

  // IP address for audit
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  // User agent for audit
  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string;
}

// Escrow Account entity for split payment fallback
@Entity({ name: 'split_escrow_accounts', schema: 'split_payments' })
@Index(['consortiumId'])
@Index(['accountNumber'])
export class SplitEscrowAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  consortiumId: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  @Index()
  accountNumber: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  accountType: string; // 'ESCROW', 'BANK', 'WALLET'

  @Column({ type: 'jsonb', nullable: false })
  accountDetails: {
    bankCode?: string;
    agency?: string;
    accountNumber: string;
    accountDigit?: string;
    accountType: string;
    documentNumber?: string;
    documentType?: string;
    holderName?: string;
    pixKey?: string;
    pixKeyType?: string;
  };

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false, default: 0 })
  balance: number;

  @Column({ type: 'varchar', length: 3, nullable: false, default: 'BRL' })
  currency: Currency;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone', nullable: false })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', nullable: false })
  updatedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updatedBy: string;
}

// Tax Rate Cache entity
@Entity({ name: 'tax_rate_cache', schema: 'split_payments' })
@Index(['taxType'])
@Index(['stateCode'])
@Index(['validFrom'])
@Index(['validTo'])
export class TaxRateCache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  @Index()
  taxType: TaxType; // 'CBS', 'IBS'

  @Column({ type: 'varchar', length: 2, nullable: true })
  @Index()
  stateCode?: string; // For IBS (state/municipal)

  @Column({ type: 'varchar', length: 100, nullable: true })
  municipalityCode?: string; // For municipal IBS

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: false })
  rate: number; // Percentage (e.g., 0.01 for 1%)

  @Column({ type: 'timestamp with time zone', nullable: false })
  @Index()
  validFrom: Date;

  @Column({ type: 'timestamp with time zone', nullable: false })
  @Index()
  validTo: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  source: string; // 'BACEN', 'Receita Federal', etc.

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference: string; // Law, decree, etc.

  @CreateDateColumn({ type: 'timestamp with time zone', nullable: false })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', nullable: false })
  updatedAt: Date;
}

// Audit Log entity
@Entity({ name: 'split_audit_logs', schema: 'split_payments' })
@Index(['transactionId'])
@Index(['action'])
@Index(['createdAt'])
@Index(['createdBy'])
export class SplitAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  transactionId?: string;

  @Column({ type: 'uuid', nullable: true })
  consortiumId?: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  @Index()
  action: string; // 'PAYMENT_INITIATED', 'SPLIT_CALCULATED', 'TAX_CONSULTED', etc.

  @Column({ type: 'jsonb', nullable: true })
  beforeData?: any;

  @Column({ type: 'jsonb', nullable: true })
  afterData?: any;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  errorMessage?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  createdBy: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string;

  @CreateDateColumn({ type: 'timestamp with time zone', nullable: false })
  @Index()
  createdAt: Date;
}
