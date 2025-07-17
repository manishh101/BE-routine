const mongoose = require('mongoose');

const SectionElectiveChoiceSchema = new mongoose.Schema(
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
    
    // Context
    semester: {
      type: Number,
      required: true,
      enum: [7, 8]
    },
    section: {
      type: String,
      required: true,
      enum: ['AB', 'CD'],
      uppercase: true
    },
    
    // Selections
    choices: [{
      electiveGroupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ElectiveGroup',
        required: true
      },
      selectedSubjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
      },
      
      // Denormalized for quick access
      groupName: {
        type: String,
        required: true,
        trim: true
      },
      groupCode: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
      },
      subjectCode: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
      },
      subjectName: {
        type: String,
        required: true,
        trim: true
      },
      
      // Subject details
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
      },
      
      // Audit
      selectedAt: {
        type: Date,
        default: Date.now
      },
      selectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    }],
    
    // Approval Workflow
    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Approved', 'Rejected'],
      default: 'Draft'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500
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
SectionElectiveChoiceSchema.index({ 
  programId: 1, 
  semester: 1, 
  section: 1, 
  academicYearId: 1 
}, { unique: true });
SectionElectiveChoiceSchema.index({ status: 1 });
SectionElectiveChoiceSchema.index({ academicYearId: 1, status: 1 });
SectionElectiveChoiceSchema.index({ 'choices.electiveGroupId': 1 });
SectionElectiveChoiceSchema.index({ 'choices.selectedSubjectId': 1 });

// Virtual to get program info
SectionElectiveChoiceSchema.virtual('programInfo', {
  ref: 'Program',
  localField: 'programId',
  foreignField: '_id',
  justOne: true
});

// Virtual to get academic year info
SectionElectiveChoiceSchema.virtual('academicYearInfo', {
  ref: 'AcademicCalendar',
  localField: 'academicYearId',
  foreignField: '_id',
  justOne: true
});

// Instance methods
SectionElectiveChoiceSchema.methods.getChoiceByGroup = function(electiveGroupId) {
  return this.choices.find(choice => choice.electiveGroupId.equals(electiveGroupId));
};

SectionElectiveChoiceSchema.methods.hasChoiceForGroup = function(electiveGroupId) {
  return this.choices.some(choice => choice.electiveGroupId.equals(electiveGroupId));
};

SectionElectiveChoiceSchema.methods.addChoice = async function(electiveGroupId, subjectId, selectedBy) {
  // Check if choice already exists for this group
  if (this.hasChoiceForGroup(electiveGroupId)) {
    throw new Error('Choice already exists for this elective group');
  }
  
  // Get group and subject details
  const ElectiveGroup = mongoose.model('ElectiveGroup');
  const Subject = mongoose.model('Subject');
  
  const [group, subject] = await Promise.all([
    ElectiveGroup.findById(electiveGroupId),
    Subject.findById(subjectId)
  ]);
  
  if (!group) {
    throw new Error('Elective group not found');
  }
  
  if (!subject) {
    throw new Error('Subject not found');
  }
  
  // Validate that subject is available in the group
  if (!group.canSelectSubject(subjectId)) {
    throw new Error('Subject is not available for selection');
  }
  
  // Add the choice
  this.choices.push({
    electiveGroupId: electiveGroupId,
    selectedSubjectId: subjectId,
    groupName: group.name,
    groupCode: group.code,
    subjectCode: subject.code,
    subjectName: subject.name,
    credits: subject.credits,
    weeklyHours: subject.weeklyHours,
    requiresLab: subject.requiresLab,
    selectedBy: selectedBy
  });
  
  return await this.save();
};

SectionElectiveChoiceSchema.methods.updateChoice = async function(electiveGroupId, newSubjectId, selectedBy) {
  const choiceIndex = this.choices.findIndex(choice => 
    choice.electiveGroupId.equals(electiveGroupId)
  );
  
  if (choiceIndex === -1) {
    throw new Error('No existing choice found for this elective group');
  }
  
  // Get new subject details
  const Subject = mongoose.model('Subject');
  const subject = await Subject.findById(newSubjectId);
  
  if (!subject) {
    throw new Error('Subject not found');
  }
  
  // Update the choice
  const choice = this.choices[choiceIndex];
  choice.selectedSubjectId = newSubjectId;
  choice.subjectCode = subject.code;
  choice.subjectName = subject.name;
  choice.credits = subject.credits;
  choice.weeklyHours = subject.weeklyHours;
  choice.requiresLab = subject.requiresLab;
  choice.selectedAt = new Date();
  choice.selectedBy = selectedBy;
  
  return await this.save();
};

