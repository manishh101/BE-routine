# Optimized production Dockerfile for BE-Routine
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install frontend dependencies and build
WORKDIR /app/frontend
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Install backend dependencies (production only)
WORKDIR /app/backend
RUN npm ci --omit=dev
COPY backend/ ./

# Production stage  
FROM node:20-alpine

# Install only wget for health checks
RUN apk add --no-cache wget

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/backend/ ./
COPY --from=builder /app/frontend/dist ./public

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

# Set environment
ENV NODE_ENV=production
ENV PORT=7102

EXPOSE 7102

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:7102/api/health || exit 1

CMD ["npm", "start"]
