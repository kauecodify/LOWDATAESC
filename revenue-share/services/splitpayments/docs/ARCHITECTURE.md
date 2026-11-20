# Split Payment Service - Architecture Documentation

## Overview

The Split Payment Service is a critical component of the LOWDATAESC platform, designed to handle the automatic splitting of payments for CBS (Federal) and IBS (State/Municipal) taxes in compliance with Brazilian fiscal regulations. This document provides a comprehensive overview of the service architecture.

## Architecture Diagram

```
+--------------------------------------------------+
|                 Split Payment Service            |
+--------------------------------------------------+
|                                                  |
|  +------------------+     +------------------+   |
|  |    REST API      |     |    gRPC Server   |   |
|  |  (NestJS)        |     |  (Internal)      |   |
|  +--------+---------+     +--------+---------+   |
|           |                        |             |
|  +--------v---------+     +--------v---------+   |
|  |  Split Controller |     |  Pool Engine     |   |
|  +--------+---------+     +--------+---------+   |
|           |                        |             |
|  +--------v---------+     +--------v---------+   |
|  |  Split Service    |<--->|  Pool Workers     |   |
|  +--------+---------+     +------------------+   |
|           |                                    |
|  +--------v---------+     +------------------+   |
|  | Split Repository  |     |   Adapters        |   |
|  +--------+---------+     +--------+---------+   |
|           |                        |             |
|  +--------v---------+     +--------v---------+   |
|  |  PostgreSQL       |     |  BACEN Adapter    |   |
|  |  (split_payments) |     +--------+---------+   |
|  +------------------+              |             |
|                                    +--------v---------+
|                                    |  Iugu Adapter     |
|                                    +--------+---------+
|                                    |  Asaas Adapter    |
|                                    +--------+---------+
|                                    |  Efi Adapter      |
|                                    +------------------+
|                                                  |
+--------------------------------------------------+
|  External Systems                                  |
+--------------------------------------------------+
|                                                  |
|  +------------------+     +------------------+   |
|  |   BACEN API      |     |  Payment Gateways|   |
|  |   (Pix, Tax)      |     |  (Iugu, Asaas,   |   |
|  +------------------+     |   Efi)           |   |
|                          +--------+---------+   |
|                                   |             |
|                          +--------v---------+   |
|                          |  Receita Federal |   |
|                          |  (Webhook)       |   |
|                          +------------------+   |
+--------------------------------------------------+
```

## Component Architecture

### 1. API Layer

#### REST API (NestJS)
- **Framework**: NestJS 10.x
- **Port**: 8446
- **Protocol**: HTTPS with mTLS
- **Authentication**: JWT, mTLS, API Keys
- **Authorization**: RBAC with permission-based access control

#### gRPC Server
- **Framework**: @grpc/grpc-js
- **Port**: 50053
- **Protocol**: gRPC with SSL/TLS
- **Purpose**: Internal communication with LOWDATAESC services

### 2. Service Layer

#### Split Service
- **Responsibilities**:
  - Transaction creation and management
  - Tax rate consultation (BACEN)
  - Split amount calculation
  - Gateway selection and submission
  - Status monitoring and updates
  - Fallback to escrow
  - SPED file generation
  - Webhook notifications

#### Pool Engine
- **Responsibilities**:
  - Transaction queue management
  - Worker pool management
  - Gateway allocation (Round Robin, Least Connections, Random, Weighted)
  - Health monitoring
  - Circuit breaker implementation
  - Metrics collection

#### Pool Workers
- **Responsibilities**:
  - Transaction processing
  - Gateway communication
  - Retry logic
  - Error handling
  - Status updates

### 3. Repository Layer

#### Split Repository
- **Database**: PostgreSQL
- **Schema**: split_payments
- **Tables**:
  - split_transactions
  - split_escrow_accounts
  - tax_rate_cache
  - split_audit_logs
- **Features**:
  - CRUD operations
  - Complex queries with filters
  - Transaction support
  - Batch operations

### 4. Adapter Layer

