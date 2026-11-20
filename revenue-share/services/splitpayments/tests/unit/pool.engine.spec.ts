import { Test, TestingModule } from '@nestjs/testing';
import { PoolEngine } from '../../pool/src/engine/pool.engine';
import { PoolQueue } from '../../pool/src/engine/pool.queue';
import { PoolWorker } from '../../pool/src/engine/pool.worker';
import { PoolHealthService } from '../../pool/src/engine/pool.health.service';
import { PoolMetrics } from '../../pool/src/engine/pool.metrics';
import { LoggerService } from '../../pool/src/services/logger.service';
import { ConfigService } from '@nestjs/config';

// Mock services
jest.mock('../../pool/src/engine/pool.queue');
jest.mock('../../pool/src/engine/pool.worker');
jest.mock('../../pool/src/engine/pool.health.service');
jest.mock('../../pool/src/engine/pool.metrics');
jest.mock('../../pool/src/services/logger.service');

const mockConfigService = {
  get: jest.fn((key) => {
    const config = {
      'allocation.strategy': 'ROUND_ROBIN',
      'allocation.weights': {
        bacen: 0.4,
        iugu: 0.3,
        asaas: 0.2,
        efi: 0.1,
      },
      'paymentGateways.bacen.enabled': true,
      'paymentGateways.iugu.enabled': true,
      'paymentGateways.asaas.enabled': true,
      'paymentGateways.efi.enabled': true,
      'bacen.api.baseUrl': 'https://api.bcb.gov.br',
      'bacen.api.pixBaseUrl': 'https://pix.bcb.gov.br',
      'iugu.apiUrl': 'https://api.iugu.com/v1',
      'asaas.apiUrl': 'https://api.asaas.com/v3',
      'efi.apiUrl': 'https://api.efipay.com.br/v1',
      'engine.maxConcurrentTransactions': 100,
      'engine.transactionTimeout': 60000,
      'engine.retry.maxAttempts': 3,
      'engine.retry.delay': 1000,
      'worker.count': 4,
      'worker.concurrency': 10,
      'worker.shutdownTimeout': 30000,
      'health.checkInterval': 30000,
      'health.timeout': 5000,
      'metrics.enabled': true,
      'metrics.logging.enabled': true,
      'metrics.logging.interval': 60000,
    };
    return config[key];
  }),
};

const mockPoolQueue = {
  start: jest.fn(),
  stop: jest.fn(),
  addTransaction: jest.fn(),
  getNextTransaction: jest.fn(),
  size: jest.fn(() => 0),
};

const mockPoolWorker = {
  start: jest.fn(),
  stop: jest.fn(),
  isRunning: jest.fn(() => true),
};

const mockPoolHealthService = {
  start: jest.fn(),
  stop: jest.fn(),
  getHealth: jest.fn(),
};

const mockPoolMetrics = {
  start: jest.fn(),
  stop: jest.fn(),
  incrementTransactionsSubmitted: jest.fn(),
};

