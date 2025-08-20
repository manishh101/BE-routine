const mongoose = require('mongoose');
const Program = require('../models/Program');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Room = require('../models/Room');
const TimeSlot = require('../models/TimeSlot');
const ProgramSemester = require('../models/ProgramSemester');
const RoutineSlot = require('../models/RoutineSlot');
const LabGroup = require('../models/LabGroup');
const ElectiveGroup = require('../models/ElectiveGroup');
const AcademicCalendar = require('../models/AcademicCalendar');
const { validationResult } = require('express-validator');
const { publishToQueue } = require('../services/queue.service');
const { ConflictDetectionService } = require('../services/conflictDetection');
const { getTimeSlotsSorted, createTimeSlotMap } = require('../utils/timeSlotUtils');
const { getLabGroupsForSection, getSectionLabGroupLabel } = require('../utils/sectionUtils');
const { getSemesterGroupName } = require('../utils/semesterGroupUtils');
// Excel utilities have been removed
const multer = require('multer');
const path = require('path');
// ExcelJS has been removed

// Configure multer for file upload (keeping for API compatibility)
const storage = multer.memoryStorage(); // Store files in memory for processing

const fileFilter = (req, file, cb) => {
  // This function is kept for API compatibility but will reject all files
  cb(new Error('File upload functionality has been disabled.'), false);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Enhanced validation helper functions
const validateAssignClassData = async (data) => {
  const errors = [];
  const { programCode, semester, section, dayIndex, slotIndex, subjectId, teacherIds, roomId, classType, labGroup } = data;

  console.log('🔍 Validating assign class data:', {
    programCode,
    semester,
    section, 
    dayIndex,
    slotIndex,
    classType,
    dataTypes: {
      programCode: typeof programCode,
      semester: typeof semester,
      section: typeof section,
      dayIndex: typeof dayIndex,
      slotIndex: typeof slotIndex,
      classType: typeof classType
    }
  });

  // Basic data validation
  if (!programCode || typeof programCode !== 'string') {
    errors.push('Valid program code is required');
  }

  if (!semester || !Number.isInteger(semester) || semester < 1 || semester > 8) {
    errors.push('Semester must be between 1 and 8');
  }

  if (!section || !['AB', 'CD'].includes(section.toUpperCase())) {
    errors.push('Section must be either AB or CD');
  }

  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) {
    errors.push('Day index must be between 0 and 6');
  }

  if (!Number.isInteger(slotIndex) || slotIndex < 0) {
    errors.push('Slot index must be a non-negative integer');
  }

  if (!classType || !['L', 'P', 'T', 'BREAK'].includes(classType)) {
    errors.push('Class type must be L (Lecture), P (Practical), T (Tutorial), or BREAK');
  }

  // Skip detailed validation for breaks
  if (classType === 'BREAK') {
    // For breaks, only validate basic program and time slot existence
    try {
      console.log('🔍 Validating break - checking program and timeSlot:', { programCode, slotIndex });
      
      const [program, timeSlot] = await Promise.all([
        Program.findOne({ code: programCode.toUpperCase() }),
        TimeSlot.findOne({ _id: slotIndex })
      ]);

      console.log('🔍 Break validation results:', {
        program: program ? { code: program.code, name: program.name } : null,
        timeSlot: timeSlot ? { _id: timeSlot._id, label: timeSlot.label } : null
      });

      if (!program) {
        errors.push(`Program with code ${programCode} not found`);
      }

      if (!timeSlot) {
        errors.push(`Time slot with ID ${slotIndex} not found`);
      }
    } catch (dbError) {
      errors.push('Error validating data against database');
      console.error('Database validation error:', dbError);
    }

    console.log('🔍 Break validation completed with errors:', errors);
    return errors;
  }

  // Validate IDs exist
  try {
    const [program, subject, teachers, room, timeSlot] = await Promise.all([
      Program.findOne({ code: programCode.toUpperCase() }),
      Subject.findById(subjectId),
      Teacher.find({ _id: { $in: teacherIds } }),
      Room.findById(roomId),
      TimeSlot.findOne({ _id: slotIndex })
    ]);

    if (!program) {
      errors.push(`Program with code ${programCode} not found`);
    }

    if (!subject) {
      errors.push('Subject not found');
    }

    if (!teachers || teachers.length !== teacherIds.length) {
      errors.push('One or more teachers not found');
    }

    if (!room) {
      errors.push('Room not found');
    }

    if (!timeSlot) {
      errors.push('Time slot not found');
    }
    // Validate time slot and assignments

    // Business rule validations
    if (room && classType === 'P' && room.type && !room.type.toLowerCase().includes('lab')) {
      errors.push('Practical classes should typically be assigned to lab rooms');
    }

    if (teachers && teachers.length > 1 && classType !== 'P') {
      errors.push('Multiple teachers are typically only allowed for practical/lab classes');
    }
    
    // Validate lab group selection for practical classes - only if provided
    // We'll handle default lab group in the controller (ALL)
    // This allows backward compatibility for older API calls without labGroup
    if (classType === 'P' && labGroup && !['A', 'B', 'C', 'D', 'ALL'].includes(labGroup)) {
      console.warn(`⚠️ Invalid lab group provided: "${labGroup}"`);
      console.warn('⚠️ Valid values are "A", "B", "C", "D", or "ALL". Will default to "ALL".');
      // Not adding error - we'll handle it with a default instead
    }

  } catch (dbError) {
    errors.push('Error validating data against database');
    console.error('Database validation error:', dbError);
  }

  return errors;
};

// Helper function to determine if two semesters are in the same group
const areSemestersInSameGroup = (semester1, semester2) => {
  // Use custom semester grouping logic
  return getSemesterGroupName(semester1) === getSemesterGroupName(semester2);
};

// Helper function to get semester group name for logging - imported from utils

// Enhanced conflict detection with semester group awareness
const checkAdvancedConflicts = async (data, existingSlotId = null) => {
  const conflicts = [];
  const { programCode, semester, section, dayIndex, slotIndex, teacherIds, roomId } = data;

  try {
    // Check for teacher conflicts - only within the same semester group
    for (const teacherId of teacherIds) {
      const teacherConflicts = await RoutineSlot.find({
        dayIndex,
        slotIndex,
        teacherIds: teacherId,
        ...(existingSlotId ? { _id: { $ne: existingSlotId } } : {})
      }).populate('subjectId', 'name code')
        .populate('roomId', 'name');

      for (const conflict of teacherConflicts) {
        // Only consider it a conflict if both semesters are in the same group
        if (areSemestersInSameGroup(parseInt(semester), parseInt(conflict.semester))) {
          const teacher = await Teacher.findById(teacherId);
          
          console.log(`🔴 Teacher conflict detected: ${teacher?.fullName || 'Unknown'} has classes in same semester group (${getSemesterGroupName(semester)}) at same time`);
          
          conflicts.push({
            type: 'teacher',
            resourceId: teacherId,
            resourceName: teacher?.fullName || 'Unknown Teacher',
            conflictDetails: {
              programCode: conflict.programCode,
              semester: conflict.semester,
              section: conflict.section,
              subjectName: conflict.subjectName_display || conflict.subjectId?.name,
              subjectCode: conflict.subjectCode_display || conflict.subjectId?.code,
              roomName: conflict.roomName_display || conflict.roomId?.name,
              timeSlot: conflict.timeSlot_display,
              semesterGroup: getSemesterGroupName(conflict.semester),
              conflictReason: `Teacher is already teaching in ${getSemesterGroupName(conflict.semester)} semester group at this time`
            }
          });
        } else {
          console.log(`✅ No teacher conflict: ${semester} (${getSemesterGroupName(semester)}) and ${conflict.semester} (${getSemesterGroupName(conflict.semester)}) are in different semester groups`);
        }
      }
    }

    // Check for room conflicts - only within the same semester group
    const roomConflicts = await RoutineSlot.find({
      dayIndex,
      slotIndex,
      roomId,
      ...(existingSlotId ? { _id: { $ne: existingSlotId } } : {})
    }).populate('subjectId', 'name code')
      .populate('teacherIds', 'fullName');

    for (const conflict of roomConflicts) {
      // Only consider it a conflict if both semesters are in the same group
      if (areSemestersInSameGroup(parseInt(semester), parseInt(conflict.semester))) {
        const room = await Room.findById(roomId);
        
        console.log(`🔴 Room conflict detected: ${room?.name || 'Unknown'} is being used by same semester group (${getSemesterGroupName(semester)}) at same time`);
        
        conflicts.push({
          type: 'room',
          resourceId: roomId,
          resourceName: room?.name || 'Unknown Room',
          conflictDetails: {
            programCode: conflict.programCode,
            semester: conflict.semester,
            section: conflict.section,
            subjectName: conflict.subjectName_display || conflict.subjectId?.name,
            subjectCode: conflict.subjectCode_display || conflict.subjectId?.code,
            teacherNames: conflict.teacherIds?.map(t => t.fullName) || [],
            timeSlot: conflict.timeSlot_display,
            semesterGroup: getSemesterGroupName(conflict.semester),
            conflictReason: `Room is already occupied by ${getSemesterGroupName(conflict.semester)} semester group at this time`
          }
        });
      } else {
        console.log(`✅ No room conflict: ${semester} (${getSemesterGroupName(semester)}) and ${conflict.semester} (${getSemesterGroupName(conflict.semester)}) are in different semester groups`);
      }
    }

    // Check for program-section conflicts (shouldn't happen but good to validate)
    const sectionConflicts = await RoutineSlot.find({
      programCode: programCode.toUpperCase(),
      semester: parseInt(semester),
      section: section.toUpperCase(),
      dayIndex,
      slotIndex,
      ...(existingSlotId ? { _id: { $ne: existingSlotId } } : {})
    });

    if (sectionConflicts.length > 0) {
      conflicts.push({
        type: 'section',
        resourceId: `${programCode}-${semester}-${section}`,
        resourceName: `${programCode} Semester ${semester} Section ${section}`,
        conflictDetails: {
          message: 'This program-semester-section already has a class scheduled at this time'
        }
      });
    }

  } catch (error) {
    console.error('Error checking conflicts:', error);
    throw new Error('Failed to check for scheduling conflicts');
  }

  return conflicts;
};

