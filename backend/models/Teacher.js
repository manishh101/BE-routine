const mongoose = require('mongoose');

const TeacherSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
      // Optional user account link
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true
    },
    
    // Identity
    shortName: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 10
      // e.g., "JD", "RAM"
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Invalid email format'
      }
    },
    employeeId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true
      // HR system integration
    },
    
    // Professional Information
    designation: {
      type: String,
      enum: [
        'Professor',
        'Associate Professor', 
        'Assistant Professor',
        'Senior Lecturer',
        'Lecturer',
        'Teaching Assistant',
        'Lab Instructor',
        'Sr. Instructor',
        'Deputy Instructor',
        'Instructor',
        'Chief Technical Assistant',
        'Asst. Instuctor',
        'Office Assistant',
        'RA',
        'TA',
        'Office Attendant',
        'Chief Account Assistant'
      ],
      default: 'Lecturer'
    },
    specializations: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject'
    }],
    expertise: [{
      type: String,
      trim: true
    }],
    
    // Scheduling Constraints
    isFullTime: {
      type: Boolean,
      default: true
    },
    maxWeeklyHours: {
      type: Number,
      default: 16,
      min: 0,
      max: 24
    },
    availableDays: [{
      type: Number,
      min: 0,
      max: 6
      // [0,1,2,3,4,5] for Sun-Fri
    }],
    
    // Availability Overrides
    unavailableSlots: [{
      dayIndex: {
        type: Number,
        min: 0,
        max: 6
        // 0-6 (Sun-Sat)
      },
      slotIndex: {
        type: Number,
        min: 0
      },
      reason: {
        type: String,
        trim: true,
        required: true
      },
      startDate: {
        type: Date,
        default: null
        // For temporary unavailability
      },
      endDate: {
        type: Date,
        default: null
      }
    }],
    
    // Contact & Administrative
    phoneNumber: {
      type: String,
      trim: true,
      maxlength: 20
    },
    officeLocation: {
      type: String,
      trim: true,
      maxlength: 100
    },
    joiningDate: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    
    // Legacy field for backward compatibility during migration
    department: {
      type: String,
      trim: true
      // Will be removed after migration is complete
    },
    
    // Legacy field structure for compatibility
    availabilityOverrides: [{
      dayIndex: {
        type: Number,
        min: 0,
        max: 6
      },
      slotIndex: {
        type: Number,
        min: 0
      },
      reason: {
        type: String,
        trim: true
      }
    }],
    
    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true,
  }
);

// Indexes as per data model specification
TeacherSchema.index({ shortName: 1 }, { unique: true });
// Note: email field already has unique: true, so no need for explicit index
TeacherSchema.index({ departmentId: 1, isActive: 1 });
TeacherSchema.index({ specializations: 1 });
TeacherSchema.index({ department: 1 }); // Legacy index for backward compatibility

// Virtual to get department info
TeacherSchema.virtual('departmentInfo', {
  ref: 'Department',
  localField: 'departmentId',
  foreignField: '_id',
  justOne: true
});

// Instance methods
TeacherSchema.methods.getWorkloadHours = async function() {
  const RoutineSlot = mongoose.model('RoutineSlot');
  // Implementation will be added when RoutineSlot is enhanced
  return 0; // Placeholder
};

TeacherSchema.methods.isAvailable = function(dayIndex, slotIndex, date = null) {
  // Check if teacher is available for a specific slot
  if (!this.availableDays.includes(dayIndex)) {
    return false;
  }
  
  // Check unavailable slots
  for (const unavailable of this.unavailableSlots) {
    if (unavailable.dayIndex === dayIndex && unavailable.slotIndex === slotIndex) {
      // Check date range if specified
      if (date && unavailable.startDate && unavailable.endDate) {
        if (date >= unavailable.startDate && date <= unavailable.endDate) {
          return false;
        }
      } else if (!unavailable.startDate && !unavailable.endDate) {
        // Permanent unavailability
        return false;
      }
    }
  }
  
  return true;
};

// Static methods
TeacherSchema.statics.findByShortName = function(shortName) {
  return this.findOne({ 
    shortName: shortName.toUpperCase(), 
    isActive: true 
  });
};

TeacherSchema.statics.findByDepartment = function(departmentId) {
  return this.find({ 
    departmentId: departmentId, 
    isActive: true 
  }).populate('departmentInfo', 'name code');
};

// Business Rules Validation
TeacherSchema.pre('save', async function(next) {
  // ShortName must be unique within department (relaxed for now to allow migration)
  if (this.isModified('shortName') || this.isModified('departmentId')) {
    const existing = await this.constructor.findOne({
      shortName: this.shortName,
      departmentId: this.departmentId,
      _id: { $ne: this._id }
    });
    
    if (existing) {
      return next(new Error('ShortName must be unique within department'));
    }
  }
  
  // MaxWeeklyHours validation
  if (this.maxWeeklyHours > 24) {
    return next(new Error('MaxWeeklyHours cannot exceed 24'));
  }
  
  // AvailableDays validation
  const validDays = [0, 1, 2, 3, 4, 5, 6];
  if (this.availableDays && !this.availableDays.every(day => validDays.includes(day))) {
    return next(new Error('AvailableDays must be subset of [0,1,2,3,4,5,6]'));
  }
  
  next();
});

module.exports = mongoose.model('Teacher', TeacherSchema);