#### Payment Gateway Adapters
- **BACEN Adapter**: Direct integration with BACEN API
- **Iugu Adapter**: Integration with Iugu payment gateway
- **Asaas Adapter**: Integration with Asaas payment gateway
- **Efi Adapter**: Integration with Efi payment gateway

#### Common Features
- Split payment submission
- Status checking
- Refund processing
- Health checks
- Error handling

### 5. Messaging Layer

#### Kafka Integration
- **Brokers**: kafka:9092
- **Topics**:
  - payment-instructions
  - split-results
  - tax-calculations
  - compliance-events
  - escrow-events
  - webhook-events
  - split-payment-dlq (Dead Letter Queue)
- **Purpose**: Event-driven architecture, async processing

### 6. Cache Layer

#### Redis Integration
- **Host**: redis:6379
- **Database**: 3
- **Purpose**:
  - Idempotency cache
  - Tax rate cache
  - Session cache
  - Rate limiting

## Data Flow

### 1. Payment Interception Flow

```
1. Payment Initiation (Pix/Boleto)
   |
2. Intercept Payment Request
   |
3. Consult Tax Rates (BACEN)
   |
4. Calculate Split Amounts
   |
5. Create Split Transaction
   |
6. Submit to Pool Engine
   |
7. Allocate to Gateway
   |
8. Submit to Payment Gateway
   |
9. Process Payment
   |
10. Split Funds (Supplier, CBS, IBS)
    |
11. Update Transaction Status
    |
12. Generate SPED File
    |
13. Send Webhook to Receita Federal
    |
14. Confirm Payment Completion
```

### 2. Fallback Flow

```
1. Gateway Submission Fails
   |
2. Increment Retry Counter
   |
3. Check Retry Limit
   |-- Yes --> Retry
   |-- No  --> Fallback to Escrow
       |
4. Create/Update Escrow Account
   |
5. Retain Funds in Escrow
   |
6. Update Transaction Status (ESCROW_RETAINED)
   |
7. Send Alert to AI Owner
   |
8. Wait for Manual Intervention
```

### 3. Tax Calculation Flow

```
1. Get Tax Rates
   |-- Provided in Request --> Use Provided Rates
   |-- Not Provided --> Consult BACEN API
       |
2. Check Cache
   |-- Cached Rates Available --> Use Cache
   |-- Not in Cache --> Fetch from BACEN
       |
3. Calculate Split Amounts
   |
4. CBS Amount = Original Amount * CBS Rate
   |
5. IBS Amount = Original Amount * IBS Rate
   |
6. Supplier Amount = Original Amount - CBS Amount - IBS Amount
   |
7. Return Calculated Amounts
```

## Database Schema

### Main Tables

#### 1. split_transactions
```
+-------------------+--------------+---------------------+---------------------+
| Field             | Type         | Nullable            | Description         |
+-------------------+--------------+---------------------+---------------------+
| id                | UUID         | NO                  | Primary Key         |
| consortium_id     | UUID         | NO                  | Tenant ID           |
| payment_id        | UUID         | NO                  | Original Payment ID |
| transaction_type  | VARCHAR(50)  | NO                  | PAYMENT, REFUND, etc|
| method            | VARCHAR(50)  | NO                  | PIX, BOLETO, etc    |
| status            | VARCHAR(20)  | NO                  | Current Status      |
| original_amount   | DECIMAL(20,2)| NO                  | Amount before tax   |
| currency          | VARCHAR(3)   | NO                  | BRL, USD, etc       |
| tax_info          | JSONB        | NO                  | CBS/IBS tax info    |
| split_amounts     | JSONB        | NO                  | Calculated amounts  |
| gateway_info      | JSONB        | YES                 | Gateway details     |
| transaction_id    | VARCHAR(255) | YES                 | External TX ID      |
| reference_id      | VARCHAR(255) | YES                 | External reference  |
| split_hash        | VARCHAR(512) | NO                  | Idempotency hash    |
| sped_info         | JSONB        | YES                 | SPED file info      |
| webhook_info      | JSONB        | YES                 | Webhook info        |
| escrow_info       | JSONB        | YES                 | Escrow details      |
| error_info        | JSONB        | YES                 | Error details       |
| metadata          | JSONB        | YES                 | Additional metadata |
| created_at        | TIMESTAMP    | NO                  | Creation timestamp  |
| updated_at        | TIMESTAMP    | NO                  | Update timestamp    |
| created_by        | VARCHAR(255) | YES                 | Created by user     |
| updated_by        | VARCHAR(255) | YES                 | Updated by user     |
| ip_address        | VARCHAR(45)  | YES                 | Client IP address   |
| user_agent        | VARCHAR(500) | YES                 | Client user agent   |
+-------------------+--------------+---------------------+---------------------+
```

