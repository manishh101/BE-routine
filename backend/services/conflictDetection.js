const RoutineSlot = require('../models/RoutineSlot');
const LabGroup = require('../models/LabGroup');
const ElectiveGroup = require('../models/ElectiveGroup');
const AcademicCalendar = require('../models/AcademicCalendar');
const Teacher = require('../models/Teacher');
const Room = require('../models/Room');
const { validationResult } = require('express-validator');

// @desc    Enhanced conflict detection service
// @access  Internal
class ConflictDetectionService {
  static async validateSchedule(slotData) {
    const conflicts = [];
    const { dayIndex, slotIndex, teacherIds, roomId, recurrence, academicYearId, classCategory } = slotData;

    // Special handling for elective classes
    if (classCategory === 'ELECTIVE' && slotData.targetSections && slotData.targetSections.length > 1) {
      const electiveConflicts = await this.validateElectiveScheduling(slotData);
      conflicts.push(...electiveConflicts);
    }

    // Teacher conflicts
    for (const teacherId of teacherIds) {
      const teacherConflicts = await this.checkTeacherConflicts(
        teacherId, dayIndex, slotIndex, recurrence, academicYearId
      );
      conflicts.push(...teacherConflicts);
    }

    // Room conflicts
    const roomConflicts = await this.checkRoomConflicts(
      roomId, dayIndex, slotIndex, recurrence, academicYearId
    );
    conflicts.push(...roomConflicts);

    // Section conflicts (students can't be in two places at once)
    const sectionConflicts = await this.checkSectionConflicts(slotData);
    conflicts.push(...sectionConflicts);

    return conflicts;
  }

  static async checkTeacherConflicts(teacherId, dayIndex, slotIndex, recurrence, academicYearId) {
    const conflicts = [];
    
    // Get teacher's availability constraints
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return [{ type: 'teacher_not_found', teacherId }];

    // Check availability constraints
    const availableDays = teacher.schedulingConstraints?.availableDays || teacher.availableDays || [0,1,2,3,4,5];
    if (!availableDays.includes(dayIndex)) {
      conflicts.push({
        type: 'teacher_unavailable_day',
        teacherId,
        dayIndex,
        message: `Teacher ${teacher.shortName} is not available on this day`
      });
    }

    // Check unavailable slots
    const unavailableSlots = teacher.schedulingConstraints?.unavailableSlots || teacher.unavailableSlots || [];
    const unavailableSlot = unavailableSlots.find(slot =>
      slot.dayIndex === dayIndex && slot.slotIndex === slotIndex
    );
    
    if (unavailableSlot) {
      conflicts.push({
        type: 'teacher_unavailable_slot',
        teacherId,
        dayIndex,
        slotIndex,
        reason: unavailableSlot.reason,
        message: `Teacher ${teacher.shortName} is unavailable: ${unavailableSlot.reason}`
      });
    }

    // Check existing routine conflicts
    const existingSlots = await RoutineSlot.find({
      teacherIds: teacherId,
      dayIndex,
      slotIndex,
      academicYearId,
      isActive: true
    });

    for (const existingSlot of existingSlots) {
      const hasConflict = this.checkRecurrenceConflict(recurrence, existingSlot.recurrence);
      if (hasConflict) {
        conflicts.push({
          type: 'teacher_schedule_conflict',
          teacherId,
          existingSlotId: existingSlot._id,
          message: `Teacher ${teacher.shortName} already has a class at this time`
        });
      }
    }

    return conflicts;
  }

  static async checkRoomConflicts(roomId, dayIndex, slotIndex, recurrence, academicYearId) {
    const conflicts = [];
    
    const existingSlots = await RoutineSlot.find({
      roomId,
      dayIndex,
      slotIndex,
      academicYearId,
      isActive: true
    });

    for (const existingSlot of existingSlots) {
      const hasConflict = this.checkRecurrenceConflict(recurrence, existingSlot.recurrence);
      if (hasConflict) {
        const room = await Room.findById(roomId);
        conflicts.push({
          type: 'room_conflict',
          roomId,
          existingSlotId: existingSlot._id,
          message: `Room ${room?.name || roomId} is already booked at this time`
        });
      }
    }

    return conflicts;
  }

