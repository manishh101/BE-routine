const mongoose = require('mongoose');

const ElectiveGroupSchema = new mongoose.Schema(
  {
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program',
      required: true
    },
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicCalendar',
      required: true
    },
    
    // Group Definition
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
      // "7th Semester Technical Electives A"
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20
      // "7TH-TECH-A"
    },
    semester: {
      type: Number,
      required: true,
      enum: [7, 8]
      // Only for final years
    },
    
    // Available Subjects
    subjects: [{
      subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
      },
      subjectCode: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
        // Denormalized
      },
      subjectName: {
        type: String,
        required: true,
        trim: true
        // Denormalized
      },
      maxSections: {
        type: Number,
        default: 2,
        min: 1,
        max: 4
        // How many sections can choose this
      },
      currentSelections: {
        type: Number,
        default: 0,
        min: 0
        // Track how many sections have selected this
      },
      isAvailable: {
        type: Boolean,
        default: true
      },
      
      // Additional subject details
      credits: {
        theory: {
          type: Number,
          default: 0
        },
        practical: {
          type: Number,
          default: 0
        },
        tutorial: {
          type: Number,
          default: 0
        }
      },
      weeklyHours: {
        theory: {
          type: Number,
          default: 0
        },
        practical: {
          type: Number,
          default: 0
        },
        tutorial: {
          type: Number,
          default: 0
        }
      },
      requiresLab: {
        type: Boolean,
        default: false
      }
    }],
    
    // Selection Rules
    rules: {
      minRequired: {
        type: Number,
        default: 1,
        min: 0
      },
      maxAllowed: {
        type: Number,
        default: 1,
        min: 1
      },
      isMandatory: {
        type: Boolean,
        default: true
      }
    },
    
    // Administrative
    isActive: {
      type: Boolean,
      default: true
    },
    description: {
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
ElectiveGroupSchema.index({ 
  programId: 1, 
  semester: 1, 
  academicYearId: 1, 
  code: 1 
}, { unique: true });
ElectiveGroupSchema.index({ academicYearId: 1, isActive: 1 });
ElectiveGroupSchema.index({ semester: 1 });
ElectiveGroupSchema.index({ 'subjects.subjectId': 1 });

// Virtual to get program info
ElectiveGroupSchema.virtual('programInfo', {
  ref: 'Program',
  localField: 'programId',
  foreignField: '_id',
  justOne: true
});

// Virtual to get academic year info
ElectiveGroupSchema.virtual('academicYearInfo', {
  ref: 'AcademicCalendar',
  localField: 'academicYearId',
  foreignField: '_id',
  justOne: true
});

// Instance methods
ElectiveGroupSchema.methods.getAvailableSubjects = function() {
  return this.subjects.filter(subject => 
    subject.isAvailable && 
    subject.currentSelections < subject.maxSections
  );
};

ElectiveGroupSchema.methods.getFullySelectedSubjects = function() {
  return this.subjects.filter(subject => 
    subject.currentSelections >= subject.maxSections
  );
};

ElectiveGroupSchema.methods.canSelectSubject = function(subjectId) {
  const subject = this.subjects.find(s => s.subjectId.equals(subjectId));
  return subject && 
         subject.isAvailable && 
         subject.currentSelections < subject.maxSections;
};

ElectiveGroupSchema.methods.getSubjectById = function(subjectId) {
  return this.subjects.find(s => s.subjectId.equals(subjectId));
};

ElectiveGroupSchema.methods.addSubjectSelection = function(subjectId) {
  const subject = this.getSubjectById(subjectId);
  if (subject && this.canSelectSubject(subjectId)) {
    subject.currentSelections++;
    return true;
  }
  return false;
};

ElectiveGroupSchema.methods.removeSubjectSelection = function(subjectId) {
  const subject = this.getSubjectById(subjectId);
  if (subject && subject.currentSelections > 0) {
    subject.currentSelections--;
    return true;
  }
  return false;
};

ElectiveGroupSchema.methods.getSelectionSummary = function() {
  return this.subjects.map(subject => ({
    subjectCode: subject.subjectCode,
    subjectName: subject.subjectName,
    currentSelections: subject.currentSelections,
    maxSections: subject.maxSections,
    availableSlots: subject.maxSections - subject.currentSelections,
    isAvailable: subject.isAvailable && subject.currentSelections < subject.maxSections
  }));
};

// Static methods
ElectiveGroupSchema.statics.findByProgram = function(programId, semester, academicYearId) {
  return this.find({
    programId: programId,
    semester: semester,
    academicYearId: academicYearId,
    isActive: true
  });
};

ElectiveGroupSchema.statics.findBySemester = function(semester, academicYearId) {
  return this.find({
    semester: semester,
    academicYearId: academicYearId,
    isActive: true
  });
};

ElectiveGroupSchema.statics.findByCode = function(code) {
  return this.findOne({
    code: code.toUpperCase(),
    isActive: true
  });
};

ElectiveGroupSchema.statics.createElectiveGroup = async function(data) {
  // Auto-populate subject details
  if (data.subjects && data.subjects.length > 0) {
    const Subject = mongoose.model('Subject');
    const subjectIds = data.subjects.map(s => s.subjectId);
    const subjects = await Subject.find({ _id: { $in: subjectIds } });
    
    data.subjects = data.subjects.map(subjectData => {
      const subject = subjects.find(s => s._id.equals(subjectData.subjectId));
      if (subject) {
        return {
          ...subjectData,
          subjectCode: subject.code,
          subjectName: subject.name,
          credits: subject.credits,
          weeklyHours: subject.weeklyHours,
          requiresLab: subject.requiresLab
        };
      }
      return subjectData;
    });
  }
  
  return await this.create(data);
};

// Pre-save middleware
ElectiveGroupSchema.pre('save', async function(next) {
  // Auto-populate subject details if missing
  if (this.isModified('subjects') || this.isNew) {
    const Subject = mongoose.model('Subject');
    
    for (let subject of this.subjects) {
      if (!subject.subjectCode || !subject.subjectName) {
        const subjectDoc = await Subject.findById(subject.subjectId);
        if (subjectDoc) {
          subject.subjectCode = subjectDoc.code;
          subject.subjectName = subjectDoc.name;
          subject.credits = subjectDoc.credits;
          subject.weeklyHours = subjectDoc.weeklyHours;
          subject.requiresLab = subjectDoc.requiresLab;
        }
      }
    }
  }
  
  // Validate selection rules
  if (this.rules.minRequired > this.rules.maxAllowed) {
    return next(new Error('minRequired cannot be greater than maxAllowed'));
  }
  
  // Ensure subject codes are unique within the group
  const subjectCodes = this.subjects.map(s => s.subjectCode);
  const uniqueCodes = [...new Set(subjectCodes)];
  if (subjectCodes.length !== uniqueCodes.length) {
    return next(new Error('Subject codes must be unique within an elective group'));
  }
  
  next();
});

// Pre-validate middleware
ElectiveGroupSchema.pre('validate', function(next) {
  // Ensure semester is 7 or 8
  if (![7, 8].includes(this.semester)) {
    return next(new Error('Elective groups are only for semesters 7 and 8'));
  }
  
  // Validate that we have subjects
  if (!this.subjects || this.subjects.length === 0) {
    return next(new Error('Elective group must have at least one subject'));
  }
  
  next();
});

module.exports = mongoose.model('ElectiveGroup', ElectiveGroupSchema);
