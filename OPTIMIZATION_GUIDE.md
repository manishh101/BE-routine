# Production Optimization Guide for BE-Routine System

## 🚀 Quick Wins - Immediate Impact

### 1. Frontend Optimizations

#### A. Vite Build Configuration
Update `frontend/vite.config.js` for production optimization:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Analyze bundle size in production
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
  ],
  
  build: {
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
      },
    },
    
    // Code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-antd': ['antd', '@ant-design/icons'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-charts': ['recharts'],
        },
      },
    },
    
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    
    // Source maps for debugging (disable for production)
    sourcemap: false,
  },
  
  server: {
    port: 7105,
    proxy: {
      '/api': {
        target: 'http://localhost:7102',
        changeOrigin: true,
        secure: false,
      },
    },
    cors: true,
  },
})
```

#### B. Lazy Loading Components
Update main routes to use lazy loading:

```javascript
// frontend/src/App.jsx or routing file
import { lazy, Suspense } from 'react';
import { Spin } from 'antd';

// Lazy load heavy components
const RoutineGrid = lazy(() => import('./components/RoutineGrid'));
const TeacherSchedule = lazy(() => import('./components/TeacherSchedule'));
const RoomSchedule = lazy(() => import('./components/RoomSchedule'));

const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <Spin size="large" tip="Loading..." />
  </div>
);

function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/routine" element={<RoutineGrid />} />
        <Route path="/teacher-schedule" element={<TeacherSchedule />} />
        <Route path="/room-schedule" element={<RoomSchedule />} />
      </Routes>
    </Suspense>
  );
}
```

#### C. React Query Optimization
Update API configuration for better caching:

```javascript
// frontend/src/main.jsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
      // Enable suspense for better loading states
      suspense: false,
    },
  },
});
```

### 2. Backend Optimizations

#### A. Database Indexing
Create indexes for frequently queried fields:

```javascript
// backend/scripts/create-indexes.js
const mongoose = require('mongoose');
const connectDB = require('../config/db');

async function createIndexes() {
  await connectDB();
  
  const db = mongoose.connection.db;
  
  // RoutineSlot indexes
  await db.collection('routineslots').createIndexes([
    { programCode: 1, semester: 1, section: 1 },
    { dayIndex: 1, slotIndex: 1 },
    { teacherIds: 1, dayIndex: 1, slotIndex: 1 },
    { roomId: 1, dayIndex: 1, slotIndex: 1 },
    { academicYearId: 1, programCode: 1, semester: 1 },
    // Compound index for routine fetching
    { programCode: 1, semester: 1, section: 1, dayIndex: 1 },
  ]);
  
  // Teacher indexes
  await db.collection('teachers').createIndexes([
    { fullName: 'text', shortName: 'text' }, // Text search
    { isActive: 1 },
    { department: 1 },
  ]);
  
  // Room indexes
  await db.collection('rooms').createIndexes([
    { name: 'text', code: 'text' },
    { type: 1 },
    { capacity: 1 },
  ]);
  
  // Subject indexes
  await db.collection('subjects').createIndexes([
    { code: 1 },
    { name: 'text', code: 'text' },
  ]);
  
  console.log('✅ All indexes created successfully');
  process.exit(0);
}

createIndexes().catch(console.error);
```

#### B. Response Compression
Add compression middleware:

```javascript
// backend/app.js
const compression = require('compression');

// Add after other middleware
app.use(compression({
  level: 6, // Compression level (0-9)
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));
```

#### C. Caching Layer (Redis)
Add Redis for caching frequent queries:

```javascript
// backend/config/redis.js
const redis = require('redis');

let redisClient = null;

const connectRedis = async () => {
  if (process.env.REDIS_URL) {
    try {
      redisClient = redis.createClient({
        url: process.env.REDIS_URL,
      });
      
      await redisClient.connect();
      console.log('✅ Redis connected');
      return redisClient;
    } catch (error) {
      console.warn('⚠️  Redis not available, continuing without cache:', error.message);
      return null;
    }
  }
  return null;
};

const getCache = async (key) => {
  if (!redisClient) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
};

const setCache = async (key, value, ttl = 300) => {
  if (!redisClient) return;
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error('Redis set error:', error);
  }
};

const invalidateCache = async (pattern) => {
  if (!redisClient) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error('Redis invalidate error:', error);
  }
};

module.exports = { connectRedis, getCache, setCache, invalidateCache };
```

#### D. Optimize Routine Controller with Caching
```javascript
// backend/controllers/routineController.js
const { getCache, setCache, invalidateCache } = require('../config/redis');

