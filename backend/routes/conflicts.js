const express = require('express');
const router = express.Router();
const conflictDetection = require('../services/conflictDetection');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const RoutineSlot = require('../models/RoutineSlot');
const AcademicSession = require('../models/AcademicSession');

/**
 * @swagger
 * /api/conflicts/check:
 *   post:
 *     summary: Check conflicts for a potential routine slot
 *     tags: [Conflicts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dayIndex
 *               - slotIndex
 *               - teacherIds
 *               - roomId
 *             properties:
 *               dayIndex:
 *                 type: number
 *               slotIndex:
 *                 type: number
 *               teacherIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               roomId:
 *                 type: string
 *               recurrence:
 *                 type: string
 *               programId:
 *                 type: string
 *               semester:
 *                 type: number
 *               section:
 *                 type: string
 *               academicYearId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Conflict check results
 */
router.post('/check', verifyToken, async (req, res) => {
  try {
    const conflicts = await conflictDetection.validateSchedule(req.body);
    
    res.json({
      hasConflicts: conflicts.length > 0,
      conflicts,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Conflict check error:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/**
 * @swagger
 * /api/conflicts/advanced-analysis:
 *   post:
 *     summary: Perform advanced conflict analysis on routine data
 *     tags: [Conflicts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - academicYearId
 *             properties:
 *               academicYearId:
 *                 type: string
 *               programId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Advanced conflict analysis results
 */
router.post('/advanced-analysis', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { academicYearId, programId } = req.body;
    const filter = { academicYearId, isActive: true };
    
    if (programId) {
      filter.programId = programId;
    }
    
    const slots = await RoutineSlot.find(filter)
      .populate('teacherIds', 'shortName fullName')
      .populate('roomId', 'name building')
      .populate('programId', 'name code')
      .populate('subjectId', 'name code');
      
    const conflicts = await conflictDetection.analyzeAllConflicts(slots);
    
    res.json({
      totalSlots: slots.length,
      conflictsFound: conflicts.length,
      conflicts,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Advanced conflict analysis error:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/**
 * @swagger
 * /api/conflicts/session/{id}:
 *   get:
 *     summary: Get conflicts for a specific academic session
 *     tags: [Conflicts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Academic session ID
 *     responses:
 *       200:
 *         description: Conflict check results for session
 */
router.get('/session/:id', verifyToken, async (req, res) => {
  try {
    const session = await AcademicSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ msg: 'Academic session not found' });
    }
    
    const slots = await RoutineSlot.find({ 
      academicYearId: session.academicYearId,
      isActive: true 
    })
    .populate('teacherIds', 'shortName fullName')
    .populate('roomId', 'name building')
    .populate('programId', 'name code')
    .populate('subjectId', 'name code');
    
    const conflicts = await conflictDetection.analyzeAllConflicts(slots);
    
    res.json({
      session: {
        id: session._id,
        name: session.name,
        status: session.status
      },
      totalSlots: slots.length,
      conflictsFound: conflicts.length,
      conflicts,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Session conflict check error:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Academic session not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;
