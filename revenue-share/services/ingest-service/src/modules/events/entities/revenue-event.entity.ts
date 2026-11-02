import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, VersionColumn } from 'typeorm';
import { RevenueEventType, Currency, RevenueEventStatus } from '../dto/create-revenue-event.dto';

@Entity({ name: 'revenue_events' })
@Index(['id'], { unique: true })
@Index(['eventId'], { unique: true })
@Index(['idempotencyKey'], { unique: true, where: 'idempotency_key IS NOT NULL' })
@Index(['type'])
@Index(['status'])
@Index(['timestamp'])
@Index(['merchantId'])
@Index(['correlationId'])
export class RevenueEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', unique: true, nullable: false })
  @Index({ unique: true })
  eventId: string;

  @Column({ type: 'enum', enum: RevenueEventType, nullable: false })
  type: RevenueEventType;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: false })
  grossAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  netAmount: number;

  @Column({ type: 'enum', enum: Currency, nullable: false })
  currency: Currency;

  @Column({ type: 'enum', enum: RevenueEventStatus, default: RevenueEventStatus.PENDING })
  status: RevenueEventStatus;

  @Column({ type: 'timestamp', nullable: false })
  @Index()
  timestamp: Date;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @CreateDateColumn()
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt?: Date;

  @Column({ name: 'idempotency_key', nullable: true, length: 255 })
  @Index({ unique: true, where: 'idempotency_key IS NOT NULL' })
  idempotencyKey?: string;

  @Column({ name: 'source', length: 100, nullable: true })
  source?: string;

  @Column({ name: 'schema_version', length: 20, nullable: true, default: '1.0' })
  schemaVersion?: string;

  @Column({ name: 'merchant_id', length: 100, nullable: true })
  @Index()
  merchantId?: string;

  @Column({ name: 'customer_id', length: 100, nullable: true })
  customerId?: string;

  @Column({ name: 'product_id', length: 100, nullable: true })
  productId?: string;

  @Column({ name: 'transaction_id', length: 100, nullable: true })
  transactionId?: string;

  @Column({ name: 'external_id', length: 100, nullable: true })
  externalId?: string;

  @Column({ name: 'correlation_id', length: 100, nullable: true })
  @Index()
  correlationId?: string;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', length: 500, nullable: true })
  userAgent?: string;

  @Column({ name: 'deductions', type: 'jsonb', nullable: true })
  deductions?: any[];

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ name: 'error_message', length: 1000, nullable: true })
  errorMessage?: string;

  @Column({ name: 'error_stack', type: 'text', nullable: true })
  errorStack?: string;

  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount: number;

  @VersionColumn({ name: 'version', type: 'integer', default: 1 })
  version: number;

  // Hash for audit trail
  @Column({ name: 'event_hash', length: 64, nullable: true })
  @Index()
  eventHash?: string;

  // Previous hash for chain
  @Column({ name: 'previous_hash', length: 64, nullable: true })
  previousHash?: string;
}
