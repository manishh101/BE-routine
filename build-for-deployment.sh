#!/bin/bash

set -e  # Exit on any error

echo "🚀 Building BE-Routine Project for Production Deployment..."

# Check if required commands exist
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Aborting." >&2; exit 1; }

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf backend/public
rm -rf frontend/dist
rm -rf node_modules
rm -rf backend/node_modules
rm -rf frontend/node_modules

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm ci --only=production

# Install frontend dependencies and build
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm ci

echo "🏗️ Building frontend for production..."
npm run build

# Verify build was successful
if [ ! -d "dist" ]; then
    echo "❌ Frontend build failed - dist directory not found"
    exit 1
fi

# Copy frontend build to backend public folder
echo "📁 Copying frontend build to backend..."
cp -r dist ../backend/public

# Verify copy was successful
if [ ! -d "../backend/public" ]; then
    echo "❌ Failed to copy frontend build to backend"
    exit 1
fi

echo "✅ Build complete! Ready for deployment."
echo ""
echo "📋 Deployment files created:"
echo "   - backend/public/ (Frontend build)"
echo "   - Dockerfile (Production Docker image)"
echo "   - docker-compose.yml (Local testing)"
echo "   - .env.example (Environment variables template)"
echo ""
echo "🔧 Production checklist:"
echo "   ✓ Frontend built and copied to backend/public"
echo "   ✓ Production Dockerfile ready"
echo "   ✓ Environment variables template created"
echo "   ✓ Docker compose for local testing"
echo ""
echo "🌐 Next steps for Coolify deployment:"
echo "   1. Set up MongoDB database (Atlas recommended)"
echo "   2. Copy .env.example to configure environment variables"
echo "   3. Push code to Git repository"
echo "   4. Deploy on Coolify using Dockerfile"
echo "   5. Configure environment variables in Coolify"
echo "   6. Test the deployment"

cd ..
