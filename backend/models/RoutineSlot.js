const mongoose = require('mongoose');
const { getSemesterGroupName } = require('../utils/semesterGroupUtils');

const routineSlotSchema = new mongoose.Schema({
  // Context (Enhanced with new fields)
  programId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Program',
    required: true
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: function() {
      return this.classType !== 'BREAK' && !this.isElectiveClass;
    }
  },
  
  // Multiple subjects support for elective classes
  subjectIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  }],
  academicYearId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicCalendar',
    required: true
  },
  
  // Schedule Position
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  semesterGroup: {
    type: String,
    required: true,
    enum: ['odd', 'even'],
    // Automatically calculated from semester number using custom grouping logic
    default: function() {
      return getSemesterGroupName(this.semester);
    }
  },
  section: {
    type: String,
    required: true,
    enum: ['AB', 'CD'],
    uppercase: true
  },
  dayIndex: {
    type: Number,
    required: true,
    min: 0,
    max: 6 // 0=Sunday, 1=Monday, ..., 6=Saturday
  },
  slotIndex: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Assignment
  teacherIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: function() {
      return this.classType !== 'BREAK';
    }
  }],
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: function() {
      return this.classType !== 'BREAK';
    }
  },
  classType: {
    type: String,
    required: true,
    enum: ['L', 'P', 'T', 'BREAK'], // Lecture, Practical, Tutorial, Break
    default: 'L'
  },
  
  // Lab Management
  labGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabGroup',
    default: null
    // For practical sessions
  },
  labGroupName: {
    type: String,
    trim: true,
    maxlength: 20
    // Quick reference
  },
  labGroup: {
    type: String,
    enum: ['A', 'B', 'C', 'D', 'ALL', null],
    default: null
    // For distinguishing between Group A, Group B, Group C, Group D, or ALL (all groups)
  },
  
  // Alternative Week Support for Lab Groups
  isAlternativeWeek: {
    type: Boolean,
    default: false
    // If true, the lab group alternates between weeks
  },
  
  // Elective Management - Enhanced for 7th/8th semester
  electiveGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ElectiveGroup',
    default: null
    // For elective subjects
  },
  sectionElectiveChoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SectionElectiveChoice',
    default: null
  },
  
  // Enhanced Section Targeting for Mixed Electives
  targetSections: [{
    type: String,
    enum: ['AB', 'CD'],
    uppercase: true
    // Which sections' students attend this class
  }],
  displayInSections: [{
    type: String,
    enum: ['AB', 'CD'],
    uppercase: true
    // Which section routines should show this slot
  }],
  
  // Class categorization
  classCategory: {
    type: String,
    enum: ['CORE', 'ELECTIVE', 'COMMON'],
    default: 'CORE'
  },
  isElectiveClass: {
    type: Boolean,
    default: false
  },
  
  // Elective-specific information
  electiveInfo: {
    electiveNumber: {
      type: Number,
      min: 1,
      max: 3,
      default: null
      // 1st elective, 2nd elective for 8th semester
    },
    electiveType: {
      type: String,
      enum: ['TECHNICAL', 'MANAGEMENT', 'OPEN'],
      default: null
    },
    groupName: {
      type: String,
      trim: true,
      maxlength: 100
      // "7th Sem Technical Elective"
    },
    electiveCode: {
      type: String,
      uppercase: true,
      trim: true,
      maxlength: 20
      // "ELEC-TECH-1"
    },
    studentComposition: {
      total: {
        type: Number,
        min: 0,
        default: 0
      },
      fromAB: {
        type: Number,
        min: 0,
        default: 0
      },
      fromCD: {
        type: Number,
        min: 0,
        default: 0
      },
      distributionNote: {
        type: String,
        trim: true,
        maxlength: 200
        // "32 students (18 from AB, 14 from CD)"
      }
    },
    displayOptions: {
      showInBothSections: {
        type: Boolean,
        default: false
      },
      highlightAsElective: {
        type: Boolean,
        default: false
      },
      customDisplayText: {
        type: String,
        trim: true,
        maxlength: 150
      }
    }
  },
  
  // Recurrence Pattern (New comprehensive structure)
  recurrence: {
    type: {
      type: String,
      enum: ['weekly', 'alternate', 'custom'],
      default: 'weekly'
    },
    pattern: {
      type: String,
      enum: ['odd', 'even'],
      default: null
      // For alternate weeks
    },
    customWeeks: [{
      type: Number,
      min: 1,
      max: 16
      // For custom patterns
    }],
    description: {
      type: String,
      trim: true,
      maxlength: 100
      // Human readable
    }
  },
  
  // Denormalized Display Data (Enhanced)
  display: {
    programCode: {
      type: String,
      uppercase: true,
      trim: true
    },
    subjectCode: {
      type: String,
      uppercase: true,
      trim: true
    },
    subjectName: {
      type: String,
      trim: true
    },
    teacherNames: [{
      type: String,
      trim: true
    }],
    roomName: {
      type: String,
      trim: true
    },
    timeSlot: {
      type: String,
      trim: true
    }
  },
  
  // Multi-Period Support
  spanInfo: {
    isMaster: {
      type: Boolean,
      default: false
    },
    spanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoutineSlot',
      default: null
      // References master slot
    },
    totalSlots: {
      type: Number,
      default: 1,
      min: 1
    }
  },
  
  // Administrative
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Legacy fields for backward compatibility
  programCode: {
    type: String,
    uppercase: true,
    trim: true
  },
  
  // Legacy denormalized fields
  subjectName_display: {
    type: String,
    trim: true
  },
  subjectCode_display: {
    type: String,
    trim: true
  },
  teacherShortNames_display: [{
    type: String,
    trim: true
  }],
  roomName_display: {
    type: String,
    trim: true
  },
  timeSlot_display: {
    type: String,
    trim: true
  },
  
  // Legacy multi-slot fields
  spanMaster: {
    type: Boolean,
    default: false
  },
  spanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoutineSlot',
    default: null
  },
  
  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Indexes as per data model specification
