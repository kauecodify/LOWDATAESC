export default () => ({
  // Service configuration
  service: {
    name: process.env.SERVICE_NAME || 'calculation-service',
    version: process.env.SERVICE_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '8444'),
    host: process.env.HOST || '0.0.0.0',
  },

  // Database configuration
  database: {
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'revenue_user',
    password: process.env.DB_PASSWORD || 'revenue_pass',
    name: process.env.DB_NAME || 'revenue_share',
    schema: process.env.DB_SCHEMA || 'calculation',
    ssl: process.env.DB_SSL === 'true',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
    timeout: parseInt(process.env.DB_TIMEOUT || '5000'),
  },

  // Kafka configuration
  kafka: {
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092'],
    clientId: process.env.KAFKA_CLIENT_ID || 'calculation-service',
    groupId: process.env.KAFKA_GROUP_ID || 'calculation-service-group',
    topic: {
      revenueEvents: process.env.KAFKA_TOPIC_REVENUE_EVENTS || 'revenue-events',
      calculationRequests: process.env.KAFKA_TOPIC_CALCULATION_REQUESTS || 'calculation-requests',
      calculationResults: process.env.KAFKA_TOPIC_CALCULATION_RESULTS || 'calculation-results',
      deadLetter: process.env.KAFKA_TOPIC_DEAD_LETTER || 'calculation-dlq',
    },
    ssl: process.env.KAFKA_SSL === 'true',
    sasl: {
      mechanism: process.env.KAFKA_SASL_MECHANISM || 'plain',
      username: process.env.KAFKA_SASL_USERNAME || '',
      password: process.env.KAFKA_SASL_PASSWORD || '',
    },
    retries: parseInt(process.env.KAFKA_RETRIES || '3'),
    retryDelay: parseInt(process.env.KAFKA_RETRY_DELAY || '1000'),
  },

  // Redis configuration for caching
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '1'),
    ttl: parseInt(process.env.REDIS_TTL || '3600'), // 1 hour
  },

  // Security configuration
  security: {
    mTLS: {
      enabled: process.env.MTLS_ENABLED === 'true',
      certPath: process.env.MTLS_CERT_PATH || '/certs/tls.crt',
      keyPath: process.env.MTLS_KEY_PATH || '/certs/tls.key',
      caPath: process.env.MTLS_CA_PATH || '/certs/ca.crt',
    },
    jwt: {
      secret: process.env.JWT_SECRET || '',
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
      max: parseInt(process.env.RATE_LIMIT_MAX || '1000'),
    },
  },

  // Idempotency configuration
  idempotency: {
    enabled: process.env.IDEMPOTENCY_ENABLED !== 'false',
    ttl: parseInt(process.env.IDEMPOTENCY_TTL || '86400'), // 24 hours
    header: process.env.IDEMPOTENCY_HEADER || 'Idempotency-Key',
  },

  // Calculation configuration
  calculation: {
    // Precision settings
    decimalPrecision: parseInt(process.env.CALCULATION_DECIMAL_PRECISION || '8'),
    displayPrecision: parseInt(process.env.CALCULATION_DISPLAY_PRECISION || '2'),
    
    // Rounding method (banker, up, down, ceil, floor)
    roundingMethod: process.env.CALCULATION_ROUNDING_METHOD || 'banker',
    
    // Currency conversion
    baseCurrency: process.env.CALCULATION_BASE_CURRENCY || 'BRL',
    conversionRatesUrl: process.env.CALCULATION_CONVERSION_RATES_URL || 'https://api.exchangerate-host.com/v2/latest',
    conversionRatesCacheTtl: parseInt(process.env.CALCULATION_CONVERSION_RATES_CACHE_TTL || '3600'), // 1 hour
    
    // Deduction order (priority of deductions)
    deductionOrder: process.env.CALCULATION_DEDUCTION_ORDER?.split(',') || [
      'TAX',
      'COMMISSION',
      'FEE',
      'CHARGEBACK',
      'ADJUSTMENT',
    ],
    
    // Retry configuration
    maxRetries: parseInt(process.env.CALCULATION_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.CALCULATION_RETRY_DELAY || '1000'),
    
    // Batch processing
    batchSize: parseInt(process.env.CALCULATION_BATCH_SIZE || '100'),
    batchTimeout: parseInt(process.env.CALCULATION_BATCH_TIMEOUT || '5000'),
    
    // Timeout configuration
    processingTimeout: parseInt(process.env.CALCULATION_PROCESSING_TIMEOUT || '30000'), // 30 seconds
  },

  // Health check configuration
  health: {
    livenessPath: process.env.HEALTH_LIVENESS_PATH || '/health/live',
    readinessPath: process.env.HEALTH_READINESS_PATH || '/health/ready',
    timeout: parseInt(process.env.HEALTH_TIMEOUT || '5000'),
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '10'),
    maxSize: process.env.LOG_MAX_SIZE || '100m',
    dir: process.env.LOG_DIR || './logs',
  },

  // Circuit breaker configuration
  circuitBreaker: {
    enabled: process.env.CIRCUIT_BREAKER_ENABLED === 'true',
    failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
    successThreshold: parseInt(process.env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD || '2'),
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '10000'),
    resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000'),
  },

  // Distribution Matrix configuration
  distributionMatrix: {
    enabled: process.env.DISTRIBUTION_MATRIX_ENABLED !== 'false',
    configPath: process.env.DISTRIBUTION_MATRIX_CONFIG_PATH || '/config/distribution-matrix.json',
    reloadInterval: parseInt(process.env.DISTRIBUTION_MATRIX_RELOAD_INTERVAL || '300000'), // 5 minutes
  },
});
