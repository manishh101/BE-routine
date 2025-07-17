const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const departmentController = require('../controllers/departmentController');

// Validation middleware
const validateDepartment = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Department code is required')
    .isLength({ max: 10 })
    .withMessage('Department code must not exceed 10 characters')
    .toUpperCase(),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Department name is required')
    .isLength({ max: 100 })
    .withMessage('Department name must not exceed 100 characters'),
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Department full name is required')
    .isLength({ max: 200 })
    .withMessage('Department full name must not exceed 200 characters'),
  body('contactEmail')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('contactPhone')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Phone number must not exceed 20 characters'),
  body('location')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Location must not exceed 100 characters')
];

// @route   POST /api/departments
// @desc    Create a new department
// @access  Private/Admin
router.post('/', [protect, authorize('admin'), ...validateDepartment], departmentController.createDepartment);

// @route   GET /api/departments
// @desc    Get all departments
// @access  Private
router.get('/', protect, departmentController.getDepartments);

// @route   GET /api/departments/:id
// @desc    Get department by ID
// @access  Private
router.get('/:id', protect, departmentController.getDepartmentById);

// @route   PUT /api/departments/:id
// @desc    Update department
// @access  Private/Admin
router.put('/:id', [protect, authorize('admin'), ...validateDepartment], departmentController.updateDepartment);

// @route   DELETE /api/departments/:id
// @desc    Delete department (soft delete)
// @access  Private/Admin
router.delete('/:id', [protect, authorize('admin')], departmentController.deleteDepartment);

// @route   GET /api/departments/:id/teachers
// @desc    Get department teachers
// @access  Private
router.get('/:id/teachers', protect, departmentController.getDepartmentTeachers);

module.exports = router;