routineSlotSchema.index({ 
  programId: 1, 
  semester: 1, 
  section: 1, 
  dayIndex: 1, 
  slotIndex: 1, 
  academicYearId: 1 
});
routineSlotSchema.index({ 
  teacherIds: 1, 
  dayIndex: 1, 
  slotIndex: 1 
});
routineSlotSchema.index({ 
  roomId: 1, 
  dayIndex: 1, 
  slotIndex: 1 
});
routineSlotSchema.index({ 
  academicYearId: 1, 
  isActive: 1 
});
routineSlotSchema.index({ subjectId: 1 });
routineSlotSchema.index({ labGroupId: 1 });

// Legacy indexes for backward compatibility - Updated to support multiple lab groups per slot and semester groups
routineSlotSchema.index({ 
  programCode: 1, 
  semester: 1, 
  section: 1, 
  dayIndex: 1, 
  slotIndex: 1,
  labGroup: 1,  // Include labGroup to allow separate Group A and Group B slots
  semesterGroup: 1  // Include semesterGroup to allow separate odd/even semester classes
}, { unique: true });
routineSlotSchema.index({ programCode: 1, semester: 1, section: 1 });
routineSlotSchema.index({ teacherIds: 1 });

// Instance methods
routineSlotSchema.methods.isAlternateWeek = function() {
  return this.recurrence && this.recurrence.type === 'alternate';
};

routineSlotSchema.methods.isWeekly = function() {
  return !this.recurrence || this.recurrence.type === 'weekly';
};

routineSlotSchema.methods.getRecurrenceDescription = function() {
  if (!this.recurrence) return 'Weekly';
  
  switch(this.recurrence.type) {
    case 'weekly':
      return 'Weekly';
    case 'alternate':
      return `Alternate weeks (${this.recurrence.pattern || 'odd'})`;
    case 'custom':
      return this.recurrence.description || 'Custom pattern';
    default:
      return 'Weekly';
  }
};

routineSlotSchema.methods.appliesToWeek = function(weekNumber) {
  if (!this.recurrence || this.recurrence.type === 'weekly') {
    return true;
  }
  
  if (this.recurrence.type === 'alternate') {
    const isOddWeek = weekNumber % 2 === 1;
    return (this.recurrence.pattern === 'odd' && isOddWeek) ||
           (this.recurrence.pattern === 'even' && !isOddWeek);
  }
  
  if (this.recurrence.type === 'custom') {
    return this.recurrence.customWeeks && 
           this.recurrence.customWeeks.includes(weekNumber);
  }
  
  return true;
};

routineSlotSchema.methods.isLabSession = function() {
  return this.classType === 'P' && this.labGroupId;
};

routineSlotSchema.methods.getTimeSlotDisplay = function() {
  return this.display.timeSlot || this.timeSlot_display || `Slot ${this.slotIndex}`;
};

// Static methods
routineSlotSchema.statics.findConflicts = function(dayIndex, slotIndex, teacherIds, roomId, weekPattern) {
  const query = {
    dayIndex: dayIndex,
    slotIndex: slotIndex,
    isActive: true,
    $or: [
      { teacherIds: { $in: teacherIds } },
      { roomId: roomId }
    ]
  };
  
  // Add recurrence pattern checking if provided
  if (weekPattern) {
    query.$or.push(
      { 'recurrence.type': 'weekly' },
      { 'recurrence.pattern': weekPattern }
    );
  }
  
  return this.find(query);
};

