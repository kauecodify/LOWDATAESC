# Revenue Share Ingest Service - Dockerfile
# TR8 Standard - Production Ready
# Multi-stage build for optimized image

# ============================================================================
# BUILD STAGE
# ============================================================================
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/ || true

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
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

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
EXPOSE 8443
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8443/api/v1/health/liveness || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8443
ENV SERVICE_NAME=ingest-service
ENV SERVICE_VERSION=1.0.0

# Runtime configuration
ENV DB_HOST=postgres
ENV DB_PORT=5432
ENV DB_USERNAME=revenue_user
ENV DB_PASSWORD=revenue_pass
ENV DB_NAME=revenue_share
ENV DB_SCHEMA=ingest
ENV DB_SSL=false
ENV DB_SYNC=false

ENV KAFKA_BROKERS=kafka:9092
ENV KAFKA_CLIENT_ID=ingest-service
ENV KAFKA_GROUP_ID=ingest-service-group
ENV KAFKA_TOPIC_REVENUE_EVENTS=revenue-events
ENV KAFKA_TOPIC_DEAD_LETTER=revenue-events-dlq
ENV KAFKA_SSL=false

ENV REDIS_HOST=redis
ENV REDIS_PORT=6379
ENV REDIS_PASSWORD=
ENV REDIS_DB=0
ENV IDEMPOTENCY_TTL=86400

ENV MTLS_ENABLED=false
ENV ALLOWED_ORIGINS=*

# Start the application
CMD ["node", "dist/main"]
