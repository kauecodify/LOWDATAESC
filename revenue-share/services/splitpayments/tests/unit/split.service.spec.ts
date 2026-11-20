import { Test, TestingModule } from '@nestjs/testing';
import { SplitService } from '../../src/modules/split/services/split.service';
import { SplitRepository } from '../../src/modules/split/split.repository';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from '../../src/common/kafka/kafka.service';
import { IdempotencyService } from '../../src/common/idempotency/idempotency.service';
import { LoggerService } from '../../src/common/logger/logger.service';
import { PaymentStatus, PaymentMethod, TransactionType, Currency } from '../../src/modules/split/dto/create-split-transaction.dto';

// Mock services
jest.mock('../../src/modules/split/split.repository');
jest.mock('../../src/common/kafka/kafka.service');
jest.mock('../../src/common/idempotency/idempotency.service');
jest.mock('../../src/common/logger/logger.service');

const mockConfigService = {
  get: jest.fn((key) => {
    const config = {
      'idempotency.ttl': 86400,
      'idempotency.header': 'Idempotency-Key',
      'splitPayment.defaultTaxRates.cbs': 0.01,
      'splitPayment.defaultTaxRates.ibs': 0.02,
      'splitPayment.maxRetries': 5,
      'splitPayment.retryDelay': 5000,
      'escrow.enabled': true,
      'escrow.defaultAccountPrefix': 'split-escrow',
      'alert.enabled': true,
      'sped.enabled': true,
      'sped.autoSend': true,
      'webhook.receitaFederal.enabled': true,
      'kafka.topic.escrowEvents': 'escrow-events',
      'kafka.topic.webhookEvents': 'webhook-events',
    };
    return config[key];
  }),
};

const mockSplitRepository = {
  createSplitTransaction: jest.fn(),
  findById: jest.fn(),
  findBySplitHash: jest.fn(),
  findByPaymentId: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
  createAuditLog: jest.fn(),
  findLatestCBSRate: jest.fn(),
  findLatestIBSRate: jest.fn(),
};

const mockKafkaService = {
  produce: jest.fn(),
};

const mockIdempotencyService = {
  checkAndSet: jest.fn(),
  get: jest.fn(),
  generateKey: jest.fn((prefix, id) => `${prefix}:${id}`),
};

