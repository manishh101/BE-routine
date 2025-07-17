const mongoose = require('mongoose');

const TeacherScheduleViewSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true
    },
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicCalendar',
      required: true
    },
    
    // Teacher Information (Denormalized)
    teacherInfo: {
      shortName: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
      },
      fullName: {
        type: String,
        required: true,
        trim: true
      },
      designation: {
        type: String,
        trim: true
      },
      departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department'
      },
      departmentCode: {
        type: String,
        uppercase: true,
        trim: true
      },
      email: {
        type: String,
        lowercase: true,
        trim: true
      }
    },
    
    // Weekly Summary
    weeklyLoad: {
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
      }
    },
    
    // Detailed Schedule
    schedule: {
      // Sunday (0)
      0: [{
        slotIndex: {
          type: Number,
          required: true
        },
        timeSlot: {
          type: String,
          trim: true
        },
        
        // Class Details
        routineSlotId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'RoutineSlot'
        },
        programCode: {
          type: String,
          uppercase: true,
          trim: true
        },
        semester: {
          type: Number,
          min: 1,
          max: 8
        },
        section: {
          type: String,
          uppercase: true,
          trim: true
        },
        subjectCode: {
          type: String,
          uppercase: true,
          trim: true
        },
        subjectName: {
          type: String,
          trim: true
        },
        roomName: {
          type: String,
          trim: true
        },
        classType: {
          type: String,
          enum: ['L', 'P', 'T']
        },
        
        // Special Cases
        labGroupName: {
          type: String,
          trim: true
        },
        recurrencePattern: {
          type: {
            type: String,
            enum: ['weekly', 'alternate', 'custom']
          },
          pattern: {
            type: String,
            enum: ['odd', 'even']
          },
          description: {
            type: String,
            trim: true
          }
        }
      }],
      
      // Monday (1) through Saturday (6) - same structure
      1: [{ type: mongoose.Schema.Types.Mixed }],
      2: [{ type: mongoose.Schema.Types.Mixed }],
      3: [{ type: mongoose.Schema.Types.Mixed }],
      4: [{ type: mongoose.Schema.Types.Mixed }],
      5: [{ type: mongoose.Schema.Types.Mixed }],
      6: [{ type: mongoose.Schema.Types.Mixed }]
    },
    
    // Additional Analytics
    analytics: {
      totalClasses: {
        type: Number,
        default: 0
      },
      totalPrograms: {
        type: Number,
        default: 0
      },
      totalSubjects: {
        type: Number,
        default: 0
      },
      utilizationRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      peakDayIndex: {
        type: Number,
        min: 0,
        max: 6
      },
      lightestDayIndex: {
        type: Number,
        min: 0,
        max: 6
      }
    },
    
    // Generation Metadata
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    version: {
      type: Number,
      default: 1
    },
    generatedBy: {
      type: String,
      default: 'system'
    }
  },
  {
    timestamps: true,
    // Disable automatic _id for subdocuments to reduce size
    _id: false
  }
);

// Indexes as per data model specification
TeacherScheduleViewSchema.index({ 
  teacherId: 1, 
  academicYearId: 1 
}, { unique: true });
TeacherScheduleViewSchema.index({ lastUpdated: 1 });
TeacherScheduleViewSchema.index({ 'teacherInfo.departmentId': 1 });
TeacherScheduleViewSchema.index({ version: 1 });

// Instance methods
TeacherScheduleViewSchema.methods.getScheduleForDay = function(dayIndex) {
  return this.schedule[dayIndex] || [];
};

TeacherScheduleViewSchema.methods.isAvailable = function(dayIndex, slotIndex, weekPattern = 'weekly') {
  const daySchedule = this.getScheduleForDay(dayIndex);
  
  for (const slot of daySchedule) {
    if (slot.slotIndex === slotIndex) {
      // Check recurrence pattern
      if (slot.recurrencePattern && slot.recurrencePattern.type === 'alternate') {
        // If it's alternate weeks, check pattern match
        return slot.recurrencePattern.pattern !== weekPattern;
      }
      // If it's weekly or no pattern, slot is occupied
      return false;
    }
  }
  
  return true;
};

