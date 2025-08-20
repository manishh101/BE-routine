# Optimized build for Coolify deployment
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files for better caching
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install frontend dependencies and build
WORKDIR /app/frontend
COPY frontend/ ./
RUN npm ci && npm run build

# Install backend dependencies
WORKDIR /app/backend
COPY backend/ ./
RUN npm ci --omit=dev

# Production stage
FROM node:20-alpine

# Install minimal runtime dependencies
RUN apk add --no-cache wget

# Set environment variables
ENV NODE_ENV=production
ENV PORT=7102

WORKDIR /app

# Copy backend source and built frontend
COPY --from=builder /app/backend/ ./
COPY --from=builder /app/frontend/dist ./public

# Create non-root user and set permissions
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 7102

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:7102/api/health || exit 1

CMD ["npm", "start"]
