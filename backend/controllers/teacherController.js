const Teacher = require('../models/Teacher');
const Department = require('../models/Department');
const RoutineSlot = require('../models/RoutineSlot');
const { validationResult } = require('express-validator');

// @desc    Create a new teacher
// @route   POST /api/teachers
// @access  Private/Admin
exports.createTeacher = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Validate department exists
    if (req.body.departmentId) {
      const department = await Department.findOne({
        _id: req.body.departmentId,
        isActive: true
      });
      
      if (!department) {
        return res.status(400).json({ 
          msg: 'Department not found or inactive' 
        });
      }
    }

    const teacher = new Teacher(req.body);
    await teacher.save();
    
    // Populate department for response
    await teacher.populate('departmentId', 'code name');
    
    res.status(201).json(teacher);
  } catch (err) {
    console.error(err.message);
    if (err.code === 11000) {
      if (err.keyPattern?.email) {
        return res.status(400).json({ msg: 'Teacher with this email already exists' });
      }
      if (err.keyPattern?.shortName) {
        return res.status(400).json({ msg: 'Teacher with this short name already exists in the department' });
      }
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Create multiple teachers in bulk
// @route   POST /api/teachers/bulk
// @access  Private/Admin
exports.createTeachersBulk = async (req, res) => {
  try {
    let teachersData;
    
    // Handle both direct array and wrapped formats
    if (Array.isArray(req.body)) {
      teachersData = req.body;
    } else if (req.body.teachers && Array.isArray(req.body.teachers)) {
      teachersData = req.body.teachers;
    } else {
      return res.status(400).json({
        success: false,
        msg: 'Request body must be an array of teachers or an object with "teachers" property containing an array'
      });
    }

    if (teachersData.length === 0) {
      return res.status(400).json({
        success: false,
        msg: 'No teachers provided for creation'
      });
    }

    // Validate and prepare teachers
    const validationErrors = [];
    const validTeachers = [];

    for (let i = 0; i < teachersData.length; i++) {
      const teacher = teachersData[i];
      const teacherIndex = i + 1;

      // Basic required field validation
      if (!teacher.fullName) {
        validationErrors.push(`Teacher ${teacherIndex}: fullName is required`);
      }
      if (!teacher.email) {
        validationErrors.push(`Teacher ${teacherIndex}: email is required`);
      }
      if (!teacher.departmentId) {
        validationErrors.push(`Teacher ${teacherIndex}: departmentId is required`);
      }

      // Validate email format
      if (teacher.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacher.email)) {
        validationErrors.push(`Teacher ${teacherIndex}: invalid email format`);
      }

      // Validate department exists
      if (teacher.departmentId) {
        const department = await Department.findOne({
          _id: teacher.departmentId,
          isActive: true
        });
        
        if (!department) {
          validationErrors.push(`Teacher ${teacherIndex}: department not found or inactive`);
        }
      }

      if (validationErrors.length === 0 || validationErrors.filter(err => err.startsWith(`Teacher ${teacherIndex}:`)).length === 0) {
        validTeachers.push(teacher);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        msg: 'Validation errors',
        errors: validationErrors
      });
    }

    // Create teachers
    const createdTeachers = [];
    const errors = [];

    for (let i = 0; i < validTeachers.length; i++) {
      try {
        const teacher = new Teacher(validTeachers[i]);
        const savedTeacher = await teacher.save();
        await savedTeacher.populate('departmentId', 'code name');
        createdTeachers.push(savedTeacher);
      } catch (err) {
        let errorMsg = `Teacher ${i + 1}: `;
        if (err.code === 11000) {
          if (err.keyPattern?.email) {
            errorMsg += 'email already exists';
          } else if (err.keyPattern?.shortName) {
            errorMsg += 'short name already exists in department';
          } else {
            errorMsg += 'duplicate key error';
          }
        } else {
          errorMsg += err.message;
        }
        errors.push(errorMsg);
      }
    }

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdTeachers.length} teachers${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
      insertedCount: createdTeachers.length,
      teachers: createdTeachers,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error('Bulk teacher creation error:', err);
    res.status(500).json({
      success: false,
      error: {
        message: 'Server error during bulk teacher creation',
        details: err.message
      }
    });
  }
};

