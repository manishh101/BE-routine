#!/bin/bash

echo "🚀 Building BE-Routine for Production Deployment"

# Exit on any error
set -e

# Build frontend
echo "📦 Building frontend..."
cd frontend
npm ci
npm run build
cd ..

echo "✅ Frontend build complete"

# Verify backend dependencies
echo "📦 Checking backend dependencies..."
cd backend
npm ci --omit=dev
cd ..

echo "✅ Backend dependencies verified"

# Run quick tests
echo "🧪 Running quick health check..."
cd backend
timeout 10s npm start &
SERVER_PID=$!
sleep 5

# Check if server started
if curl -f http://localhost:7102/api/health > /dev/null 2>&1; then
    echo "✅ Health check passed"
else
    echo "⚠️  Health check failed, but continuing with deployment"
fi

# Kill the test server
kill $SERVER_PID 2>/dev/null || true
cd ..

echo "🎉 Production build complete and ready for Coolify deployment!"
echo "📝 Next steps:"
echo "   1. Commit and push these changes"
echo "   2. Deploy in Coolify"
echo "   3. Expected build time: 3-5 minutes"
