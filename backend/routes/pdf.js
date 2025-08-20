const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');

/**
 * PDF Export Routes
 * Replace Excel export functionality with PDF export
 */

/**
 * Export class routine to PDF
 * GET /api/pdf/routine/export
 * 
 * Query parameters:
 * - programCode: Program code (e.g., 'BCT')
 * - semester: Semester number
 * - section: Section (e.g., 'AB', 'CD')
 */
router.get('/routine/export', pdfController.exportRoutineToPDF);

/**
 * Export teacher schedule to PDF
 * GET /api/pdf/teacher/:teacherId/export
 * 
 * Path parameters:
 * - teacherId: Teacher ID
 * 
 * Query parameters:
 * - academicYear: Academic year ID (optional)
 */
router.get('/teacher/:teacherId/export', pdfController.exportTeacherScheduleToPDF);

/**
 * Export all teachers' schedules to PDF
 * GET /api/pdf/teacher/export/all
 * 
 * Query parameters:
 * - academicYear: Academic year ID (optional)
 */
router.get('/teacher/export/all', pdfController.exportAllTeachersSchedulesToPDF);

/**
 * Export room schedule to PDF
 * GET /api/pdf/room/:roomId/export
 * 
 * Path parameters:
 * - roomId: Room ID
 * 
 * Query parameters:
 * - academicYear: Academic year ID (optional)
 */
router.get('/room/:roomId/export', pdfController.exportRoomScheduleToPDF);

/**
 * Export all room schedules to PDF
 * GET /api/pdf/room/export/all
 * 
 * Query parameters:
 * - academicYear: Academic year ID (optional)
 */
router.get('/room/export/all', pdfController.exportAllRoomSchedulesToPDF);

module.exports = router;
