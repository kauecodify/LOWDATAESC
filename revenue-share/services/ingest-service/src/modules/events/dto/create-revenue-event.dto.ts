import { IsString, IsNumber, IsEnum, IsDateString, IsOptional, IsUUID, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Event types
const RevenueEventType = {
  SALE: 'SALE',
  REFUND: 'REFUND',
  CHARGEBACK: 'CHARGEBACK',
  FEE: 'FEE',
  ADJUSTMENT: 'ADJUSTMENT',
  DISPUTE: 'DISPUTE',
} as const;

type RevenueEventType = typeof RevenueEventType[keyof typeof RevenueEventType];

// Currency types
const Currency = {
  BRL: 'BRL',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  JPY: 'JPY',
  CAD: 'CAD',
  AUD: 'AUD',
  CHF: 'CHF',
  CNY: 'CNY',
} as const;

type Currency = typeof Currency[keyof typeof Currency];

// Event status
const RevenueEventStatus = {
  PENDING: 'PENDING',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
  REPROCESSING: 'REPROCESSING',
} as const;

type RevenueEventStatus = typeof RevenueEventStatus[keyof typeof RevenueEventStatus];

// Deduction types
const DeductionType = {
  TAX: 'TAX',
  FEE: 'FEE',
  COMMISSION: 'COMMISSION',
  CHARGEBACK: 'CHARGEBACK',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

type DeductionType = typeof DeductionType[keyof typeof DeductionType];

export class DeductionDto {
  @ApiProperty({ enum: DeductionType })
  @IsEnum(DeductionType)
  type: DeductionType;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  amount: number;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceId?: string;
}

export class RevenueEventMetadata {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  merchantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class CreateRevenueEventDto {
  @ApiProperty({ description: 'Unique identifier for the event', example: 'evt_20241102_001' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ enum: RevenueEventType, description: 'Type of revenue event' })
  @IsEnum(RevenueEventType)
  type: RevenueEventType;

  @ApiProperty({ description: 'Gross revenue amount', example: 1000.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  grossAmount: number;

  @ApiProperty({ enum: Currency, description: 'Currency of the amount', example: 'BRL' })
  @IsEnum(Currency)
  currency: Currency;

  @ApiPropertyOptional({ description: 'Net revenue amount after deductions' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  netAmount?: number;

  @ApiProperty({ description: 'ISO 8601 timestamp of the event', example: '2024-11-02T10:00:00Z' })
  @IsDateString()
  timestamp: string;

  @ApiPropertyOptional({ description: 'Deductions applied to the gross amount' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DeductionDto)
  @IsArray()
  deductions?: DeductionDto[];

  @ApiPropertyOptional({ description: 'Metadata associated with the event' })
  @IsOptional()
  @ValidateNested()
  @Type(() => RevenueEventMetadata)
  metadata?: RevenueEventMetadata;

  @ApiPropertyOptional({ description: 'Idempotency key for duplicate prevention' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Source system that generated the event' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'Version of the event schema' })
  @IsOptional()
  @IsString()
  schemaVersion?: string;
}

export {
  RevenueEventType,
  Currency,
  RevenueEventStatus,
  DeductionType,
};