TeacherScheduleViewSchema.methods.getTotalClassesOnDay = function(dayIndex) {
  return this.getScheduleForDay(dayIndex).length;
};

TeacherScheduleViewSchema.methods.getBusiestDay = function() {
  let maxClasses = 0;
  let busiestDay = 0;
  
  for (let day = 0; day <= 6; day++) {
    const classCount = this.getTotalClassesOnDay(day);
    if (classCount > maxClasses) {
      maxClasses = classCount;
      busiestDay = day;
    }
  }
  
  return { dayIndex: busiestDay, classCount: maxClasses };
};

TeacherScheduleViewSchema.methods.getLightestDay = function() {
  let minClasses = Infinity;
  let lightestDay = 0;
  
  for (let day = 0; day <= 6; day++) {
    const classCount = this.getTotalClassesOnDay(day);
    if (classCount < minClasses) {
      minClasses = classCount;
      lightestDay = day;
    }
  }
  
  return { dayIndex: lightestDay, classCount: minClasses };
};

TeacherScheduleViewSchema.methods.getSubjects = function() {
  const subjects = new Set();
  
  for (let day = 0; day <= 6; day++) {
    const daySchedule = this.getScheduleForDay(day);
    daySchedule.forEach(slot => {
      if (slot.subjectCode) {
        subjects.add(slot.subjectCode);
      }
    });
  }
  
  return Array.from(subjects);
};

TeacherScheduleViewSchema.methods.getPrograms = function() {
  const programs = new Set();
  
  for (let day = 0; day <= 6; day++) {
    const daySchedule = this.getScheduleForDay(day);
    daySchedule.forEach(slot => {
      if (slot.programCode) {
        programs.add(slot.programCode);
      }
    });
  }
  
  return Array.from(programs);
};

TeacherScheduleViewSchema.methods.calculateWorkload = function() {
  let theory = 0, practical = 0, tutorial = 0;
  
  for (let day = 0; day <= 6; day++) {
    const daySchedule = this.getScheduleForDay(day);
    
    daySchedule.forEach(slot => {
      // Calculate weekly hours considering recurrence
      let weeklyMultiplier = 1;
      
      if (slot.recurrencePattern && slot.recurrencePattern.type === 'alternate') {
        weeklyMultiplier = 0.5; // Alternate week = half weekly load
      }
      
      switch (slot.classType) {
        case 'L':
          theory += weeklyMultiplier;
          break;
        case 'P':
          practical += weeklyMultiplier;
          break;
        case 'T':
          tutorial += weeklyMultiplier;
          break;
      }
    });
  }
  
  return {
    theory,
    practical,
    tutorial,
    total: theory + practical + tutorial
  };
};

// Static methods
TeacherScheduleViewSchema.statics.findByTeacher = function(teacherId, academicYearId) {
  return this.findOne({ 
    teacherId: teacherId,
    academicYearId: academicYearId 
  });
};

TeacherScheduleViewSchema.statics.findByDepartment = function(departmentId, academicYearId) {
  return this.find({
    'teacherInfo.departmentId': departmentId,
    academicYearId: academicYearId
  });
};

TeacherScheduleViewSchema.statics.findOverloaded = function(maxHours = 16, academicYearId) {
  return this.find({
    'weeklyLoad.total': { $gt: maxHours },
    academicYearId: academicYearId
  });
};

TeacherScheduleViewSchema.statics.findUnderloaded = function(minHours = 8, academicYearId) {
  return this.find({
    'weeklyLoad.total': { $lt: minHours },
    academicYearId: academicYearId
  });
};

