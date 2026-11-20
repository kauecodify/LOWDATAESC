# Split Payment Service - Implementation Guide

## Overview

This document provides a comprehensive guide to implementing the Split Payment Service within the LOWDATAESC ecosystem. It covers all aspects of the implementation, from initial setup to production deployment.

## Prerequisites

### Technical Requirements

1. **Node.js**: Version 18.x or higher
2. **TypeScript**: Version 5.x or higher
3. **PostgreSQL**: Version 15.x or higher
4. **Redis**: Version 7.x or higher
5. **Kafka**: Version 3.x or higher
6. **Docker**: For containerized deployment
7. **Kubernetes**: For production deployment (optional)

### Development Environment Setup

```bash
# Install Node.js dependencies
npm install

# Install TypeScript globally (if not already installed)
npm install -g typescript

# Install NestJS CLI globally
npm install -g @nestjs/cli

# Install other required tools
npm install -g prettier eslint
```

## Project Structure

The project is organized into the following main components:

```
splitpayments/
├── src/                          # Main service source code
│   ├── modules/split/            # Split payment module
│   │   ├── entities/             # Database entities
│   │   ├── dto/                  # Data Transfer Objects
│   │   ├── services/             # Business services
│   │   ├── split.controller.ts   # API controller
│   │   ├── split.module.ts       # Module definition
│   │   └── split.repository.ts   # Database repository
│   ├── common/                   # Shared utilities
│   │   ├── kafka/                # Kafka integration
│   │   ├── logger/               # Logging
│   │   ├── grpc/                 # gRPC integration
│   │   ├── idempotency/          # Idempotency handling
│   │   └── guards/               # Authentication guards
│   ├── config/                   # Configuration
│   └── main.ts                   # Application entry point
│
├── pool/                         # Pool engine
│   ├── src/
│   │   ├── engine/               # Pool engine components
│   │   ├── adapters/             # Payment gateway adapters
│   │   └── config/               # Pool configuration
│
├── k8s/                          # Kubernetes configurations
├── tests/                        # Test suites
├── docs/                         # Documentation
└── docker-compose.yml            # Development environment
```

## Step-by-Step Implementation

### Step 1: Database Setup

#### Create Database Schema

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE revenue_share;

# Create user
CREATE USER split_user WITH PASSWORD 'split_pass';

# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE revenue_share TO split_user;

# Connect to database
\c revenue_share

# Create schema
CREATE SCHEMA split_payments;

# Grant schema permissions
GRANT ALL PRIVILEGES ON SCHEMA split_payments TO split_user;
```

#### Initialize Database

```bash
# Using psql
psql -U split_user -d revenue_share -f init-db.sql

# Or using Docker
docker exec -i postgres psql -U split_user -d revenue_share < init-db.sql
```

### Step 2: Configuration Setup

#### Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your specific configuration:

```env
# Service Configuration
SERVICE_NAME=split-payment-service
SERVICE_VERSION=1.0.0
NODE_ENV=development
PORT=8446
HOST=0.0.0.0

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=split_user
DB_PASSWORD=split_pass
DB_NAME=revenue_share
DB_SCHEMA=split_payments
DB_SSL=false
DB_SYNC=true

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=3

# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=split-payment-service
KAFKA_GROUP_ID=split-payment-service-group

# BACEN Configuration
BACEN_API_URL=https://api.bcb.gov.br
BACEN_API_KEY=your_api_key
BACEN_CLIENT_ID=your_client_id
BACEN_CLIENT_SECRET=your_client_secret

# Payment Gateway Configuration
IUGU_ENABLED=true
IUGU_API_KEY=your_iugu_api_key
IUGU_ACCOUNT_ID=your_iugu_account_id

ASAAS_ENABLED=true
ASAAS_API_KEY=your_asaas_api_key

EFI_ENABLED=true
EFI_API_KEY=your_efi_api_key
EFI_CLIENT_ID=your_efi_client_id
EFI_CLIENT_SECRET=your_efi_client_secret

