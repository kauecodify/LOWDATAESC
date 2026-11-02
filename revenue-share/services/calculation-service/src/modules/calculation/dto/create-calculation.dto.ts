import { IsString, IsNumber, IsEnum, IsDateString, IsOptional, IsUUID, ValidateNested, IsArray, IsBoolean, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Calculation types
export const CalculationType = {
  REVENUE_SHARE: 'REVENUE_SHARE',
  COMMISSION: 'COMMISSION',
  FEE_DISTRIBUTION: 'FEE_DISTRIBUTION',
  TAX_CALCULATION: 'TAX_CALCULATION',
  NET_REVENUE: 'NET_REVENUE',
  DEDUCTION: 'DEDUCTION',
} as const;

type CalculationType = typeof CalculationType[keyof typeof CalculationType];

// Calculation status
export const CalculationStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REPROCESSING: 'REPROCESSING',
  CANCELLED: 'CANCELLED',
} as const;

type CalculationStatus = typeof CalculationStatus[keyof typeof CalculationStatus];

// Currency types
export const Currency = {
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

// Rounding methods
export const RoundingMethod = {
  BANKER: 'BANKER',
  UP: 'UP',
  DOWN: 'DOWN',
  CEIL: 'CEIL',
  FLOOR: 'FLOOR',
  HALF_UP: 'HALF_UP',
  HALF_DOWN: 'HALF_DOWN',
} as const;

type RoundingMethod = typeof RoundingMethod[keyof typeof RoundingMethod];

// Participant types
export const ParticipantType = {
  OPERATION: 'OPERATION',
  FOUNDER: 'FOUNDER',
  INVESTOR: 'INVESTOR',
  PARTNER: 'PARTNER',
  EMPLOYEE: 'EMPLOYEE',
  VENDOR: 'VENDOR',
} as const;

type ParticipantType = typeof ParticipantType[keyof typeof ParticipantType];

// Participant DTO
export class ParticipantDto {
  @ApiProperty({ description: 'Unique identifier for the participant', example: 'part_001' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Name of the participant', example: 'Operation Alpha' })
  @IsString()
  name: string;

  @ApiProperty({ enum: ParticipantType, description: 'Type of participant' })
  @IsEnum(ParticipantType)
  type: ParticipantType;

  @ApiProperty({ description: 'Percentage share', example: 33.33 })
  @IsNumber({ min: 0, max: 100 })
  percentage: number;

  @ApiPropertyOptional({ description: 'Fixed amount if applicable' })
  @IsOptional()
  @IsNumber({ min: 0 })
  fixedAmount?: number;

  @ApiPropertyOptional({ description: 'Priority order for distribution' })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiPropertyOptional({ description: 'Minimum amount (floor)' })
  @IsOptional()
  @IsNumber({ min: 0 })
  floor?: number;

  @ApiPropertyOptional({ description: 'Maximum amount (ceiling)' })
  @IsOptional()
  @IsNumber({ min: 0 })
  ceiling?: number;

  @ApiPropertyOptional({ description: 'Whether participant is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Eligibility conditions' })
  @IsOptional()
  @IsObject()
  eligibility?: Record<string, any>;
}

// Deduction DTO
export class DeductionDto {
  @ApiProperty({ description: 'Type of deduction', example: 'TAX' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Amount to deduct', example: 100.0 })
  @IsNumber({ min: 0 })
  amount: number;

  @ApiProperty({ description: 'Currency of the deduction', example: 'BRL' })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ description: 'Description of the deduction', example: 'Income tax withholding' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ description: 'Percentage if applicable' })
  @IsOptional()
  @IsNumber({ min: 0, max: 100 })
  percentage?: number;

  @ApiPropertyOptional({ description: 'Base amount for percentage calculation' })
  @IsOptional()
  @IsNumber({ min: 0 })
  baseAmount?: number;

  @ApiPropertyOptional({ description: 'Reference ID for the deduction' })
  @IsOptional()
  @IsString()
  referenceId?: string;
}

// Distribution Rule DTO
export class DistributionRuleDto {
  @ApiProperty({ description: 'Unique identifier for the rule', example: 'rule_001' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Name of the rule', example: 'Founder Distribution' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Description of the rule' })
  @IsString()
  description: string;

  @ApiProperty({ type: [ParticipantDto], description: 'Participants in this rule' })
  @ValidateNested({ each: true })
  @Type(() => ParticipantDto)
  @IsArray()
  participants: ParticipantDto[];

  @ApiPropertyOptional({ description: 'Conditions for applying this rule' })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Priority of this rule' })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiPropertyOptional({ description: 'Start date for this rule' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for this rule' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Whether rule is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Calculation Input DTO
export class CalculationInputDto {
  @ApiProperty({ description: 'Gross amount for calculation', example: 10000.0 })
  @IsNumber({ min: 0 })
  grossAmount: number;

  @ApiProperty({ enum: Currency, description: 'Currency of the amount', example: 'BRL' })
  @IsEnum(Currency)
  currency: Currency;

  @ApiPropertyOptional({ description: 'Net amount if already calculated' })
  @IsOptional()
  @IsNumber({ min: 0 })
  netAmount?: number;

  @ApiPropertyOptional({ type: [DeductionDto], description: 'Deductions to apply' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DeductionDto)
  @IsArray()
  deductions?: DeductionDto[];

  @ApiPropertyOptional({ description: 'Conversion rate to base currency' })
  @IsOptional()
  @IsNumber({ min: 0 })
  conversionRate?: number;
}

// Calculation Result DTO
export class CalculationResultDto {
  @ApiProperty({ description: 'Participant ID', example: 'part_001' })
  @IsString()
  participantId: string;

  @ApiProperty({ description: 'Participant name', example: 'Operation Alpha' })
  @IsString()
  participantName: string;

  @ApiProperty({ description: 'Participant type', example: 'FOUNDER' })
  @IsEnum(ParticipantType)
  participantType: ParticipantType;

  @ApiProperty({ description: 'Calculated amount', example: 3333.33 })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Currency of the amount', example: 'BRL' })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ description: 'Percentage applied', example: 33.33 })
  @IsNumber({ min: 0, max: 100 })
  percentage: number;

  @ApiPropertyOptional({ description: 'Fixed amount if applicable' })
  @IsOptional()
  @IsNumber()
  fixedAmount?: number;
}

// Create Calculation DTO
export class CreateCalculationDto {
  @ApiProperty({ description: 'Unique identifier for the calculation', example: 'calc_20241102_001' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ enum: CalculationType, description: 'Type of calculation' })
  @IsEnum(CalculationType)
  type: CalculationType;

  @ApiProperty({ description: 'Reference to the event that triggered this calculation', example: 'evt_20241102_001' })
  @IsString()
  eventId: string;

  @ApiProperty({ description: 'Reference to the distribution rule', example: 'rule_001' })
  @IsString()
  distributionRuleId: string;

  @ApiProperty({ description: 'Calculation input data' })
  @ValidateNested()
  @Type(() => CalculationInputDto)
  input: CalculationInputDto;

  @ApiProperty({ description: 'Rounding method to use', example: 'BANKER' })
  @IsEnum(RoundingMethod)
  roundingMethod: RoundingMethod;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Idempotency key for duplicate prevention' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

// Calculation Response DTO
export class CalculationResponseDto {
  @ApiProperty({ description: 'Unique identifier for the calculation' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Reference to the event' })
  @IsString()
  eventId: string;

  @ApiProperty({ enum: CalculationType, description: 'Type of calculation' })
  @IsEnum(CalculationType)
  type: CalculationType;

  @ApiProperty({ enum: CalculationStatus, description: 'Status of the calculation' })
  @IsEnum(CalculationStatus)
  status: CalculationStatus;

  @ApiProperty({ type: [CalculationResultDto], description: 'Results of the calculation' })
  @ValidateNested({ each: true })
  @Type(() => CalculationResultDto)
  @IsArray()
  results: CalculationResultDto[];

  @ApiProperty({ description: 'Total calculated amount', example: 10000.0 })
  @IsNumber()
  totalAmount: number;

  @ApiProperty({ description: 'Currency of the total amount', example: 'BRL' })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ description: 'Gross amount used', example: 10000.0 })
  @IsNumber()
  grossAmount: number;

  @ApiProperty({ description: 'Net amount after deductions', example: 8000.0 })
  @IsNumber()
  netAmount: number;

  @ApiProperty({ description: 'Total deductions', example: 2000.0 })
  @IsNumber()
  totalDeductions: number;

  @ApiProperty({ description: 'Timestamp of calculation', example: '2024-11-02T10:00:00Z' })
  @IsDateString()
  calculatedAt: string;

  @ApiPropertyOptional({ description: 'Error message if calculation failed' })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Hash of the calculation for audit' })
  @IsOptional()
  @IsString()
  calculationHash?: string;

  @ApiPropertyOptional({ description: 'Previous calculation hash for chain' })
  @IsOptional()
  @IsString()
  previousHash?: string;

  @ApiPropertyOptional({ description: 'Metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

// Export all types
export {
  CalculationType,
  CalculationStatus,
  Currency,
  RoundingMethod,
  ParticipantType,
};
