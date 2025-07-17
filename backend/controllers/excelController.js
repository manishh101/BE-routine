const ExcelUploadService = require('../services/ExcelUploadService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

/**
 * 🗂️ Excel Upload Controller
 * Handles all Excel file upload operations for academic data
 */

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for Excel files only
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroEnabled.12'
  ];
  
  if (allowedTypes.includes(file.mimetype) || 
      file.originalname.match(/\.(xlsx|xls|xlsm)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel files (.xlsx, .xls, .xlsm) are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

/**
 * @swagger
 * /api/excel/upload:
 *   post:
 *     summary: Upload Excel file with academic data
 *     tags: [Excel Upload]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: excelFile
 *         type: file
 *         required: true
 *         description: Excel file containing academic data
 *       - in: formData
 *         name: dataType
 *         type: string
 *         required: true
 *         enum: [teachers, subjects, rooms, routine, complete]
 *         description: Type of data to upload
 *       - in: formData
 *         name: sheetName
 *         type: string
 *         description: Specific sheet name to process (optional)
 *       - in: formData
 *         name: programCode
 *         type: string
 *         description: Program code for context (e.g., BCE, BEI)
 *       - in: formData
 *         name: semester
 *         type: integer
 *         description: Semester for routine data
 *       - in: formData
 *         name: section
 *         type: string
 *         description: Section for routine data
 *     responses:
 *       200:
 *         description: Upload successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     successful:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *                 details:
 *                   type: object
 */
const uploadExcelData = async (req, res) => {
  try {
    const { dataType, sheetName, programCode, semester, section } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No Excel file provided'
      });
    }

    if (!dataType) {
      return res.status(400).json({
        success: false,
        message: 'Data type is required (teachers, subjects, rooms, routine, complete)'
      });
    }

    console.log(`📤 Starting Excel upload: ${req.file.originalname}`);
    console.log(`📊 Data type: ${dataType}`);

    const uploadService = new ExcelUploadService();
    
    const options = {
      sheetName,
      programCode,
      semester: semester ? parseInt(semester) : undefined,
      section
    };

    const result = await uploadService.uploadFromExcel(req.file.path, dataType, options);

    // Clean up uploaded file after processing
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error deleting uploaded file:', err);
    });

    res.json(result);

  } catch (error) {
    console.error('❌ Excel upload error:', error);
    
    // Clean up file on error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting uploaded file:', err);
      });
    }

    res.status(400).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * @swagger
 * /api/excel/upload/bct-routine:
 *   post:
 *     summary: Upload the BCT routine Excel file specifically
 *     tags: [Excel Upload]
 *     description: Specialized endpoint for processing the BCT_ROUTINE_Updated.xlsx file
 *     responses:
 *       200:
 *         description: BCT routine uploaded successfully
 */
