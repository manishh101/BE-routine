const express = require('express');
const router = express.Router();
const { createProgram, getPrograms, getProgramById, updateProgram, deleteProgram } = require('../controllers/programController');
const { protect, authorize } = require('../middleware/auth');
const { check } = require('express-validator');

/**
 * @swagger
 * /api/programs:
 *   post:
 *     summary: Create a new program
 *     tags: [Programs]
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
 *               - departmentId
 *               - totalSemesters
 *             properties:
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               departmentId:
 *                 type: string
 *                 description: MongoDB ObjectId of the department
 *               totalSemesters:
 *                 type: number
 *               level:
 *                 type: string
 *                 enum: [Bachelor, Master, PhD]
 *               description:
 *                 type: string
 *               syllabusYear:
 *                 type: string
 *               sections:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Program created successfully
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
    check('departmentId', 'Department ID is required').isMongoId().withMessage('Department ID must be a valid ObjectId'),
    check('totalSemesters', 'Total semesters is required').isNumeric().withMessage('Total semesters must be a number'),
  ],
  createProgram
);

/**
 * @swagger
 * /api/programs:
 *   get:
 *     summary: Get all programs
 *     tags: [Programs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of programs
 */
router.get('/', getPrograms);

/**
 * @swagger
 * /api/programs/{id}:
 *   get:
 *     summary: Get program by ID
 *     tags: [Programs]
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
 *         description: Program data
 *       404:
 *         description: Program not found
 */
router.get('/:id', getProgramById);

/**
 * @swagger
 * /api/programs/{id}:
 *   put:
 *     summary: Update a program
 *     tags: [Programs]
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
 *               department:
 *                 type: string
 *               semesters:
 *                 type: number
 *     responses:
 *       200:
 *         description: Program updated
 *       404:
 *         description: Program not found
 */
router.put('/:id', protect, authorize('admin'), updateProgram);

/**
 * @swagger
 * /api/programs/{id}:
 *   delete:
 *     summary: Delete a program
 *     tags: [Programs]
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
 *         description: Program removed
 *       404:
 *         description: Program not found
 */
router.delete('/:id', protect, authorize('admin'), deleteProgram);

module.exports = router;
