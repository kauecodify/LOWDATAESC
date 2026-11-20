import { Test } from '@nestjs/testing';

// Global test setup
beforeAll(async () => {
  // Set environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.SERVICE_NAME = 'split-payment-service';
  process.env.SERVICE_VERSION = '1.0.0';
  process.env.PORT = '8446';
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '5432';
  process.env.DB_USERNAME = 'test_user';
  process.env.DB_PASSWORD = 'test_pass';
  process.env.DB_NAME = 'test_db';
  process.env.DB_SCHEMA = 'split_payments';
  process.env.DB_SYNC = 'true';
  process.env.DB_LOGGING = 'false';

  // Mock console methods to reduce noise in tests
  const originalConsoleLog = console.log;
  const originalConsoleDebug = console.debug;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  console.log = jest.fn((...args) => {
    // Only log in verbose mode
    if (process.env.TEST_VERBOSE === 'true') {
      originalConsoleLog(...args);
    }
  });

  console.debug = jest.fn((...args) => {
    // Only log in verbose mode
    if (process.env.TEST_VERBOSE === 'true') {
      originalConsoleDebug(...args);
    }
  });

  console.warn = jest.fn((...args) => {
    originalConsoleWarn(...args);
  });

  console.error = jest.fn((...args) => {
    originalConsoleError(...args);
  });
});

// Global test teardown
afterAll(async () => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.debug = originalConsoleDebug;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

// Increase timeout for database operations
jest.setTimeout(30000);

// Mock Date.now for consistent testing
const mockDate = new Date('2024-01-01T00:00:00.000Z');
const RealDate = Date;

beforeEach(() => {
  global.Date = class extends RealDate {
    constructor() {
      super();
      return mockDate;
    }

    static now() {
      return mockDate.getTime();
    }

    static toISOString() {
      return mockDate.toISOString();
    }
  } as any;
});

afterEach(() => {
  global.Date = RealDate;
  jest.clearAllMocks();
});

// Mock UUID for consistent testing
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234-5678-90ab-cdef12345678'),
}));