// @desc    Get all teachers
// @route   GET /api/teachers
// @access  Private
exports.getTeachers = async (req, res) => {
  try {
    const { departmentId, isActive, designation, isFullTime } = req.query;
    const filter = {};
    
    if (departmentId) filter.departmentId = departmentId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (designation) filter.designation = designation;
    if (isFullTime !== undefined) filter.isFullTime = isFullTime === 'true';

    const teachers = await Teacher.find(filter)
      .populate('departmentId', 'code name')
      .populate('specializations', 'code name')
      .sort({ departmentId: 1, shortName: 1 });
      
    res.json(teachers);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get teacher by ID
// @route   GET /api/teachers/:id
// @access  Private
exports.getTeacherById = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id)
      .populate('departmentId', 'code name fullName')
      .populate('specializations', 'code name credits')
      .populate('userId', 'email role');
    
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    res.json(teacher);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Teacher not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Update teacher
// @route   PUT /api/teachers/:id
// @access  Private/Admin
exports.updateTeacher = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let teacher = await Teacher.findById(req.params.id);
    
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Validate department if updating
    if (req.body.departmentId) {
      const department = await Department.findOne({
        _id: req.body.departmentId,
        isActive: true
      });
      
      if (!department) {
        return res.status(400).json({ 
          msg: 'Department not found or inactive' 
        });
      }
    }

    teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('departmentId', 'code name')
     .populate('specializations', 'code name');

    res.json(teacher);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Teacher not found' });
    }
    if (err.code === 11000) {
      if (err.keyPattern?.email) {
        return res.status(400).json({ msg: 'Teacher with this email already exists' });
      }
      if (err.keyPattern?.shortName) {
        return res.status(400).json({ msg: 'Teacher with this short name already exists in the department' });
      }
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Delete teacher (soft delete)
// @route   DELETE /api/teachers/:id
// @access  Private/Admin
exports.deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Check if teacher is referenced in active routine slots
    const RoutineSlot = require('../models/RoutineSlot');
    const activeSlots = await RoutineSlot.countDocuments({
      teacherIds: teacher._id,
      isActive: true
    });

    if (activeSlots > 0) {
      return res.status(400).json({ 
        msg: `Cannot delete teacher. They are assigned to ${activeSlots} active routine slots.` 
      });
    }

    // Check if teacher is a department head
    const Department = require('../models/Department');
    const isDeptHead = await Department.findOne({ headId: teacher._id });
    
    if (isDeptHead) {
      return res.status(400).json({ 
        msg: 'Cannot delete teacher who is a department head. Please assign a new head first.' 
      });
    }

    // Soft delete
    teacher.isActive = false;
    await teacher.save();

    res.json({ msg: 'Teacher deactivated successfully' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Teacher not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Bulk delete teachers by IDs
// @route   DELETE /api/teachers/bulk
// @access  Private/Admin
exports.deleteTeachersBulk = async (req, res) => {
  try {
    // Handle both formats: direct array or wrapped in "teacherIds" property
    let teacherIds;
    
    if (Array.isArray(req.body)) {
      // Direct array format: [id1, id2, ...]
      teacherIds = req.body;
    } else if (req.body.teacherIds && Array.isArray(req.body.teacherIds)) {
      // Wrapped format: {"teacherIds": [id1, id2, ...]}
      teacherIds = req.body.teacherIds;
    } else {
      return res.status(400).json({ 
        success: false,
        msg: 'Request body must be an array of teacher IDs or an object with "teacherIds" array property' 
      });
    }

    // Validate minimum requirements
    if (teacherIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        msg: 'At least one teacher ID is required' 
      });
    }

    // Validate each ID is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    const invalidIds = [];
    teacherIds.forEach((id, index) => {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        invalidIds.push(`Index ${index}: "${id}" is not a valid MongoDB ObjectId`);
      }
    });

    if (invalidIds.length > 0) {
      return res.status(400).json({ 
        success: false,
        msg: 'Invalid teacher IDs',
        errors: invalidIds 
      });
    }

    // Check which teachers exist before deletion
    const existingTeachers = await Teacher.find({ _id: { $in: teacherIds } });
    const existingIds = existingTeachers.map(teacher => teacher._id.toString());
    const notFoundIds = teacherIds.filter(id => !existingIds.includes(id));

    if (existingTeachers.length === 0) {
      return res.status(404).json({
        success: false,
        msg: 'No teachers found with the provided IDs',
        notFoundIds: notFoundIds
      });
    }

    // Check for constraints before deletion
    const constraintErrors = [];
    const deleteableTeachers = [];
    const skippedTeachers = [];

    for (const teacher of existingTeachers) {
      // Check if teacher is referenced in active routine slots
      const activeSlots = await RoutineSlot.countDocuments({
        teacherIds: teacher._id,
        isActive: true
      });

      // Check if teacher is a department head
      const isDeptHead = await Department.findOne({ headId: teacher._id });

      if (activeSlots > 0) {
        skippedTeachers.push({
          id: teacher._id,
          name: teacher.fullName,
          reason: `Assigned to ${activeSlots} active routine slots`
        });
      } else if (isDeptHead) {
        skippedTeachers.push({
          id: teacher._id,
          name: teacher.fullName,
          reason: 'Is a department head'
        });
      } else {
        deleteableTeachers.push(teacher);
      }
    }

    // Perform soft delete (set isActive to false) for deleteable teachers
    const deleteableIds = deleteableTeachers.map(t => t._id);
    let deleteResult = { modifiedCount: 0 };
    
    if (deleteableIds.length > 0) {
      deleteResult = await Teacher.updateMany(
        { _id: { $in: deleteableIds } },
        { $set: { isActive: false } }
      );
    }

    res.status(200).json({
      success: true,
      message: `Successfully deactivated ${deleteResult.modifiedCount} teachers, ${skippedTeachers.length} skipped due to constraints`,
      deactivatedCount: deleteResult.modifiedCount,
      deactivatedTeachers: deleteableTeachers.map(t => ({ 
        id: t._id, 
        name: t.fullName, 
        email: t.email 
      })),
      skippedTeachers: skippedTeachers,
      notFoundIds: notFoundIds,
      notFoundCount: notFoundIds.length
    });

  } catch (err) {
    console.error('Bulk teacher deletion error:', err);
    res.status(500).json({
      success: false,
      msg: 'Server error during bulk deletion',
      error: err.message
    });
  }
};

