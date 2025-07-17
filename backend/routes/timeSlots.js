const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const timeSlotController = require('../controllers/timeSlotController');

// Validation rules
const timeSlotValidation = [
  body('_id')
    .isInt({ min: 1 })
    .withMessage('Slot index (_id) must be a positive integer'),
  body('label')
    .isLength({ min: 1, max: 50 })
    .withMessage('Label is required and must be max 50 characters'),
  body('startTime')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format (24-hour)'),
  body('endTime')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format (24-hour)'),
  body('sortOrder')
    .isInt({ min: 1 })
    .withMessage('Sort order must be a positive integer'),
  body('dayType')
    .optional()
    .isIn(['Regular', 'Saturday', 'Holiday'])
    .withMessage('Day type must be Regular, Saturday, or Holiday'),
  body('category')
    .optional()
    .isIn(['Morning', 'Afternoon', 'Evening'])
    .withMessage('Category must be Morning, Afternoon, or Evening'),
  body('applicableDays')
    .optional()
    .isArray()
    .withMessage('Applicable days must be an array'),
  body('applicableDays.*')
    .isInt({ min: 0, max: 6 })
    .withMessage('Each day index must be between 0-6 (Sunday-Saturday)')
];

// @route   GET /api/time-slots
// @desc    Get all time slots with filtering
// @access  Public (for development/testing)
router.get('/', timeSlotController.getTimeSlots);

// @route   GET /api/time-slots/category/:category
// @desc    Get time slots by category
// @access  Private
router.get('/category/:category', protect, timeSlotController.getTimeSlotsByCategory);

// @route   POST /api/time-slots/initialize
// @desc    Initialize default time slots
// @access  Private/Admin
router.post('/initialize', [protect, authorize('admin')], timeSlotController.initializeTimeSlots);

// @route   POST /api/time-slots
// @desc    Create a new time slot
// @access  Private/Admin
router.post('/', [protect, authorize('admin'), ...timeSlotValidation], timeSlotController.createTimeSlot);

// @route   GET /api/time-slots/:id
// @desc    Get time slot by ID (slotIndex)
// @access  Private
router.get('/:id', protect, timeSlotController.getTimeSlotById);

// @route   PUT /api/time-slots/:id
// @desc    Update time slot
// @access  Private/Admin
router.put('/:id', [protect, authorize('admin'), ...timeSlotValidation], timeSlotController.updateTimeSlot);

// @route   DELETE /api/time-slots/bulk
// @desc    Bulk delete time slots
// @access  Private/Admin
router.delete('/bulk', [protect, authorize('admin')], timeSlotController.bulkDeleteTimeSlots);

// @route   DELETE /api/time-slots/:id
// @desc    Delete time slot
// @access  Private/Admin
router.delete('/:id', [protect, authorize('admin')], timeSlotController.deleteTimeSlot);

module.exports = router;
