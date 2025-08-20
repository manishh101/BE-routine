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
RUN npm ci && npm run build

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci --omit=dev

# Production stage
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache chromium wget

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production
ENV PORT=7102

WORKDIR /app

# Copy backend files and node_modules from builder
COPY --from=builder /app/backend/ ./
COPY backend/ ./

# Copy built frontend from builder
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
