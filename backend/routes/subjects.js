const express = require('express');
const router = express.Router();
const { 
  createSubject,
  createSubjectsBulk,
  getSubjects, 
  getSubjectById, 
  updateSubject, 
  deleteSubject,
  deleteSubjectsBulk,
  deleteSubjectsByProgramId,
  getSubjectsByProgramId,
  getSubjectsBySemester,
  getSharedSubjects,
  getSubjectsByPrograms
} = require('../controllers/subjectController');
const { protect, authorize } = require('../middleware/auth');
const { check } = require('express-validator');

/**
 * @swagger
 * /api/subjects:
 *   post:
 *     summary: Create a new subject
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - code
 *               - programId
 *               - semester
 *               - credits
 *               - weeklyHours
 *             properties:
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               programId:
 *                 type: array
 *                 items:
 *                   type: string
 *               semester:
 *                 type: number
 *               credits:
 *                 type: object
 *                 properties:
 *                   theory:
 *                     type: number
 *                   practical:
 *                     type: number
 *                   tutorial:
 *                     type: number
 *               weeklyHours:
 *                 type: object
 *                 properties:
 *                   theory:
 *                     type: number
 *                   practical:
 *                     type: number
 *                   tutorial:
 *                     type: number
 *     responses:
 *       201:
 *         description: Subject created successfully
 *       400:
 *         description: Bad request
 */
router.post(
  '/',
  protect,
  authorize('admin'),
  [
    check('name', 'Name is required').not().isEmpty(),
    check('code', 'Code is required').not().isEmpty(),
    check('programId', 'Program ID is required').isArray().withMessage('Program ID must be an array'),
    check('programId.*', 'Each program ID must be a valid MongoDB ObjectId').isMongoId(),
    check('semester', 'Semester is required').isNumeric(),
    check('credits.theory', 'Theory credits is required').isNumeric(),
    check('credits.practical', 'Practical credits is required').isNumeric(),
    check('credits.tutorial', 'Tutorial credits is required').isNumeric(),
    check('weeklyHours.theory', 'Theory weekly hours is required').isNumeric(),
    check('weeklyHours.practical', 'Practical weekly hours is required').isNumeric(),
    check('weeklyHours.tutorial', 'Tutorial weekly hours is required').isNumeric(),
  ],
  createSubject
);

/**
 * @swagger
 * /api/subjects/bulk:
 *   post:
 *     summary: Create multiple subjects in bulk
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subjects
 *             properties:
 *               subjects:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - code
 *                     - programId
 *                     - semester
 *                     - credits
 *                     - weeklyHours
 *                   properties:
 *                     name:
 *                       type: string
 *                     code:
 *                       type: string
 *                     programId:
 *                       type: array
 *                       items:
 *                         type: string
 *                     semester:
 *                       type: number
 *                     credits:
 *                       type: object
 *                       properties:
 *                         theory:
 *                           type: number
 *                         practical:
 *                           type: number
 *                         tutorial:
 *                           type: number
 *                     weeklyHours:
 *                       type: object
 *                       properties:
 *                         theory:
 *                           type: number
 *                         practical:
 *                           type: number
 *                         tutorial:
 *                           type: number
 *     responses:
 *       201:
 *         description: Subjects created successfully
 *       400:
 *         description: Bad request
 */
router.post(
  '/bulk',
  protect,
  authorize('admin'),
  [
    check('subjects', 'Subjects array is required').isArray({ min: 1 })
  ],
  createSubjectsBulk
);

/**
 * @swagger
 * /api/subjects:
 *   get:
 *     summary: Get all subjects
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of subjects
 */
router.get('/', getSubjects);

/**
 * @swagger
 * /api/subjects/program/{programId}:
 *   get:
 *     summary: Get subjects by program ID
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of subjects for a program
 */
router.get('/program/:programId', getSubjectsByProgramId);

/**
 * @swagger
 * /api/subjects/semester/{semester}:
 *   get:
 *     summary: Get subjects by semester
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: semester
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: List of subjects for a semester
 */
router.get('/semester/:semester', getSubjectsBySemester);

/**
 * @swagger
 * /api/subjects/shared:
 *   get:
 *     summary: Get shared subjects (belonging to multiple programs)
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of shared subjects
 */
router.get('/shared', protect, getSharedSubjects);

/**
 * @swagger
 * /api/subjects/by-programs:
 *   post:
 *     summary: Get subjects by multiple program IDs
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               programIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: List of subjects for the specified programs
 */
router.post('/by-programs', protect, getSubjectsByPrograms);

/**
 * @swagger
 * /api/subjects/{id}:
 *   get:
 *     summary: Get subject by ID
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subject data
 *       404:
 *         description: Subject not found
 */
router.get('/:id', getSubjectById);

/**
 * @swagger
 * /api/subjects/{id}:
 *   put:
 *     summary: Update a subject
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               programId:
 *                 type: array
 *                 items:
 *                   type: string
 *               semester:
 *                 type: number
 *               credits:
 *                 type: object
 *                 properties:
 *                   theory:
 *                     type: number
 *                   practical:
 *                     type: number
 *                   tutorial:
 *                     type: number
 *               weeklyHours:
 *                 type: object
 *                 properties:
 *                   theory:
 *                     type: number
 *                   practical:
 *                     type: number
 *                   tutorial:
 *                     type: number
 *     responses:
 *       200:
 *         description: Subject updated
 *       404:
 *         description: Subject not found
 */
router.put('/:id', protect, authorize('admin'), updateSubject);

/**
 * @swagger
 * /api/subjects/bulk:
 *   delete:
 *     summary: Delete multiple subjects in bulk
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: array
 *                 items:
 *                   type: string
 *                 description: Array of subject IDs
 *               - type: object
 *                 properties:
 *                   subjectIds:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Array of subject IDs
 *                 required:
 *                   - subjectIds
 *     responses:
 *       200:
 *         description: Subjects deleted successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: No subjects found
 */
router.delete('/bulk', protect, authorize('admin'), deleteSubjectsBulk);

/**
 * @swagger
 * /api/subjects/program/{programId}:
 *   delete:
 *     summary: Delete all subjects belonging to a specific program
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *         description: Program ID to delete subjects for
 *     responses:
 *       200:
 *         description: Subjects deleted/updated successfully
 *       400:
 *         description: Invalid program ID
 *       404:
 *         description: No subjects found for program
 */
router.delete('/program/:programId', protect, authorize('admin'), deleteSubjectsByProgramId);

/**
 * @swagger
 * /api/subjects/{id}:
 *   delete:
 *     summary: Delete a subject
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subject removed
 *       404:
 *         description: Subject not found
 */
router.delete('/:id', protect, authorize('admin'), deleteSubject);

module.exports = router;