# Tax Rates
DEFAULT_CBS_RATE=0.01
DEFAULT_IBS_RATE=0.02
```

### Step 3: Install Dependencies

```bash
# Install all dependencies
npm install

# Or for production only
npm install --production
```

### Step 4: Build the Application

```bash
# Build TypeScript files
npm run build

# The output will be in the dist/ directory
```

### Step 5: Run the Application

#### Development Mode

```bash
# Start with hot reload
npm run start:dev

# The service will be available at http://localhost:8446
```

#### Production Mode

```bash
# Start the built application
npm run start:prod

# Or run directly
node dist/main
```

### Step 6: Verify Installation

Check if the service is running:

```bash
# Check health
curl http://localhost:8446/health/live

# Check API documentation
curl http://localhost:8446/api
```

Expected response:
```json
{
  "status": "UP",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "split-payment-service",
  "version": "1.0.0"
}
```

## Docker Deployment

### Build Docker Image

```bash
# Build the Docker image
docker build -t split-payment-service:v1.0.0 .
```

### Run with Docker

```bash
# Run the container
docker run -d \
  --name split-payment-service \
  -p 8446:8446 \
  -p 50053:50053 \
  -e NODE_ENV=production \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_USERNAME=split_user \
  -e DB_PASSWORD=split_pass \
  -e DB_NAME=revenue_share \
  -e DB_SCHEMA=split_payments \
  -e REDIS_HOST=redis \
  -e KAFKA_BROKERS=kafka:9092 \
  split-payment-service:v1.0.0
```

### Docker Compose

For a complete development environment:

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f split-payment-service
```

## Kubernetes Deployment

### Prerequisites

1. Kubernetes cluster (Minikube, EKS, AKS, GKE, etc.)
2. kubectl configured to access the cluster
3. kustomize installed

### Deploy with Kustomize

```bash
# Navigate to k8s directory
cd k8s

# Apply configuration
kubectl apply -k .

# Check deployment status
kubectl get pods -n revenue-share

# Check service
kubectl get svc -n revenue-share
```

### Configure Ingress

```bash
# Apply ingress configuration
kubectl apply -f ingress.yaml

# Check ingress
kubectl get ingress -n revenue-share
```

### Access the Service

```bash
# Get the external IP
kubectl get ingress split-payment-service -n revenue-share

# Access via the configured hostname
curl https://split-payment.lowdataesc.company.com/health/live
```

## Integration with LOWDATAESC

### gRPC Integration

The service integrates with LOWDATAESC via gRPC for internal communication.

#### Configuration

```env
LOWDATAESC_GRPC_HOST=lowdataesc-service.revenue-share.svc.cluster.local
LOWDATAESC_GRPC_PORT=50051
LOWDATAESC_GRPC_SSL=true
```

#### Service Definition

Create a `lowdataesc.proto` file in the `src/proto/` directory:

```protobuf
syntax = "proto3";

package lowdataesc;

service LowDataEscService {
  rpc ProcessSplitPayment (SplitPaymentRequest) returns (SplitPaymentResponse);
  rpc GetTaxRates (TaxRateRequest) returns (TaxRateResponse);
  rpc NotifyCompliance (ComplianceNotification) returns (ComplianceResponse);
}

message SplitPaymentRequest {
  string transactionId = 1;
  string consortiumId = 2;
  double amount = 3;
  string currency = 4;
  string method = 5;
}

message SplitPaymentResponse {
  string status = 1;
  string transactionId = 2;
  string message = 3;
}

message TaxRateRequest {
  string taxType = 1; // CBS or IBS
  string stateCode = 2;
  string municipalityCode = 3;
}

message TaxRateResponse {
  double rate = 1;
  string validFrom = 2;
  string validTo = 3;
}

message ComplianceNotification {
  string transactionId = 1;
  string eventType = 2;
  string status = 3;
}

message ComplianceResponse {
  bool success = 1;
  string message = 2;
}
```