// @desc    Delete teachers by department ID
// @route   DELETE /api/teachers/department/:departmentId
// @access  Private/Admin
exports.deleteTeachersByDepartmentId = async (req, res) => {
  try {
    const { departmentId } = req.params;
    
    // Validate departmentId is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      return res.status(400).json({ 
        success: false,
        msg: 'Invalid department ID format' 
      });
    }

    // Check if department exists
    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({
        success: false,
        msg: 'Department not found',
        departmentId: departmentId
      });
    }

    // Find teachers in this department
    const teachersInDept = await Teacher.find({ 
      departmentId: departmentId,
      isActive: true 
    });

    if (teachersInDept.length === 0) {
      return res.status(404).json({
        success: false,
        msg: 'No active teachers found in the specified department',
        departmentId: departmentId
      });
    }

    // Check constraints for each teacher
    const deleteableTeachers = [];
    const skippedTeachers = [];

    for (const teacher of teachersInDept) {
      // Check if teacher is referenced in active routine slots
      const activeSlots = await RoutineSlot.countDocuments({
        teacherIds: teacher._id,
        isActive: true
      });

      // Check if teacher is a department head
      const isDeptHead = await Department.findOne({ headId: teacher._id });

      if (activeSlots > 0) {
        skippedTeachers.push({
          id: teacher._id,
          name: teacher.fullName,
          reason: `Assigned to ${activeSlots} active routine slots`
        });
      } else if (isDeptHead) {
        skippedTeachers.push({
          id: teacher._id,
          name: teacher.fullName,
          reason: 'Is a department head'
        });
      } else {
        deleteableTeachers.push(teacher);
      }
    }

    // Perform soft delete for deleteable teachers
    let deactivatedCount = 0;
    if (deleteableTeachers.length > 0) {
      const deleteableIds = deleteableTeachers.map(t => t._id);
      const updateResult = await Teacher.updateMany(
        { _id: { $in: deleteableIds } },
        { $set: { isActive: false } }
      );
      deactivatedCount = updateResult.modifiedCount;
    }

    res.status(200).json({
      success: true,
      message: `Department cleanup completed: ${deactivatedCount} teachers deactivated, ${skippedTeachers.length} skipped due to constraints`,
      departmentId: departmentId,
      departmentName: department.name,
      deactivatedCount: deactivatedCount,
      skippedCount: skippedTeachers.length,
      totalProcessed: deactivatedCount + skippedTeachers.length,
      deactivatedTeachers: deleteableTeachers.map(t => ({
        id: t._id,
        name: t.fullName,
        email: t.email,
        action: 'deactivated'
      })),
      skippedTeachers: skippedTeachers
    });

  } catch (err) {
    console.error('Delete teachers by department ID error:', err);
    res.status(500).json({
      success: false,
      msg: 'Server error during department-based deletion',
      error: err.message
    });
  }
};