#### 2. split_escrow_accounts
```
+-------------------+--------------+---------------------+---------------------+
| Field             | Type         | Nullable            | Description         |
+-------------------+--------------+---------------------+---------------------+
| id                | UUID         | NO                  | Primary Key         |
| consortium_id     | UUID         | NO                  | Tenant ID           |
| account_number    | VARCHAR(255) | NO                  | Account number      |
| account_type      | VARCHAR(50)  | NO                  | ESCROW, BANK, etc   |
| account_details   | JSONB        | NO                  | Account details     |
| balance           | DECIMAL(20,2)| NO                  | Current balance     |
| currency          | VARCHAR(3)   | NO                  | BRL, USD, etc       |
| metadata          | JSONB        | YES                 | Additional metadata |
| created_at        | TIMESTAMP    | NO                  | Creation timestamp  |
| updated_at        | TIMESTAMP    | NO                  | Update timestamp    |
| created_by        | VARCHAR(255) | YES                 | Created by user     |
| updated_by        | VARCHAR(255) | YES                 | Updated by user     |
+-------------------+--------------+---------------------+---------------------+
```

#### 3. tax_rate_cache
```
+-------------------+--------------+---------------------+---------------------+
| Field             | Type         | Nullable            | Description         |
+-------------------+--------------+---------------------+---------------------+
| id                | UUID         | NO                  | Primary Key         |
| tax_type          | VARCHAR(20)  | NO                  | CBS or IBS          |
| state_code        | VARCHAR(2)   | YES                 | State code (IBS)    |
| municipality_code | VARCHAR(100) | YES                 | Municipality code   |
| rate              | DECIMAL(10,6)| NO                  | Tax rate percentage |
| valid_from        | TIMESTAMP    | NO                  | Valid from date     |
| valid_to          | TIMESTAMP    | NO                  | Valid to date       |
| source            | VARCHAR(255) | YES                 | Data source         |
| reference         | VARCHAR(100) | YES                 | Reference           |
| created_at        | TIMESTAMP    | NO                  | Creation timestamp  |
| updated_at        | TIMESTAMP    | NO                  | Update timestamp    |
+-------------------+--------------+---------------------+---------------------+
```

#### 4. split_audit_logs
```
+-------------------+--------------+---------------------+---------------------+
| Field             | Type         | Nullable            | Description         |
+-------------------+--------------+---------------------+---------------------+
| id                | UUID         | NO                  | Primary Key         |
| transaction_id    | UUID         | YES                 | Transaction ID      |
| consortium_id     | UUID         | YES                 | Tenant ID           |
| action            | VARCHAR(100) | NO                  | Action performed    |
| before_data       | JSONB        | YES                 | Data before action  |
| after_data        | JSONB        | YES                 | Data after action   |
| metadata          | JSONB        | YES                 | Additional metadata |
| status            | VARCHAR(50)  | YES                 | Action status       |
| error_message     | VARCHAR(255) | YES                 | Error message       |
| created_by        | VARCHAR(255) | YES                 | Created by user     |
| ip_address        | VARCHAR(45)  | YES                 | Client IP address   |
| user_agent        | VARCHAR(500) | YES                 | Client user agent   |
| created_at        | TIMESTAMP    | NO                  | Creation timestamp  |
+-------------------+--------------+---------------------+---------------------+
```