  static async checkSectionConflicts(slotData) {
    const { programId, semester, section, dayIndex, slotIndex, recurrence, academicYearId } = slotData;
    const conflicts = [];

    // For electives (7th/8th semester), check differently
    if ([7, 8].includes(semester) && slotData.electiveGroupId) {
      return this.checkElectiveSectionConflicts(slotData);
    }

    const existingSlots = await RoutineSlot.find({
      programId,
      semester,
      section,
      dayIndex,
      slotIndex,
      academicYearId,
      isActive: true
    });

    for (const existingSlot of existingSlots) {
      const hasConflict = this.checkRecurrenceConflict(recurrence, existingSlot.recurrence);
      if (hasConflict) {
        conflicts.push({
          type: 'section_conflict',
          existingSlotId: existingSlot._id,
          message: `Section ${section} already has a class at this time`
        });
      }
    }

    return conflicts;
  }

  static async checkElectiveSectionConflicts(slotData) {
    const { programId, semester, dayIndex, slotIndex, academicYearId } = slotData;
    const conflicts = [];

    // Check if core subjects conflict with elective time
    const coreConflicts = await RoutineSlot.find({
      programId,
      semester,
      dayIndex,
      slotIndex,
      academicYearId,
      classCategory: 'CORE',
      isActive: true
    });

    for (const coreSlot of coreConflicts) {
      conflicts.push({
        type: 'elective_core_conflict',
        existingSlotId: coreSlot._id,
        coreSection: coreSlot.targetSections?.[0] || 'Unknown',
        message: `Elective conflicts with core subject for section ${coreSlot.targetSections?.[0] || 'Unknown'}`
      });
    }

    // Check if another elective is scheduled at same time
    const otherElectives = await RoutineSlot.find({
      programId,
      semester,
      dayIndex,
      slotIndex,
      academicYearId,
      classCategory: 'ELECTIVE',
      isActive: true
    });

    for (const electiveSlot of otherElectives) {
      conflicts.push({
        type: 'elective_time_conflict',
        existingSlotId: electiveSlot._id,
        conflictingElective: electiveSlot.electiveInfo?.groupName || 'Unknown Elective',
        message: `Another elective is already scheduled at this time`
      });
    }

    return conflicts;
  }

  // Special validation for elective scheduling across multiple sections
  static async validateElectiveScheduling(slotData) {
    const conflicts = [];
    const { electiveGroupId, targetSections, programId, semester, dayIndex, slotIndex, academicYearId } = slotData;

    // Validate all target sections for conflicts
    for (const section of targetSections) {
      // Check for core subject conflicts in this section
      const coreConflicts = await RoutineSlot.find({
        programId,
        semester,
        section,
        dayIndex,
        slotIndex,
        academicYearId,
        classCategory: { $in: ['CORE', 'COMMON'] },
        isActive: true
      });

      for (const coreSlot of coreConflicts) {
        conflicts.push({
          type: 'elective_core_conflict',
          section,
          existingSlotId: coreSlot._id,
          subjectCode: coreSlot.subjectCode,
          message: `Section ${section} has core subject ${coreSlot.subjectCode} at this time`
        });
      }

      // Check for other electives in this section
      const electiveConflicts = await RoutineSlot.find({
        programId,
        semester,
        dayIndex,
        slotIndex,
        academicYearId,
        classCategory: 'ELECTIVE',
        'electiveInfo.groupId': { $ne: electiveGroupId },
        targetSections: section,
        isActive: true
      });

      for (const electiveSlot of electiveConflicts) {
        conflicts.push({
          type: 'elective_overlap_conflict',
          section,
          existingSlotId: electiveSlot._id,
          conflictingElective: electiveSlot.electiveInfo?.groupName || 'Unknown',
          message: `Section ${section} already has elective "${electiveSlot.electiveInfo?.groupName}" at this time`
        });
      }
    }

    return conflicts;
  }

  static checkRecurrenceConflict(pattern1, pattern2) {
    // If either is weekly, there's always a conflict
    if (!pattern1 || pattern1.type === 'weekly' || !pattern2 || pattern2.type === 'weekly') {
      return true;
    }

    // If both are alternate weeks
    if (pattern1.type === 'alternate' && pattern2.type === 'alternate') {
      // Same pattern conflicts, different patterns don't
      return pattern1.pattern === pattern2.pattern;
    }

    // Custom patterns need week-by-week checking
    if (pattern1.type === 'custom' || pattern2.type === 'custom') {
      // This would need more complex logic for custom patterns
      return false; // For now, assume no conflict
    }

    return false;
  }
}