// @desc    Get routine for specific program/semester/section
// @route   GET /api/routines/:programCode/:semester/:section
// @access  Public
exports.getRoutine = async (req, res) => {
  try {
    const { programCode, semester, section } = req.params;
    
    console.log(`🎯 getRoutine API called for: ${programCode}-${semester}-${section}`);

    // Get program to validate programCode
    const program = await Program.findOne({ code: programCode.toUpperCase() });
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }

    // Fetch routine slots from the single source of truth (RoutineSlot collection)
    const routineSlots = await RoutineSlot.find({
      programCode: programCode.toUpperCase(),
      semester: parseInt(semester),
      section: section.toUpperCase(),
      isActive: true
    })
      .populate('subjectId', 'name code')
      .populate('subjectIds', 'name code') // Populate multiple subjects for electives
      .populate('teacherIds', 'fullName shortName')
      .populate('roomId', 'name')
      .sort({ dayIndex: 1, slotIndex: 1 });

    console.log(`Found ${routineSlots.length} routine slots for ${programCode}-${semester}-${section}`);
    
    // Debug: Log slots with lab groups
    const multiGroupSlots = routineSlots.filter(slot => slot.labGroup && ['A', 'B', 'C', 'D'].includes(slot.labGroup));
    if (multiGroupSlots.length > 0) {
      console.log(`🔍 Found ${multiGroupSlots.length} multi-group slots:`);
      multiGroupSlots.forEach(slot => {
        console.log(`   - Day ${slot.dayIndex}, Slot ${slot.slotIndex}, Group ${slot.labGroup}, Subject: ${slot.subjectId}`);
      });
    }

    // Group by days and slots for easier frontend consumption
    const routine = {};
    for (let day = 0; day <= 6; day++) {
      routine[day] = {};
    }

    routineSlots.forEach(slot => {
      if (!routine[slot.dayIndex]) {
        routine[slot.dayIndex] = {};
      }
      
      const slotData = {
        _id: slot._id,
        subjectId: slot.subjectId?._id,
        subjectName: slot.subjectName_display || slot.subjectId?.name,
        subjectCode: slot.subjectCode_display || slot.subjectId?.code,
        
        // Handle multiple subjects for elective classes
        subjectIds: slot.subjectIds?.map(s => s._id) || [],
        subjects: slot.subjectIds?.map(s => ({
          id: s._id,
          code: s.code,
          name: s.name
        })) || [],
        
        teacherIds: slot.teacherIds,
        teacherNames: slot.teacherIds.map(t => t.fullName),
        teacherShortNames: slot.teacherShortNames_display || slot.teacherIds.map(t => t.shortName || t.fullName.split(' ').map(n => n[0]).join('.')),
        
        // For synchronized display of multiple subjects and teachers
        subjectTeacherPairs: slot.isElectiveClass && slot.subjectIds?.length > 0 ? 
          slot.subjectIds.map((subject, index) => ({
            subject: {
              id: subject._id,
              code: subject.code,
              name: subject.name
            },
            teacher: slot.teacherIds?.[index] ? {
              id: slot.teacherIds[index]._id,
              shortName: slot.teacherIds[index].shortName,
              fullName: slot.teacherIds[index].fullName
            } : null
          })) : [],
        
        roomId: slot.roomId?._id,
        roomName: slot.roomName_display || slot.roomId?.name,
        classType: slot.classType,
        notes: slot.notes,
        timeSlot_display: slot.timeSlot_display,
        spanId: slot.spanId,
        spanMaster: slot.spanMaster,
        labGroup: slot.labGroup,  // Include lab group information
        isAlternativeWeek: slot.isAlternativeWeek,  // Include alternative weeks flag
        alternateGroupData: slot.alternateGroupData,  // Include alternate group configuration
        // Elective information
        isElectiveClass: slot.isElectiveClass || false,
        classCategory: slot.classCategory || 'CORE',
        electiveInfo: slot.electiveInfo || null,
        electiveLabel: slot.isElectiveClass ? (
          slot.electiveInfo?.electiveNumber ? 
            `Elective ${slot.electiveInfo.electiveNumber}` : 
            'Elective'
        ) : null,
        
        // Enhanced display for multiple electives
        isMultipleElectives: slot.isElectiveClass && slot.subjectIds?.length > 1,
        electiveCount: slot.isElectiveClass ? (slot.subjectIds?.length || 1) : 0
      };
      
      // Handle multiple lab groups in the same time slot
      if (routine[slot.dayIndex][slot.slotIndex]) {
        // If slot already exists, convert to array or add to existing array
        const existing = routine[slot.dayIndex][slot.slotIndex];
        
        console.log(`🔄 Found duplicate slot - Day ${slot.dayIndex}, Slot ${slot.slotIndex}`);
        console.log(`   Existing: labGroup=${existing.labGroup || 'none'}, subject=${existing.subjectId}`);
        console.log(`   New: labGroup=${slotData.labGroup || 'none'}, subject=${slotData.subjectId}`);
        
        if (Array.isArray(existing)) {
          // Already an array, add new slot
          existing.push(slotData);
          console.log(`   Added to existing array, now has ${existing.length} items`);
        } else {
          // Convert single slot to array with both slots
          routine[slot.dayIndex][slot.slotIndex] = [existing, slotData];
          console.log(`   Converted to array with 2 items`);
        }
      } else {
        // First slot for this time - store directly
        routine[slot.dayIndex][slot.slotIndex] = slotData;
      }
    });

    console.log(`Built routine object with ${Object.keys(routine).length} days, total slots: ${Object.values(routine).reduce((total, day) => total + Object.keys(day).length, 0)}`);

    res.json({
      success: true,
      data: {
        programCode: programCode.toUpperCase(),
        semester: parseInt(semester),
        section: section.toUpperCase(),
        routine
      }
    });
  } catch (error) {
    console.error('Error in getRoutine:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Enhanced assign class to routine slot with comprehensive validation
// @route   POST /api/routines/:programCode/:semester/:section/assign
// @access  Private/Admin
exports.assignClass = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  // Determine if we're in test environment with memory server (transactions may not be supported)
  const isTestEnvironment = process.env.NODE_ENV === 'test';

  try {
    const { programCode, semester, section } = req.params;
    let { dayIndex, slotIndex, subjectId, teacherIds, roomId, classType, labGroup, isAlternativeWeek, alternateGroupData, notes } = req.body;
    
    // Convert data types if needed
    dayIndex = parseInt(dayIndex);
    slotIndex = parseInt(slotIndex);
    
    // Validate basic required fields
    if (isNaN(dayIndex) || isNaN(slotIndex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid dayIndex or slotIndex'
      });
    }
    
    if (!subjectId && classType !== 'BREAK') {
      return res.status(400).json({
        success: false,
        message: 'Subject ID is required for non-break classes'
      });
    }
    
    if (!roomId && classType !== 'BREAK') {
      return res.status(400).json({
        success: false,
        message: 'Room ID is required for non-break classes'
      });
    }

    console.log('🚀 assignClass called with params:', { programCode, semester, section });
    console.log('🚀 assignClass called with body:', {
      dayIndex,
      slotIndex,
      subjectId,
      teacherIds,
      roomId,
      classType,
      labGroup,
      isAlternativeWeek,
      notes,
      bodyTypes: {
        dayIndex: typeof dayIndex,
        slotIndex: typeof slotIndex,
        classType: typeof classType,
        labGroup: typeof labGroup,
        isAlternativeWeek: typeof isAlternativeWeek
      }
    });
    
    // Fix for single period lab classes
    if (classType === 'P') {
      console.log('⚠️ Lab class detected with labGroup:', labGroup);
      // Make labGroup optional for lab classes with a default value of 'ALL'
      if (!labGroup || !['A', 'B', 'C', 'D', 'ALL'].includes(labGroup)) {
        console.log('⚠️ Setting default lab group to ALL');
        req.body.labGroup = 'ALL'; // Update the request body directly
        labGroup = 'ALL'; // Update local variable
      }
    }

    // Enhanced validation
    const validationData = {
      programCode,
      semester: parseInt(semester),
      section: section.toUpperCase(),
      dayIndex,
      slotIndex,
      subjectId,
      teacherIds,
      roomId,
      classType,
      // Make sure labGroup is set for practical classes
      labGroup: classType === 'P' ? (labGroup || 'ALL') : labGroup,
      isAlternativeWeek,
      notes
    };

    console.log('🚀 Validation data prepared:', JSON.stringify(validationData, null, 2));

    const validationErrors = await validateAssignClassData(validationData);
    if (validationErrors.length > 0) {
      console.error('❌ Validation errors:', validationErrors);
      console.error('❌ Validation data was:', JSON.stringify(validationData, null, 2));
      
      // Check if the only validation error is about lab group
      const isOnlyLabGroupError = validationErrors.every(error => 
        error.includes('lab group') || error.includes('labGroup')
      );
      
      if (isOnlyLabGroupError && classType === 'P') {
        console.log('⚠️ Only lab group validation errors detected - proceeding anyway with default ALL');
        // Continue with the validation passed - we've set the default above
      } else {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors
        });
      }
    }

    // Validate input arrays (skip for breaks)
    if (classType !== 'BREAK') {
      console.log('🔍 Checking teacherIds:', { teacherIds, isArray: Array.isArray(teacherIds) });
      
      if (!teacherIds) {
        return res.status(400).json({
          success: false,
          message: 'teacherIds field is missing from request'
        });
      }
      
      // Convert single teacherId to array if needed
      if (!Array.isArray(teacherIds)) {
        console.log('⚠️ teacherIds is not an array, converting:', teacherIds);
        teacherIds = [teacherIds];
        req.body.teacherIds = teacherIds; // Update the request body
      }
      
      if (teacherIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one teacher must be assigned for non-break classes'
        });
      }
    }

    // Get current academic calendar
    const academicCalendar = await AcademicCalendar.findOne({ isCurrentYear: true });
    if (!academicCalendar) {
      return res.status(400).json({
        success: false,
        message: 'No active academic calendar found'
      });
    }

    // Check if slot already exists for this program/semester/section (Update vs Create)
    const existingSlot = await RoutineSlot.findOne({
      programCode: programCode.toUpperCase(),
      semester: parseInt(semester),
      section: section.toUpperCase(),
      dayIndex,
      slotIndex,
      semesterGroup: getSemesterGroupName(parseInt(semester))
    });

    // Skip conflict detection for breaks
    if (classType !== 'BREAK') {
      // Enhanced conflict detection using advanced service
      const conflictValidationData = {
        ...validationData,
        academicYearId: academicCalendar._id,
        recurrence: { type: 'weekly', description: 'Weekly' },
        classType,
        labGroupId: null,
        electiveGroupId: null
      };

      // Use advanced conflict detection service
      const advancedConflicts = await ConflictDetectionService.validateSchedule(conflictValidationData);
      
      // Also run basic conflict detection for backward compatibility
      const basicConflicts = await checkAdvancedConflicts(validationData, existingSlot?._id);
      
      // Combine both conflict detection results
      const allConflicts = [...advancedConflicts, ...basicConflicts];
      
      if (allConflicts.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Scheduling conflicts detected',
          conflicts: allConflicts,
          conflictCount: allConflicts.length,
          detectionMethod: 'advanced+basic'
        });
      }
    }

    // Get reference data for denormalized fields (conditional for breaks)
    let subject, teachers, room, timeSlot, program;
    
    if (classType === 'BREAK') {
      // For breaks, we only need timeSlot and program
      [timeSlot, program] = await Promise.all([
        TimeSlot.findOne({ _id: slotIndex }),
        Program.findOne({ code: programCode.toUpperCase() })
      ]);
      subject = null;
      teachers = [];
      room = null;
    } else {
      // For regular classes, get all reference data
      [subject, teachers, room, timeSlot, program] = await Promise.all([
        Subject.findById(subjectId),
        Teacher.find({ _id: { $in: teacherIds } }),
        Room.findById(roomId),
        TimeSlot.findOne({ _id: slotIndex }),
        Program.findOne({ code: programCode.toUpperCase() })
      ]);
    }

    // Final validation (conditional for breaks)
    if (classType === 'BREAK') {
      if (!timeSlot || !program) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reference data - time slot or program not found'
        });
      }
    } else {
      if (!subject || teachers.length !== teacherIds.length || !room || !timeSlot || !program) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reference data - subject, teachers, room, time slot, or program not found'
        });
      }
    }

    const slotData = {
      // Required schema fields
      programId: program._id,
      academicYearId: academicCalendar._id,
      semester: parseInt(semester),
      semesterGroup: getSemesterGroupName(parseInt(semester)),
      section: section.toUpperCase(),
      // Legacy fields for compatibility
      programCode: programCode.toUpperCase(),
      dayIndex,
      slotIndex,
      classType: classType || 'L',
      // Lab group for practical classes
      labGroup: classType === 'P' ? (labGroup || 'ALL') : null,
      // Whether lab groups alternate weeks
      isAlternativeWeek: classType === 'P' ? !!isAlternativeWeek : false,
      // Store alternate group configuration
      alternateGroupData: classType === 'P' && !!isAlternativeWeek ? alternateGroupData : null,
      notes: notes || '',
      updatedAt: new Date()
    };

    // Add class-specific fields only for non-breaks
    if (classType !== 'BREAK') {
      slotData.subjectId = subjectId;
      slotData.teacherIds = teacherIds;
      slotData.roomId = roomId;
      
      // Denormalized display fields for performance
      slotData.subjectName_display = subject.name;
      slotData.subjectCode_display = subject.code;
      
      // Add lab group information to display name for practical classes
      if (classType === 'P') {
        const groupLabel = labGroup === 'A' ? (isAlternativeWeek ? ' (Group A - Alt Week)' : ' (Group A)') : 
                           labGroup === 'B' ? (isAlternativeWeek ? ' (Group B - Alt Week)' : ' (Group B)') : 
                           labGroup === 'ALL' ? ' (All Groups)' : 
                           '';
        slotData.subjectName_display = subject.name + groupLabel;
      }
      
      slotData.teacherShortNames_display = teachers.map(t => 
        t.shortName || t.fullName.split(' ').map(n => n[0]).join('.')
      );
      slotData.roomName_display = room.name;
      slotData.timeSlot_display = `${timeSlot.startTime} - ${timeSlot.endTime}`;
    } else {
      // For breaks, set display fields to show "BREAK"
      slotData.subjectName_display = 'BREAK';
      slotData.subjectCode_display = 'BREAK';
      slotData.teacherShortNames_display = [];
      slotData.roomName_display = '';
      slotData.timeSlot_display = `${timeSlot.startTime} - ${timeSlot.endTime}`;
    }

    // Debug: Log the final slot data before saving
    console.log('📝 Final slot data to save:', {
      programCode: slotData.programCode,
      semester: slotData.semester,
      section: slotData.section,
      dayIndex: slotData.dayIndex,
      slotIndex: slotData.slotIndex,
      classType: slotData.classType,
      labGroup: slotData.labGroup,
      isAlternativeWeek: slotData.isAlternativeWeek,
      subjectName: slotData.subjectName_display
    });
    
    let routineSlot;
    try {
      if (existingSlot) {
        // Update existing slot
        console.log('Updating existing slot:', existingSlot._id);
        routineSlot = await RoutineSlot.findByIdAndUpdate(
          existingSlot._id,
          slotData,
          { new: true, runValidators: true }
        );
      } else {
        // Create new slot
        console.log('Creating new slot');
        routineSlot = await RoutineSlot.create(slotData);
      }
    } catch (dbError) {
      console.error('❌ Database error when saving slot:', dbError.message);
      console.error('❌ Validation errors:', dbError.errors);
      return res.status(400).json({
        success: false,
        message: 'Error saving to database',
        error: dbError.message,
        errors: dbError.errors || {}
      });
    }

    if (!routineSlot) {
      return res.status(500).json({
        success: false,
        message: 'Failed to save class assignment'
      });
    }

    // Queue teacher schedule updates
    try {
      const oldTeacherIds = existingSlot ? (existingSlot.teacherIds || []) : [];
      const newTeacherIds = teacherIds || [];
      const affectedTeacherIds = [...new Set([...oldTeacherIds, ...newTeacherIds])]
        .filter(id => id != null && id.toString());
      
      if (affectedTeacherIds.length > 0) {
        // Try to load queue service dynamically
        try {
          const { publishToQueue } = require('../services/queue.service');
          await publishToQueue('teacher_routine_updates', { 
            affectedTeacherIds,
            action: existingSlot ? 'update' : 'create',
            programCode,
            semester,
            section,
            dayIndex,
            slotIndex
          });
          console.log(`[Queue] Queued schedule updates for teachers: ${affectedTeacherIds.join(', ')}`);
        } catch (queueServiceError) {
          console.warn('Queue service unavailable, skipping teacher schedule update queue:', queueServiceError.message);
          // Continue without failing
        }
      }
    } catch (queueError) {
      console.error('CRITICAL: Failed to queue teacher schedule updates:', queueError);
      // Continue execution - the main operation was successful
    }

    // Return success response
    res.status(existingSlot ? 200 : 201).json({
      success: true,
      data: routineSlot,
      message: existingSlot ? 'Class assignment updated successfully' : 'Class assigned successfully',
      metadata: {
        operation: existingSlot ? 'update' : 'create',
        conflictsChecked: true,
        teachersAffected: teacherIds ? teacherIds.length : 0,
        queuedForUpdate: true
      }
    });

  } catch (error) {
    console.error('Error in assignClass:', error);
    
    // Handle specific error types
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate class assignment detected',
        error: 'A class is already scheduled for this program/semester/section at this time slot'
      });
    }
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Data validation failed',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while assigning class',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
    });
  }
};

