import { IsString, IsNumber, IsEnum, IsDateString, IsOptional, IsUUID, ValidateNested, IsArray, IsBoolean, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Payment status
export const PaymentStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  TAX_CONSULTED: 'TAX_CONSULTED',
  SPLIT_CALCULATED: 'SPLIT_CALCULATED',
  GATEWAY_SUBMITTED: 'GATEWAY_SUBMITTED',
  GATEWAY_PROCESSING: 'GATEWAY_PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  ESCROW_RETAINED: 'ESCROW_RETAINED',
  CANCELLED: 'CANCELLED',
  REVERSED: 'REVERSED',
} as const;

type PaymentStatus = typeof PaymentStatus[keyof typeof PaymentStatus];

// Payment method
export const PaymentMethod = {
  PIX: 'PIX',
  BOLETO: 'BOLETO',
  TED: 'TED',
  DOC: 'DOC',
  CREDIT_CARD: 'CREDIT_CARD',
  DEBIT_CARD: 'DEBIT_CARD',
} as const;

type PaymentMethod = typeof PaymentMethod[keyof typeof PaymentMethod];

// Transaction type
export const TransactionType = {
  PAYMENT: 'PAYMENT',
  REFUND: 'REFUND',
  CHARGEBACK: 'CHARGEBACK',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

type TransactionType = typeof TransactionType[keyof typeof TransactionType];

// Tax type
export const TaxType = {
  CBS: 'CBS',
  IBS: 'IBS',
} as const;

type TaxType = typeof TaxType[keyof typeof TaxType];

// Currency types
export const Currency = {
  BRL: 'BRL',
  USD: 'USD',
  EUR: 'EUR',
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
  accountType: string;

  @ApiProperty({ description: 'Document number (CPF/CNPJ)', example: '12345678901' })
  @IsString()
  documentNumber: string;

  @ApiProperty({ description: 'Document type', example: 'CNPJ' })
  @IsString()
  documentType: string;

  @ApiProperty({ description: 'Account holder name', example: 'Prefeitura Municipal' })
  @IsString()
  holderName: string;
}

// PIX account DTO
export class PIXAccountDto {
  @ApiProperty({ description: 'PIX key type', example: 'CNPJ' })
  @IsString()
  keyType: string;

  @ApiProperty({ description: 'PIX key value', example: '12345678901234' })
  @IsString()
  keyValue: string;

  @ApiProperty({ description: 'Account holder name', example: 'Prefeitura Municipal' })
  @IsString()
  holderName: string;

  @ApiProperty({ description: 'Document number', example: '12345678901234' })
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

  @ApiProperty({ description: 'External ID for the account' })
  @IsString()
  externalId: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

// Tax rate DTO
export class TaxRateDto {
  @ApiProperty({ description: 'Tax type', enum: TaxType })
  @IsEnum(TaxType)
  taxType: TaxType;

  @ApiPropertyOptional({ description: 'State code for IBS' })
  @IsOptional()
  @IsString()
  stateCode?: string;

  @ApiPropertyOptional({ description: 'Municipality code for IBS' })
  @IsOptional()
  @IsString()
  municipalityCode?: string;

  @ApiProperty({ description: 'Tax rate percentage', example: 0.01 })
  @IsNumber()
  rate: number;

  @ApiPropertyOptional({ description: 'Valid from date' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ description: 'Valid to date' })
  @IsOptional()
  @IsDateString()
  validTo?: string;
}

// Split amount DTO
export class SplitAmountDto {
  @ApiProperty({ description: 'Amount to be sent', example: 9700.0 })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Destination account' })
  @ValidateNested()
  @Type(() => DestinationAccountDto)
  destination: DestinationAccountDto;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

// Main create split transaction DTO
export class CreateSplitTransactionDto {
  @ApiProperty({ description: 'Consortium/tenant ID' })
  @IsUUID()
  consortiumId: string;

  @ApiProperty({ description: 'Original payment ID' })
  @IsUUID()
  paymentId: string;

  @ApiProperty({ description: 'Transaction type', enum: TransactionType })
  @IsEnum(TransactionType)
  transactionType: TransactionType;

  @ApiProperty({ description: 'Payment method', enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ description: 'Original amount before tax', example: 10000.0 })
  @IsNumber()
  originalAmount: number;

  @ApiProperty({ description: 'Currency', enum: Currency })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ description: 'Supplier destination account' })
  @ValidateNested()
  @Type(() => DestinationAccountDto)
  supplierAccount: DestinationAccountDto;

  @ApiProperty({ description: 'CBS destination account (Comite Gestor)' })
  @ValidateNested()
  @Type(() => DestinationAccountDto)
  cbsAccount: DestinationAccountDto;

  @ApiProperty({ description: 'IBS destination account (Entidade Federativa)' })
  @ValidateNested()
  @Type(() => DestinationAccountDto)
  ibsAccount: DestinationAccountDto;

  @ApiPropertyOptional({ description: 'Tax rates (if known)' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TaxRateDto)
  taxRates?: TaxRateDto[];

  @ApiPropertyOptional({ description: 'Reference ID from external system' })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional({ description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

// Response DTO
export class SplitTransactionResponseDto {
  @ApiProperty({ description: 'Transaction ID' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'Consortium/tenant ID' })
  @IsUUID()
  consortiumId: string;

  @ApiProperty({ description: 'Payment ID' })
  @IsUUID()
  paymentId: string;

  @ApiProperty({ description: 'Status', enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  status: PaymentStatus;

  @ApiProperty({ description: 'Split hash for idempotency' })
  @IsString()
  splitHash: string;

  @ApiProperty({ description: 'Calculated tax information' })
  @IsObject()
  taxInfo: {
    cbs: {
      rate: number;
      amount: number;
      accountId: string;
    };
    ibs: {
      rate: number;
      amount: number;
      accountId: string;
    };
    totalTaxRate: number;
    totalTaxAmount: number;
  };

  @ApiProperty({ description: 'Split amounts' })
  @IsObject()
  splitAmounts: {
    supplier: SplitAmountDto;
    cbs: SplitAmountDto;
    ibs: SplitAmountDto;
  };

  @ApiPropertyOptional({ description: 'Gateway information' })
  @IsOptional()
  @IsObject()
  gatewayInfo?: any;

  @ApiPropertyOptional({ description: 'Error information' })
  @IsOptional()
  @IsObject()
  errorInfo?: any;

  @ApiProperty({ description: 'Created at timestamp' })
  @IsDateString()
  createdAt: string;

  @ApiProperty({ description: 'Updated at timestamp' })
  @IsDateString()
  updatedAt: string;
}

// Query DTO for filtering
export class QuerySplitTransactionDto {
  @ApiPropertyOptional({ description: 'Consortium/tenant ID' })
  @IsOptional()
  @IsUUID()
  consortiumId?: string;

  @ApiPropertyOptional({ description: 'Payment ID' })
  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @ApiPropertyOptional({ description: 'Status filter' })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Payment method filter' })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Page size' })
  @IsOptional()
  @IsNumber()
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Sort field' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}

// Webhook callback DTO
export class WebhookCallbackDto {
  @ApiProperty({ description: 'Event type' })
  @IsString()
  eventType: string;

  @ApiProperty({ description: 'Transaction ID' })
  @IsUUID()
  transactionId: string;

  @ApiProperty({ description: 'Gateway' })
  @IsString()
  gateway: string;

  @ApiProperty({ description: 'Gateway transaction ID' })
  @IsString()
  gatewayTransactionId: string;

  @ApiProperty({ description: 'Status' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: 'Response data' })
  @IsOptional()
  @IsObject()
  data?: any;

  @ApiPropertyOptional({ description: 'Error information' })
  @IsOptional()
  @IsObject()
  error?: any;

  @ApiProperty({ description: 'Timestamp' })
  @IsDateString()
  timestamp: string;
}

// SPED generation DTO
export class GenerateSPEDDto {
  @ApiProperty({ description: 'Consortium/tenant ID' })
  @IsUUID()
  consortiumId: string;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Transaction IDs to include' })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  transactionIds?: string[];
}

// Fallback to escrow DTO
export class FallbackToEscrowDto {
  @ApiProperty({ description: 'Transaction ID' })
  @IsUUID()
  transactionId: string;

  @ApiProperty({ description: 'Reason for fallback' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Additional details' })
  @IsOptional()
  @IsObject()
  details?: any;
}
