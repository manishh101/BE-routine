# Simple single-stage build for Coolify
FROM node:20-alpine

# Install only essential runtime dependencies
RUN apk add --no-cache chromium

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production
ENV PORT=7102

WORKDIR /app

# Copy and install backend dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy backend source
COPY backend/ ./

# Copy pre-built frontend (build frontend locally or in Coolify build command)
COPY frontend/dist ./public

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 7102

# Simple health check
HEALTHCHECK --interval=30s --timeout=10s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:7102/api/health || exit 1

CMD ["npm", "start"]
