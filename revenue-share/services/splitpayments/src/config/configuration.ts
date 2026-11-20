export default () => ({
  // Service configuration
  service: {
    name: process.env.SERVICE_NAME || 'split-payment-service',
    version: process.env.SERVICE_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '8446'),
    host: process.env.HOST || '0.0.0.0',
  },

  // Database configuration
  database: {
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'split_user',
    password: process.env.DB_PASSWORD || 'split_pass',
    name: process.env.DB_NAME || 'revenue_share',
    schema: process.env.DB_SCHEMA || 'split_payments',
    ssl: process.env.DB_SSL === 'true',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
    timeout: parseInt(process.env.DB_TIMEOUT || '5000'),
  },

  // Kafka configuration
  kafka: {
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092'],
    clientId: process.env.KAFKA_CLIENT_ID || 'split-payment-service',
    groupId: process.env.KAFKA_GROUP_ID || 'split-payment-service-group',
    topic: {
      paymentInstructions: process.env.KAFKA_TOPIC_PAYMENT_INSTRUCTIONS || 'payment-instructions',
      splitResults: process.env.KAFKA_TOPIC_SPLIT_RESULTS || 'split-results',
      taxCalculations: process.env.KAFKA_TOPIC_TAX_CALCULATIONS || 'tax-calculations',
      complianceEvents: process.env.KAFKA_TOPIC_COMPLIANCE_EVENTS || 'compliance-events',
      escrowEvents: process.env.KAFKA_TOPIC_ESCROW_EVENTS || 'escrow-events',
      webhookEvents: process.env.KAFKA_TOPIC_WEBHOOK_EVENTS || 'webhook-events',
      deadLetter: process.env.KAFKA_TOPIC_DEAD_LETTER || 'split-payment-dlq',
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
    db: parseInt(process.env.REDIS_DB || '3'),
    ttl: parseInt(process.env.REDIS_TTL || '3600'),
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
    // Encryption for tax data
    encryption: {
      algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
      key: process.env.ENCRYPTION_KEY || '',
      ivLength: parseInt(process.env.ENCRYPTION_IV_LENGTH || '16'),
    },
  },

  // Idempotency configuration
  idempotency: {
    enabled: process.env.IDEMPOTENCY_ENABLED !== 'false',
    ttl: parseInt(process.env.IDEMPOTENCY_TTL || '86400'),
    header: process.env.IDEMPOTENCY_HEADER || 'Idempotency-Key',
  },

  // gRPC configuration for LOWDATAESC integration
  grpc: {
    lowdataesc: {
      host: process.env.LOWDATAESC_GRPC_HOST || 'lowdataesc.company.com',
      port: parseInt(process.env.LOWDATAESC_GRPC_PORT || '50051'),
      ssl: process.env.LOWDATAESC_GRPC_SSL === 'true',
      caPath: process.env.LOWDATAESC_GRPC_CA_PATH || '/certs/lowdataesc-ca.crt',
      certPath: process.env.LOWDATAESC_GRPC_CERT_PATH || '/certs/split-payment-service.crt',
      keyPath: process.env.LOWDATAESC_GRPC_KEY_PATH || '/certs/split-payment-service.key',
      timeout: parseInt(process.env.LOWDATAESC_GRPC_TIMEOUT || '10000'),
      retry: {
        maxAttempts: parseInt(process.env.LOWDATAESC_GRPC_MAX_RETRIES || '3'),
        delay: parseInt(process.env.LOWDATAESC_GRPC_RETRY_DELAY || '1000'),
      },
    },
    server: {
      host: process.env.GRPC_SERVER_HOST || '0.0.0.0',
      port: parseInt(process.env.GRPC_SERVER_PORT || '50053'),
      ssl: process.env.GRPC_SERVER_SSL === 'true',
    },
  },

  // BACEN API configuration
  bacen: {
    api: {
      baseUrl: process.env.BACEN_API_URL || 'https://api.bcb.gov.br',
      pixBaseUrl: process.env.BACEN_PIX_URL || 'https://pix.bcb.gov.br',
      timeout: parseInt(process.env.BACEN_API_TIMEOUT || '30000'),
      apiKey: process.env.BACEN_API_KEY || '',
      clientId: process.env.BACEN_CLIENT_ID || '',
      clientSecret: process.env.BACEN_CLIENT_SECRET || '',
    },
    splitPayment: {
      enabled: process.env.BACEN_SPLIT_ENABLED === 'true',
      endpoint: process.env.BACEN_SPLIT_ENDPOINT || '/split-payment/v1',
      maxRetries: parseInt(process.env.BACEN_SPLIT_MAX_RETRIES || '3'),
    },
    taxRates: {
      cbs: {
        endpoint: process.env.BACEN_CBS_RATES_ENDPOINT || '/tax-rates/cbs',
        cacheTtl: parseInt(process.env.BACEN_CBS_CACHE_TTL || '3600'),
      },
      ibs: {
        endpoint: process.env.BACEN_IBS_RATES_ENDPOINT || '/tax-rates/ibs',
        cacheTtl: parseInt(process.env.BACEN_IBS_CACHE_TTL || '3600'),
      },
    },
  },

  // Payment Gateway Adapters (Iugu, Asaas, Efi)
  paymentGateways: {
    iugu: {
      enabled: process.env.IUGU_ENABLED === 'true',
      apiUrl: process.env.IUGU_API_URL || 'https://api.iugu.com/v1',
      apiKey: process.env.IUGU_API_KEY || '',
      accountId: process.env.IUGU_ACCOUNT_ID || '',
      splitEnabled: process.env.IUGU_SPLIT_ENABLED === 'true',
      splitEndpoint: process.env.IUGU_SPLIT_ENDPOINT || '/payments/split',
      webhookToken: process.env.IUGU_WEBHOOK_TOKEN || '',
      timeout: parseInt(process.env.IUGU_TIMEOUT || '30000'),
    },
    asaas: {
      enabled: process.env.ASAAS_ENABLED === 'true',
      apiUrl: process.env.ASAAS_API_URL || 'https://api.asaas.com/v3',
      apiKey: process.env.ASAAS_API_KEY || '',
      splitEnabled: process.env.ASAAS_SPLIT_ENABLED === 'true',
      splitEndpoint: process.env.ASAAS_SPLIT_ENDPOINT || '/payments/split',
      webhookToken: process.env.ASAAS_WEBHOOK_TOKEN || '',
      timeout: parseInt(process.env.ASAAS_TIMEOUT || '30000'),
    },
    efi: {
      enabled: process.env.EFI_ENABLED === 'true',
      apiUrl: process.env.EFI_API_URL || 'https://api.efipay.com.br/v1',
      apiKey: process.env.EFI_API_KEY || '',
      clientId: process.env.EFI_CLIENT_ID || '',
      clientSecret: process.env.EFI_CLIENT_SECRET || '',
      splitEnabled: process.env.EFI_SPLIT_ENABLED === 'true',
      splitEndpoint: process.env.EFI_SPLIT_ENDPOINT || '/payments/split',
      webhookToken: process.env.EFI_WEBHOOK_TOKEN || '',
      timeout: parseInt(process.env.EFI_TIMEOUT || '30000'),
    },
  },

  // Escrow configuration
  escrow: {
    enabled: process.env.ESCROW_ENABLED === 'true',
    defaultAccountPrefix: process.env.ESCROW_ACCOUNT_PREFIX || 'split-escrow',
    autoCreateAccounts: process.env.ESCROW_AUTO_CREATE === 'true',
    retentionDays: parseInt(process.env.ESCROW_RETENTION_DAYS || '30'),
    alertThreshold: parseFloat(process.env.ESCROW_ALERT_THRESHOLD || '10000.00'),
  },

  // SPED Configuration (Receita Federal)
  sped: {
    enabled: process.env.SPED_ENABLED === 'true',
    version: process.env.SPED_VERSION || '2.0',
    filePath: process.env.SPED_FILE_PATH || './sped-output',
    batchSize: parseInt(process.env.SPED_BATCH_SIZE || '100'),
    autoSend: process.env.SPED_AUTO_SEND === 'true',
    webhookUrl: process.env.SPED_WEBHOOK_URL || '',
  },

  // Webhook configuration for Receita Federal
  webhook: {
    receitaFederal: {
      enabled: process.env.RF_WEBHOOK_ENABLED === 'true',
      url: process.env.RF_WEBHOOK_URL || 'https://webhook.receita.fazenda.gov.br/split-payment',
      apiKey: process.env.RF_WEBHOOK_API_KEY || '',
      timeout: parseInt(process.env.RF_WEBHOOK_TIMEOUT || '30000'),
      retry: {
        maxAttempts: parseInt(process.env.RF_WEBHOOK_MAX_RETRIES || '5'),
        delay: parseInt(process.env.RF_WEBHOOK_RETRY_DELAY || '5000'),
      },
    },
    // Internal webhooks
    internal: {
      paymentCallback: process.env.INTERNAL_PAYMENT_CALLBACK || '/api/v1/webhook/payment',
      splitCallback: process.env.INTERNAL_SPLIT_CALLBACK || '/api/v1/webhook/split',
      taxCallback: process.env.INTERNAL_TAX_CALLBACK || '/api/v1/webhook/tax',
    },
  },

  // Split Payment configuration
  splitPayment: {
    // Processing
    maxRetries: parseInt(process.env.SPLIT_MAX_RETRIES || '5'),
    retryDelay: parseInt(process.env.SPLIT_RETRY_DELAY || '5000'),
    processingTimeout: parseInt(process.env.SPLIT_PROCESSING_TIMEOUT || '60000'),
    
    // Idempotency
    idempotencyTtl: parseInt(process.env.SPLIT_IDEMPOTENCY_TTL || '86400'),
    
    // Status tracking
    statusUpdateInterval: parseInt(process.env.SPLIT_STATUS_UPDATE_INTERVAL || '30000'),
    
    // Default tax rates (fallback)
    defaultTaxRates: {
      cbs: parseFloat(process.env.DEFAULT_CBS_RATE || '0.01'), // 1%
      ibs: parseFloat(process.env.DEFAULT_IBS_RATE || '0.02'), // 2%
    },
    
    // Multi-tenant configuration
    multiTenant: {
      enabled: process.env.MULTI_TENANT_ENABLED !== 'false',
      tenantHeader: process.env.TENANT_HEADER || 'X-Consortium-Id',
      defaultTenant: process.env.DEFAULT_TENANT || 'default',
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
    // Audit logging
    audit: {
      enabled: process.env.AUDIT_LOG_ENABLED === 'true',
      s3Bucket: process.env.AUDIT_S3_BUCKET || 'lowdataesc-audit-logs',
      s3Prefix: process.env.AUDIT_S3_PREFIX || 'split-payment',
      wormEnabled: process.env.AUDIT_WORM_ENABLED === 'true',
    },
  },

  // Circuit breaker configuration
  circuitBreaker: {
    enabled: process.env.CIRCUIT_BREAKER_ENABLED === 'true',
    failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
    successThreshold: parseInt(process.env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD || '2'),
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '10000'),
    resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000'),
  },

  // Alert configuration
  alert: {
    enabled: process.env.ALERT_ENABLED === 'true',
    aiOwner: {
      email: process.env.AI_OWNER_EMAIL || 'ai-owner@lowdataesc.gov.br',
      phone: process.env.AI_OWNER_PHONE || '+5561999999999',
      slackChannel: process.env.AI_OWNER_SLACK || '#split-payment-alerts',
    },
    thresholds: {
      paymentFailure: parseInt(process.env.ALERT_PAYMENT_FAILURE_THRESHOLD || '3'),
      splitFailure: parseInt(process.env.ALERT_SPLIT_FAILURE_THRESHOLD || '5'),
      taxCalculationFailure: parseInt(process.env.ALERT_TAX_FAILURE_THRESHOLD || '3'),
      escrowBalance: parseFloat(process.env.ALERT_ESCROW_BALANCE || '100000.00'),
    },
  },
});