const mockLoggerService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('SplitService', () => {
  let service: SplitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SplitService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: SplitRepository,
          useValue: mockSplitRepository,
        },
        {
          provide: KafkaService,
          useValue: mockKafkaService,
        },
        {
          provide: IdempotencyService,
          useValue: mockIdempotencyService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<SplitService>(SplitService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSplitTransaction', () => {
    it('should create a split transaction successfully', async () => {
      const dto = {
        consortiumId: 'consortium-1',
        paymentId: 'payment-1',
        transactionType: TransactionType.PAYMENT,
        method: PaymentMethod.PIX,
        originalAmount: 10000,
        currency: Currency.BRL,
        supplierAccount: {
          externalId: 'supplier-1',
          accountType: 'BANK',
          bankAccount: {
            bankCode: '104',
            agency: '0001',
            accountNumber: '12345678',
            accountType: 'CORRENTE',
            documentNumber: '12345678901234',
            documentType: 'CNPJ',
            holderName: 'Supplier Name',
          },
        },
        cbsAccount: {
          externalId: 'cbs-account',
          accountType: 'BANK',
        },
        ibsAccount: {
          externalId: 'ibs-account',
          accountType: 'BANK',
        },
      };

      const expectedTransaction = {
        id: 'transaction-1',
        consortiumId: 'consortium-1',
        paymentId: 'payment-1',
        splitHash: expect.any(String),
        status: PaymentStatus.PENDING,
        originalAmount: 10000,
        taxInfo: {
          cbs: {
            rate: 0.01,
            amount: 100,
            accountId: 'cbs-account',
          },
          ibs: {
            rate: 0.02,
            amount: 200,
            accountId: 'ibs-account',
          },
          totalTaxRate: 0.03,
          totalTaxAmount: 300,
        },
        splitAmounts: {
          supplier: {
            amount: 9700,
            accountId: 'supplier-1',
            accountType: 'BANK',
            bankDetails: dto.supplierAccount.bankAccount,
          },
          cbs: {
            amount: 100,
            accountId: 'cbs-account',
            accountType: 'BANK',
          },
          ibs: {
            amount: 200,
            accountId: 'ibs-account',
            accountType: 'BANK',
          },
        },
      };

      mockSplitRepository.createSplitTransaction.mockResolvedValue(expectedTransaction);
      mockIdempotencyService.checkAndSet.mockResolvedValue(true);
      mockSplitRepository.createAuditLog.mockResolvedValue({});

      const result = await service.createSplitTransaction(dto);

      expect(result).toBeDefined();
      expect(result.id).toBe('transaction-1');
      expect(result.consortiumId).toBe('consortium-1');
      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(result.taxInfo.cbs.amount).toBe(100);
      expect(result.taxInfo.ibs.amount).toBe(200);
      expect(result.splitAmounts.supplier.amount).toBe(9700);

      expect(mockSplitRepository.createSplitTransaction).toHaveBeenCalled();
      expect(mockIdempotencyService.checkAndSet).toHaveBeenCalled();
      expect(mockSplitRepository.createAuditLog).toHaveBeenCalled();
    });

    it('should return existing transaction for duplicate split hash', async () => {
      const dto = {
        consortiumId: 'consortium-1',
        paymentId: 'payment-1',
        transactionType: TransactionType.PAYMENT,
        method: PaymentMethod.PIX,
        originalAmount: 10000,
        currency: Currency.BRL,
        supplierAccount: {
          externalId: 'supplier-1',
          accountType: 'BANK',
        },
        cbsAccount: {
          externalId: 'cbs-account',
          accountType: 'BANK',
        },
        ibsAccount: {
          externalId: 'ibs-account',
          accountType: 'BANK',
        },
      };

      const existingTransaction = {
        id: 'existing-1',
        splitHash: 'hash-1',
        status: PaymentStatus.COMPLETED,
      };

      const splitHash = service['generateSplitHash'](dto);
      mockSplitRepository.findBySplitHash.mockResolvedValue(existingTransaction);

      const result = await service.createSplitTransaction(dto);

      expect(result.id).toBe('existing-1');
      expect(mockSplitRepository.createSplitTransaction).not.toHaveBeenCalled();
    });

    it('should return existing transaction for idempotent request', async () => {
      const dto = {
        consortiumId: 'consortium-1',
        paymentId: 'payment-1',
        transactionType: TransactionType.PAYMENT,
        method: PaymentMethod.PIX,
        originalAmount: 10000,
        currency: Currency.BRL,
        idempotencyKey: 'idempotency-1',
        supplierAccount: {
          externalId: 'supplier-1',
          accountType: 'BANK',
        },
        cbsAccount: {
          externalId: 'cbs-account',
          accountType: 'BANK',
        },
        ibsAccount: {
          externalId: 'ibs-account',
          accountType: 'BANK',
        },
      };

      const existingResponse = {
        id: 'existing-1',
        consortiumId: 'consortium-1',
        paymentId: 'payment-1',
        status: PaymentStatus.COMPLETED,
      };

      mockIdempotencyService.get.mockResolvedValue(existingResponse);

      const result = await service.createSplitTransaction(dto);

      expect(result).toEqual(existingResponse);
      expect(mockSplitRepository.createSplitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('calculateSplitAmounts', () => {
    it('should calculate split amounts correctly', () => {
      const originalAmount = 10000;
      const cbsRate = 0.01;
      const ibsRate = 0.02;
      const supplierAccount = { externalId: 'supplier-1', accountType: 'BANK' };
      const cbsAccount = { externalId: 'cbs-1', accountType: 'BANK' };
      const ibsAccount = { externalId: 'ibs-1', accountType: 'BANK' };

      const result = service['calculateSplitAmounts'](
        originalAmount,
        cbsRate,
        ibsRate,
        supplierAccount,
        cbsAccount,
        ibsAccount
      );

      expect(result.taxAmounts.cbs).toBe(100);
      expect(result.taxAmounts.ibs).toBe(200);
      expect(result.splitAmounts.supplier.amount).toBe(9700);
      expect(result.splitAmounts.cbs.amount).toBe(100);
      expect(result.splitAmounts.ibs.amount).toBe(200);
    });

    it('should handle zero tax rates', () => {
      const originalAmount = 10000;
      const cbsRate = 0;
      const ibsRate = 0;
      const supplierAccount = { externalId: 'supplier-1', accountType: 'BANK' };
      const cbsAccount = { externalId: 'cbs-1', accountType: 'BANK' };
      const ibsAccount = { externalId: 'ibs-1', accountType: 'BANK' };

      const result = service['calculateSplitAmounts'](
        originalAmount,
        cbsRate,
        ibsRate,
        supplierAccount,
        cbsAccount,
        ibsAccount
      );

      expect(result.taxAmounts.cbs).toBe(0);
      expect(result.taxAmounts.ibs).toBe(0);
      expect(result.splitAmounts.supplier.amount).toBe(10000);
      expect(result.splitAmounts.cbs.amount).toBe(0);
      expect(result.splitAmounts.ibs.amount).toBe(0);
    });
  });

  describe('generateSplitHash', () => {
    it('should generate consistent hash for same input', () => {
      const dto = {
        consortiumId: 'consortium-1',
        paymentId: 'payment-1',
        originalAmount: 10000,
        currency: Currency.BRL,
        method: PaymentMethod.PIX,
        supplierAccount: {
          externalId: 'supplier-1',
          accountType: 'BANK',
        },
        cbsAccount: {
          externalId: 'cbs-1',
          accountType: 'BANK',
        },
        ibsAccount: {
          externalId: 'ibs-1',
          accountType: 'BANK',
        },
      };

      const hash1 = service['generateSplitHash'](dto);
      const hash2 = service['generateSplitHash'](dto);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different input', () => {
      const dto1 = {
        consortiumId: 'consortium-1',
        paymentId: 'payment-1',
        originalAmount: 10000,
        currency: Currency.BRL,
        method: PaymentMethod.PIX,
        supplierAccount: {
          externalId: 'supplier-1',
          accountType: 'BANK',
        },
        cbsAccount: {
          externalId: 'cbs-1',
          accountType: 'BANK',
        },
        ibsAccount: {
          externalId: 'ibs-1',
          accountType: 'BANK',
        },
      };

      const dto2 = {
        ...dto1,
        originalAmount: 20000,
      };

      const hash1 = service['generateSplitHash'](dto1);
      const hash2 = service['generateSplitHash'](dto2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('getTaxRates', () => {
    it('should return default rates when no rates provided', async () => {
      const consortiumId = 'consortium-1';
      const providedRates = [];

      mockSplitRepository.findLatestCBSRate.mockResolvedValue(null);
      mockSplitRepository.findLatestIBSRate.mockResolvedValue(null);

      const rates = await service['getTaxRates'](consortiumId, providedRates);

      expect(rates.cbs).toBe(0.01);
      expect(rates.ibs).toBe(0.02);
    });

    it('should use provided rates when available', async () => {
      const consortiumId = 'consortium-1';
      const providedRates = [
        { taxType: 'CBS', rate: 0.015 },
        { taxType: 'IBS', rate: 0.025 },
      ];

      const rates = await service['getTaxRates'](consortiumId, providedRates);

      expect(rates.cbs).toBe(0.015);
      expect(rates.ibs).toBe(0.025);
    });
  });
});
