const AcademicCalendar = require('../models/AcademicCalendar');
const { validationResult } = require('express-validator');

// @desc    Create a new academic calendar
// @route   POST /api/academic-calendars
// @access  Private/Admin
exports.createAcademicCalendar = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // If setting as current year, deactivate others
    if (req.body.isCurrentYear === true) {
      await AcademicCalendar.updateMany(
        { isCurrentYear: true },
        { isCurrentYear: false }
      );
    }

    const calendar = new AcademicCalendar(req.body);
    await calendar.save();
    res.status(201).json(calendar);
  } catch (err) {
    console.error(err.message);
    if (err.code === 11000) {
      return res.status(400).json({ 
        msg: 'Academic calendar with this Nepali year already exists' 
      });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get all academic calendars
// @route   GET /api/academic-calendars
// @access  Private
exports.getAcademicCalendars = async (req, res) => {
  try {
    const { status, isCurrentYear } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (isCurrentYear !== undefined) filter.isCurrentYear = isCurrentYear === 'true';

    const calendars = await AcademicCalendar.find(filter)
      .sort({ nepaliYear: -1 });
      
    res.json(calendars);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get current academic calendar
// @route   GET /api/academic-calendars/current
// @access  Private
exports.getCurrentAcademicCalendar = async (req, res) => {
  try {
    const calendar = await AcademicCalendar.findOne({ isCurrentYear: true });
    
    if (!calendar) {
      return res.status(404).json({ msg: 'No current academic calendar found' });
    }

    // Add computed fields
    const result = {
      ...calendar.toObject(),
      computed: {
        isCurrentAcademicYear: calendar.isCurrentAcademicYear(),
        currentTerm: calendar.getCurrentTerm(),
        weeksRemaining: calendar.getWeeksRemaining()
      }
    };

    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get academic calendar by ID
// @route   GET /api/academic-calendars/:id
// @access  Private
exports.getAcademicCalendarById = async (req, res) => {
  try {
    const calendar = await AcademicCalendar.findById(req.params.id);
    
    if (!calendar) {
      return res.status(404).json({ msg: 'Academic calendar not found' });
    }

    res.json(calendar);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Academic calendar not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Update academic calendar
// @route   PUT /api/academic-calendars/:id
// @access  Private/Admin
exports.updateAcademicCalendar = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let calendar = await AcademicCalendar.findById(req.params.id);
    
    if (!calendar) {
      return res.status(404).json({ msg: 'Academic calendar not found' });
    }

    // If setting as current year, deactivate others
    if (req.body.isCurrentYear === true) {
      await AcademicCalendar.updateMany(
        { isCurrentYear: true, _id: { $ne: req.params.id } },
        { isCurrentYear: false }
      );
    }

    calendar = await AcademicCalendar.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.json(calendar);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Academic calendar not found' });
    }
    if (err.code === 11000) {
      return res.status(400).json({ 
        msg: 'Academic calendar with this Nepali year already exists' 
      });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Delete academic calendar
// @route   DELETE /api/academic-calendars/:id
// @access  Private/Admin
exports.deleteAcademicCalendar = async (req, res) => {
  try {
    const calendar = await AcademicCalendar.findById(req.params.id);
    
    if (!calendar) {
      return res.status(404).json({ msg: 'Academic calendar not found' });
    }

    if (calendar.isCurrentYear) {
      return res.status(400).json({ 
        msg: 'Cannot delete the current academic calendar' 
      });
    }

    await AcademicCalendar.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Academic calendar deleted successfully' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Academic calendar not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Update current week
// @route   PUT /api/academic-calendars/current/week
// @access  Private/Admin
exports.updateCurrentWeek = async (req, res) => {
  try {
    const { currentWeek } = req.body;
    
    if (!currentWeek || currentWeek < 1 || currentWeek > 16) {
      return res.status(400).json({ 
        msg: 'Current week must be between 1 and 16' 
      });
    }

    const calendar = await AcademicCalendar.findOneAndUpdate(
      { isCurrentYear: true },
      { currentWeek },
      { new: true }
    );

    if (!calendar) {
      return res.status(404).json({ msg: 'No current academic calendar found' });
    }

    res.json(calendar);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};