const uploadBCTRoutine = async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../../BCT_ROUTINE_Updated.xlsx');
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'BCT_ROUTINE_Updated.xlsx file not found in project root'
      });
    }

    console.log(`📅 Processing BCT routine file: ${filePath}`);

    const uploadService = new ExcelUploadService();
    
    const options = {
      programCode: 'BCE',
      semester: 4, // Default semester
      section: 'A' // Default section
    };

    const result = await uploadService.uploadFromExcel(filePath, 'routine', options);

    res.json({
      success: true,
      message: 'BCT routine processed successfully',
      ...result
    });

  } catch (error) {
    console.error('❌ BCT routine upload error:', error);
    res.status(400).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * @swagger
 * /api/excel/analyze:
 *   post:
 *     summary: Analyze Excel file structure without uploading
 *     tags: [Excel Upload]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: excelFile
 *         type: file
 *         required: true
 *         description: Excel file to analyze
 *     responses:
 *       200:
 *         description: File analysis results
 */
const analyzeExcelFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No Excel file provided'
      });
    }

    console.log(`🔍 Analyzing Excel file: ${req.file.originalname}`);

    // Read Excel file
    const workbook = XLSX.readFile(req.file.path);
    const analysis = {
      filename: req.file.originalname,
      fileSize: req.file.size,
      sheets: []
    };

    // Analyze each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      const sheetInfo = {
        name: sheetName,
        rows: data.length,
        columns: data[0] ? data[0].length : 0,
        headers: data[0] || [],
        sampleData: data.slice(1, 4), // First 3 data rows
        isEmpty: data.length <= 1
      };
      
      analysis.sheets.push(sheetInfo);
    }

    // Clean up uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error deleting uploaded file:', err);
    });

    res.json({
      success: true,
      message: 'File analyzed successfully',
      analysis
    });

  } catch (error) {
    console.error('❌ Excel analysis error:', error);
    
    // Clean up file on error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting uploaded file:', err);
      });
    }

    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @swagger
 * /api/excel/template/{dataType}:
 *   get:
 *     summary: Download Excel template for specific data type
 *     tags: [Excel Upload]
 *     parameters:
 *       - in: path
 *         name: dataType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [teachers, subjects, rooms]
 *         description: Type of template to download
 *     responses:
 *       200:
 *         description: Excel template file
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
const downloadTemplate = async (req, res) => {
  try {
    const { dataType } = req.params;
    
    console.log(`📥 Generating template for: ${dataType}`);

    const uploadService = new ExcelUploadService();
    const workbook = uploadService.generateTemplate(dataType);

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${dataType}_template.xlsx"`);

    // Write workbook to response
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);

  } catch (error) {
    console.error('❌ Template generation error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @swagger
 * /api/excel/sheets:
 *   get:
 *     summary: List available sheets in BCT routine file
 *     tags: [Excel Upload]
 *     responses:
 *       200:
 *         description: List of sheets in the BCT routine file
 */
const listBCTSheets = async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../../BCT_ROUTINE_Updated.xlsx');
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'BCT_ROUTINE_Updated.xlsx file not found'
      });
    }

    const workbook = XLSX.readFile(filePath);
    const sheetsInfo = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      sheetsInfo.push({
        name: sheetName,
        rows: data.length,
        columns: data[0] ? data[0].length : 0,
        isEmpty: data.length <= 1,
        preview: data.slice(0, 3) // First 3 rows as preview
      });
    }

    res.json({
      success: true,
      message: 'BCT routine sheets listed',
      filename: 'BCT_ROUTINE_Updated.xlsx',
      sheets: sheetsInfo
    });

  } catch (error) {
    console.error('❌ Error listing BCT sheets:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Export Room Schedule to Excel
 * @desc    Export a single room's schedule to Excel format
 * @route   GET /api/rooms/:roomId/export
 * @access  Public
 */
const exportRoomScheduleToExcel = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { academicYear } = req.query;

    // Get current academic year if not provided
    const currentAcademicYear = academicYear ? 
      await require('../models/AcademicCalendar').findById(academicYear) :
      await require('../models/AcademicCalendar').findOne({ isCurrentYear: true });

    if (!currentAcademicYear) {
      return res.status(404).json({
        success: false,
        message: 'No academic year found'
      });
    }

    // Get room info
    const Room = require('../models/Room');
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Get all routine slots for this room
    const RoutineSlot = require('../models/RoutineSlot');
    const routineSlots = await RoutineSlot.find({
      roomId: roomId,
      academicYearId: currentAcademicYear._id,
      isActive: true
    })
    .populate('teacherIds', 'fullName shortName')
    .populate('subjectId', 'name code')
    .sort({ dayIndex: 1, slotIndex: 1 });

    // Get time slots for header
    const TimeSlot = require('../models/TimeSlot');
    const timeSlots = await TimeSlot.find({ isActive: true }).sort({ sortOrder: 1 });

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    
    // Prepare data for Excel
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const scheduleData = [];
    
    // Create header row
    const headerRow = ['Day', ...timeSlots.map(slot => slot.label)];
    scheduleData.push(headerRow);
    
    // Create routine grid
    const routine = {};
    for (let day = 0; day <= 6; day++) {
      routine[day] = {};
    }
    
    // Populate routine with classes
    routineSlots.forEach(slot => {
      const timeSlotIndex = timeSlots.findIndex(ts => ts._id.toString() === slot.timeSlotId?.toString());
      if (timeSlotIndex !== -1) {
        const classInfo = `${slot.subjectName_display || slot.subjectId?.name || 'N/A'}\n` +
                         `${slot.programCode} Sem${slot.semester} ${slot.section}\n` +
                         `${slot.teacherShortNames_display?.join(', ') || slot.teacherIds?.map(t => t.shortName).join(', ') || 'TBA'}\n` +
                         `[${slot.classType}]`;
        
        routine[slot.dayIndex][timeSlotIndex] = classInfo;
      }
    });
    
    // Add data rows
    days.forEach((day, dayIndex) => {
      const row = [day];
      timeSlots.forEach((slot, slotIndex) => {
        row.push(routine[dayIndex][slotIndex] || '');
      });
      scheduleData.push(row);
    });
    
    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(scheduleData);
    
    // Set column widths
    const columnWidths = [{ wch: 15 }, ...timeSlots.map(() => ({ wch: 25 }))];
    worksheet['!cols'] = columnWidths;
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, `${room.name} Schedule`);
    
    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Set response headers
    const fileName = `${room.name.replace(/[^a-zA-Z0-9]/g, '_')}_Schedule_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Send file
    res.send(excelBuffer);
    
  } catch (error) {
    console.error('Error exporting room schedule to Excel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export room schedule to Excel',
      error: error.message
    });
  }
};

/**
 * Export All Room Schedules to Excel
 * @desc    Export all room schedules to Excel format with multiple sheets
 * @route   GET /api/rooms/export/all
 * @access  Public
 */
const exportAllRoomSchedulesToExcel = async (req, res) => {
  try {
    const { academicYear } = req.query;

    // Get current academic year if not provided
    const currentAcademicYear = academicYear ? 
      await require('../models/AcademicCalendar').findById(academicYear) :
      await require('../models/AcademicCalendar').findOne({ isCurrentYear: true });

    if (!currentAcademicYear) {
      return res.status(404).json({
        success: false,
        message: 'No academic year found'
      });
    }

    // Get all rooms
    const Room = require('../models/Room');
    const rooms = await Room.find({ isActive: true }).sort({ name: 1 });

    // Get time slots for header
    const TimeSlot = require('../models/TimeSlot');
    const timeSlots = await TimeSlot.find({ isActive: true }).sort({ sortOrder: 1 });

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Process each room
    for (const room of rooms) {
      // Get routine slots for this room
      const RoutineSlot = require('../models/RoutineSlot');
      const routineSlots = await RoutineSlot.find({
        roomId: room._id,
        academicYearId: currentAcademicYear._id,
        isActive: true
      })
      .populate('teacherIds', 'fullName shortName')
      .populate('subjectId', 'name code')
      .sort({ dayIndex: 1, slotIndex: 1 });

      // Prepare data for Excel
      const scheduleData = [];
      
      // Create header row
      const headerRow = ['Day', ...timeSlots.map(slot => slot.label)];
      scheduleData.push(headerRow);
      
      // Create routine grid
      const routine = {};
      for (let day = 0; day <= 6; day++) {
        routine[day] = {};
      }
      
      // Populate routine with classes
      routineSlots.forEach(slot => {
        const timeSlotIndex = timeSlots.findIndex(ts => ts._id.toString() === slot.timeSlotId?.toString());
        if (timeSlotIndex !== -1) {
          const classInfo = `${slot.subjectName_display || slot.subjectId?.name || 'N/A'}\n` +
                           `${slot.programCode} Sem${slot.semester} ${slot.section}\n` +
                           `${slot.teacherShortNames_display?.join(', ') || slot.teacherIds?.map(t => t.shortName).join(', ') || 'TBA'}\n` +
                           `[${slot.classType}]`;
          
          routine[slot.dayIndex][timeSlotIndex] = classInfo;
        }
      });
      
      // Add data rows
      days.forEach((day, dayIndex) => {
        const row = [day];
        timeSlots.forEach((slot, slotIndex) => {
          row.push(routine[dayIndex][slotIndex] || '');
        });
        scheduleData.push(row);
      });
      
      // Create worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(scheduleData);
      
      // Set column widths
      const columnWidths = [{ wch: 15 }, ...timeSlots.map(() => ({ wch: 25 }))];
      worksheet['!cols'] = columnWidths;
      
      // Add worksheet to workbook
      const sheetName = room.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }
    
    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Set response headers
    const fileName = `All_Room_Schedules_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Send file
    res.send(excelBuffer);
    
  } catch (error) {
    console.error('Error exporting all room schedules to Excel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export all room schedules to Excel',
      error: error.message
    });
  }
};

module.exports = {
  upload: upload.single('excelFile'),
  uploadExcelData,
  uploadBCTRoutine,
  analyzeExcelFile,
  downloadTemplate,
  listBCTSheets,
  exportRoomScheduleToExcel,
  exportAllRoomSchedulesToExcel
};
