/**
 * Legacy timeslots route - redirects to time-slots
 * This file maintains backward compatibility for the old timeslots endpoint
 */

const express = require('express');
const router = express.Router();

// Redirect all timeslots requests to time-slots
router.all('*', (req, res) => {
  const newPath = req.originalUrl.replace('/api/timeslots', '/api/time-slots');
  res.redirect(301, newPath);
});

module.exports = router;
