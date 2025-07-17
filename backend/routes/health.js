const express = require('express');
const router = express.Router();

// @route   GET /api/health
// @desc    General health check
// @access  Public
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      api: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
      },
      database: {
        status: 'healthy' // MongoDB connection is handled by Mongoose
      }
    }
  });
});

module.exports = router;
