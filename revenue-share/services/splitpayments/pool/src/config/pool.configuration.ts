export default () => ({
  // Pool configuration
  pool: {
    name: process.env.POOL_NAME || 'split-payment-pool',
    version: process.env.POOL_VERSION || '1.0.0',
    description: process.env.POOL_DESCRIPTION || 'Split Payment Pool Engine for LOWDATAESC',
  },

  // Database configuration for pool
  database: {
    host: process.env.POOL_DB_HOST || 'postgres',
    port: parseInt(process.env.POOL_DB_PORT || '5432'),
    username: process.env.POOL_DB_USERNAME || 'pool_user',
    password: process.env.POOL_DB_PASSWORD || 'pool_pass',
    name: process.env.POOL_DB_NAME || 'revenue_share',
    schema: process.env.POOL_DB_SCHEMA || 'pool',
    ssl: process.env.POOL_DB_SSL === 'true',
    poolSize: parseInt(process.env.POOL_DB_POOL_SIZE || '10'),
    timeout: parseInt(process.env.POOL_DB_TIMEOUT || '5000'),
  },

  // Pool engine configuration
  engine: {
    // Maximum number of concurrent transactions
    maxConcurrentTransactions: parseInt(process.env.POOL_MAX_CONCURRENT || '100'),
    
    // Transaction timeout in milliseconds
    transactionTimeout: parseInt(process.env.POOL_TRANSACTION_TIMEOUT || '60000'),
    
    // Retry configuration
    retry: {
      maxAttempts: parseInt(process.env.POOL_RETRY_MAX_ATTEMPTS || '3'),
      delay: parseInt(process.env.POOL_RETRY_DELAY || '1000'),
      backoffMultiplier: parseFloat(process.env.POOL_RETRY_BACKOFF || '2'),
    },
    
    // Batch processing
    batch: {
      enabled: process.env.POOL_BATCH_ENABLED === 'true',
      size: parseInt(process.env.POOL_BATCH_SIZE || '50'),
      interval: parseInt(process.env.POOL_BATCH_INTERVAL || '5000'),
    },
    
    // Circuit breaker
    circuitBreaker: {
      enabled: process.env.POOL_CIRCUIT_BREAKER_ENABLED === 'true',
      failureThreshold: parseInt(process.env.POOL_CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
      successThreshold: parseInt(process.env.POOL_CIRCUIT_BREAKER_SUCCESS_THRESHOLD || '2'),
      timeout: parseInt(process.env.POOL_CIRCUIT_BREAKER_TIMEOUT || '10000'),
      resetTimeout: parseInt(process.env.POOL_CIRCUIT_BREAKER_RESET_TIMEOUT || '30000'),
    },
  },

  // Pool allocation strategy
  allocation: {
    strategy: process.env.POOL_ALLOCATION_STRATEGY || 'ROUND_ROBIN', // ROUND_ROBIN, LEAST_CONNECTIONS, RANDOM, WEIGHTED
    weights: {
      bacen: parseFloat(process.env.POOL_WEIGHT_BACEN || '0.4'),
      iugu: parseFloat(process.env.POOL_WEIGHT_IUGU || '0.3'),
      asaas: parseFloat(process.env.POOL_WEIGHT_ASAAS || '0.2'),
      efi: parseFloat(process.env.POOL_WEIGHT_EFI || '0.1'),
    },
  },

  // Pool health check
  health: {
    checkInterval: parseInt(process.env.POOL_HEALTH_CHECK_INTERVAL || '30000'),
    timeout: parseInt(process.env.POOL_HEALTH_CHECK_TIMEOUT || '5000'),
    unhealthyThreshold: parseInt(process.env.POOL_HEALTH_UNHEALTHY_THRESHOLD || '3'),
  },

  // Pool metrics
  metrics: {
    enabled: process.env.POOL_METRICS_ENABLED === 'true',
    prometheus: {
      enabled: process.env.POOL_METRICS_PROMETHEUS_ENABLED === 'true',
      port: parseInt(process.env.POOL_METRICS_PROMETHEUS_PORT || '9090'),
    },
    logging: {
      enabled: process.env.POOL_METRICS_LOGGING_ENABLED === 'true',
      interval: parseInt(process.env.POOL_METRICS_LOGGING_INTERVAL || '60000'),
    },
  },

  // Pool logging
  logging: {
    level: process.env.POOL_LOG_LEVEL || 'info',
    format: process.env.POOL_LOG_FORMAT || 'json',
    maxFiles: parseInt(process.env.POOL_LOG_MAX_FILES || '10'),
    maxSize: process.env.POOL_LOG_MAX_SIZE || '100m',
    dir: process.env.POOL_LOG_DIR || './logs/pool',
  },

  // Pool security
  security: {
    encryption: {
      enabled: process.env.POOL_ENCRYPTION_ENABLED === 'true',
      algorithm: process.env.POOL_ENCRYPTION_ALGORITHM || 'aes-256-gcm',
      key: process.env.POOL_ENCRYPTION_KEY || '',
    },
    mTLS: {
      enabled: process.env.POOL_MTLS_ENABLED === 'true',
      certPath: process.env.POOL_MTLS_CERT_PATH || '/certs/pool-tls.crt',
      keyPath: process.env.POOL_MTLS_KEY_PATH || '/certs/pool-tls.key',
      caPath: process.env.POOL_MTLS_CA_PATH || '/certs/ca.crt',
    },
  },

  // Pool queue configuration
  queue: {
    enabled: process.env.POOL_QUEUE_ENABLED === 'true',
    type: process.env.POOL_QUEUE_TYPE || 'IN_MEMORY', // IN_MEMORY, REDIS, RABBITMQ, KAFKA
    priorityLevels: parseInt(process.env.POOL_QUEUE_PRIORITY_LEVELS || '5'),
    
    // For Redis queue
    redis: {
      host: process.env.POOL_QUEUE_REDIS_HOST || 'redis',
      port: parseInt(process.env.POOL_QUEUE_REDIS_PORT || '6379'),
      password: process.env.POOL_QUEUE_REDIS_PASSWORD || '',
      db: parseInt(process.env.POOL_QUEUE_REDIS_DB || '4'),
    },
    
    // For Kafka queue
    kafka: {
      brokers: process.env.POOL_QUEUE_KAFKA_BROKERS?.split(',') || ['kafka:9092'],
      topic: process.env.POOL_QUEUE_KAFKA_TOPIC || 'pool-transactions',
      groupId: process.env.POOL_QUEUE_KAFKA_GROUP_ID || 'pool-engine',
    },
  },

  // Pool worker configuration
  worker: {
    count: parseInt(process.env.POOL_WORKER_COUNT || '4'),
    concurrency: parseInt(process.env.POOL_WORKER_CONCURRENCY || '10'),
    shutdownTimeout: parseInt(process.env.POOL_WORKER_SHUTDOWN_TIMEOUT || '30000'),
  },

  // Pool integration with LOWDATAESC
  lowdataesc: {
    api: {
      baseUrl: process.env.LOWDATAESC_API_URL || 'https://api.lowdataesc.company.com',
      timeout: parseInt(process.env.LOWDATAESC_API_TIMEOUT || '30000'),
    },
    grpc: {
      host: process.env.LOWDATAESC_GRPC_HOST || 'lowdataesc.company.com',
      port: parseInt(process.env.LOWDATAESC_GRPC_PORT || '50051'),
      timeout: parseInt(process.env.LOWDATAESC_GRPC_TIMEOUT || '10000'),
    },
    syncInterval: parseInt(process.env.LOWDATAESC_SYNC_INTERVAL || '60000'),
  },
});
