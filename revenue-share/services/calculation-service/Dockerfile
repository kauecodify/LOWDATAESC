# Revenue Share Calculation Service - Dockerfile
# TR8 Standard - Production Ready
# Multi-stage build for optimized image

# ============================================================================
# BUILD STAGE
# ============================================================================
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1002 -S nodejs && \
    adduser -S nodejs -u 1002

# Install dependencies
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source files
COPY src/ ./src/
COPY tsconfig.json ./
COPY .env ./

# Build TypeScript application
RUN npm run build

# ============================================================================
# PRODUCTION STAGE
# ============================================================================
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1002 -S nodejs && \
    adduser -S nodejs -u 1002

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Create necessary directories
RUN mkdir -p /app/certs /app/logs /app/tmp

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 8444
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8444/api/v1/health/liveness || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8444
ENV SERVICE_NAME=calculation-service
ENV SERVICE_VERSION=1.0.0

# Runtime configuration
ENV DB_HOST=postgres
ENV DB_PORT=5432
ENV DB_USERNAME=revenue_user
ENV DB_PASSWORD=revenue_pass
ENV DB_NAME=revenue_share
ENV DB_SCHEMA=calculation
ENV DB_SSL=false
ENV DB_SYNC=false

ENV KAFKA_BROKERS=kafka:9092
ENV KAFKA_CLIENT_ID=calculation-service
ENV KAFKA_GROUP_ID=calculation-service-group
ENV KAFKA_TOPIC_REVENUE_EVENTS=revenue-events
ENV KAFKA_TOPIC_CALCULATION_REQUESTS=calculation-requests
ENV KAFKA_TOPIC_CALCULATION_RESULTS=calculation-results
ENV KAFKA_TOPIC_DEAD_LETTER=calculation-dlq
ENV KAFKA_SSL=false

ENV REDIS_HOST=redis
ENV REDIS_PORT=6379
ENV REDIS_PASSWORD=
ENV REDIS_DB=1
ENV IDEMPOTENCY_TTL=86400

ENV MTLS_ENABLED=false
ENV ALLOWED_ORIGINS=*

# Calculation-specific configuration
ENV CALCULATION_DECIMAL_PRECISION=8
ENV CALCULATION_DISPLAY_PRECISION=2
ENV CALCULATION_ROUNDING_METHOD=banker
ENV CALCULATION_BASE_CURRENCY=BRL
ENV CALCULATION_MAX_RETRIES=3
ENV CALCULATION_BATCH_SIZE=100
ENV CALCULATION_PROCESSING_TIMEOUT=30000

# Start the application
CMD ["node", "dist/main"]
