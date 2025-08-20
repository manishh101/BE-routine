const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware for optional authentication - allows both authenticated and unauthenticated access
exports.optionalAuth = async (req, res, next) => {
  let token;

  // Get token from header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // If no token, continue without user authentication
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    // Check if JWT_SECRET is set
    if (!process.env.JWT_SECRET) {
      console.warn('JWT_SECRET not set, proceeding without authentication');
      req.user = null;
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded || !decoded.user || !decoded.user.id) {
      req.user = null;
      return next();
    }

    // Set req.user to the user in the token
    const user = await User.findById(decoded.user.id).select('-password');
    
    if (!user || !user.isActive) {
      req.user = null;
      return next();
    }
    
    req.user = user;
    next();
  } catch (err) {
    console.log('Optional auth - invalid token, proceeding without authentication:', err.message);
    req.user = null;
    next();
  }
};

// Middleware to check if authenticated user has admin role, but allows public access
exports.optionalAdmin = (req, res, next) => {
  // If no user (public access), continue
  if (!req.user) {
    return next();
  }
  
  // If user exists but is not admin, deny access to admin-only operations
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required for this operation',
    });
  }
  
  next();
};

// Check if the route requires authentication based on HTTP method and path
exports.requiresAuth = (req) => {
  const method = req.method.toLowerCase();
  const path = req.path.toLowerCase();
  
  // Public read-only operations (GET requests)
  if (method === 'get') {
    // Always allow GET requests for these endpoints
    const publicPaths = [
      '/health',
      '/api/health',
      '/teachers',
      '/programs',
      '/subjects', 
      '/rooms',
      '/time-slots',
      '/timeslots',
      '/routines',
      '/departments',
      '/program-semesters',
      '/academic-calendars',
      '/sessions'
    ];
    
    // Check if path starts with any public path
    if (publicPaths.some(publicPath => path.includes(publicPath))) {
      return false;
    }
  }
  
  // All POST, PUT, DELETE operations require authentication
  if (['post', 'put', 'delete', 'patch'].includes(method)) {
    return true;
  }
  
  // Default to requiring auth for unknown paths
  return true;
};

// Smart middleware that applies authentication conditionally
exports.smartAuth = async (req, res, next) => {
  if (exports.requiresAuth(req)) {
    // Route requires authentication - use strict auth
    const { protect } = require('./auth');
    return protect(req, res, next);
  } else {
    // Route allows public access - use optional auth
    return exports.optionalAuth(req, res, next);
  }
};
