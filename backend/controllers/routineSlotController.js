const RoutineSlot = require('../models/RoutineSlot');
const RoutineSlotNew = require('../models/RoutineSlotNew');
const { validationResult } = require('express-validator');
const conflictDetection = require('../services/conflictDetection');

// @desc    Create a new routine slot
// @route   POST /api/routine-slots
// @access  Private/Admin
exports.createRoutineSlot = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Check for conflicts before creating
    const conflicts = await conflictDetection.checkSlotConflicts(req.body);
    
    if (conflicts.hasConflicts) {
      return res.status(400).json({
        msg: 'Scheduling conflicts detected',
        conflicts: conflicts.conflicts
      });
    }

    const routineSlot = new RoutineSlot(req.body);
    await routineSlot.save();
    
    // Populate references for response
    await routineSlot.populate([
      { path: 'programId', select: 'code name' },
      { path: 'subjectId', select: 'code name weeklyHours' },
      { path: 'teacherIds', select: 'shortName fullName' },
      { path: 'roomId', select: 'name building capacity' },
      { path: 'academicYearId', select: 'title nepaliYear' }
    ]);
    
    res.status(201).json(routineSlot);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get all routine slots
// @route   GET /api/routine-slots
// @access  Private
exports.getRoutineSlots = async (req, res) => {
  try {
    const {
      academicYearId,
      programId,
      semester,
      year,
      section,
      dayIndex,
      teacherId,
      roomId,
      isActive
    } = req.query;

    const filter = {};
    
    if (academicYearId) filter.academicYearId = academicYearId;
    if (programId) filter.programId = programId;
    if (semester) filter.semester = parseInt(semester);
    if (year) filter.year = parseInt(year);
    if (section) filter.section = section;
    if (dayIndex !== undefined) filter.dayIndex = parseInt(dayIndex);
    if (teacherId) filter.teacherIds = teacherId;
    if (roomId) filter.roomId = roomId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const routineSlots = await RoutineSlot.find(filter)
      .populate([
        { path: 'programId', select: 'code name' },
        { path: 'subjectId', select: 'code name weeklyHours hasLab' },
        { path: 'teacherIds', select: 'shortName fullName designation' },
        { path: 'roomId', select: 'name building capacity type' },
        { path: 'academicYearId', select: 'title nepaliYear' },
        { path: 'labGroupId', select: 'name groups' }
      ])
      .sort({ dayIndex: 1, slotIndex: 1 });
      
    res.json(routineSlots);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get routine slot by ID
// @route   GET /api/routine-slots/:id
// @access  Private
exports.getRoutineSlotById = async (req, res) => {
  try {
    const routineSlot = await RoutineSlot.findById(req.params.id)
      .populate([
        { path: 'programId', select: 'code name fullName' },
        { path: 'subjectId', select: 'code name weeklyHours hasLab isElective' },
        { path: 'teacherIds', select: 'shortName fullName designation email' },
        { path: 'roomId', select: 'name building capacity type equipment' },
        { path: 'academicYearId', select: 'title nepaliYear startDate endDate' },
        { path: 'labGroupId', select: 'name groups maxStudents' }
      ]);
    
    if (!routineSlot) {
      return res.status(404).json({ msg: 'Routine slot not found' });
    }

    res.json(routineSlot);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Routine slot not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Update routine slot
// @route   PUT /api/routine-slots/:id
// @access  Private/Admin
exports.updateRoutineSlot = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let routineSlot = await RoutineSlot.findById(req.params.id);
    
    if (!routineSlot) {
      return res.status(404).json({ msg: 'Routine slot not found' });
    }

    // Check for conflicts with the updated data
    const updateData = { ...req.body, _id: req.params.id };
    const conflicts = await conflictDetection.checkSlotConflicts(updateData);
    
    if (conflicts.hasConflicts) {
      return res.status(400).json({
        msg: 'Scheduling conflicts detected',
        conflicts: conflicts.conflicts
      });
    }

    routineSlot = await RoutineSlot.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate([
      { path: 'programId', select: 'code name' },
      { path: 'subjectId', select: 'code name weeklyHours' },
      { path: 'teacherIds', select: 'shortName fullName' },
      { path: 'roomId', select: 'name building capacity' },
      { path: 'academicYearId', select: 'title nepaliYear' }
    ]);

    res.json(routineSlot);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Routine slot not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Delete routine slot (soft delete)
// @route   DELETE /api/routine-slots/:id
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

    res.json({ msg: 'Routine slot deactivated successfully' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Routine slot not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get weekly schedule
// @route   GET /api/routine-slots/schedule/weekly
// @access  Private
exports.getWeeklySchedule = async (req, res) => {
  try {
    const { academicYearId, programId, semester, year, section } = req.query;
    
    const filter = { isActive: true };
    if (academicYearId) filter.academicYearId = academicYearId;
    if (programId) filter.programId = programId;
    if (semester) filter.semester = parseInt(semester);
    if (year) filter.year = parseInt(year);
    if (section) filter.section = section;

    const slots = await RoutineSlot.find(filter)
      .populate([
        { path: 'subjectId', select: 'code name' },
        { path: 'teacherIds', select: 'shortName' },
        { path: 'roomId', select: 'name' }
      ])
      .sort({ dayIndex: 1, slotIndex: 1 });

    // Organize by day and time slot
    const schedule = {
      0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] // Sunday to Saturday
    };

    slots.forEach(slot => {
      const scheduleEntry = {
        _id: slot._id,
        slotIndex: slot.slotIndex,
        subjectCode: slot.display.subjectCode || slot.subjectId?.code,
        subjectName: slot.display.subjectName || slot.subjectId?.name,
        teacherName: slot.display.teacherName || slot.teacherIds?.map(t => t.shortName).join(', '),
        roomName: slot.display.roomName || slot.roomId?.name,
        classType: slot.classType,
        recurrence: slot.recurrence,
        labGroupName: slot.labGroupName,
        notes: slot.notes
      };

      schedule[slot.dayIndex].push(scheduleEntry);
    });

    res.json(schedule);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Check for conflicts
// @route   POST /api/routine-slots/check-conflicts
// @access  Private/Admin
exports.checkConflicts = async (req, res) => {
  try {
    const conflicts = await conflictDetection.checkSlotConflicts(req.body);
    res.json(conflicts);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Bulk create routine slots
// @route   POST /api/routine-slots/bulk
// @access  Private/Admin
exports.bulkCreateRoutineSlots = async (req, res) => {
  try {
    const { slots } = req.body;
    
    if (!Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ msg: 'Slots array is required' });
    }

    const results = {
      created: [],
      failed: [],
      conflicts: []
    };

    for (const slotData of slots) {
      try {
        // Check for conflicts
        const conflicts = await conflictDetection.checkSlotConflicts(slotData);
        
        if (conflicts.hasConflicts) {
          results.conflicts.push({
            slotData,
            conflicts: conflicts.conflicts
          });
          continue;
        }

        const routineSlot = new RoutineSlot(slotData);
        await routineSlot.save();
        results.created.push(routineSlot._id);
        
      } catch (err) {
        results.failed.push({
          slotData,
          error: err.message
        });
      }
    }

    res.json({
      msg: 'Bulk operation completed',
      summary: {
        total: slots.length,
        created: results.created.length,
        failed: results.failed.length,
        conflicts: results.conflicts.length
      },
      results
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};