TeacherScheduleViewSchema.statics.generateForTeacher = async function(teacherId, academicYearId) {
  const Teacher = mongoose.model('Teacher');
  const RoutineSlot = mongoose.model('RoutineSlot');
  const TimeSlotDefinition = mongoose.model('TimeSlotDefinition');
  const Department = mongoose.model('Department');
  
  // Get teacher info
  const teacher = await Teacher.findById(teacherId).populate('departmentId');
  if (!teacher) {
    throw new Error('Teacher not found');
  }
  
  // Get all routine slots for this teacher
  const routineSlots = await RoutineSlot.find({
    teacherIds: teacherId,
    academicYearId: academicYearId,
    isActive: true
  }).populate('roomId subjectId programId');
  
  // Get time slot definitions
  const timeSlots = await TimeSlotDefinition.find({}).sort({ sortOrder: 1 });
  const timeSlotMap = new Map(timeSlots.map(ts => [ts._id, ts]));
  
  // Build schedule structure
  const schedule = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
  };
  
  // Populate schedule
  routineSlots.forEach(slot => {
    const timeSlot = timeSlotMap.get(slot.slotIndex);
    
    schedule[slot.dayIndex].push({
      slotIndex: slot.slotIndex,
      timeSlot: timeSlot ? timeSlot.getTimeRange() : `Slot ${slot.slotIndex}`,
      routineSlotId: slot._id,
      programCode: slot.display?.programCode || slot.programCode,
      semester: slot.semester,
      section: slot.section,
      subjectCode: slot.display?.subjectCode || slot.subjectCode_display,
      subjectName: slot.display?.subjectName || slot.subjectName_display,
      roomName: slot.display?.roomName || slot.roomName_display,
      classType: slot.classType,
      labGroupName: slot.labGroupName,
      recurrencePattern: slot.recurrence
    });
  });
  
  // Sort each day by slot index
  Object.keys(schedule).forEach(day => {
    schedule[day].sort((a, b) => a.slotIndex - b.slotIndex);
  });
  
  // Calculate workload
  const weeklyLoad = {
    theory: 0,
    practical: 0,
    tutorial: 0,
    total: 0
  };
  
  routineSlots.forEach(slot => {
    let multiplier = 1;
    if (slot.recurrence && slot.recurrence.type === 'alternate') {
      multiplier = 0.5;
    }
    
    switch (slot.classType) {
      case 'L':
        weeklyLoad.theory += multiplier;
        break;
      case 'P':
        weeklyLoad.practical += multiplier;
        break;
      case 'T':
        weeklyLoad.tutorial += multiplier;
        break;
    }
  });
  
  weeklyLoad.total = weeklyLoad.theory + weeklyLoad.practical + weeklyLoad.tutorial;
  
  // Calculate analytics
  const subjects = new Set();
  const programs = new Set();
  let totalClasses = 0;
  
  routineSlots.forEach(slot => {
    if (slot.subjectId) subjects.add(slot.subjectId.toString());
    if (slot.programId) programs.add(slot.programId.toString());
    totalClasses++;
  });
  
  const busiestDay = Math.max(...Object.keys(schedule).map(day => schedule[day].length));
  const lightestDay = Math.min(...Object.keys(schedule).map(day => schedule[day].length));
  
  const analytics = {
    totalClasses,
    totalPrograms: programs.size,
    totalSubjects: subjects.size,
    utilizationRate: Math.min((weeklyLoad.total / 16) * 100, 100),
    peakDayIndex: Object.keys(schedule).find(day => schedule[day].length === busiestDay),
    lightestDayIndex: Object.keys(schedule).find(day => schedule[day].length === lightestDay)
  };
  
  // Create or update the view
  const viewData = {
    teacherId,
    academicYearId,
    teacherInfo: {
      shortName: teacher.shortName,
      fullName: teacher.fullName,
      designation: teacher.designation,
      departmentId: teacher.departmentId?._id,
      departmentCode: teacher.departmentId?.code,
      email: teacher.email
    },
    weeklyLoad,
    schedule,
    analytics,
    lastUpdated: new Date(),
    version: Date.now()
  };
  
  return await this.findOneAndUpdate(
    { teacherId, academicYearId },
    viewData,
    { upsert: true, new: true }
  );
};

TeacherScheduleViewSchema.statics.regenerateAll = async function(academicYearId) {
  const Teacher = mongoose.model('Teacher');
  const teachers = await Teacher.find({ isActive: true });
  
  const results = [];
  for (const teacher of teachers) {
    try {
      const view = await this.generateForTeacher(teacher._id, academicYearId);
      results.push({ teacherId: teacher._id, success: true, view });
    } catch (error) {
      results.push({ teacherId: teacher._id, success: false, error: error.message });
    }
  }
  
  return results;
};

module.exports = mongoose.model('TeacherScheduleView', TeacherScheduleViewSchema);
