const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const routineSlotController = require('../controllers/routineSlotController');

// Validation rules
const routineSlotValidation = [
  body('dayIndex')
    .isInt({ min: 0, max: 6 })
    .withMessage('Day index must be between 0-6 (Sunday-Saturday)'),
  body('slotIndex')
    .isInt({ min: 1 })
    .withMessage('Slot index must be a positive integer'),
  body('semester')
    .isInt({ min: 1, max: 8 })
    .withMessage('Semester must be between 1-8'),
  body('year')
    .isInt({ min: 1, max: 4 })
    .withMessage('Year must be between 1-4'),
  body('section')
    .isLength({ min: 1, max: 5 })
    .withMessage('Section must be 1-5 characters'),
  body('classType')
    .isIn(['theory', 'lab', 'tutorial', 'project'])
    .withMessage('Class type must be theory, lab, tutorial, or project'),
  body('academicYearId')
    .isMongoId()
    .withMessage('Valid academic year ID is required'),
  body('programId')
    .optional()
    .isMongoId()
    .withMessage('Valid program ID is required'),
  body('subjectId')
    .optional()
    .isMongoId()
    .withMessage('Valid subject ID is required'),
  body('teacherIds')
    .optional()
    .isArray()
    .withMessage('Teacher IDs must be an array'),
  body('teacherIds.*')
    .isMongoId()
    .withMessage('Each teacher ID must be valid'),
  body('roomId')
    .optional()
    .isMongoId()
    .withMessage('Valid room ID is required'),
  body('labGroupId')
    .optional()
    .isMongoId()
    .withMessage('Valid lab group ID is required')
];

// @route   GET /api/routine-slots
// @desc    Get all routine slots with filtering
// @access  Private
router.get('/', protect, routineSlotController.getRoutineSlots);

// @route   GET /api/routine-slots/schedule/weekly
// @desc    Get weekly schedule organized by days
// @access  Private
router.get('/schedule/weekly', protect, routineSlotController.getWeeklySchedule);

// @route   POST /api/routine-slots/check-conflicts
// @desc    Check for scheduling conflicts
// @access  Private/Admin
router.post('/check-conflicts', [protect, authorize('admin')], routineSlotController.checkConflicts);

// @route   POST /api/routine-slots/bulk
// @desc    Bulk create routine slots
// @access  Private/Admin
router.post('/bulk', [protect, authorize('admin')], routineSlotController.bulkCreateRoutineSlots);

// @route   POST /api/routine-slots
// @desc    Create a new routine slot
// @access  Private/Admin
router.post('/', [protect, authorize('admin'), ...routineSlotValidation], routineSlotController.createRoutineSlot);

// @route   GET /api/routine-slots/:id
// @desc    Get routine slot by ID
// @access  Private
router.get('/:id', protect, routineSlotController.getRoutineSlotById);

// @route   PUT /api/routine-slots/:id
// @desc    Update routine slot
// @access  Private/Admin
router.put('/:id', [protect, authorize('admin'), ...routineSlotValidation], routineSlotController.updateRoutineSlot);

// @route   DELETE /api/routine-slots/:id
// @desc    Delete routine slot (soft delete)
// @access  Private/Admin
router.delete('/:id', [protect, authorize('admin')], routineSlotController.deleteRoutineSlot);

module.exports = router;