// @desc    Get teacher schedule
// @route   GET /api/teachers/:id/schedule
// @access  Private
exports.getTeacherSchedule = async (req, res) => {
  try {
    const { academicYearId } = req.query;
    
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Get current academic year if not specified
    let academicYear;
    if (academicYearId) {
      const AcademicCalendar = require('../models/AcademicCalendar');
      academicYear = await AcademicCalendar.findById(academicYearId);
    } else {
      const AcademicCalendar = require('../models/AcademicCalendar');
      academicYear = await AcademicCalendar.findOne({ isCurrentYear: true });
    }

    // If no academic year found, return empty schedule instead of 404
    if (!academicYear) {
      console.log('No current academic year found, returning empty schedule');
      return res.json({
        success: true,
        data: {
          teacherId: teacher._id,
          fullName: teacher.fullName,
          shortName: teacher.shortName,
          programCode: 'TEACHER_VIEW',
          semester: 'ALL',
          section: 'ALL',
          routine: {
            0: {}, 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}
          },
          message: 'No current academic year set. Please set an academic year to view schedules.'
        }
      });
    }

    // Get all routine slots for this teacher
    const RoutineSlot = require('../models/RoutineSlot');
    const routineSlots = await RoutineSlot.find({
      teacherIds: teacher._id,
      academicYearId: academicYear._id,
      isActive: true
    }).populate([
      { path: 'programId', select: 'code name' },
      { path: 'subjectId', select: 'code name weeklyHours' },
      { path: 'roomId', select: 'name building' },
      { path: 'labGroupId', select: 'groups' }
    ]).sort({ dayIndex: 1, slotIndex: 1 });

    // IMPORTANT: Use the SAME data format as routine manager
    // Create routine object with day indices as keys and slot indices as sub-keys
    const routine = {};
    
    // Initialize routine object for all days (0-6 = Sunday to Saturday)
    for (let day = 0; day <= 6; day++) {
      routine[day] = {};
    }

    // Populate routine with classes using the SAME structure as routineController.js
    routineSlots.forEach(slot => {
      routine[slot.dayIndex][slot.slotIndex] = {
        _id: slot._id,
        subjectId: slot.subjectId?._id,
        subjectName: slot.subjectName_display || slot.subjectId?.name || 'Unknown Subject',
        subjectCode: slot.subjectCode_display || slot.subjectId?.code || 'N/A',
        teacherIds: slot.teacherIds,
        teacherNames: slot.teacherNames_display || slot.teacherIds?.map(t => t.fullName) || [teacher.fullName],
        teacherShortNames: slot.teacherShortNames_display || slot.teacherIds?.map(t => t.shortName) || [teacher.shortName],
        roomId: slot.roomId?._id,
        roomName: slot.roomName_display || slot.roomId?.name || 'TBA',
        classType: slot.classType,
        notes: slot.notes,
        timeSlot_display: slot.timeSlot_display || '',
        // Additional context for teacher view
        programCode: slot.programCode,
        semester: slot.semester,
        section: slot.section,
        programSemesterSection: `${slot.programCode} Sem${slot.semester} ${slot.section}`,
        labGroupName: slot.labGroupName,
        recurrence: slot.recurrence,
        // IMPORTANT: Include spanned class information for merging
        spanId: slot.spanId,
        spanMaster: slot.spanMaster
      };
    });

    console.log(`Teacher ${teacher.shortName} schedule generated with ${routineSlots.length} classes`);

    // Return in the EXACT SAME format as routine manager
    res.json({
      success: true,
      data: {
        teacherId: teacher._id,
        fullName: teacher.fullName,
        shortName: teacher.shortName,
        programCode: 'TEACHER_VIEW', // Special marker for teacher view
        semester: 'ALL',
        section: 'ALL',
        routine
      }
    });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Invalid ID format' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Update teacher availability
// @route   PUT /api/teachers/:id/availability
// @access  Private/Admin
exports.updateTeacherAvailability = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    const { availableDays, unavailableSlots } = req.body;

    if (availableDays) {
      teacher.schedulingConstraints.availableDays = availableDays;
    }

    if (unavailableSlots) {
      teacher.schedulingConstraints.unavailableSlots = unavailableSlots;
    }

    await teacher.save();
    res.json(teacher);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Teacher not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Export teacher's schedule to Excel
// @route   GET /api/teachers/:id/schedule/excel
// @access  Private
exports.exportTeacherSchedule = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const { academicYearId } = req.query;
    
    const teacher = await Teacher.findById(req.params.id);
    
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Get current academic year if not specified
    let academicYear;
    if (academicYearId) {
      const AcademicCalendar = require('../models/AcademicCalendar');
      academicYear = await AcademicCalendar.findById(academicYearId);
    } else {
      const AcademicCalendar = require('../models/AcademicCalendar');
      academicYear = await AcademicCalendar.findOne({ isCurrentYear: true });
    }

    if (!academicYear) {
      return res.status(404).json({ msg: 'Academic year not found' });
    }

    // Get all routine slots for this teacher with spanned class information
    const routineSlots = await RoutineSlot.find({
      teacherIds: teacher._id,
      academicYearId: academicYear._id,
      isActive: true
    }).populate([
      { path: 'programId', select: 'code name' },
      { path: 'subjectId', select: 'code name weeklyHours' },
      { path: 'roomId', select: 'name building' },
      { path: 'labGroupId', select: 'groups' }
    ]).sort({ dayIndex: 1, slotIndex: 1 });

    if (routineSlots.length === 0) {
      return res.status(404).json({ msg: 'No schedule found for this teacher' });
    }

    // Get all time slots for reference
    const TimeSlot = require('../models/TimeSlot');
    const timeSlots = await TimeSlot.find().sort({ order: 1 });
    const timeSlotMap = new Map();
    timeSlots.forEach(slot => {
      timeSlotMap.set(slot._id, slot);
    });

    // Group spanned classes and merge them
    const mergedClasses = [];
    const processedSpanIds = new Set();

    routineSlots.forEach(slot => {
      // If this is part of a spanned class that we've already processed, skip it
      if (slot.spanId && processedSpanIds.has(slot.spanId.toString())) {
        return;
      }

      if (slot.spanId && slot.spanMaster) {
        // This is a spanned class master - find all related slots
        const spanSlots = routineSlots.filter(s => 
          s.spanId && s.spanId.toString() === slot.spanId.toString()
        ).sort((a, b) => a.slotIndex - b.slotIndex);

        // Calculate time range for spanned class
        const firstSlot = timeSlotMap.get(spanSlots[0].slotIndex);
        const lastSlot = timeSlotMap.get(spanSlots[spanSlots.length - 1].slotIndex);
        const timeRange = firstSlot && lastSlot ? 
          `${firstSlot.startTime}-${lastSlot.endTime}` : 'Unknown';

        mergedClasses.push({
          ...slot.toObject(),
          timeRange,
          periodsCount: spanSlots.length,
          isSpanned: true
        });

        processedSpanIds.add(slot.spanId.toString());
      } else if (!slot.spanId) {
        // This is a single period class
        const timeSlot = timeSlotMap.get(slot.slotIndex);
        const timeRange = timeSlot ? 
          `${timeSlot.startTime}-${timeSlot.endTime}` : 'Unknown';

        mergedClasses.push({
          ...slot.toObject(),
          timeRange,
          periodsCount: 1,
          isSpanned: false
        });
      }
    });

    // Sort merged classes by day and time
    mergedClasses.sort((a, b) => {
      if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
      return a.slotIndex - b.slotIndex;
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Teacher Schedule');
    
    // Add header information
    worksheet.addRow(['Teacher Schedule']);
    worksheet.addRow(['Teacher:', teacher.fullName]);
    worksheet.addRow(['Short Name:', teacher.shortName]);
    worksheet.addRow(['Department:', teacher.departmentName || 'N/A']);
    worksheet.addRow(['Academic Year:', academicYear.name || academicYear.year]);
    worksheet.addRow(['Generated:', new Date().toLocaleDateString()]);
    worksheet.addRow(['']);

    // Add column headers
    const headerRow = worksheet.addRow([
      'Day', 
      'Time', 
      'Subject', 
      'Program-Semester-Section', 
      'Class Type',
      'Room', 
      'Periods'
    ]);

    // Style the header row
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Add schedule data
    mergedClasses.forEach(cls => {
      const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][cls.dayIndex];
      const programSemesterSection = `${cls.programCode}-${cls.semester}-${cls.section}`;
      
      const dataRow = worksheet.addRow([
        day,
        cls.timeRange,
        cls.subjectName_display || cls.subjectId?.name || (cls.classType === 'BREAK' ? 'Break' : 'Unknown Subject'),
        cls.classType === 'BREAK' ? '-' : programSemesterSection,
        cls.classType || 'L',
        cls.classType === 'BREAK' ? '-' : (cls.roomName_display || cls.roomId?.name || 'TBA'),
        cls.periodsCount
      ]);

      // Style data rows with clean formatting (no blue color)
      dataRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        
        // Remove background colors for cleaner look
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      });
    });
    
    // Format worksheet columns
    worksheet.getColumn(1).width = 12; // Day
    worksheet.getColumn(2).width = 15; // Time
    worksheet.getColumn(3).width = 25; // Subject
    worksheet.getColumn(4).width = 18; // Program-Semester-Section
    worksheet.getColumn(5).width = 12; // Class Type
    worksheet.getColumn(6).width = 20; // Room
    worksheet.getColumn(7).width = 8;  // Periods
    
    // Set headers for file download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="teacher_schedule_${teacher.shortName}_${academicYear.year || 'current'}.xlsx"`
    );

    // Write to response stream
    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Teacher not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    PERMANENTLY DELETE ALL TEACHERS (DANGER!)
