const RoutineSlot = require('../models/RoutineSlot');
const Teacher = require('../models/Teacher');
const Room = require('../models/Room');
const Subject = require('../models/Subject');
const TimeSlot = require('../models/TimeSlot');
const conflictDetection = require('./conflictDetection');

/**
 * Routine Optimization Service
 * Provides advanced algorithms for optimizing routine scheduling
 */
class RoutineOptimizationService {
  
  /**
   * Optimize teacher workload distribution
   * @param {String} academicYearId - Academic year ID
   * @param {String} departmentId - Department ID (optional)
   * @returns {Object} Optimization suggestions
   */
  async optimizeTeacherWorkload(academicYearId, departmentId = null) {
    try {
      // Get all teachers
      const teacherFilter = { isActive: true };
      if (departmentId) teacherFilter.departmentId = departmentId;
      
      const teachers = await Teacher.find(teacherFilter);
      
      // Get current workload for each teacher
      const workloadAnalysis = await Promise.all(
        teachers.map(async (teacher) => {
          const currentWorkload = await this.calculateTeacherWorkload(
            teacher._id, 
            academicYearId
          );
          
          return {
            teacherId: teacher._id,
            teacherName: teacher.fullName,
            shortName: teacher.shortName,
            maxWeeklyHours: teacher.maxWeeklyHours,
            currentHours: currentWorkload.totalHours,
            utilization: (currentWorkload.totalHours / teacher.maxWeeklyHours) * 100,
            availability: teacher.schedulingConstraints?.availableDays || teacher.availableDays || [0,1,2,3,4,5],
            subjects: currentWorkload.subjects
          };
        })
      );
      
      // Find overloaded and underutilized teachers
      const overloaded = workloadAnalysis.filter(t => t.utilization > 90);
      const underutilized = workloadAnalysis.filter(t => t.utilization < 60);
      const optimal = workloadAnalysis.filter(t => t.utilization >= 60 && t.utilization <= 90);
      
      // Generate optimization suggestions
      const suggestions = await this.generateWorkloadSuggestions(
        overloaded, 
        underutilized, 
        academicYearId
      );
      
      return {
        analysis: {
          total: teachers.length,
          overloaded: overloaded.length,
          underutilized: underutilized.length,
          optimal: optimal.length
        },
        teachers: {
          overloaded,
          underutilized,
          optimal
        },
        suggestions,
        averageUtilization: workloadAnalysis.reduce((sum, t) => sum + t.utilization, 0) / workloadAnalysis.length
      };
      
    } catch (error) {
      throw new Error(`Teacher workload optimization failed: ${error.message}`);
    }
  }
  
  /**
   * Calculate teacher's current workload
   * @param {String} teacherId - Teacher ID
   * @param {String} academicYearId - Academic year ID
   * @returns {Object} Workload data
   */
  async calculateTeacherWorkload(teacherId, academicYearId) {
    const routineSlots = await RoutineSlot.find({
      teacherIds: teacherId,
      academicYearId,
      isActive: true
    }).populate('subjectId', 'code name weeklyHours');
    
    const subjects = {};
    let totalHours = 0;
    
    routineSlots.forEach(slot => {
      const subjectCode = slot.subjectId?.code || 'Unknown';
      const subjectName = slot.subjectId?.name || 'Unknown';
      
      if (!subjects[subjectCode]) {
        subjects[subjectCode] = {
          name: subjectName,
          theoryHours: 0,
          labHours: 0,
          totalSlots: 0
        };
      }
      
      subjects[subjectCode].totalSlots++;
      
      if (slot.classType === 'lab') {
        subjects[subjectCode].labHours++;
      } else {
        subjects[subjectCode].theoryHours++;
      }
    });
    
    // Calculate total hours (assuming 1 slot = 1 hour)
    totalHours = routineSlots.length;
    
    return {
      totalHours,
      subjects,
      slotsCount: routineSlots.length
    };
  }
  