### Kafka Integration

The service uses Kafka for event-driven communication.

#### Topics

- `payment-instructions`: Incoming payment instructions
- `split-results`: Outgoing split results
- `tax-calculations`: Tax calculation events
- `compliance-events`: Compliance notifications
- `escrow-events`: Escrow fallback events
- `webhook-events`: Webhook notifications
- `split-payment-dlq`: Dead letter queue for failed messages

#### Consumer Setup

```typescript
// In main.ts
const kafkaConfig = configService.get('kafka');
const groupId = kafkaConfig?.groupId || 'split-payment-service-group';
const topics = [
  kafkaConfig?.topic?.paymentInstructions || 'payment-instructions',
  kafkaConfig?.topic?.splitResults || 'split-results',
];

for (const topic of topics) {
  kafkaService.consume(
    `${groupId}-${topic}`,
    [topic],
    async (message) => {
      // Process Kafka message
      await splitService.processKafkaMessage(message);
    },
    false
  );
}
```

## API Usage

### Create Split Transaction

```bash
curl -X POST http://localhost:8446/api/v1/split/transactions \
  -H "Content-Type: application/json" \
  -H "X-Consortium-Id: consortium-1" \
  -H "Authorization: Bearer your_token" \
  -d '{
    "consortiumId": "consortium-1",
    "paymentId": "payment-1",
    "transactionType": "PAYMENT",
    "method": "PIX",
    "originalAmount": 10000.00,
    "currency": "BRL",
    "supplierAccount": {
      "externalId": "supplier-1",
      "accountType": "BANK",
      "bankAccount": {
        "bankCode": "104",
        "agency": "0001",
        "accountNumber": "12345678",
        "accountType": "CORRENTE",
        "documentNumber": "12345678901234",
        "documentType": "CNPJ",
        "holderName": "Supplier Name"
      }
    },
    "cbsAccount": {
      "externalId": "cbs-account-1",
      "accountType": "BANK"
    },
    "ibsAccount": {
      "externalId": "ibs-account-1",
      "accountType": "BANK"
    },
    "taxRates": [
      {
        "taxType": "CBS",
        "rate": 0.01
      },
      {
        "taxType": "IBS",
        "rate": 0.02
      }
    ]
  }'
```

### Get Transaction by ID

```bash
curl -X GET http://localhost:8446/api/v1/split/transactions/transaction-1 \
  -H "X-Consortium-Id: consortium-1" \
  -H "Authorization: Bearer your_token"
```

### List Transactions

```bash
curl -X GET "http://localhost:8446/api/v1/split/transactions?consortiumId=consortium-1&status=COMPLETED&page=1&pageSize=20" \
  -H "Authorization: Bearer your_token"
```

### Process Webhook

```bash
curl -X POST http://localhost:8446/api/v1/split/webhook \
  -H "Content-Type: application/json" \
  -H "X-Signature: your_signature" \
  -d '{
    "eventType": "PAYMENT_COMPLETED",
    "transactionId": "transaction-1",
    "gateway": "bacen",
    "gatewayTransactionId": "bacen-tx-1",
    "status": "COMPLETED",
    "data": {
      "amount": 10000.00,
      "currency": "BRL"
    }
  }'
```

### Generate SPED File

```bash
curl -X POST http://localhost:8446/api/v1/split/sped/generate \
  -H "Content-Type: application/json" \
  -H "X-Consortium-Id: consortium-1" \
  -H "Authorization: Bearer your_token" \
  -d '{
    "consortiumId": "consortium-1",
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "transactionIds": ["transaction-1", "transaction-2"]
  }'
```

### Manual Escrow Fallback

```bash
curl -X POST http://localhost:8446/api/v1/split/fallback/escrow \
  -H "Content-Type: application/json" \
  -H "X-Consortium-Id: consortium-1" \
  -H "Authorization: Bearer your_token" \
  -d '{
    "transactionId": "transaction-1",
    "reason": "Gateway timeout"
  }'
```

