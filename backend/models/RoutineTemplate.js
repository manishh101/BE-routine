const mongoose = require('mongoose');

const RoutineTemplateSchema = new mongoose.Schema({
  // Template Identity
  templateName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    // "BCT 5th Semester Standard", "Computer Lab Template"
  },
  templateCode: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    // Auto-generated: "BCT_5_STD", "LAB_COMP"
  },
  
  // Applicability
  programCode: { 
    type: String, 
    required: true,
    uppercase: true,
    trim: true
  },
  semester: { 
    type: Number, 
    required: true,
    min: 1,
    max: 8
  },
  section: {
    type: String,
    enum: ['AB', 'CD', 'ALL'],
    default: 'ALL',
    uppercase: true
  },
  templateType: {
    type: String,
    enum: [
      'PROGRAM_SEMESTER',  // Complete semester routine for a program
      'ELECTIVE_GROUP',    // Elective subject grouping
      'LABORATORY',        // Lab scheduling pattern
      'THEORY',           // Theory-only subjects
      'MIXED',            // Theory + Lab combination
      'CUSTOM'            // Custom template
    ],
    default: 'PROGRAM_SEMESTER',
    uppercase: true
  },
  
  // Template Metadata
  description: {
    type: String,
    maxlength: 500
  },
  applicablePrograms: [{
    type: String,
    uppercase: true
  }], // Can be used for multiple programs
  academicLevel: {
    type: String,
    enum: ['UNDERGRADUATE', 'GRADUATE', 'DIPLOMA'],
    default: 'UNDERGRADUATE'
  },
  
  // Template Configuration
  configuration: {
    totalSlots: { type: Number },
    workingDays: [{ type: Number, min: 0, max: 6 }],
    dailySlots: { type: Number, default: 7 },
    preferredTimePattern: {
      type: String,
      enum: ['MORNING_HEAVY', 'AFTERNOON_HEAVY', 'DISTRIBUTED', 'FLEXIBLE'],
      default: 'DISTRIBUTED'
    },
    labDays: [{ type: Number, min: 0, max: 6 }], // Preferred lab days
    theoryDays: [{ type: Number, min: 0, max: 6 }] // Preferred theory days
  },
  
  // Template Data - Core Structure
  templateSlots: [{
    // Position
    dayIndex: { 
      type: Number, 
      required: true,
      min: 0,
      max: 6
    },
    slotIndex: { 
      type: Number, 
      required: true,
      min: 0
    },
    
    // Subject Information
    subjectCode: { 
      type: String, 
      required: true,
      uppercase: true,
      trim: true
    },
    subjectName: {
      type: String,
      trim: true,
      maxlength: 100
    },
    classType: { 
      type: String, 
      enum: ['L', 'P', 'T'], 
      required: true,
      uppercase: true
    },
    creditHours: { type: Number, min: 1, max: 6 },
    
    // Resource Requirements
    preferredRoomType: { 
      type: String,
      enum: [
        'Lecture Hall', 'Computer Lab', 'Electronics Lab', 
        'Physics Lab', 'Chemistry Lab', 'Workshop', 
        'Drawing Hall', 'Seminar Hall', 'Conference Room'
      ]
    },
    requiredCapacity: { 
      type: Number,
      min: 10,
      max: 200
    },
    specialRequirements: [{
      type: String,
      enum: [
        'PROJECTOR', 'COMPUTER', 'WHITEBOARD', 'LAB_EQUIPMENT',
        'INTERNET', 'AUDIO_SYSTEM', 'VIDEO_CONFERENCE'
      ]
    }],
    
    // Teacher Preferences
    teacherPreferences: [{
      preferenceType: {
        type: String,
        enum: ['SUBJECT_EXPERT', 'DEPARTMENT', 'SPECIFIC_TEACHER', 'QUALIFICATION'],
        default: 'SUBJECT_EXPERT'
      },
      value: { type: String }, // Teacher code, department, or qualification
      priority: {
        type: String,
        enum: ['REQUIRED', 'PREFERRED', 'OPTIONAL'],
        default: 'PREFERRED'
      }
    }],
    
    // Lab Management
    labGroupRequired: { 
      type: Boolean, 
      default: false 
    },
    maxLabGroupSize: { type: Number },
    labEquipmentRequired: [{ type: String }],
    
    // Elective Information
    isElective: { 
      type: Boolean, 
      default: false 
    },
    electiveGroup: { type: String },
    crossSectionAllowed: { 
      type: Boolean, 
      default: false 
    },
    
    // Flexibility
    timeFlexibility: {
      type: String,
      enum: ['FIXED', 'FLEXIBLE', 'PREFERRED'],
      default: 'PREFERRED'
    },
    alternativeSlots: [{
      dayIndex: { type: Number },
      slotIndex: { type: Number }
    }],
    
    // Constraints
    constraints: [{
      type: {
        type: String,
        enum: [
          'NO_CONSECUTIVE', 'MUST_BE_CONSECUTIVE', 
          'SAME_DAY_THEORY_LAB', 'DIFFERENT_DAY_THEORY_LAB',
          'MORNING_ONLY', 'AFTERNOON_ONLY',
          'SPECIFIC_DAY', 'AVOID_DAY'
        ]
      },
      value: { type: mongoose.Schema.Types.Mixed },
      reason: { type: String }
    }]
  }],
  
  // Template Relationships
  basedOnTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoutineTemplate'
  },
  basedOnSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession'
  },
  parentTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoutineTemplate'
  },
  childTemplates: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoutineTemplate'
  }],
  
  // Usage Statistics
  usage: {
    timesUsed: { type: Number, default: 0 },
    lastUsed: { type: Date },
    successfulApplications: { type: Number, default: 0 },
    successRate: { type: Number, default: 0 }, // Percentage
    avgConflictCount: { type: Number, default: 0 },
    avgSetupTime: { type: Number, default: 0 }, // Minutes
    userRating: { type: Number, min: 1, max: 5 },
    userFeedback: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String, maxlength: 500 },
      appliedToSession: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
      date: { type: Date, default: Date.now }
    }]
  },
  
  // Validation Rules
  validation: {
    rules: [{
      ruleType: {
        type: String,
        enum: [
          'TOTAL_CREDITS', 'WEEKLY_HOURS', 'LAB_THEORY_RATIO',
          'TEACHER_AVAILABILITY', 'ROOM_CAPACITY', 'TIME_DISTRIBUTION'
        ]
      },
      condition: { type: String },
      value: { type: mongoose.Schema.Types.Mixed },
      severity: {
        type: String,
        enum: ['ERROR', 'WARNING', 'INFO'],
        default: 'WARNING'
      }
    }],
    customValidations: [{ type: String }] // JavaScript validation functions
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
  isActive: { 
    type: Boolean, 
    default: true 
  },
  isPublic: {
    type: Boolean,
    default: false // Can be used by other admins
  },
  accessPermissions: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    permission: {
      type: String,
      enum: ['READ', 'APPLY', 'MODIFY', 'FULL'],
      default: 'READ'
    }
  }],
  
  // Version Control
  version: { type: Number, default: 1 },
  changelog: [{
    version: { type: Number },
    changes: { type: String, maxlength: 1000 },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changeDate: { type: Date, default: Date.now },
    changeType: {
      type: String,
      enum: ['CREATED', 'MODIFIED', 'APPROVED', 'DEPRECATED'],
      default: 'MODIFIED'
    }
  }],
  
  // Tags and Categories
  tags: [{ 
    type: String, 
    maxlength: 30,
    lowercase: true
  }],
  category: {
    type: String,
    enum: [
      'STANDARD', 'SPECIALIZED', 'EXPERIMENTAL', 
      'OPTIMIZED', 'MINIMAL', 'COMPREHENSIVE'
    ],
    default: 'STANDARD'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
RoutineTemplateSchema.index({ templateCode: 1 });
RoutineTemplateSchema.index({ programCode: 1, semester: 1 });
RoutineTemplateSchema.index({ templateType: 1 });
RoutineTemplateSchema.index({ isActive: 1, isPublic: 1 });
RoutineTemplateSchema.index({ 'usage.successRate': -1 });
RoutineTemplateSchema.index({ createdBy: 1 });

// Virtual fields
RoutineTemplateSchema.virtual('displayName').get(function() {
  return `${this.templateName} (${this.programCode}-${this.semester})`;
});

RoutineTemplateSchema.virtual('applicabilityScore').get(function() {
  // Calculate how broadly applicable this template is
  const typeWeight = {
    'PROGRAM_SEMESTER': 1,
    'ELECTIVE_GROUP': 0.7,
    'LABORATORY': 0.5,
    'THEORY': 0.6,
    'MIXED': 0.8,
    'CUSTOM': 0.3
  };
  
  const usageWeight = Math.min(this.usage.timesUsed / 10, 1);
  const successWeight = this.usage.successRate / 100;
  
  return (typeWeight[this.templateType] * 0.5 + usageWeight * 0.3 + successWeight * 0.2);
});

// Pre-save middleware
RoutineTemplateSchema.pre('save', function(next) {
  // Auto-generate templateCode if not provided
  if (!this.templateCode) {
    const program = this.programCode.substring(0, 3);
    const sem = this.semester;
    const type = this.templateType.substring(0, 3);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.templateCode = `${program}_${sem}_${type}_${random}`;
  }
  
  // Calculate success rate
  if (this.usage.timesUsed > 0) {
    this.usage.successRate = Math.round(
      (this.usage.successfulApplications / this.usage.timesUsed) * 100
    );
  }
  
  next();
});

// Static methods
RoutineTemplateSchema.statics.findForProgram = function(programCode, semester, section = 'ALL') {
  return this.find({
    programCode: programCode,
    semester: semester,
    $or: [
      { section: section },
      { section: 'ALL' }
    ],
    isActive: true
  }).sort({ 'usage.successRate': -1, 'usage.timesUsed': -1 });
};

RoutineTemplateSchema.statics.findBestMatch = function(criteria) {
  const { programCode, semester, templateType, minSuccessRate = 70 } = criteria;
  
  return this.find({
    programCode: programCode,
    semester: semester,
    templateType: templateType || { $exists: true },
    'usage.successRate': { $gte: minSuccessRate },
    isActive: true
  }).sort({ 'usage.successRate': -1, 'usage.timesUsed': -1 }).limit(5);
};

RoutineTemplateSchema.statics.getPopular = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ 'usage.timesUsed': -1, 'usage.successRate': -1 })
    .limit(limit)
    .populate('createdBy', 'name')
    .populate('approvedBy', 'name');
};