routineSlotSchema.statics.findByProgram = function(programId, semester, section, academicYearId) {
  return this.find({
    programId: programId,
    semester: semester,
    section: section,
    academicYearId: academicYearId,
    isActive: true
  }).sort({ dayIndex: 1, slotIndex: 1 });
};

routineSlotSchema.statics.findByTeacher = function(teacherId, academicYearId) {
  return this.find({
    teacherIds: teacherId,
    academicYearId: academicYearId,
    isActive: true
  }).sort({ dayIndex: 1, slotIndex: 1 });
};

routineSlotSchema.statics.findLabSessions = function(programId, subjectId, academicYearId) {
  return this.find({
    programId: programId,
    subjectId: subjectId,
    academicYearId: academicYearId,
    classType: 'P',
    labGroupId: { $exists: true },
    isActive: true
  });
};

// Pre-save middleware
routineSlotSchema.pre('save', async function(next) {
  // Auto-calculate semesterGroup from semester using custom grouping logic
  if (this.isModified('semester') || this.isNew) {
    this.semesterGroup = getSemesterGroupName(this.semester);
  }
  
  // Validate elective classes have synchronized subjects and teachers
  if (this.isElectiveClass && this.subjectIds && this.subjectIds.length > 0) {
    if (this.subjectIds.length !== this.teacherIds.length) {
      return next(new Error('For elective classes, the number of subjects must match the number of teachers'));
    }
    
    // Ensure no duplicate subjects
    const uniqueSubjects = [...new Set(this.subjectIds.map(id => id.toString()))];
    if (uniqueSubjects.length !== this.subjectIds.length) {
      return next(new Error('Duplicate subjects are not allowed in elective classes'));
    }
  }
  
  // Auto-populate display fields from related models
  if (this.isModified('programId') || this.isModified('subjectId') || this.isModified('subjectIds') || this.isNew) {
    const Program = mongoose.model('Program');
    const Subject = mongoose.model('Subject');
    const Room = mongoose.model('Room');
    const Teacher = mongoose.model('Teacher');
    
    const [program, room] = await Promise.all([
      Program.findById(this.programId),
      Room.findById(this.roomId)
    ]);
    
    // Handle subjects (single or multiple for electives)
    let subjects = [];
    if (this.isElectiveClass && this.subjectIds && this.subjectIds.length > 0) {
      subjects = await Subject.find({ _id: { $in: this.subjectIds } });
    } else if (this.subjectId) {
      const subject = await Subject.findById(this.subjectId);
      if (subject) subjects = [subject];
    }
    
    if (program) {
      this.display.programCode = program.code;
      this.programCode = program.code; // Legacy field
    }
    
    if (subjects.length > 0) {
      if (this.isElectiveClass && subjects.length > 1) {
        // Multiple subjects for electives
        this.display.subjectCode = subjects.map(s => s.code).join(', ');
        this.display.subjectName = subjects.map(s => s.name).join(', ');
        this.subjectCode_display = subjects.map(s => s.code).join(', '); // Legacy field
        this.subjectName_display = subjects.map(s => s.name).join(', '); // Legacy field
      } else {
        // Single subject
        this.display.subjectCode = subjects[0].code;
        this.display.subjectName = subjects[0].name;
        this.subjectCode_display = subjects[0].code; // Legacy field
        this.subjectName_display = subjects[0].name; // Legacy field
      }
    }
    
    if (room) {
      this.display.roomName = room.name;
      this.roomName_display = room.name; // Legacy field
    }
    
    // Get teacher names
    if (this.teacherIds && this.teacherIds.length > 0) {
      const teachers = await Teacher.find({ _id: { $in: this.teacherIds } });
      this.display.teacherNames = teachers.map(t => t.shortName);
      this.teacherShortNames_display = teachers.map(t => t.shortName); // Legacy field
    }
  }
  
  // Set default recurrence if not provided
  if (!this.recurrence || !this.recurrence.type) {
    this.recurrence = {
      type: 'weekly',
      description: 'Weekly'
    };
  }
  
  // Auto-populate lab group name if labGroupId is set
  if (this.labGroupId && !this.labGroupName) {
    const LabGroup = mongoose.model('LabGroup');
    const labGroup = await LabGroup.findById(this.labGroupId);
    if (labGroup) {
      // Find the specific group within the lab group
      const group = labGroup.groups.find(g => 
        g.weekPattern === this.recurrence.pattern
      );
      if (group) {
        this.labGroupName = group.name;
      }
    }
  }
  
  next();
});

module.exports = mongoose.model('RoutineSlot', routineSlotSchema);
