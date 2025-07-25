const Room = require('../models/Room');
const { validationResult } = require('express-validator');
const ExcelJS = require('exceljs');
const RoutineSlot = require('../models/RoutineSlot');
const AcademicCalendar = require('../models/AcademicCalendar');

// Helper function to get lab groups for a section
const getLabGroupsForSection = (section) => {
  switch(section) {
    case 'AB':
      return ['A', 'B'];
    case 'CD':
      return ['C', 'D'];
    default:
      return ['A', 'B']; // Default fallback
  }
};

// Helper function to get section-appropriate lab group label
const getSectionLabGroupLabel = (labGroup, section) => {
  if (!labGroup) return '';
  
  const sectionGroups = getLabGroupsForSection(section);
  
  // If labGroup is 'ALL', show both groups for the section
  if (labGroup === 'ALL') {
    return `Groups ${sectionGroups.join(' & ')}`;
  }
  
  // For specific groups, just show the group letter
  return `Group ${labGroup}`;
};

// @desc    Get all rooms
// @route   GET /api/rooms
// @access  Public
exports.getRooms = async (req, res) => {
  try {
    const rooms = await Room.find({ isActive: true }).sort({ building: 1, name: 1 });
    res.json({ success: true, data: rooms });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @desc    Get room by ID
// @route   GET /api/rooms/:id
// @access  Public
exports.getRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      return res.status(404).json({ success: false, msg: 'Room not found' });
    }
    
    res.json({ success: true, data: room });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ success: false, msg: 'Room not found' });
    }
    res.status(500).send('Server error');
  }
};

// @desc    Create room
// @route   POST /api/rooms
// @access  Private/Admin
exports.createRoom = async (req, res) => {
  console.log('Creating room with data:', req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, capacity, type, building, floor, features, notes } = req.body;
    
    // Check if room name already exists
    const existingRoom = await Room.findOne({ name });
    if (existingRoom) {
      return res.status(400).json({ 
        success: false, 
        msg: 'Room with this name already exists' 
      });
    }

    const room = new Room({
      name,
      capacity,
      type,
      building,
      floor,
      features,
      notes
    });

    await room.save();
    res.status(201).json({ success: true, data: room });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @desc    Update room
// @route   PUT /api/rooms/:id
// @access  Private/Admin
exports.updateRoom = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, capacity, type, building, floor, features, notes } = req.body;
    
    let room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, msg: 'Room not found' });
    }

    // Check if new name conflicts with existing room
    if (name && name !== room.name) {
      const existingRoom = await Room.findOne({ name: name });
      if (existingRoom) {
        return res.status(400).json({ 
          success: false, 
          msg: 'Room with this name already exists' 
        });
      }
    }

    const updateFields = {
      name: name || room.name,
      capacity: capacity || room.capacity,
      type: type || room.type,
      building: building || room.building,
      floor: floor !== undefined ? floor : room.floor,
      features: features || room.features,
      notes: notes !== undefined ? notes : room.notes
    };

    room = await Room.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: room });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @desc    Delete room
