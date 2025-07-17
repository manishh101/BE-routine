/**
 * BCT Routine Database Configuration
 * 
 * This file contains the database configuration specifically for the
 * bctroutine database setup and management.
 */

const mongoose = require('mongoose');

// Database configuration for bctroutine
const bctRoutineConfig = {
  // Database name
  dbName: 'bctroutine',
  
  // Connection options
  connectionOptions: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    bufferCommands: false,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4, // Use IPv4, skip trying IPv6
  },
  
  // Model definitions with their collection names
  models: {
    User: 'users',
    Department: 'departments', 
    Program: 'programs',
    Subject: 'subjects',
    Teacher: 'teachers',
    Room: 'rooms',
    TimeSlot: 'timeslots',
    RoutineSlot: 'routineslots',
    RoutineSlotNew: 'routineslotsnew',
    AcademicCalendar: 'academiccalendars',
    AcademicSession: 'academicsessions',
    ProgramSemester: 'programsemesters',
    LabGroup: 'labgroups',
    ElectiveGroup: 'electivegroups',
    SectionElectiveChoice: 'sectionelectivechoices',
    RoutineTemplate: 'routinetemplates',
    TeacherScheduleView: 'teacherscheduleviews'
  },
  
  // Index definitions for optimal performance
  indexes: {
    // User indexes
    users: [
      { email: 1 },
      { role: 1 },
      { isActive: 1 }
    ],
    
    // Academic Session indexes  
    academicsessions: [
      { sessionId: 1 },
      { status: 1 },
      { 'academicYear.nepaliYear': 1 },
      { semester: 1 },
      { startDate: 1, endDate: 1 }
    ],
    
    // Routine Slot indexes (most critical for performance)
    routineslots: [
      { programId: 1, semester: 1, section: 1 },
      { dayIndex: 1, slotIndex: 1 },
      { teacherIds: 1 },
      { roomId: 1 },
      { academicYearId: 1 },
      { isActive: 1 },
      { dayIndex: 1, slotIndex: 1, teacherIds: 1 }, // Compound for conflict detection
      { dayIndex: 1, slotIndex: 1, roomId: 1 } // Compound for room conflicts
    ],
    
    // Program indexes
    programs: [
      { code: 1 },
      { departmentId: 1 },
      { level: 1 }
    ],
    
    // Subject indexes
    subjects: [
      { subjectCode: 1 },
      { departmentId: 1 },
      { semester: 1 }
    ],
    
    // Teacher indexes
    teachers: [
      { shortName: 1 },
      { departmentId: 1 },
      { isActive: 1 }
    ],
    
    // Room indexes
    rooms: [
      { roomCode: 1 },
      { building: 1 },
      { roomType: 1 },
      { isActive: 1 }
    ],
    
    // TimeSlot indexes
    timeslots: [
      { _id: 1 }, // slotIndex
      { dayType: 1 },
      { sortOrder: 1 },
      { isBreak: 1 }
    ]
  },
  
  // Data validation rules
  validationRules: {
    // Session ID format: YYYY-S[1-3]
    sessionIdPattern: /^\d{4}-S[1-3]$/,
    
    // Program code format: 3-10 uppercase letters
    programCodePattern: /^[A-Z]{3,10}$/,
    
    // Subject code format: 3-10 alphanumeric characters
    subjectCodePattern: /^[A-Z0-9]{3,10}$/,
    
    // Teacher short name format: 2-10 characters
    teacherShortNamePattern: /^[A-Za-z]{2,10}$/,
    
    // Room code format: 2-10 alphanumeric characters
    roomCodePattern: /^[A-Z0-9]{2,10}$/
  },
  
  // Default data for initial setup
  defaultData: {
    // Default time slots for IoE Pulchowk
    timeSlots: [
      { _id: 1, label: '10:15-11:05', startTime: '10:15', endTime: '11:05', sortOrder: 1, dayType: 'Regular', isBreak: false, category: 'Morning' },
      { _id: 2, label: '11:05-11:55', startTime: '11:05', endTime: '11:55', sortOrder: 2, dayType: 'Regular', isBreak: false, category: 'Morning' },
      { _id: 3, label: '11:55-12:45', startTime: '11:55', endTime: '12:45', sortOrder: 3, dayType: 'Regular', isBreak: false, category: 'Morning' },
      { _id: 4, label: '12:45-13:35', startTime: '12:45', endTime: '13:35', sortOrder: 4, dayType: 'Regular', isBreak: false, category: 'Afternoon' },
      { _id: 5, label: '13:35-14:25', startTime: '13:35', endTime: '14:25', sortOrder: 5, dayType: 'Regular', isBreak: false, category: 'Afternoon' },
      { _id: 6, label: '14:25-15:15', startTime: '14:25', endTime: '15:15', sortOrder: 6, dayType: 'Regular', isBreak: false, category: 'Afternoon' },
      { _id: 7, label: '15:15-16:05', startTime: '15:15', endTime: '16:05', sortOrder: 7, dayType: 'Regular', isBreak: false, category: 'Afternoon' },
      { _id: 8, label: '16:05-16:55', startTime: '16:05', endTime: '16:55', sortOrder: 8, dayType: 'Regular', isBreak: false, category: 'Evening' }
    ],
    
    // Default user roles
    userRoles: ['admin', 'teacher', 'student', 'staff'],
    
    // Default semester options
    semesters: ['FIRST', 'SECOND', 'THIRD'],
    
    // Default section options
    sections: ['AB', 'CD'],
    
    // Default class types
    classTypes: ['L', 'P', 'T'], // Lecture, Practical, Tutorial
    
    // Default room types
    roomTypes: ['Classroom', 'Laboratory', 'Computer Lab', 'Seminar Hall', 'Auditorium']
  }
};

// Helper function to get connection URI for bctroutine database
const getBCTRoutineURI = (baseURI) => {
  if (!baseURI) {
    throw new Error('Base MongoDB URI is required');
  }
  
  // Replace database name in URI with bctroutine
  return baseURI.replace(/\/[^/?]+(\?|$)/, `/bctroutine$1`);
};

// Helper function to connect to bctroutine database
const connectToBCTRoutine = async (baseURI, options = {}) => {
  const uri = getBCTRoutineURI(baseURI);
  const connectionOptions = { ...bctRoutineConfig.connectionOptions, ...options };
  
  try {
    await mongoose.connect(uri, connectionOptions);
    console.log(`✅ Connected to bctroutine database successfully`);
    return mongoose.connection;
  } catch (error) {
    console.error(`❌ Failed to connect to bctroutine database:`, error.message);
    throw error;
  }
};

module.exports = {
  bctRoutineConfig,
  getBCTRoutineURI,
  connectToBCTRoutine
};
