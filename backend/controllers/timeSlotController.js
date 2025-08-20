const TimeSlot = require('../models/TimeSlot');
const { validationResult } = require('express-validator');
const { getTimeSlotsSorted, findInsertPosition, reorderTimeSlots } = require('../utils/timeSlotUtils');

// @desc    Create a new time slot
// @route   POST /api/time-slots
// @access  Private/Admin
exports.createTimeSlot = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Determine if this is a context-specific time slot
    const { programCode, semester, section } = req.body;
    const isContextSpecific = programCode || semester || section;
    
    // Set isGlobal flag
    req.body.isGlobal = !isContextSpecific;
    
    // Auto-generate _id if not provided
    if (!req.body._id) {
      // Find the highest existing _id and increment (for both global and context-specific)
      const lastTimeSlot = await TimeSlot.findOne().sort({ _id: -1 });
      req.body._id = lastTimeSlot ? lastTimeSlot._id + 1 : 1;
    }
    
    // Calculate chronological sortOrder based on start time
    if (!req.body.sortOrder) {
      const newStartTime = req.body.startTime;
      
      // Get existing time slots for the same context (global or specific program/semester/section)
      const contextFilter = isContextSpecific 
        ? { 
            isGlobal: false,
            ...(programCode && { programCode }),
            ...(semester && { semester: parseInt(semester) }),
            ...(section && { section: section.toUpperCase() })
          }
        : { isGlobal: true };
      
      const existingSlots = await TimeSlot.find(contextFilter).sort({ sortOrder: 1 });
      
      const { insertPosition, foundPosition } = findInsertPosition(newStartTime, existingSlots);
      
      if (foundPosition) {
        // Shift all subsequent slots in the same context by 1 to make room
        await TimeSlot.updateMany(
          { 
            ...contextFilter,
            sortOrder: { $gte: insertPosition } 
          },
          { $inc: { sortOrder: 1 } }
        );
      }
      
      req.body.sortOrder = insertPosition;
    }
    
    const timeSlot = new TimeSlot(req.body);
    await timeSlot.save();
    
    res.status(201).json(timeSlot);
  } catch (err) {
    console.error(err.message);
    if (err.code === 11000) {
      if (err.keyPattern?._id) {
        return res.status(400).json({ msg: 'Time slot with this slot index already exists' });
      }
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Create a context-specific time slot for program/semester/section
// @route   POST /api/time-slots/context/:programCode/:semester/:section
// @access  Private/Admin
exports.createContextTimeSlot = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { programCode, semester, section } = req.params;
    
    // Add context to request body
    req.body.programCode = programCode;
    req.body.semester = parseInt(semester);
    req.body.section = section.toUpperCase();
    req.body.isGlobal = false;
    
    // Auto-generate _id if not provided
    if (!req.body._id) {
      const lastTimeSlot = await TimeSlot.findOne().sort({ _id: -1 });
      req.body._id = lastTimeSlot ? lastTimeSlot._id + 1 : 1;
    }
    
    // Calculate sortOrder for this specific context
    if (!req.body.sortOrder) {
      const contextFilter = {
        isGlobal: false,
        programCode,
        semester: parseInt(semester),
        section: section.toUpperCase()
      };
      
      const existingSlots = await TimeSlot.find(contextFilter).sort({ sortOrder: 1 });
      req.body.sortOrder = existingSlots.length + 1;
    }
    
    const timeSlot = new TimeSlot(req.body);
    await timeSlot.save();
    
    res.status(201).json({
      success: true,
      message: `Time slot created for ${programCode} Semester ${semester} Section ${section}`,
      timeSlot
    });
  } catch (err) {
    console.error('Context time slot creation error:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get all time slots
// @route   GET /api/time-slots
// @access  Private
exports.getTimeSlots = async (req, res) => {
  try {
    const { dayType, category, programCode, semester, section, includeGlobal = 'true', includeAll = 'false' } = req.query;
    
    // Build filter for context-specific or global time slots
    const filters = [];
    
    // If includeAll is true, fetch ALL time slots regardless of context
    if (includeAll === 'true') {
      // Fetch all time slots (both global and context-specific)
      const allFilters = [];
      
      // Include global time slots
      allFilters.push({ 
        $or: [
          { isGlobal: true },
          { isGlobal: { $exists: false } }, // Legacy time slots without isGlobal field
          { isGlobal: null }
        ]
      });
      
      // Include all context-specific time slots
      allFilters.push({ isGlobal: false });
      
      const mainFilter = { $or: allFilters };
      
      // Add additional filters
      if (dayType) mainFilter.dayType = dayType;
      if (category) mainFilter.category = category;

      const timeSlots = await TimeSlot.find(mainFilter).sort({ sortOrder: 1 });
      res.json(timeSlots);
      return;
    }
    
    // Always include global time slots unless explicitly excluded
    if (includeGlobal === 'true') {
      // Include both isGlobal: true AND null/undefined (for legacy time slots)
      filters.push({ 
        $or: [
          { isGlobal: true },
          { isGlobal: { $exists: false } }, // Legacy time slots without isGlobal field
          { isGlobal: null }
        ]
      });
    }
    
    // Add context-specific time slots if context is provided
    if (programCode || semester || section) {
      const contextFilter = { isGlobal: false };
      
      if (programCode) contextFilter.programCode = programCode;
      if (semester) contextFilter.semester = parseInt(semester);
      if (section) contextFilter.section = section.toUpperCase();
      
      filters.push(contextFilter);
    }
    
    // Build the main filter
    const mainFilter = filters.length > 1 ? { $or: filters } : (filters[0] || {});
    
    // Add additional filters
    if (dayType) mainFilter.dayType = dayType;
    if (category) mainFilter.category = category;

    const timeSlots = await TimeSlot.find(mainFilter).sort({ sortOrder: 1 });
    res.json(timeSlots);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get time slots by category
// @route   GET /api/time-slots/category/:category
// @access  Private
exports.getTimeSlotsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    if (!['Morning', 'Afternoon', 'Evening'].includes(category)) {
      return res.status(400).json({ msg: 'Invalid category. Must be Morning, Afternoon, or Evening' });
    }
    
    const timeSlots = await TimeSlot.find({ category }).sort({ sortOrder: 1 });
    res.json(timeSlots);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Initialize default time slots
// @route   POST /api/time-slots/initialize
// @access  Private/Admin
exports.initializeTimeSlots = async (req, res) => {
  try {
    // Define default time slots for Regular days
    const defaultTimeSlots = [
      { _id: 1, label: '10:15-11:05', startTime: '10:15', endTime: '11:05', sortOrder: 1, dayType: 'Regular', category: 'Morning', isBreak: false },
      { _id: 2, label: '11:05-11:55', startTime: '11:05', endTime: '11:55', sortOrder: 2, dayType: 'Regular', category: 'Morning', isBreak: false },
      { _id: 3, label: '11:55-12:45', startTime: '11:55', endTime: '12:45', sortOrder: 3, dayType: 'Regular', category: 'Morning', isBreak: false },
      { _id: 4, label: '12:45-13:35', startTime: '12:45', endTime: '13:35', sortOrder: 4, dayType: 'Regular', category: 'Afternoon', isBreak: false },
      { _id: 5, label: '13:35-14:25', startTime: '13:35', endTime: '14:25', sortOrder: 5, dayType: 'Regular', category: 'Afternoon', isBreak: false },
      { _id: 6, label: '14:25-15:15', startTime: '14:25', endTime: '15:15', sortOrder: 6, dayType: 'Regular', category: 'Afternoon', isBreak: false },
      { _id: 7, label: '15:15-16:05', startTime: '15:15', endTime: '16:05', sortOrder: 7, dayType: 'Regular', category: 'Afternoon', isBreak: false },
      { _id: 8, label: '16:05-16:55', startTime: '16:05', endTime: '16:55', sortOrder: 8, dayType: 'Regular', category: 'Evening', isBreak: false }
    ];
    
    // Insert all the default time slots
    const insertedSlots = await TimeSlot.insertMany(defaultTimeSlots, { ordered: false });
    
    res.status(201).json({
      message: 'Default time slots initialized successfully',
      count: insertedSlots.length,
      timeSlots: insertedSlots
    });
  } catch (err) {
    console.error(err.message);
    
    // Handle duplicate key errors gracefully
    if (err.code === 11000) {
      return res.status(400).json({
        msg: 'Some time slots already exist',
        error: 'Duplicate slot indexes detected'
      });
    }
    
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get time slot by ID (slotIndex)
// @route   GET /api/time-slots/:id
// @access  Private
exports.getTimeSlotById = async (req, res) => {
  try {
    // Convert the ID to number since TimeSlot._id is a Number
    const timeSlotId = parseInt(req.params.id);
    
    if (isNaN(timeSlotId)) {
      return res.status(400).json({ msg: 'Invalid time slot ID. Must be a number.' });
    }
    
    const timeSlot = await TimeSlot.findById(timeSlotId);
    
    if (!timeSlot) {
      return res.status(404).json({ msg: 'Time slot not found' });
    }

    res.json(timeSlot);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Update time slot
// @route   PUT /api/time-slots/:id
// @access  Private/Admin
exports.updateTimeSlot = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Convert the ID to number since TimeSlot._id is a Number
    const timeSlotId = parseInt(req.params.id);
    
    if (isNaN(timeSlotId)) {
      return res.status(400).json({ msg: 'Invalid time slot ID. Must be a number.' });
    }
    
    let timeSlot = await TimeSlot.findById(timeSlotId);
    
    if (!timeSlot) {
      return res.status(404).json({ msg: 'Time slot not found' });
    }

    timeSlot = await TimeSlot.findByIdAndUpdate(
      timeSlotId,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.json(timeSlot);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Bulk delete time slots
// @route   DELETE /api/time-slots/bulk
// @access  Private/Admin
exports.bulkDeleteTimeSlots = async (req, res) => {
  try {
    let timeSlotIds;
    
    // Handle both direct array and wrapped format
    if (Array.isArray(req.body)) {
      timeSlotIds = req.body;
    } else if (req.body.timeSlotIds && Array.isArray(req.body.timeSlotIds)) {
      timeSlotIds = req.body.timeSlotIds;
    } else if (req.body.ids && Array.isArray(req.body.ids)) {
      timeSlotIds = req.body.ids;
    } else {
      return res.status(400).json({ 
        success: false,
        msg: 'Invalid request format. Expected array of time slot IDs or object with timeSlotIds/ids array.' 
      });
    }

    if (!timeSlotIds.length) {
      return res.status(400).json({ 
        success: false,
        msg: 'No time slot IDs provided' 
      });
    }

    // Check which time slots exist
    const existingTimeSlots = await TimeSlot.find({ _id: { $in: timeSlotIds } });
    const existingIds = existingTimeSlots.map(slot => slot._id.toString());
    const notFoundIds = timeSlotIds.filter(id => !existingIds.includes(id.toString()));

    if (existingTimeSlots.length === 0) {
      return res.status(404).json({
        success: false,
        msg: 'No time slots found with the provided IDs',
        notFoundIds,
        notFoundCount: notFoundIds.length
      });
    }

    // Check usage constraints for existing time slots
    const RoutineSlot = require('../models/RoutineSlot');
    const constrainedSlots = [];
    const deletableSlots = [];

    for (const timeSlot of existingTimeSlots) {
      const usageCount = await RoutineSlot.countDocuments({
        slotIndex: timeSlot._id,
        isActive: true
      });

      if (usageCount > 0) {
        constrainedSlots.push({
          id: timeSlot._id,
          label: timeSlot.label,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
          reason: `Used in ${usageCount} active routine slots`
        });
      } else {
        deletableSlots.push(timeSlot);
      }
    }

    // Delete time slots that are not constrained
    let deletedCount = 0;
    const deletedTimeSlots = [];

    if (deletableSlots.length > 0) {
      const deletableIds = deletableSlots.map(slot => slot._id);
      const deleteResult = await TimeSlot.deleteMany({ _id: { $in: deletableIds } });
      deletedCount = deleteResult.deletedCount;

      // Track deleted time slots for response
      deletableSlots.forEach(slot => {
        deletedTimeSlots.push({
          id: slot._id,
          label: slot.label,
          startTime: slot.startTime,
          endTime: slot.endTime
        });
      });
    }

    // Prepare response message
    let message = '';
    if (deletedCount > 0 && constrainedSlots.length > 0) {
      message = `Successfully deleted ${deletedCount} time slots, ${constrainedSlots.length} skipped due to constraints`;
    } else if (deletedCount > 0) {
      message = `Successfully deleted ${deletedCount} time slots`;
    } else {
      message = `No time slots could be deleted due to constraints`;
    }

    res.json({
      success: true,
      message,
      deletedCount,
      deletedTimeSlots,
      skippedTimeSlots: constrainedSlots,
      skippedCount: constrainedSlots.length,
      notFoundIds,
      notFoundCount: notFoundIds.length,
      totalProcessed: existingTimeSlots.length
    });

  } catch (err) {
    console.error('Bulk delete time slots error:', err.message);
    res.status(500).json({ 
      success: false,
      msg: 'Server error during bulk deletion', 
      error: err.message 
    });
  }
};

// @desc    Delete time slot
// @route   DELETE /api/time-slots/:id
// @access  Private/Admin
exports.deleteTimeSlot = async (req, res) => {
  try {
    console.log('Delete time slot request for ID:', req.params.id, typeof req.params.id);
    
    // Convert the ID to number since TimeSlot._id is a Number
    const timeSlotId = parseInt(req.params.id);
    
    if (isNaN(timeSlotId)) {
      console.log('Invalid timeSlotId conversion:', req.params.id, '->', timeSlotId);
      return res.status(400).json({ msg: 'Invalid time slot ID. Must be a number.' });
    }
    
    console.log('Looking for TimeSlot with ID:', timeSlotId, typeof timeSlotId);
    const timeSlot = await TimeSlot.findById(timeSlotId);
    
    if (!timeSlot) {
      console.log('TimeSlot not found with ID:', timeSlotId);
      return res.status(404).json({ msg: 'Time slot not found' });
    }

    console.log('Found TimeSlot:', timeSlot.label, timeSlot.startTime, '-', timeSlot.endTime);

    // Check if time slot is being used in routine slots
    const RoutineSlot = require('../models/RoutineSlot');
    console.log('Checking usage with slotIndex:', timeSlotId);
    const usageCount = await RoutineSlot.countDocuments({
      slotIndex: timeSlotId,
      isActive: true
    });
    
    console.log('Usage count for slotIndex', timeSlotId, ':', usageCount);

    // Check for force delete parameter
    const forceDelete = req.query.force === 'true';

    if (usageCount > 0 && !forceDelete) {
      // Get sample usage info for better error message
      let sampleUsage = null;
      try {
        sampleUsage = await RoutineSlot.findOne({
          slotIndex: timeSlotId,
          isActive: true
        }).populate('subjectId teacherIds');
      } catch (populateError) {
        console.warn('Populate error in delete time slot:', populateError.message);
        // Fallback: get without populate if populate fails
        sampleUsage = await RoutineSlot.findOne({
          slotIndex: timeSlotId,
          isActive: true
        });
      }

      return res.status(400).json({ 
        msg: `Cannot delete time slot. It is being used in ${usageCount} active routine slots.`,
        usageCount,
        canForceDelete: true,
        sampleUsage: sampleUsage ? {
          subject: sampleUsage.subjectId?.name || sampleUsage.display?.subjectName || 'Unknown Subject',
          teacher: sampleUsage.teacherIds?.[0]?.name || sampleUsage.display?.teacherNames?.[0] || 'Unknown Teacher',
          day: sampleUsage.dayIndex || sampleUsage.day || 'Unknown Day'
        } : null,
        suggestion: 'You can force delete this time slot, which will remove it from all routine slots, or first remove the time slot from routine assignments.'
      });
    }

    if (forceDelete && usageCount > 0) {
      // Remove the time slot from all routine slots first
      await RoutineSlot.deleteMany({
        slotIndex: timeSlotId
      });
    }

    await TimeSlot.findByIdAndDelete(timeSlotId);
    
    const responseMsg = forceDelete && usageCount > 0 
      ? `Time slot deleted successfully. Removed from ${usageCount} routine slots.`
      : 'Time slot deleted successfully';
      
    res.json({ 
      msg: responseMsg,
      removedFromSlots: forceDelete ? usageCount : 0
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Reorder all time slots chronologically
// @route   POST /api/time-slots/reorder
// @access  Private/Admin
exports.reorderTimeSlots = async (req, res) => {
  try {
    const result = await reorderTimeSlots();
    res.json(result);
  } catch (err) {
    console.error('Reorder time slots error:', err.message);
    res.status(500).json({ 
      success: false,
      msg: 'Server error during reordering', 
      error: err.message 
    });
  }
};