// @desc    Create or update routine slot with enhanced features
// @route   POST /api/routines/slots
// @access  Private/Admin
exports.createRoutineSlot = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
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
      labGroupId,
      electiveGroupId,
      recurrence,
      notes
    } = req.body;

    // Get current academic year if not provided
    const currentAcademicYear = await AcademicCalendar.findOne({ isCurrentYear: true });
    if (!currentAcademicYear) {
      return res.status(400).json({ msg: 'No current academic year found' });
    }

    const slotData = {
      programId,
      subjectId,
      academicYearId: currentAcademicYear._id,
      semester,
      section,
      dayIndex,
      slotIndex,
      teacherIds,
      roomId,
      classType,
      labGroupId,
      electiveGroupId,
      recurrence: recurrence || { type: 'weekly', description: 'Weekly' },
      notes
    };

    // Enhanced conflict detection
    const conflicts = await ConflictDetectionService.validateSchedule(slotData);
    
    if (conflicts.length > 0) {
      return res.status(409).json({
        msg: 'Schedule conflicts detected',
        conflicts
      });
    }

    // Create routine slot
    const routineSlot = new RoutineSlot(slotData);
    await routineSlot.save();

    // Populate for response
    await routineSlot.populate([
      { path: 'programId', select: 'code name' },
      { path: 'subjectId', select: 'code name credits' },
      { path: 'teacherIds', select: 'shortName fullName' },
      { path: 'roomId', select: 'name building' },
      { path: 'labGroupId', select: 'groups totalGroups' },
      { path: 'academicYearId', select: 'title nepaliYear' }
    ]);

    res.status(201).json(routineSlot);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get routine with enhanced filtering