## API Endpoints

### Split Transactions

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | /api/v1/split/transactions | Create split transaction | JWT, mTLS |
| GET | /api/v1/split/transactions/:id | Get transaction by ID | JWT, mTLS |
| GET | /api/v1/split/transactions/payment/:paymentId | Get by payment ID | JWT, mTLS |
| GET | /api/v1/split/transactions | List transactions | JWT, mTLS |
| PUT | /api/v1/split/transactions/:id/status | Update status | JWT, mTLS |

### Webhooks

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | /api/v1/split/webhook | Process gateway webhook | Secret Token |

### SPED

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | /api/v1/split/sped/generate | Generate SPED file | JWT, mTLS |

### Fallback

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | /api/v1/split/fallback/escrow | Manual escrow fallback | JWT, mTLS |

### Tax Rates

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| GET | /api/v1/split/tax-rates | Get tax rates | JWT, mTLS |
| POST | /api/v1/split/tax-rates/refresh | Refresh tax rates | JWT, mTLS |

### Health

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| GET | /health/live | Liveness check | None |
| GET | /health/ready | Readiness check | None |
| GET | /health/status | Full status | None |
| GET | /health/version | Version info | None |

## Security Architecture

### 1. Authentication

#### mTLS (Mutual TLS)
- **Purpose**: Secure service-to-service communication
- **Implementation**: Client certificate validation
- **Certificate Requirements**:
  - Valid certificate from trusted CA
  - Certificate not expired
  - Certificate not revoked
  - Certificate purpose matches usage

#### JWT (JSON Web Tokens)
- **Purpose**: API authentication
- **Algorithm**: RS256
- **Claims**: User ID, roles, permissions, expiration
- **Expiration**: Configurable (default: 1 hour)

#### API Keys
- **Purpose**: Service authentication
- **Storage**: Encrypted in database
- **Rotation**: Regular rotation required

### 2. Authorization

#### RBAC (Role-Based Access Control)
- **Roles**: Admin, User, Auditor, System
- **Permissions**: Granular permission system
- **Implementation**: Decorator-based permission checks

#### Multi-Tenant Isolation
- **Tenant ID**: Required in all requests
- **Data Isolation**: All queries filtered by tenant ID
- **Prevention**: Prevent cross-tenant data access

### 3. Data Protection

#### Encryption at Rest
- **Algorithm**: AES-256-GCM
- **Key Management**: HSM (Hardware Security Module)
- **Scope**: Tax data, sensitive information

#### Encryption in Transit
- **Protocol**: TLS 1.3
- **Cipher Suites**: Strong cipher suites only
- **Certificates**: Valid certificates from trusted CAs

#### Data Masking
- **Sensitive Fields**: Passwords, API keys, tokens
- **Implementation**: Automatic masking in logs
- **Scope**: All logging and monitoring

### 4. Audit Logging

#### Audit Trail
- **Scope**: All operations
- **Storage**: Immutable (WORM)
- **Retention**: Configurable (default: 7 years)
- **Access**: Read-only for auditors

#### S3 WORM
- **Bucket**: lowdataesc-audit-logs
- **Prefix**: split-payment
- **Retention**: 7 years
- **Compliance**: TCU, Receita Federal requirements

## Performance Architecture

### 1. Pool Engine

#### Configuration
- **Max Concurrent Transactions**: 100
- **Transaction Timeout**: 60 seconds
- **Retry Configuration**:
  - Max Attempts: 3
  - Delay: 1 second
  - Backoff Multiplier: 2

#### Allocation Strategies
- **ROUND_ROBIN**: Even distribution across gateways
- **LEAST_CONNECTIONS**: Send to least busy gateway
- **RANDOM**: Random gateway selection
- **WEIGHTED**: Weighted distribution based on gateway capabilities

#### Worker Pool
- **Worker Count**: 4
- **Concurrency per Worker**: 10
- **Total Concurrency**: 40

### 2. Caching

