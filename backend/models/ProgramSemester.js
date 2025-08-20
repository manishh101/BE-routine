const mongoose = require('mongoose');

const programSemesterSchema = new mongoose.Schema({
  programId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Program',
    required: true
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  academicYearId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicCalendar',
    required: true
  },
  
  // Quick Access (Denormalized)
  programCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
    // Denormalized for queries
  },
  
  // Curriculum
  subjects: [{
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    
    // Subject Details (Denormalized)
    subjectCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    subjectName: {
      type: String,
      required: true,
      trim: true
    },
    credits: {
      theory: {
        type: Number,
        default: 0,
        min: 0
      },
      practical: {
        type: Number,
        default: 0,
        min: 0
      },
      tutorial: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    weeklyHours: {
      theory: {
        type: Number,
        default: 0,
        min: 0
      },
      practical: {
        type: Number,
        default: 0,
        min: 0
      },
      tutorial: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    
    // Course Classification
    type: {
      type: String,
      enum: ['Compulsory', 'Department Elective', 'Open Elective', 'Project'],
      default: 'Compulsory'
    },
    isElective: {
      type: Boolean,
      default: false
    },
    electiveGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ElectiveGroup',
      default: null
      // For elective subjects
    },
    
    // Lab Requirements
    requiresLab: {
      type: Boolean,
      default: false
    },
    labGroupCount: {
      type: Number,
      default: 2,
      min: 1
    },
    
    // Legacy fields for backward compatibility
    courseType: {
      type: String,
      enum: ['Core', 'Elective Group A', 'Elective Group B', 'Audit'],
      default: 'Core'
    },
    defaultHoursTheory: {
      type: Number,
      min: 0,
      default: 3
    },
    defaultHoursPractical: {
      type: Number,
      min: 0,
      default: 0
    },
    subjectCode_display: {
      type: String,
      trim: true
    },
    subjectName_display: {
      type: String,
      trim: true
    }
  }],
  
  // Status
  status: {
    type: String,
    enum: ['Draft', 'Active', 'Archived'],
    default: 'Draft'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Legacy field for backward compatibility
  academicYear: {
    type: String,
    trim: true,
    default: '2024-2025'
  },
  
  // Metadata
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes as per data model specification
programSemesterSchema.index({ 
  programId: 1, 
  semester: 1, 
  academicYearId: 1 
}, { 
  unique: true,
  partialFilterExpression: { status: 'Active' }
});
programSemesterSchema.index({ programCode: 1, semester: 1 });
programSemesterSchema.index({ academicYearId: 1, status: 1 });
programSemesterSchema.index({ 'subjects.subjectId': 1 });
programSemesterSchema.index({ programCode: 1 });
programSemesterSchema.index({ isActive: 1 });
programSemesterSchema.index({ academicYear: 1 }); // Legacy

// Virtual to get program info
programSemesterSchema.virtual('programInfo', {
  ref: 'Program',
  localField: 'programId',
  foreignField: '_id',
  justOne: true
});

// Virtual to get academic year info
programSemesterSchema.virtual('academicYearInfo', {
  ref: 'AcademicCalendar',
  localField: 'academicYearId',
  foreignField: '_id',
  justOne: true
});

// Instance methods
programSemesterSchema.methods.getCoreSubjects = function() {
  return this.subjects.filter(subject => subject.type === 'Compulsory');
};

programSemesterSchema.methods.getElectiveSubjects = function() {
  return this.subjects.filter(subject => subject.isElective);
};

programSemesterSchema.methods.getLabSubjects = function() {
  return this.subjects.filter(subject => subject.requiresLab);
};

programSemesterSchema.methods.getTotalCredits = function() {
  return this.subjects.reduce((total, subject) => {
    return total + subject.credits.theory + subject.credits.practical + subject.credits.tutorial;
  }, 0);
};

programSemesterSchema.methods.getTotalWeeklyHours = function() {
  return this.subjects.reduce((total, subject) => {
    return total + subject.weeklyHours.theory + subject.weeklyHours.practical + subject.weeklyHours.tutorial;
  }, 0);
};

// Static methods
programSemesterSchema.statics.findByProgramAndSemester = function(programId, semester, academicYearId) {
  return this.findOne({ 
    programId: programId,
    semester: semester,
    academicYearId: academicYearId,
    status: 'Active'
  });
};

programSemesterSchema.statics.findActiveByProgram = function(programId) {
  return this.find({ 
    programId: programId,
    status: 'Active',
    isActive: true 
  }).sort({ semester: 1 });
};

// Pre-save middleware
programSemesterSchema.pre('save', async function(next) {
  // Auto-populate denormalized fields from Program
  if (this.isModified('programId') || this.isNew) {
    const Program = mongoose.model('Program');
    const program = await Program.findById(this.programId);
    if (program) {
      this.programCode = program.code;
    }
  }
  
  // Auto-set isElective based on type
  this.subjects.forEach(subject => {
    if (subject.type !== 'Compulsory') {
      subject.isElective = true;
    }
    
    // Auto-set requiresLab if practical hours > 0
    if (subject.weeklyHours.practical > 0 || subject.credits.practical > 0) {
      subject.requiresLab = true;
    }
  });
  
  next();
});

module.exports = mongoose.model('ProgramSemester', programSemesterSchema);
