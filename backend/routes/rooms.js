const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const {
  getRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
  exportRoomSchedule,
  exportAllRoomSchedules
} = require('../controllers/roomController');
// Excel controller import has been removed

/**
 * @swagger
 * /api/rooms:
 *   get:
 *     summary: Get all rooms
 *     tags: [Rooms]
 *     responses:
 *       200:
 *         description: List of all rooms
 */
router.get('/', optionalAuth, getRooms);

/**
 * @swagger
 * /api/rooms/{id}:
 *   get:
 *     summary: Get room by ID
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Room details
 *       404:
 *         description: Room not found
 */
router.get('/:id', optionalAuth, getRoom);

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     summary: Create a new room
 *     tags: [Rooms]
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
 *               - capacity
 *               - roomType
 *             properties:
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               capacity:
 *                 type: number
 *               roomType:
 *                 type: string
 *                 enum: [LECTURE, LAB, TUTORIAL, AUDITORIUM]
 *     responses:
 *       201:
 *         description: Room created successfully
 */
router.post(
  '/',
  [
    protect,
    authorize('admin'),
    [
      check('name', 'Room name is required').not().isEmpty().trim(),
      check('capacity', 'Capacity must be a positive number').isInt({ min: 1, max: 200 }),
      check('type', 'Room type is required').isIn(['Lecture Hall', 'Computer Lab', 'Electronics Lab', 'Microprocessor Lab', 'Project Lab', 'Tutorial Room', 'Auditorium']),
      check('building', 'Building is required').optional().isIn(['CIC', 'DOECE', 'Main Building', 'Library', 'Other']),
      check('floor', 'Floor must be a number between 0 and 10').optional().isInt({ min: 0, max: 10 }),
      check('features', 'Features must be an array').optional().isArray(),
      check('features.*', 'Invalid feature').optional().isIn(['Projector', 'Whiteboard', 'AC', 'Smart Board', 'Oscilloscope', 'Function Generator', 'Computers']),
      check('notes', 'Notes must be a string').optional().isString()
    ]
  ],
  createRoom
);

/**
 * @swagger
 * /api/rooms/{id}:
 *   put:
 *     summary: Update room
 *     tags: [Rooms]
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
 *         description: Room updated successfully
 */
router.put(
  '/:id',
  [
    protect,
    authorize('admin'),
    [
      check('name', 'Room name is required').optional().not().isEmpty().trim(),
      check('capacity', 'Capacity must be a positive number').optional().isInt({ min: 1, max: 200 }),
      check('type', 'Invalid room type').optional().isIn(['Lecture Hall', 'Computer Lab', 'Electronics Lab', 'Microprocessor Lab', 'Project Lab', 'Tutorial Room', 'Auditorium']),
      check('building', 'Building is required').optional().isIn(['CIC', 'DOECE', 'Main Building', 'Library', 'Other']),
      check('floor', 'Floor must be a number between 0 and 10').optional().isInt({ min: 0, max: 10 }),
      check('features', 'Features must be an array').optional().isArray(),
      check('features.*', 'Invalid feature').optional().isIn(['Projector', 'Whiteboard', 'AC', 'Smart Board', 'Oscilloscope', 'Function Generator', 'Computers']),
      check('notes', 'Notes must be a string').optional().isString()
    ]
  ],
  updateRoom
);

/**
 * @swagger
 * /api/rooms/{id}:
 *   delete:
 *     summary: Delete room
 *     tags: [Rooms]
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
 *         description: Room deleted successfully
 */
/**
 * @swagger
 * /api/rooms/{id}:
 *   delete:
 *     summary: Delete a room
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Room deleted successfully
 */
router.delete('/:id', protect, authorize('admin'), deleteRoom);

/**
 * @swagger
 * /api/rooms/export/all:
 *   get:
 *     summary: Export all room schedules to Excel
 *     tags: [Rooms]
 *     parameters:
 *       - in: query
 *         name: academicYear
 *         schema:
 *           type: string
 *         description: Academic year ID (optional)
 *     responses:
 *       200:
 *         description: Excel file download with multiple sheets
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/export/all', protect, authorize('admin'), exportAllRoomSchedules);

/**
 * @swagger
 * /api/rooms/{id}/export:
 *   get:
 *     summary: Export room schedule to Excel
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *       - in: query
 *         name: academicYear
 *         schema:
 *           type: string
 *         description: Academic year ID (optional)
 *     responses:
 *       200:
 *         description: Excel file download
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Room not found
 */
router.get('/:id/export', protect, authorize('admin'), exportRoomSchedule);

module.exports = router;
