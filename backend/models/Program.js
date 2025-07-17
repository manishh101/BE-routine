const mongoose = require('mongoose');

const ProgramSchema = new mongoose.Schema(
  {
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true
    },
    
    // Program Identity
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 10
      // e.g., "BCT", "BEL"
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
      // e.g., "Bachelor of Computer Engineering"
    },
    level: {
      type: String,
      enum: ['Bachelor', 'Master', 'PhD'],
      default: 'Bachelor'
    },
    
    // Program Structure
    totalSemesters: {
      type: Number,
      required: true,
      default: 8,
      min: 1,
      max: 12
    },
    totalCreditHours: {
      type: Number,
      default: 0,
      min: 0
    },
    sections: [{
      type: String,
      uppercase: true,
      trim: true
      // e.g., ["AB", "CD"]
    }],
    
    // Administrative
    coordinatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null
      // Program coordinator
    },
    syllabusYear: {
      type: String,
      trim: true,
      maxlength: 10
      // e.g., "2076"
    },
    isActive: {
      type: Boolean,
      default: true
    },
    
    // Legacy fields for backward compatibility
    description: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    department: {
      type: String,
      trim: true
      // Legacy field, will be removed after migration
    }
  },
  {
    timestamps: true,
  }
);

// Indexes as per data model specification
// Note: code field already has unique: true, so no need for explicit index
ProgramSchema.index({ departmentId: 1, isActive: 1 });
ProgramSchema.index({ level: 1 });

// Virtual to get department info
ProgramSchema.virtual('departmentInfo', {
  ref: 'Department',
  localField: 'departmentId',
  foreignField: '_id',
  justOne: true
});

// Virtual to get coordinator info
ProgramSchema.virtual('coordinatorInfo', {
  ref: 'Teacher',
  localField: 'coordinatorId',
  foreignField: '_id',
  justOne: true
});

// Instance methods
ProgramSchema.methods.getSections = function() {
  return this.sections.length > 0 ? this.sections : ['AB', 'CD']; // Default sections
};

ProgramSchema.methods.hasSections = function() {
  return this.sections && this.sections.length > 0;
};

// Static methods
ProgramSchema.statics.findByCode = function(code) {
  return this.findOne({ code: code.toUpperCase(), isActive: true });
};

ProgramSchema.statics.findByDepartment = function(departmentId) {
  return this.find({ departmentId: departmentId, isActive: true });
};

ProgramSchema.statics.getBachelorPrograms = function() {
  return this.find({ level: 'Bachelor', isActive: true });
};

// Pre-save validation
ProgramSchema.pre('save', async function(next) {
  // Ensure sections are uppercase
  if (this.sections) {
    this.sections = this.sections.map(section => section.toUpperCase());
  }
  
  // Set default sections if none provided
  if (!this.sections || this.sections.length === 0) {
    this.sections = ['AB', 'CD'];
  }
  
  next();
});

module.exports = mongoose.model('Program', ProgramSchema);
