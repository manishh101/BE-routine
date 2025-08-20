const UnifiedPDFService = require('./UnifiedPDFService');

/**
 * PDFRoutineService - Updated to use UnifiedPDFService
 * This maintains backward compatibility while using the new unified service
 */
class PDFRoutineService {

  constructor() {
    this.unifiedService = new UnifiedPDFService();
  }

  /**
   * Generate PDF for class schedule (program/semester/section)
   * Now delegates to UnifiedPDFService with time slot fix
   */
  async generateClassSchedulePDF(programCode, semester, section) {
    return await this.unifiedService.generateClassSchedulePDF(programCode, semester, section);
  }

  /**
   * Generate PDF for teacher schedule
   * Now delegates to UnifiedPDFService with time slot fix
   */
  async generateTeacherSchedulePDF(teacherId, teacherName, semesterFilter = 'all') {
    return await this.unifiedService.generateTeacherSchedulePDF(teacherId, teacherName, semesterFilter);
  }

  /**
   * Generate PDF for room schedule
   * Now delegates to UnifiedPDFService with time slot fix
   */
  async generateRoomSchedulePDF(roomId, roomName, semesterFilter = 'all') {
    return await this.unifiedService.generateRoomSchedulePDF(roomId, roomName, semesterFilter);
  }

  /**
   * Generate combined PDF for all sections in a semester
   * Now delegates to UnifiedPDFService with time slot fix
   */
  async generateAllSemesterSchedulesPDF(programCode, semester) {
    return await this.unifiedService.generateAllSemesterSchedulesPDF(programCode, semester);
  }

  /**
   * Generate combined PDF for all teachers schedules
   * Now delegates to UnifiedPDFService with time slot fix
   */
  async generateAllTeachersSchedulesPDF(semesterGroup = 'all') {
    return await this.unifiedService.generateAllTeachersSchedulesPDF(semesterGroup);
  }

  /**
   * Generate combined PDF for all rooms schedules
   * Now delegates to UnifiedPDFService with time slot fix
   */
  async generateAllRoomsSchedulePDF(semesterGroup = 'all') {
    return await this.unifiedService.generateAllRoomsSchedulePDF(semesterGroup);
  }

  /**
   * Determine optimal page size based on content complexity
   */
  _getOptimalPageSize(routineSlots, timeSlots) {
    // For now, always use large format for better layout and readability
    return 'a4'; // Large landscape format (1600x1000) for detailed view
    
    /* Previous dynamic sizing logic - temporarily disabled
    const totalSlots = routineSlots.length;
    const timeSlotCount = timeSlots.length;
    
    // Check for merged classes (multiple slots in same time)
    const slotMap = new Map();
    routineSlots.forEach(slot => {
      const key = `${slot.dayIndex}-${slot.slotIndex}`;
      if (!slotMap.has(key)) slotMap.set(key, []);
      slotMap.get(key).push(slot);
    });
    
    const hasComplexSchedule = Array.from(slotMap.values()).some(slots => slots.length > 1);
    
    // Determine size based on complexity
    if (hasComplexSchedule && totalSlots > 40) {
      return 'large'; // Complex schedule with many merged classes
    } else if (totalSlots > 30 || timeSlotCount > 8) {
      return 'tall'; // Many classes or time slots
    } else if (timeSlotCount > 6) {
      return 'wide'; // Many time slots, use landscape
    } else {
      return 'default'; // Standard schedule
    }
    */
  }

