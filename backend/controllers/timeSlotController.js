const TimeSlot = require('../models/TimeSlot');
const { validationResult } = require('express-validator');

// @desc    Create a new time slot
// @route   POST /api/time-slots
// @access  Private/Admin
exports.createTimeSlot = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
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

// @desc    Get all time slots
// @route   GET /api/time-slots
// @access  Private
exports.getTimeSlots = async (req, res) => {
  try {
    const { dayType, category } = req.query;
    const filter = {};
    
    if (dayType) filter.dayType = dayType;
    if (category) filter.category = category;

    const timeSlots = await TimeSlot.find(filter).sort({ sortOrder: 1 });
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
    const timeSlot = await TimeSlot.findById(req.params.id);
    
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
    let timeSlot = await TimeSlot.findById(req.params.id);
    
    if (!timeSlot) {
      return res.status(404).json({ msg: 'Time slot not found' });
    }

    timeSlot = await TimeSlot.findByIdAndUpdate(
      req.params.id,
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
    const timeSlot = await TimeSlot.findById(req.params.id);
    
    if (!timeSlot) {
      return res.status(404).json({ msg: 'Time slot not found' });
    }

    // Check if time slot is being used in routine slots
    const RoutineSlot = require('../models/RoutineSlot');
    const usageCount = await RoutineSlot.countDocuments({
      slotIndex: req.params.id,
      isActive: true
    });

    if (usageCount > 0) {
      return res.status(400).json({ 
        msg: `Cannot delete time slot. It is being used in ${usageCount} active routine slots.` 
      });
    }

    await TimeSlot.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Time slot deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};
