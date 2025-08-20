/**
 * Legacy timeslots route - redirects to time-slots
 * This file maintains backward compatibility for the old timeslots endpoint
 */

const express = require('express');
const router = express.Router();

// Redirect specific timeslots requests to time-slots
router.get('/', (req, res) => {
  res.redirect(301, '/api/time-slots');
});

router.get('/:id', (req, res) => {
  res.redirect(301, `/api/time-slots/${req.params.id}`);
});

router.post('/', (req, res) => {
  res.redirect(301, '/api/time-slots');
});

router.put('/:id', (req, res) => {
  res.redirect(301, `/api/time-slots/${req.params.id}`);
});

router.delete('/:id', (req, res) => {
  res.redirect(301, `/api/time-slots/${req.params.id}`);
});

// Handle any other methods with a fallback
router.use('/', (req, res) => {
  const newPath = req.originalUrl.replace('/api/timeslots', '/api/time-slots');
  res.redirect(301, newPath);
});

module.exports = router;
