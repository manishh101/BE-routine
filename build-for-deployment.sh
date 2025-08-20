#!/bin/bash

echo "🚀 Building BE-Routine Project for Deployment..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf backend/public
rm -rf frontend/dist

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install --production

# Install frontend dependencies and build
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install

echo "🏗️ Building frontend..."
npm run build

# Copy frontend build to backend public folder
echo "📁 Copying frontend build to backend..."
cp -r dist ../backend/public

echo "✅ Build complete! Ready for deployment."
echo ""
echo "📋 Deployment files created:"
echo "   - backend/public/ (Frontend build)"
echo "   - Dockerfile"
echo "   - render.yaml (Render config)"
echo ""
echo "🌐 Next steps:"
echo "   1. Push to GitHub"
echo "   2. Deploy to Render, Railway, or Heroku"
echo "   3. Set environment variables"