#### Redis Configuration
- **Host**: redis:6379
- **Database**: 3
- **TTL**: Configurable per key type
- **Idempotency Cache**: 24 hours
- **Tax Rate Cache**: 1 hour

### 3. Database Optimization

#### Indexing
- All query fields indexed
- Composite indexes for common queries
- Unique indexes for unique constraints

#### Connection Pooling
- **Pool Size**: 10
- **Timeout**: 5 seconds
- **Idle Timeout**: 30 seconds

### 4. Load Balancing

#### Horizontal Pod Autoscaler
- **Min Replicas**: 3
- **Max Replicas**: 10
- **CPU Target**: 70%
- **Memory Target**: 80%

#### Circuit Breaker
- **Failure Threshold**: 5
- **Success Threshold**: 2
- **Timeout**: 10 seconds
- **Reset Timeout**: 30 seconds

## Deployment Architecture

### Kubernetes

#### Pod Configuration
- **Replicas**: 3 (production), 1 (development)
- **Resources**:
  - Requests: 100m CPU, 256Mi memory
  - Limits: 500m CPU, 512Mi memory
- **Security Context**: Non-root user, read-only filesystem

#### Service Configuration
- **Type**: ClusterIP
- **Ports**:
  - HTTP: 8446
  - gRPC: 50053

#### Ingress Configuration
- **Host**: split-payment.lowdataesc.company.com
- **TLS**: Enabled with Let's Encrypt
- **CORS**: Enabled with configurable origins

#### Network Policy
- **Ingress**: From API Gateway, LOWDATAESC services
- **Egress**: To PostgreSQL, Redis, Kafka, BACEN, Payment Gateways

### Docker

#### Image Configuration
- **Base Image**: node:18-alpine
- **User**: Non-root (1001)
- **Ports**: 8446, 50053
- **Health Check**: Liveness and readiness probes

## Monitoring Architecture

### 1. Metrics

#### Prometheus
- **Endpoint**: /health/status
- **Metrics**:
  - Transactions submitted/processed/failed
  - Queue size
  - Active workers
  - Processing time
  - Gateway health
  - Error rates

#### Custom Metrics
- **Counter**: Transactions, errors, retries
- **Gauge**: Queue size, active connections, processing time
- **Histogram**: Processing time distribution

### 2. Logging

#### Log Levels
- **DEBUG**: Detailed debugging information
- **INFO**: Normal operation information
- **WARN**: Warning messages
- **ERROR**: Error messages

#### Log Format
- **Format**: JSON (production), Text (development)
- **Fields**: Timestamp, level, message, context, trace

#### Log Rotation
- **Max Files**: 10
- **Max Size**: 100MB
- **Directory**: /app/logs

### 3. Alerting

#### Alert Conditions
- **Payment Failures**: 3 consecutive failures
- **Split Failures**: 5 consecutive failures
- **Tax Calculation Failures**: 3 consecutive failures
- **Escrow Balance**: Exceeds threshold
- **Gateway Health**: Gateway becomes unhealthy

#### Alert Destinations
- **Slack**: #split-payment-alerts
- **Email**: ai-owner@lowdataesc.gov.br
- **SMS**: +55 61 999999999
- **PagerDuty**: For critical alerts

## Compliance Architecture

### 1. Regulatory Compliance

#### BACEN
- **Requirements**:
  - Secure API access
  - Proper authentication
  - Data encryption
  - Audit logging
- **Implementation**:
  - OAuth2 authentication
  - TLS 1.3 encryption
  - Complete audit trail

#### Receita Federal
- **Requirements**:
  - SPED file generation
  - Webhook notifications
  - Data retention
- **Implementation**:
  - SPED Contribuições generation
  - Webhook integration
  - 7-year data retention

#### TCU (Tribunal de Contas da União)
- **Requirements**:
  - Complete audit trail
  - Immutable logs
  - Data traceability
- **Implementation**:
  - S3 WORM storage
  - Blockchain-based hashing
  - Complete transaction history

### 2. Data Compliance

