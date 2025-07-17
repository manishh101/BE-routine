const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema(
  {
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null
      // Owning department
    },
    
    // Program Association - Array of programs this subject belongs to
    programId: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program'
      // Array of programs offering this subject
    }],
    
    // Subject Identity
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 10
      // e.g., "CT601", "EE401"
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
      // Subject name
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    
    // Credit Structure
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
      },
      total: {
        type: Number,
        default: 0,
        min: 0
        // Auto-calculated
      }
    },
    
    // Weekly Hours
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
      },
      total: {
        type: Number,
        default: 0,
        min: 0
        // Auto-calculated
      }
    },
    
    // Dependencies
    prerequisites: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject'
      // Subject IDs
    }],
    corequisites: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject'
      // Subject IDs
    }],
    
    // Lab Requirements
    requiresLab: {
      type: Boolean,
      default: false
    },
    defaultLabGroups: {
      type: Number,
      default: 2,
      min: 1
      // Default number of lab groups
    },
    preferredRoomTypes: [{
      type: String,
      enum: [
        'Lecture Hall',
        'Computer Lab',
        'Electronics Lab',
        'Microprocessor Lab',
        'Project Lab',
        'Tutorial Room',
        'Auditorium'
      ]
    }],
    
    // Legacy fields for backward compatibility
    defaultClassType: {
      type: String,
      enum: ['L', 'P', 'T'],
      default: 'L'
    },
    semester: {
      type: Number,
      min: 1,
      max: 8
      // Kept for backward compatibility, will be moved to ProgramSemester
    },
    programCode: {
      type: String,
      trim: true,
      uppercase: true
      // Kept for backward compatibility
    },
    
    // Administrative
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
  }
);

// Auto-calculate total credits and hours before saving
SubjectSchema.pre('save', function(next) {
  // Calculate total credits
  this.credits.total = this.credits.theory + this.credits.practical + this.credits.tutorial;
  
  // Calculate total weekly hours  
  this.weeklyHours.total = this.weeklyHours.theory + this.weeklyHours.practical + this.weeklyHours.tutorial;
  
  // Auto-set requiresLab if practical hours > 0
  if (this.weeklyHours.practical > 0 || this.credits.practical > 0) {
    this.requiresLab = true;
  }
  
  next();
});

// Indexes as per data model specification
// Note: code field already has unique: true, so no need for explicit index
SubjectSchema.index({ departmentId: 1, isActive: 1 });
SubjectSchema.index({ requiresLab: 1 });
SubjectSchema.index({ name: 1 });
SubjectSchema.index({ isActive: 1 });

// Instance methods
SubjectSchema.methods.getTotalCredits = function() {
  return this.credits.total;
};

SubjectSchema.methods.getTotalWeeklyHours = function() {
  return this.weeklyHours.total;
};

SubjectSchema.methods.needsLabGroups = function() {
  return this.requiresLab && this.weeklyHours.practical > 0;
};

// Static methods
SubjectSchema.statics.findByCode = function(code) {
  return this.findOne({ code: code.toUpperCase(), isActive: true });
};

SubjectSchema.statics.findLabSubjects = function() {
  return this.find({ requiresLab: true, isActive: true });
};

SubjectSchema.statics.findByDepartment = function(departmentId) {
  return this.find({ departmentId: departmentId, isActive: true });
};

SubjectSchema.statics.findByPrograms = function(programIds) {
  return this.find({ 
    programId: { $in: programIds }, 
    isActive: true 
  });
};

SubjectSchema.statics.findSharedSubjects = function() {
  return this.find({ 
    programId: { $exists: true, $not: { $size: 0 }, $size: { $gt: 1 } },
    isActive: true 
  });
};

// Instance methods
SubjectSchema.methods.isSharedSubject = function() {
  return this.programId && this.programId.length > 1;
};

SubjectSchema.methods.belongsToProgram = function(programId) {
  return this.programId && this.programId.includes(programId);
};

SubjectSchema.methods.getPrograms = function() {
  return this.programId || [];
};

// Virtual for lab group requirement
SubjectSchema.virtual('needsLabGrouping').get(function() {
  return this.requiresLab && this.weeklyHours.practical > 0;
});

module.exports = mongoose.model('Subject', SubjectSchema);