// @desc    Assign class spanning multiple slots
// @route   POST /api/routines/assign-class-spanned
// @access  Private/Admin
exports.assignClassSpanned = async (req, res) => {
  console.log('🔄 assignClassSpanned called with data:', JSON.stringify(req.body, null, 2));
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('❌ Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  // Determine if we're in test environment with memory server (transactions may not be supported)
  const isTestEnvironment = process.env.NODE_ENV === 'test';
  
  // Start a session if we're not in test environment
  let session = null;
  try {
    if (!isTestEnvironment) {
      session = await mongoose.startSession();
      session.startTransaction();
      console.log('Started MongoDB transaction session');
    }
  } catch (sessionError) {
    console.error('Failed to start MongoDB transaction session:', sessionError);
    // Continue without session if we can't create one
  }

  try {
    const { 
      programCode, 
      programId,
      academicYearId,
      semester, 
      section, 
      dayIndex, 
      slotIndexes, 
      subjectId, 
      teacherIds, 
      roomId, 
      classType, 
      notes,
      // Lab group fields for "bothGroups" scenario
      labGroupType,
      groupASubject,
      groupBSubject,
      groupATeachers,
      groupBTeachers,
      groupARoom,
      groupBRoom,
      isAlternativeWeek,
      displayLabel
    } = req.body;
    
    // Extract labGroup separately as it may need to be reassigned
    let labGroup = req.body.labGroup;

    console.log('📝 Processing spanned class assignment:', {
      programCode,
      programId,
      academicYearId,
      semester,
      section,
      dayIndex,
      slotIndexes,
      subjectId,
      teacherIds,
      roomId,
      classType,
      labGroupType,
      labGroup
    });

    // Auto-lookup missing programId and academicYearId if not provided
    let finalProgramId = programId;
    let finalAcademicYearId = academicYearId;

    if (!finalProgramId || !finalAcademicYearId) {
      console.log('🔍 Looking up missing programId and/or academicYearId...');
      
      // Look up program by code if programId is missing
      if (!finalProgramId && programCode) {
        const program = await Program.findOne({ code: programCode.toUpperCase() });
        if (program) {
          finalProgramId = program._id;
          console.log('✅ Found programId:', finalProgramId);
        } else {
          return res.status(400).json({
            success: false,
            message: `Program not found for code: ${programCode}`
          });
        }
      }

      // Look up active academic year if academicYearId is missing
      if (!finalAcademicYearId) {
        const academicYear = await AcademicCalendar.findOne({ status: 'active' });
        if (academicYear) {
          finalAcademicYearId = academicYear._id;
          console.log('✅ Found active academicYearId:', finalAcademicYearId);
        } else {
          return res.status(400).json({
            success: false,
            message: 'No active academic year found'
          });
        }
      }
    }

    // Get time slot displays for denormalized fields
    const timeSlots = await getTimeSlotsSorted();
    
    // Create a map for slot ID to timeSlot lookup
    const timeSlotMap = createTimeSlotMap(timeSlots);

    // Convert all slot identifiers to integers (TimeSlot._id values)
    const actualSlotIndexes = slotIndexes.map(slot => {
      const slotId = parseInt(slot);
      if (isNaN(slotId)) {
        throw new Error(`Invalid slot ID: ${slot} - must be a number`);
      }
      return slotId;
    });
    
    console.log('✅ Using slot IDs directly as slot indexes:', actualSlotIndexes);

    // Special handling for "bothGroups" lab classes - Create separate slots for each group
    if (labGroupType === 'bothGroups' && classType === 'P') {
      console.log('🔄 Processing bothGroups lab class - creating separate assignments for each group');
      
      // Validate that both groups have the required data
      const sectionGroups = getLabGroupsForSection(section);
      if (!groupASubject || !groupBSubject) {
        return res.status(400).json({
          success: false,
          message: `Both Group ${sectionGroups[0]} and Group ${sectionGroups[1]} subjects are required for bothGroups lab classes`
        });
      }
      
      if (!groupATeachers || !groupBTeachers || groupATeachers.length === 0 || groupBTeachers.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Both Group ${sectionGroups[0]} and Group ${sectionGroups[1]} teachers are required for bothGroups lab classes`
        });
      }
      
      if (!groupARoom || !groupBRoom) {
        return res.status(400).json({
          success: false,
          message: `Both Group ${sectionGroups[0]} and Group ${sectionGroups[1]} rooms are required for bothGroups lab classes`
        });
      }
      
      // Create two separate spanned assignments - one for each group
      const groupAssignments = [
        {
          subjectId: groupASubject,
          teacherIds: groupATeachers,
          roomId: groupARoom,
          labGroup: sectionGroups[0], // First group for this section (A for AB, C for CD)
          displaySuffix: isAlternativeWeek ? ` (Group ${sectionGroups[0]} - Alt Week)` : ` (Group ${sectionGroups[0]})`
        },
        {
          subjectId: groupBSubject,
          teacherIds: groupBTeachers,
          roomId: groupBRoom,
          labGroup: sectionGroups[1], // Second group for this section (B for AB, D for CD)
          displaySuffix: isAlternativeWeek ? ` (Group ${sectionGroups[1]} - Alt Week)` : ` (Group ${sectionGroups[1]})`
        }
      ];
      
      const createdSlotGroups = [];
      
      for (const groupAssignment of groupAssignments) {
        // Create a separate spanId for each group
        const spanId = new mongoose.Types.ObjectId();
        const createdSlots = [];
        
        // Get subject, teachers, and room data for this group
        const subject = await Subject.findById(groupAssignment.subjectId);
        const teachers = await Teacher.find({ _id: { $in: groupAssignment.teacherIds } });
        const room = await Room.findById(groupAssignment.roomId);
        
        if (!subject || teachers.length !== groupAssignment.teacherIds.length || !room) {
          const sectionGroups = getLabGroupsForSection(section);
          const groupLabel = groupAssignment.labGroup === sectionGroups[0] ? 'first' : 'second';
          return res.status(400).json({
            success: false,
            message: `Invalid subject, teacher, or room ID provided for Group ${groupAssignment.labGroup} (${groupLabel} group for section ${section})`
          });
        }
        
        // Create slots for each time slot
        for (let i = 0; i < actualSlotIndexes.length; i++) {
          const slotIndex = actualSlotIndexes[i];
          const isSpanMaster = i === 0;
          
          // Get time slot for this slotIndex
          const timeSlot = timeSlotMap.get(slotIndex);
          if (!timeSlot) {
            console.error(`TimeSlot not found for index ${slotIndex}`);
            continue;
          }
          
          const slotData = {
            programId: finalProgramId,
            academicYearId: finalAcademicYearId,
            programCode: programCode.toUpperCase(),
            semester: parseInt(semester),
            semesterGroup: getSemesterGroupName(parseInt(semester)),
            section: section.toUpperCase(),
            dayIndex,
            slotIndex,
            subjectId: groupAssignment.subjectId,
            teacherIds: groupAssignment.teacherIds,
            roomId: groupAssignment.roomId,
            classType: classType || 'P',
            notes: notes || '',
            // Span fields
            spanMaster: isSpanMaster,
            spanId: spanId,
            // Lab group info - CRITICAL: This allows separate slots for same time period
            labGroup: groupAssignment.labGroup,
            isAlternativeWeek: isAlternativeWeek,
            // Denormalized display fields
            subjectName_display: (subject?.name || 'Unknown Subject') + groupAssignment.displaySuffix,
            subjectCode_display: subject?.code || '',
            teacherShortNames_display: teachers.map(t => 
              t?.shortName || (t?.fullName ? t.fullName.split(' ').map(n => n[0]).join('.') : 'Unknown')
            ),
            roomName_display: room?.name || 'Unknown Room',
            timeSlot_display: timeSlot ? `${timeSlot.startTime} - ${timeSlot.endTime}` : ''
          };

          // Create new slot
          const routineSlot = session ?
            await RoutineSlot.create([slotData], { session }) :
            await RoutineSlot.create(slotData);
          
          createdSlots.push(session ? routineSlot[0] : routineSlot);
        }
        
        createdSlotGroups.push({
          group: groupAssignment.labGroup,
          slots: createdSlots
        });
      }
      
      // Commit transaction if session exists
      if (session) {
        try {
          await session.commitTransaction();
          console.log('Successfully committed transaction for bothGroups');
          session.endSession();
        } catch (commitError) {
          console.error('Error committing transaction:', commitError);
          try {
            await session.abortTransaction();
          } catch (abortError) {
            console.error('Error aborting transaction:', abortError);
          } finally {
            session.endSession();
          }
          throw new Error('Failed to commit transaction: ' + commitError.message);
        }
      }
      
      // Handle teacher schedule updates for both groups
      const allTeacherIds = [...groupATeachers, ...groupBTeachers];
      const affectedTeacherIds = [...new Set(allTeacherIds)]
        .filter(id => id != null && id !== undefined)
        .map(id => typeof id === 'object' && id._id ? id._id.toString() : id.toString());
      
      if (affectedTeacherIds.length > 0) {
        try {
          const { publishToQueue } = require('../services/queue.service');
          await publishToQueue(
            'teacher_routine_updates', 
            { affectedTeacherIds }
          );
          console.log(`[Queue] Queued schedule updates for teachers: ${affectedTeacherIds.join(', ')}`);
        } catch (queueServiceError) {
          console.warn('Queue service unavailable, skipping teacher schedule update queue:', queueServiceError.message);
        }
      }
      
      return res.status(201).json({
        success: true,
        message: `Multi-period bothGroups lab class assigned successfully across ${actualSlotIndexes.length} periods for both groups!`,
        data: {
          slotGroups: createdSlotGroups.map(group => ({
            group: group.group,
            slotCount: group.slots.length,
            spanId: group.slots[0]?.spanId
          }))
        }
      });
    }

    // 1. Validate input and set defaults
    if (!Array.isArray(slotIndexes) || slotIndexes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one slot must be specified'
      });
    }

    if (!Array.isArray(teacherIds) || teacherIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one teacher must be assigned'
      });
    }
    
    // If this is a lab class (classType === 'P') but no labGroup is specified, default to 'ALL'
    if (classType === 'P' && (!labGroup || !['A', 'B', 'C', 'D', 'ALL'].includes(labGroup))) {
      console.log('⚠️ Lab class detected in spanned assignment but labGroup not specified - defaulting to ALL');
      labGroup = 'ALL'; // Default to ALL if not specified for backward compatibility
    }

    // 2. Check for collisions for each slotIndex - with semester group awareness
    for (const slotIndex of actualSlotIndexes) {
      // Check for teacher conflicts - only within same semester group
      for (const teacherId of teacherIds) {
        const teacherConflicts = await RoutineSlot.find({
          dayIndex,
          slotIndex,
          teacherIds: teacherId
        })
        .populate('subjectId', 'name')
        .populate('roomId', 'name');

        for (const teacherConflict of teacherConflicts) {
          // Only consider it a conflict if both semesters are in the same group
          if (areSemestersInSameGroup(parseInt(semester), parseInt(teacherConflict.semester))) {
            const teacher = await Teacher.findById(teacherId);
            
            console.log(`🔴 Spanned class teacher conflict detected: ${teacher?.fullName || 'Unknown'} has classes in same semester group (${getSemesterGroupName(semester)}) at same time`);
            
            return res.status(409).json({
              success: false,
              message: 'Teacher conflict detected',
              conflict: {
                type: 'teacher',
                teacherName: teacher?.fullName,
                slotIndex,
                semesterGroup: getSemesterGroupName(semester),
                conflictReason: `Teacher is already teaching in ${getSemesterGroupName(teacherConflict.semester)} semester group at this time`,
                conflictDetails: {
                  programCode: teacherConflict.programCode,
                  semester: teacherConflict.semester,
                  section: teacherConflict.section,
                  subjectName: teacherConflict.subjectName_display || teacherConflict.subjectId?.name,
                  roomName: teacherConflict.roomName_display || teacherConflict.roomId?.name
                }
              }
            });
          } else {
            console.log(`✅ No spanned class teacher conflict: ${semester} (${getSemesterGroupName(semester)}) and ${teacherConflict.semester} (${getSemesterGroupName(teacherConflict.semester)}) are in different semester groups`);
          }
        }
      }

      // Check for room conflict - only within same semester group
      const roomConflicts = await RoutineSlot.find({
        dayIndex,
        slotIndex,
        roomId
      }).populate('subjectId', 'name');

      for (const roomConflict of roomConflicts) {
        // Only consider it a conflict if both semesters are in the same group
        if (areSemestersInSameGroup(parseInt(semester), parseInt(roomConflict.semester))) {
          const room = await Room.findById(roomId);
          
          console.log(`🔴 Spanned class room conflict detected: ${room?.name || 'Unknown'} is being used by same semester group (${getSemesterGroupName(semester)}) at same time`);
          
          return res.status(409).json({
            success: false,
            message: 'Room conflict detected',
            conflict: {
              type: 'room',
              roomName: room?.name,
              slotIndex,
              semesterGroup: getSemesterGroupName(semester),
              conflictReason: `Room is already occupied by ${getSemesterGroupName(roomConflict.semester)} semester group at this time`,
              conflictDetails: {
                programCode: roomConflict.programCode,
                semester: roomConflict.semester,
                section: roomConflict.section,
                subjectName: roomConflict.subjectName_display || roomConflict.subjectId?.name
              }
            }
          });
        } else {
          console.log(`✅ No spanned class room conflict: ${semester} (${getSemesterGroupName(semester)}) and ${roomConflict.semester} (${getSemesterGroupName(roomConflict.semester)}) are in different semester groups`);
        }
      }

      // Check if slot already exists for this program/semester/section
      const existingSlot = await RoutineSlot.findOne({
        programCode: programCode.toUpperCase(),
        semester: parseInt(semester),
        section: section.toUpperCase(),
        dayIndex,
        slotIndex,
        semesterGroup: getSemesterGroupName(parseInt(semester))
      });

      if (existingSlot) {
        return res.status(409).json({
          success: false,
          message: 'Slot already occupied',
          conflict: {
            type: 'slot',
            slotIndex,
            conflictDetails: {
              programCode: existingSlot.programCode,
              semester: existingSlot.semester,
              section: existingSlot.section,
              subjectName: existingSlot.subjectName_display || existingSlot.subjectId?.name
            }
          }
        });
      }
    }

    // 3. Get denormalized display data
    const subject = await Subject.findById(subjectId);
    const teachers = await Teacher.find({ _id: { $in: teacherIds } });
    const room = await Room.findById(roomId);

    if (!subject || teachers.length !== teacherIds.length || !room) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject, teacher, or room ID provided'
      });
    }

    // 4. Generate a single spanId to link all slots
    const spanId = new mongoose.Types.ObjectId();
    
    // 5. Create routine slots for each slotIndex within transaction
    const createdSlots = [];
    
    // Add validation for timeSlotMap lookup
    if (actualSlotIndexes.some(idx => timeSlotMap.get(idx) === undefined)) {
      console.error('Invalid slot index found. Available indexes:', [...timeSlotMap.keys()]);
      console.error('Requested indexes:', actualSlotIndexes);
      return res.status(400).json({
        success: false,
        message: 'Invalid slot index provided - slot not found in time slots'
      });
    }
    
    for (let i = 0; i < actualSlotIndexes.length; i++) {
      const slotIndex = actualSlotIndexes[i];
      const isSpanMaster = i === 0; // First slot is the span master
      
      // Get time slot for this slotIndex
      const timeSlot = timeSlotMap.get(slotIndex);
      if (!timeSlot) {
        console.error(`TimeSlot not found for index ${slotIndex}`);
        continue; // Skip this slot if timeSlot not found
      }
      const slotData = {
        programId: finalProgramId,
        academicYearId: finalAcademicYearId,
        programCode: programCode.toUpperCase(),
        semester: parseInt(semester),
        semesterGroup: getSemesterGroupName(parseInt(semester)),
        section: section.toUpperCase(),
        dayIndex,
        slotIndex,
        subjectId,
        teacherIds,
        roomId,
        classType: classType || 'L',
        notes: notes || '',
        // Lab group for practical classes - ensure it's set for single period labs too
        labGroup: classType === 'P' ? (labGroup || 'ALL') : null,
        // Whether lab groups alternate weeks
        isAlternativeWeek: classType === 'P' ? !!isAlternativeWeek : false,
        // Span fields
        spanMaster: isSpanMaster,
        spanId: spanId,
        // Denormalized display fields
        subjectName_display: subject?.name || 'Unknown Subject',
        subjectCode_display: subject?.code || '',
        teacherShortNames_display: teachers.map(t => 
          t?.shortName || (t?.fullName ? t.fullName.split(' ').map(n => n[0]).join('.') : 'Unknown')
        ),
        roomName_display: room?.name || 'Unknown Room',
        timeSlot_display: timeSlot ? `${timeSlot.startTime} - ${timeSlot.endTime}` : ''
      };

      // Create new slot
      const routineSlot = session ?
        await RoutineSlot.create([slotData], { session }) :
        await RoutineSlot.create(slotData);
      
      createdSlots.push(session ? routineSlot[0] : routineSlot);
    }

    // 6. Commit transaction if session exists
    if (session) {
      try {
        await session.commitTransaction();
        console.log('Successfully committed transaction');
        session.endSession();
      } catch (commitError) {
        console.error('Error committing transaction:', commitError);
        try {
          await session.abortTransaction();
        } catch (abortError) {
          console.error('Error aborting transaction:', abortError);
        } finally {
          session.endSession();
        }
        throw new Error('Failed to commit transaction: ' + commitError.message);
      }
    }

    // 7. Publish message to queue for teacher schedule regeneration
    try {
      // For spanned class creation, there are no old teachers (new assignment)
      const oldTeacherIds = []; // No existing teachers for new spanned class
      const newTeacherIds = teacherIds || [];
      
      // Ensure each ID is properly converted to string
      const affectedTeacherIds = [...new Set([...oldTeacherIds, ...newTeacherIds])]
        .filter(id => id != null && id !== undefined)
        .map(id => typeof id === 'object' && id._id ? id._id.toString() : id.toString());
      
      console.log('Processing affected teacher IDs:', affectedTeacherIds);
      
      if (affectedTeacherIds.length > 0) {
        // Try to load queue service dynamically
        try {
          const { publishToQueue } = require('../services/queue.service');
          await publishToQueue(
            'teacher_routine_updates', 
            { affectedTeacherIds }
          );
          console.log(`[Queue] Queued schedule updates for teachers: ${affectedTeacherIds.join(', ')}`);
        } catch (queueServiceError) {
          console.warn('Queue service unavailable, skipping teacher schedule update queue:', queueServiceError.message);
          // Continue without failing
        }
      }
    } catch (queueError) {
      console.error('CRITICAL: Failed to queue teacher schedule updates. Manual regeneration may be required.', queueError);
      // Do not re-throw; the user's action was successful.
      
      // Fallback: Direct asynchronous teacher schedule regeneration (only if not in test environment)
      if (!isTestEnvironment) {
        setImmediate(async () => {
          for (const teacherId of teacherIds) {
            try {
              // Teacher schedule generation has been disabled
              console.log(`Teacher schedule generation disabled for teacher ${teacherId}`);
            } catch (error) {
              console.error(`Error in disabled teacher schedule generation for teacher ${teacherId}:`, error);
            }
          }
        });
      }
    }

    // 8. Return successful response
    res.status(201).json({
      success: true,
      data: {
        spanId,
        slots: createdSlots,
        spanMaster: createdSlots.find(slot => slot.spanMaster === true)
      },
      message: `Spanned class successfully assigned across ${actualSlotIndexes.length} slots`
    });
  } catch (error) {
    // Abort transaction on error if session exists
    if (session) {
      try {
        await session.abortTransaction();
        console.log('Transaction aborted due to error');
      } catch (abortError) {
        console.error('Error aborting transaction:', abortError);
      } finally {
        session.endSession();
      }
    }
    
    console.error('Error in assignClassSpanned:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
      requestBody: req.body
    });
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A class is already scheduled for this program/semester/section at one of these time slots'
      });
    }
    
    // Handle different error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    } else if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid ${error.path}: ${error.value}`
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Clear class from routine slot
// @route   DELETE /api/routines/:programCode/:semester/:section/clear
// @access  Private/Admin
exports.clearClass = async (req, res) => {
  try {
    const { programCode, semester, section } = req.params;
    const { dayIndex, slotIndex } = req.body;

    const routineSlot = await RoutineSlot.findOne({
      programCode: programCode.toUpperCase(),
      semester: parseInt(semester),
      section: section.toUpperCase(),
      dayIndex,
      slotIndex,
      semesterGroup: getSemesterGroupName(parseInt(semester))
    });

    if (!routineSlot) {
      return res.status(404).json({
        success: false,
        message: 'Routine slot not found'
      });
    }

    // Store the affected teachers before deletion
    const affectedTeachers = routineSlot.teacherIds;

    await RoutineSlot.findByIdAndDelete(routineSlot._id);

    // Publish message to queue for teacher schedule regeneration (following architecture documentation)
    try {
      // For deletions, we only need the teachers that were in the deleted slot
      const oldTeacherIds = affectedTeachers || [];
      const newTeacherIds = []; // No new teachers for deletion
      
      const affectedTeacherIds = [...new Set([...oldTeacherIds, ...newTeacherIds])]
        .filter(id => id != null && id.toString()); // Ensure IDs are valid
      
      if (affectedTeacherIds.length > 0) {
        // Try to load queue service dynamically
        try {
          const { publishToQueue } = require('../services/queue.service');
          await publishToQueue(
            'teacher_routine_updates', 
            { affectedTeacherIds }
          );
          console.log(`[Queue] Queued schedule updates for teachers: ${affectedTeacherIds.join(', ')}`);
        } catch (queueServiceError) {
          console.warn('Queue service unavailable, skipping teacher schedule update queue:', queueServiceError.message);
          // Continue without failing
        }
      }
    } catch (queueError) {
      console.error('CRITICAL: Failed to queue teacher schedule updates. Manual regeneration may be required.', queueError);
      // Do not re-throw; the user's action was successful.
      
      // Fallback: Direct asynchronous teacher schedule regeneration
      setImmediate(async () => {
        for (const teacherId of affectedTeachers) {
          try {
            // Teacher schedule generation has been disabled
            console.log(`Teacher schedule generation disabled for teacher ${teacherId}`);
          } catch (error) {
            console.error(`Error in disabled teacher schedule generation for teacher ${teacherId}:`, error);
          }
        }
      });
    }

    res.json({
      success: true,
      data: {},
      message: 'Class cleared successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Clear entire weekly routine for a section
// @route   DELETE /api/routines/:programCode/:semester/:section/clear-all
// @access  Private/Admin
exports.clearEntireRoutine = async (req, res) => {
  try {
    const { programCode, semester, section } = req.params;

    // Find all routine slots for this program/semester/section
    const routineSlots = await RoutineSlot.find({
      programCode: programCode.toUpperCase(),
      semester: parseInt(semester),
      section: section.toUpperCase()
    });

    if (!routineSlots || routineSlots.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No routine found for ${programCode.toUpperCase()} Semester ${semester} Section ${section.toUpperCase()}`
      });
    }

    // Store all affected teachers before deletion
    const allAffectedTeachers = routineSlots.reduce((teachers, slot) => {
      if (slot.teacherIds && slot.teacherIds.length > 0) {
        teachers.push(...slot.teacherIds);
      }
      return teachers;
    }, []);

    // Get unique teacher IDs
    const uniqueTeacherIds = [...new Set(allAffectedTeachers.map(id => id.toString()))];

    // Delete all routine slots for this program/semester/section
    const deleteResult = await RoutineSlot.deleteMany({
      programCode: programCode.toUpperCase(),
      semester: parseInt(semester),
      section: section.toUpperCase()
    });

    // Publish message to queue for teacher schedule regeneration
    try {
      if (uniqueTeacherIds.length > 0) {
        // Try to load queue service dynamically
        try {
          const { publishToQueue } = require('../services/queue.service');
          await publishToQueue(
            'teacher_routine_updates', 
            { affectedTeacherIds: uniqueTeacherIds }
          );
          console.log(`[Queue] Queued schedule updates for teachers: ${uniqueTeacherIds.join(', ')}`);
        } catch (queueServiceError) {
          console.warn('Queue service unavailable, skipping teacher schedule update queue:', queueServiceError.message);
          // Continue without failing
        }
      }
    } catch (queueError) {
      console.error('CRITICAL: Failed to queue teacher schedule updates. Manual regeneration may be required.', queueError);
      
      // Fallback: Direct asynchronous teacher schedule regeneration
      setImmediate(async () => {
        for (const teacherId of uniqueTeacherIds) {
          try {
            // Teacher schedule generation has been disabled
            console.log(`Teacher schedule generation disabled for teacher ${teacherId}`);
          } catch (error) {
            console.error(`Error in disabled teacher schedule generation for teacher ${teacherId}:`, error);
          }
        }
      });
    }

    res.json({
      success: true,
      data: {
        deletedCount: deleteResult.deletedCount,
        programCode: programCode.toUpperCase(),
        semester,
        section: section.toUpperCase(),
        affectedTeachers: uniqueTeacherIds.length
      },
      message: `Successfully cleared the entire routine for ${programCode.toUpperCase()} Semester ${semester} Section ${section.toUpperCase()} (${deleteResult.deletedCount} classes removed)`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};


// @desc    Get all routines for a program
// @route   GET /api/routines/:programCode
// @access  Public
exports.getProgramRoutines = async (req, res) => {
  try {
    const { programCode } = req.params;

    const routineSlots = await RoutineSlot.find({
      programCode: programCode.toUpperCase()
    })
      .populate('subjectId', 'name code')
      .populate('teacherIds', 'fullName shortName')
      .populate('roomId', 'name')
      .sort({ semester: 1, section: 1, dayIndex: 1, slotIndex: 1 });

    // Group by semester and section
    const routines = {};
    routineSlots.forEach(slot => {
      const key = `${slot.semester}-${slot.section}`;
      if (!routines[key]) {
        routines[key] = {
          semester: slot.semester,
          section: slot.section,
          slots: {}
        };
      }
      
      if (!routines[key].slots[slot.dayIndex]) {
        routines[key].slots[slot.dayIndex] = {};
      }
      
      routines[key].slots[slot.dayIndex][slot.slotIndex] = {
        _id: slot._id,
        subjectName: slot.subjectName || slot.subjectId?.name,
        teacherShortNames: slot.teacherShortNames_display || slot.teacherIds.map(t => t.shortName),
        roomName: slot.roomName_display || slot.roomId?.name,
        classType: slot.classType
      };
    });

    res.json({
      success: true,
      data: {
        programCode: programCode.toUpperCase(),
        routines: Object.values(routines)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Check room availability
// @route   GET /api/routines/rooms/:roomId/availability
// @access  Public
exports.checkRoomAvailability = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { dayIndex, slotIndex, semester } = req.query;

    if (dayIndex === undefined || slotIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: 'dayIndex and slotIndex are required'
      });
    }

    // Enhanced availability checking that handles spanned classes with semester group awareness
    let conflict = null;
    
    // First check for direct slot conflicts - only within same semester group if provided
    const directConflicts = await RoutineSlot.find({
      dayIndex: parseInt(dayIndex),
      slotIndex: parseInt(slotIndex),
      roomId: roomId,
      isActive: true
    }).populate('subjectId', 'name')
      .populate('teacherIds', 'fullName shortName');

    // Filter by semester group if semester is provided
    if (semester && directConflicts.length > 0) {
      const currentSemester = parseInt(semester);
      const sameGroupConflicts = directConflicts.filter(c => 
        areSemestersInSameGroup(currentSemester, parseInt(c.semester))
      );
      conflict = sameGroupConflicts.length > 0 ? sameGroupConflicts[0] : null;
    } else {
      conflict = directConflicts.length > 0 ? directConflicts[0] : null;
    }

    if (!conflict) {
      // Check for spanned class conflicts - room might be busy in a class that spans this slot
      const spanConflicts = await RoutineSlot.find({
        dayIndex: parseInt(dayIndex),
        roomId: roomId,
        isActive: true,
        spanId: { $ne: null } // Only check spanned classes
      }).populate('subjectId', 'name')
        .populate('teacherIds', 'fullName shortName');

      // Filter by semester group if semester is provided
      let filteredSpanConflicts = spanConflicts;
      if (semester) {
        const currentSemester = parseInt(semester);
        filteredSpanConflicts = spanConflicts.filter(c => 
          areSemestersInSameGroup(currentSemester, parseInt(c.semester))
        );
      }

      // Check if any spanned class overlaps with the requested slot
      for (const spanClass of filteredSpanConflicts) {
        // Get all slots for this spanned class
        const spanSlots = await RoutineSlot.find({
          spanId: spanClass.spanId,
          isActive: true
        }, { slotIndex: 1 }).lean();

        const spanSlotIndices = spanSlots.map(s => s.slotIndex).sort((a, b) => a - b);
        const requestedSlot = parseInt(slotIndex);

        // Check if the requested slot falls within the span range
        if (spanSlotIndices.length > 0 && 
            requestedSlot >= spanSlotIndices[0] && 
            requestedSlot <= spanSlotIndices[spanSlotIndices.length - 1]) {
          conflict = spanClass;
          break;
        }
      }
    }

    const isAvailable = !conflict;

    res.json({
      success: true,
      data: {
        roomId,
        dayIndex: parseInt(dayIndex),
        slotIndex: parseInt(slotIndex),
        isAvailable,
        conflict: conflict ? {
          programCode: conflict.programCode,
          semester: conflict.semester,
          section: conflict.section,
          subjectName: conflict.subjectName || conflict.subjectId?.name,
          semesterGroup: getSemesterGroupName(conflict.semester),
          teacherNames: conflict.teacherIds?.map(t => t.shortName || t.fullName).join(', ')
        } : null
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Export routine to PDF
// @route   GET /api/routines/:programCode/:semester/:section/export-pdf
// @access  Public
exports.exportRoutineToPDF = async (req, res) => {
  try {
    const { programCode, semester, section } = req.params;
    const { format = 'download', startDate, endDate } = req.query; // Add startDate and endDate from query
    
    console.log(`📄 PDF export requested: ${programCode}-${semester}-${section}, format: ${format}, dates: ${startDate} to ${endDate}`);

    // Import PDF service
    const PDFRoutineService = require('../services/PDFRoutineService');

    // Generate PDF buffer for the specific program/semester/section with dates
    const pdfService = new PDFRoutineService();
    const pdfBuffer = await pdfService.generateClassSchedulePDF(
      programCode.toUpperCase(),
      parseInt(semester),
      section.toUpperCase(),
      { startDate, endDate } // Pass dates to PDF service
    );

    if (!pdfBuffer) {
      return res.status(404).json({
        success: false,
        message: 'No routine data found for the specified program/semester/section'
      });
    }

    // Set response headers for PDF
    const filename = `${programCode.toUpperCase()}_Semester${semester}_${section.toUpperCase()}_Schedule.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    
    if (format === 'inline') {
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }
    
    res.setHeader('Content-Length', pdfBuffer.length);

    console.log(`✅ PDF generated successfully: ${filename} (${pdfBuffer.length} bytes)`);
    
    // Send the PDF buffer
    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Error exporting routine to PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF export',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Export all routines for a semester to PDF
// @route   GET /api/routines/:programCode/semester/:semester/export-pdf-all
// @access  Public
exports.exportAllSemesterRoutinesToPDF = async (req, res) => {
  try {
    const { programCode, semester } = req.params;
    const { format = 'download' } = req.query; // 'download' or 'inline'
    
    console.log(`📄 All semester PDF export requested: ${programCode}-${semester}, format: ${format}`);

    // Import PDF service
    const PDFRoutineService = require('../services/PDFRoutineService');

    // Generate combined PDF for all sections in the semester
    const pdfService = new PDFRoutineService();
    const pdfBuffer = await pdfService.generateAllSemesterSchedulesPDF(
      programCode.toUpperCase(),
      parseInt(semester)
    );

    if (!pdfBuffer) {
      return res.status(404).json({
        success: false,
        message: 'No routine data found for the specified program/semester'
      });
    }

    // Set response headers for PDF
    const filename = `${programCode.toUpperCase()}_Semester${semester}_All_Sections_Schedule.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    
    if (format === 'inline') {
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }
    
    res.setHeader('Content-Length', pdfBuffer.length);

    console.log(`✅ Combined PDF generated successfully: ${filename} (${pdfBuffer.length} bytes)`);
    
    // Send the PDF buffer
    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Error exporting all semester routines to PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate combined PDF export',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Export routine to Excel (STUB - Excel functionality removed)
// @route   GET /api/routines/:programCode/:semester/:section/export
// @access  Public
exports.exportRoutineToExcel = async (req, res) => {
  try {
    const { programCode, semester, section } = req.params;

    // Validate program exists
    const program = await Program.findOne({ code: programCode.toUpperCase() });
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }

    // Return a message that Excel export is disabled
    return res.status(400).json({
      success: false,
      message: 'Excel export functionality has been disabled.',
      details: 'This feature is no longer available'
    });
  } catch (error) {
    console.error('Error in Excel export endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error: ' + error.message
    });
  }
};

// @desc    Import routine from Excel file for specific program/semester/section
// @route   POST /api/routines/:programCode/:semester/:section/import
// @access  Private/Admin
exports.importRoutineFromExcel = async (req, res) => {
  try {
    console.log('Excel import functionality has been disabled.');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { programCode, semester, section } = req.params;
    
    // Validate parameters
    if (!programCode || !semester || !section) {
      return res.status(400).json({
        success: false,
        message: 'Program code, semester, and section are required'
      });
    }

    // Return a message that Excel import is disabled
    return res.status(400).json({
      success: false,
      message: 'Excel import functionality has been disabled.',
      details: 'This feature is no longer available'
    });
  } catch (error) {
    console.error('Error in Excel import endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error: ' + error.message
    });
  }
};

// @desc    Validate uploaded routine Excel file
// @route   POST /api/routines/import/validate
// @access  Private/Admin
exports.validateRoutineImport = [
  async (req, res) => {
    try {
      console.log('Excel import functionality has been disabled.');
      
      // Return a message that Excel import is disabled
      return res.status(400).json({
        success: false,
        message: 'Excel import functionality has been disabled.',
        details: 'This feature is no longer available'
      });
    } catch (error) {
      console.error('Error in routine import validation:', error);
      res.status(500).json({
        success: false,
        message: 'Error: ' + error.message
      });
    }
  }
];

// @desc    Download Excel import template
// @route   GET /api/routines/import/template
// @access  Public
exports.downloadImportTemplate = async (req, res) => {
  try {
    console.log('Excel functionality has been disabled.');
    
    // Return a message that Excel export is disabled
    return res.status(400).json({
      success: false,
      message: 'Excel export functionality has been disabled.',
      details: 'This feature is no longer available'
    });
  } catch (error) {
    console.error('Error in template download endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error: ' + error.message
    });
  }
};

// Clear a span group (multi-period class)
exports.clearSpanGroup = async (req, res) => {
  const { spanId } = req.params;

  if (!spanId || !mongoose.Types.ObjectId.isValid(spanId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid span ID'
    });
  }

  try {
    // Find all slots in the span group to get teacher IDs for cache invalidation
    const spanSlots = await RoutineSlot.find({ spanId });
    
    if (!spanSlots || spanSlots.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Span group not found'
      });
    }
    
    // Extract unique teacher IDs from all slots for cache invalidation
    const teacherIds = Array.from(new Set(
      spanSlots.flatMap(slot => slot.teacherIds)
    ));
    
    // Delete all slots with this spanId
    const deleteResult = await RoutineSlot.deleteMany({ spanId });
    
    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'No slots found for this span group'
      });
    }
    
    // Publish message to queue for teacher schedule regeneration
    try {
      // For span group deletion, we only need the teachers that were in the deleted slots
      const oldTeacherIds = teacherIds || [];
      const newTeacherIds = []; // No new teachers for deletion
      
      const affectedTeacherIds = [...new Set([...oldTeacherIds, ...newTeacherIds])]
        .filter(id => id != null && id.toString()); // Ensure IDs are valid
      
      if (affectedTeacherIds.length > 0) {
        const { publishToQueue } = require('../services/queue.service');
        await publishToQueue(
          'teacher_routine_updates', 
          { affectedTeacherIds }
        );
        console.log(`[Queue] Queued schedule updates for teachers: ${affectedTeacherIds.join(', ')}`);
      }
    } catch (queueError) {
      console.error('CRITICAL: Failed to queue teacher schedule updates. Manual regeneration may be required.', queueError);
      // Do not re-throw; the user's action was successful.
      
      // Fallback: Teacher schedule regeneration disabled
      setImmediate(async () => {
        for (const teacherId of teacherIds) {
          try {
            console.log(`Teacher schedule generation disabled for teacher ${teacherId}`);
          } catch (error) {
            console.error(`Error in disabled teacher schedule generation for teacher ${teacherId}:`, error);
          }
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      message: `Multi-period class cleared successfully (${deleteResult.deletedCount} periods)`,
      deletedCount: deleteResult.deletedCount
    });
    
  } catch (error) {
    console.error('Error clearing span group:', error);
    return res.status(500).json({
      success: false,
      message: 'Error clearing multi-period class',
      error: error.message
    });
  }
};

// @desc    Check teacher availability
// @route   GET /api/routines/teachers/:teacherId/availability
// @access  Public
exports.checkTeacherAvailability = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { dayIndex, slotIndex, semester } = req.query;

    if (dayIndex === undefined || slotIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: 'dayIndex and slotIndex are required'
      });
    }

    // Validate teacher exists with lean query for performance
    const teacher = await Teacher.findById(teacherId).lean();
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    // Enhanced availability checking that handles spanned classes with semester group awareness
    let conflict = null;
    
    // First check for direct slot conflicts - only within same semester group if provided
    const directConflictQuery = {
      dayIndex: parseInt(dayIndex),
      slotIndex: parseInt(slotIndex),
      teacherIds: teacherId,
      isActive: true
    };

    const directConflicts = await RoutineSlot.find(directConflictQuery, {
      programCode: 1,
      semester: 1,
      section: 1,
      subjectName_display: 1,
      roomName_display: 1,
      subjectId: 1,
      roomId: 1,
      spanId: 1,
      spanMaster: 1
    })
    .populate('subjectId', 'name')
    .populate('roomId', 'name')
    .lean()
    .maxTimeMS(10000);

    // Filter by semester group if semester is provided
    if (semester && directConflicts.length > 0) {
      const currentSemester = parseInt(semester);
      const sameGroupConflicts = directConflicts.filter(c => 
        areSemestersInSameGroup(currentSemester, parseInt(c.semester))
      );
      conflict = sameGroupConflicts.length > 0 ? sameGroupConflicts[0] : null;
    } else {
      conflict = directConflicts.length > 0 ? directConflicts[0] : null;
    }

    if (!conflict) {
      // Check for spanned class conflicts - teacher might be busy in a class that spans this slot
      const spanConflicts = await RoutineSlot.find({
        dayIndex: parseInt(dayIndex),
        teacherIds: teacherId,
        isActive: true,
        spanId: { $ne: null } // Only check spanned classes
      }, {
        programCode: 1,
        semester: 1,
        section: 1,
        subjectName_display: 1,
        roomName_display: 1,
        subjectId: 1,
        roomId: 1,
        spanId: 1,
        spanMaster: 1,
        slotIndex: 1
      })
      .populate('subjectId', 'name')
      .populate('roomId', 'name')
      .lean()
      .maxTimeMS(10000);

      // Filter by semester group if semester is provided
      let filteredSpanConflicts = spanConflicts;
      if (semester) {
        const currentSemester = parseInt(semester);
        filteredSpanConflicts = spanConflicts.filter(c => 
          areSemestersInSameGroup(currentSemester, parseInt(c.semester))
        );
      }

      // Check if any spanned class overlaps with the requested slot
      for (const spanClass of filteredSpanConflicts) {
        // Get all slots for this spanned class
        const spanSlots = await RoutineSlot.find({
          spanId: spanClass.spanId,
          isActive: true
        }, { slotIndex: 1 }).lean();

        const spanSlotIndices = spanSlots.map(s => s.slotIndex).sort((a, b) => a - b);
        const requestedSlot = parseInt(slotIndex);

        // Check if the requested slot falls within the span range
        if (spanSlotIndices.length > 0 && 
            requestedSlot >= spanSlotIndices[0] && 
            requestedSlot <= spanSlotIndices[spanSlotIndices.length - 1]) {
          conflict = spanClass;
          break;
        }
      }
    }

    const isAvailable = !conflict;

    res.json({
      success: true,
      data: {
        teacherId,
        teacherName: teacher.fullName,
        dayIndex: parseInt(dayIndex),
        slotIndex: parseInt(slotIndex),
        isAvailable,
        conflict: conflict ? {
          programCode: conflict.programCode,
          semester: conflict.semester,
          section: conflict.section,
          subjectName: conflict.subjectName || conflict.subjectId?.name,
          roomName: conflict.roomName || conflict.roomId?.name,
          semesterGroup: getSemesterGroupName(conflict.semester)
        } : null
      }
    });
  } catch (error) {
    console.error('Teacher availability check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get available subjects for assignment
// @route   GET /api/routines/:programCode/:semester/subjects
// @access  Public
exports.getAvailableSubjects = async (req, res) => {
  try {
    const { programCode, semester } = req.params;

    // Get curriculum for the specific program-semester
    const programSemesterDoc = await ProgramSemester.findOne({
      programCode: programCode.toUpperCase(),
      semester: parseInt(semester),
      status: 'Active'
    });

    if (!programSemesterDoc) {
      return res.status(404).json({
        success: false,
        message: `No curriculum found for ${programCode} Semester ${semester}`
      });
    }

    // Return the subjects offered for this program-semester
    const subjects = programSemesterDoc.subjectsOffered.map(subject => ({
      _id: subject.subjectId,
      name: subject.subjectName_display,
      code: subject.subjectCode_display,
      courseType: subject.courseType,
      isElective: subject.isElective
    }));

    res.json({
      success: true,
                data: subjects,
      programCode: programCode.toUpperCase(),
      semester: parseInt(semester)
    });

  } catch (error) {
    console.error('Error in getAvailableSubjects:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// NOTE: Teacher schedule functionality has been moved to teacherScheduleController.js
// All related functions (getTeacherSchedule and exportTeacherScheduleToExcel) have been moved
// to maintain proper separation of concerns and avoid duplicate code.

// @desc    Analyze schedule conflicts without creating a slot
// @route   POST /api/routines/conflicts/analyze
// @access  Private/Admin
exports.analyzeScheduleConflicts = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      programId,
      subjectId,
      semester,
      section,
      dayIndex,
      slotIndex,
      teacherIds,
      roomId,
      classType,
      recurrence
    } = req.body;

    // Get current academic year
    const currentAcademicYear = await AcademicCalendar.findOne({ isCurrentYear: true });
    if (!currentAcademicYear) {
      return res.status(400).json({
        success: false,
        message: 'No current academic year found'
      });
    }

    // Prepare slot data for analysis
    const slotData = {
      programId,
      subjectId,
      academicYearId: currentAcademicYear._id,
      semester: parseInt(semester),
      section: section.toUpperCase(),
      dayIndex,
      slotIndex,
      teacherIds,
      roomId,
      classType,
      recurrence: recurrence || { type: 'weekly', description: 'Weekly' },
      labGroupId: null,
      electiveGroupId: null
    };

    // Run advanced conflict detection
    const conflicts = await ConflictDetectionService.validateSchedule(slotData);

    // Get additional context for conflicts
    const analysisResults = {
      hasConflicts: conflicts.length > 0,
      conflictCount: conflicts.length,
      conflicts: conflicts,
      slotData: {
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex],
        slotIndex,
        academicYear: currentAcademicYear.title
      },
      recommendations: []
    };

    // Add recommendations based on conflicts
    if (conflicts.length > 0) {
      const conflictTypes = conflicts.map(c => c.type);
      
      if (conflictTypes.includes('teacher_schedule_conflict')) {
        analysisResults.recommendations.push('Consider assigning a different teacher or changing the time slot');
      }
      
      if (conflictTypes.includes('room_conflict')) {
        analysisResults.recommendations.push('Try using a different room or rescheduling to another time');
      }
      
      if (conflictTypes.includes('teacher_unavailable_day')) {
        analysisResults.recommendations.push('Check teacher availability constraints and reschedule to an available day');
      }
      
      if (conflictTypes.includes('section_conflict')) {
        analysisResults.recommendations.push('Students cannot attend multiple classes simultaneously - reschedule one class');
      }
    } else {
      analysisResults.recommendations.push('No conflicts detected - this slot can be safely assigned');
    }

    res.json({
      success: true,
      message: 'Conflict analysis completed',
      data: analysisResults
    });

  } catch (error) {
    console.error('Error in analyzeScheduleConflicts:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Create unified elective routine for 7th/8th semester
// @route   POST /api/routines/electives/schedule
// @access  Private/Admin
exports.scheduleElectiveClass = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      programId,
      semester,
      subjectId,
      dayIndex,
      slotIndex,
      teacherIds,
      roomId,
      classType,
      electiveGroupId,
      electiveType,
      electiveNumber,
      studentEnrollment
    } = req.body;

    // Validate semester (only 7th and 8th allowed for electives)
    if (![7, 8].includes(parseInt(semester))) {
      return res.status(400).json({
        success: false,
        message: 'Elective scheduling only allowed for 7th and 8th semester'
      });
    }

    // Get current academic year
    const currentAcademicYear = await AcademicCalendar.findOne({ isCurrentYear: true });
    if (!currentAcademicYear) {
      return res.status(400).json({
        success: false,
        message: 'No current academic year found'
      });
    }

    // Get subject and validation data
    const subject = await Subject.findById(subjectId);
    const teachers = await Teacher.find({ _id: { $in: teacherIds } });
    const room = await Room.findById(roomId);
    const program = await Program.findById(programId);

    if (!subject || teachers.length !== teacherIds.length || !room || !program) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject, teachers, room, or program'
      });
    }

    // Prepare elective slot data for conflict detection
    const electiveSlotData = {
      programId,
      subjectId,
      academicYearId: currentAcademicYear._id,
      semester: parseInt(semester),
      dayIndex,
      slotIndex,
      teacherIds,
      roomId,
      classType,
      recurrence: { type: 'weekly', description: 'Weekly' },
      labGroupId: null,
      electiveGroupId,
      // For electives, both sections can have students
      targetSections: ['AB', 'CD']
    };

    // Run conflict detection
    const conflicts = await ConflictDetectionService.validateSchedule(electiveSlotData);

    if (conflicts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Scheduling conflicts detected',
        conflicts: conflicts,
        conflictCount: conflicts.length
      });
    }

    // Create elective routine slots for both sections (AB and CD)
    const electiveSlots = [];
    
    for (const section of ['AB', 'CD']) {
      const electiveSlot = new RoutineSlot({
        programId,
        programCode: program.code.toUpperCase(),
        subjectId,
        academicYearId: currentAcademicYear._id,
        semester: parseInt(semester),
        semesterGroup: getSemesterGroupName(parseInt(semester)),
        section, // Required field - set to either 'AB' or 'CD'
        
        // Core positioning
        dayIndex,
        slotIndex,
        
        // Assignment
        teacherIds,
        roomId,
        classType,
        
        // Classification
        classCategory: 'ELECTIVE',
        isElectiveClass: true,
        electiveGroupId,
        
        // Elective-specific information
        electiveInfo: {
          electiveNumber: electiveNumber || 1,
          electiveType: electiveType || 'TECHNICAL',
          groupName: `${semester === 7 ? '7th' : '8th'} Sem ${electiveType} Elective`,
          electiveCode: `ELEC-${electiveType.substring(0,4).toUpperCase()}-${electiveNumber || 1}`,
          studentComposition: {
            total: studentEnrollment.total,
            fromAB: studentEnrollment.fromAB,
            fromCD: studentEnrollment.fromCD,
            distributionNote: `${studentEnrollment.total} students (${studentEnrollment.fromAB} from AB, ${studentEnrollment.fromCD} from CD)`
          },
          displayOptions: {
            showInBothSections: true,
            highlightAsElective: true,
            customDisplayText: `${subject.name} (Cross-section elective)`
          },
          crossSectionMarker: true // Mark as cross-section elective
        },
        
        // Recurrence
        recurrence: {
          type: 'weekly',
          description: 'Weekly elective class'
        },
        
        // Display data
        display: {
          programCode: req.body.programCode || 'BCT',
          semester: parseInt(semester),
          section,
          subjectCode: subject.code,
          subjectName: subject.name,
          teacherNames: teachers.map(t => t.shortName).join(', '),
          roomName: room.name,
          classType
        },
        
        isActive: true
      });

      electiveSlots.push(electiveSlot);
    }

    // Save both elective slots
    await Promise.all(electiveSlots.map(slot => slot.save()));

    // Populate for response
    await Promise.all(electiveSlots.map(slot => 
      slot.populate([
        { path: 'programId', select: 'code name' },
        { path: 'subjectId', select: 'code name credits' },
        { path: 'teacherIds', select: 'shortName fullName' },
        { path: 'roomId', select: 'name roomNumber capacity' },
        { path: 'academicYearId', select: 'title nepaliYear' }
      ])
    ));

    res.status(201).json({
      success: true,
      message: `Elective class scheduled successfully for both sections (AB and CD)`,
      data: {
        electiveSlots,
        electiveInfo: {
          semester: parseInt(semester),
          electiveNumber: electiveNumber || 1,
          electiveType: electiveType || 'TECHNICAL',
          sections: ['AB', 'CD'],
          subject: {
            id: subject._id,
            code: subject.code,
            name: subject.name
          },
          teachers: teachers.map(t => ({ id: t._id, name: t.fullName, shortName: t.shortName })),
          room: { id: room._id, name: room.name },
          timeSlot: { dayIndex, slotIndex }
        }
      }
    });

  } catch (error) {
    console.error('Error in scheduleElectiveClass:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Create unified elective routine for 7th/8th semester spanning multiple periods
// @route   POST /api/routines/electives/schedule-spanned
// @access  Private/Admin
exports.scheduleElectiveClassSpanned = async (req, res) => {
  console.log('🔄 scheduleElectiveClassSpanned called with data:', JSON.stringify(req.body, null, 2));
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('❌ Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  // Determine if we're in test environment with memory server (transactions may not be supported)
  const isTestEnvironment = process.env.NODE_ENV === 'test';
  
  // Start a session if we're not in test environment
  let session = null;
  try {
    if (!isTestEnvironment) {
      session = await mongoose.startSession();
      session.startTransaction();
      console.log('Started MongoDB transaction session');
    }
  } catch (sessionError) {
    console.error('Failed to start MongoDB transaction session:', sessionError);
    // Continue without session if we can't create one
  }

  try {
    const {
      programId,
      semester,
      subjectId,
      dayIndex,
      slotIndexes,
      teacherIds,
      roomId,
      classType,
      electiveGroupId,
      electiveType,
      electiveNumber,
      studentEnrollment,
      notes
    } = req.body;

    console.log('📝 Processing spanned elective class assignment:', {
      programId,
      semester,
      dayIndex,
      slotIndexes,
      subjectId,
      teacherIds,
      roomId,
      classType,
      electiveType,
      electiveNumber
    });

    // Validate semester (only 7th and 8th allowed for electives)
    if (![7, 8].includes(parseInt(semester))) {
      return res.status(400).json({
        success: false,
        message: 'Elective scheduling only allowed for 7th and 8th semester'
      });
    }

    // Validate input
    if (!Array.isArray(slotIndexes) || slotIndexes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one slot must be specified'
      });
    }

    // Get current academic year
    const currentAcademicYear = await AcademicCalendar.findOne({ isCurrentYear: true });
    if (!currentAcademicYear) {
      return res.status(400).json({
        success: false,
        message: 'No current academic year found'
      });
    }

    // Get subject and validation data
    const subject = await Subject.findById(subjectId);
    const teachers = await Teacher.find({ _id: { $in: teacherIds } });
    const room = await Room.findById(roomId);
    const program = await Program.findById(programId);

    if (!subject || teachers.length !== teacherIds.length || !room || !program) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject, teachers, room, or program'
      });
    }

    // Get time slot displays for denormalized fields
    const timeSlots = await getTimeSlotsSorted();
    
    // Create a map for slot ID to timeSlot lookup
    const timeSlotMap = createTimeSlotMap(timeSlots);

    // Convert all slot identifiers to integers (TimeSlot._id values)
    const actualSlotIndexes = slotIndexes.map(slot => {
      const slotId = parseInt(slot);
      if (isNaN(slotId)) {
        throw new Error(`Invalid slot ID: ${slot} - must be a number`);
      }
      return slotId;
    });
    
    console.log('✅ Using slot IDs directly as slot indexes:', actualSlotIndexes);

    // Prepare elective slot data for conflict detection for each slot
    for (const slotIndex of actualSlotIndexes) {
      const electiveSlotData = {
        programId,
        subjectId,
        academicYearId: currentAcademicYear._id,
        semester: parseInt(semester),
        dayIndex,
        slotIndex,
        teacherIds,
        roomId,
        classType,
        recurrence: { type: 'weekly', description: 'Weekly' },
        labGroupId: null,
        electiveGroupId,
        // For electives, both sections can have students
        targetSections: ['AB', 'CD']
      };

      // Run conflict detection for this slot
      const conflicts = await ConflictDetectionService.validateSchedule(electiveSlotData);

      if (conflicts.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Scheduling conflicts detected for slot ${slotIndex}`,
          conflicts: conflicts,
          conflictCount: conflicts.length
        });
      }
    }

    // Create elective routine slots for both sections (AB and CD) spanning multiple periods
    const electiveSlots = [];
    
    // Generate a unique spanId for this multi-period elective class
    const spanId = new mongoose.Types.ObjectId();
    
    for (const section of ['AB', 'CD']) {
      for (let i = 0; i < actualSlotIndexes.length; i++) {
        const slotIndex = actualSlotIndexes[i];
        const isSpanMaster = i === 0;
        
        // Get time slot for this slotIndex
        const timeSlot = timeSlotMap.get(slotIndex);
        if (!timeSlot) {
          console.error(`TimeSlot not found for index ${slotIndex}`);
          continue;
        }

        const electiveSlot = new RoutineSlot({
          programId,
          programCode: program.code.toUpperCase(),
          subjectId,
          academicYearId: currentAcademicYear._id,
          semester: parseInt(semester),
          semesterGroup: getSemesterGroupName(parseInt(semester)),
          section, // Required field - set to either 'AB' or 'CD'
          
          // Core positioning
          dayIndex,
          slotIndex,
          
          // Assignment
          teacherIds,
          roomId,
          classType,
          
          // Span fields for multi-period class
          spanMaster: isSpanMaster,
          spanId: spanId,
          
          // Classification
          classCategory: 'ELECTIVE',
          isElectiveClass: true,
          electiveGroupId,
          
          // Elective-specific information
          electiveInfo: {
            electiveNumber: electiveNumber || 1,
            electiveType: electiveType || 'TECHNICAL',
            groupName: `${semester === 7 ? '7th' : '8th'} Sem ${electiveType} Elective (Multi-period)`,
            electiveCode: `ELEC-${electiveType.substring(0,4).toUpperCase()}-${electiveNumber || 1}`,
            studentComposition: {
              total: studentEnrollment.total,
              fromAB: studentEnrollment.fromAB,
              fromCD: studentEnrollment.fromCD,
              distributionNote: `${studentEnrollment.total} students (${studentEnrollment.fromAB} from AB, ${studentEnrollment.fromCD} from CD)`
            },
            displayOptions: {
              showInBothSections: true,
              highlightAsElective: true,
              customDisplayText: `${subject.name} (Cross-section elective)`,
              isMultiPeriod: true
            },
            crossSectionMarker: true // Mark as cross-section elective
          },
          
          // Recurrence
          recurrence: {
            type: 'weekly',
            description: 'Weekly elective class (multi-period)'
          },
          
          // Display data
          display: {
            programCode: req.body.programCode || 'BCT',
            semester: parseInt(semester),
            section,
            subjectCode: subject.code,
            subjectName: subject.name,
            teacherNames: teachers.map(t => t.shortName).join(', '),
            roomName: room.name,
            classType
          },
          
          // Denormalized display fields
          subjectName_display: subject?.name || 'Unknown Subject',
          subjectCode_display: subject?.code || '',
          teacherShortNames_display: teachers.map(t => 
            t?.shortName || (t?.fullName ? t.fullName.split(' ').map(n => n[0]).join('.') : 'Unknown')
          ),
          roomName_display: room?.name || 'Unknown Room',
          timeSlot_display: timeSlot ? `${timeSlot.startTime} - ${timeSlot.endTime}` : '',
          
          notes: notes || '',
          isActive: true
        });

        electiveSlots.push(electiveSlot);
      }
    }

    // Save all elective slots
    if (session) {
      await RoutineSlot.insertMany(electiveSlots, { session });
    } else {
      await RoutineSlot.insertMany(electiveSlots);
    }

    // Commit transaction if session exists
    if (session) {
      try {
        await session.commitTransaction();
        console.log('Successfully committed transaction for spanned electives');
        session.endSession();
      } catch (commitError) {
        console.error('Error committing transaction:', commitError);
        try {
          await session.abortTransaction();
        } catch (abortError) {
          console.error('Error aborting transaction:', abortError);
        } finally {
          session.endSession();
        }
        throw new Error('Failed to commit transaction: ' + commitError.message);
      }
    }

    // Handle teacher schedule updates
    const affectedTeacherIds = teacherIds
      .filter(id => id != null && id !== undefined)
      .map(id => typeof id === 'object' && id._id ? id._id.toString() : id.toString());
    
    if (affectedTeacherIds.length > 0) {
      try {
        const { publishToQueue } = require('../services/queue.service');
        await publishToQueue(
          'teacher_routine_updates', 
          { affectedTeacherIds }
        );
        console.log(`[Queue] Queued schedule updates for teachers: ${affectedTeacherIds.join(', ')}`);
      } catch (queueServiceError) {
        console.warn('Queue service unavailable, skipping teacher schedule update queue:', queueServiceError.message);
      }
    }

    // Populate for response
    await Promise.all(electiveSlots.map(slot => 
      slot.populate([
        { path: 'programId', select: 'code name' },
        { path: 'subjectId', select: 'code name credits' },
        { path: 'teacherIds', select: 'shortName fullName' },
        { path: 'roomId', select: 'name roomNumber capacity' },
        { path: 'academicYearId', select: 'title nepaliYear' }
      ])
    ));

    res.status(201).json({
      success: true,
      message: `Multi-period elective class scheduled successfully across ${actualSlotIndexes.length} periods for both sections (AB and CD)`,
      data: {
        electiveSlots,
        spanId,
        slotCount: electiveSlots.length,
        periodsPerSection: actualSlotIndexes.length,
        electiveInfo: {
          semester: parseInt(semester),
          electiveNumber: electiveNumber || 1,
          electiveType: electiveType || 'TECHNICAL',
          sections: ['AB', 'CD'],
          subject: {
            id: subject._id,
            code: subject.code,
            name: subject.name
          },
          teachers: teachers.map(t => ({ id: t._id, name: t.fullName, shortName: t.shortName })),
          room: { id: room._id, name: room.name },
          timeSlots: actualSlotIndexes.map(slotIndex => ({ dayIndex, slotIndex }))
        }
      }
    });

  } catch (error) {
    // Abort transaction if session exists
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error('Error aborting transaction:', abortError);
      } finally {
        session.endSession();
      }
    }
    
    console.error('Error in scheduleElectiveClassSpanned:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
      requestBody: req.body
    });
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An elective class is already scheduled for one of these time slots'
      });
    }
    
    // Handle different error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    } else if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid ${error.path}: ${error.value}`
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get unified section routine (includes electives)
// @route   GET /api/routines/section/:programCode/:semester/:section
// @access  Private
exports.getUnifiedSectionRoutine = async (req, res) => {
  try {
    const { programCode, semester, section } = req.params;
    const { academicYearId } = req.query;

    // Get program
    const program = await Program.findOne({ code: programCode.toUpperCase() });
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }

    // Get academic year
    const academicYear = academicYearId 
      ? await AcademicCalendar.findById(academicYearId)
      : await AcademicCalendar.findOne({ isCurrentYear: true });

    if (!academicYear) {
      return res.status(404).json({
        success: false,
        message: 'Academic year not found'
      });
    }

    // Query for routine slots that should appear in this section's routine
    const routineQuery = {
      programId: program._id,
      semester: parseInt(semester),
      section: section.toUpperCase(),
      academicYearId: academicYear._id,
      isActive: true
    };

    const routineSlots = await RoutineSlot.find(routineQuery)
      .populate([
        { path: 'subjectId', select: 'code name credits isElective' },
        { path: 'teacherIds', select: 'shortName fullName' },
        { path: 'roomId', select: 'name roomNumber capacity' },
        { path: 'electiveGroupId', select: 'name code' }
      ])
      .sort({ dayIndex: 1, slotIndex: 1 });

    // Separate core and elective classes
    const coreClasses = routineSlots.filter(slot => slot.classCategory === 'CORE');
    const electiveClasses = routineSlots.filter(slot => slot.classCategory === 'ELECTIVE');

    // Format routine for display
    const formattedRoutine = formatUnifiedRoutineForDisplay(routineSlots, section);

    // Get elective summary
    const electiveSummary = electiveClasses.map(slot => ({
      electiveNumber: slot.electiveInfo?.electiveNumber,
      electiveType: slot.electiveInfo?.electiveType,
      subject: slot.subjectId?.name,
      subjectCode: slot.subjectId?.code,
      studentDistribution: slot.electiveInfo?.studentComposition?.distributionNote,
      timeSlot: {
        day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][slot.dayIndex],
        slotIndex: slot.slotIndex
      }
    }));

    res.json({
      success: true,
      data: {
        program: {
          code: program.code,
          name: program.name
        },
        semester: parseInt(semester),
        section: section.toUpperCase(),
        academicYear: {
          title: academicYear.title,
          nepaliYear: academicYear.nepaliYear
        },
        routine: formattedRoutine,
        summary: {
          totalSlots: routineSlots.length,
          coreClasses: coreClasses.length,
          electiveClasses: electiveClasses.length,
          electives: electiveSummary
        }
      }
    });

  } catch (error) {
    console.error('Error in getUnifiedSectionRoutine:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get elective conflicts for scheduling
// @route   POST /api/routines/electives/conflicts
// @access  Private/Admin
exports.checkElectiveConflicts = async (req, res) => {
  try {
    const {
      programId,
      semester,
      electiveSlots
    } = req.body;

    // Validate semester
    if (![7, 8].includes(parseInt(semester))) {
      return res.status(400).json({
        success: false,
        message: 'Elective conflict checking only for 7th and 8th semester'
      });
    }

    const allConflicts = [];

    // Check conflicts between multiple electives
    for (let i = 0; i < electiveSlots.length; i++) {
      for (let j = i + 1; j < electiveSlots.length; j++) {
        const elective1 = electiveSlots[i];
        const elective2 = electiveSlots[j];

        // Same time slot conflict
        if (elective1.dayIndex === elective2.dayIndex && 
            elective1.slotIndex === elective2.slotIndex) {
          allConflicts.push({
            type: 'ELECTIVE_TIME_CONFLICT',
            conflictBetween: [
              { electiveNumber: i + 1, subject: elective1.subjectName },
              { electiveNumber: j + 1, subject: elective2.subjectName }
            ],
            timeSlot: `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][elective1.dayIndex]} - Slot ${elective1.slotIndex}`,
            message: 'Two electives scheduled at same time'
          });
        }

        // Same teacher conflict
        if (elective1.teacherIds.some(t1 => elective2.teacherIds.includes(t1))) {
          allConflicts.push({
            type: 'ELECTIVE_TEACHER_CONFLICT',
            conflictBetween: [
              { electiveNumber: i + 1, subject: elective1.subjectName },
              { electiveNumber: j + 1, subject: elective2.subjectName }
            ],
            message: 'Same teacher assigned to multiple electives'
          });
        }

        // Same room at same time conflict
        if (elective1.dayIndex === elective2.dayIndex && 
            elective1.slotIndex === elective2.slotIndex &&
            elective1.roomId === elective2.roomId) {
          allConflicts.push({
            type: 'ELECTIVE_ROOM_CONFLICT',
            conflictBetween: [
              { electiveNumber: i + 1, subject: elective1.subjectName },
              { electiveNumber: j + 1, subject: elective2.subjectName }
            ],
            room: elective1.roomId,
            message: 'Same room assigned to multiple electives at same time'
          });
        }
      }

      // Check if elective conflicts with core subjects
      const coreConflicts = await RoutineSlot.find({
        programId,
        semester: parseInt(semester),
        dayIndex: electiveSlots[i].dayIndex,
        slotIndex: electiveSlots[i].slotIndex,
        classCategory: 'CORE',
        isActive: true
      }).populate('subjectId', 'name');

      if (coreConflicts.length > 0) {
        allConflicts.push({
          type: 'ELECTIVE_CORE_CONFLICT',
          elective: { electiveNumber: i + 1, subject: electiveSlots[i].subjectName },
          coreSubjects: coreConflicts.map(core => ({
            subject: core.subjectId.name,
            targetSections: core.targetSections
          })),
          message: 'Elective conflicts with core subject(s)'
        });
      }
    }

    res.json({
      success: true,
      data: {
        hasConflicts: allConflicts.length > 0,
        conflictCount: allConflicts.length,
        conflicts: allConflicts,
        recommendations: generateElectiveRecommendations(allConflicts)
      }
    });

  } catch (error) {
    console.error('Error in checkElectiveConflicts:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// Helper function to format unified routine for display
function formatUnifiedRoutineForDisplay(routineSlots, section) {
  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const routine = {};

  // Initialize empty days
  weekDays.forEach(day => {
    routine[day] = [];
  });

  // Fill in the routine slots
  routineSlots.forEach(slot => {
    const dayName = weekDays[slot.dayIndex];
    
    const routineEntry = {
      slotIndex: slot.slotIndex,
      subject: slot.subjectId?.name || 'Unknown Subject',
      subjectCode: slot.subjectId?.code || 'N/A',
      teacher: slot.teacherIds?.map(t => t.shortName).join(', ') || 'TBA',
      room: slot.roomId?.name || 'TBA',
      classType: slot.classType,
      category: slot.classCategory,
      
      // Elective-specific display
      ...(slot.isElectiveClass && {
        isElective: true,
        electiveType: slot.electiveInfo?.electiveType,
        electiveNumber: slot.electiveInfo?.electiveNumber,
        studentInfo: slot.electiveInfo?.studentComposition?.distributionNote || 'Mixed students',
        displayNote: slot.electiveInfo?.displayOptions?.customDisplayText || 'Elective class',
        highlight: slot.electiveInfo?.displayOptions?.highlightAsElective || false
      }),
      
      // Core-specific display
      ...(!slot.isElectiveClass && {
        isElective: false,
        studentInfo: `${section} section students`,
        displayNote: `Core subject for ${section}`,
        highlight: false
      })
    };
    
    routine[dayName].push(routineEntry);
  });

  // Sort each day's slots by time
  Object.keys(routine).forEach(day => {
    routine[day].sort((a, b) => a.slotIndex - b.slotIndex);
  });

  return routine;
}

// Helper function to generate elective recommendations
function generateElectiveRecommendations(conflicts) {
  const recommendations = [];
  
  if (conflicts.some(c => c.type === 'ELECTIVE_TIME_CONFLICT')) {
    recommendations.push('Consider scheduling electives at different time slots to avoid student conflicts');
  }
  
  if (conflicts.some(c => c.type === 'ELECTIVE_TEACHER_CONFLICT')) {
    recommendations.push('Assign different teachers to each elective or schedule at different times');
  }
  
  if (conflicts.some(c => c.type === 'ELECTIVE_ROOM_CONFLICT')) {
    recommendations.push('Assign different rooms to electives scheduled at the same time');
  }
  
  if (conflicts.some(c => c.type === 'ELECTIVE_CORE_CONFLICT')) {
    recommendations.push('Reschedule electives to avoid conflicts with core subjects');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('No conflicts detected - elective schedule looks good');
  }
  
  return recommendations;
};

// Helper function removed - now using dynamic sectionUtils.getLabGroupsForSection()

// Helper function to get section-appropriate lab group label
const getSectionLabGroupLabel_LOCAL = (labGroup, section) => {
  // Use the imported function from sectionUtils
  return getSectionLabGroupLabel(labGroup, section, { includeParentheses: false });
};

// @desc    Get room schedule/routine
// @route   GET /api/rooms/:roomId/schedule
// @access  Private
exports.getRoomSchedule = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { academicYear } = req.query;

    // Get current academic year if not provided
    const currentAcademicYear = academicYear ? 
      await AcademicCalendar.findById(academicYear) :
      await AcademicCalendar.findOne({ isCurrentYear: true });

    // Get room info
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // If no academic year found, return empty schedule instead of 404
    if (!currentAcademicYear) {
      console.log('No current academic year found, returning empty room schedule');
      return res.json({
        success: true,
        data: {
          roomId: room._id,
          roomName: room.name,
          building: room.building,
          programCode: 'ROOM_VIEW',
          semester: 'ALL',
          section: 'ALL',
          routine: {
            0: {}, 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}
          },
          message: 'No current academic year set. Please set an academic year to view schedules.'
        }
      });
    }

    // Get all routine slots for this room
    // Use the SAME approach as class routine - fetch ALL slots without academic year filtering
    // This ensures consistency with how class routines work
    const routineSlots = await RoutineSlot.find({
      roomId: roomId,
      isActive: true
      // NOTE: Removed academicYearId filter to match class routine logic
    })
    .populate('teacherIds', 'fullName shortName')
    .populate('subjectId', 'name code')
    .sort({ dayIndex: 1, slotIndex: 1 });

    // Build routine structure using the EXACT SAME logic as class routine
    const routine = {};
    
    // Initialize routine object for all days (0-6)
    for (let day = 0; day <= 6; day++) {
      routine[day] = {};
    }

    // Populate routine with classes using array-based approach for semester group coexistence
    // This ensures classes from different semester groups can coexist in the same time slot
    routineSlots.forEach(slot => {
      const slotData = {
        _id: slot._id,
        subjectId: slot.subjectId?._id,
        subjectName: slot.subjectName_display || slot.subjectId?.name,
        subjectCode: slot.subjectCode_display || slot.subjectId?.code,
        teacherIds: slot.teacherIds?.map(t => t._id),
        teacherNames: slot.teacherIds?.map(t => t.fullName) || [],
        teacherShortNames: slot.teacherShortNames_display || slot.teacherIds?.map(t => t.shortName) || [],
        roomId: slot.roomId,
        roomName: slot.roomName_display || room.name,
        classType: slot.classType,
        notes: slot.notes,
        timeSlot_display: slot.timeSlot_display,
        // Multi-period spanning information (same as class routine)
        spanId: slot.spanId,
        spanMaster: slot.spanMaster,
        // Program context
        programCode: slot.programCode,
        semester: slot.semester,
        section: slot.section,
        programSemesterSection: `${slot.programCode} Sem${slot.semester} ${slot.section}`,
        // Additional room context (same as class routine)
        classCategory: slot.classCategory || 'CORE',
        electiveInfo: slot.electiveInfo,
        labGroup: slot.labGroup,
        isElectiveClass: slot.isElectiveClass || false,
        isAlternativeWeek: slot.isAlternativeWeek,
        alternateGroupData: slot.alternateGroupData,
        // Add semester group for filtering
        semesterGroup: getSemesterGroupName(slot.semester)
      };

      // Handle multiple classes in the same time slot (for different semester groups)
      if (routine[slot.dayIndex][slot.slotIndex]) {
        // If slot already exists, convert to array or add to existing array
        const existing = routine[slot.dayIndex][slot.slotIndex];
        
        console.log(`🔄 Found duplicate room slot - Day ${slot.dayIndex}, Slot ${slot.slotIndex}`);
        console.log(`   Existing: semester=${existing.semester || existing[0]?.semester} (${existing.semesterGroup || existing[0]?.semesterGroup}), subject=${existing.subjectName || existing[0]?.subjectName}`);
        console.log(`   New: semester=${slotData.semester} (${slotData.semesterGroup}), subject=${slotData.subjectName}`);
        
        if (Array.isArray(existing)) {
          // Already an array, add new slot
          existing.push(slotData);
          console.log(`   Added to existing array, now has ${existing.length} items`);
        } else {
          // Convert single slot to array with both slots
          routine[slot.dayIndex][slot.slotIndex] = [existing, slotData];
          console.log(`   Converted to array with 2 items`);
        }
      } else {
        // First class for this time slot
        routine[slot.dayIndex][slot.slotIndex] = slotData;
      }
    });

    // Calculate room utilization statistics
    const stats = {
      totalClasses: routineSlots.length,
      busyDays: Object.keys(routine).filter(day => Object.keys(routine[day]).length > 0).length,
      programs: [...new Set(routineSlots.map(slot => slot.programCode))],
      semesters: [...new Set(routineSlots.map(slot => slot.semester))],
      sections: [...new Set(routineSlots.map(slot => slot.section))],
      classTypes: [...new Set(routineSlots.map(slot => slot.classType))],
      subjects: [...new Set(routineSlots.map(slot => slot.subjectCode_display || slot.subjectId?.code))],
      teachers: [...new Set(routineSlots.flatMap(slot => slot.teacherShortNames_display || slot.teacherIds?.map(t => t.shortName) || []))],
      // Room utilization rate (assuming 6 working days, 7 time slots per day)
      utilizationRate: Math.round((routineSlots.length / (6 * 7)) * 100),
      peakDay: getPeakUtilizationDay(routine),
      quietDay: getQuietUtilizationDay(routine)
    };

    console.log(`Room ${room.name} schedule generated with ${routineSlots.length} classes across ${stats.busyDays} days`);

    res.json({
      success: true,
      data: {
        room: {
          _id: room._id,
          name: room.name,
          type: room.type,
          capacity: room.capacity,
          building: room.building,
          floor: room.floor,
          equipment: room.equipment
        },
        routine,
        stats,
        academicYear: {
          _id: currentAcademicYear._id,
          year: currentAcademicYear.year,
          semester: currentAcademicYear.semester
        }
      },
      message: `Room schedule generated successfully for ${room.name}`
    });

  } catch (error) {
    console.error('Error in getRoomSchedule:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get vacant rooms for a specific day and time slot
// @route   GET /api/routines/rooms/vacant
// @access  Public
exports.getVacantRooms = async (req, res) => {
  try {
    const { dayIndex, slotIndex, academicYear, roomType, building, minCapacity } = req.query;

    // Validate required parameters
    if (dayIndex === undefined || slotIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: 'dayIndex and slotIndex are required'
      });
    }

    // Get current academic year if not provided
    let currentAcademicYear = academicYear ? 
      await AcademicCalendar.findById(academicYear) :
      await AcademicCalendar.findOne({ isCurrentYear: true });

    // Build query filter for routine slots
    const routineSlotFilter = {
      dayIndex: parseInt(dayIndex),
      slotIndex: parseInt(slotIndex),
      isActive: true
    };

    // Add academic year filter only if available
    if (currentAcademicYear) {
      routineSlotFilter.academicYearId = currentAcademicYear._id;
    } else {
      console.log('⚠️  No academic year found, fetching all routine slots without year filtering');
    }

    // Build room filter criteria
    const roomFilter = { isActive: true };
    if (roomType) roomFilter.type = roomType;
    if (building) roomFilter.building = building;
    if (minCapacity) roomFilter.capacity = { $gte: parseInt(minCapacity) };

    // Get all rooms matching criteria
    const allRooms = await Room.find(roomFilter).sort({ building: 1, name: 1 });

    // Get rooms that are occupied at this time slot
    const occupiedRooms = await RoutineSlot.find(routineSlotFilter)
    .populate('subjectId', 'name code')
    .populate('teacherIds', 'fullName shortName')
    .select('roomId programCode semester section subjectName_display classType');

    // Create map of occupied room IDs with their details
    const occupiedRoomMap = new Map();
    occupiedRooms.forEach(slot => {
      occupiedRoomMap.set(slot.roomId.toString(), {
        programCode: slot.programCode,
        semester: slot.semester,
        section: slot.section,
        subjectName: slot.subjectName_display || slot.subjectId?.name,
        classType: slot.classType,
        teacherIds: slot.teacherIds?.map(t => t._id),
        teacherNames: slot.teacherIds?.map(t => t.fullName) || []
      });
    });

    // Separate vacant and occupied rooms
    const vacantRooms = [];
    const occupiedRoomDetails = [];

    allRooms.forEach(room => {
      const roomIdStr = room._id.toString();
      if (occupiedRoomMap.has(roomIdStr)) {
        // Room is occupied
        const occupancyDetails = occupiedRoomMap.get(roomIdStr);
        occupiedRoomDetails.push({
          room: {
            _id: room._id,
            name: room.name,
            type: room.type,
            capacity: room.capacity,
            building: room.building,
            floor: room.floor
          },
          occupiedBy: occupancyDetails
        });
      } else {
        // Room is vacant
        vacantRooms.push({
          _id: room._id,
          name: room.name,
          type: room.type,
          capacity: room.capacity,
          building: room.building,
          floor: room.floor,
          equipment: room.equipment
        });
      }
    });

    // Get time slot info for display
    const timeSlot = await TimeSlot.findOne({ slotIndex: parseInt(slotIndex) });
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    res.json({
      success: true,
      data: {
        queryInfo: {
          day: dayNames[parseInt(dayIndex)],
          dayIndex: parseInt(dayIndex),
          slotIndex: parseInt(slotIndex),
          timeSlot: timeSlot ? `${timeSlot.startTime} - ${timeSlot.endTime}` : `Slot ${slotIndex}`,
          academicYear: currentAcademicYear ? currentAcademicYear.year : 'All Years',
          filters: {
            roomType: roomType || 'All',
            building: building || 'All',
            minCapacity: minCapacity || 0
          }
        },
        vacantRooms,
        occupiedRooms: occupiedRoomDetails,
        summary: {
          totalRooms: allRooms.length,
          vacantCount: vacantRooms.length,
          occupiedCount: occupiedRoomDetails.length,
          vacancyRate: Math.round((vacantRooms.length / allRooms.length) * 100)
        }
      },
      message: `Found ${vacantRooms.length} vacant rooms out of ${allRooms.length} total rooms`
    });
  } catch (error) {
    console.error('Error in getVacantRooms:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get room vacancy status for an entire day
// @route   GET /api/routines/rooms/vacant/day
// @access  Public
exports.getRoomVacancyForDay = async (req, res) => {
  try {
    const { dayIndex, academicYear, roomType, building, minCapacity } = req.query;

    // Validate required parameters
    if (dayIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: 'dayIndex is required'
      });
    }

    // Get current academic year if not provided
    let currentAcademicYear = academicYear ? 
      await AcademicCalendar.findById(academicYear) :
      await AcademicCalendar.findOne({ isCurrentYear: true });

    // Build query filter for routine slots
    const routineSlotFilter = {
      dayIndex: parseInt(dayIndex),
      isActive: true
    };

    // Add academic year filter only if available
    if (currentAcademicYear) {
      routineSlotFilter.academicYearId = currentAcademicYear._id;
    } else {
      console.log('⚠️  No academic year found, fetching all routine slots without year filtering');
    }

    // Build room filter criteria
    const roomFilter = { isActive: true };
    if (roomType) roomFilter.type = roomType;
    if (building) roomFilter.building = building;
    if (minCapacity) roomFilter.capacity = { $gte: parseInt(minCapacity) };

    // Get all rooms matching criteria
    const allRooms = await Room.find(roomFilter).sort({ building: 1, name: 1 });

    // Get all time slots
    const timeSlots = await getTimeSlotsSorted();

    // Get all routine slots for this day
    const dayRoutineSlots = await RoutineSlot.find(routineSlotFilter)
    .populate('subjectId', 'name code')
    .populate('teacherIds', 'fullName shortName')
    .select('roomId slotIndex programCode semester section subjectName_display classType');

    // Build occupancy map: roomId -> { slotIndex: occupancyDetails }
    const roomOccupancyMap = new Map();
    
    dayRoutineSlots.forEach(slot => {
      const roomIdStr = slot.roomId.toString();
      if (!roomOccupancyMap.has(roomIdStr)) {
        roomOccupancyMap.set(roomIdStr, {});
      }
      
      roomOccupancyMap.get(roomIdStr)[slot.slotIndex] = {
        programCode: slot.programCode,
        semester: slot.semester,
        section: slot.section,
        subjectName: slot.subjectName_display || slot.subjectId?.name,
        classType: slot.classType,
        teacherNames: slot.teacherIds?.map(t => t.fullName) || []
      };
    });

    // Build response data
    const roomVacancyData = allRooms.map(room => {
      const roomIdStr = room._id.toString();
      const roomSchedule = roomOccupancyMap.get(roomIdStr) || {};
      
      // Calculate vacancy stats for this room
      const occupiedSlots = Object.keys(roomSchedule).length;
      const totalSlots = timeSlots.length;
      const vacantSlots = totalSlots - occupiedSlots;
      const utilizationRate = Math.round((occupiedSlots / totalSlots) * 100);

      // Build slot-by-slot vacancy status
      const slotStatus = {};
      timeSlots.forEach(timeSlot => {
        const slotIndex = timeSlot._id; // TimeSlot uses _id as slotIndex
        const isOccupied = roomSchedule.hasOwnProperty(slotIndex);
        slotStatus[slotIndex] = {
          timeSlot: `${timeSlot.startTime} - ${timeSlot.endTime}`,
          isVacant: !isOccupied,
          occupiedBy: isOccupied ? roomSchedule[slotIndex] : null
        };
      });

      return {
        room: {
          _id: room._id,
          name: room.name,
          type: room.type,
          capacity: room.capacity,
          building: room.building,
          floor: room.floor,
          equipment: room.equipment
        },
        vacancyStats: {
          totalSlots,
          occupiedSlots,
          vacantSlots,
          utilizationRate,
          isCompletelyFree: occupiedSlots === 0,
          isCompletelyOccupied: occupiedSlots === totalSlots
        },
        slotStatus
      };
    });

    // Calculate overall statistics
    const totalRooms = allRooms.length;
    const totalSlots = timeSlots.length;
    const totalPossibleSlots = totalRooms * totalSlots;
    const totalOccupiedSlots = dayRoutineSlots.length;
    const totalVacantSlots = totalPossibleSlots - totalOccupiedSlots;
    const overallUtilizationRate = Math.round((totalOccupiedSlots / totalPossibleSlots) * 100);
    
    const completelyFreeRooms = roomVacancyData.filter(r => r.vacancyStats.isCompletelyFree).length;
    const completelyOccupiedRooms = roomVacancyData.filter(r => r.vacancyStats.isCompletelyOccupied).length;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    res.json({
      success: true,
      data: {
        queryInfo: {
          day: dayNames[parseInt(dayIndex)],
          dayIndex: parseInt(dayIndex),
          academicYear: currentAcademicYear ? currentAcademicYear.year : 'All Years',
          totalTimeSlots: totalSlots,
          filters: {
            roomType: roomType || 'All',
            building: building || 'All',
            minCapacity: minCapacity || 0
          }
        },
        roomVacancyData,
        overallStats: {
          totalRooms,
          totalSlots,
          totalPossibleSlots,
          totalOccupiedSlots,
          totalVacantSlots,
          overallUtilizationRate,
          completelyFreeRooms,
          completelyOccupiedRooms,
          partiallyOccupiedRooms: totalRooms - completelyFreeRooms - completelyOccupiedRooms
        },
        timeSlots: timeSlots.map(ts => ({
          slotIndex: ts._id, // TimeSlot uses _id as slotIndex
          timeSlot: `${ts.startTime} - ${ts.endTime}`
        }))
      },
      message: `Room vacancy analysis for ${dayNames[parseInt(dayIndex)]} completed`
    });

  } catch (error) {
    console.error('Error in getRoomVacancyForDay:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get rooms with highest vacancy rates
// @route   GET /api/routines/rooms/vacant/analytics
// @access  Public
exports.getRoomVacancyAnalytics = async (req, res) => {
  try {
    const { academicYear, roomType, building, minCapacity, sortBy = 'vacancy' } = req.query;

    // Get current academic year if not provided
    let currentAcademicYear = academicYear ? 
      await AcademicCalendar.findById(academicYear) :
      await AcademicCalendar.findOne({ isCurrentYear: true });

    // Build query filter for routine slots
    const routineSlotFilter = { isActive: true };

    // Add academic year filter only if available
    if (currentAcademicYear) {
      routineSlotFilter.academicYearId = currentAcademicYear._id;
    } else {
      console.log('⚠️  No academic year found, fetching all routine slots without year filtering');
    }

    // Build room filter criteria
    const roomFilter = { isActive: true };
    if (roomType) roomFilter.type = roomType;
    if (building) roomFilter.building = building;
    if (minCapacity) roomFilter.capacity = { $gte: parseInt(minCapacity) };

    // Get all rooms matching criteria
    const allRooms = await Room.find(roomFilter);

    // Get total possible slots (6 working days × number of time slots)
    const timeSlots = await TimeSlot.find({});
    const workingDays = 6; // Sunday to Friday
    const totalSlotsPerWeek = workingDays * timeSlots.length;

    // Get all routine slots
    const allRoutineSlots = await RoutineSlot.find(routineSlotFilter);

    // Calculate vacancy analytics for each room
    const roomAnalytics = allRooms.map(room => {
      const roomIdStr = room._id.toString();
      const roomSlots = allRoutineSlots.filter(slot => slot.roomId.toString() === roomIdStr);
      
      const occupiedSlots = roomSlots.length;
      const vacantSlots = totalSlotsPerWeek - occupiedSlots;
      const utilizationRate = Math.round((occupiedSlots / totalSlotsPerWeek) * 100);
      const vacancyRate = 100 - utilizationRate;

      // Calculate day-wise distribution
      const dayDistribution = {};
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      for (let day = 0; day <= 5; day++) { // Only working days
        const daySlots = roomSlots.filter(slot => slot.dayIndex === day);
        dayDistribution[dayNames[day]] = {
          occupiedSlots: daySlots.length,
          vacantSlots: timeSlots.length - daySlots.length,
          utilizationRate: Math.round((daySlots.length / timeSlots.length) * 100)
        };
      }

      // Find peak and quiet days
      const peakDay = Object.entries(dayDistribution).reduce((max, [day, data]) => 
        data.occupiedSlots > max.occupiedSlots ? { day, ...data } : max, 
        { day: 'Sunday', occupiedSlots: 0 });
      
      const quietDay = Object.entries(dayDistribution).reduce((min, [day, data]) => 
        data.occupiedSlots < min.occupiedSlots ? { day, ...data } : min, 
        { day: 'Sunday', occupiedSlots: Infinity });

      return {
        room: {
          _id: room._id,
          name: room.name,
          type: room.type,
          capacity: room.capacity,
          building: room.building,
          floor: room.floor,
          equipment: room.equipment
        },
        vacancyStats: {
          totalPossibleSlots: totalSlotsPerWeek,
          occupiedSlots,
          vacantSlots,
          utilizationRate,
          vacancyRate,
          peakDay,
          quietDay
        },
        dayDistribution
      };
    });

    // Sort rooms based on sortBy parameter
    let sortedRooms;
    switch (sortBy) {
      case 'vacancy':
        sortedRooms = roomAnalytics.sort((a, b) => b.vacancyStats.vacancyRate - a.vacancyStats.vacancyRate);
        break;
      case 'utilization':
        sortedRooms = roomAnalytics.sort((a, b) => b.vacancyStats.utilizationRate - a.vacancyStats.utilizationRate);
        break;
      case 'capacity':
        sortedRooms = roomAnalytics.sort((a, b) => b.room.capacity - a.room.capacity);
        break;
      case 'name':
        sortedRooms = roomAnalytics.sort((a, b) => a.room.name.localeCompare(b.room.name));
        break;
      default:
        sortedRooms = roomAnalytics.sort((a, b) => b.vacancyStats.vacancyRate - a.vacancyStats.vacancyRate);
    }

    // Calculate overall statistics
    const totalRooms = allRooms.length;
    const totalPossibleSlots = totalRooms * totalSlotsPerWeek;
    const totalOccupiedSlots = allRoutineSlots.length;
    const totalVacantSlots = totalPossibleSlots - totalOccupiedSlots;
    const overallUtilizationRate = Math.round((totalOccupiedSlots / totalPossibleSlots) * 100);
    const overallVacancyRate = 100 - overallUtilizationRate;

    // Find rooms with extreme vacancy rates
    const mostVacantRooms = sortedRooms.slice(0, 5);
    const mostUtilizedRooms = sortedRooms.slice(-5).reverse();
    const completelyVacantRooms = sortedRooms.filter(r => r.vacancyStats.occupiedSlots === 0);
    const fullyUtilizedRooms = sortedRooms.filter(r => r.vacancyStats.vacancyRate === 0);

    res.json({
      success: true,
      data: {
        queryInfo: {
          academicYear: currentAcademicYear ? currentAcademicYear.year : 'All Years',
          totalWorkingDays: workingDays,
          totalTimeSlotsPerDay: timeSlots.length,
          sortBy,
          filters: {
            roomType: roomType || 'All',
            building: building || 'All',
            minCapacity: minCapacity || 0
          }
        },
        roomAnalytics: sortedRooms,
        overallStats: {
          totalRooms,
          totalPossibleSlots,
          totalOccupiedSlots,
          totalVacantSlots,
          overallUtilizationRate,
          overallVacancyRate
        },
        insights: {
          mostVacantRooms: mostVacantRooms.map(r => ({
            name: r.room.name,
            vacancyRate: r.vacancyStats.vacancyRate,
            building: r.room.building,
            type: r.room.type
          })),
          mostUtilizedRooms: mostUtilizedRooms.map(r => ({
            name: r.room.name,
            utilizationRate: r.vacancyStats.utilizationRate,
            building: r.room.building,
            type: r.room.type
          })),
          completelyVacantRooms: completelyVacantRooms.length,
          fullyUtilizedRooms: fullyUtilizedRooms.length
        }
      },
      message: `Room vacancy analytics generated for ${totalRooms} rooms`
    });

  } catch (error) {
    console.error('Error in getRoomVacancyAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// Helper function to find peak utilization day for room
function getPeakUtilizationDay(routine) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let maxClasses = 0;
  let peakDay = 'Sunday';

  Object.keys(routine).forEach(dayIndex => {
    const classCount = Object.keys(routine[dayIndex]).length;
    if (classCount > maxClasses) {
      maxClasses = classCount;
      peakDay = dayNames[dayIndex];
    }
  });

  return { day: peakDay, classCount: maxClasses };
}

// Helper function to find quietest day for room
function getQuietUtilizationDay(routine) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let minClasses = Infinity;
  let quietDay = 'Sunday';

  Object.keys(routine).forEach(dayIndex => {
    const classCount = Object.keys(routine[dayIndex]).length;
    if (classCount < minClasses) {
      minClasses = classCount;
      quietDay = dayNames[dayIndex];
    }
  });

  return { day: quietDay, classCount: minClasses === Infinity ? 0 : minClasses };
}

// @desc    Get vacant teachers for a specific day and time slot
// @route   GET /api/routines/teachers/vacant
// @access  Public
exports.getVacantTeachers = async (req, res) => {
  try {
    const { dayIndex, slotIndex, academicYear, department, designation } = req.query;

    // Validate required parameters
    if (dayIndex === undefined || slotIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: 'dayIndex and slotIndex are required'
      });
    }

    // Get current academic year if not provided
    let currentAcademicYear = academicYear ? 
      await AcademicCalendar.findById(academicYear) :
      await AcademicCalendar.findOne({ isCurrentYear: true });

    // Build query filter for routine slots
    const routineSlotFilter = {
      dayIndex: parseInt(dayIndex),
      slotIndex: parseInt(slotIndex),
      isActive: true
    };

    // Add academic year filter only if available
    if (currentAcademicYear) {
      routineSlotFilter.academicYearId = currentAcademicYear._id;
    } else {
      console.log('⚠️  No academic year found, fetching all routine slots without year filtering');
    }

    // Build teacher filter criteria
    const teacherFilter = { isActive: true };
    if (department) teacherFilter.departmentId = department;
    if (designation) teacherFilter.designation = designation;

    // Get all teachers matching criteria
    const allTeachers = await Teacher.find(teacherFilter)
      .populate('departmentId', 'name code')
      .sort({ fullName: 1 });

    // Get teachers that are occupied at this time slot
    const occupiedTeachers = await RoutineSlot.find(routineSlotFilter)
      .populate('subjectId', 'name code')
      .populate('teacherIds', 'fullName shortName email')
      .select('teacherIds programCode semester section subjectName_display classType roomId');

    // Create map of occupied teacher IDs with their details
    const occupiedTeacherMap = new Map();
    occupiedTeachers.forEach(slot => {
      slot.teacherIds.forEach(teacher => {
        occupiedTeacherMap.set(teacher._id.toString(), {
          programCode: slot.programCode,
          semester: slot.semester,
          section: slot.section,
          subjectName: slot.subjectName_display || slot.subjectId?.name,
          classType: slot.classType,
          roomId: slot.roomId
        });
      });
    });

    // Separate vacant and occupied teachers
    const vacantTeachers = [];
    const occupiedTeacherDetails = [];

    allTeachers.forEach(teacher => {
      const teacherIdStr = teacher._id.toString();
      const occupiedDetails = occupiedTeacherMap.get(teacherIdStr);
      
      if (occupiedDetails) {
        occupiedTeacherDetails.push({
          ...teacher.toObject(),
          occupiedDetails
        });
      } else {
        vacantTeachers.push(teacher);
      }
    });

    // Get time slot details
    const timeSlot = await TimeSlot.findOne({ _id: parseInt(slotIndex) });
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    res.json({
      success: true,
      data: {
        vacantTeachers,
        occupiedTeacherDetails,
        queryInfo: {
          day: dayNames[parseInt(dayIndex)],
          dayIndex: parseInt(dayIndex),
          slotIndex: parseInt(slotIndex),
          timeSlot: timeSlot ? `${timeSlot.startTime} - ${timeSlot.endTime}` : 'Unknown',
          academicYear: currentAcademicYear ? currentAcademicYear.year : 'All Years',
          filters: {
            department: department || 'All',
            designation: designation || 'All'
          }
        },
        summary: {
          totalTeachers: allTeachers.length,
          vacantCount: vacantTeachers.length,
          occupiedCount: occupiedTeacherDetails.length,
          utilizationRate: Math.round((occupiedTeacherDetails.length / allTeachers.length) * 100)
        }
      },
      message: `Found ${vacantTeachers.length} vacant teachers out of ${allTeachers.length} total teachers`
    });

  } catch (error) {
    console.error('Error in getVacantTeachers:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// =====================================
// PDF EXPORT METHODS (using working PDFRoutineService)
// =====================================

/**
 * Export teacher schedule to PDF
 * @route GET /routines/teacher/:teacherId/export-pdf
 */
exports.exportTeacherScheduleToPDF = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { academicYear, semesterGroup = 'all', startDate, endDate, authorityName, designation } = req.query; // Add authority parameters

    if (!teacherId) {
      return res.status(400).json({
        success: false,
        message: 'Teacher ID is required'
      });
    }

    console.log(`📄 Generating teacher schedule PDF for: ${teacherId} (${semesterGroup} semester group)${startDate && endDate ? ` (${startDate} to ${endDate})` : ''}${authorityName ? ` Authority: ${authorityName}` : ''}`);

    // Get teacher information
    const teacher = await Teacher.findById(teacherId);
    
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    // Use the working PDFRoutineService (same as class routine)
    const PDFRoutineService = require('../services/PDFRoutineService');
    const pdfService = new PDFRoutineService();
    const pdfBuffer = await pdfService.generateTeacherSchedulePDF(teacherId, teacher.fullName, semesterGroup, { 
      startDate, 
      endDate, 
      authorityName, 
      designation 
    }); // Pass all additional data

    // Set response headers
    const fileName = `${teacher.fullName.replace(/[^a-zA-Z0-9]/g, '_')}_Schedule_${new Date().toISOString().split('T')[0]}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

    console.log(`✅ Teacher schedule PDF generated: ${fileName}`);

  } catch (error) {
    console.error('❌ Teacher schedule PDF generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate teacher schedule PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Export all teachers schedules to PDF
 * @route GET /routines/teachers/export-pdf
 */
exports.exportAllTeachersSchedulesToPDF = async (req, res) => {
  try {
    const { academicYear, semesterGroup = 'all' } = req.query;

    console.log('📄 Generating all teachers schedules PDF with semester group:', semesterGroup);

    // Use the working PDFRoutineService (same as class routine)
    const PDFRoutineService = require('../services/PDFRoutineService');
    const pdfService = new PDFRoutineService();
    const pdfBuffer = await pdfService.generateAllTeachersSchedulesPDF(semesterGroup);

    // Set response headers
    const groupSuffix = semesterGroup && semesterGroup !== 'all' ? `_${semesterGroup.toUpperCase()}` : '';
    const fileName = `All_Teachers_Schedules${groupSuffix}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

    console.log(`✅ All teachers schedules PDF generated: ${fileName}`);

  } catch (error) {
    console.error('❌ All teachers schedules PDF generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate all teachers schedules PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Export room schedule to PDF
 * @route GET /routines/room/:roomId/export-pdf
 */
exports.exportRoomScheduleToPDF = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { academicYear, semesterGroup, startDate, endDate } = req.query; // Add startDate and endDate

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: 'Room ID is required'
      });
    }

    console.log(`📄 Generating room schedule PDF for: ${roomId}, semesterGroup: ${semesterGroup || 'all'}${startDate && endDate ? ` (${startDate} to ${endDate})` : ''}`);

    // Get room information
    const room = await Room.findById(roomId);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Use the working PDFRoutineService (same as class routine)
    const PDFRoutineService = require('../services/PDFRoutineService');
    const pdfService = new PDFRoutineService();
    const pdfBuffer = await pdfService.generateRoomSchedulePDF(roomId, room.name, semesterGroup || 'all', { startDate, endDate }); // Pass dates

    // Set response headers
    const fileName = `${room.name.replace(/[^a-zA-Z0-9]/g, '_')}_Schedule_${new Date().toISOString().split('T')[0]}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

    console.log(`✅ Room schedule PDF generated: ${fileName}`);

  } catch (error) {
    console.error('❌ Room schedule PDF generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate room schedule PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Export all room schedules to PDF
 * @route GET /routines/rooms/export-pdf
 */
exports.exportAllRoomSchedulesToPDF = async (req, res) => {
  try {
    const { academicYear, semesterGroup } = req.query;

    console.log(`📄 Generating all room schedules PDF, semesterGroup: ${semesterGroup || 'all'}`);

    // Use the working PDFRoutineService (same as class routine)
    const PDFRoutineService = require('../services/PDFRoutineService');
    const pdfService = new PDFRoutineService();
    const pdfBuffer = await pdfService.generateAllRoomsSchedulePDF(semesterGroup || 'all');

    // Set response headers
    const fileName = `All_Rooms_Schedules_${new Date().toISOString().split('T')[0]}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

    console.log(`✅ All room schedules PDF generated: ${fileName}`);

  } catch (error) {
    console.error('❌ All room schedules PDF generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate all room schedules PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