## Pool Engine Configuration

The Pool Engine is a high-performance component for processing transactions concurrently.

### Configuration Options

```typescript
// In pool.configuration.ts
{
  engine: {
    maxConcurrentTransactions: 100,  // Maximum concurrent transactions
    transactionTimeout: 60000,        // Transaction timeout in ms
    retry: {
      maxAttempts: 3,                  // Maximum retry attempts
      delay: 1000,                    // Initial delay in ms
      backoffMultiplier: 2,           // Backoff multiplier
    },
    batch: {
      enabled: false,                 // Enable batch processing
      size: 50,                       // Batch size
      interval: 5000,                 // Batch interval in ms
    },
    circuitBreaker: {
      enabled: true,                  // Enable circuit breaker
      failureThreshold: 5,            // Failure threshold
      successThreshold: 2,            // Success threshold
      timeout: 10000,                 // Circuit breaker timeout in ms
      resetTimeout: 30000,            // Reset timeout in ms
    },
  },
  
  allocation: {
    strategy: 'ROUND_ROBIN',         // Allocation strategy
    weights: {                       // Gateway weights
      bacen: 0.4,
      iugu: 0.3,
      asaas: 0.2,
      efi: 0.1,
    },
  },
  
  worker: {
    count: 4,                        // Number of workers
    concurrency: 10,                 // Concurrency per worker
    shutdownTimeout: 30000,          // Shutdown timeout in ms
  },
}
```

### Allocation Strategies

1. **ROUND_ROBIN**: Distributes transactions evenly across gateways
2. **LEAST_CONNECTIONS**: Sends to gateway with fewest active connections
3. **RANDOM**: Random gateway selection
4. **WEIGHTED**: Weighted distribution based on gateway capabilities

## Testing

### Run Unit Tests

```bash
npm run test:unit
```

### Run Integration Tests

```bash
npm run test:integration
```

### Run E2E Tests

```bash
npm run test:e2e
```

### Run All Tests with Coverage

```bash
npm run test:cov
```

### Test Configuration

Create a `test` configuration in your `.env`:

```env
NODE_ENV=test
DB_HOST=localhost
DB_PORT=5433
DB_NAME=test_revenue_share
DB_SYNC=true
DB_LOGGING=false
```

## Monitoring and Observability

### Health Checks

```bash
# Liveness check
curl http://localhost:8446/health/live

# Readiness check
curl http://localhost:8446/health/ready

# Full status
curl http://localhost:8446/health/status

# Version information
curl http://localhost:8446/health/version
```

### Metrics

The service exposes Prometheus-compatible metrics at `/health/status`:

```
# HELP pool_transactions_submitted_total Total number of transactions submitted
# TYPE pool_transactions_submitted_total counter
pool_transactions_submitted_total 100

# HELP pool_transactions_processed_total Total number of transactions processed
# TYPE pool_transactions_processed_total counter
pool_transactions_processed_total 95

# HELP pool_queue_size Current queue size
# TYPE pool_queue_size gauge
pool_queue_size 5

# HELP pool_active_workers Number of active workers
# TYPE pool_active_workers gauge
pool_active_workers 4
```

### Logging

Logs are written to:
- Console (stdout/stderr)
- Files in the `logs/` directory
- S3 (for audit logs with WORM)

Log levels:
- ERROR: Critical errors
- WARN: Warnings
- INFO: Information messages
- DEBUG: Debug information

### Alerts

Alerts are configured for:
- Payment failures
- Split calculation failures
- Gateway health issues
- Escrow balance thresholds

Alert destinations:
- Slack
- Email
- SMS
- PagerDuty

## Security

### mTLS Configuration

```env
MTLS_ENABLED=true
MTLS_CERT_PATH=/certs/tls.crt
MTLS_KEY_PATH=/certs/tls.key
MTLS_CA_PATH=/certs/ca.crt
```

### Encryption Configuration

