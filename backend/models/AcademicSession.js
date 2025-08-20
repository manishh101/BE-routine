const mongoose = require('mongoose');

const AcademicSessionSchema = new mongoose.Schema({
  // Session Identity
  sessionId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    // Format: "2081-S1" (Year-Semester)
    validate: {
      validator: function(v) {
        return /^\d{4}-S[1-3]$/.test(v);
      },
      message: 'Session ID must be in format YYYY-S[1-3]'
    }
  },
  
  // Academic Context
  academicYear: {
    nepaliYear: { 
      type: String, 
      required: true,
      trim: true,
      // "2081/2082"
    },
    englishYear: { 
      type: String, 
      required: true,
      trim: true,
      // "2024/2025"
    },
  },
  
  semester: {
    type: String,
    required: true,
    enum: ['FIRST', 'SECOND', 'THIRD'], // Trimester support
    uppercase: true
  },
  
  // Timeline
  startDate: { 
    type: Date, 
    required: true 
  },
  endDate: { 
    type: Date, 
    required: true,
    validate: {
      validator: function(v) {
        return v > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  registrationDeadline: { 
    type: Date, 
    required: true,
    validate: {
      validator: function(v) {
        return v <= this.startDate;
      },
      message: 'Registration deadline must be before start date'
    }
  },
  examStartDate: { 
    type: Date,
    validate: {
      validator: function(v) {
        return !v || v < this.endDate;
      },
      message: 'Exam start date must be before end date'
    }
  },
  
  // Status Management
  status: {
    type: String,
    required: true,
    enum: [
      'PLANNING',     // Admin is creating routine
      'DRAFT',        // Routine created but not finalized
      'APPROVED',     // Routine approved but not yet active
      'ACTIVE',       // Current semester
      'COMPLETED',    // Semester finished
      'ARCHIVED'      // Historical data
    ],
    default: 'PLANNING',
    uppercase: true
  },
  
  // Version Control
  version: { 
    type: Number, 
    default: 1,
    min: 1
  },
  routineVersion: { 
    type: Number, 
    default: 1,
    min: 1
  },
  lastModified: { 
    type: Date, 
    default: Date.now 
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Session Configuration
  configuration: {
    totalWeeks: { 
      type: Number, 
      default: 16,
      min: 10,
      max: 20
    },
    examWeeks: { 
      type: Number, 
      default: 2,
      min: 1,
      max: 4
    },
    holidayWeeks: { 
      type: Number, 
      default: 1,
      min: 0,
      max: 3
    },
    workingDays: [{ 
      type: Number, 
      min: 0, 
      max: 6,
      // 0=Sunday, 1=Monday, ..., 6=Saturday
    }],
    dailySlots: { 
      type: Number, 
      default: 7,
      min: 4,
      max: 10
    },
    classHours: {
      startTime: { type: String, default: "07:00" }, // 24hr format
      endTime: { type: String, default: "17:00" },
      slotDuration: { type: Number, default: 60 }, // minutes
      breakDuration: { type: Number, default: 10 } // minutes
    }
  },
  
  // Planning Information
  planning: {
    basedOnSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicSession'
    },
    planningMethod: {
      type: String,
      enum: ['FRESH', 'COPY_PREVIOUS', 'USE_TEMPLATE', 'HYBRID'],
      default: 'FRESH'
    },
    templateUsed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoutineTemplate'
    },
    planningNotes: { type: String, maxlength: 1000 },
    completionPercentage: { type: Number, default: 0, min: 0, max: 100 }
  },
  
  // Administrative
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalDate: { 
    type: Date 
  },
  approvalNotes: { 
    type: String, 
    maxlength: 500 
  },
  
  // Statistics (calculated fields)
  statistics: {
    totalClasses: { type: Number, default: 0 },
    totalStudents: { type: Number, default: 0 },
    utilizationRate: { type: Number, default: 0 }, // percentage
    conflictCount: { type: Number, default: 0 },
    lastCalculated: { type: Date }
  },
  
  // Metadata
  description: { 
    type: String, 
    maxlength: 500 
  },
  tags: [{ 
    type: String, 
    maxlength: 50 
  }],
  notes: [{ 
    text: { type: String, maxlength: 1000 },
    category: { 
      type: String, 
      enum: ['GENERAL', 'PLANNING', 'ISSUE', 'MODIFICATION', 'COMPLETION'],
      default: 'GENERAL'
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM'
    },
    addedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    addedAt: { 
      type: Date, 
      default: Date.now 
    },
    isResolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  
  // Archival Information
  archival: {
    scheduledForArchival: { type: Date },
    archivalReason: { type: String },
    retentionPeriod: { type: Number, default: 2190 }, // days (6 years)
    isBackedUp: { type: Boolean, default: false },
    backupLocation: { type: String },
    accessLevel: {
      type: String,
      enum: ['FULL', 'READ_ONLY', 'RESTRICTED', 'ARCHIVED'],
      default: 'FULL'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
AcademicSessionSchema.index({ sessionId: 1 });
AcademicSessionSchema.index({ status: 1 });
AcademicSessionSchema.index({ 'academicYear.nepaliYear': 1, semester: 1 });
AcademicSessionSchema.index({ startDate: 1, endDate: 1 });
AcademicSessionSchema.index({ createdBy: 1 });
AcademicSessionSchema.index({ 'planning.basedOnSession': 1 });

// Virtual fields
AcademicSessionSchema.virtual('isActive').get(function() {
  return this.status === 'ACTIVE';
});

AcademicSessionSchema.virtual('canModify').get(function() {
  return ['PLANNING', 'DRAFT', 'APPROVED', 'ACTIVE'].includes(this.status);
});

AcademicSessionSchema.virtual('displayName').get(function() {
  return `${this.academicYear.nepaliYear} - ${this.semester} Semester`;
});

AcademicSessionSchema.virtual('progressPercentage').get(function() {
  if (this.status === 'COMPLETED' || this.status === 'ARCHIVED') return 100;
  if (this.status === 'PLANNING' || this.status === 'DRAFT') return this.planning.completionPercentage;
  
  // Calculate based on current date for active sessions
  const now = new Date();
  const start = this.startDate;
  const end = this.endDate;
  
  if (now < start) return 0;
  if (now > end) return 100;
  
  const total = end - start;
  const elapsed = now - start;
  return Math.round((elapsed / total) * 100);
});

// Pre-save middleware
AcademicSessionSchema.pre('save', function(next) {
  // Auto-generate sessionId if not provided
  if (!this.sessionId && this.academicYear && this.semester) {
    const year = this.academicYear.nepaliYear.split('/')[0];
    const semesterNum = this.semester === 'FIRST' ? '1' : this.semester === 'SECOND' ? '2' : '3';
    this.sessionId = `${year}-S${semesterNum}`;
  }
  
  // Set default working days if not provided
  if (!this.configuration.workingDays || this.configuration.workingDays.length === 0) {
    this.configuration.workingDays = [1, 2, 3, 4, 5]; // Monday to Friday
  }
  
  // Update lastModified
  this.lastModified = new Date();
  
  next();
});

// Pre-update middleware
AcademicSessionSchema.pre(['updateOne', 'findOneAndUpdate'], function(next) {
  this.set({ lastModified: new Date() });
  next();
});

// Static methods
AcademicSessionSchema.statics.findActive = function() {
  return this.findOne({ status: 'ACTIVE' });
};

AcademicSessionSchema.statics.findByAcademicYear = function(nepaliYear) {
  return this.find({ 'academicYear.nepaliYear': nepaliYear });
};

AcademicSessionSchema.statics.findRecent = function(limit = 5) {
  return this.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('createdBy', 'name email')
    .populate('approvedBy', 'name email');
};

// Instance methods
AcademicSessionSchema.methods.activate = async function() {
  if (this.status !== 'APPROVED') {
    throw new Error('Only approved sessions can be activated');
  }
  
  // Deactivate current active session
  await this.constructor.updateMany(
    { status: 'ACTIVE' },
    { status: 'COMPLETED' }
  );
  
  // Activate this session
  this.status = 'ACTIVE';
  return this.save();
};

AcademicSessionSchema.methods.complete = async function() {
  if (this.status !== 'ACTIVE') {
    throw new Error('Only active sessions can be completed');
  }
  
  this.status = 'COMPLETED';
  // Schedule for archival after 6 months
  this.archival.scheduledForArchival = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
  return this.save();
};

AcademicSessionSchema.methods.calculateStatistics = async function() {
  const RoutineSlot = mongoose.model('RoutineSlot');
  
  const stats = await RoutineSlot.aggregate([
    { $match: { academicSessionId: this._id, isArchived: false } },
    {
      $group: {
        _id: null,
        totalClasses: { $sum: 1 },
        conflictCount: { $sum: { $cond: ['$hasConflict', 1, 0] } }
      }
    }
  ]);
  
  if (stats.length > 0) {
    this.statistics = {
      ...this.statistics,
      totalClasses: stats[0].totalClasses,
      conflictCount: stats[0].conflictCount,
      lastCalculated: new Date()
    };
    
    await this.save();
  }
  
  return this.statistics;
};

module.exports = mongoose.model('AcademicSession', AcademicSessionSchema);
