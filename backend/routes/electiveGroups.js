const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const electiveGroupController = require('../controllers/electiveGroupController');

// Validation middleware
const validateElectiveGroup = [
  body('programId')
    .isMongoId()
    .withMessage('Invalid program ID'),
  body('academicYearId')
    .isMongoId()
    .withMessage('Invalid academic year ID'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Elective group name is required')
    .isLength({ max: 100 })
    .withMessage('Name must not exceed 100 characters'),
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Elective group code is required')
    .isLength({ max: 20 })
    .withMessage('Code must not exceed 20 characters')
    .toUpperCase(),
  body('semester')
    .isIn([7, 8])
    .withMessage('Semester must be 7 or 8'),
  body('rules.minRequired')
    .isInt({ min: 1 })
    .withMessage('Minimum required must be a positive integer'),
  body('rules.maxAllowed')
    .isInt({ min: 1 })
    .withMessage('Maximum allowed must be a positive integer')
];

// @route   POST /api/elective-groups
// @desc    Create a new elective group
// @access  Private/Admin
router.post('/', [protect, authorize('admin'), ...validateElectiveGroup], electiveGroupController.createElectiveGroup);

// @route   GET /api/elective-groups
// @desc    Get all elective groups
// @access  Private
router.get('/', protect, electiveGroupController.getElectiveGroups);

// @route   GET /api/elective-groups/program/:programCode
// @desc    Get elective groups by program code
// @access  Private
router.get('/program/:programCode', protect, electiveGroupController.getElectivesByProgram);

// @route   GET /api/elective-groups/:id
// @desc    Get elective group by ID
// @access  Private
router.get('/:id', protect, electiveGroupController.getElectiveGroupById);

// @route   PUT /api/elective-groups/:id
// @desc    Update elective group
// @access  Private/Admin
router.put('/:id', [protect, authorize('admin'), ...validateElectiveGroup], electiveGroupController.updateElectiveGroup);

// @route   DELETE /api/elective-groups/:id
// @desc    Delete elective group
// @access  Private/Admin
router.delete('/:id', [protect, authorize('admin')], electiveGroupController.deleteElectiveGroup);

// @route   POST /api/elective-groups/:id/subjects
// @desc    Add subject to elective group
// @access  Private/Admin
router.post('/:id/subjects', [
  protect, 
  authorize('admin'),
  body('subjectId')
    .isMongoId()
    .withMessage('Invalid subject ID'),
  body('maxSections')
    .optional()
    .isInt({ min: 1, max: 4 })
    .withMessage('Max sections must be between 1 and 4')
], electiveGroupController.addSubjectToElectiveGroup);

// @route   DELETE /api/elective-groups/:id/subjects/:subjectId
// @desc    Remove subject from elective group
// @access  Private/Admin
router.delete('/:id/subjects/:subjectId', [protect, authorize('admin')], electiveGroupController.removeSubjectFromElectiveGroup);

module.exports = router;