exports.getRoutine = async (req, res) => {
  try {
    const { programCode, semester, section } = req.params;
    const cacheKey = `routine:${programCode}:${semester}:${section}`;
    
    // Try to get from cache
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      console.log('✅ Cache hit for routine');
      return res.json({
        success: true,
        data: cachedData,
        cached: true,
      });
    }
    
    // Fetch from database with optimized query
    const routineSlots = await RoutineSlot.find({
      programCode: programCode.toUpperCase(),
      semester: parseInt(semester),
      section: section.toUpperCase(),
    })
    .select('-__v') // Exclude version field
    .lean() // Return plain JS objects (faster)
    .sort({ dayIndex: 1, slotIndex: 1 });
    
    // Cache for 5 minutes
    await setCache(cacheKey, routineSlots, 300);
    
    res.json({
      success: true,
      data: routineSlots,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching routine:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching routine',
    });
  }
};

// Invalidate cache when assigning class
exports.assignClass = async (req, res) => {
  // ... existing code ...
  
  // After successful assignment
  const { programCode, semester, section } = req.params;
  await invalidateCache(`routine:${programCode}:${semester}:${section}`);
  
  // ... rest of code ...
};
```

### 3. Network Optimizations

#### A. API Response Optimization
Add field selection to reduce payload size:

```javascript
// backend/controllers/teacherController.js
exports.getTeachers = async (req, res) => {
  try {
    const { fields } = req.query;
    
    let query = Teacher.find({ isActive: true });
    
    // Allow client to request specific fields
    if (fields) {
      query = query.select(fields);
    } else {
      // Default essential fields only
      query = query.select('fullName shortName email department isActive');
    }
    
    const teachers = await query.lean();
    
    res.json({
      success: true,
      data: teachers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching teachers',
    });
  }
};
```

#### B. Pagination for Large Lists
```javascript
// backend/middleware/pagination.js
const paginate = (model) => async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  
  try {
    const total = await model.countDocuments(req.filterQuery || {});
    const data = await model
      .find(req.filterQuery || {})
      .limit(limit)
      .skip(skip)
      .lean();
    
    req.paginatedResults = {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = paginate;
```

### 4. Production Build Scripts

#### Update package.json scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:analyze": "vite build --mode analyze",
    "preview": "vite preview",
    "optimize": "node scripts/optimize-images.js && npm run build"
  }
}
```

### 5. Environment Variables for Production

Create `.env.production`:

```bash
# Backend
NODE_ENV=production
PORT=7102
MONGODB_URI=your_mongodb_atlas_uri
REDIS_URL=your_redis_url

# Optimization flags
ENABLE_COMPRESSION=true
ENABLE_CACHE=true
LOG_LEVEL=error

# CORS
FRONTEND_URL=https://your-frontend-domain.com

# Rate limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

### 6. Docker Production Configuration

```dockerfile
# Dockerfile (optimized for production)
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm ci --only=production
RUN cd frontend && npm ci --only=production
RUN cd backend && npm ci --only=production

# Copy source
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built assets and production dependencies
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/node_modules ./node_modules

# Expose port
EXPOSE 7102

# Start application
CMD ["node", "backend/server.js"]
```

### 7. Nginx Configuration for Serving Frontend

```nginx
# nginx.conf
server {
    listen 80;
    server_name your-domain.com;
    
    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/javascript application/json;
    
    # Serve frontend static files
    location / {
        root /var/www/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Proxy API requests to backend
    location /api {
        proxy_pass http://backend:7102;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📊 Performance Monitoring

### Install monitoring tools:

```bash
# Backend performance monitoring
npm install --save clinic clinic-doctor clinic-flame clinic-bubbleprof

# Add monitoring scripts to package.json
{
  "scripts": {
    "monitor:doctor": "clinic doctor -- node backend/server.js",
    "monitor:flame": "clinic flame -- node backend/server.js",
    "monitor:bubble": "clinic bubbleprof -- node backend/server.js"
  }
}
```

## 🎯 Expected Performance Improvements

| Optimization | Expected Improvement |
|-------------|---------------------|
| Code splitting | 40-60% faster initial load |
| Lazy loading | 30-50% reduction in bundle size |
| Database indexing | 70-90% faster queries |
| Redis caching | 80-95% reduction in DB queries |
| Compression | 60-80% smaller responses |
| Image optimization | 50-70% faster asset loading |

## 🚀 Deployment Checklist

- [ ] Build frontend with production config
- [ ] Create database indexes
- [ ] Set up Redis cache
- [ ] Enable compression
- [ ] Configure CDN for static assets
- [ ] Set up monitoring (PM2, New Relic, DataDog)
- [ ] Enable HTTPS/SSL
- [ ] Configure rate limiting
- [ ] Set up log aggregation
- [ ] Configure automated backups
- [ ] Test with production data volume
- [ ] Load testing with Apache JMeter or Artillery

## 📝 Quick Implementation Order

1. **Day 1**: Vite build optimization + code splitting
2. **Day 2**: Database indexing + lean queries
3. **Day 3**: Redis caching setup
4. **Day 4**: Compression + response optimization
5. **Day 5**: Frontend lazy loading
6. **Day 6**: CDN setup + image optimization
7. **Day 7**: Monitoring + load testing
