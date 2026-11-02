# Revenue Share Liquidação Service - Dockerfile
# TR8 Standard - Production Ready
# Multi-stage build for optimized image with gRPC support

# ============================================================================
# BUILD STAGE
# ============================================================================
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install build dependencies (gRPC requires python for protobuf compilation)
RUN apk add --no-cache python3 py3-pip && \
    pip3 install grpcio-tools

# Install Node.js dependencies
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci && \
    npm cache clean --force

# Copy source files
COPY src/ ./src/
COPY proto/ ./proto/
COPY tsconfig.json ./

# Generate gRPC client code from proto
RUN npm run generate:grpc

# Build TypeScript application
RUN npm run build

# ============================================================================
# PRODUCTION STAGE
# ============================================================================
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/proto ./proto

# Create necessary directories
RUN mkdir -p /app/certs /app/logs /app/tmp

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 8443
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8443/api/v1/health/liveness || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8443
ENV SERVICE_NAME=liquidacao-service
ENV SERVICE_VERSION=1.0.0

# Database configuration
ENV DB_HOST=postgres
ENV DB_PORT=5432
ENV DB_USERNAME=revenue_user
ENV DB_PASSWORD=revenue_pass
ENV DB_NAME=revenue_share
ENV DB_SCHEMA=liquidacao
ENV DB_SSL=false
ENV DB_SYNC=false

# Kafka configuration
ENV KAFKA_BROKERS=kafka:9092
ENV KAFKA_CLIENT_ID=liquidacao-service
ENV KAFKA_GROUP_ID=liquidacao-service-group
ENV KAFKA_TOPIC_SETTLEMENT_INSTRUCTIONS=settlement-instructions
ENV KAFKA_TOPIC_SETTLEMENT_RESULTS=settlement-results
ENV KAFKA_SSL=false

# Redis configuration (for idempotency)
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379
ENV REDIS_PASSWORD=
ENV REDIS_DB=0
ENV IDEMPOTENCY_TTL=86400

# LOWDATAESC gRPC configuration
ENV LOWDATAESC_HOST=lowdataesc-service
ENV LOWDATAESC_PORT=50051
ENV LOWDATAESC_SSL=false
ENV LOWDATAESC_CERT_PATH=/app/certs/lowdataesc.crt

# mTLS configuration
ENV MTLS_ENABLED=false
ENV MTLS_CERT_PATH=/app/certs/server.crt
ENV MTLS_KEY_PATH=/app/certs/server.key
ENV MTLS_CA_PATH=/app/certs/ca.crt

# Settlement configuration
ENV SETTLEMENT_MAX_RETRIES=5
ENV SETTLEMENT_RETRY_DELAY=1000
ENV SETTLEMENT_TIMEOUT=30000
ENV SETTLEMENT_DEFAULT_CURRENCY=BRL

# Allow CORS
ENV ALLOWED_ORIGINS=*

# Start the application
CMD ["node", "dist/main"]