  /**
   * Generate PDF for room schedule showing which classes are in the room at different times
   * @param {string} roomId - The room ID
   * @param {string} roomName - The room name
   * @param {string} semesterFilter - Optional 'even', 'odd', or 'all' filter for semesters
   */
  async generateRoomSchedulePDF(roomId, roomName, semesterFilter = 'all') {
    try {
      console.log(`📄 Generating room schedule PDF for ${roomName || roomId} with semester filter: ${semesterFilter}`);

      // Build query based on semester filter
      const query = {
        roomId: roomId,
        isActive: true
      };
      
      // Add semester filter if specified
      if (semesterFilter === 'even') {
        query.semester = { $in: [2, 4, 6, 8] };  // Even semesters
      } else if (semesterFilter === 'odd') {
        query.semester = { $in: [1, 3, 5, 7] };  // Odd semesters
      }

      // Get all routine slots for this room
      const routineSlots = await RoutineSlot.find(query)
        .populate('subjectId', 'name code')
        .populate('subjectIds', 'name code')
        .populate('teacherIds', 'fullName shortName')
        .sort({ dayIndex: 1, slotIndex: 1 });

      if (!routineSlots || routineSlots.length === 0) {
        console.log(`No routine data found for room ${roomName || roomId}`);
        return null;
      }

      // Get time slots for grid structure
      const timeSlots = await TimeSlot.find().sort({ sortOrder: 1 });

      // Determine optimal page size based on schedule complexity (same as class routine)
      const optimalSize = this._getOptimalPageSize(routineSlots, timeSlots);
      const customSize = this._getCustomPageSize(optimalSize);
      
      console.log(`📄 Using ${optimalSize} page format (${customSize[0]}x${customSize[1]}) for room ${roomName} with ${routineSlots.length} slots`);

      // Create PDF document with dynamic dimensions
      const doc = new PDFDocument({
        margin: 30,
        size: customSize,
        layout: 'landscape' // Landscape orientation for better horizontal space for routine grid
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));

      // Generate header
      this._generatePDFHeader(doc, {
        title: `Room Schedule - ${roomName || 'Room'}`,
        subtitle: `Weekly Schedule`,
        roomName: roomName
      });

      // Generate room schedule grid using the same method as class routine
      this._generateScheduleGridAligned(doc, routineSlots, timeSlots, 'room');

      // Add footer
      this._generatePDFFooter(doc, `Room Schedule - ${roomName || 'Room'}`);

      return new Promise((resolve) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          console.log(`✅ Room schedule PDF generated successfully (${pdfBuffer.length} bytes)`);
          resolve(pdfBuffer);
        });

        doc.end();
      });

    } catch (error) {
      console.error('❌ Error generating room schedule PDF:', error);
      throw error;
    }
  }

  /**
   * Generate PDF for teacher schedule showing when and where the teacher has classes
   * @param {string} teacherId - The teacher ID
   * @param {string} teacherName - The teacher name
   * @param {string} semesterFilter - Optional 'even', 'odd', or 'all' filter for semesters
   */
  async generateTeacherSchedulePDF(teacherId, teacherName, semesterFilter = 'all') {
    try {
      console.log(`📄 Generating teacher schedule PDF for ${teacherName || teacherId} with semester filter: ${semesterFilter}`);

      // Build query based on semester filter
      const query = {
        teacherIds: teacherId,
        isActive: true
      };
      
      // Add semester filter if specified
      if (semesterFilter === 'even') {
        query.semester = { $in: [2, 4, 6, 8] };  // Even semesters
      } else if (semesterFilter === 'odd') {
        query.semester = { $in: [1, 3, 5, 7] };  // Odd semesters
      }

      // Get all routine slots for this teacher
      const routineSlots = await RoutineSlot.find(query)
        .populate('subjectId', 'name code')
        .populate('subjectIds', 'name code')
        .populate('teacherIds', 'fullName shortName')
        .populate('roomId', 'name')
        .sort({ dayIndex: 1, slotIndex: 1 });

      if (!routineSlots || routineSlots.length === 0) {
        console.log(`No routine data found for teacher ${teacherName || teacherId}`);
        return null;
      }

      // Get time slots for grid structure
      const timeSlots = await TimeSlot.find().sort({ sortOrder: 1 });

      // Determine optimal page size based on schedule complexity (same as class routine)
      const optimalSize = this._getOptimalPageSize(routineSlots, timeSlots);
      const customSize = this._getCustomPageSize(optimalSize);
      
      console.log(`📄 Using ${optimalSize} page format (${customSize[0]}x${customSize[1]}) for teacher ${teacherName} with ${routineSlots.length} slots`);

      // Create PDF document with dynamic dimensions
      const doc = new PDFDocument({
        margin: 30,
        size: customSize,
        layout: 'landscape' // Landscape orientation for better horizontal space for routine grid
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));

      // Generate header
      this._generatePDFHeader(doc, {
        title: `Teacher Schedule - ${teacherName || 'Teacher'}`,
        subtitle: `Weekly Schedule`,
        teacherName: teacherName
      });

      // Generate teacher schedule grid using the working aligned method
      this._generateScheduleGridAligned(doc, routineSlots, timeSlots, 'teacher');

      // Add footer
      this._generatePDFFooter(doc, `Teacher Schedule - ${teacherName || 'Teacher'}`);

      return new Promise((resolve) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          console.log(`✅ Teacher schedule PDF generated successfully (${pdfBuffer.length} bytes)`);
          resolve(pdfBuffer);
        });

        doc.end();
      });

    } catch (error) {
      console.error('❌ Error generating teacher schedule PDF:', error);
      throw error;
    }
  }

  /**
   * Generate combined PDF for all teachers schedules
   */
  async generateAllTeachersSchedulesPDF(semesterGroup = 'all') {
    try {
      console.log(`📄 Generating all teachers schedules PDF for semester group: ${semesterGroup}`);

      // Build filter for semester group
      let routineFilter = { isActive: true };
      if (semesterGroup && semesterGroup !== 'all') {
        // Get semester numbers that match the group
        const semesters = this._getSemestersForGroup(semesterGroup);
        routineFilter.semester = { $in: semesters };
      }

      // Get all active teachers that have routine slots
      const teacherIds = await RoutineSlot.distinct('teacherIds', routineFilter);
      
      if (!teacherIds || teacherIds.length === 0) {
        console.log('No teachers with active schedule found');
        return null;
      }

      // Get teacher details
      const Teacher = require('../models/Teacher');
      const teachers = await Teacher.find({ _id: { $in: teacherIds } }).sort({ fullName: 1 });

      if (!teachers || teachers.length === 0) {
        console.log('No teacher details found');
        return null;
      }

      // Get time slots for optimal sizing calculation
      const timeSlots = await TimeSlot.find().sort({ sortOrder: 1 });

      // Create PDF document with dynamic sizing based on first teacher's schedule complexity
      const firstTeacherSlots = await RoutineSlot.find({
        teacherIds: teachers[0]._id,
        isActive: true
      });
      const optimalSize = this._getOptimalPageSize(firstTeacherSlots, timeSlots);
      const customSize = this._getCustomPageSize(optimalSize);
      
      console.log(`📄 Using ${optimalSize} page format (${customSize[0]}x${customSize[1]}) for combined teachers schedules`);
      
      const doc = new PDFDocument({
        margin: 30,
        size: customSize,
        layout: 'landscape' // Landscape orientation for better horizontal space for routine grid
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));

      let isFirstTeacher = true;

      // Generate schedule for each teacher
      for (const teacher of teachers) {
        if (!isFirstTeacher) {
          doc.addPage();
        }
        isFirstTeacher = false;

        console.log(`Generating schedule for teacher ${teacher.fullName}...`);

        // Get routine data for this teacher with semester group filter
        let teacherRoutineFilter = {
          teacherIds: teacher._id,
          isActive: true
        };
        if (semesterGroup && semesterGroup !== 'all') {
          const semesters = this._getSemestersForGroup(semesterGroup);
          teacherRoutineFilter.semester = { $in: semesters };
        }

        const routineSlots = await RoutineSlot.find(teacherRoutineFilter)
          .populate('subjectId', 'name code')
          .populate('subjectIds', 'name code')
          .populate('teacherIds', 'fullName shortName')
          .populate('roomId', 'name')
          .sort({ dayIndex: 1, slotIndex: 1 });

        if (routineSlots.length === 0) {
          console.log(`No routine data found for teacher ${teacher.fullName}`);
          continue;
        }

        // Generate header for this teacher
        const groupSuffix = semesterGroup && semesterGroup !== 'all' ? ` (${semesterGroup.toUpperCase()} Semester)` : '';
        this._generatePDFHeader(doc, {
          title: `Teacher Schedule - ${teacher.fullName}${groupSuffix}`,
          subtitle: `Weekly Schedule`,
          teacherName: teacher.fullName
        });

        // Generate teacher schedule grid using the working aligned method (timeSlots already available)
        this._generateScheduleGridAligned(doc, routineSlots, timeSlots);

        // Add footer
        this._generatePDFFooter(doc, `Teacher Schedule - ${teacher.fullName}`);
      }

      return new Promise((resolve) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          console.log(`✅ All teachers schedules PDF generated successfully (${pdfBuffer.length} bytes)`);
          resolve(pdfBuffer);
        });

        doc.end();
      });

    } catch (error) {
      console.error('❌ Error generating all teachers schedules PDF:', error);
      throw error;
    }
  }

  /**
   * Generate PDF for class schedule (program/semester/section)
   */
  async generateClassSchedulePDF(programCode, semester, section) {
    try {
      console.log(`📄 Generating class schedule PDF for ${programCode}-${semester}-${section}`);

      // Get routine data - Step 1: Get TimeSlots first (mirroring frontend)
      const timeSlots = await TimeSlot.find().sort({ sortOrder: 1 });
      if (!timeSlots || timeSlots.length === 0) {
        console.log('No time slots found in database');
        return null;
      }
      console.log(`Found ${timeSlots.length} time slots from database`);

      // Step 2: Get routine slots with proper population
      const routineSlots = await RoutineSlot.find({
        programCode: programCode.toUpperCase(),
        semester: parseInt(semester),
        section: section.toUpperCase(),
        isActive: true
      })
        .populate('subjectId', 'name code')
        .populate('subjectIds', 'name code')
        .populate('teacherIds', 'fullName shortName')
        .populate('roomId', 'name')
        .sort({ dayIndex: 1, slotIndex: 1 });

      if (!routineSlots || routineSlots.length === 0) {
        console.log(`No routine data found for ${programCode}-${semester}-${section}`);
        return null;
      }

      console.log(`Found ${routineSlots.length} routine slots for ${programCode}-${semester}-${section}`);
      if (routineSlots.length > 0) {
        console.log('Sample routine slot:', {
          dayIndex: routineSlots[0].dayIndex,
          slotIndex: routineSlots[0].slotIndex,
          timeSlotMapping: `slotIndex ${routineSlots[0].slotIndex} -> timeSlot[${routineSlots[0].slotIndex - 1}]`,
          classType: routineSlots[0].classType,
          subject: routineSlots[0].subjectId?.code || routineSlots[0].subjectName_display,
          hasSlotIndex: !!routineSlots[0].slotIndex
        });
      }

      // Get time slots and program info
      const program = await Program.findOne({ code: programCode.toUpperCase() });

      // Determine optimal page size based on schedule complexity
      const optimalSize = this._getOptimalPageSize(routineSlots, timeSlots);
      const customSize = this._getCustomPageSize(optimalSize);
      
      console.log(`📄 Using ${optimalSize} page format (${customSize[0]}x${customSize[1]}) for ${routineSlots.length} slots`);    // Force smaller margins for all
    const margin = 15; // Force small margins
    const doc = new PDFDocument({
      margin: margin,
      size: customSize,
      layout: 'landscape' // Landscape orientation for better horizontal space for routine grid
    });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));

      // Generate header
      this._generatePDFHeader(doc, {
        programCode: programCode.toUpperCase(),
        programName: program?.name || programCode,
        semester: parseInt(semester),
        section: section.toUpperCase()
      });

      // Generate schedule grid (frontend-aligned approach)
      this._generateScheduleGridAligned(doc, routineSlots, timeSlots);

      // Add teacher code to name mapping table
      this._generateTeacherMappingTable(doc, routineSlots);

      // Add footer
      this._generatePDFFooter(doc, `${programCode.toUpperCase()} Semester ${semester} Section ${section.toUpperCase()}`);

      return new Promise((resolve) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          console.log(`✅ Class schedule PDF generated successfully (${pdfBuffer.length} bytes)`);
          resolve(pdfBuffer);
        });

        doc.end();
      });

    } catch (error) {
      console.error('❌ Error generating class schedule PDF:', error);
      throw error;
    }
  }

  /**
   * Generate combined PDF for all sections in a semester
   */
  async generateAllSemesterSchedulesPDF(programCode, semester) {
    try {
      console.log(`📄 Generating combined PDF for ${programCode} Semester ${semester} all sections`);

      // Find all sections for this program/semester
      const sections = await RoutineSlot.distinct('section', {
        programCode: programCode.toUpperCase(),
        semester: parseInt(semester),
        isActive: true
      });

      if (!sections || sections.length === 0) {
        console.log(`No sections found for ${programCode} Semester ${semester}`);
        return null;
      }

      console.log(`Found sections: ${sections.join(', ')}`);

      // Get time slots for optimal sizing calculation
      const timeSlots = await TimeSlot.find().sort({ sortOrder: 1 });

      // Create PDF document with dynamic sizing based on first section's schedule complexity
      const firstSectionSlots = await RoutineSlot.find({
        programCode: programCode.toUpperCase(),
        semester: parseInt(semester),
        section: sections[0].toUpperCase(),
        isActive: true
      });
      const optimalSize = this._getOptimalPageSize(firstSectionSlots, timeSlots);
      const customSize = this._getCustomPageSize(optimalSize);
      
      console.log(`📄 Using ${optimalSize} page format (${customSize[0]}x${customSize[1]}) for combined semester schedules`);
      
      const doc = new PDFDocument({
        margin: 30,
        size: customSize,
        layout: 'landscape' // Landscape orientation for better horizontal space for routine grid
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));

      let isFirstSection = true;

      // Generate schedule for each section
      for (const section of sections.sort()) {
        if (!isFirstSection) {
          doc.addPage();
        }
        isFirstSection = false;

        console.log(`Generating section ${section}...`);

        // Get routine data for this section
        const routineSlots = await RoutineSlot.find({
          programCode: programCode.toUpperCase(),
          semester: parseInt(semester),
          section: section.toUpperCase(),
          isActive: true
        })
          .populate('subjectId', 'name code')
          .populate('subjectIds', 'name code')
          .populate('teacherIds', 'fullName shortName')
          .populate('roomId', 'name')
          .sort({ dayIndex: 1, slotIndex: 1 });

        if (routineSlots.length === 0) {
          console.log(`No routine data found for ${section} section`);
          continue;
        }

        // Get program info (timeSlots already available)
        const program = await Program.findOne({ code: programCode.toUpperCase() });

        // Generate header for this section
        this._generatePDFHeader(doc, {
          programCode: programCode.toUpperCase(),
          programName: program?.name || programCode,
          semester: parseInt(semester),
          section: section.toUpperCase()
        });

        // Generate grid for this section using aligned method (timeSlots already available)
        this._generateScheduleGridAligned(doc, routineSlots, timeSlots);

        // Add footer
        this._generatePDFFooter(doc, `${programCode.toUpperCase()} Semester ${semester} Section ${section.toUpperCase()}`);
      }

      return new Promise((resolve) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          console.log(`✅ Combined PDF generated successfully (${pdfBuffer.length} bytes)`);
          resolve(pdfBuffer);
        });

        doc.end();
      });

    } catch (error) {
      console.error('❌ Error generating combined semester PDF:', error);
      throw error;
    }
  }

  /**
   * Generate PDF for all rooms schedule
   */
  async generateAllRoomsSchedulePDF(semesterGroup = 'all') {
    try {
      console.log(`📄 Generating all rooms schedule PDF for semester group: ${semesterGroup}`);

      // Build filter for semester group
      let routineFilter = { isActive: true };
      if (semesterGroup && semesterGroup !== 'all') {
        // Get semester numbers that match the group
        const semesters = this._getSemestersForGroup(semesterGroup);
        routineFilter.semester = { $in: semesters };
      }

      // Get all active rooms that have routine slots
      const roomIds = await RoutineSlot.distinct('roomId', routineFilter);
      
      if (!roomIds || roomIds.length === 0) {
        console.log('No rooms with active schedule found');
        return null;
      }

      // Get room details
      const Room = require('../models/Room');
      const rooms = await Room.find({ _id: { $in: roomIds } }).sort({ name: 1 });

      if (!rooms || rooms.length === 0) {
        console.log('No room details found');
        return null;
      }

      // Get time slots for optimal sizing calculation
      const timeSlots = await TimeSlot.find().sort({ sortOrder: 1 });

      // Create PDF document with dynamic sizing based on first room's schedule complexity
      const firstRoomSlots = await RoutineSlot.find({
        roomId: rooms[0]._id,
        isActive: true
      });
      const optimalSize = this._getOptimalPageSize(firstRoomSlots, timeSlots);
      const customSize = this._getCustomPageSize(optimalSize);
      
      console.log(`📄 Using ${optimalSize} page format (${customSize[0]}x${customSize[1]}) for combined rooms schedules`);
      
      const doc = new PDFDocument({
        margin: 30,
        size: customSize,
        layout: 'landscape' // Landscape orientation for better horizontal space for routine grid
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));

      let isFirstRoom = true;

      // Generate schedule for each room
      for (const room of rooms) {
        if (!isFirstRoom) {
          doc.addPage();
        }
        isFirstRoom = false;

        console.log(`Generating schedule for room ${room.name}...`);

        // Get routine data for this room with semester group filter
        let roomRoutineFilter = {
          roomId: room._id,
          isActive: true
        };
        if (semesterGroup && semesterGroup !== 'all') {
          const semesters = this._getSemestersForGroup(semesterGroup);
          roomRoutineFilter.semester = { $in: semesters };
        }

        const routineSlots = await RoutineSlot.find(roomRoutineFilter)
          .populate('subjectId', 'name code')
          .populate('subjectIds', 'name code')
          .populate('teacherIds', 'fullName shortName')
          .sort({ dayIndex: 1, slotIndex: 1 });

        if (routineSlots.length === 0) {
          console.log(`No routine data found for room ${room.name}`);
          continue;
        }

        // Generate header for this room
        const groupSuffix = semesterGroup && semesterGroup !== 'all' ? ` (${semesterGroup.toUpperCase()} Semester)` : '';
        this._generatePDFHeader(doc, {
          title: `Room Schedule - ${room.name}${groupSuffix}`,
          subtitle: `Weekly Schedule`,
          roomName: room.name
        });

        // Generate room schedule grid using the same method as class routine (timeSlots already available)
        this._generateScheduleGridAligned(doc, routineSlots, timeSlots);

        // Add footer
        this._generatePDFFooter(doc, `Room Schedule - ${room.name}`);
      }

      return new Promise((resolve) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          console.log(`✅ All rooms schedule PDF generated successfully (${pdfBuffer.length} bytes)`);
          resolve(pdfBuffer);
        });

        doc.end();
      });

    } catch (error) {
      console.error('❌ Error generating all rooms schedule PDF:', error);
      throw error;
    }
  }

  /**
   * Generate PDF header with program/room/teacher information
   */
  _generatePDFHeader(doc, options = {}) {
    const { programCode, programName, semester, section, title, subtitle, roomName, teacherName } = options;      // Detect if page is A4 for font size adjustments - A4 landscape is 842x595
      const isA4 = doc.page.width <= 842 && doc.page.height <= 595;
    const headerFontMultiplier = isA4 ? 0.4 : 1; // Much smaller fonts for A4 header

    // Add some top spacing
    doc.moveDown(0.5);

    // University header (added)
    const universityFontSize = 10;
    doc.fontSize(universityFontSize).font('Helvetica-Bold')
       .text('Tribhuvan University', { align: 'center' });
    
    doc.moveDown(0.3);

    // College header
    const collegeFontSize = 8;
    doc.fontSize(collegeFontSize).font('Helvetica-Bold')
       .text('Department of Electronics and Computer Engineering', { align: 'center' });
    
    const campusFontSize = 6;
    doc.fontSize(campusFontSize).font('Helvetica')
       .text('Pulchowk Campus, Institute of Engineering', { align: 'center' });
    
    doc.moveDown(isA4 ? 0.3 : 0.7); // Smaller spacing for A4

    // Schedule title
    if (title) {
      const titleFontSize = 8;
      doc.fontSize(titleFontSize).font('Helvetica-Bold')
         .text(title, { align: 'center' });
    } else if (programCode) {
      const programFontSize = 8;
      doc.fontSize(programFontSize).font('Helvetica-Bold')
         .text(`${programCode} - ${programName || 'Program'}`, { align: 'center' });
      
      // Removed semester and section info to save space for the routine grid
    }

    if (subtitle) {
      const subtitleFontSize = Math.round(14 * headerFontMultiplier);
      doc.fontSize(subtitleFontSize).font('Helvetica')
         .text(subtitle, { align: 'center' });
    }

    doc.moveDown(isA4 ? 0.5 : 1.5); // Much smaller spacing for A4
  }

  /**
   * Generate PDF footer
   */
  _generatePDFFooter(doc, scheduleType) {
    // Footer removed to give more space to the routine grid
    // Previously contained: Generated on date and schedule type info
  }

  /**
   * Generate teacher code to name mapping table at the bottom right of the PDF
   * Organized in multiple columns to fit more teachers efficiently
   */
  _generateTeacherMappingTable(doc, routineSlots) {
    // First, find the most frequently used room
    const roomCount = new Map();
    
    routineSlots.forEach(slot => {
      if (slot.roomId && slot.roomId.name) {
        const roomName = slot.roomId.name;
        roomCount.set(roomName, (roomCount.get(roomName) || 0) + 1);
      }
    });

    // Find the most frequent room
    let mostFrequentRoom = null;
    let maxCount = 0;
    for (const [roomName, count] of roomCount.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequentRoom = roomName;
      }
    }

    console.log(`📍 Most frequent room: ${mostFrequentRoom} (${maxCount} classes)`);

    // Extract unique teachers from routine slots
    const teacherMap = new Map();
    
    routineSlots.forEach(slot => {
      if (slot.teacherIds && Array.isArray(slot.teacherIds)) {
        slot.teacherIds.forEach(teacher => {
          if (teacher.shortName && teacher.fullName) {
            teacherMap.set(teacher.shortName, teacher.fullName);
          }
        });
      }
    });

    // If no teachers found, don't render the table
    if (teacherMap.size === 0) {
      console.log('No teachers found in routine slots, skipping teacher mapping table');
      return;
    }

    console.log(`📊 Generating teacher mapping table with ${teacherMap.size} teachers`);

    // Sort teachers by code for consistent display
    const sortedTeachers = Array.from(teacherMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    // Calculate available width
    const totalWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    
    // Detect if page is A4 for sizing adjustments - A4 landscape is 842x595
    const isA4 = doc.page.width <= 842 && doc.page.height <= 595;
    
    // Configuration for multi-column layout - better positioning and full names
    const teachersPerColumn = 8; // Fewer teachers per column for better readability
    const columnCount = Math.ceil(sortedTeachers.length / teachersPerColumn);
    const columnWidth = 180; // Wider columns to fit full teacher names
    const totalTableWidth = columnCount * columnWidth;
    const rowHeight = 12; // Slightly taller rows for better readability
    const tableHeight = Math.min(teachersPerColumn * rowHeight + 15, 120); // Reasonable height
    
    // Position table right below the grid, shifted further to the right
    const tableX = doc.page.margins.left + (totalWidth - totalTableWidth) / 2 + 200; // Shift table 150px to the right (increased from 100px)
    const tableY = doc.y + 20; // Position 20px below current position (below grid)
    
    // Display most frequent room in bold, large letters to the left of the teacher table (same Y position)
    if (mostFrequentRoom) {
      const roomX = doc.page.margins.left + 50; // Position on the left side
      const roomY = tableY + 20; // Same vertical level as teacher table (aligned)
      
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .fillColor('#2c3e50')
         .text(`Room: ${mostFrequentRoom}`, roomX, roomY, {
           width: 200,
           align: 'left'
         });
      
      console.log(`📍 Room display added: ${mostFrequentRoom} at position (${roomX}, ${roomY})`);
    }
    
    // Draw overall table background and border
    doc.rect(tableX, tableY, totalTableWidth, tableHeight)
       .fillAndStroke('#f8f9fa', '#cccccc');
    
    // Process teachers in columns
    for (let col = 0; col < columnCount; col++) {
      const startIndex = col * teachersPerColumn;
      const endIndex = Math.min(startIndex + teachersPerColumn, sortedTeachers.length);
      const columnTeachers = sortedTeachers.slice(startIndex, endIndex);
      
      const colX = tableX + (col * columnWidth);
      
      // Draw column separator (except for first column)
      if (col > 0) {
        doc.strokeColor('#cccccc')
           .lineWidth(0.5)
           .moveTo(colX, tableY)
           .lineTo(colX, tableY + tableHeight)
           .stroke();
      }
      
      // Draw teachers in this column
      columnTeachers.forEach(([code, name], rowIndex) => {
        const rowY = tableY + 5 + (rowIndex * rowHeight);
        
        // Alternate row background colors within each column
        const isEven = rowIndex % 2 === 0;
        if (!isEven) {
          doc.rect(colX, rowY - 2, columnWidth, rowHeight)
             .fillAndStroke('#ffffff', '#ffffff');
        }
        
        // Teacher code and name on same line: "CODE - Teacher Name" - show full names
        const teacherText = `${code} - ${name}`; // Don't truncate names
        
        const fontSize = 6; // Slightly larger font for better readability
        doc.fontSize(fontSize)
           .font('Helvetica')
           .fillColor('#000000')
           .text(teacherText, colX + 3, rowY, {
             width: columnWidth - 6,
             align: 'left'
           });
      });
    }
    
    console.log(`✅ Teacher mapping table generated with ${sortedTeachers.length} teachers in ${columnCount} columns`);
    
    // Update doc.y to position after the table for footer placement
    doc.y = tableY + tableHeight + 15; // Add some spacing after table
  }

  /**
   * Generate schedule grid for class routines
   */
  _generateScheduleGrid(doc, routineSlots, timeSlots) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    // Grid dimensions - optimized for landscape layout
    const startX = doc.page.margins.left;
    const startY = doc.y;
    const totalWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const dayColumnWidth = 100; // Increased from 90 to 100 for day names in landscape
    const timeColumnWidth = (totalWidth - dayColumnWidth) / timeSlots.length;
    const rowHeight = 100; // Increased from 85 to 100 to use space freed by removing footer and header lines

    // Create routine lookup map using timeSlot._id (matching frontend exactly)
    const routineMap = new Map();
    
    // Map routine slots using timeSlot._id as keys (frontend approach)
    routineSlots.forEach(slot => {
      // The API uses slotIndex (1-based) to map to timeSlots array (0-based)
      if (slot.slotIndex !== undefined && timeSlots[slot.slotIndex - 1]) {
        // Convert 1-based slotIndex to 0-based array index
        const timeSlotArrayIndex = slot.slotIndex - 1;
        const timeSlotId = timeSlots[timeSlotArrayIndex]._id.toString();
        const key = `${slot.dayIndex}-${timeSlotId}`;
        if (!routineMap.has(key)) {
          routineMap.set(key, []);
        }
        routineMap.get(key).push(slot);
      } else if (slot.timeSlotId) {
        // Fallback: Use timeSlotId directly if it exists
        const timeSlotId = slot.timeSlotId.toString();
        const key = `${slot.dayIndex}-${timeSlotId}`;
        if (!routineMap.has(key)) {
          routineMap.set(key, []);
        }
        routineMap.get(key).push(slot);
      }
    });

    console.log('📋 Routine Map Keys:', Array.from(routineMap.keys()));
    console.log('📋 Mapping method:', routineSlots.length > 0 && routineSlots[0].slotIndex ? 'slotIndex (1-based)' : 'timeSlotId direct');

    // Draw header row (time slots)
    doc.fontSize(9).font('Helvetica-Bold');
    
    // Empty cell for day column
    this._drawCell(doc, startX, startY, dayColumnWidth, rowHeight, '', '#f0f0f0', true);
    
    // Time slot headers
    timeSlots.forEach((timeSlot, index) => {
      const x = startX + dayColumnWidth + (index * timeColumnWidth);
      this._drawCell(doc, x, startY, timeColumnWidth, rowHeight, 
                     `${timeSlot.startTime}\n${timeSlot.endTime}`, '#f0f0f0', true);
    });

    // Draw day rows
    days.forEach((day, dayIndex) => {
      const y = startY + ((dayIndex + 1) * rowHeight);
      
      // Day name cell
      doc.fontSize(10).font('Helvetica-Bold');
      this._drawCell(doc, startX, y, dayColumnWidth, rowHeight, day, '#f8f8f8', true);
      
      // Time slot cells for this day
      timeSlots.forEach((timeSlot, slotIndex) => {
        const x = startX + dayColumnWidth + (slotIndex * timeColumnWidth);
        const key = `${dayIndex}-${timeSlot._id.toString()}`;
        const slotsInCell = routineMap.get(key) || [];
        
        let cellContent = '';
        let bgColor = '#ffffff';
        let isLab = false;
        
        if (slotsInCell.length > 0) {
          const slot = slotsInCell[0]; // Primary slot
          
          // Determine if it's a lab class
          isLab = slot.classType === 'P';
          bgColor = isLab ? '#e3f2fd' : '#ffffff';
          
          if (slot.classType === 'BREAK') {
            cellContent = 'BREAK';
          } else if (slot.isElectiveClass && slot.subjectIds?.length > 1) {
            // Multiple electives
            cellContent = slot.subjectIds.map((subj, idx) => {
              const teacher = slot.teacherIds?.[idx];
              return `${subj.code}\n${teacher?.shortName || 'TBD'}`;
            }).join('\n---\n');
          } else {
            // Regular class
            const subjectCode = slot.subjectCode_display || slot.subjectId?.code || slot.display?.subjectCode || 'N/A';
            const teacherNames = slot.teacherShortNames_display?.join(', ') || 
                               slot.teacherIds?.map(t => t.shortName).filter(Boolean).join(', ') || 
                               slot.display?.teacherShortNames?.join(', ') || 'TBD';
            const roomName = slot.roomName_display || slot.roomId?.name || slot.display?.roomName || 'TBD';
            
            cellContent = `${subjectCode}\n${teacherNames}\n${roomName}`;
            
            // Add lab group info if applicable
            if (slot.labGroup && slot.labGroup !== 'ALL') {
              cellContent += `\n(${slot.labGroup})`;
            }
          }
        }
        
        this._drawCell(doc, x, y, timeColumnWidth, rowHeight, cellContent, bgColor, false, isLab);
      });
    });
  }

  /**
   * Generate room schedule grid showing what classes use the room
   */
  _generateRoomScheduleGrid(doc, routineSlots, timeSlots, roomName) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    // Grid dimensions - optimized for landscape layout
    const startX = doc.page.margins.left;
    const startY = doc.y;
    const totalWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const dayColumnWidth = 100; // Increased from 90 to 100 for day names in landscape
    const timeColumnWidth = (totalWidth - dayColumnWidth) / timeSlots.length;
    const rowHeight = 100; // Increased from 85 to 100 to use space freed by removing footer and header lines

    // Create routine lookup map using timeSlot._id (matching frontend exactly)
    const routineMap = new Map();
    
    // Map routine slots using timeSlot._id as keys (frontend approach)
    routineSlots.forEach(slot => {
      // The API uses slotIndex (1-based) to map to timeSlots array (0-based)
      if (slot.slotIndex !== undefined && timeSlots[slot.slotIndex - 1]) {
        // Convert 1-based slotIndex to 0-based array index
        const timeSlotArrayIndex = slot.slotIndex - 1;
        const timeSlotId = timeSlots[timeSlotArrayIndex]._id.toString();
        const key = `${slot.dayIndex}-${timeSlotId}`;
        if (!routineMap.has(key)) {
          routineMap.set(key, []);
        }
        routineMap.get(key).push(slot);
      } else if (slot.timeSlotId) {
        // Fallback: Use timeSlotId directly if it exists
        const timeSlotId = slot.timeSlotId.toString();
        const key = `${slot.dayIndex}-${timeSlotId}`;
        if (!routineMap.has(key)) {
          routineMap.set(key, []);
        }
        routineMap.get(key).push(slot);
      }
    });

    // Draw header row (time slots)
    doc.fontSize(9).font('Helvetica-Bold');
    
    // Empty cell for day column
    this._drawCell(doc, startX, startY, dayColumnWidth, rowHeight, '', '#f0f0f0', true);
    
    // Time slot headers
    timeSlots.forEach((timeSlot, index) => {
      const x = startX + dayColumnWidth + (index * timeColumnWidth);
      this._drawCell(doc, x, startY, timeColumnWidth, rowHeight, 
                     `${timeSlot.startTime}\n${timeSlot.endTime}`, '#f0f0f0', true);
    });

    // Draw day rows
    days.forEach((day, dayIndex) => {
      const y = startY + ((dayIndex + 1) * rowHeight);
      
      // Day name cell
      doc.fontSize(10).font('Helvetica-Bold');
      this._drawCell(doc, startX, y, dayColumnWidth, rowHeight, day, '#f8f8f8', true);
      
      // Time slot cells for this day
      timeSlots.forEach((timeSlot, slotIndex) => {
        const x = startX + dayColumnWidth + (slotIndex * timeColumnWidth);
        const key = `${dayIndex}-${timeSlot._id.toString()}`;
        const slotsInCell = routineMap.get(key) || [];
        
        let cellContent = '';
        let bgColor = '#ffffff';
        let isLab = false;
        
        if (slotsInCell.length > 0) {
          const slot = slotsInCell[0]; // Primary slot
          
          // Determine if it's a lab class
          isLab = slot.classType === 'P';
          bgColor = isLab ? '#e3f2fd' : '#ffffff';
          
          if (slot.classType === 'BREAK') {
            cellContent = 'BREAK';
          } else {
            // Show which class is using this room
            const subjectCode = slot.subjectCode_display || slot.subjectId?.code || slot.display?.subjectCode || 'N/A';
            const section = `${slot.programCode}-${slot.semester}${slot.section}`;
            const teacherNames = slot.teacherShortNames_display?.join(', ') || 
                               slot.teacherIds?.map(t => t.shortName).filter(Boolean).join(', ') || 
                               slot.display?.teacherShortNames?.join(', ') || 'TBD';
            
            cellContent = `${section}\n${subjectCode}\n${teacherNames}`;
            
            // Add lab group info if applicable
            if (slot.labGroup && slot.labGroup !== 'ALL') {
              cellContent += `\n(${slot.labGroup})`;
            }
          }
        }
        
        this._drawCell(doc, x, y, timeColumnWidth, rowHeight, cellContent, bgColor, false, isLab);
      });
    });
  }

  /**
   * Generate schedule grid aligned with frontend approach
   * This method mirrors the frontend's timeSlot._id mapping system
   */
  _generateScheduleGridAligned(doc, routineSlots, timeSlots, pdfType = 'class') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    console.log('🔄 Starting frontend-aligned grid generation...');
    console.log(`TimeSlots: ${timeSlots.length}, RoutineSlots: ${routineSlots.length}`);
    
    // Debug: Show time slots order (simplified)
    console.log('📋 TimeSlots order:');
    console.log(`  ${timeSlots.map((ts, idx) => `[${idx}] ${ts.startTime}-${ts.endTime}`).join(', ')}`);
    
    // Grid dimensions - optimized for A4 landscape layout with smaller fonts
    const startX = doc.page.margins.left;
    const startY = doc.y;
    const totalWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    
    // Detect page size to adjust dimensions accordingly - A4 landscape is 842x595
    const isA4 = doc.page.width <= 842 && doc.page.height <= 595;
    
    // Debug: Log page dimensions and A4 detection
    console.log(`📏 Page dimensions: ${doc.page.width}x${doc.page.height}, isA4: ${isA4}`);
    
    // Adjust dimensions based on page size - force A4 optimizations
    const dayColumnWidth = 55; // Much smaller for A4
    // Calculate time column width to use full page width
    const availableWidth = totalWidth;
    const timeColumnWidth = (availableWidth - dayColumnWidth) / timeSlots.length;
    const headerRowHeight = 20; // Even smaller header for A4
    const rowHeight = 60; // Increased from 50 to 60 to use space freed by removing footer and header lines

    // Step 1: Create routine lookup map and detect spanning classes
    const routineMap = new Map();
    const spanningClasses = new Map(); // dayIndex -> { spans: [{startSlot, endSlot, subject, info}] }
    
    console.log('🗺️ Creating routine mapping and detecting spanning classes...');
    let mappedCount = 0;
    
    // First pass: Map all slots
    routineSlots.forEach(slot => {
      // The API uses slotIndex (1-based) to map to timeSlots array (0-based)
      if (slot.slotIndex !== undefined && timeSlots[slot.slotIndex - 1]) {
        // Convert 1-based slotIndex to 0-based array index
        const timeSlotArrayIndex = slot.slotIndex - 1;
        const timeSlotId = timeSlots[timeSlotArrayIndex]._id.toString();
        const timeSlot = timeSlots[timeSlotArrayIndex];
        const key = `${slot.dayIndex}-${timeSlotId}`;
        
        if (!routineMap.has(key)) {
          routineMap.set(key, []);
        }
        routineMap.get(key).push(slot);
        mappedCount++;
        
        // Only log first few mappings to avoid spam
        if (mappedCount <= 3) {
          console.log(`  ✅ Mapped: slotIndex ${slot.slotIndex} -> ${timeSlot.startTime}-${timeSlot.endTime} -> subject: ${slot.subjectId?.code || slot.subjectCode_display || 'N/A'}`);
        }
      } else if (slot.timeSlotId) {
        // Fallback: Use timeSlotId directly if it exists
        const timeSlotId = slot.timeSlotId.toString();
        const key = `${slot.dayIndex}-${timeSlotId}`;
        
        if (!routineMap.has(key)) {
          routineMap.set(key, []);
        }
        routineMap.get(key).push(slot);
        mappedCount++;
        
        console.log(`  ✅ Direct mapping: timeSlotId ${timeSlotId} -> key: ${key} -> subject: ${slot.subjectId?.code || slot.subjectCode_display || 'N/A'}`);
      } else {
        console.warn(`  ❌ Unable to map slot: dayIndex=${slot.dayIndex}, slotIndex=${slot.slotIndex}, timeSlotId=${slot.timeSlotId}, available timeSlots=${timeSlots.length}`);
      }
    });

    // Second pass: Detect spanning classes (same subject across consecutive slots) AND practical class groups
    console.log('🔍 Detecting spanning classes and practical class groups...');
    
    days.forEach((day, dayIndex) => {
      const daySlots = routineSlots.filter(slot => slot.dayIndex === dayIndex)
                                   .sort((a, b) => a.slotIndex - b.slotIndex);
      
      if (daySlots.length === 0) return;
      
      let currentSpan = null;
      const spans = [];
      
      // Group slots by slotIndex to find practical class groups
      const slotGroups = new Map();
      daySlots.forEach(slot => {
        if (!slotGroups.has(slot.slotIndex)) {
          slotGroups.set(slot.slotIndex, []);
        }
        slotGroups.get(slot.slotIndex).push(slot);
      });
      
      // Find consecutive practical class groups (like slots 6,7,8 - both single and multiple subjects)
      const practicalGroups = [];
      let currentPracticalGroup = null;
      
      for (const [slotIndex, slotsInSlot] of slotGroups.entries()) {
        const hasPractical = slotsInSlot.some(slot => slot.classType === 'P');
        const hasMultipleSubjects = slotsInSlot.length > 1;
        
        // Detect practical groups: either multiple subjects OR single practical classes
        if (hasPractical) {
          if (!currentPracticalGroup) {
            currentPracticalGroup = {
              startSlot: slotIndex,
              endSlot: slotIndex,
              slots: [...slotsInSlot],
              type: 'practical-group'
            };
          } else if (slotIndex === currentPracticalGroup.endSlot + 1) {
            // Check if this continues the same practical class or is a new one
            const currentSubjects = currentPracticalGroup.slots.map(s => s.subjectId?.code || s.subjectCode_display).filter(Boolean);
            const newSubjects = slotsInSlot.map(s => s.subjectId?.code || s.subjectCode_display).filter(Boolean);
            
            // Continue if it's consecutive AND (same subjects OR both are practical)
            const hasSameSubjects = currentSubjects.some(cs => newSubjects.includes(cs));
            
            if (hasSameSubjects || hasMultipleSubjects || currentPracticalGroup.slots.length === 1) {
              // Continue practical group
              currentPracticalGroup.endSlot = slotIndex;
              currentPracticalGroup.slots.push(...slotsInSlot);
            } else {
              // End current group and start new one
              practicalGroups.push(currentPracticalGroup);
              currentPracticalGroup = {
                startSlot: slotIndex,
                endSlot: slotIndex,
                slots: [...slotsInSlot],
                type: 'practical-group'
              };
            }
          } else {
            // End current group and start new one (non-consecutive)
            practicalGroups.push(currentPracticalGroup);
            currentPracticalGroup = {
              startSlot: slotIndex,
              endSlot: slotIndex,
              slots: [...slotsInSlot],
              type: 'practical-group'
            };
          }
        } else {
          // End current practical group if exists
          if (currentPracticalGroup) {
            practicalGroups.push(currentPracticalGroup);
            currentPracticalGroup = null;
          }
        }
      }
      
      // Add final practical group if exists
      if (currentPracticalGroup) {
        practicalGroups.push(currentPracticalGroup);
      }
      
      // Create a set of slots that are part of practical groups to avoid duplicate spans
      const practicalGroupSlots = new Set();
      practicalGroups.forEach(group => {
        for (let i = group.startSlot; i <= group.endSlot; i++) {
          practicalGroupSlots.add(i);
        }
      });
      
      // Now detect regular spanning classes (same subject, consecutive slots) - excluding practical group slots
      daySlots.forEach((slot, index) => {
        if (slot.classType === 'BREAK') {
          // End current span if we hit a break
          if (currentSpan) {
            spans.push(currentSpan);
            currentSpan = null;
          }
          return;
        }
        
        // Skip slots that are part of practical groups
        if (practicalGroupSlots.has(slot.slotIndex)) {
          if (currentSpan) {
            spans.push(currentSpan);
            currentSpan = null;
          }
          return;
        }
        
        const subjectIdentifier = slot.subjectId?.code || slot.subjectCode_display || 'N/A';
        
        if (!currentSpan) {
          // Start potential new span
          currentSpan = {
            startSlot: slot.slotIndex,
            endSlot: slot.slotIndex,
            subject: subjectIdentifier,
            classType: slot.classType,
            slots: [slot],
            type: 'subject-span'
          };
        } else if (currentSpan.subject === subjectIdentifier && 
                   currentSpan.classType === slot.classType &&
                   slot.slotIndex === currentSpan.endSlot + 1) {
          // Continue current span
          currentSpan.endSlot = slot.slotIndex;
          currentSpan.slots.push(slot);
        } else {
          // End current span and start new one
          spans.push(currentSpan);
          currentSpan = {
            startSlot: slot.slotIndex,
            endSlot: slot.slotIndex,
            subject: subjectIdentifier,
            classType: slot.classType,
            slots: [slot],
            type: 'subject-span'
          };
        }
        
        // Check if this is the last slot
        if (index === daySlots.length - 1 && currentSpan) {
          spans.push(currentSpan);
        }
      });
      
      // Combine both types of spans
      const allSpans = [...spans.filter(span => span.endSlot >= span.startSlot), ...practicalGroups.filter(group => group.endSlot >= group.startSlot)];
      
      if (allSpans.length > 0) {
        spanningClasses.set(dayIndex, { spans: allSpans });
        console.log(`📏 ${day} spanning classes:`, allSpans.map(s => {
          if (s.type === 'practical-group') {
            const subjects = [...new Set(s.slots.map(slot => slot.subjectId?.code || slot.subjectCode_display || 'N/A'))];
            return `Practical Group [${subjects.join(', ')}] spans slots ${s.startSlot}-${s.endSlot}`;
          } else {
            return `${s.subject} [${s.classType}] spans slots ${s.startSlot}-${s.endSlot}`;
          }
        }));
      }
    });

    console.log(`📊 Mapped ${mappedCount}/${routineSlots.length} routine slots successfully`);

    // Step 2: Draw header row (time slots) - force small fonts
    const headerFontSize = 4; // Force small headers
    doc.fontSize(headerFontSize).font('Helvetica-Bold');
    
    // Empty cell for day column
    this._drawCell(doc, startX, startY, dayColumnWidth, headerRowHeight, '', '#f0f0f0', true);
    
    // Time slot headers
    timeSlots.forEach((timeSlot, index) => {
      const x = startX + dayColumnWidth + (index * timeColumnWidth);
      const headerText = timeSlot.isBreak ? 'BREAK' : `${timeSlot.startTime}-${timeSlot.endTime}`;
      this._drawCell(doc, x, startY, timeColumnWidth, headerRowHeight, headerText, '#f0f0f0', true);
    });

    // Step 3: Draw day rows
    days.forEach((day, dayIndex) => {
      const y = startY + headerRowHeight + (dayIndex * rowHeight);
      
      // Day name cell - force small fonts
      const dayFontSize = 5; // Force small day names
      doc.fontSize(dayFontSize).font('Helvetica-Bold');
      this._drawCell(doc, startX, y, dayColumnWidth, rowHeight, day, '#f8f8f8', true);
      
      // Time slot cells for this day with spanning class support
      const daySpans = spanningClasses.get(dayIndex);
      const drawnCells = new Set(); // Track which cells we've already drawn as part of spans
      
      timeSlots.forEach((timeSlot, slotIndex) => {
        const x = startX + dayColumnWidth + (slotIndex * timeColumnWidth);
        const timeSlotId = timeSlot._id.toString();
        const key = `${dayIndex}-${timeSlotId}`;
        const slotsInCell = routineMap.get(key) || [];
        const currentSlotIndex = slotIndex + 1; // Convert to 1-based for comparison
        
        // Skip if this cell is part of a spanning class that we've already drawn
        if (drawnCells.has(slotIndex)) {
          return;
        }
        
        // Check if this slot is part of a spanning class
        let spanInfo = null;
        if (daySpans) {
          spanInfo = daySpans.spans.find(span => 
            currentSlotIndex >= span.startSlot && currentSlotIndex <= span.endSlot
          );
        }
        
        if (dayIndex === 1 && slotIndex <= 3) { // Debug Monday first few slots
          console.log(`🔍 Cell [${day}][${timeSlot.startTime}-${timeSlot.endTime}]: key=${key}, slots=${slotsInCell.length}`);
          if (slotsInCell.length > 0) {
            console.log(`    Subject: ${slotsInCell[0].subjectId?.code || slotsInCell[0].subjectCode_display || 'N/A'}`);
          }
          if (spanInfo) {
            console.log(`    📏 Part of span: ${spanInfo.subject} [${spanInfo.startSlot}-${spanInfo.endSlot}]`);
          }
        }
        
        let cellContent = '';
        let bgColor = '#ffffff';
        let isLab = false;
        let cellWidth = timeColumnWidth;
        
        // Handle spanning classes
        if (spanInfo && currentSlotIndex === spanInfo.startSlot) {
          console.log(`📏 Drawing spanning class: ${spanInfo.type === 'practical-group' ? 'Practical Group' : spanInfo.subject} [${spanInfo.startSlot}-${spanInfo.endSlot}]`);
          
          // Calculate width for spanning class
          const spanLength = spanInfo.endSlot - spanInfo.startSlot + 1;
          cellWidth = timeColumnWidth * spanLength;
          
          // Mark all slots in the span as drawn
          for (let i = spanInfo.startSlot - 1; i <= spanInfo.endSlot - 1; i++) {
            drawnCells.add(i);
          }
          
          if (spanInfo.type === 'practical-group') {
            // Handle practical group spanning (multiple subjects across multiple slots)
            cellContent = this._formatPracticalGroupContent(spanInfo, pdfType);
            isLab = true;
            bgColor = '#ffffff'; // Remove background color for practical groups
          } else {
            // Handle regular subject spanning (same subject across multiple slots)
            const primarySlot = spanInfo.slots[0];
            isLab = primarySlot.classType === 'P';
            bgColor = '#ffffff'; // Remove background color for spanning classes
            
            cellContent = this._formatSpanningClassContent(spanInfo, pdfType);
          }
        }
        // Handle regular cells (non-spanning)
        else if (!spanInfo) {
          if (slotsInCell.length > 0) {
            // Check for BREAK first
            const breakSlot = slotsInCell.find(slot => slot.classType === 'BREAK');
            if (breakSlot) {
              cellContent = 'BREAK';
              bgColor = '#f8f8f8';
            } 
            // Handle merged classes (multiple slots in same time slot)
            else if (slotsInCell.length > 1) {
              console.log(`🔀 Merged class detected: ${slotsInCell.length} slots in [${day}][${timeSlot.startTime}-${timeSlot.endTime}]`);
              
              // Remove background color for merged classes
              bgColor = '#ffffff';
              
              // Process each slot and combine them
              const classInfos = slotsInCell.map(slot => {
                // Get subject name
                const subjectName = slot.subjectName_display || slot.subjectId?.name || slot.display?.subjectName || 'N/A';
                
                // Get class type
                const classType = this._getClassTypeText(slot.classType);
                
                // Get teacher names (only if not teacher PDF)
                const teacherNames = pdfType === 'teacher' ? '' : (
                  slot.teacherShortNames_display?.join(', ') || 
                  slot.teacherIds?.map(t => t.shortName).filter(Boolean).join(', ') || 
                  slot.display?.teacherShortNames?.join(', ') || 'TBA'
                );
                
                // Get room name (only for practical classes, not for lecture and tutorial)
                const roomName = pdfType === 'room' ? '' : (
                  slot.classType === 'P' ? ( // Only show room for practical classes
                    slot.roomName_display || slot.roomId?.name || slot.display?.roomName || 'TBA'
                  ) : ''
                );
                
                // Enhanced lab group indicator with section awareness
                let labGroupIndicator = '';
                if ((slot.classType === 'P' || slot.isAlternativeWeek === true) && slot.labGroup && slot.labGroup !== 'ALL') {
                  // Backend already stores correct group values (A,B for AB section; C,D for CD section)
                  labGroupIndicator = ` (${slot.labGroup})`;
                }
                
                // Apply intelligent text wrapping to long subject names (for merged classes)
                let wrappedSubjectName = subjectName;
                const maxLineLength = 20; // Slightly shorter for merged classes
                const fullSubjectText = subjectName + labGroupIndicator;
                
                if (fullSubjectText.length > maxLineLength) {
                  const words = subjectName.split(' ');
                  if (words.length >= 2) {
                    // Split into two lines, trying to balance the length
                    const midPoint = Math.ceil(words.length / 2);
                    const firstLine = words.slice(0, midPoint).join(' ');
                    const secondLine = words.slice(midPoint).join(' ');
                    wrappedSubjectName = `${firstLine}\n${secondLine}`;
                  } else if (subjectName.includes('&')) {
                    // Handle subjects with "&" by breaking at that point
                    wrappedSubjectName = subjectName.replace(' & ', '\n& ');
                  } else if (subjectName.includes('-')) {
                    // Handle subjects with "-" by breaking at that point
                    wrappedSubjectName = subjectName.replace(' - ', '\n- ');
                  }
                }
                
                return {
                  subjectName: `${wrappedSubjectName}${labGroupIndicator} [${classType}]`,
                  classType: classType,
                  teacherNames: teacherNames,
                  roomName: roomName
                };
              });
              
              // Format merged classes based on PDF type
              if (pdfType === 'teacher') {
                // Teacher PDF: Show subject with class type, and room only (for practical classes)
                cellContent = classInfos.map(info => 
                  info.roomName ? `${info.subjectName}\n${info.roomName}` : `${info.subjectName}`
                ).join('\n──────\n');
              } else if (pdfType === 'room') {
                // Room PDF: Show subject with class type, and teacher with section info (no room names)
                cellContent = classInfos.map(info => {
                  const section = `${slotsInCell[0].programCode}-${slotsInCell[0].semester}${slotsInCell[0].section}`;
                  return info.teacherNames ? `${section}\n${info.subjectName}\n${info.teacherNames}` : `${section}\n${info.subjectName}`;
                }).join('\n──────\n');
              } else {
                // Class PDF: Show information with conditional room display
                cellContent = classInfos.map(info => 
                  info.roomName ? `${info.subjectName}\n${info.teacherNames}\n${info.roomName}` : `${info.subjectName}\n${info.teacherNames}`
                ).join('\n──────\n');
              }
            }
            // Handle elective classes
            else if (slotsInCell[0].isElectiveClass && slotsInCell[0].subjectIds?.length > 1) {
              // Multiple electives
              cellContent = slotsInCell[0].subjectIds.map((subj, idx) => {
                const teacher = slotsInCell[0].teacherIds?.[idx];
                return `${subj.code}\n${teacher?.shortName || 'TBD'}`;
              }).join('\n---\n');
            }
            // Handle single regular class
            else {
              const slot = slotsInCell[0];
              
              // Determine if it's a lab class
              isLab = slot.classType === 'P';
              bgColor = '#ffffff'; // Remove background color for single classes
              
              // Regular class - format based on PDF type
              const subjectName = slot.subjectName_display || slot.subjectId?.name || slot.display?.subjectName || 'N/A';
              
              // Class Type in brackets [L], [P], etc.
              const classType = this._getClassTypeText(slot.classType);
              
              // Teacher short names (only if not teacher PDF)
              const teacherNames = pdfType === 'teacher' ? '' : (
                slot.teacherShortNames_display?.join(', ') || 
                slot.teacherIds?.map(t => t.shortName).filter(Boolean).join(', ') || 
                slot.display?.teacherShortNames?.join(', ') || 'TBA'
              );
              
              // Room name (only for practical classes, not for lecture and tutorial)
              const roomName = pdfType === 'room' ? '' : (
                slot.classType === 'P' ? ( // Only show room for practical classes
                  slot.roomName_display || 
                  slot.roomId?.name || 
                  slot.display?.roomName || 
                  slot.room?.name ||
                  slot.roomName ||
                  slot.roomId ||
                  'TBA'
                ) : ''
              );
              
              // Enhanced lab group indicator with section awareness (for practical classes or alternative weeks)
              let labGroupIndicator = '';
              if ((slot.classType === 'P' || slot.isAlternativeWeek === true) && slot.labGroup && slot.labGroup !== 'ALL') {
                // Backend already stores correct group values (A,B for AB section; C,D for CD section)
                labGroupIndicator = ` (${slot.labGroup})`;
              }
              
              // Apply intelligent text wrapping to long subject names
              let wrappedSubjectName = subjectName;
              const maxLineLength = 24; // Approximate character limit per line for current cell width
              const fullSubjectText = subjectName + labGroupIndicator;
              
              if (fullSubjectText.length > maxLineLength) {
                const words = subjectName.split(' ');
                if (words.length >= 2) {
                  // Split into two lines, trying to balance the length
                  const midPoint = Math.ceil(words.length / 2);
                  const firstLine = words.slice(0, midPoint).join(' ');
                  const secondLine = words.slice(midPoint).join(' ');
                  wrappedSubjectName = `${firstLine}\n${secondLine}`;
                } else if (subjectName.includes('&')) {
                  // Handle subjects with "&" by breaking at that point
                  wrappedSubjectName = subjectName.replace(' & ', '\n& ');
                } else if (subjectName.includes('-')) {
                  // Handle subjects with "-" by breaking at that point
                  wrappedSubjectName = subjectName.replace(' - ', '\n- ');
                }
              }
              
              // Format content based on PDF type and class type
              if (pdfType === 'teacher') {
                // Teacher PDF: Don't show teacher names, show room for context (only for practical)
                if (slot.classType === 'P') {
                  // Practical class: show room if available
                  cellContent = roomName ? `${wrappedSubjectName}${labGroupIndicator} [${classType}]\n${roomName}` : `${wrappedSubjectName}${labGroupIndicator} [${classType}]`;
                } else {
                  // Lecture/Tutorial class: no room needed
                  cellContent = `${wrappedSubjectName}${labGroupIndicator} [${classType}]`;
                }
              } else if (pdfType === 'room') {
                // Room PDF: Don't show room name, show teacher and section for context
                const section = `${slot.programCode}-${slot.semester}${slot.section}`;
                if (slot.classType === 'P') {
                  // Practical class: show section and teacher side by side
                  const sectionTeacherLine = teacherNames ? `${section} | ${teacherNames}` : section;
                  cellContent = `${wrappedSubjectName}${labGroupIndicator} [${classType}]\n${sectionTeacherLine}`;
                } else {
                  // Lecture class: show section and teacher on separate lines
                  cellContent = teacherNames ? `${section}\n${wrappedSubjectName}${labGroupIndicator} [${classType}]\n${teacherNames}` : `${section}\n${wrappedSubjectName}${labGroupIndicator} [${classType}]`;
                }
              } else {
                // Class PDF: Show all information
                if (slot.classType === 'P') {
                  // Practical class: Teacher | Room format for space efficiency
                  const teacherRoomLine = roomName ? `${teacherNames} | ${roomName}` : teacherNames;
                  cellContent = `${wrappedSubjectName}${labGroupIndicator} [${classType}]\n${teacherRoomLine}`;
                } else {
                  // Lecture/Tutorial class: Only show teacher, no room
                  cellContent = `${wrappedSubjectName}${labGroupIndicator} [${classType}]\n${teacherNames}`;
                }
              }
            }
          } else {
            // Empty cell
            cellContent = '';
          }
        }
        
        // Draw the cell (spanning or regular)
        if (cellContent !== '' || !spanInfo) {
          this._drawCell(doc, x, y, cellWidth, rowHeight, cellContent, bgColor, false, isLab);
        }
      });
    });
    
    console.log('✅ Frontend-aligned grid generation completed');
  }

  /**
   * Draw a single cell in the grid with proper text centering matching frontend
   */
  _drawCell(doc, x, y, width, height, text, bgColor = '#ffffff', isHeader = false, isLab = false) {
    // Remove background colors for merged classes
    if (text && text.includes('──────')) {
      bgColor = '#ffffff'; // Use white background for merged classes
    }
    
    // Draw cell background with border
    doc.rect(x, y, width, height)
       .lineWidth(0.5)
       .fillAndStroke(bgColor, '#c0c0c0');
    
    // Draw text with proper centering and border lines for merged classes
    if (text && text.trim()) {
      // Split text into lines and check for merged classes
      const lines = text.split('\n').filter(line => line.trim());
      const isMergedClass = text.includes('──────'); // Merged class separator
      const isMultiGroupClass = isMergedClass || 
                              (text && text.includes('Multiple Groups')) || 
                              (text && text.includes('Group A & Group B')) ||
                              (text && text.includes('Group C & Group D')) ||
                              (text && text.includes(' & ')) || // General pattern for joined groups
                              (text && /\(Group [A-D] & Group [A-D]\)/.test(text));
      
      // Force small font sizes for all content
      const fontSizeMultiplier = 0.75; // Force 50% reduction
      
      // Dynamic font sizing based on content length - force small fonts
      let fontSize;
      if (isHeader) {
        fontSize = Math.round(10 * fontSizeMultiplier); // Force small headers
      } else if (isMultiGroupClass) {
        fontSize = Math.round(8 * fontSizeMultiplier); // Force small multi-group text
      } else if (isMergedClass || lines.length > 8) {
        fontSize = Math.round(7 * fontSizeMultiplier); // Force small merged class text
      } else if (lines.length > 5) {
        fontSize = Math.round(7 * fontSizeMultiplier); // Much smaller moderately long content for A4
      } else {
        fontSize = Math.round(8 * fontSizeMultiplier); // Much smaller standard content for A4
      }
      
      const font = isHeader ? 'Helvetica-Bold' : (isLab ? 'Helvetica-Bold' : 'Helvetica');
      const textColor = '#333333'; // Use same color for all classes (lecture and practical)
      
      doc.fontSize(fontSize)
         .font(font)
         .fillColor(textColor);
      
      const lineHeight = fontSize * (isMergedClass || isMultiGroupClass ? 1.3 : 1.2); // Better line spacing for multi-group content
      const totalTextHeight = lines.length * lineHeight;
      
      // Detect elective classes and apply increased spacing between subject and teacher
      const isElectiveClass = text && (text.includes('---') || (lines.length >= 2 && /^[A-Z]{2,4}$/.test(lines[lines.length - 1].trim())));
      
      // Calculate vertical position - special handling for practical classes
      let textStartY;
      
      // Check if this is a practical class with Group A/B content or multi-group content
      const isPracticalClass = isLab || (text && text.includes('| ')) || (text && text.includes('Group A')) || (text && text.includes('Group B'));
      
      if (isPracticalClass || isMultiGroupClass) {
        // For practical/multi-group classes: better vertical centering with proper spacing
        const cellCenterY = y + (height / 2);
        const proposedStartY = cellCenterY - (totalTextHeight / 2);
        
        // Ensure text starts within cell boundaries with minimal top padding
        const minTopPadding = 4; // Slightly increased for better spacing
        const maxBottomY = y + height - 4; // Better bottom margin
        
        textStartY = Math.max(proposedStartY, y + minTopPadding);
        
        // If content would extend beyond bottom, adjust start position
        if (textStartY + totalTextHeight > maxBottomY) {
          textStartY = Math.max(y + minTopPadding, maxBottomY - totalTextHeight);
        }
      } else {
        // For lecture classes: start very close to top for compact cells
        const cellCenterY = y + (height / 2);
        const proposedStartY = cellCenterY - (totalTextHeight / 2) + (lineHeight * 0.1); // Minimal offset
        
        // Ensure content stays within cell boundaries with minimal padding
        const minTopPadding = 2; // Reduced to 2 pixels
        const maxBottomY = y + height - 2; // Reduced bottom margin to 2px
        
        textStartY = Math.max(proposedStartY, y + minTopPadding);
        if (textStartY + totalTextHeight > maxBottomY) {
          textStartY = Math.max(y + minTopPadding, maxBottomY - totalTextHeight);
        }
      }
      
      // Draw each line with horizontal centering and border lines for separators
      let cumulativeY = textStartY;
      lines.forEach((line, index) => {
        if (line.trim()) {
          // Apply increased spacing for elective classes between subject and teacher
          let extraSpacing = 0;
          if (isElectiveClass && index > 0) {
            // Check if this line looks like a teacher name (short, all caps)
            const isTeacherLine = /^[A-Z]{2,4}$/.test(line.trim());
            if (isTeacherLine) {
              extraSpacing = fontSize * 0.8; // Add extra spacing before teacher name
            }
          }
          
          const lineY = cumulativeY + extraSpacing;
          cumulativeY = lineY + lineHeight; // Update for next line
          
          // Safety check: ensure line doesn't go beyond cell boundaries
          if (lineY < y || lineY + fontSize > y + height) {
            return; // Skip lines that would go outside cell boundaries
          }
          
          // Special handling for separator lines in merged classes
          if (line.trim() === '──────') {
            // Draw actual border line instead of text
            const borderY = lineY + (fontSize * 0.3); // Adjust vertical position
            const borderMargin = 10; // Margin from cell edges
            
            // Ensure border line is within cell boundaries
            if (borderY >= y + 5 && borderY <= y + height - 5) {
              doc.save();
              doc.strokeColor('#888888')
                 .lineWidth(0.8)
                 .moveTo(x + borderMargin, borderY)
                 .lineTo(x + width - borderMargin, borderY)
                 .stroke();
              doc.restore();
              
              // Reset text color after drawing border
              doc.fillColor(textColor);
            }
          } else {
            // Use PDFKit's built-in text alignment for perfect centering with improved spacing
            doc.text(line.trim(), x + 6, lineY, { // Better horizontal padding for multi-group content
              width: width - 12, // 6px padding on each side for better text spacing
              align: 'center',
              baseline: 'top'
            });
          }
        }
      });
      
      // Reset fill color
      doc.fillColor('#000000');
    }
  }

  _formatPracticalGroupContent(practicalGroup, pdfType = 'class') {
    // Helper function to get unique entities by ID
    const getUniqueEntities = (slots, entityAccessor, idExtractor, valueExtractor) => {
      const entityMap = new Map();
      
      slots.forEach(slot => {
        const entities = entityAccessor(slot);
        if (!entities) return;
        
        if (Array.isArray(entities)) {
          entities.forEach(entity => {
            if (!entity) return;
            const id = idExtractor(entity);
            const value = valueExtractor(entity);
            if (id && value) {
              entityMap.set(id.toString(), value);
            }
          });
        } else {
          const id = idExtractor(entities);
          const value = valueExtractor(entities);
          if (id && value) {
            entityMap.set(id.toString(), value);
          }
        }
      });
      
      return [...entityMap.values()];
    };

    // Group slots by subject (not by subject+group) to properly merge multi-group classes
    const subjectGroups = new Map();
    
    console.log('🔍 Debugging practical group slots:', practicalGroup.slots.length);
    
    practicalGroup.slots.forEach((slot, index) => {
      // Debug logging for room information
      console.log(`  Slot ${index + 1}:`, {
        subject: slot.subjectId?.code || slot.subjectCode_display,
        labGroup: slot.labGroup,
        section: slot.section,
        roomDisplay: slot.roomName_display,
        roomId: slot.roomId?.name || slot.roomId,
        displayRoom: slot.display?.roomName,
        roomName: slot.roomName,
        room: slot.room?.name || slot.room
      });
      
      // Group by subject only (not by subject+group) to enable proper merging
      const subjectCode = slot.subjectId?.code || slot.subjectCode_display || 'N/A';
      const section = slot.section || 'AB';
      
      if (!subjectGroups.has(subjectCode)) {
        subjectGroups.set(subjectCode, {
          subjectCode: subjectCode,
          subjectName: slot.subjectName_display || slot.subjectId?.name || slot.display?.subjectName || 'N/A',
          classType: slot.classType,
          section: section,
          groups: [] // Store different groups (A, B) for this subject
        });
      }
      
      // Enhanced room name extraction for better compatibility
      let roomName = slot.roomName_display || 
                    slot.roomId?.name || 
                    slot.display?.roomName || 
                    slot.room?.name ||
                    slot.roomName ||
                    'TBA';
      
      // Additional fallback for different data structures
      if (!roomName || roomName === 'TBA') {
        if (typeof slot.roomId === 'string') {
          roomName = slot.roomId;
        } else if (slot.room && typeof slot.room === 'string') {
          roomName = slot.room;
        }
      }
      
      console.log(`  → Final room name for ${subjectCode} (Group ${slot.labGroup}): "${roomName}"`);
      
      // Enhanced group labeling with section awareness
      const labGroup = slot.labGroup || 'ALL';
      let enhancedLabGroup = '';
      if (labGroup && labGroup !== 'ALL') {
        // Backend already stores correct group values (A,B for AB section; C,D for CD section)
        enhancedLabGroup = labGroup;
      }
      
      // Add this group to the subject
      subjectGroups.get(subjectCode).groups.push({
        labGroup: enhancedLabGroup,
        originalLabGroup: labGroup,
        teacher: pdfType === 'teacher' ? '' : (
          slot.teacherShortNames_display?.join(', ') || 
          slot.teacherIds?.map(t => t.shortName).filter(Boolean).join(', ') || 
          slot.display?.teacherShortNames?.join(', ') || 
          
          slot.teacherId?.name || slot.teacherName_display || 'TBA'
        ),
        room: pdfType === 'room' ? '' : (slot.classType === 'P' ? roomName : ''), // Only show room for practical classes
        programCode: slot.programCode,
        semester: slot.semester,
        slot: slot
      });
    });
    
    // Format each subject with its groups properly merged
    const formattedSubjects = Array.from(subjectGroups.values()).map(subject => {
      const classType = this._getClassTypeText(subject.classType);
      
      // Get unique teachers and rooms for this subject using our helper
      const allSubjectSlots = subject.groups.map(g => g.slot);
      
      // Get unique teachers for this subject
      const uniqueTeachers = getUniqueEntities(
        allSubjectSlots,
        slot => slot.teacherIds,
        entity => entity._id,
        entity => entity.shortName || entity.fullName
      );
      
      // Get unique rooms for this subject
      const uniqueRooms = getUniqueEntities(
        allSubjectSlots,
        slot => slot.roomId,
        entity => entity._id,
        entity => entity.name
      );
      
      // Get unique lab groups
      const uniqueLabGroups = [...new Set(
        allSubjectSlots
          .filter(slot => slot.labGroup && slot.labGroup !== 'ALL')
          .map(slot => slot.labGroup) // Backend already stores correct group values
      )].sort();
      
      console.log('📊 Consolidated subject data:', {
        subject: subject.subjectCode,
        uniqueTeachers,
        uniqueRooms,
        uniqueLabGroups
      });
      
      // Sort groups by lab group for consistent A, B ordering
      const sortedGroups = subject.groups.sort((a, b) => {
        return (a.labGroup || '').localeCompare(b.labGroup || '');
      });
      
      if (sortedGroups.length === 1) {
        // Single group
        const group = sortedGroups[0];
        const labGroupInfo = group.labGroup ? `(Group ${group.labGroup})` : '';
        
        if (pdfType === 'teacher') {
          // Teacher PDF: Show subject and room only (no teacher names)
          return group.room ? `${labGroupInfo} ${subject.subjectName} [${classType}]\n${group.room}` : `${labGroupInfo} ${subject.subjectName} [${classType}]`;
        } else if (pdfType === 'room') {
          // Room PDF: Show subject and teacher with section info (no room names)
          const section = `${group.programCode}-${group.semester}${subject.section}`;
          const sectionTeacherLine = group.teacher ? `${section} | ${group.teacher}` : section;
          return `${labGroupInfo} ${subject.subjectName} [${classType}]\n${sectionTeacherLine}`;
        } else {
          // Class PDF: Show teacher and room side by side for practical classes (room only for practical)
          if (group.room) {
            return `${labGroupInfo} ${subject.subjectName} [${classType}]\n${group.teacher} | ${group.room}`;
          } else {
            return `${labGroupInfo} ${subject.subjectName} [${classType}]\n${group.teacher}`;
          }
        }
      } else {
        // Multiple groups - show as merged multi-group class using our consolidated data
        const groupLabels = uniqueLabGroups.length > 0 
          ? uniqueLabGroups.map(g => `Group ${g}`).join(' & ')
          : 'Multiple Groups';
        
        if (pdfType === 'teacher') {
          // Teacher PDF: Show subject with group info and rooms (only for practical classes)
          const rooms = uniqueRooms.join(' / ');
          return rooms ? `(${groupLabels}) ${subject.subjectName} [${classType}]\n${rooms}` : `(${groupLabels}) ${subject.subjectName} [${classType}]`;
        } else if (pdfType === 'room') {
          // Room PDF: Show subject with group info and teachers with section
          const section = `${sortedGroups[0].programCode}-${sortedGroups[0].semester}${subject.section}`;
          const teachers = uniqueTeachers.join(' / ');
          const sectionTeacherLine = teachers ? `${section} | ${teachers}` : section;
          return `(${groupLabels}) ${subject.subjectName} [${classType}]\n${sectionTeacherLine}`;
        } else {
          // Class PDF: Show merged groups with teachers and rooms (rooms only for practical classes)
          const teachersLine = uniqueTeachers.join(', ');
          const roomsLine = uniqueRooms.join(', ');
          if (roomsLine) {
            return `(${groupLabels}) ${subject.subjectName} [${classType}]\n${teachersLine} | ${roomsLine}`;
          } else {
            return `(${groupLabels}) ${subject.subjectName} [${classType}]\n${teachersLine}`;
          }
        }
      }
    });
    
    return formattedSubjects.join('\n──────\n');
  }

  _formatSpanningClassContent(span, pdfType = 'class') {
    const firstSlot = span.slots[0];
    const subjectName = firstSlot.subjectName_display || firstSlot.subjectId?.name || firstSlot.display?.subjectName || 'N/A';
    const classType = this._getClassTypeText(firstSlot.classType);
    
    // Teacher names (only if not teacher PDF)
    const teacherNames = pdfType === 'teacher' ? '' : (
      firstSlot.teacherShortNames_display?.join(', ') || 
      firstSlot.teacherIds?.map(t => t.shortName).filter(Boolean).join(', ') || 
      firstSlot.display?.teacherShortNames?.join(', ') || 
      firstSlot.teacherId?.name || firstSlot.teacherName_display || 'TBA'
    );
    
    // Room name (only for practical classes, not for lecture and tutorial)
    const roomName = pdfType === 'room' ? '' : (
      firstSlot.classType === 'P' ? ( // Only show room for practical classes
        firstSlot.roomName_display || 
        firstSlot.roomId?.name || 
        firstSlot.display?.roomName || 
        firstSlot.room?.name ||
        firstSlot.roomName ||
        firstSlot.roomId ||
        'TBA'
      ) : ''
    );
    
    // Enhanced lab group indicator with section awareness
    let labGroupIndicator = '';
    if ((firstSlot.classType === 'P' || firstSlot.isAlternativeWeek === true) && firstSlot.labGroup && firstSlot.labGroup !== 'ALL') {
      // Backend already stores correct group values (A,B for AB section; C,D for CD section)
      labGroupIndicator = `(Group ${firstSlot.labGroup})`;
    }
    
    // Format based on PDF type and class type
    if (pdfType === 'teacher') {
      // Teacher PDF: Don't show teacher names, show room for context (only for practical)
      return roomName ? `${labGroupIndicator} ${subjectName} [${classType}]\n${roomName}` : `${labGroupIndicator} ${subjectName} [${classType}]`;
    } else if (pdfType === 'room') {
      // Room PDF: Don't show room name, show teacher and section for context
      const section = `${firstSlot.programCode}-${firstSlot.semester}${firstSlot.section}`;
      if (firstSlot.classType === 'P') {
        // Practical class: show section and teacher side by side
        const sectionTeacherLine = teacherNames ? `${section} | ${teacherNames}` : section;
        return `${labGroupIndicator} ${subjectName} [${classType}]\n${sectionTeacherLine}`;
      } else {
        // Lecture class: show section and teacher on separate lines
        return teacherNames ? `${section}\n${labGroupIndicator} ${subjectName} [${classType}]\n${teacherNames}` : `${section}\n${labGroupIndicator} ${subjectName} [${classType}]`;
      }
    } else {
      // Class PDF: Show information with conditional room display
      if (firstSlot.classType === 'P') {
        // Practical class: Teacher | Room format for space efficiency
        return roomName ? `${labGroupIndicator} ${subjectName} [${classType}]\n${teacherNames} | ${roomName}` : `${labGroupIndicator} ${subjectName} [${classType}]\n${teacherNames}`;
      } else {
        // Lecture/Tutorial class: Only show teacher, no room
        return `${labGroupIndicator} ${subjectName} [${classType}]\n${teacherNames}`;
      }
    }
  }

  /**
   * Get class type text matching frontend formatting
   */
  _getClassTypeText(classType) {
    switch (classType) {
      case 'L': return 'L';
      case 'P': return 'P';
      case 'T': return 'T';
      case 'BREAK': return 'Break';
      default: return classType || 'N/A';
    }
  }

}

module.exports = PDFRoutineService;
