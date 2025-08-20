# Coolify Deployment Guide for BE-Routine

This guide provides step-by-step instructions for deploying the BE-Routine application on Coolify.

## Prerequisites

1. **Coolify Instance**: Have a running Coolify instance
2. **Git Repository**: Code pushed to a Git repository (GitHub, GitLab, etc.)
3. **MongoDB Database**: Either MongoDB Atlas or a managed MongoDB instance
4. **Domain Name**: (Optional) Custom domain for production

## Step-by-Step Deployment

### 1. Prepare Your Git Repository

```bash
# Build the project for production
chmod +x build-for-deployment.sh
./build-for-deployment.sh

# Commit and push to your Git repository
git add .
git commit -m "Production build ready for Coolify deployment"
git push origin main
```

### 2. Set Up MongoDB Database

**Option A: MongoDB Atlas (Recommended)**
1. Create a MongoDB Atlas cluster
2. Get the connection string: `mongodb+srv://username:password@cluster.mongodb.net/be-routine`
3. Whitelist your Coolify server IP or use `0.0.0.0/0` for any IP

**Option B: Self-hosted MongoDB**
1. Deploy MongoDB on your server or use a managed service
2. Get the connection string: `mongodb://username:password@host:port/be-routine`

### 3. Create New Application in Coolify

1. **Log in to Coolify Dashboard**
2. **Create New Resource** → **Application**
3. **Choose Git Repository**:
   - Select your Git provider (GitHub, GitLab, etc.)
   - Select the repository containing your BE-Routine code
   - Choose the `main` branch
   - Set **Auto Deploy** to `true` for automatic deployments

### 4. Configure Build Settings

1. **Build Pack**: Select "Dockerfile"
2. **Dockerfile Location**: Leave as default (`./Dockerfile` in root)
3. **Build Context**: Root directory (`.`)
4. **Port**: 7102
5. **Health Check URL**: `/api/health`
6. **Start Command**: Leave empty (defined in Dockerfile)

### 4.1. Advanced Build Configuration

In the **Build** section, you can optionally set:
- **Build Arguments**: Any Docker build args if needed
- **Build Command**: Leave empty (uses Dockerfile)
- **Install Command**: Leave empty (handled by Dockerfile)

### 5. Configure Environment Variables

Add the following environment variables in Coolify (**Environment** tab):

#### Required Variables (Production)
```env
NODE_ENV=production
PORT=7102
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/be-routine
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRE=7d
FRONTEND_URL=https://your-domain.com
```

#### Optional Variables
```env
USE_RABBITMQ=false
RABBITMQ_URL=amqp://localhost
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your-secure-admin-password
```

#### How to Add Environment Variables in Coolify:
1. Go to your application in Coolify
2. Click on **Environment** tab
3. Click **Add Environment Variable**
4. Enter **Key** and **Value**
5. Set **Build Time** to `false` for runtime variables
6. Set **Preview** and **Production** as needed
7. Click **Save**

#### Security Best Practices:
- **JWT_SECRET**: Generate using `openssl rand -base64 32`
- **MONGODB_URI**: Use connection string with authentication
- **ADMIN_PASSWORD**: Use a strong password (min 12 characters)
- Never commit secrets to Git repository

### 6. Configure Health Checks and Monitoring

1. **Health Check Path**: `/api/health`
2. **Health Check Port**: 7102
3. **Health Check Protocol**: HTTP
4. **Health Check Interval**: 30 seconds
5. **Health Check Timeout**: 10 seconds
6. **Health Check Retries**: 3

#### Health Check Configuration in Coolify:
1. Go to **Health Checks** tab
2. Enable **Health Check**
3. Set **URL**: `/api/health`
4. Set **Port**: `7102`
5. Set **Method**: `GET`
6. Expected **Status Code**: `200`

### 6.1. Resource Limits

Configure resource limits in the **Resources** tab:
- **Memory**: 1GB (minimum), 2GB (recommended)
- **CPU**: 1 core (minimum), 2 cores (recommended)
- **Storage**: 10GB (minimum for logs and temporary files)

### 7. Set Up Domain and SSL

1. **Add Domain**:
   - Go to **Domains** tab in Coolify
   - Click **Add Domain**
   - Enter your domain: `your-domain.com`
   - Optionally add `www.your-domain.com`

