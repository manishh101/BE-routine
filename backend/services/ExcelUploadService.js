const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Import all models
const Department = require('../models/Department');
const Program = require('../models/Program');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Room = require('../models/Room');
const TimeSlot = require('../models/TimeSlot');
const RoutineSlot = require('../models/RoutineSlot');
const AcademicSession = require('../models/AcademicSession');
const LabGroup = require('../models/LabGroup');
const ElectiveGroup = require('../models/ElectiveGroup');

/**
 * 🚀 Excel Data Upload Service
 * Handles bulk upload of academic data from Excel files
 * 
 * Supported data types:
 * - Teachers
 * - Subjects  
 * - Rooms
 * - Routine Schedules
 * - Lab Groups
 * - Elective Groups
 */

class ExcelUploadService {
  constructor() {
    this.uploadResults = {
      success: 0,
      failed: 0,
      errors: [],
      created: [],
      skipped: []
    };
  }

  /**
   * Main upload handler - detects file type and routes to appropriate processor
   */
  async uploadFromExcel(filePath, dataType, options = {}) {
    try {
      console.log(`📁 Processing Excel file: ${filePath}`);
      console.log(`📊 Data type: ${dataType}`);

      // Reset results
      this.resetResults();

      // Read Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetNames = workbook.SheetNames;
      console.log(`📋 Available sheets: ${sheetNames.join(', ')}`);

      // Process based on data type
      switch (dataType.toLowerCase()) {
        case 'teachers':
          return await this.uploadTeachers(workbook, options);
        case 'subjects':
          return await this.uploadSubjects(workbook, options);
        case 'rooms':
          return await this.uploadRooms(workbook, options);
        case 'routine':
        case 'schedule':
          return await this.uploadRoutine(workbook, options);
        case 'labgroups':
          return await this.uploadLabGroups(workbook, options);
        case 'electives':
          return await this.uploadElectives(workbook, options);
        case 'complete':
          return await this.uploadCompleteData(workbook, options);
        default:
          throw new Error(`Unsupported data type: ${dataType}`);
      }

    } catch (error) {
      console.error('❌ Excel upload error:', error);
      throw error;
    }
  }