#### LGPD (Lei Geral de Proteção de Dados)
- **Requirements**:
  - Data minimization
  - Purpose limitation
  - Storage limitation
  - Security measures
- **Implementation**:
  - Minimal data collection
  - Explicit consent
  - Data retention policies
  - Encryption at rest and in transit

#### LSI (Lei de Segurança da Informação)
- **Requirements**:
  - Data sovereignty
  - Access control
  - Incident response
- **Implementation**:
  - Brazilian data centers
  - RBAC authorization
  - Incident response plan

## Testing Architecture

### 1. Test Types

#### Unit Tests
- **Framework**: Jest
- **Coverage**: Business logic, services, utilities
- **Mocking**: Dependencies mocked
- **Execution**: Fast, isolated

#### Integration Tests
- **Framework**: Jest
- **Coverage**: Module interactions, database queries
- **Environment**: Test database
- **Execution**: Medium speed, integrated

#### E2E Tests
- **Framework**: Jest + Supertest
- **Coverage**: API endpoints, full request/response cycle
- **Environment**: Full application
- **Execution**: Slow, comprehensive

### 2. Test Coverage

#### Target Coverage
- **Unit Tests**: 80%
- **Integration Tests**: 70%
- **E2E Tests**: 60%
- **Overall**: 80%

#### Required Coverage
- **Critical Paths**: 100%
- **Business Logic**: 90%
- **Error Handling**: 90%

### 3. Test Environment

#### Test Database
- **Type**: PostgreSQL
- **Schema**: split_payments_test
- **Initialization**: Test data setup/teardown
- **Isolation**: Separate from production

#### Test Services
- **Kafka**: Embedded Kafka for testing
- **Redis**: Embedded Redis for testing
- **Mock Services**: Mock external services

## CI/CD Architecture

### 1. CI Pipeline

#### Stages
1. **Lint**: Code style checking
2. **Test**: Run all tests
3. **Build**: Build Docker image
4. **Scan**: Security scanning
5. **Deploy**: Deploy to staging

#### Tools
- **GitHub Actions**: CI/CD platform
- **SonarQube**: Code quality analysis
- **Trivy**: Security scanning
- **Docker**: Container building

### 2. CD Pipeline

#### Stages
1. **Staging**: Deploy to staging environment
2. **Testing**: Run integration tests in staging
3. **Approval**: Manual approval for production
4. **Production**: Deploy to production

#### Environments
- **Development**: Local development
- **Staging**: Testing environment
- **Production**: Live environment

#### Deployment Strategy
- **Strategy**: Rolling Update
- **Max Surge**: 25%
- **Max Unavailable**: 15%
- **Rollback**: Automatic on failure

## Disaster Recovery Architecture

### 1. Backup Strategy

#### Database Backup
- **Frequency**: Daily
- **Retention**: 30 days
- **Storage**: Encrypted, air-gapped
- **Verification**: Regular restore tests

#### Log Backup
- **Frequency**: Hourly
- **Retention**: 7 years (for audit logs)
- **Storage**: S3 WORM
- **Verification**: Regular integrity checks

### 2. Failover Strategy

#### Active-Active
- **Configuration**: Multiple replicas
- **Load Balancing**: Kubernetes service
- **Health Checks**: Liveness and readiness probes

#### Active-Passive
- **Configuration**: Standby replicas
- **Failover**: Automatic on primary failure
- **Recovery**: Automatic when primary recovers

### 3. Recovery Procedures

#### RTO (Recovery Time Objective)
- **Critical**: 15 minutes
- **Important**: 1 hour
- **Normal**: 4 hours

#### RPO (Recovery Point Objective)
- **Critical**: 5 minutes
- **Important**: 1 hour
- **Normal**: 24 hours

## Conclusion

The Split Payment Service architecture is designed to meet the stringent requirements of the Brazilian fiscal system while providing high performance, security, and reliability. The service leverages modern technologies and best practices to ensure compliance with BACEN, Receita Federal, and TCU regulations while maintaining the flexibility to adapt to changing requirements.
