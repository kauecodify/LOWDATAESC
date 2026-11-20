# Split Payment Service

## Overview

The Split Payment Service is a critical component of the LOWDATAESC platform, designed to handle the automatic splitting of payments for CBS (Federal) and IBS (State/Municipal) taxes in compliance with Brazilian fiscal regulations. This service integrates with BACEN (Central Bank of Brazil) APIs and various payment gateways (Iugu, Asaas, Efi) to ensure proper tax collection and distribution.

## Architecture

### Service Components

1. **Main Service**: NestJS-based REST API for split payment operations
2. **Pool Engine**: High-performance transaction processing pool with intelligent gateway allocation
3. **Adapters**: Integration with BACEN, Iugu, Asaas, and Efi payment gateways
4. **Database**: PostgreSQL with multi-tenant support
5. **Messaging**: Kafka for event-driven architecture
6. **Cache**: Redis for idempotency and caching
7. **gRPC**: Integration with LOWDATAESC core services

### Key Features

- **Automatic Tax Calculation**: Consults current CBS and IBS rates from BACEN
- **Split Payment Processing**: Divides payments into supplier, CBS, and IBS portions
- **Gateway Integration**: Supports multiple payment gateways with automatic failover
- **Escrow Fallback**: Retains funds in escrow when gateway fails
- **SPED Generation**: Automatically generates SPED Contribuições files
- **Webhook Integration**: Sends confirmations to Receita Federal
- **Idempotency**: Ensures each transaction is processed exactly once
- **Multi-tenant**: Supports multiple consortiums with isolated data
- **Audit Trail**: Complete audit logging for TCU and Receita Federal compliance

## Requirements

### Functional Requirements

1. **Payment Interception**: Intercept payments (Pix or Boleto) from consortium/municipality to supplier
2. **Tax Rate Consultation**: Consult current CBS (Federal) and IBS (State/Municipal) rates from BACEN
3. **Automatic Split**: Use BACEN's Split Payment API or gateway adapters to split payment into:
   - Supplier net amount
   - CBS amount (to Comitê Gestor account)
   - IBS amount (to federative entity account)
4. **SPED Generation**: Automatically generate SPED Contribuições files
5. **Webhook Confirmation**: Send webhook confirmations to Receita Federal
6. **Escrow Fallback**: Retain funds in escrow account when gateway fails
7. **Alert System**: Send alerts to AI Owner when issues occur

### Technical Requirements

- **Language**: TypeScript (NestJS) for main service, Python for tax-audit-ai
- **Database**: PostgreSQL with split_transactions table
- **Security**: End-to-end encryption for tax data, immutable audit logs in S3 (WORM)
- **Idempotency**: All transactions are idempotent
- **Traceability**: Complete traceability for TCU and Receita Federal audits

## Project Structure

```
revenue-share/services/splitpayments/
├── src/
│   ├── modules/
│   │   ├── split/
│   │   │   ├── entities/          # Database entities
│   │   │   ├── dto/               # Data Transfer Objects
│   │   │   ├── services/          # Business logic services
│   │   │   ├── split.controller.ts
│   │   │   ├── split.module.ts
│   │   │   └── split.repository.ts
│   │   └── health/               # Health check module
│   ├── common/                    # Shared utilities
│   │   ├── kafka/                # Kafka integration
│   │   ├── logger/               # Logging
│   │   ├── grpc/                 # gRPC integration
│   │   ├── idempotency/          # Idempotency handling
│   │   ├── filters/              # Exception filters
│   │   └── guards/               # Authentication guards
│   ├── config/                    # Configuration
│   │   └── configuration.ts
│   ├── proto/                     # Protocol Buffers
│   └── main.ts                    # Application entry point
│
├── pool/
│   ├── src/
│   │   ├── engine/               # Pool engine
│   │   │   ├── pool.engine.ts    # Main pool engine
│   │   │   ├── pool.queue.ts     # Transaction queue
│   │   │   ├── pool.worker.ts    # Worker implementation
│   │   │   ├── pool.health.service.ts
│   │   │   └── pool.metrics.ts   # Metrics collection
│   │   ├── adapters/             # Payment gateway adapters
│   │   │   ├── bacen.adapter.ts
│   │   │   ├── iugu.adapter.ts
│   │   │   ├── asaas.adapter.ts
│   │   │   └── efi.adapter.ts
│   │   ├── services/             # Pool services
│   │   │   └── logger.service.ts
│   │   └── config/               # Pool configuration
│   │       └── pool.configuration.ts
│
├── k8s/                          # Kubernetes configurations
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── kustomization.yaml
│   ├── service-account.yaml
│   ├── ingress.yaml
│   ├── hpa.yaml
│   ├── pdb.yaml
│   ├── network-policy.yaml
│   └── patches/
│       ├── production.yaml
│       └── development.yaml
│
├── tests/                        # Test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/                         # Documentation
│
├── package.json
├── tsconfig.json
└── README.md
```