  /**
   * Generate workload optimization suggestions
   * @param {Array} overloaded - Overloaded teachers
   * @param {Array} underutilized - Underutilized teachers
   * @param {String} academicYearId - Academic year ID
   * @returns {Array} Suggestions
   */
  async generateWorkloadSuggestions(overloaded, underutilized, academicYearId) {
    const suggestions = [];
    
    for (const overloadedTeacher of overloaded) {
      // Find subjects that could be transferred
      const transferableSubjects = Object.keys(overloadedTeacher.subjects).slice(0, 2);
      
      for (const subjectCode of transferableSubjects) {
        // Find underutilized teachers who could teach this subject
        const potentialTeachers = underutilized.filter(teacher => 
          teacher.utilization < 80 // Leave some buffer
        );
        
        if (potentialTeachers.length > 0) {
          suggestions.push({
            type: 'workload_transfer',
            from: {
              teacherId: overloadedTeacher.teacherId,
              teacherName: overloadedTeacher.teacherName,
              currentUtilization: overloadedTeacher.utilization
            },
            to: {
              teacherId: potentialTeachers[0].teacherId,
              teacherName: potentialTeachers[0].teacherName,
              currentUtilization: potentialTeachers[0].utilization
            },
            subject: {
              code: subjectCode,
              name: overloadedTeacher.subjects[subjectCode].name
            },
            impact: {
              hoursToTransfer: overloadedTeacher.subjects[subjectCode].totalSlots,
              newUtilizationFrom: overloadedTeacher.utilization - 
                (overloadedTeacher.subjects[subjectCode].totalSlots / overloadedTeacher.maxWeeklyHours) * 100,
              newUtilizationTo: potentialTeachers[0].utilization + 
                (overloadedTeacher.subjects[subjectCode].totalSlots / potentialTeachers[0].maxWeeklyHours) * 100
            }
          });
        }
      }
    }
    
    return suggestions;
  }
  
  /**
   * Optimize room utilization
   * @param {String} academicYearId - Academic year ID
   * @param {String} departmentId - Department ID (optional)
   * @returns {Object} Room optimization data
   */
  async optimizeRoomUtilization(academicYearId, departmentId = null) {
    try {
      // Get all rooms
      const roomFilter = { isActive: true };
      if (departmentId) roomFilter.departmentId = departmentId;
      
      const rooms = await Room.find(roomFilter);
      
      // Calculate utilization for each room
      const roomUtilization = await Promise.all(
        rooms.map(async (room) => {
          const usage = await this.calculateRoomUsage(room._id, academicYearId);
          return {
            roomId: room._id,
            roomName: room.name,
            building: room.building,
            capacity: room.capacity,
            type: room.type,
            ...usage
          };
        })
      );
      
      // Analyze utilization patterns
      const underutilized = roomUtilization.filter(r => r.utilizationPercentage < 40);
      const overutilized = roomUtilization.filter(r => r.utilizationPercentage > 80);
      const optimal = roomUtilization.filter(r => r.utilizationPercentage >= 40 && r.utilizationPercentage <= 80);
      
      return {
        analysis: {
          total: rooms.length,
          underutilized: underutilized.length,
          overutilized: overutilized.length,
          optimal: optimal.length
        },
        rooms: {
          underutilized,
          overutilized,
          optimal
        },
        averageUtilization: roomUtilization.reduce((sum, r) => sum + r.utilizationPercentage, 0) / roomUtilization.length
      };
      
    } catch (error) {
      throw new Error(`Room optimization failed: ${error.message}`);
    }
  }
  