```env
ENCRYPTION_ALGORITHM=aes-256-gcm
ENCRYPTION_KEY=your_encryption_key
ENCRYPTION_IV_LENGTH=16
```

### RBAC Configuration

```typescript
// In rbac.guard.ts
@Permissions('split:create')
@Post('transactions')
createTransaction(@Body() dto: CreateSplitTransactionDto) {
  // Only users with 'split:create' permission can access
}
```

## Troubleshooting

### Common Issues

#### Database Connection Failed

**Symptoms**:
- Service fails to start
- Error: "Connection refused" or "Authentication failed"

**Solutions**:
1. Verify database credentials in `.env`
2. Check if database is running
3. Verify network connectivity
4. Check database logs for errors

```bash
# Test database connection
psql -U split_user -d revenue_share -h localhost -p 5432
```

#### Kafka Connection Failed

**Symptoms**:
- Kafka consumer not starting
- Error: "Connection refused" or "No brokers available"

**Solutions**:
1. Verify Kafka broker addresses in `.env`
2. Check if Kafka is running
3. Verify network connectivity
4. Check Kafka logs for errors

```bash
# Test Kafka connection
kafka-console-producer.sh --broker-list localhost:9092 --topic test
```

#### Redis Connection Failed

**Symptoms**:
- Idempotency not working
- Error: "Connection refused" or "Authentication failed"

**Solutions**:
1. Verify Redis credentials in `.env`
2. Check if Redis is running
3. Verify network connectivity
4. Check Redis logs for errors

```bash
# Test Redis connection
redis-cli -h localhost -p 6379 ping
```

#### Gateway Authentication Failed

**Symptoms**:
- Payment submissions failing
- Error: "Authentication failed" or "Invalid API key"

**Solutions**:
1. Verify API keys in `.env`
2. Check if API keys are still valid
3. Verify gateway is accessible
4. Check gateway logs for errors

#### Service Not Starting

**Symptoms**:
- Service exits immediately after starting
- No error messages

**Solutions**:
1. Check application logs
2. Verify all dependencies are installed
3. Check for syntax errors in code
4. Verify environment variables are set

```bash
# Check logs
npm run start:dev 2>&1 | tee logs.txt
```

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
NODE_ENV=development
```

View debug logs:

```bash
# With Docker
docker logs -f split-payment-service

# Without Docker
npm run start:dev
```

## Performance Tuning

### Database Optimization

1. **Connection Pooling**: Adjust pool size based on load
2. **Indexing**: Ensure all query fields are indexed
3. **Query Optimization**: Use EXPLAIN to analyze slow queries

```env
# Connection pool configuration
DB_POOL_SIZE=20
DB_TIMEOUT=10000
```

### Kafka Optimization

1. **Consumer Groups**: Scale consumers based on load
2. **Batch Size**: Adjust batch size for better throughput
3. **Parallelism**: Increase partition count for parallel processing

```env
# Kafka configuration
KAFKA_RETRIES=5
KAFKA_RETRY_DELAY=2000
```

### Worker Pool Optimization

1. **Worker Count**: Adjust based on CPU cores
2. **Concurrency**: Adjust based on I/O wait
3. **Batch Processing**: Enable for high-throughput scenarios

```env
# Worker configuration
POOL_WORKER_COUNT=8
POOL_WORKER_CONCURRENCY=20
POOL_BATCH_ENABLED=true
POOL_BATCH_SIZE=100
```

## Backup and Recovery

### Database Backup

```bash
# Using pg_dump
pg_dump -U split_user -d revenue_share -F c -f backup.dump

# Restore
pg_restore -U split_user -d revenue_share backup.dump
```

### Automated Backup

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups/split-payment
mkdir -p $BACKUP_DIR

pg_dump -U split_user -d revenue_share -F c -f $BACKUP_DIR/backup_$DATE.dump

# Keep last 30 days
find $BACKUP_DIR -name "*.dump" -mtime +30 -delete
EOF

# Make executable
chmod +x backup.sh

# Add to cron
crontab -e
# Add line: 0 2 * * * /path/to/backup.sh
```

