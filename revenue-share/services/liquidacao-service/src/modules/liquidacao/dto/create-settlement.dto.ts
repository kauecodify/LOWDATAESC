import { IsString, IsNumber, IsEnum, IsDateString, IsOptional, IsUUID, ValidateNested, IsArray, IsBoolean, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Settlement status
export const SettlementStatus = {
  PENDING: 'PENDING',
  SCHEDULED: 'SCHEDULED',
  PROCESSING: 'PROCESSING',
  EXECUTED: 'EXECUTED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  RECONCILED: 'RECONCILED',
  DISPUTED: 'DISPUTED',
} as const;

type SettlementStatus = typeof SettlementStatus[keyof typeof SettlementStatus];

// Settlement method
export const SettlementMethod = {
  PIX: 'PIX',
  TED: 'TED',
  DOC: 'DOC',
  BOLETO: 'BOLETO',
  CREDIT_CARD: 'CREDIT_CARD',
  DEBIT_CARD: 'DEBIT_CARD',
  INTERNATIONAL_WIRE: 'INTERNATIONAL_WIRE',
  SWIFT: 'SWIFT',
} as const;

type SettlementMethod = typeof SettlementMethod[keyof typeof SettlementMethod];

// Settlement type
export const SettlementType = {
  REVENUE_SHARE: 'REVENUE_SHARE',
  COMMISSION: 'COMMISSION',
  FEE: 'FEE',
  REFUND: 'REFUND',
  CHARGEBACK: 'CHARGEBACK',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

type SettlementType = typeof SettlementType[keyof typeof SettlementType];

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

// Account types
export const AccountType = {
  ESCROW: 'ESCROW',
  BANK: 'BANK',
  WALLET: 'WALLET',
  CRYPTO: 'CRYPTO',
} as const;

type AccountType = typeof AccountType[keyof typeof AccountType];

// Bank account DTO
export class BankAccountDto {
  @ApiProperty({ description: 'Bank code', example: '104' })
  @IsString()
  bankCode: string;

  @ApiProperty({ description: 'Bank agency', example: '0001' })
  @IsString()
  agency: string;

  @ApiProperty({ description: 'Account number', example: '12345678' })
  @IsString()
  accountNumber: string;

  @ApiPropertyOptional({ description: 'Account digit' })
  @IsOptional()
  @IsString()
  accountDigit?: string;

  @ApiProperty({ description: 'Account type', example: 'CORRENTE' })
  @IsString()
  accountType: string; // CORRENTE, POUPANCA

  @ApiProperty({ description: 'Document number (CPF/CNPJ)', example: '12345678901' })
  @IsString()
  documentNumber: string;

  @ApiProperty({ description: 'Document type', example: 'CPF' })
  @IsString()
  documentType: string; // CPF, CNPJ

  @ApiProperty({ description: 'Account holder name', example: 'John Doe' })
  @IsString()
  holderName: string;
}

// PIX account DTO
export class PIXAccountDto {
  @ApiProperty({ description: 'PIX key type', example: 'CPF' })
  @IsString()
  keyType: string; // CPF, CNPJ, PHONE, EMAIL, RANDOM

  @ApiProperty({ description: 'PIX key value', example: '12345678901' })
  @IsString()
  keyValue: string;

  @ApiProperty({ description: 'Account holder name', example: 'John Doe' })
  @IsString()
  holderName: string;

  @ApiProperty({ description: 'Document number', example: '12345678901' })
  @IsString()
  documentNumber: string;
}

// Destination account DTO
export class DestinationAccountDto {
  @ApiProperty({ enum: AccountType, description: 'Type of account' })
  @IsEnum(AccountType)
  accountType: AccountType;

  @ApiPropertyOptional({ description: 'Bank account details' })
  @IsOptional()
  @ValidateNested()
  @Type(() => BankAccountDto)
  bankAccount?: BankAccountDto;

  @ApiPropertyOptional({ description: 'PIX account details' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PIXAccountDto)
  pixAccount?: PIXAccountDto;

  @ApiPropertyOptional({ description: 'Crypto account address' })
  @IsOptional()
  @IsString()
  cryptoAddress?: string;

  @ApiPropertyOptional({ description: 'Crypto network' })
  @IsOptional()
  @IsString()
  cryptoNetwork?: string;

  @ApiPropertyOptional({ description: 'Wallet ID' })
  @IsOptional()
  @IsString()
  walletId?: string;

  @ApiProperty({ description: 'Account ID in external system', example: 'acc_123' })
  @IsString()
  externalId: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

// Money DTO
export class MoneyDto {
  @ApiProperty({ description: 'Amount as string (to avoid precision issues)', example: '1000.50' })
  @IsString()
  amount: string;

  @ApiProperty({ enum: Currency, description: 'Currency code', example: 'BRL' })
  @IsEnum(Currency)
  currency: Currency;
}

// Create Settlement Instruction DTO
export class CreateSettlementInstructionDto {
  @ApiProperty({ description: 'Unique identifier for the settlement instruction', example: 'sett_20241102_001' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ description: 'Reference to the calculation that generated this settlement', example: 'calc_20241102_001' })
  @IsString()
  calculationId: string;

  @ApiProperty({ description: 'Reference to the revenue event', example: 'evt_20241102_001' })
  @IsString()
  eventId: string;

  @ApiProperty({ enum: SettlementType, description: 'Type of settlement' })
  @IsEnum(SettlementType)
  type: SettlementType;

  @ApiProperty({ description: 'Source escrow account ID', example: 'escrow_001' })
  @IsString()
  sourceAccountId: string;

  @ApiProperty({ description: 'Destination account details' })
  @ValidateNested()
  @Type(() => DestinationAccountDto)
  destinationAccount: DestinationAccountDto;

  @ApiProperty({ description: 'Amount to settle' })
  @ValidateNested()
  @Type(() => MoneyDto)
  amount: MoneyDto;

  @ApiProperty({ enum: SettlementMethod, description: 'Settlement method' })
  @IsEnum(SettlementMethod)
  method: SettlementMethod;

  @ApiPropertyOptional({ description: 'Description of the settlement', example: 'Revenue share distribution' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Reference ID for tracking', example: 'ref_123' })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional({ description: 'Scheduled execution date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional({ description: 'Expiry date for the settlement (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Priority (0 = normal, 1 = high, 2 = urgent)' })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiPropertyOptional({ description: 'Callback URL for notifications' })
  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @ApiPropertyOptional({ description: 'Idempotency key for duplicate prevention' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

// Settlement Instruction Response DTO
export class SettlementInstructionResponseDto {
  @ApiProperty({ description: 'Unique identifier for the settlement instruction' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Reference to the calculation' })
  @IsString()
  calculationId: string;

  @ApiProperty({ description: 'Reference to the revenue event' })
  @IsString()
  eventId: string;

  @ApiProperty({ enum: SettlementType, description: 'Type of settlement' })
  @IsEnum(SettlementType)
  type: SettlementType;

  @ApiProperty({ description: 'Source escrow account ID' })
  @IsString()
  sourceAccountId: string;

  @ApiProperty({ description: 'Destination account details' })
  @ValidateNested()
  @Type(() => DestinationAccountDto)
  destinationAccount: DestinationAccountDto;

  @ApiProperty({ description: 'Amount to settle' })
  @ValidateNested()
  @Type(() => MoneyDto)
  amount: MoneyDto;

  @ApiProperty({ enum: SettlementMethod, description: 'Settlement method' })
  @IsEnum(SettlementMethod)
  method: SettlementMethod;

  @ApiProperty({ enum: SettlementStatus, description: 'Current status' })
  @IsEnum(SettlementStatus)
  status: SettlementStatus;

  @ApiPropertyOptional({ description: 'LOWDATAESC transaction ID' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({ description: 'Scheduled execution date' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional({ description: 'Expiry date' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Execution date' })
  @IsOptional()
  @IsDateString()
  executedAt?: string;

  @ApiPropertyOptional({ description: 'Completion date' })
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Retry count' })
  @IsOptional()
  @IsNumber()
  retryCount?: number;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Reference ID' })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional({ description: 'Priority' })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiPropertyOptional({ description: 'Callback URL' })
  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @ApiPropertyOptional({ description: 'Hash for audit trail' })
  @IsOptional()
  @IsString()
  settlementHash?: string;

  @ApiPropertyOptional({ description: 'Previous hash for chain' })
  @IsOptional()
  @IsString()
  previousHash?: string;

  @ApiPropertyOptional({ description: 'Metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Creation timestamp', example: '2024-11-02T10:00:00Z' })
  @IsDateString()
  createdAt: string;

  @ApiProperty({ description: 'Last update timestamp', example: '2024-11-02T10:00:00Z' })
  @IsDateString()
  updatedAt: string;
}

// Execute Settlement DTO
export class ExecuteSettlementDto {
  @ApiProperty({ description: 'Settlement instruction ID to execute', example: 'sett_20241102_001' })
  @IsString()
  instructionId: string;

  @ApiPropertyOptional({ description: 'Force execution even if scheduled date has not arrived' })
  @IsOptional()
  @IsBoolean()
  forceExecute?: boolean;

  @ApiPropertyOptional({ description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

// Execute Settlement Response DTO
export class ExecuteSettlementResponseDto {
  @ApiProperty({ description: 'Settlement instruction ID' })
  @IsString()
  instructionId: string;

  @ApiProperty({ description: 'LOWDATAESC transaction ID' })
  @IsString()
  transactionId: string;

  @ApiProperty({ enum: SettlementStatus, description: 'New status' })
  @IsEnum(SettlementStatus)
  status: SettlementStatus;

  @ApiProperty({ description: 'Execution timestamp', example: '2024-11-02T10:00:00Z' })
  @IsDateString()
  executedAt: string;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

// Cancel Settlement DTO
export class CancelSettlementDto {
  @ApiProperty({ description: 'Settlement instruction ID to cancel', example: 'sett_20241102_001' })
  @IsString()
  instructionId: string;

  @ApiProperty({ description: 'Reason for cancellation', example: 'Duplicate transaction' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

// Cancel Settlement Response DTO
export class CancelSettlementResponseDto {
  @ApiProperty({ description: 'Settlement instruction ID' })
  @IsString()
  instructionId: string;

  @ApiProperty({ enum: SettlementStatus, description: 'New status' })
  @IsEnum(SettlementStatus)
  status: SettlementStatus;

  @ApiProperty({ description: 'Cancellation timestamp', example: '2024-11-02T10:00:00Z' })
  @IsDateString()
  cancelledAt: string;

  @ApiProperty({ description: 'Reason for cancellation' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

// Reconcile Settlement DTO
export class ReconcileSettlementDto {
  @ApiProperty({ description: 'Settlement instruction ID to reconcile', example: 'sett_20241102_001' })
  @IsString()
  instructionId: string;

  @ApiPropertyOptional({ description: 'LOWDATAESC transaction ID' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({ description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

// Reconcile Settlement Response DTO
export class ReconcileSettlementResponseDto {
  @ApiProperty({ description: 'Settlement instruction ID' })
  @IsString()
  instructionId: string;

  @ApiProperty({ description: 'LOWDATAESC transaction ID' })
  @IsString()
  transactionId: string;

  @ApiProperty({ description: 'Whether the settlement is reconciled' })
  @IsBoolean()
  isReconciled: boolean;

  @ApiProperty({ description: 'Expected amount' })
  @ValidateNested()
  @Type(() => MoneyDto)
  expectedAmount: MoneyDto;

  @ApiPropertyOptional({ description: 'Actual amount (if different)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  actualAmount?: MoneyDto;

  @ApiProperty({ enum: SettlementStatus, description: 'Status after reconciliation' })
  @IsEnum(SettlementStatus)
  status: SettlementStatus;

  @ApiProperty({ description: 'Reconciliation timestamp', example: '2024-11-02T10:00:00Z' })
  @IsDateString()
  reconciledAt: string;

  @ApiPropertyOptional({ description: 'Discrepancy reason' })
  @IsOptional()
  @IsString()
  discrepancyReason?: string;

  @ApiPropertyOptional({ description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

// Escrow Account DTO
export class EscrowAccountDto {
  @ApiProperty({ description: 'Unique identifier for the escrow account', example: 'escrow_001' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ description: 'Owner ID (operation, founder, etc.)', example: 'op_001' })
  @IsString()
  ownerId: string;

  @ApiProperty({ description: 'Owner type', example: 'OPERATION' })
  @IsString()
  ownerType: string;

  @ApiProperty({ description: 'Account name', example: 'Revenue Share Escrow' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Account description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: Currency, description: 'Base currency for the account', example: 'BRL' })
  @IsEnum(Currency)
  currency: Currency;

  @ApiPropertyOptional({ description: 'Initial balance' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  initialBalance?: MoneyDto;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

// Escrow Account Response DTO
export class EscrowAccountResponseDto {
  @ApiProperty({ description: 'Unique identifier for the escrow account' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Owner ID' })
  @IsString()
  ownerId: string;

  @ApiProperty({ description: 'Owner type' })
  @IsString()
  ownerType: string;

  @ApiProperty({ description: 'Account name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Account description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: Currency, description: 'Base currency' })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ description: 'Current balance' })
  @ValidateNested()
  @Type(() => MoneyDto)
  balance: MoneyDto;

  @ApiProperty({ description: 'Available balance' })
  @ValidateNested()
  @Type(() => MoneyDto)
  availableBalance: MoneyDto;

  @ApiProperty({ description: 'Reserved balance' })
  @ValidateNested()
  @Type(() => MoneyDto)
  reservedBalance: MoneyDto;

  @ApiProperty({ description: 'Account status', example: 'ACTIVE' })
  @IsString()
  status: string; // ACTIVE, FROZEN, CLOSED

  @ApiProperty({ description: 'Whether the account is frozen' })
  @IsBoolean()
  isFrozen: boolean;

  @ApiProperty({ description: 'Whether the account is closed' })
  @IsBoolean()
  isClosed: boolean;

  @ApiProperty({ description: 'Creation timestamp', example: '2024-11-02T10:00:00Z' })
  @IsDateString()
  createdAt: string;

  @ApiProperty({ description: 'Last update timestamp', example: '2024-11-02T10:00:00Z' })
  @IsDateString()
  updatedAt: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

// Transaction DTO
export class TransactionDto {
  @ApiProperty({ description: 'Unique transaction ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Account ID' })
  @IsString()
  accountId: string;

  @ApiProperty({ description: 'Transaction type', example: 'DEPOSIT' })
  @IsString()
  type: string; // DEPOSIT, WITHDRAWAL, TRANSFER

  @ApiProperty({ description: 'Transaction direction', example: 'IN' })
  @IsString()
  direction: string; // IN, OUT

  @ApiProperty({ description: 'Transaction amount' })
  @ValidateNested()
  @Type(() => MoneyDto)
  amount: MoneyDto;

  @ApiProperty({ description: 'Balance after transaction' })
  @ValidateNested()
  @Type(() => MoneyDto)
  balanceAfter: MoneyDto;

  @ApiPropertyOptional({ description: 'Reference ID' })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Transaction status', example: 'COMPLETED' })
  @IsString()
  status: string; // PENDING, COMPLETED, FAILED

  @ApiProperty({ description: 'Creation timestamp', example: '2024-11-02T10:00:00Z' })
  @IsDateString()
  createdAt: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

// Export all types
export {
  SettlementStatus,
  SettlementMethod,
  SettlementType,
  Currency,
  AccountType,
};