## Database Schema

### Main Tables

1. **split_transactions**: Main transaction table with all split payment data
2. **split_escrow_accounts**: Escrow accounts for fallback scenarios
3. **tax_rate_cache**: Cached tax rates from BACEN
4. **split_audit_logs**: Complete audit trail for compliance

### Key Fields (split_transactions)

- `id`: UUID primary key
- `consortiumId`: Multi-tenant identifier
- `paymentId`: Reference to original payment
- `splitHash`: Unique hash for idempotency
- `originalAmount`: Amount before tax split
- `taxInfo`: CBS and IBS tax information
- `splitAmounts`: Calculated split amounts
- `gatewayInfo`: Payment gateway information
- `spedInfo`: SPED file generation info
- `webhookInfo`: Webhook confirmation info
- `escrowInfo`: Escrow fallback info
- `status`: Current transaction status
- `createdAt`, `updatedAt`: Timestamps

## API Endpoints

### Split Transactions

- `POST /api/v1/split/transactions` - Create new split transaction
- `GET /api/v1/split/transactions/:id` - Get transaction by ID
- `GET /api/v1/split/transactions/payment/:paymentId` - Get transaction by payment ID
- `GET /api/v1/split/transactions` - List transactions with filters
- `PUT /api/v1/split/transactions/:id/status` - Update transaction status

### Webhooks

- `POST /api/v1/split/webhook` - Process gateway webhook callback

### SPED

- `POST /api/v1/split/sped/generate` - Generate SPED file

### Fallback

- `POST /api/v1/split/fallback/escrow` - Manual fallback to escrow

### Tax Rates

- `GET /api/v1/split/tax-rates` - Get current tax rates
- `POST /api/v1/split/tax-rates/refresh` - Refresh tax rates from BACEN

### Health

- `GET /health/live` - Liveness check
- `GET /health/ready` - Readiness check
- `GET /health/status` - Full health status
- `GET /health/version` - Version information

## Configuration

### Environment Variables

See `k8s/configmap.yaml` for complete list of configuration options.

### Key Configuration Sections

1. **Service**: Service name, version, environment
2. **Database**: PostgreSQL connection details
3. **Kafka**: Broker configuration and topics
4. **Redis**: Cache configuration
5. **gRPC**: LOWDATAESC integration
6. **BACEN**: BACEN API configuration
7. **Payment Gateways**: Iugu, Asaas, Efi configurations
8. **Escrow**: Escrow account configuration
9. **SPED**: SPED file generation configuration
10. **Webhook**: Webhook endpoints and retries
11. **Split Payment**: Processing timeouts and retries
12. **Security**: mTLS, encryption, rate limiting
13. **Logging**: Log levels and formats
14. **Circuit Breaker**: Failure thresholds

## Pool Engine

The Pool Engine is a high-performance component that manages concurrent transaction processing with intelligent gateway allocation.

### Features

- **Concurrent Processing**: Handles multiple transactions simultaneously
- **Gateway Allocation**: Intelligent allocation based on strategy (Round Robin, Least Connections, Random, Weighted)
- **Health Monitoring**: Continuous health checks for all gateways
- **Metrics Collection**: Comprehensive metrics for monitoring
- **Circuit Breaker**: Automatic failover when gateways are unhealthy

### Allocation Strategies

1. **ROUND_ROBIN**: Distributes transactions evenly across gateways
2. **LEAST_CONNECTIONS**: Sends to gateway with fewest active connections
3. **RANDOM**: Random gateway selection
4. **WEIGHTED**: Weighted distribution based on gateway capabilities

