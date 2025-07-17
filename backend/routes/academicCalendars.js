const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const academicCalendarController = require('../controllers/academicCalendarController');

// Validation middleware
const validateAcademicCalendar = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 100 })
    .withMessage('Title must not exceed 100 characters'),
  body('nepaliYear')
    .trim()
    .notEmpty()
    .withMessage('Nepali year is required')
    .matches(/^\d{4}\/\d{4}$/)
    .withMessage('Nepali year must be in format YYYY/YYYY'),
  body('englishYear')
    .trim()
    .notEmpty()
    .withMessage('English year is required')
    .matches(/^\d{4}\/\d{4}$/)
    .withMessage('English year must be in format YYYY/YYYY'),
  body('startDate')
    .isISO8601()
    .withMessage('Invalid start date format'),
  body('endDate')
    .isISO8601()
    .withMessage('Invalid end date format'),
  body('terms')
    .isArray({ min: 1 })
    .withMessage('At least one term is required'),
  body('terms.*.name')
    .trim()
    .notEmpty()
    .withMessage('Term name is required'),
  body('terms.*.startDate')
    .isISO8601()
    .withMessage('Invalid term start date'),
  body('terms.*.endDate')
    .isISO8601()
    .withMessage('Invalid term end date')
];

// @route   POST /api/academic-calendars
// @desc    Create a new academic calendar
// @access  Private/Admin
router.post('/', [protect, authorize('admin'), ...validateAcademicCalendar], academicCalendarController.createAcademicCalendar);

// @route   GET /api/academic-calendars
// @desc    Get all academic calendars
// @access  Private
router.get('/', protect, academicCalendarController.getAcademicCalendars);

// @route   GET /api/academic-calendars/current
// @desc    Get current academic calendar
// @access  Private
router.get('/current', protect, academicCalendarController.getCurrentAcademicCalendar);

// @route   GET /api/academic-calendars/:id
// @desc    Get academic calendar by ID
// @access  Private
router.get('/:id', protect, academicCalendarController.getAcademicCalendarById);

// @route   PUT /api/academic-calendars/:id
// @desc    Update academic calendar
// @access  Private/Admin
router.put('/:id', [protect, authorize('admin'), ...validateAcademicCalendar], academicCalendarController.updateAcademicCalendar);

// @route   DELETE /api/academic-calendars/:id
// @desc    Delete academic calendar
// @access  Private/Admin
router.delete('/:id', [protect, authorize('admin')], academicCalendarController.deleteAcademicCalendar);

// @route   PUT /api/academic-calendars/current/week
// @desc    Update current week
// @access  Private/Admin
router.put('/current/week', [
  protect, 
  authorize('admin'),
  body('currentWeek')
    .isInt({ min: 1, max: 16 })
    .withMessage('Current week must be between 1 and 16')
], academicCalendarController.updateCurrentWeek);

module.exports = router;
