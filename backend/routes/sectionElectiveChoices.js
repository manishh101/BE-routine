const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  createSectionElectiveChoice,
  getSectionElectiveChoices,
  getSectionElectiveChoiceById,
  updateSectionElectiveChoice,
  submitSectionElectiveChoice,
  approveSectionElectiveChoice,
  deleteSectionElectiveChoice,
  getElectiveChoicesSummary
} = require('../controllers/sectionElectiveChoiceController');

// Validation rules
const validateSectionElectiveChoice = [
  body('programId').isMongoId().withMessage('Valid program ID is required'),
  body('academicYearId').isMongoId().withMessage('Valid academic year ID is required'),
  body('semester').isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1 and 8'),
  body('section').notEmpty().withMessage('Section is required'),
  body('choices').isArray({ min: 1 }).withMessage('At least one choice is required'),
  body('choices.*.electiveGroupId').isMongoId().withMessage('Valid elective group ID is required'),
  body('choices.*.selectedSubjectId').isMongoId().withMessage('Valid subject ID is required'),
  body('choices.*.subjectCode').notEmpty().withMessage('Subject code is required'),
  body('choices.*.subjectName').notEmpty().withMessage('Subject name is required')
];

const validateApproval = [
  body('approved').isBoolean().withMessage('Approved status must be boolean'),
  body('rejectionReason').optional().notEmpty().withMessage('Rejection reason cannot be empty if provided')
];

// @route   POST /api/section-elective-choices
// @desc    Create section elective choice
// @access  Private/Admin
router.post('/', [protect, authorize('admin'), validateSectionElectiveChoice], createSectionElectiveChoice);

// @route   GET /api/section-elective-choices
// @desc    Get all section elective choices with optional filters
// @access  Private
router.get('/', protect, getSectionElectiveChoices);

// @route   GET /api/section-elective-choices/summary
// @desc    Get elective choices summary for a program/semester
// @access  Private
router.get('/summary', protect, getElectiveChoicesSummary);

// @route   GET /api/section-elective-choices/:id
// @desc    Get section elective choice by ID
// @access  Private
router.get('/:id', protect, getSectionElectiveChoiceById);

// @route   PUT /api/section-elective-choices/:id
// @desc    Update section elective choice
// @access  Private/Admin
router.put('/:id', [protect, authorize('admin'), validateSectionElectiveChoice], updateSectionElectiveChoice);

// @route   PUT /api/section-elective-choices/:id/submit
// @desc    Submit section elective choice for approval
// @access  Private/Admin
router.put('/:id/submit', [protect, authorize('admin')], submitSectionElectiveChoice);

// @route   PUT /api/section-elective-choices/:id/approve
// @desc    Approve or reject section elective choice
// @access  Private/Admin
router.put('/:id/approve', [protect, authorize('admin'), validateApproval], approveSectionElectiveChoice);

// @route   DELETE /api/section-elective-choices/:id
// @desc    Delete section elective choice
// @access  Private/Admin
router.delete('/:id', [protect, authorize('admin')], deleteSectionElectiveChoice);

module.exports = router;
