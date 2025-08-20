# 🏠 Self-Hosting Guide for BE-Routine

This guide provides comprehensive instructions for self-hosting the BE-Routine application on your own server infrastructure.

## 🖥️ Server Requirements

### Minimum System Requirements
- **OS**: Ubuntu 20.04 LTS or higher, CentOS 8+, or Debian 11+
- **CPU**: 2 cores (4 cores recommended)
- **RAM**: 4GB (8GB recommended)
- **Storage**: 50GB SSD (100GB recommended)
- **Network**: Stable internet connection with public IP

### Software Requirements
- **Docker**: 20.10+ with Docker Compose
- **Node.js**: 20.x LTS (if running without Docker)
- **MongoDB**: 7.0+ (Atlas or self-hosted)
- **Nginx**: For reverse proxy (recommended)
- **SSL Certificate**: Let's Encrypt or purchased SSL

## 📦 Installation Methods

### Method 1: Docker Compose (Recommended)

#### Step 1: Server Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

#### Step 2: Clone and Setup Application
```bash
# Clone repository
git clone https://github.com/manishh101/BE-routine.git
cd BE-routine

# Create environment file
cp .env.example .env

# Edit environment variables
nano .env
```

#### Step 3: Configure Environment Variables
```env
# Production Environment Configuration
NODE_ENV=production
PORT=7102

# Database Configuration (MongoDB Atlas recommended)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/be-routine

# Security Configuration
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRE=7d

# Application Configuration
FRONTEND_URL=https://your-domain.com
CORS_ORIGIN=https://your-domain.com

# Optional: Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
```

#### Step 4: Build and Deploy
```bash
# Build the application
chmod +x build-for-deployment.sh
./build-for-deployment.sh

# Deploy with Docker Compose
docker-compose up -d

# Verify deployment
docker-compose ps
docker-compose logs -f app
```

### Method 2: Traditional Installation (Advanced)

#### Step 1: Install Node.js and MongoDB
```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB (Optional - use Atlas instead)
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### Step 2: Application Setup
```bash
# Clone and build application
git clone https://github.com/manishh101/BE-routine.git
cd BE-routine

# Build application
./build-for-deployment.sh

# Install production dependencies
cd backend
npm ci --only=production

# Create systemd service
sudo cp be-routine.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable be-routine
sudo systemctl start be-routine
```

## 🌐 Nginx Reverse Proxy Setup

### Step 1: Install Nginx
```bash
sudo apt update
sudo apt install nginx
```

### Step 2: Configure Nginx
Create `/etc/nginx/sites-available/be-routine`:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Proxy Configuration
    location / {
        proxy_pass http://localhost:7102;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:7102;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://localhost:7102/api/health;
        access_log off;
    }
}
```

### Step 3: Enable Site and SSL
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/be-routine /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Monitoring and Maintenance

### System Monitoring
```bash
# Install monitoring tools
sudo apt install htop iotop nethogs

# Monitor application logs
docker-compose logs -f app  # Docker method
sudo journalctl -u be-routine -f  # Systemd method

# Monitor system resources
htop
```

### Log Management
```bash
# Configure log rotation
sudo nano /etc/logrotate.d/be-routine

# Content:
/var/log/be-routine/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nginx
    endscript
}
```

### Backup Strategy
```bash
# Database backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="$MONGODB_URI" --out="/backup/mongodb_$DATE"
tar -czf "/backup/mongodb_$DATE.tar.gz" "/backup/mongodb_$DATE"
rm -rf "/backup/mongodb_$DATE"

# Keep only last 30 days of backups
find /backup -name "mongodb_*.tar.gz" -mtime +30 -delete

# Application backup
git archive --format=tar.gz --output="/backup/app_$DATE.tar.gz" HEAD
```

## 🔒 Security Hardening

### Firewall Configuration
```bash
# Configure UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### System Security
```bash
# Update system regularly
sudo apt update && sudo apt upgrade -y

# Configure automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart ssh
```

### Application Security
- Use strong JWT secrets (32+ characters)
- Enable HTTPS only
- Regular dependency updates
- Monitor security advisories
- Implement rate limiting
- Use secure database credentials

## 🚨 Troubleshooting

### Common Issues

**Port 7102 already in use:**
```bash
sudo lsof -i :7102
sudo kill -9 <PID>
```

**Database connection issues:**
```bash
# Check MongoDB status
sudo systemctl status mongod
# Check connection string
mongo "mongodb://localhost:27017/be-routine"
```

**Nginx configuration errors:**
```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

**SSL certificate issues:**
```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

### Performance Optimization
- Enable gzip compression
- Implement caching strategies
- Optimize database queries
- Monitor resource usage
- Scale horizontally if needed

## 📱 Mobile and Remote Access

### VPN Setup (Optional)
For secure remote access to admin features:
```bash
# Install WireGuard
sudo apt install wireguard

# Configure VPN server
# ... (WireGuard configuration steps)
```

### Mobile Responsiveness
The application is fully responsive and works on:
- Desktop browsers
- Tablets
- Mobile devices
- Progressive Web App (PWA) capable

## 📞 Support and Maintenance

### Regular Maintenance Tasks
- **Daily**: Check application logs
- **Weekly**: Review performance metrics
- **Monthly**: Update dependencies and system packages
- **Quarterly**: Review security settings and certificates

### Health Monitoring
```bash
# Health check script
#!/bin/bash
HEALTH_URL="https://your-domain.com/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "Application is healthy"
else
    echo "Application health check failed: $RESPONSE"
    # Send alert or restart application
fi
```

### Scaling Considerations
- **Vertical Scaling**: Increase server resources
- **Horizontal Scaling**: Multiple app instances with load balancer
- **Database Scaling**: MongoDB sharding or replica sets
- **CDN**: CloudFlare or AWS CloudFront for static assets

---

## ✅ Self-Hosting Checklist

- [ ] Server provisioned with adequate resources
- [ ] Docker and Docker Compose installed
- [ ] MongoDB database setup (Atlas or self-hosted)
- [ ] Application cloned and built
- [ ] Environment variables configured
- [ ] SSL certificate installed
- [ ] Nginx reverse proxy configured
- [ ] Firewall properly configured
- [ ] Monitoring and logging setup
- [ ] Backup strategy implemented
- [ ] Security hardening completed
- [ ] Health checks configured
- [ ] Documentation and credentials secured

**🎉 Self-Hosting Complete!**

Your BE-Routine application is now successfully self-hosted and production-ready!
