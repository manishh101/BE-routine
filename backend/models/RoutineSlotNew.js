const mongoose = require('mongoose');

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
    required: true
  },
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
    required: true
  }],
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  classType: {
    type: String,
    required: true,
    enum: ['L', 'P', 'T'], // Lecture, Practical, Tutorial
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
  
  // Elective Management
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
      ref: 'RoutineSlotNew',
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
    ref: 'RoutineSlotNew',
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

// Legacy indexes for backward compatibility
routineSlotSchema.index({ 
  programCode: 1, 
  semester: 1, 
  section: 1, 
  dayIndex: 1, 
  slotIndex: 1 
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
  // Auto-populate display fields from related models
  if (this.isModified('programId') || this.isModified('subjectId') || this.isNew) {
    const Program = mongoose.model('Program');
    const Subject = mongoose.model('Subject');
    const Room = mongoose.model('Room');
    const Teacher = mongoose.model('Teacher');
    
    const [program, subject, room] = await Promise.all([
      Program.findById(this.programId),
      Subject.findById(this.subjectId),
      Room.findById(this.roomId)
    ]);
    
    if (program) {
      this.display.programCode = program.code;
      this.programCode = program.code; // Legacy field
    }
    
    if (subject) {
      this.display.subjectCode = subject.code;
      this.display.subjectName = subject.name;
      this.subjectCode_display = subject.code; // Legacy field
      this.subjectName_display = subject.name; // Legacy field
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

module.exports = mongoose.model('RoutineSlotNew', routineSlotSchema);