// @route   DELETE /api/rooms/:id
// @access  Private/Admin
exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      return res.status(404).json({ success: false, msg: 'Room not found' });
    }

    // Soft delete by setting isActive to false
    await Room.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true }
    );

    res.json({ success: true, msg: 'Room deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @desc    Export room schedule to Excel
// @route   GET /api/rooms/:id/export
// @access  Private/Admin
exports.exportRoomSchedule = async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const { academicYear } = req.query;

    // Get current academic year if not provided
    const currentAcademicYear = academicYear ? 
      await AcademicCalendar.findById(academicYear) :
      await AcademicCalendar.findOne({ isCurrentYear: true });

    if (!currentAcademicYear) {
      return res.status(404).json({
        success: false,
        message: 'No academic year found'
      });
    }

    // Get room info
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Get all routine slots for this room
    const routineSlots = await RoutineSlot.find({
      roomId: roomId,
      academicYearId: currentAcademicYear._id,
      isActive: true
    })
    .populate('teacherIds', 'fullName shortName')
    .populate('subjectId', 'name code')
    .sort({ dayIndex: 1, slotIndex: 1 });

    // Create Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${room.name} Schedule`);

    // Set up headers
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const timeSlots = [
      '10:15-11:05',
      '11:05-11:55', 
      '11:55-12:45',
      '12:45-13:35',
      '13:35-14:25',
      '14:25-15:15',
      '15:15-16:05'
    ];

    // Add title
    worksheet.mergeCells('A1:H1');
    worksheet.getCell('A1').value = `${room.name} Weekly Schedule`;
    worksheet.getCell('A1').font = { bold: true, size: 16 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Add room info
    worksheet.mergeCells('A2:H2');
    worksheet.getCell('A2').value = `Building: ${room.building || 'N/A'} | Capacity: ${room.capacity || 'N/A'} | Type: ${room.type || 'Standard'}`;
    worksheet.getCell('A2').font = { size: 12 };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    // Add headers
    worksheet.getCell('A4').value = 'Time';
    worksheet.getCell('A4').font = { bold: true };
    worksheet.getCell('A4').alignment = { horizontal: 'center' };

    for (let i = 0; i < dayNames.length; i++) {
      const col = String.fromCharCode(66 + i); // B, C, D, E, F, G, H
      worksheet.getCell(`${col}4`).value = dayNames[i];
      worksheet.getCell(`${col}4`).font = { bold: true };
      worksheet.getCell(`${col}4`).alignment = { horizontal: 'center' };
    }

    // Build routine grid with multi-class support
    const routineGrid = {};
    
    // First, group slots by day and time to handle multi-class scenarios
    const slotGroups = {};
    
    routineSlots.forEach(slot => {
      const key = `${slot.dayIndex}-${slot.slotIndex}`;
      if (!slotGroups[key]) {
        slotGroups[key] = [];
      }
      
      slotGroups[key].push({
        subject: slot.subjectName_display || slot.subjectId?.name || 'N/A',
        teachers: slot.teacherShortNames_display || slot.teacherIds?.map(t => t.shortName).join(', ') || 'TBA',
        program: `${slot.programCode} Sem${slot.semester} ${slot.section}`,
        type: slot.classType || 'L',
        labGroup: slot.labGroup || slot.section,
        section: slot.section, // Add section field for proper group mapping
        spanId: slot.spanId,
        spanMaster: slot.spanMaster
      });
    });
    
    // Now organize the grouped slots into routine structure
    Object.entries(slotGroups).forEach(([key, classes]) => {
      const [dayIndex, slotIndex] = key.split('-').map(Number);
      
      if (!routineGrid[dayIndex]) {
        routineGrid[dayIndex] = {};
      }
      
      if (classes.length === 1) {
        // Single class
        routineGrid[dayIndex][slotIndex] = classes[0];
      } else {
        // Multiple classes - merge them for display
        const baseClass = classes[0];
        const labGroups = classes.map(cls => {
          const labGroup = cls.labGroup || 'Group';
          return getSectionLabGroupLabel(labGroup, cls.section);
        }).join(' & ');
        const teachersList = [...new Set(classes.flatMap(cls => cls.teachers.split(', ')))].join(', ');
        
        routineGrid[dayIndex][slotIndex] = {
          ...baseClass,
          isMultiGroup: true,
          teachers: teachersList,
          labGroups: labGroups,
          displayText: `${baseClass.subject}\n[${baseClass.type}] (${labGroups})\n${teachersList}\n${baseClass.program}`
        };
      }
    });

    // Fill in the schedule
    for (let slotIndex = 0; slotIndex < timeSlots.length; slotIndex++) {
      const row = 5 + slotIndex;
      
      // Time slot
      worksheet.getCell(`A${row}`).value = timeSlots[slotIndex];
      worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
      
      // For each day
      for (let dayIndex = 0; dayIndex < dayNames.length; dayIndex++) {
        const col = String.fromCharCode(66 + dayIndex); // B, C, D, E, F, G, H
        const cell = worksheet.getCell(`${col}${row}`);          if (routineGrid[dayIndex] && routineGrid[dayIndex][slotIndex]) {
            const classData = routineGrid[dayIndex][slotIndex];
            
            if (classData.isMultiGroup) {
              // Use pre-formatted display text for multi-group classes
              cell.value = classData.displayText;
            } else {
              // Single class display
              const labGroupLabel = classData.labGroup ? getSectionLabGroupLabel(classData.labGroup, classData.section) : '';
              const labGroupDisplay = labGroupLabel ? ` (${labGroupLabel})` : '';
              cell.value = `${classData.subject}\n[${classData.type}]${labGroupDisplay}\n${classData.teachers}\n${classData.program}`;
            }
            
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.font = { size: 10 };
            
            // Color coding for class types
            if (classData.type === 'L') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
            } else if (classData.type === 'P') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E8' } };
            } else if (classData.type === 'T') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
            }
          } else {
            cell.value = '';
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
          }
        
        // Add border
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    }

    // Set column widths
    worksheet.getColumn('A').width = 15;
    for (let i = 1; i <= 7; i++) {
      worksheet.getColumn(i + 1).width = 20;
    }

    // Set row heights
    for (let i = 5; i < 5 + timeSlots.length; i++) {
      worksheet.getRow(i).height = 80;
    }

    // Add legend
    const legendRow = 5 + timeSlots.length + 2;
    worksheet.getCell(`A${legendRow}`).value = 'Legend:';
    worksheet.getCell(`A${legendRow}`).font = { bold: true };
    
    worksheet.getCell(`B${legendRow}`).value = 'L = Lecture';
    worksheet.getCell(`B${legendRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
    
    worksheet.getCell(`C${legendRow}`).value = 'P = Practical';
    worksheet.getCell(`C${legendRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E8' } };
    
    worksheet.getCell(`D${legendRow}`).value = 'T = Tutorial';
    worksheet.getCell(`D${legendRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${room.name.replace(/[^a-zA-Z0-9]/g, '_')}_Schedule.xlsx"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error exporting room schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Export all room schedules to Excel
// @route   GET /api/rooms/export/all
// @access  Private/Admin
exports.exportAllRoomSchedules = async (req, res) => {
  try {
    const { academicYear } = req.query;

    // Get current academic year if not provided
    const currentAcademicYear = academicYear ? 
      await AcademicCalendar.findById(academicYear) :
      await AcademicCalendar.findOne({ isCurrentYear: true });

    if (!currentAcademicYear) {
      return res.status(404).json({
        success: false,
        message: 'No academic year found'
      });
    }

    // Get all active rooms
    const rooms = await Room.find({ isActive: true }).sort({ building: 1, name: 1 });

    if (rooms.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No rooms found'
      });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const timeSlots = [
      '10:15-11:05',
      '11:05-11:55', 
      '11:55-12:45',
      '12:45-13:35',
      '13:35-14:25',
      '14:25-15:15',
      '15:15-16:05'
    ];

    // Create a worksheet for each room
    for (const room of rooms) {
      // Get routine slots for this room
      const routineSlots = await RoutineSlot.find({
        roomId: room._id,
        academicYearId: currentAcademicYear._id,
        isActive: true
      })
      .populate('teacherIds', 'fullName shortName')
      .populate('subjectId', 'name code')
      .sort({ dayIndex: 1, slotIndex: 1 });

      // Create worksheet
      const worksheet = workbook.addWorksheet(room.name.substring(0, 30)); // Excel sheet name limit

      // Add title
      worksheet.mergeCells('A1:H1');
      worksheet.getCell('A1').value = `${room.name} Weekly Schedule`;
      worksheet.getCell('A1').font = { bold: true, size: 16 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      // Add room info
      worksheet.mergeCells('A2:H2');
      worksheet.getCell('A2').value = `Building: ${room.building || 'N/A'} | Capacity: ${room.capacity || 'N/A'} | Type: ${room.type || 'Standard'}`;
      worksheet.getCell('A2').font = { size: 12 };
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      // Add headers
      worksheet.getCell('A4').value = 'Time';
      worksheet.getCell('A4').font = { bold: true };
      worksheet.getCell('A4').alignment = { horizontal: 'center' };

      for (let i = 0; i < dayNames.length; i++) {
        const col = String.fromCharCode(66 + i);
        worksheet.getCell(`${col}4`).value = dayNames[i];
        worksheet.getCell(`${col}4`).font = { bold: true };
        worksheet.getCell(`${col}4`).alignment = { horizontal: 'center' };
      }

      // Build routine grid with multi-class support
      const routineGrid = {};
      
      // First, group slots by day and time to handle multi-class scenarios
      const slotGroups = {};
      
      routineSlots.forEach(slot => {
        const key = `${slot.dayIndex}-${slot.slotIndex}`;
        if (!slotGroups[key]) {
          slotGroups[key] = [];
        }
        
        slotGroups[key].push({
          subject: slot.subjectName_display || slot.subjectId?.name || 'N/A',
          teachers: slot.teacherShortNames_display || slot.teacherIds?.map(t => t.shortName).join(', ') || 'TBA',
          program: `${slot.programCode} Sem${slot.semester} ${slot.section}`,
          type: slot.classType || 'L',
          labGroup: slot.labGroup || slot.section,
          section: slot.section, // Add section field for proper group mapping
          spanId: slot.spanId,
          spanMaster: slot.spanMaster
        });
      });
      
      // Now organize the grouped slots into routine structure
      Object.entries(slotGroups).forEach(([key, classes]) => {
        const [dayIndex, slotIndex] = key.split('-').map(Number);
        
        if (!routineGrid[dayIndex]) {
          routineGrid[dayIndex] = {};
        }
        
        if (classes.length === 1) {
          // Single class
          routineGrid[dayIndex][slotIndex] = classes[0];
        } else {
          // Multiple classes - merge them for display
          const baseClass = classes[0];
          const labGroups = classes.map(cls => {
            const labGroup = cls.labGroup || 'Group';
            return getSectionLabGroupLabel(labGroup, cls.section);
          }).join(' & ');
          const teachersList = [...new Set(classes.flatMap(cls => cls.teachers.split(', ')))].join(', ');
          
          routineGrid[dayIndex][slotIndex] = {
            ...baseClass,
            isMultiGroup: true,
            teachers: teachersList,
            labGroups: labGroups,
            displayText: `${baseClass.subject}\n[${baseClass.type}] (${labGroups})\n${teachersList}\n${baseClass.program}`
          };
        }
      });

      // Fill in the schedule
      for (let slotIndex = 0; slotIndex < timeSlots.length; slotIndex++) {
        const row = 5 + slotIndex;
        
        // Time slot
        worksheet.getCell(`A${row}`).value = timeSlots[slotIndex];
        worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
        
        // For each day
        for (let dayIndex = 0; dayIndex < dayNames.length; dayIndex++) {
          const col = String.fromCharCode(66 + dayIndex);
          const cell = worksheet.getCell(`${col}${row}`);
          
          if (routineGrid[dayIndex] && routineGrid[dayIndex][slotIndex]) {
            const classData = routineGrid[dayIndex][slotIndex];
            
            if (classData.isMultiGroup) {
              // Use pre-formatted display text for multi-group classes
              cell.value = classData.displayText;
            } else {
              // Single class display
              const labGroupLabel = classData.labGroup ? getSectionLabGroupLabel(classData.labGroup, classData.section) : '';
              const labGroupDisplay = labGroupLabel ? ` (${labGroupLabel})` : '';
              cell.value = `${classData.subject}\n[${classData.type}]${labGroupDisplay}\n${classData.teachers}\n${classData.program}`;
            }
            
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.font = { size: 10 };
            
            // Color coding for class types
            if (classData.type === 'L') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
            } else if (classData.type === 'P') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E8' } };
            } else if (classData.type === 'T') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
            }
          } else {
            cell.value = '';
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
          }
          
          // Add border
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      }

      // Set column widths
      worksheet.getColumn('A').width = 15;
      for (let i = 1; i <= 7; i++) {
        worksheet.getColumn(i + 1).width = 20;
      }

      // Set row heights
      for (let i = 5; i < 5 + timeSlots.length; i++) {
        worksheet.getRow(i).height = 80;
      }
    }

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="All_Rooms_Schedules.xlsx"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error exporting all room schedules:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};
