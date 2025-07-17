const mongoose = require('mongoose');

const timeSlotDefinitionSchema = new mongoose.Schema({
  _id: {
    type: Number,
    required: true
    // slotIndex as per data model specification
  },
  label: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
    // e.g., "First Period", "Second Period"
  },
  startTime: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'startTime must be in HH:MM format (24-hour)'
    }
    // "HH:MM" format (24-hour)
  },
  endTime: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'endTime must be in HH:MM format (24-hour)'
    }
    // "HH:MM" format (24-hour)
  },
  duration: {
    type: Number,
    default: 0
    // Minutes (auto-calculated)
  },
  dayType: {
    type: String,
    enum: ['Regular', 'Friday', 'Special'],
    default: 'Regular'
  },
  sortOrder: {
    type: Number,
    required: true,
    min: 0
    // For chronological ordering
  },
  
  // Extended properties for IOE-specific requirements
  category: {
    type: String,
    enum: ['Morning', 'Afternoon', 'Evening'],
    default: 'Morning'
  },
  isBreak: {
    type: Boolean,
    default: false
  },
  applicableDays: [{
    type: Number,
    min: 0,
    max: 6
    // [0,1,2,3,4,5] for weekdays
  }]
}, {
  _id: false, // Disable auto-generation since we're using custom _id
  versionKey: false
});

// Pre-save middleware to calculate duration and category
timeSlotDefinitionSchema.pre('save', function(next) {
  try {
    // Validate that startTime and endTime are present
    if (!this.startTime || !this.endTime) {
      return next(new Error('startTime and endTime are required'));
    }
    
    // Calculate duration
    const start = this.startTime.split(':');
    const end = this.endTime.split(':');
    
    if (start.length !== 2 || end.length !== 2) {
      return next(new Error('Invalid time format - must be HH:MM'));
    }
    
    const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
    const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);
    
    if (isNaN(startMinutes) || isNaN(endMinutes)) {
      return next(new Error('Invalid time format - must contain valid numbers'));
    }
    
    if (endMinutes <= startMinutes) {
      return next(new Error('End time must be after start time'));
    }
    
    this.duration = endMinutes - startMinutes;
    
    // Auto-set category if not explicitly provided
    if (!this.category || this.category === 'Morning') {
      const hour = parseInt(start[0]);
      if (hour < 12) this.category = 'Morning';
      else if (hour < 17) this.category = 'Afternoon';
      else this.category = 'Evening';
    }
    
    // Set default applicable days if not provided
    if (!this.applicableDays || this.applicableDays.length === 0) {
      this.applicableDays = [0, 1, 2, 3, 4, 5]; // Sun-Fri
    }
    
    next();
  } catch (error) {
    next(new Error(`TimeSlot validation error: ${error.message}`));
  }
});

// Indexes as per data model specification
timeSlotDefinitionSchema.index({ sortOrder: 1 });
timeSlotDefinitionSchema.index({ dayType: 1 });
timeSlotDefinitionSchema.index({ category: 1 });

// Instance methods
timeSlotDefinitionSchema.methods.getTimeRange = function() {
  return `${this.startTime} - ${this.endTime}`;
};

timeSlotDefinitionSchema.methods.getDuration = function() {
  return this.duration; // Returns duration in minutes
};

timeSlotDefinitionSchema.methods.getDurationHours = function() {
  return this.duration / 60;
};

timeSlotDefinitionSchema.methods.isApplicableForDay = function(dayIndex) {
  return this.applicableDays.includes(dayIndex);
};

// Static methods
timeSlotDefinitionSchema.statics.getRegularSlots = function() {
  return this.find({ 
    dayType: 'Regular'
  }).sort({ sortOrder: 1 });
};

timeSlotDefinitionSchema.statics.findBySlotIndex = function(slotIndex) {
  return this.findById(slotIndex);
};

timeSlotDefinitionSchema.statics.getByCategory = function(category) {
  return this.find({ category: category }).sort({ sortOrder: 1 });
};

// Virtual for formatted display
timeSlotDefinitionSchema.virtual('displayTime').get(function() {
  return `${this.label} (${this.startTime} - ${this.endTime})`;
});

// Create both TimeSlot and TimeSlotDefinition models for compatibility
const TimeSlotDefinition = mongoose.model('TimeSlotDefinition', timeSlotDefinitionSchema);

// Export both models
module.exports = TimeSlotDefinition;
module.exports.TimeSlot = TimeSlotDefinition; // Alias for new specification