// Instance methods
RoutineTemplateSchema.methods.apply = async function(sessionId, options = {}) {
  const AcademicSession = mongoose.model('AcademicSession');
  const RoutineSlot = mongoose.model('RoutineSlot');
  
  try {
    // Create routine slots based on template
    const slotsToCreate = this.templateSlots.map(slot => ({
      academicSessionId: sessionId,
      dayIndex: slot.dayIndex,
      slotIndex: slot.slotIndex,
      // ... map other fields
      createdFromTemplate: this._id,
      templateVersion: this.version
    }));
    
    const createdSlots = await RoutineSlot.insertMany(slotsToCreate);
    
    // Update usage statistics
    this.usage.timesUsed += 1;
    this.usage.lastUsed = new Date();
    
    if (!options.dryRun) {
      await this.save();
    }
    
    return {
      success: true,
      slotsCreated: createdSlots.length,
      conflicts: [], // Would be populated by conflict detection
      template: this
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      template: this
    };
  }
};

RoutineTemplateSchema.methods.validate = function() {
  const errors = [];
  const warnings = [];
  
  // Basic validation
  if (this.templateSlots.length === 0) {
    errors.push('Template must have at least one slot');
  }
  
  // Check for duplicate slots
  const slotMap = new Map();
  this.templateSlots.forEach(slot => {
    const key = `${slot.dayIndex}-${slot.slotIndex}`;
    if (slotMap.has(key)) {
      errors.push(`Duplicate slot found: Day ${slot.dayIndex}, Slot ${slot.slotIndex}`);
    }
    slotMap.set(key, slot);
  });
  
  // Check subject distribution
  const subjects = new Set(this.templateSlots.map(s => s.subjectCode));
  if (subjects.size < 3) {
    warnings.push('Template has very few subjects, consider adding more variety');
  }
  
  // Custom validation rules
  this.validation.rules.forEach(rule => {
    // Execute validation rule
    // Implementation would depend on rule type
  });
  
  return { errors, warnings };
};

RoutineTemplateSchema.methods.recordUsage = async function(sessionId, outcome) {
  this.usage.timesUsed += 1;
  this.usage.lastUsed = new Date();
  
  if (outcome.success) {
    this.usage.successfulApplications += 1;
  }
  
  if (outcome.conflictCount !== undefined) {
    // Update average conflict count
    const prevAvg = this.usage.avgConflictCount || 0;
    const count = this.usage.timesUsed;
    this.usage.avgConflictCount = ((prevAvg * (count - 1)) + outcome.conflictCount) / count;
  }
  
  await this.save();
};

module.exports = mongoose.model('RoutineTemplate', RoutineTemplateSchema);
