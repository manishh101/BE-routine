# 🚀 Production Deployment Checklist for BE-Routine

## ✅ Pre-Deployment Verification

### 📋 Code Quality & Security
- [x] **Security Headers**: Helmet.js configured with CSP
- [x] **CORS Configuration**: Properly configured for production domains
- [x] **Rate Limiting**: Express rate limit configured (100 req/15min in production)
- [x] **Environment Variables**: Secure JWT secrets, DB credentials
- [x] **Input Validation**: Express-validator implemented
- [x] **Authentication**: JWT-based auth with proper token expiration
- [x] **Error Handling**: Centralized error handling middleware
- [x] **Logging**: Morgan for HTTP request logging

### 🗄️ Database Configuration
- [x] **MongoDB Connection**: Mongoose with proper connection pooling
- [x] **Connection Resilience**: Auto-reconnection and error handling
- [x] **Indexes**: Database indexes for performance optimization
- [x] **Backup Strategy**: MongoDB Atlas auto-backups or manual backup plan

### 🐳 Docker Configuration
- [x] **Multi-stage Build**: Optimized Dockerfile with Alpine Linux
- [x] **Security**: Non-root user (nodejs:1001)
- [x] **Health Checks**: Docker health check every 30s
- [x] **Environment**: Production NODE_ENV setting
- [x] **Build Size**: Optimized image size with .dockerignore

### 🌐 Frontend Build
- [x] **Build Process**: Vite production build
- [x] **Static Assets**: Properly served from backend/public
- [x] **Minification**: CSS/JS minification enabled
- [x] **Asset Optimization**: Images and fonts optimized

## 🏗️ Build Verification

### Run Build Script
```bash
chmod +x build-for-deployment.sh
./build-for-deployment.sh
```

**Expected Output:**
- ✅ Frontend dist/ created
- ✅ Backend public/ populated
- ✅ No build errors
- ✅ Dependencies installed

### Test Docker Build
```bash
docker build -t be-routine:test .
docker run -p 7102:7102 -e NODE_ENV=production -e MONGODB_URI=mongodb://host.docker.internal:27017/be-routine -e JWT_SECRET=test-secret-32-chars-minimum be-routine:test
```

## 🌊 Coolify Deployment Steps

### 1. Repository Setup
- [x] Code pushed to Git repository (GitHub/GitLab)
- [x] Main branch contains latest production code
- [x] All sensitive files (.env) in .gitignore

### 2. Database Setup
**MongoDB Atlas (Recommended):**
```
Connection String: mongodb+srv://username:password@cluster.mongodb.net/be-routine
IP Whitelist: 0.0.0.0/0 (or specific Coolify server IP)
Database: be-routine
```

### 3. Coolify Application Configuration
```
Application Type: Docker
Build Method: Dockerfile
Port: 7102
Health Check: /api/health
Restart Policy: unless-stopped
```

### 4. Environment Variables (Required)
```env
NODE_ENV=production
PORT=7102
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/be-routine
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRE=7d
FRONTEND_URL=https://your-domain.com
```

### 5. Optional Environment Variables
```env
USE_RABBITMQ=false
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
```

### 6. Domain & SSL Setup
- [x] Domain configured in Coolify
- [x] SSL certificate (Let's Encrypt) enabled
- [x] HTTPS redirect enabled

## 🧪 Post-Deployment Testing

### Health Check Verification
```bash
curl https://your-domain.com/api/health
```
**Expected Response:**
```json
{
  "success": true,
  "data": {
    "api": {
      "status": "healthy",
      "timestamp": "2025-01-20T12:00:00.000Z",
      "version": "2.0.0"
    },
    "database": {
      "status": "healthy"
    }
  }
}
```

### API Documentation
- Visit: `https://your-domain.com/api-docs`
- Verify Swagger UI loads properly

### Frontend Application
- Visit: `https://your-domain.com`
- Test user registration/login
- Test core functionality

### Database Connection
- Check Coolify logs for MongoDB connection success
- Verify no connection errors in application logs

## 🔧 Performance Optimization

### Resource Allocation (Coolify)
```
CPU: 1-2 cores (recommended)
Memory: 1-2GB RAM (recommended)
Storage: 10GB minimum
```

### Monitoring Setup
- [x] Application logs monitoring
- [x] Health endpoint monitoring
- [x] Database connection monitoring
- [x] Error rate monitoring

## 🛡️ Security Checklist

### SSL/TLS
- [x] HTTPS enabled
- [x] SSL certificate valid
- [x] HTTP to HTTPS redirect

### Application Security
- [x] JWT secrets are secure (32+ characters)
- [x] Database credentials are secure
- [x] CORS restricted to production domains
- [x] Rate limiting enabled
- [x] Input validation on all endpoints
- [x] No sensitive data in logs

### Infrastructure Security
- [x] Database access restricted
- [x] Server access secured
- [x] Environment variables secured

## 📊 Monitoring & Maintenance

### Regular Checks
- **Daily**: Application logs review
- **Weekly**: Performance metrics review
- **Monthly**: Security updates check
- **Quarterly**: Database optimization

### Backup Strategy
- **Database**: Automated daily backups (MongoDB Atlas)
- **Code**: Git repository serves as code backup
- **Environment**: Secure environment variables backup

### Scaling Considerations
- **Horizontal Scaling**: Multiple app instances behind load balancer
- **Database Scaling**: MongoDB Atlas auto-scaling
- **CDN**: Consider CDN for static assets

## 🚨 Troubleshooting Guide

### Common Issues & Solutions

**Build Failures:**
- Check Node.js version compatibility
- Verify all dependencies in package.json
- Check Dockerfile syntax

**Database Connection Issues:**
- Verify MongoDB URI format
- Check IP whitelist settings
- Test connection from Coolify server

**Environment Variable Issues:**
- Verify variable names (case-sensitive)
- Check for trailing spaces in values
- Ensure JWT_SECRET is minimum 32 characters

**CORS Issues:**
- Verify FRONTEND_URL matches domain
- Check CORS_ORIGIN configuration
- Ensure domain SSL is working

### Emergency Procedures
1. **Application Down**: Check Coolify logs and restart application
2. **Database Issues**: Verify MongoDB Atlas status and connection
3. **SSL Issues**: Renew SSL certificate in Coolify
4. **Performance Issues**: Scale resources or optimize queries

## 📞 Support Resources

- **Coolify Documentation**: https://coolify.io/docs
- **MongoDB Atlas Support**: https://support.mongodb.com
- **Application Logs**: Available in Coolify dashboard
- **Health Endpoint**: `/api/health` for status monitoring

---

## ✅ Final Deployment Verification

Before going live, ensure all items are checked:

- [ ] All environment variables configured
- [ ] Database connection working
- [ ] Health check returning 200
- [ ] Frontend application loading
- [ ] API endpoints responding
- [ ] SSL certificate valid
- [ ] Monitoring setup complete
- [ ] Backup strategy in place
- [ ] Security checklist completed
- [ ] Performance baselines established

**🎉 Deployment Complete!**

Your BE-Routine application is now production-ready and deployed on Coolify!