## Adapters

### BACEN Adapter

- **Authentication**: OAuth2 client credentials
- **Split Payment**: Submit split payments to BACEN
- **Tax Rates**: Retrieve CBS and IBS rates
- **Status**: Check transaction status
- **Refund**: Process refunds

### Iugu Adapter

- **API Key**: Basic authentication
- **Split Payment**: Submit split payments
- **Status**: Check transaction status
- **Refund**: Process refunds

### Asaas Adapter

- **API Key**: Bearer token authentication
- **Split Payment**: Submit split payments
- **Status**: Check transaction status
- **Refund**: Process refunds

### Efi Adapter

- **OAuth2**: Client credentials authentication
- **Split Payment**: Submit split payments
- **Status**: Check transaction status
- **Refund**: Process refunds

## Security

### mTLS

- Client certificate validation
- Mutual TLS authentication
- Certificate revocation checking

### Encryption

- AES-256-GCM for data at rest
- TLS 1.3 for data in transit
- End-to-end encryption for tax data

### Audit Logging

- Complete audit trail for all operations
- Immutable logs stored in S3 with WORM
- Compliance with TCU and Receita Federal requirements

### Rate Limiting

- Configurable rate limits
- Protection against abuse
- Fair resource allocation

## Deployment

### Kubernetes

```bash
# Apply configuration
kubectl apply -f k8s/

# Or use kustomize
kubectl apply -k k8s/
```

### Docker

```bash
# Build image
docker build -t split-payment-service:v1.0.0 .

# Run container
docker run -p 8446:8446 -p 50053:50053 split-payment-service:v1.0.0
```

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev

# Run tests
npm test

# Run linting
npm run lint

# Build for production
npm run build
```

## Monitoring

### Metrics

- **Prometheus**: Metrics endpoint at `/health/status`
- **Custom Metrics**: Transaction counts, processing times, error rates
- **Gateway Metrics**: Connection counts, health status, response times

### Health Checks

- **Liveness**: `/health/live` - Service is running
- **Readiness**: `/health/ready` - Service is ready to receive requests
- **Status**: `/health/status` - Full health status with component details

### Alerts

- **Payment Failures**: Alert when payment processing fails
- **Split Failures**: Alert when split calculation fails
- **Tax Calculation Failures**: Alert when tax rate consultation fails
- **Escrow Balance**: Alert when escrow balance exceeds threshold
- **Gateway Health**: Alert when gateways are unhealthy

## Compliance

### Regulatory Requirements

- **BACEN**: Compliance with Central Bank regulations
- **Receita Federal**: Compliance with tax authority requirements
- **TCU**: Compliance with Tribunal de Contas da União audit requirements
- **LGPD**: Compliance with data protection regulations

### Audit Requirements

- **Idempotency**: Each transaction processed exactly once
- **Traceability**: Complete traceability from payment to settlement
- **Immutability**: Audit logs cannot be modified or deleted
- **Retention**: Data retained for required periods
- **Encryption**: Sensitive data encrypted at rest and in transit

## Testing

### Unit Tests

```bash
npm run test:unit
```

### Integration Tests

```bash
npm run test:integration
```

### E2E Tests

```bash
npm run test:e2e
```

### Test Coverage

```bash
npm run test:cov
```

## Troubleshooting

### Common Issues

1. **Gateway Connection Failed**: Check gateway configuration and network connectivity
2. **Database Connection Failed**: Verify database credentials and network access
3. **Kafka Connection Failed**: Check Kafka broker configuration
4. **Authentication Failed**: Verify API keys and credentials
5. **Rate Limit Exceeded**: Check rate limit configuration

### Debug Mode

Enable debug logging by setting `LOG_LEVEL=debug` in environment variables.

### Health Check

Check service health at `/health/status` endpoint.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the terms of the UNLICENSED license.

## Contact

- **Maintainer**: LOWDATAESC Team
- **Email**: split-payment@lowdataesc.gov.br
- **Support**: For production issues, contact the SOC team

## Version History

- **1.0.0**: Initial release
  - Split payment processing
  - BACEN integration
  - Gateway adapters
  - Escrow fallback
  - SPED generation
  - Webhook integration
  - Complete audit logging
