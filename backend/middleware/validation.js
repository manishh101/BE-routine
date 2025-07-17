const { validationResult } = require('express-validator');

// General validation result handler
exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      msg: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// MongoDB ObjectId validation
exports.validateObjectId = (req, res, next) => {
  const { id } = req.params;
  
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      msg: 'Invalid ID format',
      error: 'ID must be a valid MongoDB ObjectId'
    });
  }
  
  next();
};

// Pagination middleware
exports.setPagination = (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Max 100 items per page
  const skip = (page - 1) * limit;
  
  req.pagination = {
    page,
    limit,
    skip
  };
  
  next();
};

// Sort middleware
exports.setSort = (req, res, next) => {
  const { sortBy, sortOrder } = req.query;
  
  let sort = {};
  if (sortBy) {
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
  } else {
    sort = { createdAt: -1 }; // Default sort by creation date
  }
  
  req.sort = sort;
  next();
};

// Academic year validation
exports.validateAcademicYear = (req, res, next) => {
  const { semester, year } = req.body;
  
  if (semester && (semester < 1 || semester > 8)) {
    return res.status(400).json({
      msg: 'Invalid semester',
      error: 'Semester must be between 1 and 8'
    });
  }
  
  if (year && (year < 1 || year > 4)) {
    return res.status(400).json({
      msg: 'Invalid year',
      error: 'Year must be between 1 and 4'
    });
  }
  
  next();
};

// Request logging middleware
exports.logRequest = (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method !== 'GET' ? req.body : undefined
  });
  next();
};

// Rate limiting data preparation
exports.prepareRateLimit = (req, res, next) => {
  req.rateLimitKey = req.ip;
  if (req.user) {
    req.rateLimitKey = `user:${req.user._id}`;
  }
  next();
};

// Department access validation
exports.validateDepartmentAccess = async (req, res, next) => {
  try {
    // If user is admin, allow access to all departments
    if (req.user && req.user.role === 'admin') {
      return next();
    }
    
    // If user is teacher, check if they belong to the department
    if (req.user && req.user.role === 'teacher') {
      const Teacher = require('../models/Teacher');
      const teacher = await Teacher.findOne({ userId: req.user._id });
      
      if (!teacher) {
        return res.status(403).json({
          msg: 'Access denied',
          error: 'Teacher profile not found'
        });
      }
      
      // Add teacher's department to request for filtering
      req.userDepartment = teacher.departmentId;
    }
    
    next();
  } catch (error) {
    console.error('Department access validation error:', error);
    res.status(500).json({
      msg: 'Server error during access validation',
      error: error.message
    });
  }
};