// @route   DELETE /api/teachers/hard-delete/all
// @access  Private/Admin
exports.hardDeleteAllTeachers = async (req, res) => {
  try {
    // Get count before deletion
    const totalCount = await Teacher.countDocuments();
    
    if (totalCount === 0) {
      return res.status(404).json({
        success: false,
        msg: 'No teachers found in the database'
      });
    }

    // Get all teachers before deletion (for logging)
    const allTeachers = await Teacher.find({}, 'fullName email').lean();

    // PERMANENTLY DELETE ALL TEACHERS
    const deleteResult = await Teacher.deleteMany({});

    res.json({
      success: true,
      message: `Successfully PERMANENTLY DELETED ${deleteResult.deletedCount} teachers from database`,
      deletedCount: deleteResult.deletedCount,
      deletedTeachers: allTeachers.map(teacher => ({
        id: teacher._id.toString(),
        name: teacher.fullName,
        email: teacher.email
      })),
      warning: "⚠️ THIS IS PERMANENT - TEACHERS CANNOT BE RECOVERED!"
    });

  } catch (err) {
    console.error('Hard delete all teachers error:', err.message);
    res.status(500).json({ 
      success: false,
      msg: 'Server error during hard deletion', 
      error: err.message 
    });
  }
};

// @desc    PERMANENTLY DELETE MULTIPLE TEACHERS BY IDs (DANGER!)
// @route   DELETE /api/teachers/hard-delete/bulk
// @access  Private/Admin
exports.hardDeleteTeachersBulk = async (req, res) => {
  try {
    let teacherIds;

    // Handle both direct array and wrapped formats
    if (Array.isArray(req.body)) {
      teacherIds = req.body;
    } else if (req.body.teacherIds && Array.isArray(req.body.teacherIds)) {
      teacherIds = req.body.teacherIds;
    } else {
      return res.status(400).json({
        success: false,
        msg: 'Request body must be an array of teacher IDs or an object with teacherIds array'
      });
    }

    if (!teacherIds || teacherIds.length === 0) {
      return res.status(400).json({
        success: false,
        msg: 'No teacher IDs provided'
      });
    }

    // Validate ObjectIds
    const mongoose = require('mongoose');
    const invalidIds = teacherIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        msg: `Invalid teacher IDs: ${invalidIds.join(', ')}`
      });
    }

    // Get teachers that exist before deletion
    const existingTeachers = await Teacher.find(
      { _id: { $in: teacherIds } },
      'fullName email'
    ).lean();

    const foundIds = existingTeachers.map(t => t._id.toString());
    const notFoundIds = teacherIds.filter(id => !foundIds.includes(id));

    if (existingTeachers.length === 0) {
      return res.status(404).json({
        success: false,
        msg: 'None of the specified teachers were found',
        notFoundIds: teacherIds,
        notFoundCount: teacherIds.length
      });
    }

    // PERMANENTLY DELETE THE TEACHERS
    const deleteResult = await Teacher.deleteMany({
      _id: { $in: foundIds }
    });

    res.json({
      success: true,
      message: `Successfully PERMANENTLY DELETED ${deleteResult.deletedCount} teachers from database`,
      deletedCount: deleteResult.deletedCount,
      deletedTeachers: existingTeachers.map(teacher => ({
        id: teacher._id.toString(),
        name: teacher.fullName,
        email: teacher.email
      })),
      notFoundIds: notFoundIds,
      notFoundCount: notFoundIds.length,
      warning: "⚠️ THIS IS PERMANENT - TEACHERS CANNOT BE RECOVERED!"
    });

  } catch (err) {
    console.error('Hard delete bulk teachers error:', err.message);
    res.status(500).json({ 
      success: false,
      msg: 'Server error during bulk hard deletion', 
      error: err.message 
    });
  }
};