## Compliance

### Audit Requirements

1. **Immutable Logs**: All audit logs are stored with WORM (Write Once, Read Many)
2. **Data Retention**: 7 years for audit logs, financial data
3. **Access Control**: RBAC for all operations
4. **Encryption**: All sensitive data encrypted at rest and in transit

### SPED Compliance

1. **File Generation**: Automatic SPED Contribuições file generation
2. **Validation**: Validate SPED files before submission
3. **Submission**: Automatic submission to Receita Federal
4. **Confirmation**: Webhook confirmation from Receita Federal

### TCU Compliance

1. **Audit Trail**: Complete audit trail for all operations
2. **Traceability**: Full traceability from payment to settlement
3. **Reporting**: Generate reports for TCU audits
4. **Data Integrity**: Ensure data cannot be modified or deleted

## Scaling

### Horizontal Scaling

```bash
# Scale Kubernetes deployment
kubectl scale deployment split-payment-service -n revenue-share --replicas=5

# Check HPA
kubectl get hpa -n revenue-share
```

### Vertical Scaling

```yaml
# In deployment.yaml
resources:
  requests:
    cpu: "500m"
    memory: "1Gi"
  limits:
    cpu: "2000m"
    memory: "2Gi"
```

### Database Scaling

1. **Read Replicas**: Add read replicas for read-heavy workloads
2. **Connection Pooling**: Increase pool size
3. **Partitioning**: Partition large tables
4. **Sharding**: Shard database for horizontal scaling

## Upgrades

### Version Upgrades

1. **Check Current Version**:
   ```bash
   curl http://localhost:8446/health/version
   ```

2. **Upgrade Service**:
   ```bash
   # Stop service
   docker stop split-payment-service
   
   # Pull new image
   docker pull registry.company.com/revenue-share/split-payment-service:v2.0.0
   
   # Start with new version
   docker run -d --name split-payment-service ... registry.company.com/revenue-share/split-payment-service:v2.0.0
   ```

3. **Rollback**:
   ```bash
   # Stop new version
   docker stop split-payment-service
   
   # Start old version
   docker run -d --name split-payment-service ... registry.company.com/revenue-share/split-payment-service:v1.0.0
   ```

### Database Migrations

1. **Create Migration**:
   ```bash
   # Using TypeORM
   npm run typeorm migration:create -n AddNewField
   ```

2. **Generate Migration**:
   ```bash
   npm run typeorm migration:generate -n AddNewField
   ```

3. **Run Migration**:
   ```bash
   npm run typeorm migration:run
   ```

4. **Revert Migration**:
   ```bash
   npm run typeorm migration:revert
   ```

## Maintenance

### Regular Tasks

1. **Log Rotation**: Configure log rotation to prevent disk fill
2. **Database Maintenance**: Regular VACUUM and ANALYZE
3. **Certificate Rotation**: Rotate TLS certificates regularly
4. **Dependency Updates**: Update dependencies regularly
5. **Security Scanning**: Regular security scans

### Monitoring Tasks

1. **Health Checks**: Monitor service health
2. **Performance Metrics**: Monitor performance metrics
3. **Error Rates**: Monitor error rates
4. **Resource Usage**: Monitor CPU, memory, disk usage
5. **Alerts**: Respond to alerts promptly

## Conclusion

This implementation guide provides a comprehensive overview of setting up, configuring, and deploying the Split Payment Service. The service is designed to be highly available, scalable, and compliant with Brazilian fiscal regulations. It integrates seamlessly with the LOWDATAESC ecosystem and provides automatic tax calculation, split payment processing, and compliance reporting.

For additional information, refer to the:
- [Architecture Documentation](ARCHITECTURE.md)
- [API Documentation](https://split-payment.lowdataesc.company.com/api)
- [LOWDATAESC Main Documentation](../../../lowdataesc-v2/README.md)
