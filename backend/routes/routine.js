const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getAllRoutines } = require('../controllers/routineAllController');

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream' // Sometimes Excel files are detected as this
    ];
    const allowedExtensions = ['.xls', '.xlsx'];
    const fileExtension = file.originalname.toLowerCase().slice(-5);
    
    if (allowedMimes.includes(file.mimetype) || 
        allowedExtensions.some(ext => fileExtension.includes(ext))) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. File: ${file.originalname}, MIME: ${file.mimetype}. Only Excel files (.xls, .xlsx) are allowed.`), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

const {
  getRoutine,
  assignClass,
  assignClassSpanned,
  clearClass,
  clearSpanGroup,
  clearEntireRoutine,
  getProgramRoutines,
  checkRoomAvailability,
  checkTeacherAvailability,
  getAvailableSubjects,
  exportRoutineToExcel,
  exportRoutineToPDF,
  exportAllSemesterRoutinesToPDF,
  analyzeScheduleConflicts,
  scheduleElectiveClass,
  scheduleElectiveClassSpanned,
  getUnifiedSectionRoutine,
  checkElectiveConflicts,
  getRoomSchedule,
  getVacantRooms,
  getVacantTeachers,
  getRoomVacancyForDay,
  getRoomVacancyAnalytics,
  // Teacher and Room PDF exports using working PDFRoutineService
  exportTeacherScheduleToPDF,
  exportAllTeachersSchedulesToPDF,
  exportRoomScheduleToPDF,
  exportAllRoomSchedulesToPDF
} = require('../controllers/routineController');
const { ConflictDetectionService } = require('../services/conflictDetection');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { check } = require('express-validator');

// @route   GET /api/routines
// @desc    Get all routines with filtering and pagination
// @access  Public (optional authentication)
router.get('/', optionalAuth, getAllRoutines);

// Validation rules for class assignment
const assignClassValidation = [
  check('dayIndex', 'Day index must be between 0-6').isInt({ min: 0, max: 6 }),
  check('slotIndex', 'Slot index must be a non-negative integer').isInt({ min: 0 }),
  check('classType', 'Class type must be L, P, T, or BREAK').isIn(['L', 'P', 'T', 'BREAK']),
  
  // Conditional validation - these fields are required only for non-BREAK classes
  check('subjectId').custom((value, { req }) => {
    if (req.body.classType !== 'BREAK' && !value) {
      throw new Error('Subject ID is required for non-break classes');
    }
    return true;
  }),
  check('teacherIds').custom((value, { req }) => {
    if (req.body.classType !== 'BREAK' && (!Array.isArray(value) || value.length < 1)) {
      throw new Error('Teacher IDs must be an array with at least one teacher for non-break classes');
    }
    return true;
  }),
  check('roomId').custom((value, { req }) => {
    if (req.body.classType !== 'BREAK' && !value) {
      throw new Error('Room ID is required for non-break classes');
    }
    return true;
  })
];

// Validation rules for updating class assignment
const updateClassValidation = [
  check('dayIndex', 'Day index must be between 0-6').isInt({ min: 0, max: 6 }),
  check('slotIndex', 'Slot index must be a non-negative integer').isInt({ min: 0 }),
  check('subjectId', 'Subject ID is required').notEmpty(),
  check('teacherIds', 'Teacher IDs must be an array').isArray({ min: 1 }),
  check('roomId', 'Room ID is required').notEmpty(),
  check('classType', 'Class type must be L, P, or T').optional().isIn(['L', 'P', 'T'])
];

// Validation rules for spanned class assignment
const assignClassSpannedValidation = [
  check('dayIndex', 'Day index must be between 0-6').isInt({ min: 0, max: 6 }),
  check('slotIndexes', 'Slot indexes must be an array of at least 1 element').isArray({ min: 1 }),
  check('slotIndexes.*', 'Each slot index must be a valid identifier').custom((value) => {
    // Accept either integer slot indexes or MongoDB ObjectId strings
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
      return true;
    }
    if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
      return true;
    }
    throw new Error('Each slot index must be a non-negative integer or valid ObjectId');
  }),
  check('programCode', 'Program code is required').notEmpty(),
  check('semester', 'Semester must be between 1-8').isInt({ min: 1, max: 8 }),
  check('section', 'Section must be either AB or CD').isIn(['AB', 'CD']),
  check('classType', 'Class type must be L, P, or T').isIn(['L', 'P', 'T']),
  // Conditional validation for basic fields - required unless it's a bothGroups lab class
  check('subjectId').custom((value, { req }) => {
    if (req.body.labGroupType === 'bothGroups') {
      return true; // Skip validation for bothGroups
    }
    if (!value) {
      throw new Error('Subject ID is required');
    }
    return true;
  }),
  check('teacherIds').custom((value, { req }) => {
    if (req.body.labGroupType === 'bothGroups') {
      return true; // Skip validation for bothGroups
    }
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error('Teacher IDs must be an array');
    }
    return true;
  }),
  check('roomId').custom((value, { req }) => {
    if (req.body.labGroupType === 'bothGroups') {
      return true; // Skip validation for bothGroups
    }
    if (!value) {
      throw new Error('Room ID is required');
    }
    return true;
  }),
  // Optional fields that don't need validation
  check('notes').optional(),
  check('labGroupType').optional().isIn(['groupA', 'groupB', 'bothGroups']),
  check('isAlternativeWeek').optional().isBoolean(),
  check('groupASubject').optional().isMongoId(),
  check('groupBSubject').optional().isMongoId(),
  check('groupATeachers').optional().isArray(),
  check('groupBTeachers').optional().isArray(),
  check('groupARoom').optional().isMongoId(),
  check('groupBRoom').optional().isMongoId(),
  check('labGroup').optional().isIn(['A', 'B', 'C', 'D', 'ALL']),
  check('displayLabel').optional().isString(),
  check('isMultiPeriod').optional().isBoolean()
];

const clearClassValidation = [
  check('dayIndex', 'Day index must be between 0-6').isInt({ min: 0, max: 6 }),
  check('slotIndex', 'Slot index must be a non-negative integer').isInt({ min: 0 })
];

// Validation rules for elective scheduling
const scheduleElectiveValidation = [
  check('programId', 'Program ID is required').notEmpty(),
  check('semester', 'Semester must be 7 or 8').isInt({ min: 7, max: 8 }),
  check('subjectId', 'Subject ID is required').notEmpty(),
  check('dayIndex', 'Day index must be between 0-6').isInt({ min: 0, max: 6 }),
  check('slotIndex', 'Slot index must be a non-negative integer').isInt({ min: 0 }),
  check('teacherIds', 'Teacher IDs must be an array').isArray(),
  check('roomId', 'Room ID is required').notEmpty(),
  check('classType', 'Class type must be L, P, or T').isIn(['L', 'P', 'T']),
  check('electiveType', 'Elective type must be TECHNICAL, MANAGEMENT, or OPEN').isIn(['TECHNICAL', 'MANAGEMENT', 'OPEN']),
  check('studentEnrollment.total', 'Total student enrollment is required').isInt({ min: 1 }),
  check('studentEnrollment.fromAB', 'Students from AB is required').isInt({ min: 0 }),
  check('studentEnrollment.fromCD', 'Students from CD is required').isInt({ min: 0 })
];

// Validation rules for spanned elective scheduling
const scheduleElectiveSpannedValidation = [
  check('programId', 'Program ID is required').notEmpty(),
  check('semester', 'Semester must be 7 or 8').isInt({ min: 7, max: 8 }),
  check('subjectId', 'Subject ID is required').notEmpty(),
  check('dayIndex', 'Day index must be between 0-6').isInt({ min: 0, max: 6 }),
  check('slotIndexes', 'Slot indexes must be an array of at least 1 element').isArray({ min: 1 }),
  check('slotIndexes.*', 'Each slot index must be a valid identifier').custom((value) => {
    // Accept either integer slot indexes or MongoDB ObjectId strings
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
      return true;
    }
    if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
      return true;
    }
    throw new Error('Each slot index must be a non-negative integer or valid ObjectId');
  }),
  check('teacherIds', 'Teacher IDs must be an array').isArray(),
  check('roomId', 'Room ID is required').notEmpty(),
  check('classType', 'Class type must be L, P, or T').isIn(['L', 'P', 'T']),
  check('electiveType', 'Elective type must be TECHNICAL, MANAGEMENT, or OPEN').isIn(['TECHNICAL', 'MANAGEMENT', 'OPEN']),
  check('studentEnrollment.total', 'Total student enrollment is required').isInt({ min: 1 }),
  check('studentEnrollment.fromAB', 'Students from AB is required').isInt({ min: 0 }),
  check('studentEnrollment.fromCD', 'Students from CD is required').isInt({ min: 0 })
];

// Validation rules for elective conflict checking
const electiveConflictValidation = [
  check('programId', 'Program ID is required').notEmpty(),
  check('semester', 'Semester must be 7 or 8').isInt({ min: 7, max: 8 }),
  check('electiveSlots', 'Elective slots must be an array').isArray()
];

// Validation rules for conflict analysis
const analyzeConflictsValidation = [
  check('programId', 'Program ID is required').notEmpty(),
  check('subjectId', 'Subject ID is required').notEmpty(),
  check('semester', 'Semester must be between 1-8').isInt({ min: 1, max: 8 }),
  check('section', 'Section is required').notEmpty(),
  check('dayIndex', 'Day index must be between 0-6').isInt({ min: 0, max: 6 }),
  check('slotIndex', 'Slot index must be a non-negative integer').isInt({ min: 0 }),
  check('teacherIds', 'Teacher IDs must be an array').isArray(),
  check('roomId', 'Room ID is required').notEmpty(),
  check('classType', 'Class type must be L, P, or T').isIn(['L', 'P', 'T'])
];

// @route   GET /api/routines/rooms/:roomId/availability
// @desc    Check room availability for specific time slot
// @access  Public
router.get('/rooms/:roomId/availability', checkRoomAvailability);

// @route   GET /api/routines/teachers/:teacherId/availability
// @desc    Check teacher availability for specific time slot
// @access  Public
router.get('/teachers/:teacherId/availability', checkTeacherAvailability);

// @route   GET /api/routines/teachers/vacant
// @desc    Get vacant teachers for specific day and time slot
// @access  Public
router.get('/teachers/vacant', getVacantTeachers);

// @route   GET /api/routines/rooms/vacant
// @desc    Get vacant rooms for specific day and time slot
// @access  Public
router.get('/rooms/vacant', getVacantRooms);

// @route   GET /api/routines/rooms/vacant/day
// @desc    Get room vacancy status for entire day
// @access  Public
router.get('/rooms/vacant/day', getRoomVacancyForDay);

// @route   GET /api/routines/rooms/vacant/analytics
// @desc    Get comprehensive room vacancy analytics
// @access  Public
router.get('/rooms/vacant/analytics', getRoomVacancyAnalytics);

// @route   GET /api/routines/rooms/:roomId/schedule
// @desc    Get room schedule/routine
// @access  Public
router.get('/rooms/:roomId/schedule', getRoomSchedule);

// @route   GET /api/routines/:programCode/:semester/subjects
// @desc    Get available subjects for assignment
// @access  Public
router.get('/:programCode/:semester/subjects', getAvailableSubjects);

// @route   GET /api/routines/:programCode/:semester/:section/export
// @desc    Export routine to Excel format (STUB - Excel functionality removed)
// @access  Public
router.get('/:programCode/:semester/:section/export', exportRoutineToExcel);

// @route   GET /api/routines/:programCode/:semester/:section/export-pdf
// @desc    Export routine to PDF format
// @access  Public
router.get('/:programCode/:semester/:section/export-pdf', exportRoutineToPDF);

// @route   GET /api/routines/:programCode/semester/:semester/export-pdf-all
// @desc    Export all routines for a semester to PDF
// @access  Public
router.get('/:programCode/semester/:semester/export-pdf-all', exportAllSemesterRoutinesToPDF);

// =====================================
// TEACHER PDF EXPORT ROUTES (using working PDFRoutineService)
// =====================================

// @route   GET /api/routines/teacher/:teacherId/export-pdf
// @desc    Export teacher schedule to PDF
// @access  Public
router.get('/teacher/:teacherId/export-pdf', exportTeacherScheduleToPDF);

// @route   GET /api/routines/teachers/export-pdf
// @desc    Export all teachers schedules to PDF
// @access  Public
router.get('/teachers/export-pdf', exportAllTeachersSchedulesToPDF);

// =====================================
// ROOM PDF EXPORT ROUTES (using working PDFRoutineService)
// =====================================

// @route   GET /api/routines/room/:roomId/export-pdf
// @desc    Export room schedule to PDF
// @access  Public
router.get('/room/:roomId/export-pdf', exportRoomScheduleToPDF);

// @route   GET /api/routines/rooms/export-pdf
// @desc    Export all room schedules to PDF
// @access  Public
router.get('/rooms/export-pdf', exportAllRoomSchedulesToPDF);

// @route   GET /api/routines/:programCode/:semester/:section
// @desc    Get routine for specific program/semester/section
// @access  Public (optional authentication)
router.get('/:programCode/:semester/:section', optionalAuth, getRoutine);

// @route   POST /api/routines/:programCode/:semester/:section/assign
// @desc    Assign class to routine slot with collision detection
// @access  Private/Admin
router.post('/:programCode/:semester/:section/assign', 
  [protect, authorize('admin'), assignClassValidation], 
  assignClass
);

// @route   DELETE /api/routines/:programCode/:semester/:section/clear
// @desc    Clear class from routine slot
// @access  Private/Admin
router.delete('/:programCode/:semester/:section/clear', 
  [protect, authorize('admin'), clearClassValidation], 
  clearClass
);

// @route   DELETE /api/routines/:programCode/:semester/:section/clear-all
// @desc    Clear entire weekly routine for a section
// @access  Private/Admin
router.delete('/:programCode/:semester/:section/clear-all',
  [protect, authorize('admin')],
  clearEntireRoutine
);

// @route   GET /api/routines/:programCode
// @desc    Get all routines for a program
// @access  Public (optional authentication)
router.get('/:programCode', optionalAuth, getProgramRoutines);

// @route   POST /api/routines/assign-class-spanned
// @desc    Assign class spanning multiple slots with collision detection
// @access  Private/Admin
router.post('/assign-class-spanned',
  [protect, authorize('admin'), assignClassSpannedValidation],
  assignClassSpanned
);

// @route   DELETE /api/routines/clear-span-group/:spanId
// @desc    Clear all slots in a span group (multi-period class)
// @access  Private/Admin
router.delete('/clear-span-group/:spanId', 
  [protect, authorize('admin')], 
  clearSpanGroup
);

// @route   PATCH /api/routines/slots/:slotId/clear
// @desc    Clear a routine slot assignment
// @access  Private/Admin
router.patch('/slots/:slotId/clear', 
  [protect, authorize('admin')], 
  clearClass
);

// @route   PATCH /api/routines/slots/:slotId
// @desc    Update a routine slot assignment  
// @access  Private/Admin
// TODO: Implement updateClassAssignment function in controller
// router.patch('/slots/:slotId', 
//   [protect, authorize('admin'), updateClassValidation], 
//   updateClassAssignment
// );

// ===============================================
// ENHANCED API ENDPOINTS (New Data Model)
// ===============================================

// TODO: Implement enhanced route functions in controller
// @route   POST /api/routines/enhanced/slots
// @desc    Create routine slot with enhanced conflict detection
// @access  Private/Admin
// router.post('/enhanced/slots', [
//   protect, 
//   authorize('admin'),
//   check('programId').isMongoId().withMessage('Invalid program ID'),
//   check('subjectId').isMongoId().withMessage('Invalid subject ID'),
//   check('semester').isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1 and 8'),
//   check('section').isIn(['AB', 'CD']).withMessage('Section must be AB or CD'),
//   check('dayIndex').isInt({ min: 0, max: 6 }).withMessage('Day index must be between 0 and 6'),
//   check('slotIndex').isInt({ min: 0 }).withMessage('Slot index must be non-negative'),
//   check('teacherIds').isArray({ min: 1 }).withMessage('At least one teacher is required'),
//   check('teacherIds.*').isMongoId().withMessage('Invalid teacher ID'),
//   check('roomId').isMongoId().withMessage('Invalid room ID'),
//   check('classType').isIn(['L', 'P', 'T']).withMessage('Class type must be L, P, or T')
// ], createEnhancedSlot);

// @route   GET /api/routines/enhanced
// @desc    Get routines with enhanced filtering and organization
// @access  Private
// router.get('/enhanced', protect, getEnhancedRoutines);

// @route   PUT /api/routines/enhanced/slots/:id
// @desc    Update routine slot with conflict checking
// @access  Private/Admin
// router.put('/enhanced/slots/:id', [
//   protect, 
//   authorize('admin')
// ], updateEnhancedSlot);

// @route   DELETE /api/routines/enhanced/slots/:id
// @desc    Delete routine slot (soft delete)
// @access  Private/Admin
// TODO: Implement deleteEnhancedSlot function in controller
// router.delete('/enhanced/slots/:id', [
//   protect, 
//   authorize('admin')
// ], deleteEnhancedSlot);

// @route   POST /api/routines/enhanced/conflicts/analyze
// @desc    Analyze potential conflicts for a schedule slot
// @access  Private/Admin
router.post('/enhanced/conflicts/analyze', [
  protect, 
  authorize('admin'),
  ...analyzeConflictsValidation
], analyzeScheduleConflicts);

// @route   POST /api/routines/electives/schedule
// @desc    Schedule elective class for 7th/8th semester (appears in both section routines)
// @access  Private/Admin
router.post('/electives/schedule', [
  protect,
  authorize('admin'),
  ...scheduleElectiveValidation
], scheduleElectiveClass);

// @route   POST /api/routines/electives/schedule-spanned
// @desc    Schedule multi-period elective class for 7th/8th semester (appears in both section routines)
// @access  Private/Admin
router.post('/electives/schedule-spanned', [
  protect,
  authorize('admin'),
  ...scheduleElectiveSpannedValidation
], scheduleElectiveClassSpanned);

// @route   GET /api/routines/section/:programCode/:semester/:section
// @desc    Get unified section routine including electives
// @access  Public (optional authentication)
router.get('/section/:programCode/:semester/:section', optionalAuth, getUnifiedSectionRoutine);

// @route   POST /api/routines/electives/conflicts
// @desc    Check conflicts between multiple electives
// @access  Private/Admin
router.post('/electives/conflicts', [
  protect,
  authorize('admin'),
  ...electiveConflictValidation
], checkElectiveConflicts);

// Teacher schedules are now handled by the schedules controller and routes

module.exports = router;
