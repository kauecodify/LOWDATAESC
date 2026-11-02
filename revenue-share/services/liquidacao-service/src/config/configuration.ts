export default () => ({
  // Service configuration
  service: {
    name: process.env.SERVICE_NAME || 'liquidacao-service',
    version: process.env.SERVICE_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '8445'),
    host: process.env.HOST || '0.0.0.0',
  },

  // Database configuration
  database: {
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'revenue_user',
    password: process.env.DB_PASSWORD || 'revenue_pass',
    name: process.env.DB_NAME || 'revenue_share',
    schema: process.env.DB_SCHEMA || 'liquidacao',
    ssl: process.env.DB_SSL === 'true',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
    timeout: parseInt(process.env.DB_TIMEOUT || '5000'),
  },

  // Kafka configuration
  kafka: {
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092'],
    clientId: process.env.KAFKA_CLIENT_ID || 'liquidacao-service',
    groupId: process.env.KAFKA_GROUP_ID || 'liquidacao-service-group',
    topic: {
      settlementInstructions: process.env.KAFKA_TOPIC_SETTLEMENT_INSTRUCTIONS || 'settlement-instructions',
      settlementResults: process.env.KAFKA_TOPIC_SETTLEMENT_RESULTS || 'settlement-results',
      settlementCallbacks: process.env.KAFKA_TOPIC_SETTLEMENT_CALLBACKS || 'settlement-callbacks',
      deadLetter: process.env.KAFKA_TOPIC_DEAD_LETTER || 'liquidacao-dlq',
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
    db: parseInt(process.env.REDIS_DB || '2'),
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

  // gRPC configuration for LOWDATAESC integration
  grpc: {
    lowdataesc: {
      host: process.env.LOWDATAESC_GRPC_HOST || 'lowdataesc.company.com',
      port: parseInt(process.env.LOWDATAESC_GRPC_PORT || '50051'),
      ssl: process.env.LOWDATAESC_GRPC_SSL === 'true',
      caPath: process.env.LOWDATAESC_GRPC_CA_PATH || '/certs/lowdataesc-ca.crt',
      certPath: process.env.LOWDATAESC_GRPC_CERT_PATH || '/certs/liquidacao-service.crt',
      keyPath: process.env.LOWDATAESC_GRPC_KEY_PATH || '/certs/liquidacao-service.key',
      timeout: parseInt(process.env.LOWDATAESC_GRPC_TIMEOUT || '10000'), // 10 seconds
      retry: {
        maxAttempts: parseInt(process.env.LOWDATAESC_GRPC_MAX_RETRIES || '3'),
        delay: parseInt(process.env.LOWDATAESC_GRPC_RETRY_DELAY || '1000'),
      },
    },
    // Local gRPC server for internal callbacks
    server: {
      host: process.env.GRPC_SERVER_HOST || '0.0.0.0',
      port: parseInt(process.env.GRPC_SERVER_PORT || '50052'),
      ssl: process.env.GRPC_SERVER_SSL === 'true',
    },
  },

  // LOWDATAESC configuration
  lowdataesc: {
    // API configuration (for fallback)
    api: {
      baseUrl: process.env.LOWDATAESC_API_URL || 'https://api.lowdataesc.company.com',
      apiKey: process.env.LOWDATAESC_API_KEY || '',
      timeout: parseInt(process.env.LOWDATAESC_API_TIMEOUT || '30000'),
    },
    // Escrow configuration
    escrow: {
      defaultAccountPrefix: process.env.LOWDATAESC_ESCROW_PREFIX || 'revshare',
      autoCreateAccounts: process.env.LOWDATAESC_AUTO_CREATE === 'true',
    },
    // Settlement configuration
    settlement: {
      defaultSettlementMethod: process.env.LOWDATAESC_SETTLEMENT_METHOD || 'PIX',
      supportedMethods: process.env.LOWDATAESC_SUPPORTED_METHODS?.split(',') || ['PIX', 'TED', 'DOC', 'BOLETO'],
      maxAmount: parseFloat(process.env.LOWDATAESC_MAX_AMOUNT || '1000000.00'),
      minAmount: parseFloat(process.env.LOWDATAESC_MIN_AMOUNT || '0.01'),
    },
    // Callback configuration
    callback: {
      enabled: process.env.LOWDATAESC_CALLBACK_ENABLED === 'true',
      secretToken: process.env.LOWDATAESC_CALLBACK_SECRET || '',
    },
  },

  // Settlement configuration
  settlement: {
    // Processing
    maxRetries: parseInt(process.env.SETTLEMENT_MAX_RETRIES || '5'),
    retryDelay: parseInt(process.env.SETTLEMENT_RETRY_DELAY || '5000'),
    processingTimeout: parseInt(process.env.SETTLEMENT_PROCESSING_TIMEOUT || '60000'), // 1 minute
    
    // Idempotency
    idempotencyTtl: parseInt(process.env.SETTLEMENT_IDEMPOTENCY_TTL || '86400'), // 24 hours
    
    // Status tracking
    statusUpdateInterval: parseInt(process.env.SETTLEMENT_STATUS_UPDATE_INTERVAL || '30000'), // 30 seconds
    
    // Reconciliation
    reconciliation: {
      enabled: process.env.SETTLEMENT_RECONCILIATION_ENABLED === 'true',
      interval: parseInt(process.env.SETTLEMENT_RECONCILIATION_INTERVAL || '3600000'), // 1 hour
      tolerance: parseFloat(process.env.SETTLEMENT_RECONCILIATION_TOLERANCE || '0.01'), // 0.01 currency units
    },
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
});
