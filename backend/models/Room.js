const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
    // Managing department
  },
  
  // Room Identity
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
    // e.g., "CIC-401", "DOECE-Lab1"
  },
  building: {
    type: String,
    enum: ['CIC', 'DOECE', 'Main Building', 'Library', 'Other'],
    default: 'Main Building'
  },
  floor: {
    type: Number,
    min: 0,
    max: 10
  },
  roomNumber: {
    type: String,
    trim: true,
    maxlength: 20
  },
  
  // Capacity and Type
  capacity: {
    type: Number,
    required: true,
    min: 1,
    max: 200
  },
  type: {
    type: String,
    required: true,
    enum: [
      'Lecture Hall',
      'Computer Lab',
      'Electronics Lab', 
      'Microprocessor Lab',
      'Project Lab',
      'Tutorial Room',
      'Auditorium'
    ],
    default: 'Lecture Hall'
  },
  
  // Equipment and Features
  features: [{
    type: String,
    enum: [
      'Projector',
      'Whiteboard', 
      'AC',
      'Smart Board',
      'Oscilloscope',
      'Function Generator',
      'Computers'
    ]
  }],
  
  // Availability
  isActive: {
    type: Boolean,
    default: true
  },
  maintenanceSchedule: [{
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    }
  }],
  
  // Legacy fields for backward compatibility
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
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Indexes as per data model specification
// Note: name field already has unique: true, so no need for explicit index
roomSchema.index({ building: 1, type: 1 });
roomSchema.index({ departmentId: 1, isActive: 1 });
roomSchema.index({ capacity: 1 });
roomSchema.index({ type: 1 });
roomSchema.index({ isActive: 1 });

// Virtual to get department info
roomSchema.virtual('departmentInfo', {
  ref: 'Department',
  localField: 'departmentId',
  foreignField: '_id',
  justOne: true
});

// Instance methods
roomSchema.methods.isAvailable = function(dayIndex, slotIndex, date = null) {
  // Check maintenance schedule
  if (date && this.maintenanceSchedule) {
    for (const maintenance of this.maintenanceSchedule) {
      if (date >= maintenance.startDate && date <= maintenance.endDate) {
        return false;
      }
    }
  }
  
  // Check availability overrides (legacy)
  for (const override of this.availabilityOverrides) {
    if (override.dayIndex === dayIndex && override.slotIndex === slotIndex) {
      return false;
    }
  }
  
  return this.isActive;
};

roomSchema.methods.hasFeature = function(feature) {
  return this.features.includes(feature);
};

roomSchema.methods.getFullName = function() {
  return this.building ? `${this.building}-${this.name}` : this.name;
};

// Static methods
roomSchema.statics.findByType = function(type) {
  return this.find({ type: type, isActive: true });
};

roomSchema.statics.findByBuilding = function(building) {
  return this.find({ building: building, isActive: true });
};

roomSchema.statics.findByCapacity = function(minCapacity, maxCapacity) {
  const query = { isActive: true };
  if (minCapacity) query.capacity = { $gte: minCapacity };
  if (maxCapacity) {
    query.capacity = { ...query.capacity, $lte: maxCapacity };
  }
  return this.find(query);
};

roomSchema.statics.findWithFeature = function(feature) {
  return this.find({ features: feature, isActive: true });
};

// Pre-save validation
roomSchema.pre('save', function(next) {
  // Validate maintenance schedule
  if (this.maintenanceSchedule) {
    for (const maintenance of this.maintenanceSchedule) {
      if (maintenance.endDate <= maintenance.startDate) {
        return next(new Error('Maintenance end date must be after start date'));
      }
    }
  }
  
  next();
});

module.exports = mongoose.model('Room', roomSchema);
