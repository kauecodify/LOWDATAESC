export default () => ({
  // Service configuration
  service: {
    name: process.env.SERVICE_NAME || 'ingest-service',
    version: process.env.SERVICE_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '8443'),
    host: process.env.HOST || '0.0.0.0',
  },

  // Database configuration
  database: {
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'revenue_user',
    password: process.env.DB_PASSWORD || 'revenue_pass',
    name: process.env.DB_NAME || 'revenue_share',
    schema: process.env.DB_SCHEMA || 'ingest',
    ssl: process.env.DB_SSL === 'true',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
    timeout: parseInt(process.env.DB_TIMEOUT || '5000'),
  },

  // Kafka configuration
  kafka: {
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092'],
    clientId: process.env.KAFKA_CLIENT_ID || 'ingest-service',
    groupId: process.env.KAFKA_GROUP_ID || 'ingest-service-group',
    topic: {
      revenueEvents: process.env.KAFKA_TOPIC_REVENUE_EVENTS || 'revenue-events',
      deadLetter: process.env.KAFKA_TOPIC_DEAD_LETTER || 'revenue-events-dlq',
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

  // Redis configuration for idempotency
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0'),
    ttl: parseInt(process.env.REDIS_TTL || '86400'), // 24 hours
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
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
      max: parseInt(process.env.RATE_LIMIT_MAX || '1000'), // 1000 requests
    },
  },

  // Idempotency configuration
  idempotency: {
    enabled: process.env.IDEMPOTENCY_ENABLED !== 'false',
    ttl: parseInt(process.env.IDEMPOTENCY_TTL || '86400'), // 24 hours
    header: process.env.IDEMPOTENCY_HEADER || 'Idempotency-Key',
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
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '10000'), // 10 seconds
    resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000'), // 30 seconds
  },
});
