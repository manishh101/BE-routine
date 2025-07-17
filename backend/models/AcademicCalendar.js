const mongoose = require('mongoose');

const AcademicCalendarSchema = new mongoose.Schema(
  {
    // Academic Year Definition
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
      // "Academic Year 2080-2081"
    },
    nepaliYear: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 20
      // "2080/2081"
    },
    englishYear: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20
      // "2023/2024"
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    
    // Current Status
    isCurrentYear: {
      type: Boolean,
      default: false
    },
    currentWeek: {
      type: Number,
      default: 1,
      min: 1,
      max: 16
      // 1-16 for semester
    },
    
    // Term Structure
    terms: [{
      name: {
        type: String,
        required: true,
        trim: true
        // "Fall Semester", "Spring Semester"
      },
      startDate: {
        type: Date,
        required: true
      },
      endDate: {
        type: Date,
        required: true
      },
      examPeriod: {
        startDate: {
          type: Date,
          default: null
        },
        endDate: {
          type: Date,
          default: null
        }
      }
    }],
    
    // Important Dates
    holidays: [{
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
      },
      startDate: {
        type: Date,
        required: true
      },
      endDate: {
        type: Date,
        required: true
      },
      affectsClasses: {
        type: Boolean,
        default: true
      }
    }],
    
    // Administrative
    status: {
      type: String,
      enum: ['Planning', 'Current', 'Completed'],
      default: 'Planning'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes as per data model specification
// Note: nepaliYear field already has unique: true, so no need for explicit index
AcademicCalendarSchema.index({ isCurrentYear: 1 });
AcademicCalendarSchema.index({ status: 1 });
AcademicCalendarSchema.index({ startDate: 1, endDate: 1 });

// Instance methods
AcademicCalendarSchema.methods.getCurrentTerm = function(date = new Date()) {
  return this.terms.find(term => 
    date >= term.startDate && date <= term.endDate
  );
};

AcademicCalendarSchema.methods.isHoliday = function(date) {
  return this.holidays.some(holiday => 
    date >= holiday.startDate && 
    date <= holiday.endDate && 
    holiday.affectsClasses
  );
};

AcademicCalendarSchema.methods.getWeekNumber = function(date = new Date()) {
  const startOfYear = new Date(this.startDate);
  const diffTime = Math.abs(date - startOfYear);
  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
  return Math.min(diffWeeks, 16);
};

AcademicCalendarSchema.methods.getActiveHolidays = function() {
  const now = new Date();
  return this.holidays.filter(holiday => 
    holiday.endDate >= now && holiday.affectsClasses
  );
};

AcademicCalendarSchema.methods.isCurrentAcademicYear = function(date = new Date()) {
  return date >= this.startDate && date <= this.endDate;
};

// Static methods
AcademicCalendarSchema.statics.getCurrentYear = function() {
  return this.findOne({ isCurrentYear: true, status: 'Current' });
};

AcademicCalendarSchema.statics.findByNepaliYear = function(nepaliYear) {
  return this.findOne({ nepaliYear: nepaliYear });
};

AcademicCalendarSchema.statics.getActiveCalendars = function() {
  return this.find({ 
    status: { $in: ['Current', 'Planning'] },
    isActive: true 
  }).sort({ startDate: -1 });
};

// Pre-save validation
AcademicCalendarSchema.pre('save', function(next) {
  // Validate date ranges
  if (this.endDate <= this.startDate) {
    return next(new Error('End date must be after start date'));
  }
  
  // Validate terms
  for (const term of this.terms) {
    if (term.endDate <= term.startDate) {
      return next(new Error('Term end date must be after start date'));
    }
    
    if (term.examPeriod && term.examPeriod.startDate && term.examPeriod.endDate) {
      if (term.examPeriod.endDate <= term.examPeriod.startDate) {
        return next(new Error('Exam period end date must be after start date'));
      }
    }
  }
  
  // Validate holidays
  for (const holiday of this.holidays) {
    if (holiday.endDate < holiday.startDate) {
      return next(new Error('Holiday end date must be after or equal to start date'));
    }
  }
  
  // Ensure only one current year
  if (this.isCurrentYear && this.isModified('isCurrentYear')) {
    this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { $set: { isCurrentYear: false } }
    ).exec();
  }
  
  next();
});

// Virtual for year display
AcademicCalendarSchema.virtual('displayYear').get(function() {
  return `${this.nepaliYear} (${this.englishYear})`;
});

module.exports = mongoose.model('AcademicCalendar', AcademicCalendarSchema);
