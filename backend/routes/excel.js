const express = require('express');
const router = express.Router();
const excelController = require('../controllers/excelController');

/**
 * 📊 Excel Upload Routes
 * 
 * Endpoints for handling Excel file uploads and data processing
 * Supports bulk upload of academic data including:
 * - Teachers
 * - Subjects 
 * - Rooms
 * - Routine schedules
 * - Complete academic datasets
 */

/**
 * @swagger
 * tags:
 *   name: Excel Upload
 *   description: Excel file upload and processing operations
 */

/**
 * Upload Excel file with academic data
 * POST /api/excel/upload
 * 
 * Form data:
 * - excelFile: Excel file (.xlsx, .xls, .xlsm)
 * - dataType: Type of data (teachers, subjects, rooms, routine, complete)
 * - sheetName: (optional) Specific sheet to process
 * - programCode: (optional) Program context (BCE, BEI, etc.)
 * - semester: (optional) Semester for routine data
 * - section: (optional) Section for routine data
 */
router.post('/upload', 
  excelController.upload, 
  excelController.uploadExcelData
);

/**
 * Process the BCT routine Excel file specifically
 * POST /api/excel/upload/bct-routine
 * 
 * Processes the BCT_ROUTINE_Updated.xlsx file from project root
 * No file upload required - uses existing file
 */
router.post('/upload/bct-routine', excelController.uploadBCTRoutine);

/**
 * Analyze Excel file structure without uploading data
 * POST /api/excel/analyze
 * 
 * Form data:
 * - excelFile: Excel file to analyze
 * 
 * Returns file structure, sheet names, headers, and sample data
 */
router.post('/analyze', 
  excelController.upload, 
  excelController.analyzeExcelFile
);

/**
 * Download Excel template for specific data type
 * GET /api/excel/template/:dataType
 * 
 * Available templates:
 * - teachers: Teacher data template
 * - subjects: Subject data template  
 * - rooms: Room data template
 */
router.get('/template/:dataType', excelController.downloadTemplate);

/**
 * List sheets in the BCT routine file
 * GET /api/excel/sheets
 * 
 * Returns information about all sheets in BCT_ROUTINE_Updated.xlsx
 */
router.get('/sheets', excelController.listBCTSheets);

/**
 * Health check for Excel upload service
 * GET /api/excel/health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Excel Upload Service',
    status: 'operational',
    supportedFormats: ['.xlsx', '.xls', '.xlsm'],
    supportedDataTypes: ['teachers', 'subjects', 'rooms', 'routine', 'complete'],
    maxFileSize: '50MB',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