2. **SSL Certificate**:
   - Enable **Generate SSL Certificate** (Let's Encrypt)
   - Coolify will automatically handle SSL renewal

3. **DNS Configuration**:
   - Point your domain A record to your Coolify server IP
   - Add CNAME for www subdomain if needed
   - Wait for DNS propagation (5-60 minutes)

#### DNS Records Example:
```
Type    Name    Value                TTL
A       @       your-server-ip       300
A       www     your-server-ip       300
```

### 8. Deploy Application

1. **Initial Deployment**:
   - Click **Deploy** button in Coolify
   - Select **Force Rebuild** for first deployment
   - Monitor **Build Logs** in real-time

2. **Build Process** (typical timeline):
   - **Pulling Repository**: 30 seconds
   - **Building Docker Image**: 5-8 minutes
   - **Starting Container**: 1-2 minutes
   - **Health Check**: 30 seconds

3. **Monitoring Deployment**:
   - Watch logs for any errors
   - Check health check status
   - Verify application startup

#### Build Troubleshooting:
- If build fails, check **Build Logs** tab
- Common issues: missing environment variables, network issues
- Use **Rebuild** button to retry deployment

### 9. Verify Deployment

1. **Health Check**: Visit `https://your-domain.com/api/health`
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

2. **API Documentation**: Visit `https://your-domain.com/api-docs`

3. **Frontend Application**: Visit `https://your-domain.com`

4. **Test API Endpoints**:
   ```bash
   # Test basic endpoints
   curl https://your-domain.com/api/health
   curl https://your-domain.com/api/auth/status
   ```

5. **Check Application Logs**:
   - Go to **Logs** tab in Coolify
   - Look for successful startup messages
   - No error messages in logs

### 10. Post-Deployment Setup

#### Initial Admin Setup:
1. **Create Admin User** (via API):
   ```bash
   curl -X POST https://your-domain.com/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Admin User",
       "email": "admin@yourdomain.com",
       "password": "your-secure-password",
       "role": "admin"
     }'
   ```

2. **Login and Get Token**:
   ```bash
   curl -X POST https://your-domain.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@yourdomain.com",
       "password": "your-secure-password"
     }'
   ```

#### Initial Data Setup:
1. **Create Departments**:
   - Computer Engineering
   - Electronics Engineering
   - Civil Engineering

2. **Create Programs**:
   - BCT (Bachelor of Computer Engineering)
   - BEI (Bachelor of Electronics Engineering)
   - BCE (Bachelor of Civil Engineering)

3. **Add Academic Sessions**:
   - Create current academic year
   - Set semester groups

4. **Test Core Functionality**:
   - ✅ User authentication
   - ✅ Department management
   - ✅ Program creation
   - ✅ Subject management
   - ✅ Teacher management
   - ✅ Room management
   - ✅ Routine generation

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | production | Node.js environment |
| `PORT` | Yes | 7102 | Server port |
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `JWT_SECRET` | Yes | - | JWT signing secret (min 32 chars) |
| `JWT_EXPIRE` | No | 7d | JWT token expiration |
| `FRONTEND_URL` | Yes | - | Frontend URL for CORS |
| `USE_RABBITMQ` | No | false | Enable RabbitMQ queues |
| `RABBITMQ_URL` | No | amqp://localhost | RabbitMQ connection |

## Troubleshooting

### Common Issues and Solutions

#### 1. Build Failures

**Issue**: Docker build fails during npm install
```bash
Solution:
- Check package.json for invalid dependencies
- Clear Docker cache in Coolify
- Verify Node.js version compatibility
```

**Issue**: Frontend build fails
```bash
Solution:
- Check frontend/package.json dependencies
- Verify Vite configuration
- Check for TypeScript errors
```

#### 2. Database Connection Issues

**Issue**: MongoDB connection timeout
```bash
Error: MongooseServerSelectionError: connection timed out
Solution:
- Verify MongoDB URI format
- Check IP whitelist in MongoDB Atlas
- Test connection from server: telnet cluster.mongodb.net 27017
```

**Issue**: Authentication failed
```bash
Error: Authentication failed
Solution:
- Check username/password in connection string
- Verify database user permissions
- Ensure database exists
```

#### 3. Environment Variable Issues

**Issue**: JWT_SECRET not set
```bash
Error: JWT secret is required
Solution:
- Add JWT_SECRET in Coolify environment variables
- Ensure minimum 32 characters length
- Generate secure secret: openssl rand -base64 32
```

**Issue**: CORS errors
```bash
Error: CORS policy blocked
Solution:
- Set correct FRONTEND_URL
- Check CORS_ORIGIN variable
- Verify domain spelling
```

#### 4. SSL and Domain Issues

**Issue**: SSL certificate generation failed
```bash
Solution:
- Verify domain DNS points to server
- Check domain accessibility
- Wait for DNS propagation (up to 24 hours)
- Use Coolify SSL regeneration
```

**Issue**: Domain not accessible
```bash
Solution:
- Check DNS A record points to server IP
- Verify port 80/443 are open
- Check firewall settings
```

#### 5. Application Runtime Issues

**Issue**: Application crashes on startup
```bash
Solution:
- Check application logs in Coolify
- Verify all required environment variables
- Check database connectivity
- Review Docker container resource limits
```

**Issue**: High memory usage
```bash
Solution:
- Increase memory limit in Coolify
- Monitor for memory leaks
- Optimize database queries
- Enable compression middleware
```

### Debugging Commands

```bash
# Check application logs
curl https://your-domain.com/api/health

# Test database connection
curl https://your-domain.com/api/auth/status

# Test specific endpoints
curl -H "Authorization: Bearer YOUR_TOKEN" https://your-domain.com/api/departments

# Check container status in Coolify
# Use Coolify dashboard -> Logs tab
```

### Log Analysis

#### Successful Startup Logs:
```
✅ Database connected successfully
✅ Server running on port 7102
✅ Frontend built successfully
✅ Health check endpoint active
```

#### Error Indicators:
```
❌ MongooseServerSelectionError
❌ JWT secret is required
❌ Port 7102 is already in use
❌ Cannot read property of undefined
```

### Monitoring and Maintenance

#### Application Monitoring:
1. **Health Checks**: Monitor `/api/health` endpoint every 30 seconds
2. **Application Logs**: Regular review through Coolify dashboard
3. **Database Monitoring**: MongoDB Atlas provides built-in metrics
4. **Resource Usage**: Monitor CPU, memory, and storage in Coolify

#### Performance Optimization:
1. **Database Indexing**: Ensure proper MongoDB indexes
2. **Caching**: Consider Redis for session storage
3. **CDN**: Use CDN for static assets
4. **Compression**: Gzip compression enabled in production

#### Regular Maintenance:
1. **Security Updates**: Keep dependencies updated
2. **Database Backups**: Verify automated backups
3. **SSL Renewal**: Automatic with Let's Encrypt
4. **Log Rotation**: Coolify handles log management

#### Monitoring Checklist:
- ✅ Health endpoint responding (200 OK)
- ✅ Database connection stable
- ✅ SSL certificate valid
- ✅ Application logs error-free
- ✅ Resource usage within limits
- ✅ Backup system functional

## Advanced Configuration

### Custom Domain with Multiple Environments

#### Production Domain Setup:
```
Domain: be-routine.yourdomain.com
SSL: Automatic (Let's Encrypt)
Environment: production
```

#### Staging Domain Setup:
```
Domain: staging-be-routine.yourdomain.com
SSL: Automatic (Let's Encrypt)
Environment: staging
```

### Database Configuration Options

#### MongoDB Atlas (Recommended)
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/be-routine?retryWrites=true&w=majority
```

#### Self-hosted MongoDB
```env
MONGODB_URI=mongodb://username:password@mongo-server:27017/be-routine
```

#### MongoDB with Replica Set
```env
MONGODB_URI=mongodb://username:password@mongo1:27017,mongo2:27017,mongo3:27017/be-routine?replicaSet=rs0
```

### Environment-Specific Configurations

#### Production Environment Variables:
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://prod_user:password@prod-cluster.mongodb.net/be-routine
JWT_SECRET=production-super-secret-key-32-chars
FRONTEND_URL=https://be-routine.yourdomain.com
CORS_ORIGIN=https://be-routine.yourdomain.com
RATE_LIMIT_MAX=100
```

#### Staging Environment Variables:
```env
NODE_ENV=staging
MONGODB_URI=mongodb+srv://staging_user:password@staging-cluster.mongodb.net/be-routine-staging
JWT_SECRET=staging-super-secret-key-32-chars
FRONTEND_URL=https://staging-be-routine.yourdomain.com
CORS_ORIGIN=https://staging-be-routine.yourdomain.com
RATE_LIMIT_MAX=1000
```

### Load Balancing and Scaling

#### Horizontal Scaling in Coolify:
1. Go to **Advanced** settings
2. Set **Replicas**: 2-3 instances
3. Configure **Load Balancer**: Round-robin
4. Set **Health Check**: `/api/health`

#### Database Scaling:
- **Read Replicas**: For read-heavy workloads
- **Sharding**: For large datasets
- **Connection Pooling**: MongoDB connection limits

### Security Hardening

#### Additional Security Headers:
```javascript
// Already configured in app.js with Helmet.js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
```

#### Rate Limiting Configuration:
```env
RATE_LIMIT_MAX=100          # Requests per window
RATE_LIMIT_WINDOW_MS=900000 # 15 minutes window
```

#### JWT Security:
```env
JWT_SECRET=minimum-32-character-secret-key
JWT_EXPIRE=7d               # Token expiration
```

### Backup and Disaster Recovery

#### Automated Database Backups:
- **MongoDB Atlas**: Automatic daily backups
- **Retention**: 7 days (free tier), longer for paid plans
- **Point-in-time Recovery**: Available for paid plans

#### Application Code Backup:
- **Git Repository**: Primary backup
- **Multiple Remotes**: GitHub + GitLab for redundancy

#### Disaster Recovery Plan:
1. **Database**: Restore from MongoDB Atlas backup
2. **Application**: Redeploy from Git repository
3. **Environment Variables**: Restore from secure backup
4. **DNS**: Update A records if IP changes

### Performance Tuning

#### Database Optimization:
```javascript
// MongoDB indexes for better performance
db.users.createIndex({ email: 1 })
db.departments.createIndex({ name: 1 })
db.programs.createIndex({ departmentId: 1 })
db.subjects.createIndex({ programId: 1, semester: 1 })
```

#### Application Optimization:
- **Compression**: Gzip enabled
- **Connection Pooling**: MongoDB connection limits
- **Caching**: Response caching for static data
- **CDN**: For static assets (if applicable)

## Complete Deployment Checklist

### Pre-Deployment Checklist

#### Code Preparation:
- [ ] All code committed and pushed to Git repository
- [ ] Production build script tested locally
- [ ] Environment variables documented
- [ ] Database schema up to date
- [ ] Tests passing
- [ ] Security vulnerabilities addressed

#### Infrastructure Preparation:
- [ ] Coolify server accessible and updated
- [ ] MongoDB database created and accessible
- [ ] Domain name purchased and configured
- [ ] SSL certificate requirements understood
- [ ] Backup strategy planned

### Deployment Steps Checklist

#### Repository Setup:
- [ ] Git repository connected to Coolify
- [ ] Correct branch selected (main)
- [ ] Auto-deploy configured

#### Application Configuration:
- [ ] Dockerfile present and tested
- [ ] Build pack set to "Dockerfile"
- [ ] Port 7102 configured
- [ ] Health check path set to `/api/health`

#### Environment Variables:
- [ ] NODE_ENV=production
- [ ] MONGODB_URI configured
- [ ] JWT_SECRET generated (32+ characters)
- [ ] FRONTEND_URL set to domain
- [ ] All optional variables configured as needed

#### Domain and SSL:
- [ ] Domain added to Coolify
- [ ] DNS A record pointing to server
- [ ] SSL certificate generation enabled
- [ ] Domain accessibility verified

#### Security Configuration:
- [ ] Strong JWT secret generated
- [ ] Database credentials secure
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Security headers configured

### Post-Deployment Checklist

#### Verification:
- [ ] Health check endpoint responding (200 OK)
- [ ] Frontend accessible via domain
- [ ] API documentation accessible
- [ ] Database connection working
- [ ] SSL certificate active and valid

#### Functional Testing:
- [ ] User registration working
- [ ] User login working
- [ ] Admin authentication working
- [ ] Department CRUD operations
- [ ] Program CRUD operations
- [ ] Subject management
- [ ] Teacher management
- [ ] Room management
- [ ] Routine generation

#### Performance Testing:
- [ ] Application response time acceptable
- [ ] Database queries optimized
- [ ] Memory usage within limits
- [ ] CPU usage normal
- [ ] No memory leaks detected

#### Security Testing:
- [ ] API endpoints properly protected
- [ ] Admin routes secured
- [ ] Input validation working
- [ ] CORS policy enforced
- [ ] Rate limiting active

### Monitoring Setup:
- [ ] Health monitoring configured
- [ ] Log monitoring setup
- [ ] Database monitoring active
- [ ] Alert notifications configured
- [ ] Backup verification scheduled

### Documentation:
- [ ] Deployment process documented
- [ ] Environment variables documented
- [ ] Admin credentials securely stored
- [ ] Emergency contact information updated
- [ ] Rollback procedure documented

## Quick Start Commands

### Generate JWT Secret:
```bash
openssl rand -base64 32
```

### Test Health Endpoint:
```bash
curl https://your-domain.com/api/health
```

### Test API Authentication:
```bash
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"your-password"}'
```

### Check Application Logs:
```bash
# Use Coolify Dashboard -> Application -> Logs tab
```

### Restart Application:
```bash
# Use Coolify Dashboard -> Application -> Restart button
```

## Security Checklist

- ✅ JWT secret is secure and unique
- ✅ MongoDB credentials are secure
- ✅ HTTPS is enabled
- ✅ CORS is properly configured
- ✅ Rate limiting is enabled
- ✅ Security headers are set (Helmet.js)
- ✅ Input validation is implemented
- ✅ Error messages don't leak sensitive information

## Support and Resources

### Getting Help

#### Coolify Resources:
- **Documentation**: [Coolify Docs](https://coolify.io/docs)
- **Discord Community**: Coolify Discord Server
- **GitHub Issues**: [Coolify GitHub](https://github.com/coollabsio/coolify)

#### BE-Routine Application:
- **Repository**: [Your GitHub Repository]
- **Issues**: Check GitHub issues for common problems
- **Documentation**: See `README.md` and `md/` directory

#### MongoDB Resources:
- **Atlas Documentation**: [MongoDB Atlas Docs](https://docs.atlas.mongodb.com/)
- **Connection Issues**: [MongoDB Connection Guide](https://docs.mongodb.com/manual/reference/connection-string/)

### Emergency Procedures

#### Application Down:
1. Check Coolify dashboard for status
2. Review application logs
3. Verify health check endpoint
4. Check database connectivity
5. Restart application if needed

#### Database Issues:
1. Check MongoDB Atlas dashboard
2. Verify connection string
3. Check IP whitelist
4. Test connectivity from server
5. Contact MongoDB support if needed

#### SSL Certificate Issues:
1. Check domain DNS configuration
2. Verify domain accessibility
3. Regenerate SSL certificate in Coolify
4. Wait for propagation (up to 24 hours)

### Contact Information

For deployment support:
- **System Administrator**: [Your contact information]
- **Database Administrator**: [Database admin contact]
- **Emergency Contact**: [24/7 support contact]

## Summary

This comprehensive deployment guide covers:

✅ **Complete Coolify setup** with step-by-step instructions
✅ **Production-ready configuration** with security best practices
✅ **Environment variable management** with secure defaults
✅ **Domain and SSL configuration** with automatic renewal
✅ **Health monitoring** and performance optimization
✅ **Troubleshooting guide** for common issues
✅ **Backup and recovery** procedures
✅ **Security hardening** with multiple layers of protection
✅ **Performance tuning** for optimal operation
✅ **Comprehensive checklists** for deployment verification

The BE-Routine application is now ready for production deployment on Coolify with enterprise-grade reliability and security.

### Expected Results:
- **Deployment Time**: 10-15 minutes
- **Uptime**: 99.9% availability
- **Performance**: < 500ms response time
- **Security**: Production-grade protection
- **Scalability**: Ready for horizontal scaling

For additional customization or advanced configurations, refer to the individual sections above or contact the development team.