const mockLoggerService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('PoolEngine', () => {
  let engine: PoolEngine;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoolEngine,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PoolQueue,
          useValue: mockPoolQueue,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    engine = module.get<PoolEngine>(PoolEngine);

    // Mock the private methods
    jest.spyOn(engine as any, 'initializeWorkers').mockImplementation(async () => {
      // Add mock workers
      for (let i = 0; i < 4; i++) {
        (engine as any).workers.push(mockPoolWorker);
      }
    });
  });

  it('should be defined', () => {
    expect(engine).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize successfully', async () => {
      await engine.onModuleInit();

      expect(mockPoolQueue.start).toHaveBeenCalled();
      expect(mockPoolHealthService.start).toHaveBeenCalled();
      expect(mockPoolMetrics.start).toHaveBeenCalled();
      expect(engine['isRunning']).toBe(true);
    });
  });

  describe('onModuleDestroy', () => {
    it('should stop all components', async () => {
      await engine.onModuleInit();
      await engine.onModuleDestroy();

      expect(mockPoolQueue.stop).toHaveBeenCalled();
      expect(mockPoolHealthService.stop).toHaveBeenCalled();
      expect(mockPoolMetrics.stop).toHaveBeenCalled();
      expect(engine['isRunning']).toBe(false);
    });
  });

  describe('start', () => {
    it('should start the engine', async () => {
      await engine.start();

      expect(mockPoolQueue.start).toHaveBeenCalled();
      expect(mockPoolHealthService.start).toHaveBeenCalled();
      expect(mockPoolMetrics.start).toHaveBeenCalled();
      expect(engine['isRunning']).toBe(true);
    });

    it('should not start if already running', async () => {
      await engine.start();
      await engine.start();

      expect(mockPoolQueue.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('should stop the engine', async () => {
      await engine.start();
      await engine.stop();

      expect(mockPoolQueue.stop).toHaveBeenCalled();
      expect(mockPoolHealthService.stop).toHaveBeenCalled();
      expect(mockPoolMetrics.stop).toHaveBeenCalled();
      expect(engine['isRunning']).toBe(false);
    });

    it('should not stop if not running', async () => {
      await engine.stop();

      expect(mockPoolQueue.stop).not.toHaveBeenCalled();
    });
  });

  describe('submitTransaction', () => {
    it('should submit transaction to queue', async () => {
      const transaction = {
        consortiumId: 'consortium-1',
        paymentId: 'payment-1',
        amount: 10000,
        currency: 'BRL',
        method: 'PIX',
        supplierAccount: { externalId: 'supplier-1' },
        cbsAccount: { externalId: 'cbs-1' },
        ibsAccount: { externalId: 'ibs-1' },
      };

      await engine.start();
      mockPoolQueue.addTransaction.mockResolvedValue(undefined);

      const transactionId = await engine.submitTransaction(transaction);

      expect(transactionId).toBeDefined();
      expect(mockPoolQueue.addTransaction).toHaveBeenCalled();
      expect(mockPoolMetrics.incrementTransactionsSubmitted).toHaveBeenCalled();
    });
  });

  describe('getGateways', () => {
    it('should return all gateways', () => {
      const gateways = engine.getGateways();

      expect(gateways.size).toBe(4);
      expect(gateways.has('bacen')).toBe(true);
      expect(gateways.has('iugu')).toBe(true);
      expect(gateways.has('asaas')).toBe(true);
      expect(gateways.has('efi')).toBe(true);
    });
  });

  describe('selectGateway', () => {
    it('should select gateway using round robin strategy', () => {
      const transaction = {
        id: 'transaction-1',
        consortiumId: 'consortium-1',
        amount: 10000,
      };

      // First call should return bacen (index 0)
      const gateway1 = engine.selectGateway(transaction);
      expect(gateway1?.name).toBe('bacen');

      // Second call should return iugu (index 1)
      const gateway2 = engine.selectGateway(transaction);
      expect(gateway2?.name).toBe('iugu');

      // Third call should return asaas (index 2)
      const gateway3 = engine.selectGateway(transaction);
      expect(gateway3?.name).toBe('asaas');

      // Fourth call should return efi (index 3)
      const gateway4 = engine.selectGateway(transaction);
      expect(gateway4?.name).toBe('efi');

      // Fifth call should return bacen again (index 4 % 4 = 0)
      const gateway5 = engine.selectGateway(transaction);
      expect(gateway5?.name).toBe('bacen');
    });

    it('should return null when no healthy gateways available', () => {
      // Mark all gateways as unhealthy
      const gateways = engine.getGateways();
      gateways.forEach((gateway, name) => {
        gateway.healthStatus = 'UNHEALTHY';
        engine['gateways'].set(name, gateway);
      });

      const transaction = {
        id: 'transaction-1',
        consortiumId: 'consortium-1',
        amount: 10000,
      };

      const gateway = engine.selectGateway(transaction);
      expect(gateway).toBeNull();
    });
  });

  describe('getStatistics', () => {
    it('should return engine statistics', () => {
      const stats = engine.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.transactions).toBeDefined();
      expect(stats.gateways).toBeDefined();
      expect(stats.queue).toBeDefined();
      expect(stats.workers).toBeDefined();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all components are healthy', async () => {
      const health = await engine.healthCheck();

      expect(health.status).toBe('HEALTHY');
      expect(health.details).toBeDefined();
    });
  });
});
