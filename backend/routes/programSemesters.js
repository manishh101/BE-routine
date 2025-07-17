const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
  getSubjectsForProgramSemester,
  getProgramCurriculum,
  createProgramSemester,
  addSubjectToProgramSemester,
  removeSubjectFromProgramSemester
} = require('../controllers/programSemesterController');

// @route   GET /api/program-semesters/:programCode/:semester/subjects
// @desc    Get subjects for a specific program and semester
// @access  Public
router.get('/:programCode/:semester/subjects', getSubjectsForProgramSemester);

// @route   GET /api/program-semesters/:programCode
// @desc    Get full curriculum for a program
// @access  Public
router.get('/:programCode', getProgramCurriculum);

// @route   POST /api/program-semesters
// @desc    Create or update program semester curriculum
// @access  Private/Admin
router.post(
  '/',
  [
    protect,
    body('programCode', 'Program code is required').notEmpty(),
    body('semester', 'Semester must be a number between 1 and 8').isInt({ min: 1, max: 8 }),
    body('subjectsOffered', 'Subjects offered must be an array').isArray()
  ],
  createProgramSemester
);

// @route   POST /api/program-semesters/:programCode/:semester/subjects
// @desc    Add subject to program semester
// @access  Private/Admin
router.post(
  '/:programCode/:semester/subjects',
  [
    protect,
    body('subjectId', 'Subject ID is required').isMongoId()
  ],
  addSubjectToProgramSemester
);

// @route   DELETE /api/program-semesters/:programCode/:semester/subjects/:subjectId
// @desc    Remove subject from program semester
// @access  Private/Admin
router.delete('/:programCode/:semester/subjects/:subjectId', protect, removeSubjectFromProgramSemester);

module.exports = router;
