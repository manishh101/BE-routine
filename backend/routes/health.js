const express = require('express');
const router = express.Router();
const dbManager = require('../utils/dbManager');

// @route   GET /api/health
// @desc    Enhanced health check with database monitoring
// @access  Public
router.get('/', async (req, res) => {
  try {
    const dbStatus = dbManager.getConnectionStatus();
    const poolStats = await dbManager.getPoolStats();
    
    res.json({
      success: true,
      data: {
        api: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '2.0.0',
          uptime: process.uptime(),
          memory: process.memoryUsage()
        },
        database: {
          status: dbStatus.isConnected ? 'healthy' : 'unhealthy',
          connectionState: dbStatus.readyState,
          poolInfo: poolStats
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error.message
    });
  }
});

module.exports = router;
