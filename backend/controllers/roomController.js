const Room = require('../models/Room');
const { validationResult } = require('express-validator');
// ExcelJS has been removed
const RoutineSlot = require('../models/RoutineSlot');
const AcademicCalendar = require('../models/AcademicCalendar');
const PDFRoutineService = require('../services/PDFRoutineService');
const { getLabGroupsForSection } = require('../utils/sectionUtils');

// Helper function removed - now using dynamic sectionUtils.getLabGroupsForSection()

// @desc    Get all rooms
// @route   GET /api/rooms
// @access  Private
exports.getRooms = async (req, res) => {
  try {
    const rooms = await Room.find().sort({ name: 1 });
    res.json({
      success: true,
      count: rooms.length,
      data: rooms
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @desc    Get single room by ID
// @route   GET /api/rooms/:id
// @access  Private
exports.getRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    res.json({
      success: true,
      data: room
    });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    res.status(500).send('Server error');
  }
};

// @desc    Create a room
// @route   POST /api/rooms
// @access  Private/Admin
exports.createRoom = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { name, building, capacity, type, features } = req.body;

    // Check if room with same name already exists
    let room = await Room.findOne({ name });
    if (room) {
      return res.status(400).json({
        success: false,
        message: 'Room with that name already exists'
      });
    }

    // Create new room
    room = new Room({
      name,
      building,
      capacity,
      type,
      features
    });

    await room.save();

    res.status(201).json({
      success: true,
      data: room,
      message: 'Room created successfully'
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @desc    Update a room
// @route   PUT /api/rooms/:id
// @access  Private/Admin
exports.updateRoom = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { name, building, capacity, type, features } = req.body;

    // Check if room exists
    let room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if updated name conflicts with another room
    if (name && name !== room.name) {
      const existingRoom = await Room.findOne({ name });
      if (existingRoom && existingRoom._id.toString() !== req.params.id) {
        return res.status(400).json({
          success: false,
          message: 'Another room with that name already exists'
        });
      }
    }

    // Update room
    room.name = name || room.name;
    room.building = building || room.building;
    room.capacity = capacity || room.capacity;
    room.type = type || room.type;
    room.features = features || room.features;

    await room.save();

    res.json({
      success: true,
      data: room,
      message: 'Room updated successfully'
    });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    res.status(500).send('Server error');
  }
};

// @desc    Delete a room
// @route   DELETE /api/rooms/:id
// @access  Private/Admin
exports.deleteRoom = async (req, res) => {
  try {
    // Check if room exists
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if room is used in routine slots
    const routineSlots = await RoutineSlot.find({ roomId: req.params.id });
    if (routineSlots.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete room. It is used in ${routineSlots.length} routine slots.`
      });
    }

    // Use findByIdAndDelete instead of deprecated remove()
    await Room.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Room deleted successfully'
    });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    res.status(500).send('Server error');
  }
};

// @desc    Export room schedule to PDF
// @route   GET /api/rooms/:id/export
// @access  Private/Admin
exports.exportRoomSchedule = async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const { academicYear } = req.query;

    // Get room info
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Generate PDF
    const pdfService = new PDFRoutineService();
    const doc = await pdfService.generateRoomSchedulePDF(roomId, academicYear);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${room.name}_schedule.pdf"`);

    // Pipe the PDF to response
    doc.pipe(res);
    doc.end();

  } catch (error) {
    console.error('Error in room PDF export:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// @desc    Export all room schedules to PDF
// @route   GET /api/rooms/export/all
// @access  Private/Admin
exports.exportAllRoomSchedules = async (req, res) => {
  try {
    const { academicYear } = req.query;

    // Get all active rooms
    const rooms = await Room.find({ isActive: { $ne: false } }).sort({ name: 1 });
    
    if (rooms.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No rooms found'
      });
    }

    // Generate combined PDF for all rooms
    const pdfService = new PDFRoutineService();
    const doc = await pdfService.generateAllRoomsSchedulePDF(rooms, academicYear);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="all_rooms_schedule.pdf"`);

    // Pipe the PDF to response
    doc.pipe(res);
    doc.end();

  } catch (error) {
    console.error('Error in all rooms PDF export:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};
