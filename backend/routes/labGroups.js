const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const labGroupController = require('../controllers/labGroupController');

// Validation middleware
const validateLabGroup = [
  body('programId')
    .isMongoId()
    .withMessage('Invalid program ID'),
  body('subjectId')
    .isMongoId()
    .withMessage('Invalid subject ID'),
  body('academicYearId')
    .isMongoId()
    .withMessage('Invalid academic year ID'),
  body('semester')
    .isInt({ min: 1, max: 8 })
    .withMessage('Semester must be between 1 and 8'),
  body('section')
    .isIn(['AB', 'CD'])
    .withMessage('Section must be AB or CD'),
  body('totalGroups')
    .isInt({ min: 1, max: 4 })
    .withMessage('Total groups must be between 1 and 4'),
  body('groups')
    .isArray({ min: 1 })
    .withMessage('At least one group is required'),
  body('groups.*.name')
    .trim()
    .notEmpty()
    .withMessage('Group name is required'),
  body('groups.*.studentCount')
    .isInt({ min: 1 })
    .withMessage('Student count must be a positive integer'),
  body('groups.*.weekPattern')
    .isIn(['odd', 'even', 'weekly'])
    .withMessage('Week pattern must be odd, even, or weekly')
];

// @route   POST /api/lab-groups
// @desc    Create a new lab group
// @access  Private/Admin
router.post('/', [protect, authorize('admin'), ...validateLabGroup], labGroupController.createLabGroup);

// @route   GET /api/lab-groups
// @desc    Get all lab groups
// @access  Private
router.get('/', protect, labGroupController.getLabGroups);

// @route   GET /api/lab-groups/:id
// @desc    Get lab group by ID
// @access  Private
router.get('/:id', protect, labGroupController.getLabGroupById);

// @route   PUT /api/lab-groups/:id
// @desc    Update lab group
// @access  Private/Admin
router.put('/:id', [protect, authorize('admin'), ...validateLabGroup], labGroupController.updateLabGroup);

// @route   DELETE /api/lab-groups/:id
// @desc    Delete lab group
// @access  Private/Admin
router.delete('/:id', [protect, authorize('admin')], labGroupController.deleteLabGroup);

// @route   POST /api/lab-groups/auto-create
// @desc    Auto-create lab groups for a program semester
// @access  Private/Admin
router.post('/auto-create', [
  protect, 
  authorize('admin'),
  body('programId')
    .isMongoId()
    .withMessage('Invalid program ID'),
  body('semester')
    .isInt({ min: 1, max: 8 })
    .withMessage('Semester must be between 1 and 8'),
  body('academicYearId')
    .isMongoId()
    .withMessage('Invalid academic year ID')
], labGroupController.autoCreateLabGroups);

module.exports = router;
