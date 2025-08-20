const mongoose = require('mongoose');

const LabGroupSchema = new mongoose.Schema(
  {
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
    
    // Context
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
      // "AB", "CD"
    },
    
    // Group Configuration
    totalGroups: {
      type: Number,
      required: true,
      default: 2,
      min: 1,
      max: 4
      // Usually 2
    },
    groups: [{
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 10
        // "G1", "G2"
      },
      studentCount: {
        type: Number,
        default: 24,
        min: 1,
        max: 50
      },
      teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        default: null
      },
      weekPattern: {
        type: String,
        enum: ['odd', 'even', 'weekly'],
        default: 'odd'
      }
    }],
    
    // Display Data (Denormalized)
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
    }
  },
  {
    timestamps: true
  }
);

// Indexes as per data model specification
LabGroupSchema.index({ 
  programId: 1, 
  subjectId: 1, 
  semester: 1, 
  section: 1, 
  academicYearId: 1 
}, { unique: true });
LabGroupSchema.index({ academicYearId: 1, isActive: 1 });
LabGroupSchema.index({ subjectId: 1 });
LabGroupSchema.index({ 'groups.teacherId': 1 });

// Virtual to get program info
LabGroupSchema.virtual('programInfo', {
  ref: 'Program',
  localField: 'programId',
  foreignField: '_id',
  justOne: true
});

// Virtual to get subject info
LabGroupSchema.virtual('subjectInfo', {
  ref: 'Subject',
  localField: 'subjectId',
  foreignField: '_id',
  justOne: true
});

// Instance methods
LabGroupSchema.methods.getGroupByName = function(groupName) {
  return this.groups.find(group => group.name === groupName);
};

LabGroupSchema.methods.getGroupsByPattern = function(pattern) {
  return this.groups.filter(group => group.weekPattern === pattern);
};

LabGroupSchema.methods.getOddWeekGroups = function() {
  return this.groups.filter(group => group.weekPattern === 'odd');
};

LabGroupSchema.methods.getEvenWeekGroups = function() {
  return this.groups.filter(group => group.weekPattern === 'even');
};

LabGroupSchema.methods.getTotalStudents = function() {
  return this.groups.reduce((total, group) => total + group.studentCount, 0);
};

LabGroupSchema.methods.hasTeacherAssigned = function(teacherId) {
  return this.groups.some(group => 
    group.teacherId && group.teacherId.equals(teacherId)
  );
};

LabGroupSchema.methods.getUnassignedGroups = function() {
  return this.groups.filter(group => !group.teacherId);
};

// Static methods
LabGroupSchema.statics.findBySubject = function(subjectId, academicYearId) {
  return this.find({ 
    subjectId: subjectId,
    academicYearId: academicYearId,
    isActive: true 
  });
};

LabGroupSchema.statics.findByProgram = function(programId, semester, academicYearId) {
  return this.find({ 
    programId: programId,
    semester: semester,
    academicYearId: academicYearId,
    isActive: true 
  });
};

LabGroupSchema.statics.findByTeacher = function(teacherId) {
  return this.find({ 
    'groups.teacherId': teacherId,
    isActive: true 
  });
};

LabGroupSchema.statics.createForSubject = async function(programId, subjectId, semester, section, academicYearId, options = {}) {
  const totalGroups = options.totalGroups || 2;
  const studentCountPerGroup = options.studentCountPerGroup || 24;
  
  // Create group configuration
  const groups = [];
  for (let i = 0; i < totalGroups; i++) {
    groups.push({
      name: `G${i + 1}`,
      studentCount: studentCountPerGroup,
      weekPattern: i % 2 === 0 ? 'odd' : 'even'
    });
  }
  
  // Get display data
  const Program = mongoose.model('Program');
  const Subject = mongoose.model('Subject');
  
  const [program, subject] = await Promise.all([
    Program.findById(programId),
    Subject.findById(subjectId)
  ]);
  
  const labGroup = new this({
    programId,
    subjectId,
    academicYearId,
    semester,
    section,
    totalGroups,
    groups,
    display: {
      programCode: program?.code || '',
      subjectCode: subject?.code || '',
      subjectName: subject?.name || ''
    }
  });
  
  return await labGroup.save();
};

// Pre-save middleware
LabGroupSchema.pre('save', async function(next) {
  // Auto-populate display fields if they're empty
  if (!this.display.programCode || !this.display.subjectCode) {
    const Program = mongoose.model('Program');
    const Subject = mongoose.model('Subject');
    
    const [program, subject] = await Promise.all([
      Program.findById(this.programId),
      Subject.findById(this.subjectId)
    ]);
    
    if (program) {
      this.display.programCode = program.code;
    }
    if (subject) {
      this.display.subjectCode = subject.code;
      this.display.subjectName = subject.name;
    }
  }
  
  // Ensure group names are properly formatted
  this.groups.forEach((group, index) => {
    if (!group.name) {
      group.name = `G${index + 1}`;
    }
  });
  
  // Auto-assign alternating patterns if not set
  this.groups.forEach((group, index) => {
    if (!group.weekPattern || group.weekPattern === 'weekly') {
      group.weekPattern = index % 2 === 0 ? 'odd' : 'even';
    }
  });
  
  next();
});

// Validation
LabGroupSchema.pre('validate', function(next) {
  // Ensure we have the right number of groups
  if (this.groups.length !== this.totalGroups) {
    return next(new Error(`Number of groups (${this.groups.length}) must match totalGroups (${this.totalGroups})`));
  }
  
  // Ensure group names are unique within this lab group
  const groupNames = this.groups.map(g => g.name);
  const uniqueNames = [...new Set(groupNames)];
  if (groupNames.length !== uniqueNames.length) {
    return next(new Error('Group names must be unique within a lab group'));
  }
  
  next();
});

module.exports = mongoose.model('LabGroup', LabGroupSchema);
