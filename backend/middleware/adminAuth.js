const jwt = require('jsonwebtoken');
const User = require('../models/User');

const adminAuth = async (req, res, next) => {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if no token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user and check admin role
    const user = await User.findById(decoded.user.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ msg: 'Token is not valid' });
    }

    if (!user.isActive) {
      return res.status(401).json({ msg: 'User account is deactivated' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('AdminAuth middleware error:', err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

module.exports = { adminAuth };
