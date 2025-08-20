const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');

/**
 * DEPRECATED: PDF Export Routes
 * These routes have been moved to routes/routine.js to consolidate PDF functionality
 * This file is kept for reference but should not be used in production
 */

console.warn('⚠️  DEPRECATED: routes/pdf.js is deprecated. PDF routes have been moved to routes/routine.js');

/**
 * Export class routine to PDF
 * MOVED TO: GET /api/routines/:programCode/:semester/:section/export-pdf
 */
router.get('/routine/export', pdfController.exportRoutineToPDF);

/**
 * Export teacher schedule to PDF
 * MOVED TO: GET /api/routines/teacher/:teacherId/export-pdf
 */
router.get('/teacher/:teacherId/export', pdfController.exportTeacherScheduleToPDF);

/**
 * Export all teachers' schedules to PDF
 * MOVED TO: GET /api/routines/teachers/export-pdf
 */
router.get('/teacher/export/all', pdfController.exportAllTeachersSchedulesToPDF);

/**
 * Export room schedule to PDF
 * MOVED TO: GET /api/routines/room/:roomId/export-pdf
 */
router.get('/room/:roomId/export', pdfController.exportRoomScheduleToPDF);

/**
 * Export all room schedules to PDF
 * MOVED TO: GET /api/routines/rooms/export-pdf
 */
router.get('/room/export/all', pdfController.exportAllRoomSchedulesToPDF);

module.exports = router;
