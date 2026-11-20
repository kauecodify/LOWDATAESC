import { SplitService } from '../../src/modules/split/services/split.service';
import { ConfigService } from '@nestjs/config';
import { SplitRepository } from '../../src/modules/split/split.repository';
import { KafkaService } from '../../src/common/kafka/kafka.service';
import { IdempotencyService } from '../../src/common/idempotency/idempotency.service';
import { LoggerService } from '../../src/common/logger/logger.service';

// Mock services
jest.mock('../../src/modules/split/split.repository');
jest.mock('../../src/common/kafka/kafka.service');
jest.mock('../../src/common/idempotency/idempotency.service');
jest.mock('../../src/common/logger/logger.service');

const mockConfigService = {
  get: jest.fn((key) => {
    const config = {
      'splitPayment.defaultTaxRates.cbs': 0.01,
      'splitPayment.defaultTaxRates.ibs': 0.02,
    };
    return config[key];
  }),
};

const mockSplitRepository = {
  findLatestCBSRate: jest.fn(),
  findLatestIBSRate: jest.fn(),
};

const mockKafkaService = {};
const mockIdempotencyService = {};
const mockLoggerService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('Tax Calculation', () => {
  let service: SplitService;

  beforeEach(async () => {
    service = new SplitService(
      mockConfigService as any,
      mockSplitRepository as any,
      mockKafkaService as any,
      mockIdempotencyService as any,
      mockLoggerService as any
    );
  });

  describe('calculateSplitAmounts', () => {
    it('should calculate CBS (1%) and IBS (2%) correctly', () => {
      const originalAmount = 10000;
      const cbsRate = 0.01; // 1%
      const ibsRate = 0.02; // 2%
      
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

      // CBS: 10000 * 0.01 = 100
      expect(result.taxAmounts.cbs).toBe(100);
      
      // IBS: 10000 * 0.02 = 200
      expect(result.taxAmounts.ibs).toBe(200);
      
      // Total tax: 100 + 200 = 300
      expect(result.taxAmounts.cbs + result.taxAmounts.ibs).toBe(300);
      
      // Supplier: 10000 - 300 = 9700
      expect(result.splitAmounts.supplier.amount).toBe(9700);
      
      // Verify total
      expect(
        result.splitAmounts.supplier.amount + 
        result.splitAmounts.cbs.amount + 
        result.splitAmounts.ibs.amount
      ).toBe(originalAmount);
    });

    it('should handle different tax rates', () => {
      const originalAmount = 50000;
      const cbsRate = 0.015; // 1.5%
      const ibsRate = 0.03;  // 3%
      
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

      // CBS: 50000 * 0.015 = 750
      expect(result.taxAmounts.cbs).toBe(750);
      
      // IBS: 50000 * 0.03 = 1500
      expect(result.taxAmounts.ibs).toBe(1500);
      
      // Total tax: 750 + 1500 = 2250
      expect(result.taxAmounts.cbs + result.taxAmounts.ibs).toBe(2250);
      
      // Supplier: 50000 - 2250 = 47750
      expect(result.splitAmounts.supplier.amount).toBe(47750);
      
      // Verify total
      expect(
        result.splitAmounts.supplier.amount + 
        result.splitAmounts.cbs.amount + 
        result.splitAmounts.ibs.amount
      ).toBe(originalAmount);
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
      expect(result.splitAmounts.supplier.amount).toBe(originalAmount);
    });

    it('should handle high tax rates', () => {
      const originalAmount = 10000;
      const cbsRate = 0.1; // 10%
      const ibsRate = 0.2; // 20%
      
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

      // CBS: 10000 * 0.1 = 1000
      expect(result.taxAmounts.cbs).toBe(1000);
      
      // IBS: 10000 * 0.2 = 2000
      expect(result.taxAmounts.ibs).toBe(2000);
      
      // Supplier: 10000 - 3000 = 7000
      expect(result.splitAmounts.supplier.amount).toBe(7000);
    });

    it('should handle fractional amounts', () => {
      const originalAmount = 1000.50;
      const cbsRate = 0.01; // 1%
      const ibsRate = 0.02; // 2%
      
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

      // CBS: 1000.50 * 0.01 = 10.005
      expect(result.taxAmounts.cbs).toBeCloseTo(10.005);
      
      // IBS: 1000.50 * 0.02 = 20.01
      expect(result.taxAmounts.ibs).toBeCloseTo(20.01);
      
      // Supplier: 1000.50 - 10.005 - 20.01 = 969.985
      expect(result.splitAmounts.supplier.amount).toBeCloseTo(969.985);
    });

    it('should handle very small amounts', () => {
      const originalAmount = 0.01;
      const cbsRate = 0.01; // 1%
      const ibsRate = 0.02; // 2%
      
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

      // CBS: 0.01 * 0.01 = 0.0001
      expect(result.taxAmounts.cbs).toBeCloseTo(0.0001);
      
      // IBS: 0.01 * 0.02 = 0.0002
      expect(result.taxAmounts.ibs).toBeCloseTo(0.0002);
      
      // Supplier: 0.01 - 0.0001 - 0.0002 = 0.0097
      expect(result.splitAmounts.supplier.amount).toBeCloseTo(0.0097);
    });

    it('should handle very large amounts', () => {
      const originalAmount = 10000000; // 10 million
      const cbsRate = 0.01; // 1%
      const ibsRate = 0.02; // 2%
      
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

      // CBS: 10000000 * 0.01 = 100000
      expect(result.taxAmounts.cbs).toBe(100000);
      
      // IBS: 10000000 * 0.02 = 200000
      expect(result.taxAmounts.ibs).toBe(200000);
      
      // Supplier: 10000000 - 100000 - 200000 = 9700000
      expect(result.splitAmounts.supplier.amount).toBe(9700000);
    });
  });

  describe('getTaxRates', () => {
    it('should return default rates when no rates provided and no cached rates', async () => {
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

    it('should use cached CBS rate when available', async () => {
      const consortiumId = 'consortium-1';
      const providedRates = [];

      const cachedCBSRate = { rate: 0.012 };
      mockSplitRepository.findLatestCBSRate.mockResolvedValue(cachedCBSRate);
      mockSplitRepository.findLatestIBSRate.mockResolvedValue(null);

      const rates = await service['getTaxRates'](consortiumId, providedRates);

      expect(rates.cbs).toBe(0.012);
      expect(rates.ibs).toBe(0.02); // Default IBS rate
    });

    it('should use cached IBS rate when available', async () => {
      const consortiumId = 'consortium-1';
      const providedRates = [];

      mockSplitRepository.findLatestCBSRate.mockResolvedValue(null);
      const cachedIBSRate = { rate: 0.028 };
      mockSplitRepository.findLatestIBSRate.mockResolvedValue(cachedIBSRate);

      const rates = await service['getTaxRates'](consortiumId, providedRates);

      expect(rates.cbs).toBe(0.01); // Default CBS rate
      expect(rates.ibs).toBe(0.028);
    });
  });
});