  /**
   * Upload Teachers from Excel
   */
  async uploadTeachers(workbook, options = {}) {
    const sheetName = options.sheetName || 'Teachers';
    const sheet = workbook.Sheets[sheetName];
    
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found. Available sheets: ${Object.keys(workbook.Sheets).join(', ')}`);
    }

    console.log(`👥 Processing teachers from sheet: ${sheetName}`);
    
    // Convert sheet to JSON
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`📊 Found ${data.length} teacher records`);

    // Get department for reference
    const department = await Department.findOne({ code: options.departmentCode || 'DOECE' });
    if (!department) {
      throw new Error('Department not found. Please create department first.');
    }

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        
        // Map Excel columns to teacher model
        const teacherData = {
          fullName: row['Full Name'] || row['fullName'] || row['Name'],
          shortName: row['Short Name'] || row['shortName'] || row['Initials'],
          email: row['Email'] || row['email'],
          departmentId: department._id,
          designation: row['Designation'] || row['designation'] || 'Assistant Professor',
          phoneNumber: row['Phone'] || row['phoneNumber'] || row['Contact'],
          isActive: true,
          isFullTime: row['Full Time'] !== 'No', // Default to true unless specified
          maxWeeklyHours: parseInt(row['Max Hours'] || row['maxWeeklyHours']) || 16,
          availableDays: [0, 1, 2, 3, 4, 5], // Monday to Saturday
          specializations: [],
          expertise: row['Expertise'] ? row['Expertise'].split(',').map(s => s.trim()) : [],
          unavailableSlots: [],
          availabilityOverrides: []
        };

        // Validate required fields
        if (!teacherData.fullName || !teacherData.email) {
          this.uploadResults.errors.push(`Row ${i + 1}: Missing required fields (Full Name, Email)`);
          this.uploadResults.failed++;
          continue;
        }

        // Check if teacher already exists
        const existingTeacher = await Teacher.findOne({ email: teacherData.email });
        if (existingTeacher) {
          this.uploadResults.skipped.push(`${teacherData.fullName} (${teacherData.email}) - already exists`);
          continue;
        }

        // Create teacher
        const teacher = new Teacher(teacherData);
        await teacher.save();
        
        this.uploadResults.created.push(`${teacherData.fullName} (${teacherData.email})`);
        this.uploadResults.success++;

      } catch (error) {
        this.uploadResults.errors.push(`Row ${i + 1}: ${error.message}`);
        this.uploadResults.failed++;
      }
    }

    return this.getResults('Teachers Upload');
  }

  /**
   * Upload Subjects from Excel
   */
  async uploadSubjects(workbook, options = {}) {
    const sheetName = options.sheetName || 'Subjects';
    const sheet = workbook.Sheets[sheetName];
    
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }

    console.log(`📚 Processing subjects from sheet: ${sheetName}`);
    
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`📊 Found ${data.length} subject records`);

    // Get program for reference
    const program = await Program.findOne({ code: options.programCode || 'BCE' });
    if (!program) {
      throw new Error('Program not found. Please create program first.');
    }

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        
        const subjectData = {
          name: row['Subject Name'] || row['name'],
          code: row['Subject Code'] || row['code'],
          programId: [program._id],
          semester: parseInt(row['Semester'] || row['semester']),
          credits: {
            theory: parseInt(row['Theory Credits'] || row['theoryCredits']) || 0,
            practical: parseInt(row['Practical Credits'] || row['practicalCredits']) || 0,
            tutorial: parseInt(row['Tutorial Credits'] || row['tutorialCredits']) || 0
          },
          weeklyHours: {
            theory: parseInt(row['Theory Hours'] || row['theoryHours']) || 0,
            practical: parseInt(row['Practical Hours'] || row['practicalHours']) || 0,
            tutorial: parseInt(row['Tutorial Hours'] || row['tutorialHours']) || 0
          },
          subjectType: row['Type'] || row['subjectType'] || 'theory',
          isElective: row['Elective'] === 'Yes' || row['isElective'] === true,
          isActive: true
        };

        // Validate required fields
        if (!subjectData.name || !subjectData.code) {
          this.uploadResults.errors.push(`Row ${i + 1}: Missing required fields (Subject Name, Subject Code)`);
          this.uploadResults.failed++;
          continue;
        }

        // Check if subject already exists
        const existingSubject = await Subject.findOne({ code: subjectData.code });
        if (existingSubject) {
          this.uploadResults.skipped.push(`${subjectData.name} (${subjectData.code}) - already exists`);
          continue;
        }

        // Create subject
        const subject = new Subject(subjectData);
        await subject.save();
        
        this.uploadResults.created.push(`${subjectData.name} (${subjectData.code})`);
        this.uploadResults.success++;

      } catch (error) {
        this.uploadResults.errors.push(`Row ${i + 1}: ${error.message}`);
        this.uploadResults.failed++;
      }
    }

    return this.getResults('Subjects Upload');
  }

  /**
   * Upload Rooms from Excel
   */
  async uploadRooms(workbook, options = {}) {
    const sheetName = options.sheetName || 'Rooms';
    const sheet = workbook.Sheets[sheetName];
    
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }

    console.log(`🏢 Processing rooms from sheet: ${sheetName}`);
    
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`📊 Found ${data.length} room records`);

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        
        const roomData = {
          name: row['Room Name'] || row['name'],
          code: row['Room Code'] || row['code'],
          capacity: parseInt(row['Capacity'] || row['capacity']) || 30,
          roomType: row['Type'] || row['roomType'] || 'LECTURE',
          floor: parseInt(row['Floor'] || row['floor']) || 1,
          building: row['Building'] || row['building'] || 'Main Building',
          isActive: true
        };

        // Validate required fields
        if (!roomData.name || !roomData.code) {
          this.uploadResults.errors.push(`Row ${i + 1}: Missing required fields (Room Name, Room Code)`);
          this.uploadResults.failed++;
          continue;
        }

        // Check if room already exists
        const existingRoom = await Room.findOne({ code: roomData.code });
        if (existingRoom) {
          this.uploadResults.skipped.push(`${roomData.name} (${roomData.code}) - already exists`);
          continue;
        }

        // Create room
        const room = new Room(roomData);
        await room.save();
        
        this.uploadResults.created.push(`${roomData.name} (${roomData.code})`);
        this.uploadResults.success++;

      } catch (error) {
        this.uploadResults.errors.push(`Row ${i + 1}: ${error.message}`);
        this.uploadResults.failed++;
      }
    }

    return this.getResults('Rooms Upload');
  }

  /**
   * Upload Complete Routine from Excel
   */
  async uploadRoutine(workbook, options = {}) {
    console.log(`📅 Processing routine data...`);
    
    const results = {
      sheets: [],
      totalSlots: 0,
      created: 0,
      errors: []
    };

    // Process each sheet as a different section
    for (const sheetName of workbook.SheetNames) {
      try {
        console.log(`📋 Processing sheet: ${sheetName}`);
        
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        // Parse section info from sheet name (e.g., "BCE-4-A" or "Section A")
        const sectionInfo = this.parseSectionInfo(sheetName, options);
        
        const sheetResult = await this.processRoutineSheet(data, sectionInfo);
        results.sheets.push({
          sheetName,
          ...sheetResult
        });
        
        results.totalSlots += sheetResult.created;
        results.created += sheetResult.created;
        
      } catch (error) {
        console.error(`❌ Error processing sheet ${sheetName}:`, error);
        results.errors.push(`Sheet ${sheetName}: ${error.message}`);
      }
    }

    return {
      success: true,
      message: `Routine upload completed`,
      data: results,
      summary: {
        sheetsProcessed: results.sheets.length,
        totalSlotsCreated: results.created,
        errors: results.errors.length
      }
    };
  }

  /**
   * Process individual routine sheet
   */
  async processRoutineSheet(data, sectionInfo) {
    const timeSlots = await TimeSlot.find().sort({ sortOrder: 1 });
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    let created = 0;
    const errors = [];

    // Find header row and time slot columns
    const headerRowIndex = this.findHeaderRow(data);
    if (headerRowIndex === -1) {
      throw new Error('Could not find header row with time slots');
    }

    const timeSlotColumns = this.mapTimeSlotColumns(data[headerRowIndex], timeSlots);
    
    // Process each day row
    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
      const dayRowIndex = headerRowIndex + 1 + dayIndex;
      
      if (dayRowIndex >= data.length) continue;
      
      const dayRow = data[dayRowIndex];
      
      // Process each time slot for this day
      for (const [slotIndex, columnIndex] of timeSlotColumns.entries()) {
        try {
          const cellValue = dayRow[columnIndex];
          
          if (cellValue && cellValue.toString().trim() !== '') {
            const slotData = this.parseRoutineSlot(cellValue, {
              dayIndex,
              slotIndex,
              ...sectionInfo
            });
            
            if (slotData) {
              await this.createRoutineSlot(slotData);
              created++;
            }
          }
        } catch (error) {
          errors.push(`Day ${days[dayIndex]}, Slot ${slotIndex + 1}: ${error.message}`);
        }
      }
    }

    return { created, errors };
  }

  /**
   * Parse routine slot data from Excel cell
   */
  parseRoutineSlot(cellValue, context) {
    const parts = cellValue.toString().split('\n');
    
    // Extract subject, teacher, room information
    // Format: "Subject Name\nTeacher\nRoom"
    // or "Subject (Type)\nTeacher\nRoom"
    
    const subjectLine = parts[0] || '';
    const teacherLine = parts[1] || '';
    const roomLine = parts[2] || '';

    // Parse subject and class type
    const subjectMatch = subjectLine.match(/^(.+?)(?:\s*\(([LT])\))?$/);
    const subjectName = subjectMatch ? subjectMatch[1].trim() : subjectLine.trim();
    const classType = subjectMatch && subjectMatch[2] ? subjectMatch[2] : 'L';

    return {
      ...context,
      subjectName,
      teacherName: teacherLine.trim(),
      roomCode: roomLine.trim(),
      classType: classType === 'T' ? 'tutorial' : 'theory'
    };
  }

  /**
   * Create routine slot in database
   */
  async createRoutineSlot(slotData) {
    // Find references
    const program = await Program.findOne({ code: slotData.programCode });
    const subject = await Subject.findOne({ name: slotData.subjectName });
    const teacher = await Teacher.findOne({ shortName: slotData.teacherName });
    const room = await Room.findOne({ code: slotData.roomCode });
    const academicSession = await AcademicSession.findOne({ status: 'ACTIVE' });

    if (!program) throw new Error(`Program not found: ${slotData.programCode}`);
    if (!subject) throw new Error(`Subject not found: ${slotData.subjectName}`);
    if (!teacher) throw new Error(`Teacher not found: ${slotData.teacherName}`);
    if (!room) throw new Error(`Room not found: ${slotData.roomCode}`);
    if (!academicSession) throw new Error('No active academic session found');

    // Check for conflicts
    const existingSlot = await RoutineSlot.findOne({
      dayIndex: slotData.dayIndex,
      slotIndex: slotData.slotIndex,
      programId: program._id,
      semester: slotData.semester,
      section: slotData.section,
      academicYearId: academicSession._id
    });

    if (existingSlot) {
      throw new Error('Slot already occupied');
    }

    // Create routine slot
    const routineSlot = new RoutineSlot({
      dayIndex: slotData.dayIndex,
      slotIndex: slotData.slotIndex,
      semester: slotData.semester,
      year: Math.ceil(slotData.semester / 2),
      section: slotData.section,
      classType: slotData.classType,
      academicYearId: academicSession._id,
      programId: program._id,
      subjectId: subject._id,
      teacherIds: [teacher._id],
      roomId: room._id,
      isSpanned: false
    });

    await routineSlot.save();
    return routineSlot;
  }

  /**
   * Utility methods
   */
  parseSectionInfo(sheetName, options) {
    // Try to parse from sheet name: "BCE-4-A" or "Section A"
    const match = sheetName.match(/([A-Z]+)-?(\d+)-?([A-Z]+)/);
    
    if (match) {
      return {
        programCode: match[1],
        semester: parseInt(match[2]),
        section: match[3]
      };
    }
    
    // Use provided options
    return {
      programCode: options.programCode || 'BCE',
      semester: options.semester || 4,
      section: options.section || 'A'
    };
  }

  findHeaderRow(data) {
    // Look for row containing time slot information
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (row && row.some(cell => 
        cell && cell.toString().match(/period|time|slot|9:00|10:00/i)
      )) {
        return i;
      }
    }
    return -1;
  }

  mapTimeSlotColumns(headerRow, timeSlots) {
    const columns = [];
    
    for (let i = 1; i < headerRow.length; i++) {
      const cellValue = headerRow[i];
      if (cellValue && cellValue.toString().match(/\d+:\d+|\d+th|period/i)) {
        columns.push(i);
      }
    }
    
    return columns;
  }

  resetResults() {
    this.uploadResults = {
      success: 0,
      failed: 0,
      errors: [],
      created: [],
      skipped: []
    };
  }

  getResults(operation) {
    return {
      success: true,
      operation,
      summary: {
        total: this.uploadResults.success + this.uploadResults.failed,
        successful: this.uploadResults.success,
        failed: this.uploadResults.failed,
        skipped: this.uploadResults.skipped.length
      },
      details: {
        created: this.uploadResults.created,
        skipped: this.uploadResults.skipped,
        errors: this.uploadResults.errors
      }
    };
  }

  /**
   * Generate Excel template for download
   */
  generateTemplate(dataType) {
    const templates = {
      teachers: {
        headers: ['Full Name', 'Short Name', 'Email', 'Designation', 'Phone', 'Max Hours', 'Full Time', 'Expertise'],
        sample: ['Dr. John Smith', 'JS', 'john.smith@ioe.edu.np', 'Professor', '+977-1-5555555', '16', 'Yes', 'Machine Learning, AI']
      },
      subjects: {
        headers: ['Subject Name', 'Subject Code', 'Semester', 'Theory Credits', 'Practical Credits', 'Theory Hours', 'Practical Hours', 'Type', 'Elective'],
        sample: ['Data Structures', 'CT461', '4', '3', '1', '3', '3', 'both', 'No']
      },
      rooms: {
        headers: ['Room Name', 'Room Code', 'Capacity', 'Type', 'Floor', 'Building'],
        sample: ['Computer Lab 1', 'CL01', '30', 'LAB', '2', 'Computer Block']
      }
    };

    const template = templates[dataType.toLowerCase()];
    if (!template) {
      throw new Error(`No template available for: ${dataType}`);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([template.headers, template.sample]);
    XLSX.utils.book_append_sheet(wb, ws, dataType);

    return wb;
  }
}

module.exports = ExcelUploadService;