SectionElectiveChoiceSchema.methods.removeChoice = function(electiveGroupId) {
  const choiceIndex = this.choices.findIndex(choice => 
    choice.electiveGroupId.equals(electiveGroupId)
  );
  
  if (choiceIndex !== -1) {
    this.choices.splice(choiceIndex, 1);
    return this.save();
  }
  
  throw new Error('Choice not found for this elective group');
};

SectionElectiveChoiceSchema.methods.submit = function() {
  if (this.status !== 'Draft') {
    throw new Error('Can only submit draft choices');
  }
  
  this.status = 'Submitted';
  return this.save();
};

SectionElectiveChoiceSchema.methods.approve = function(approvedBy) {
  if (this.status !== 'Submitted') {
    throw new Error('Can only approve submitted choices');
  }
  
  this.status = 'Approved';
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  this.rejectionReason = undefined;
  
  return this.save();
};

SectionElectiveChoiceSchema.methods.reject = function(rejectionReason, rejectedBy) {
  if (this.status !== 'Submitted') {
    throw new Error('Can only reject submitted choices');
  }
  
  this.status = 'Rejected';
  this.rejectionReason = rejectionReason;
  this.approvedBy = rejectedBy;
  this.approvedAt = new Date();
  
  return this.save();
};

SectionElectiveChoiceSchema.methods.getTotalCredits = function() {
  return this.choices.reduce((total, choice) => {
    return total + choice.credits.theory + choice.credits.practical + choice.credits.tutorial;
  }, 0);
};

SectionElectiveChoiceSchema.methods.getTotalWeeklyHours = function() {
  return this.choices.reduce((total, choice) => {
    return total + choice.weeklyHours.theory + choice.weeklyHours.practical + choice.weeklyHours.tutorial;
  }, 0);
};

SectionElectiveChoiceSchema.methods.getLabSubjects = function() {
  return this.choices.filter(choice => choice.requiresLab);
};

// Static methods
SectionElectiveChoiceSchema.statics.findBySection = function(programId, semester, section, academicYearId) {
  return this.findOne({
    programId: programId,
    semester: semester,
    section: section,
    academicYearId: academicYearId
  });
};

SectionElectiveChoiceSchema.statics.findByStatus = function(status, academicYearId) {
  return this.find({
    status: status,
    academicYearId: academicYearId,
    isActive: true
  });
};

SectionElectiveChoiceSchema.statics.findPendingApprovals = function(academicYearId) {
  return this.find({
    status: 'Submitted',
    academicYearId: academicYearId,
    isActive: true
  });
};

SectionElectiveChoiceSchema.statics.createForSection = async function(programId, semester, section, academicYearId) {
  // Check if already exists
  const existing = await this.findBySection(programId, semester, section, academicYearId);
  if (existing) {
    throw new Error('Elective choices already exist for this section');
  }
  
  return await this.create({
    programId,
    semester,
    section,
    academicYearId,
    choices: []
  });
};

// Pre-save middleware
SectionElectiveChoiceSchema.pre('save', async function(next) {
  // Update elective group selection counts when status changes to approved
  if (this.isModified('status') && this.status === 'Approved') {
    const ElectiveGroup = mongoose.model('ElectiveGroup');
    
    for (const choice of this.choices) {
      const group = await ElectiveGroup.findById(choice.electiveGroupId);
      if (group) {
        group.addSubjectSelection(choice.selectedSubjectId);
        await group.save();
      }
    }
  }
  
  // If status changes from approved to something else, decrease counts
  if (this.isModified('status') && this.status !== 'Approved') {
    const originalDoc = await this.constructor.findById(this._id);
    if (originalDoc && originalDoc.status === 'Approved') {
      const ElectiveGroup = mongoose.model('ElectiveGroup');
      
      for (const choice of this.choices) {
        const group = await ElectiveGroup.findById(choice.electiveGroupId);
        if (group) {
          group.removeSubjectSelection(choice.selectedSubjectId);
          await group.save();
        }
      }
    }
  }
  
  next();
});

// Validation
SectionElectiveChoiceSchema.pre('validate', async function(next) {
  // Validate that all choices are for the correct semester
  if (this.choices && this.choices.length > 0) {
    const ElectiveGroup = mongoose.model('ElectiveGroup');
    
    for (const choice of this.choices) {
      const group = await ElectiveGroup.findById(choice.electiveGroupId);
      if (group && group.semester !== this.semester) {
        return next(new Error(`Choice for ${choice.groupCode} is not for semester ${this.semester}`));
      }
    }
  }
  
  next();
});

module.exports = mongoose.model('SectionElectiveChoice', SectionElectiveChoiceSchema);
