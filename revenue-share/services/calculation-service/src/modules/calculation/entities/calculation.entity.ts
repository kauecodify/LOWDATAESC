import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn, OneToMany, RelationId } from 'typeorm';
import { CalculationType, CalculationStatus, Currency, RoundingMethod } from '../dto/create-calculation.dto';

@Entity({ name: 'calculations', schema: 'calculation' })
@Index(['eventId'])
@Index(['distributionRuleId'])
@Index(['type'])
@Index(['status'])
@Index(['calculatedAt'])
@Index(['calculationHash'], { unique: true })
export class Calculation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Reference to the event that triggered this calculation
  @Column({ type: 'uuid', nullable: false })
  eventId: string;

  // Reference to the distribution rule used
  @Column({ type: 'uuid', nullable: false })
  distributionRuleId: string;

  // Type of calculation
  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: CalculationType.REVENUE_SHARE,
  })
  @Index()
  type: CalculationType;

  // Status of the calculation
  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    default: CalculationStatus.PENDING,
  })
  status: CalculationStatus;

  // Input data as JSON
  @Column({ type: 'jsonb', nullable: false })
  input: {
    grossAmount: number;
    currency: Currency;
    netAmount?: number;
    deductions?: any[];
    conversionRate?: number;
  };

  // Results as JSON
  @Column({ type: 'jsonb', nullable: true })
  results: {
    participantId: string;
    participantName: string;
    participantType: string;
    amount: number;
    currency: Currency;
    percentage: number;
    fixedAmount?: number;
  }[];

  // Summary data
  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  grossAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  netAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false, default: 0 })
  totalDeductions: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false, default: 0 })
  totalAmount: number;

  // Currency
  @Column({ type: 'varchar', length: 3, nullable: false, default: 'BRL' })
  currency: Currency;

  // Rounding method used
  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    default: RoundingMethod.BANKER,
  })
  roundingMethod: RoundingMethod;

  // Hash chain for audit
  @Column({ type: 'varchar', length: 64, nullable: true })
  @Index()
  calculationHash: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  previousHash: string;

  // Error tracking
  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'integer', nullable: false, default: 0 })
  retryCount: number;

  @Column({ type: 'integer', nullable: true })
  maxRetries: number;

  // Timestamps
  @Column({ type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP' })
  calculatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;

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

  // Parent calculation for corrections/recalculations
  @Column({ type: 'uuid', nullable: true })
  parentCalculationId: string;

  // Correlation ID for tracing
  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  correlationId: string;

  // Source of the calculation request
  @Column({ type: 'varchar', length: 100, nullable: true })
  source: string;

  // Priority
  @Column({ type: 'integer', nullable: true, default: 0 })
  priority: number;

  // Constructor for easy initialization
  constructor(partial: Partial<Calculation> = {}) {
    Object.assign(this, partial);
    
    // Set defaults
    if (!this.status) {
      this.status = CalculationStatus.PENDING;
    }
    if (!this.type) {
      this.type = CalculationType.REVENUE_SHARE;
    }
    if (!this.currency) {
      this.currency = 'BRL';
    }
    if (!this.roundingMethod) {
      this.roundingMethod = RoundingMethod.BANKER;
    }
    if (!this.retryCount) {
      this.retryCount = 0;
    }
    if (!this.totalDeductions) {
      this.totalDeductions = 0;
    }
    if (!this.totalAmount) {
      this.totalAmount = 0;
    }
    if (!this.version) {
      this.version = 1;
    }
    if (!this.isDeleted) {
      this.isDeleted = false;
    }
    if (!this.calculatedAt) {
      this.calculatedAt = new Date();
    }
    if (!this.priority) {
      this.priority = 0;
    }
  }

  // Method to calculate hash
  calculateHash(previousHash?: string): string {
    const crypto = require('crypto');
    
    const data = {
      id: this.id,
      eventId: this.eventId,
      distributionRuleId: this.distributionRuleId,
      type: this.type,
      grossAmount: this.grossAmount.toString(),
      netAmount: this.netAmount.toString(),
      totalDeductions: this.totalDeductions.toString(),
      totalAmount: this.totalAmount.toString(),
      currency: this.currency,
      roundingMethod: this.roundingMethod,
      calculatedAt: this.calculatedAt.toISOString(),
      results: this.results,
      input: this.input,
      previousHash: previousHash || this.previousHash,
    };

    const canonical = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  // Method to mark as completed
  markAsCompleted(results: any[]): void {
    this.status = CalculationStatus.COMPLETED;
    this.results = results;
    this.completedAt = new Date();
    this.errorMessage = null;
    this.version++;
  }

  // Method to mark as failed
  markAsFailed(errorMessage: string, retryCount?: number): void {
    this.status = CalculationStatus.FAILED;
    this.errorMessage = errorMessage;
    this.retryCount = retryCount !== undefined ? retryCount : this.retryCount + 1;
    this.version++;
  }

  // Method to mark as processing
  markAsProcessing(): void {
    this.status = CalculationStatus.PROCESSING;
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
}

// Calculation Result entity (for normalized storage)
@Entity({ name: 'calculation_results', schema: 'calculation' })
@Index(['calculationId'])
@Index(['participantId'])
export class CalculationResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  calculationId: string;

  @RelationId((calculation: CalculationResult) => calculation.calculation)
  calculation: Calculation;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  participantId: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  participantName: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  participantType: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  amount: number;

  @Column({ type: 'varchar', length: 3, nullable: false, default: 'BRL' })
  currency: Currency;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: false })
  percentage: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: true })
  fixedAmount: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;

  constructor(partial: Partial<CalculationResult> = {}) {
    Object.assign(this, partial);
  }
}

// Distribution Rule entity
@Entity({ name: 'distribution_rules', schema: 'calculation' })
@Index(['name'])
@Index(['isActive'])
@Index(['priority'])
export class DistributionRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  @Index({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Participants as JSON
  @Column({ type: 'jsonb', nullable: false })
  participants: {
    id: string;
    name: string;
    type: string;
    percentage: number;
    fixedAmount?: number;
    priority?: number;
    floor?: number;
    ceiling?: number;
    isActive?: boolean;
    eligibility?: Record<string, any>;
  }[];

  // Conditions as JSON (DSL)
  @Column({ type: 'jsonb', nullable: true })
  conditions: Record<string, any>;

  @Column({ type: 'integer', nullable: true, default: 0 })
  priority: number;

  @Column({ type: 'boolean', nullable: false, default: true })
  @Index()
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updatedBy: string;

  @Column({ type: 'integer', nullable: false, default: 1 })
  @Index()
  version: number;

  constructor(partial: Partial<DistributionRule> = {}) {
    Object.assign(this, partial);
    if (!this.isActive) {
      this.isActive = true;
    }
    if (!this.priority) {
      this.priority = 0;
    }
    if (!this.version) {
      this.version = 1;
    }
    if (!this.participants) {
      this.participants = [];
    }
  }
}
