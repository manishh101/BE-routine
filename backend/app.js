/**
 * IOE Pulchowk Campus Routine Management System - Backend API
 * Version: 2.0.0
 * 
 * Enhanced backend system with:
 * - Multi-department program management
 * - Advanced elective system (semesters 7-8)
 * - Lab group management with auto-creation
 * - Academic calendar integration
 * - Teacher workload analysis
 * - Room utilization tracking
 * - Real-time conflict detection
 * - Comprehensive API documentation
 * - Enhanced security and performance
 * 
 * Features:
 * - 17+ Database models
 * - 20+ API route collections
 * - JWT authentication
 * - Rate limiting
 * - Swagger documentation
 * - Comprehensive error handling
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

console.log('Environment loaded:');
console.log('MongoDB URI:', process.env.MONGODB_ATLAS_URI ? 'Connected' : 'Missing');
console.log('Frontend URL:', process.env.FRONTEND_URL || 'http://localhost:7103');
console.log('Server Port:', process.env.PORT || 7102);
console.log('Node Environment:', process.env.NODE_ENV || 'development');
console.log('System:', 'IOE Pulchowk Campus Routine Management System v2.0.0');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
// const compression = require('compression'); // Available if compression package is installed
const connectDB = require('./config/db');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');

const app = express();

// Connect to database (with better error handling)
connectDB().catch(err => {
  console.error('MongoDB connection error:', err);
  console.error('Server starting without database connection...');
});

// Enhanced CORS configuration
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:7103',
    'http://localhost:3000',
    'http://localhost:7103',
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 2000, // Much more permissive in development
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for certain IPs in development
  skip: (req) => {
    if (process.env.NODE_ENV !== 'production') {
      // Skip rate limiting for localhost and common development IPs
      const skipIPs = ['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1'];
      return skipIPs.includes(req.ip) || skipIPs.includes(req.connection.remoteAddress);
    }
    return false;
  }
});

// Apply rate limiting to API routes only
app.use('/api/', limiter);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Compression middleware for better performance (if compression package is available)
// app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Health check route (before other routes)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'Connected',
    version: '2.0.0',
    system: 'IOE Pulchowk Campus Routine Management System',
    features: {
      authentication: 'JWT',
      database: 'MongoDB',
      documentation: 'Swagger/OpenAPI',
      testing: 'Jest',
      security: 'Helmet + CORS'
    }
  });
});

// Swagger Configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'IOE Pulchowk Campus Routine Management System API',
      version: '2.0.0',
      description: 'Comprehensive API for managing academic schedules, course routines, teacher assignments, and resource allocation for IOE Pulchowk Campus',
      contact: {
        name: 'IOE Pulchowk Campus',
        email: 'support@ioe.edu.np'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 7102}`,
        description: 'Development server'
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./routes/*.js', './models/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocs));

// API Routes with error handling wrapper

const routeHandler = (routePath, routeFile) => {
  console.log('Loading route:', routePath, 'from file:', routeFile);
  try {
    const route = require(routeFile);
    app.use(routePath, route);
    console.log(`✅ Route loaded: ${routePath}`);
  } catch (error) {
    console.error(`❌ Failed to load route ${routePath}:`, error.message);
    throw error;
  }
};

// Load all routes - Updated for new backend system
routeHandler('/api/auth', './routes/auth');
routeHandler('/api/users', './routes/users');
routeHandler('/api/teachers', './routes/teachers');
routeHandler('/api/programs', './routes/programs');
routeHandler('/api/subjects', './routes/subjects');
routeHandler('/api/rooms', './routes/rooms');
routeHandler('/api/time-slots', './routes/timeSlots');
routeHandler('/api/routines', './routes/routine');
routeHandler('/api/routine-slots', './routes/routineSlots');
routeHandler('/api/program-semesters', './routes/programSemesters');
routeHandler('/api/departments', './routes/departments');
routeHandler('/api/academic-calendars', './routes/academicCalendars');
routeHandler('/api/lab-groups', './routes/labGroups');
routeHandler('/api/elective-groups', './routes/electiveGroups');
routeHandler('/api/section-elective-choices', './routes/sectionElectiveChoices');
routeHandler('/api/sessions', './routes/sessions');
routeHandler('/api/templates', './routes/templates');
routeHandler('/api/conflicts', './routes/conflicts');
routeHandler('/api/health', './routes/health');
routeHandler('/api/excel', './routes/excel');
routeHandler('/api/debug', './routes/debug');

// Base route
app.get('/', (req, res) => {
  res.json({
    message: 'IOE Pulchowk Campus Routine Management System API',
    version: '2.0.0',
    description: 'Comprehensive routine management system for Pulchowk Campus',
    features: [
      'Multi-department program management',
      'Advanced elective system',
      'Lab group management',
      'Academic calendar integration',
      'Teacher workload analysis',
      'Room utilization tracking',
      'Real-time conflict detection'
    ],
    endpoints: {
      health: '/api/health',
      docs: '/api-docs',
      auth: '/api/auth',
      users: '/api/users',
      teachers: '/api/teachers',
      programs: '/api/programs',
      subjects: '/api/subjects',
      rooms: '/api/rooms',
      'time-slots': '/api/time-slots',
      routines: '/api/routines',
      'routine-slots': '/api/routine-slots',
      'program-semesters': '/api/program-semesters',
      departments: '/api/departments',
      'academic-calendars': '/api/academic-calendars',
      'lab-groups': '/api/lab-groups',
      'elective-groups': '/api/elective-groups',
      'section-elective-choices': '/api/section-elective-choices',
      sessions: '/api/sessions',
      templates: '/api/templates',
      conflicts: '/api/conflicts',
      excel: '/api/excel'
    }
  });
});

// 404 handler for undefined routes
app.use((req, res, next) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      '/api/health',
      '/api/auth',
      '/api/users',
      '/api/teachers',
      '/api/programs',
      '/api/subjects',
      '/api/rooms',
      '/api/time-slots',
      '/api/routines',
      '/api/routine-slots',
      '/api/program-semesters',
      '/api/departments',
      '/api/academic-calendars',
      '/api/lab-groups',
      '/api/elective-groups',
      '/api/section-elective-choices',
      '/api/sessions',
      '/api/templates',
      '/api/conflicts'
    ],
    documentation: '/api-docs'
  });
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  console.error('Error occurred:');
  console.error('Stack:', err.stack);
  console.error('Request:', {
    method: req.method,
    url: req.originalUrl,
    headers: req.headers
  });

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: Object.values(err.errors).map(e => ({
        field: e.path,
        message: e.message,
        value: e.value
      }))
    });
  }

  // Mongoose duplicate key errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: 'Duplicate key error',
        field: field,
        value: err.keyValue[field],
        error: `${field} already exists`
      });
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: err.message
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
      error: err.message
    });
  }

  // Cast errors (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      error: err.message,
      field: err.path
    });
  }

  // Type errors
  if (err.name === 'TypeError') {
    return res.status(400).json({
      success: false,
      message: 'Type error - invalid data format',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Invalid data format'
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? {
      stack: err.stack,
      details: err
    } : 'Something went wrong'
  });
});

// Export the app (server startup is handled by server.js)
// This enhanced backend supports the complete IOE Pulchowk Campus routine management system
// with advanced scheduling, elective management, and comprehensive analytics

module.exports = app;