// @route   GET /api/routines
// @access  Private
exports.getRoutines = async (req, res) => {
  try {
    const {
      programId,
      semester,
      section,
      academicYearId,
      teacherId,
      subjectId,
      roomId,
      classType,
      recurrenceType,
      weekNumber
    } = req.query;

    const filter = { isActive: true };

    // Build filter
    if (programId) filter.programId = programId;
    if (semester) filter.semester = parseInt(semester);
    if (section) filter.section = section;
    if (academicYearId) filter.academicYearId = academicYearId;
    if (teacherId) filter.teacherIds = teacherId;
    if (subjectId) filter.subjectId = subjectId;
    if (roomId) filter.roomId = roomId;
    if (classType) filter.classType = classType;
    if (recurrenceType) filter['recurrence.type'] = recurrenceType;

    // Get current academic year if not specified
    if (!academicYearId) {
      const currentAcademicYear = await AcademicCalendar.findOne({ isCurrentYear: true });
      if (currentAcademicYear) {
        filter.academicYearId = currentAcademicYear._id;
      }
    }

    const routineSlots = await RoutineSlot.find(filter)
      .populate('programId', 'code name')
      .populate('subjectId', 'code name credits weeklyHours')
      .populate('teacherIds', 'shortName fullName')
      .populate('roomId', 'name building capacity')
      .populate('labGroupId', 'groups totalGroups')
      .populate('academicYearId', 'title nepaliYear currentWeek')
      .sort({ dayIndex: 1, slotIndex: 1 });

    // Filter by week if specified
    let filteredSlots = routineSlots;
    if (weekNumber) {
      const week = parseInt(weekNumber);
      filteredSlots = routineSlots.filter(slot => slot.appliesToWeek(week));
    }

    // Organize by day and slot for easier frontend consumption
    const organizedSchedule = {
      metadata: {
        totalSlots: filteredSlots.length,
        academicYear: filter.academicYearId ? 
          await AcademicCalendar.findById(filter.academicYearId).select('title nepaliYear currentWeek') : 
          null,
        weekNumber: weekNumber ? parseInt(weekNumber) : null
      },
      schedule: {}
    };

    // Initialize days
    for (let day = 0; day <= 6; day++) {
      organizedSchedule.schedule[day] = [];
    }

    // Group by day
    filteredSlots.forEach(slot => {
      organizedSchedule.schedule[slot.dayIndex].push({
        _id: slot._id,
        slotIndex: slot.slotIndex,
        program: slot.programId,
        subject: slot.subjectId,
        teachers: slot.teacherIds,
        room: slot.roomId,
        classType: slot.classType,
        semester: slot.semester,
        section: slot.section,
        recurrence: slot.recurrence,
        labGroup: slot.labGroupId,
        display: slot.display,
        notes: slot.notes
      });
    });

    res.json(organizedSchedule);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Update routine slot with conflict checking
// @route   PUT /api/routines/slots/:id
// @access  Private/Admin
exports.updateRoutineSlot = async (req, res) => {
  try {
    const routineSlot = await RoutineSlot.findById(req.params.id);
    
    if (!routineSlot) {
      return res.status(404).json({ msg: 'Routine slot not found' });
    }

    // For updates, temporarily exclude the current slot from conflict checking
    const updatedData = { ...routineSlot.toObject(), ...req.body };
    
    // Check conflicts if schedule details are changing
    const scheduleFields = ['dayIndex', 'slotIndex', 'teacherIds', 'roomId', 'recurrence'];
    const hasScheduleChanges = scheduleFields.some(field => 
      req.body[field] !== undefined && 
      JSON.stringify(req.body[field]) !== JSON.stringify(routineSlot[field])
    );

    if (hasScheduleChanges) {
      // Temporarily deactivate current slot for conflict checking
      routineSlot.isActive = false;
      await routineSlot.save();

      try {
        const conflicts = await ConflictDetectionService.validateSchedule(updatedData);
        
        if (conflicts.length > 0) {
          // Reactivate slot and return conflicts
          routineSlot.isActive = true;
          await routineSlot.save();
          
          return res.status(409).json({
            msg: 'Schedule conflicts detected',
            conflicts
          });
        }
      } catch (error) {
        // Reactivate slot on error
        routineSlot.isActive = true;
        await routineSlot.save();
        throw error;
      }
    }

    // Update the slot
    const updatedSlot = await RoutineSlot.findByIdAndUpdate(
      req.params.id,
      { $set: { ...req.body, isActive: true } },
      { new: true, runValidators: true }
    ).populate([
      { path: 'programId', select: 'code name' },
      { path: 'subjectId', select: 'code name credits' },
      { path: 'teacherIds', select: 'shortName fullName' },
      { path: 'roomId', select: 'name building' },
      { path: 'labGroupId', select: 'groups totalGroups' },
      { path: 'academicYearId', select: 'title nepaliYear' }
    ]);

    res.json(updatedSlot);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Routine slot not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Delete routine slot
// @route   DELETE /api/routines/slots/:id
// @access  Private/Admin
exports.deleteRoutineSlot = async (req, res) => {
  try {
    const routineSlot = await RoutineSlot.findById(req.params.id);
    
    if (!routineSlot) {
      return res.status(404).json({ msg: 'Routine slot not found' });
    }

    // Soft delete
    routineSlot.isActive = false;
    await routineSlot.save();

    res.json({ msg: 'Routine slot deleted successfully' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Routine slot not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get conflict analysis
// @route   POST /api/routines/conflicts/analyze
// @access  Private/Admin
exports.analyzeConflicts = async (req, res) => {
  try {
    const conflicts = await ConflictDetectionService.validateSchedule(req.body);
    
    res.json({
      hasConflicts: conflicts.length > 0,
      conflictCount: conflicts.length,
      conflicts
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

/**
 * Analyze conflicts for a collection of routine slots
 * @param {Array} slots - Array of routine slots to check for conflicts
 * @returns {Array} Array of detected conflicts
 */
ConflictDetectionService.analyzeAllConflicts = async (slots) => {
  const conflicts = [];
  
  // Group slots by day and time for easier conflict detection
  const slotsByDayAndTime = {};
  
  // Process all slots
  for (const slot of slots) {
    const dayTimeKey = `${slot.dayIndex}-${slot.slotIndex}`;
    if (!slotsByDayAndTime[dayTimeKey]) {
      slotsByDayAndTime[dayTimeKey] = [];
    }
    slotsByDayAndTime[dayTimeKey].push(slot);
  }
  
  // Check for teacher conflicts
  for (const dayTimeKey in slotsByDayAndTime) {
    const slotsAtTime = slotsByDayAndTime[dayTimeKey];
    if (slotsAtTime.length > 1) {
      // Check teacher conflicts
      const teacherMap = new Map();
      
      for (const slot of slotsAtTime) {
        for (const teacherId of slot.teacherIds) {
          const teacherIdStr = teacherId.toString();
          if (teacherMap.has(teacherIdStr)) {
            // Teacher conflict found
            const conflictingSlot = teacherMap.get(teacherIdStr);
            const teacher = slot.teacherIds.find(t => t._id.toString() === teacherIdStr);
            
            conflicts.push({
              type: 'teacher_double_booked',
              teacherId: teacherIdStr,
              teacherName: teacher?.fullName || 'Unknown Teacher',
              dayIndex: slot.dayIndex,
              slotIndex: slot.slotIndex,
              conflictingSlots: [
                {
                  id: conflictingSlot._id,
                  subject: conflictingSlot.subjectId?.name || 'Unknown Subject',
                  program: conflictingSlot.programId?.name || 'Unknown Program',
                  semester: conflictingSlot.semester,
                  section: conflictingSlot.section
                },
                {
                  id: slot._id,
                  subject: slot.subjectId?.name || 'Unknown Subject',
                  program: slot.programId?.name || 'Unknown Program',
                  semester: slot.semester,
                  section: slot.section
                }
              ]
            });
          } else {
            teacherMap.set(teacherIdStr, slot);
          }
        }
      }
      
      // Check room conflicts
      const roomMap = new Map();
      
      for (const slot of slotsAtTime) {
        if (slot.roomId) {
          const roomIdStr = slot.roomId._id.toString();
          if (roomMap.has(roomIdStr)) {
            // Room conflict found
            const conflictingSlot = roomMap.get(roomIdStr);
            
            conflicts.push({
              type: 'room_double_booked',
              roomId: roomIdStr,
              roomName: slot.roomId?.name || 'Unknown Room',
              dayIndex: slot.dayIndex,
              slotIndex: slot.slotIndex,
              conflictingSlots: [
                {
                  id: conflictingSlot._id,
                  subject: conflictingSlot.subjectId?.name || 'Unknown Subject',
                  program: conflictingSlot.programId?.name || 'Unknown Program',
                  semester: conflictingSlot.semester,
                  section: conflictingSlot.section
                },
                {
                  id: slot._id,
                  subject: slot.subjectId?.name || 'Unknown Subject',
                  program: slot.programId?.name || 'Unknown Program',
                  semester: slot.semester,
                  section: slot.section
                }
              ]
            });
          } else {
            roomMap.set(roomIdStr, slot);
          }
        }
      }
      
      // Check section conflicts (same program, semester and section at the same time)
      const sectionMap = new Map();
      
      for (const slot of slotsAtTime) {
        if (slot.programId && slot.semester && slot.section) {
          const sectionKey = `${slot.programId._id}-${slot.semester}-${slot.section}`;
          if (sectionMap.has(sectionKey)) {
            // Section conflict found
            const conflictingSlot = sectionMap.get(sectionKey);
            
            conflicts.push({
              type: 'section_double_booked',
              program: slot.programId?.name || 'Unknown Program',
              semester: slot.semester,
              section: slot.section,
              dayIndex: slot.dayIndex,
              slotIndex: slot.slotIndex,
              conflictingSlots: [
                {
                  id: conflictingSlot._id,
                  subject: conflictingSlot.subjectId?.name || 'Unknown Subject',
                  teachers: conflictingSlot.teacherIds.map(t => t.shortName || 'Unknown').join(', ')
                },
                {
                  id: slot._id,
                  subject: slot.subjectId?.name || 'Unknown Subject',
                  teachers: slot.teacherIds.map(t => t.shortName || 'Unknown').join(', ')
                }
              ]
            });
          } else {
            sectionMap.set(sectionKey, slot);
          }
        }
      }
    }
  }
  
  return conflicts;
};

module.exports = {
  ConflictDetectionService,
  validateSchedule: ConflictDetectionService.validateSchedule,
  checkSlotConflicts: ConflictDetectionService.checkSlotConflicts,
  analyzeAllConflicts: ConflictDetectionService.analyzeAllConflicts
};
