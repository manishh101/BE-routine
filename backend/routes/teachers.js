const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const teacherController = require('../controllers/teacherController');
const routineController = require('../controllers/routineController');
const { verifyToken, requireAdmin, optionalAuth } = require('../middleware/auth');

/**
 * @swagger
 * /api/teachers:
 *   post:
 *     summary: Create a new teacher
 *     tags: [Teachers]
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
 *               - email
 *               - department
 *               - designation
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               department:
 *                 type: string
 *               designation:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               userId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Teacher created successfully
 *       400:
 *         description: Bad request
 */
router.post(
  '/',
  verifyToken,
  requireAdmin,
  [
    check('fullName', 'Full name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('departmentId', 'Department ID is required').not().isEmpty(),
    check('designation', 'Designation is required').not().isEmpty(),
  ],
  teacherController.createTeacher
);

/**
 * @swagger
 * /api/teachers/bulk:
 *   post:
 *     summary: Create multiple teachers in bulk
 *     tags: [Teachers]
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
 *                   type: object
 *                   required:
 *                     - fullName
 *                     - email
 *                     - departmentId
 *                     - designation
 *                   properties:
 *                     fullName:
 *                       type: string
 *                     shortName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     departmentId:
 *                       type: string
 *                     designation:
 *                       type: string
 *                     phoneNumber:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                       default: true
 *                     isFullTime:
 *                       type: boolean
 *                       default: true
 *                     maxWeeklyHours:
 *                       type: number
 *                       default: 16
 *                     availableDays:
 *                       type: array
 *                       items:
 *                         type: number
 *               - type: object
 *                 properties:
 *                   teachers:
 *                     type: array
 *                     items:
 *                       type: object
 *                       required:
 *                         - fullName
 *                         - email
 *                         - departmentId
 *                         - designation
 *                       properties:
 *                         fullName:
 *                           type: string
 *                         shortName:
 *                           type: string
 *                         email:
 *                           type: string
 *                         departmentId:
 *                           type: string
 *                         designation:
 *                           type: string
 *                         phoneNumber:
 *                           type: string
 *                         isActive:
 *                           type: boolean
 *                           default: true
 *                         isFullTime:
 *                           type: boolean
 *                           default: true
 *                         maxWeeklyHours:
 *                           type: number
 *                           default: 16
 *                         availableDays:
 *                           type: array
 *                           items:
 *                             type: number
 *           examples:
 *             direct_array:
 *               summary: Direct array format
 *               value:
 *                 - fullName: "Dr. John Smith"
 *                   shortName: "JS"
 *                   email: "john.smith@ioe.edu.np"
 *                   departmentId: "64a1b2c3d4e5f6789012345a"
 *                   designation: "Professor"
 *                   phoneNumber: "+977-9841234567"
 *                   isActive: true
 *                   isFullTime: true
 *                   maxWeeklyHours: 16
 *                   availableDays: [0, 1, 2, 3, 4, 5]
 *             wrapped_format:
 *               summary: Wrapped format
 *               value:
 *                 teachers:
 *                   - fullName: "Dr. John Smith"
 *                     shortName: "JS"
 *                     email: "john.smith@ioe.edu.np"
 *                     departmentId: "64a1b2c3d4e5f6789012345a"
 *                     designation: "Professor"
 *                     phoneNumber: "+977-9841234567"
 *                     isActive: true
 *                     isFullTime: true
 *                     maxWeeklyHours: 16
 *                     availableDays: [0, 1, 2, 3, 4, 5]
 *     responses:
 *       201:
 *         description: Teachers created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 insertedCount:
 *                   type: number
 *                 teachers:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Validation errors
 *       500:
 *         description: Server error
 */
router.post('/bulk', verifyToken, requireAdmin, teacherController.createTeachersBulk);

/**
 * @swagger
 * /api/teachers/meeting-scheduler:
 *   post:
 *     summary: Find common free time slots for multiple teachers (Meeting Scheduler)
 *     tags: [Teachers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teacherIds
 *             properties:
 *               teacherIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of teacher IDs (minimum 2)
 *               academicYearId:
 *                 type: string
 *                 description: Academic year ID (optional, uses current if not provided)
 *               minDuration:
 *                 type: integer
 *                 default: 1
 *                 description: Minimum duration in time slots
 *               excludeDays:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Days to exclude (0=Sunday, 6=Saturday)
 *     responses:
 *       200:
 *         description: Meeting slots found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     searchCriteria:
 *                       type: object
 *                     statistics:
 *                       type: object
 *                     teachers:
 *                       type: array
 *                     commonFreeSlots:
 *                       type: array
 *                     recommendations:
 *                       type: object
 *       400:
 *         description: Invalid input or validation errors
 *       500:
 *         description: Server error
 */
router.post('/meeting-scheduler', verifyToken, [
  check('teacherIds').isArray({ min: 2 }).withMessage('At least 2 teacher IDs are required'),
  check('teacherIds.*').isMongoId().withMessage('Invalid teacher ID format'),
  check('minDuration').optional().isInt({ min: 1, max: 8 }).withMessage('Duration must be between 1 and 8 slots'),
  check('excludeDays').optional().isArray().withMessage('excludeDays must be an array'),
  check('excludeDays.*').optional().isInt({ min: 0, max: 6 }).withMessage('Days must be between 0 (Sunday) and 6 (Saturday)')
], teacherController.findMeetingSlots);

/**
 * @swagger
 * /api/teachers:
 *   get:
 *     summary: Get all teachers
 *     tags: [Teachers]
 *     responses:
 *       200:
 *         description: List of teachers
 */
router.get('/', optionalAuth, teacherController.getTeachers);

/**
 * @swagger
 * /api/teachers/{id}:
 *   get:
 *     summary: Get teacher by ID
 *     tags: [Teachers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Teacher data
 *       404:
 *         description: Teacher not found
 */
router.get('/:id', optionalAuth, teacherController.getTeacherById);

/**
 * @swagger
 * /api/teachers/{id}:
 *   put:
 *     summary: Update a teacher
 *     tags: [Teachers]
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
 *               email:
 *                 type: string
 *               department:
 *                 type: string
 *               designation:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Teacher updated
 *       404:
 *         description: Teacher not found
 */
router.put(
  '/:id',
  verifyToken,
  requireAdmin,
  teacherController.updateTeacher
);

/**
 * @swagger
 * /api/teachers/bulk:
 *   delete:
 *     summary: Delete multiple teachers in bulk
 *     tags: [Teachers]
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
 *                 description: Array of teacher IDs
 *               - type: object
 *                 properties:
 *                   teacherIds:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Array of teacher IDs
 *                 required:
 *                   - teacherIds
 *     responses:
 *       200:
 *         description: Teachers deactivated successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: No teachers found
 */
router.delete('/bulk', verifyToken, requireAdmin, teacherController.deleteTeachersBulk);

/**
 * @swagger
 * /api/teachers/department/{departmentId}:
 *   delete:
 *     summary: Delete all teachers belonging to a specific department
 *     tags: [Teachers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ID to delete teachers for
 *     responses:
 *       200:
 *         description: Teachers deactivated/skipped successfully
 *       400:
 *         description: Invalid department ID
 *       404:
 *         description: No teachers found for department
 */
router.delete('/department/:departmentId', verifyToken, requireAdmin, teacherController.deleteTeachersByDepartmentId);

/**
 * @swagger
 * /api/teachers/hard-delete/all:
 *   delete:
 *     summary: PERMANENTLY delete ALL teachers from database (DANGER)
 *     tags: [Teachers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All teachers permanently deleted
 *       500:
 *         description: Server error
 */
router.delete('/hard-delete/all', verifyToken, requireAdmin, teacherController.hardDeleteAllTeachers);

/**
 * @swagger
 * /api/teachers/hard-delete/bulk:
 *   delete:
 *     summary: PERMANENTLY delete multiple teachers from database (DANGER)
 *     tags: [Teachers]
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
 *                 description: Array of teacher IDs to permanently delete
 *               - type: object
 *                 properties:
 *                   teacherIds:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Array of teacher IDs to permanently delete
 *                 required:
 *                   - teacherIds
 *     responses:
 *       200:
 *         description: Teachers permanently deleted
 *       400:
 *         description: Bad request
 *       404:
 *         description: No teachers found
 */
router.delete('/hard-delete/bulk', verifyToken, requireAdmin, teacherController.hardDeleteTeachersBulk);

/**
 * @swagger
 * /api/teachers/{id}:
 *   delete:
 *     summary: Delete a teacher
 *     tags: [Teachers]
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
 *         description: Teacher removed
 *       404:
 *         description: Teacher not found
 */
router.delete('/:id', verifyToken, requireAdmin, teacherController.deleteTeacher);

/**
 * @swagger
 * /api/teachers/{id}/schedule:
 *   get:
 *     summary: Get a teacher's pre-generated schedule
 *     tags: [Teachers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The teacher's ID
 *     responses:
 *       200:
 *         description: The teacher's schedule
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *       404:
 *         description: Teacher schedule not found
 */
router.get('/:id/schedule', optionalAuth, teacherController.getTeacherSchedule);

/**
 * @swagger
 * /api/teachers/{id}/schedule/excel:
 *   get:
 *     summary: Export a teacher's schedule as Excel file
 *     tags: [Teachers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The teacher's ID
 *     responses:
 *       200:
 *         description: Excel file containing the teacher's schedule
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Teacher or schedule not found
 */
// Implement teacher schedule export functionality
router.get('/:id/schedule/excel', optionalAuth, teacherController.exportTeacherSchedule);

module.exports = router;
