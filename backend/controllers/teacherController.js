const Teacher = require('../models/Teacher');
const Department = require('../models/Department');
const RoutineSlot = require('../models/RoutineSlot');
const { validationResult } = require('express-validator');
const { getSemesterGroupName } = require('../utils/semesterGroupUtils');

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
    // Use the SAME approach as class routine - fetch ALL slots without academic year filtering
    // This ensures consistency with how class routines work
    const RoutineSlot = require('../models/RoutineSlot');
    
    const routineSlots = await RoutineSlot.find({
      teacherIds: teacher._id,
      isActive: true
      // NOTE: Removed academicYearId filter to match class routine logic
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

    // Populate routine with classes using the EXACT SAME structure as class routine
    // This matches the logic in routineController.js getRoutine function
    routineSlots.forEach(slot => {
      const slotData = {
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
        // Multi-period spanning information (same as class routine)
        spanId: slot.spanId,
        spanMaster: slot.spanMaster,
        // Additional context for teacher view
        programCode: slot.programCode,
        semester: slot.semester,
        section: slot.section,
        programSemesterSection: `${slot.programCode} Sem${slot.semester} ${slot.section}`,
        labGroupName: slot.labGroupName,
        recurrence: slot.recurrence,
        // Elective information (same as class routine)
        isElectiveClass: slot.isElectiveClass || false,
        classCategory: slot.classCategory || 'CORE',
        electiveInfo: slot.electiveInfo || null,
        labGroup: slot.labGroup,
        isAlternativeWeek: slot.isAlternativeWeek,
        alternateGroupData: slot.alternateGroupData
      };
      
      // Handle multiple slots in the same time slot (CRITICAL FOR SEMESTER GROUPS)
      // Use the EXACT SAME logic as routineController.js
      if (routine[slot.dayIndex][slot.slotIndex]) {
        // If slot already exists, convert to array or add to existing array
        const existing = routine[slot.dayIndex][slot.slotIndex];
        
        console.log(`🔄 Teacher ${teacher.shortName}: Found duplicate slot - Day ${slot.dayIndex}, Slot ${slot.slotIndex}`);
        console.log(`   Existing: semester=${existing.semester} (${getSemesterGroupName(existing.semester)}), subject=${existing.subjectName}`);
        console.log(`   New: semester=${slotData.semester} (${getSemesterGroupName(slotData.semester)}), subject=${slotData.subjectName}`);
        
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
    const { academicYearId } = req.query;
    
    const teacher = await Teacher.findById(req.params.id);
    
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Return a message that Excel export is disabled
    return res.status(400).json({
      success: false,
      message: 'Excel export functionality has been disabled.',
      details: 'This feature is no longer available'
    });
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

// @desc    Find common free time slots for multiple teachers (Meeting Scheduler)
// @route   POST /api/teachers/meeting-scheduler
// @access  Private
exports.findMeetingSlots = async (req, res) => {
  try {
    const { teacherIds, academicYearId, minDuration = 1, excludeDays = [], semesterGroup } = req.body;

    // Validate input
    if (!teacherIds || !Array.isArray(teacherIds) || teacherIds.length < 2) {
      return res.status(400).json({
        success: false,
        msg: 'At least 2 teacher IDs are required'
      });
    }

    // Validate semester group if provided
    if (semesterGroup && !['odd', 'even', 'all'].includes(semesterGroup)) {
      return res.status(400).json({
        success: false,
        msg: 'semesterGroup must be either "odd", "even", or "all"'
      });
    }

    // Validate teachers exist
    const teachers = await Teacher.find({
      _id: { $in: teacherIds }
    }).select('_id fullName shortName email');

    if (teachers.length !== teacherIds.length) {
      const foundIds = teachers.map(t => t._id.toString());
      const missingIds = teacherIds.filter(id => !foundIds.includes(id));
      return res.status(400).json({
        success: false,
        msg: 'One or more teachers not found',
        missingTeacherIds: missingIds
      });
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
      return res.status(400).json({
        success: false,
        msg: 'No academic year found'
      });
    }

    // Build query filter for routine slots
    const routineSlotFilter = {
      teacherIds: { $in: teacherIds },
      academicYearId: academicYear._id,
      isActive: true
    };

    // Add semester group filter if specified (skip filter if "all")
    if (semesterGroup && semesterGroup !== 'all') {
      routineSlotFilter.semesterGroup = semesterGroup;
    }

    const routineSlots = await RoutineSlot.find(routineSlotFilter).populate([
      { path: 'teacherIds', select: 'fullName shortName' },
      { path: 'subjectId', select: 'name code' },
      { path: 'subjectIds', select: 'name code' },
      { path: 'programId', select: 'code name' }
    ]).sort({ dayIndex: 1, slotIndex: 1 });

    console.log(`Found ${routineSlots.length} routine slots for meeting scheduler`);

    // Create a meeting availability grid using slotIndex directly
    const daysToCheck = [0, 1, 2, 3, 4, 5].filter(day => !excludeDays.includes(day)); // Sun-Fri
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const slotsPerDay = 7; // 0-6 slots per day
    
    const meetingGrid = {};
    const availableSlots = [];
    const unavailableSlots = [];

    // Create a map of busy slots for faster lookup
    const busySlotMap = new Map();
    routineSlots.forEach(routineSlot => {
      try {
        const slotKey = `${routineSlot.dayIndex}-${routineSlot.slotIndex}`;
        if (!busySlotMap.has(slotKey)) {
          busySlotMap.set(slotKey, []);
        }
        
        // Get subject info - handle both single subject and multiple subjects (electives)
        let subjectName = 'Unknown Subject';
        let subjectCode = 'N/A';
        
        if (routineSlot.subjectId) {
          subjectName = routineSlot.subjectId.name || 'Unknown Subject';
          subjectCode = routineSlot.subjectId.code || 'N/A';
        } else if (routineSlot.subjectIds && routineSlot.subjectIds.length > 0) {
          // For elective classes with multiple subjects
          const subjects = routineSlot.subjectIds.map(s => s.name || 'Unknown').join(', ');
          const codes = routineSlot.subjectIds.map(s => s.code || 'N/A').join(', ');
          subjectName = subjects;
          subjectCode = codes;
        }
        
        routineSlot.teacherIds.forEach(teacher => {
          if (teacherIds.includes(teacher._id.toString())) {
            busySlotMap.get(slotKey).push({
              teacherId: teacher._id,
              teacherName: teacher.fullName || 'Unknown Teacher',
              teacherShortName: teacher.shortName || 'Unknown',
              subject: subjectName,
              subjectCode: subjectCode,
              program: routineSlot.programId?.name || 'Unknown Program',
              programCode: routineSlot.programId?.code || 'N/A',
              semester: routineSlot.semester || 'N/A',
              section: routineSlot.section || 'N/A',
              classType: routineSlot.classType || 'L'
            });
          }
        });
      } catch (err) {
        console.error('Error processing routine slot:', err.message, 'Slot data:', {
          id: routineSlot._id,
          dayIndex: routineSlot.dayIndex,
          slotIndex: routineSlot.slotIndex,
          hasSubjectId: !!routineSlot.subjectId,
          hasSubjectIds: !!routineSlot.subjectIds,
          teacherCount: routineSlot.teacherIds?.length || 0
        });
      }
    });

    // Initialize grid for each day and slot
    daysToCheck.forEach(dayIndex => {
      meetingGrid[dayIndex] = {};
      
      for (let slotIndex = 0; slotIndex < slotsPerDay; slotIndex++) {
        const slotKey = `${dayIndex}-${slotIndex}`;
        const busyTeachers = busySlotMap.get(slotKey) || [];
        
        // Remove duplicates (same teacher might appear multiple times)
        const uniqueBusyTeachers = busyTeachers.filter((teacher, index, self) => 
          index === self.findIndex(t => t.teacherId.toString() === teacher.teacherId.toString())
        );

        const availableTeachers = teachers.filter(teacher => 
          !uniqueBusyTeachers.some(busy => busy.teacherId.toString() === teacher._id.toString())
        ).map(teacher => ({
          teacherId: teacher._id,
          teacherName: teacher.fullName,
          teacherShortName: teacher.shortName
        }));

        const slotData = {
          dayIndex,
          dayName: dayNames[dayIndex],
          slotIndex: slotIndex,
          unavailableTeachers: uniqueBusyTeachers,
          availableTeachers: availableTeachers,
          isAvailableForMeeting: uniqueBusyTeachers.length === 0,
          conflictLevel: uniqueBusyTeachers.length === 0 ? 'none' : 
                        uniqueBusyTeachers.length === teacherIds.length ? 'full' : 'partial'
        };

        meetingGrid[dayIndex][slotIndex] = slotData;

        // Add to appropriate arrays
        if (slotData.isAvailableForMeeting) {
          availableSlots.push(slotData);
        } else {
          unavailableSlots.push(slotData);
        }
      }
    });

    // Calculate statistics
    const totalSlots = availableSlots.length + unavailableSlots.length;
    const statistics = {
      totalSlots,
      availableSlots: availableSlots.length,
      unavailableSlots: unavailableSlots.length,
      availabilityPercentage: totalSlots > 0 ? ((availableSlots.length / totalSlots) * 100).toFixed(1) : '0',
      partiallyAvailableSlots: unavailableSlots.filter(slot => slot.conflictLevel === 'partial').length,
      fullyUnavailableSlots: unavailableSlots.filter(slot => slot.conflictLevel === 'full').length
    };

    res.json({
      success: true,
      data: {
        searchCriteria: {
          teacherCount: teacherIds.length,
          teachers: teachers.map(t => ({ id: t._id, name: t.fullName, shortName: t.shortName })),
          academicYear: academicYear.title,
          minDuration,
          excludeDays,
          semesterGroup: semesterGroup || 'all',
          daysSearched: daysToCheck.map(d => dayNames[d])
        },
        statistics,
        meetingGrid,
        availableSlots,
        unavailableSlots,
        recommendations: {
          bestDays: getBestDaysFromGrid(availableSlots),
          bestTimes: getBestTimesFromGrid(availableSlots)
        }
      }
    });

  } catch (err) {
    console.error('Find meeting slots error:', err.message);
    res.status(500).json({
      success: false,
      msg: 'Server error while finding meeting slots',
      error: err.message
    });
  }
};

// Helper function to get best days from available slots
function getBestDaysFromGrid(availableSlots) {
  const dayStats = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  availableSlots.forEach(slot => {
    const dayName = dayNames[slot.dayIndex];
    dayStats[dayName] = (dayStats[dayName] || 0) + 1;
  });

  return Object.entries(dayStats)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([day, count]) => ({ day, availableSlots: count }));
}

// Helper function to get best times from available slots
function getBestTimesFromGrid(availableSlots) {
  const timeStats = {};
  const slotLabels = [
    '8:00-8:50', '8:50-9:40', '9:40-10:30', '10:45-11:35', 
    '11:35-12:25', '12:25-1:15', '1:15-2:05'
  ];
  
  availableSlots.forEach(slot => {
    const timeLabel = slotLabels[slot.slotIndex] || `Slot ${slot.slotIndex + 1}`;
    timeStats[timeLabel] = (timeStats[timeLabel] || 0) + 1;
  });

  return Object.entries(timeStats)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([timeRange, count]) => ({ timeRange, label: `Slot ${Object.keys(timeStats).indexOf(timeRange) + 1}`, count }));
}

// Helper function to get recommended days based on availability
function getRecommendedDays(commonFreeSlots) {
  const dayStats = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  commonFreeSlots.forEach(slot => {
    if (!dayStats[slot.dayIndex]) {
      dayStats[slot.dayIndex] = { dayName: slot.dayName, count: 0 };
    }
    dayStats[slot.dayIndex].count++;
  });

  return Object.entries(dayStats)
    .sort(([,a], [,b]) => b.count - a.count)
    .slice(0, 3)
    .map(([dayIndex, stats]) => ({
      dayIndex: parseInt(dayIndex),
      dayName: stats.dayName,
      availableSlots: stats.count
    }));
}

// Helper function to get recommended times
function getRecommendedTimes(commonFreeSlots) {
  const timeStats = {};
  const slotLabels = [
    '8:00-8:50', '8:50-9:40', '9:40-10:30', '10:45-11:35', 
    '11:35-12:25', '12:25-1:15', '1:15-2:05'
  ];
  
  commonFreeSlots.forEach(slot => {
    const timeKey = slotLabels[slot.slotIndex] || `Slot ${slot.slotIndex + 1}`;
    if (!timeStats[timeKey]) {
      timeStats[timeKey] = { 
        timeRange: timeKey,
        label: `Slot ${slot.slotIndex + 1}`,
        count: 0,
        slotIndex: slot.slotIndex
      };
    }
    timeStats[timeKey].count++;
  });

  return Object.values(timeStats)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

// Helper function to find alternative options when no common slots exist
async function getAlternativeOptions(teacherIds, academicYearId, minDuration) {
  const RoutineSlot = require('../models/RoutineSlot');
  
  // Find slots where only one teacher is busy (potential reschedule options)
  const alternatives = [];
  
  // Get all routine slots for analysis
  const allSlots = await RoutineSlot.find({
    teacherIds: { $in: teacherIds },
    academicYearId,
    isActive: true
  }).populate('teacherIds subjectId programId');

  // Group by time slot to find minimal conflicts
  const slotConflicts = {};
  allSlots.forEach(slot => {
    const slotKey = `${slot.dayIndex}-${slot.slotIndex}`;
    if (!slotConflicts[slotKey]) {
      slotConflicts[slotKey] = [];
    }
    slotConflicts[slotKey].push(slot);
  });

  // Find slots with minimal conflicts (only 1 teacher busy)
  Object.entries(slotConflicts).forEach(([slotKey, conflicts]) => {
    if (conflicts.length === 1) { // Only one teacher busy
      const conflictingSlot = conflicts[0];
      const [dayIndex, slotIndex] = slotKey.split('-');
      
      alternatives.push({
        type: 'reschedule_option',
        dayIndex: parseInt(dayIndex),
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(dayIndex)],
        slotIndex: parseInt(slotIndex),
        conflictingTeacher: conflictingSlot.teacherIds.find(t => 
          teacherIds.includes(t._id.toString())
        ),
        conflictingClass: {
          subject: conflictingSlot.subjectId?.name,
          program: conflictingSlot.programId?.code,
          semester: conflictingSlot.semester,
          section: conflictingSlot.section
        },
        suggestion: 'Consider rescheduling this class to free up the slot for meeting'
      });
    }
  });

  return alternatives.slice(0, 5); // Return top 5 alternatives
}