  /**
   * Calculate room usage statistics
   * @param {String} roomId - Room ID
   * @param {String} academicYearId - Academic year ID
   * @returns {Object} Usage statistics
   */
  async calculateRoomUsage(roomId, academicYearId) {
    const routineSlots = await RoutineSlot.find({
      roomId,
      academicYearId,
      isActive: true
    });
    
    // Total possible slots per week (assuming 6 days, 9 slots per day)
    const totalPossibleSlots = 6 * 9; // 54 slots per week
    const usedSlots = routineSlots.length;
    const utilizationPercentage = (usedSlots / totalPossibleSlots) * 100;
    
    // Analyze by day and time
    const usageByDay = {};
    const usageByTime = {};
    
    routineSlots.forEach(slot => {
      // By day
      if (!usageByDay[slot.dayIndex]) {
        usageByDay[slot.dayIndex] = 0;
      }
      usageByDay[slot.dayIndex]++;
      
      // By time slot
      if (!usageByTime[slot.slotIndex]) {
        usageByTime[slot.slotIndex] = 0;
      }
      usageByTime[slot.slotIndex]++;
    });
    
    return {
      totalSlots: usedSlots,
      utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
      usageByDay,
      usageByTime,
      peakDay: Object.keys(usageByDay).reduce((a, b) => usageByDay[a] > usageByDay[b] ? a : b, 0),
      peakTime: Object.keys(usageByTime).reduce((a, b) => usageByTime[a] > usageByTime[b] ? a : b, 0)
    };
  }
  
  /**
   * Find optimal time slots for a new class
   * @param {Object} requirements - Class requirements
   * @returns {Array} Suggested time slots
   */
  async findOptimalTimeSlots(requirements) {
    const {
      academicYearId,
      programId,
      semester,
      year,
      section,
      subjectId,
      teacherIds,
      classType,
      duration = 1
    } = requirements;
    
    try {
      // Get all available time slots
      const timeSlots = await TimeSlot.find({ isBreak: false }).sort({ sortOrder: 1 });
      
      const suggestions = [];
      
      // Check each day
      for (let dayIndex = 0; dayIndex < 6; dayIndex++) { // Sunday to Friday
        for (const timeSlot of timeSlots) {
          const slotData = {
            dayIndex,
            slotIndex: timeSlot._id,
            academicYearId,
            programId,
            semester,
            year,
            section,
            subjectId,
            teacherIds,
            classType
          };
          
          // Check for conflicts
          const conflicts = await conflictDetection.checkSlotConflicts(slotData);
          
          if (!conflicts.hasConflicts) {
            // Calculate optimization score
            const score = await this.calculateOptimizationScore(slotData);
            
            suggestions.push({
              dayIndex,
              slotIndex: timeSlot._id,
              timeSlot: {
                label: timeSlot.label,
                startTime: timeSlot.startTime,
                endTime: timeSlot.endTime
              },
              score,
              reasons: score.reasons
            });
          }
        }
      }
      
      // Sort by optimization score
      return suggestions.sort((a, b) => b.score.total - a.score.total).slice(0, 10);
      
    } catch (error) {
      throw new Error(`Optimal time slot finding failed: ${error.message}`);
    }
  }
  
  /**
   * Calculate optimization score for a time slot
   * @param {Object} slotData - Slot data
   * @returns {Object} Score and reasons
   */
  async calculateOptimizationScore(slotData) {
    let score = 100;
    const reasons = [];
    
    // Morning slots are generally preferred
    const timeSlot = await TimeSlot.findById(slotData.slotIndex);
    if (timeSlot && timeSlot.category === 'Morning') {
      score += 10;
      reasons.push('Morning time slot (preferred)');
    }
    
    // Check teacher preference/availability
    if (slotData.teacherIds && slotData.teacherIds.length > 0) {
      const teacher = await Teacher.findById(slotData.teacherIds[0]);
      const availableDays = teacher.schedulingConstraints?.availableDays || teacher.availableDays || [0,1,2,3,4,5];
      if (teacher && availableDays.includes(slotData.dayIndex)) {
        score += 15;
        reasons.push('Teacher is available on this day');
      }
    }
    
    // Avoid back-to-back classes for same section
    const adjacentSlots = await RoutineSlot.find({
      academicYearId: slotData.academicYearId,
      programId: slotData.programId,
      semester: slotData.semester,
      year: slotData.year,
      section: slotData.section,
      dayIndex: slotData.dayIndex,
      slotIndex: { $in: [slotData.slotIndex - 1, slotData.slotIndex + 1] },
      isActive: true
    });
    
    if (adjacentSlots.length === 0) {
      score += 5;
      reasons.push('No adjacent classes for same section');
    }
    
    return {
      total: Math.round(score),
      reasons
    };
  }
}

module.exports = new RoutineOptimizationService();
