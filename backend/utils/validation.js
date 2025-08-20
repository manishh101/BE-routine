const { validationResult } = require('express-validator');

/**
 * Validate routine slot data
 * @param {Object} slotData - Slot data to validate
 * @returns {Object} - Validation result
 */
function validateRoutineSlot(slotData) {
  const errors = [];
  
  // Required fields validation
  if (!slotData.programCode) {
    errors.push({ field: 'programCode', message: 'Program code is required' });
  }
  
  if (slotData.semester === undefined || slotData.semester === null) {
    errors.push({ field: 'semester', message: 'Semester is required' });
  }
  
  if (!slotData.section) {
    errors.push({ field: 'section', message: 'Section is required' });
  }
  
  if (slotData.dayIndex === undefined || slotData.dayIndex === null) {
    errors.push({ field: 'dayIndex', message: 'Day index is required' });
  }
  
  if (slotData.slotIndex === undefined || slotData.slotIndex === null) {
    errors.push({ field: 'slotIndex', message: 'Slot index is required' });
  }
  
  // Range validations
  if (slotData.dayIndex !== undefined && (slotData.dayIndex < 0 || slotData.dayIndex > 5)) {
    errors.push({ field: 'dayIndex', message: 'Day index must be between 0-5 (Sunday-Friday)' });
  }
  
  if (slotData.slotIndex !== undefined && slotData.slotIndex < 0) {
    errors.push({ field: 'slotIndex', message: 'Slot index must be non-negative' });
  }
  
  if (slotData.semester !== undefined && (slotData.semester < 1 || slotData.semester > 8)) {
    errors.push({ field: 'semester', message: 'Semester must be between 1-8' });
  }
  
  // Array validations
  if (slotData.teacherIds && (!Array.isArray(slotData.teacherIds) || slotData.teacherIds.length === 0)) {
    errors.push({ field: 'teacherIds', message: 'At least one teacher must be assigned' });
  }
  
  // Enum validations
  if (slotData.classType && !['L', 'P', 'T'].includes(slotData.classType)) {
    errors.push({ field: 'classType', message: 'Class type must be L (Lecture), P (Practical), or T (Tutorial)' });
  }
  
  if (slotData.section && !['AB', 'CD'].includes(slotData.section.toUpperCase())) {
    errors.push({ field: 'section', message: 'Section must be AB or CD' });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate time slot data
 * @param {Object} timeSlotData - Time slot data to validate
 * @returns {Object} - Validation result
 */
function validateTimeSlot(timeSlotData) {
  const errors = [];
  
  if (!timeSlotData.startTime) {
    errors.push({ field: 'startTime', message: 'Start time is required' });
  }
  
  if (!timeSlotData.endTime) {
    errors.push({ field: 'endTime', message: 'End time is required' });
  }
  
  if (!timeSlotData.label) {
    errors.push({ field: 'label', message: 'Label is required' });
  }
  
  // Time format validation (HH:MM)
  const timeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  
  if (timeSlotData.startTime && !timeFormat.test(timeSlotData.startTime)) {
    errors.push({ field: 'startTime', message: 'Start time must be in HH:MM format' });
  }
  
  if (timeSlotData.endTime && !timeFormat.test(timeSlotData.endTime)) {
    errors.push({ field: 'endTime', message: 'End time must be in HH:MM format' });
  }
  
  // Logical time validation
  if (timeSlotData.startTime && timeSlotData.endTime) {
    const start = new Date(`2000-01-01 ${timeSlotData.startTime}`);
    const end = new Date(`2000-01-01 ${timeSlotData.endTime}`);
    
    if (start >= end) {
      errors.push({ field: 'time', message: 'End time must be after start time' });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate room data
 * @param {Object} roomData - Room data to validate
 * @returns {Object} - Validation result
 */
function validateRoom(roomData) {
  const errors = [];
  
  if (!roomData.name) {
    errors.push({ field: 'name', message: 'Room name is required' });
  }
  
  if (!roomData.code) {
    errors.push({ field: 'code', message: 'Room code is required' });
  }
  
  if (roomData.capacity !== undefined && (roomData.capacity < 1 || roomData.capacity > 1000)) {
    errors.push({ field: 'capacity', message: 'Room capacity must be between 1-1000' });
  }
  
  if (roomData.floor !== undefined && (roomData.floor < 0 || roomData.floor > 20)) {
    errors.push({ field: 'floor', message: 'Floor must be between 0-20' });
  }
  
  const validRoomTypes = ['Classroom', 'Laboratory', 'Seminar Hall', 'Auditorium', 'Conference Room'];
  if (roomData.roomType && !validRoomTypes.includes(roomData.roomType)) {
    errors.push({ field: 'roomType', message: `Room type must be one of: ${validRoomTypes.join(', ')}` });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate teacher data
 * @param {Object} teacherData - Teacher data to validate
 * @returns {Object} - Validation result
 */
function validateTeacher(teacherData) {
  const errors = [];
  
  if (!teacherData.fullName) {
    errors.push({ field: 'fullName', message: 'Full name is required' });
  }
  
  if (!teacherData.shortName) {
    errors.push({ field: 'shortName', message: 'Short name is required' });
  }
  
  if (teacherData.shortName && teacherData.shortName.length > 5) {
    errors.push({ field: 'shortName', message: 'Short name must be 5 characters or less' });
  }
  
  if (teacherData.email) {
    const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailFormat.test(teacherData.email)) {
      errors.push({ field: 'email', message: 'Invalid email format' });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate subject data
 * @param {Object} subjectData - Subject data to validate
 * @returns {Object} - Validation result
 */
function validateSubject(subjectData) {
  const errors = [];
  
  if (!subjectData.name) {
    errors.push({ field: 'name', message: 'Subject name is required' });
  }
  
  if (!subjectData.code) {
    errors.push({ field: 'code', message: 'Subject code is required' });
  }
  
  if (subjectData.creditHours !== undefined && (subjectData.creditHours < 0 || subjectData.creditHours > 10)) {
    errors.push({ field: 'creditHours', message: 'Credit hours must be between 0-10' });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize input data by trimming strings and converting to appropriate types
 * @param {Object} data - Input data
 * @returns {Object} - Sanitized data
 */
function sanitizeInput(data) {
  const sanitized = {};
  
  Object.keys(data).forEach(key => {
    const value = data[key];
    
    if (typeof value === 'string') {
      sanitized[key] = value.trim();
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? item.trim() : item
      );
    } else {
      sanitized[key] = value;
    }
  });
  
  return sanitized;
}

/**
 * Format validation errors for API response
 * @param {Array} errors - Array of validation errors
 * @returns {Object} - Formatted error response
 */
function formatValidationErrors(errors) {
  return {
    success: false,
    message: 'Validation failed',
    errors: errors.map(error => ({
      field: error.field,
      message: error.message
    }))
  };
}

/**
 * Middleware to handle express-validator errors
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
}

module.exports = {
  validateRoutineSlot,
  validateTimeSlot,
  validateRoom,
  validateTeacher,
  validateSubject,
  sanitizeInput,
  formatValidationErrors,
  handleValidationErrors
};
