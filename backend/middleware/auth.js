const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to authenticate user using JWT token
exports.protect = async (req, res, next) => {
  let token;

  // Get token from header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({ 
      success: false,
      errors: [{ msg: 'No token, authorization denied' }] 
    });
  }

  try {
    // Check if JWT_SECRET is set
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ 
        success: false,
        errors: [{ msg: 'Server configuration error' }] 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded || !decoded.user || !decoded.user.id) {
      return res.status(401).json({ 
        success: false,
        errors: [{ msg: 'Invalid token' }] 
      });
    }

    // Set req.user to the user in the token
    const user = await User.findById(decoded.user.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        errors: [{ msg: 'User not found' }] 
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ 
        success: false, 
        errors: [{ msg: 'Account is deactivated' }] 
      });
    }
    
    req.user = user;
    next();
  } catch (err) {
    console.error('JWT verification error:', err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

// Middleware to check if user is admin
exports.authorize = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({
        msg: `User role ${req.user.role} is not authorized to access this resource`,
      });
    }
    next();
  };
};

// Alias exports for compatibility
exports.verifyToken = exports.protect;
exports.requireAdmin = exports.authorize('admin');
