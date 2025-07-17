const RoutineSlot = require('../models/RoutineSlot');
const Teacher = require('../models/Teacher');
const Subject = require('../models/Subject');
const Room = require('../models/Room');
const Department = require('../models/Department');
const Program = require('../models/Program');
const mongoose = require('mongoose');

/**
 * Data Analytics Service
 * Provides comprehensive analytics and reporting for the routine management system
 */
class DataAnalyticsService {

  /**
   * Generate comprehensive dashboard analytics
   * @param {String} academicYearId - Academic year ID
   * @param {String} departmentId - Department ID (optional)
   * @returns {Object} Dashboard analytics data
   */
  async getDashboardAnalytics(academicYearId, departmentId = null) {
    try {
      const filter = { academicYearId, isActive: true };
      if (departmentId) {
        // Get programs under this department
        const programs = await Program.find({ departmentId, isActive: true });
        const programIds = programs.map(p => p._id);
        filter.programId = { $in: programIds };
      }

      const [
        totalSlots,
        teacherStats,
        roomStats,
        subjectStats,
        timeDistribution,
        departmentStats
      ] = await Promise.all([
        this.getTotalSlotsCount(filter),
        this.getTeacherStatistics(academicYearId, departmentId),
        this.getRoomStatistics(academicYearId, departmentId),
        this.getSubjectStatistics(academicYearId, departmentId),
        this.getTimeDistribution(academicYearId, departmentId),
        this.getDepartmentStatistics(academicYearId)
      ]);

      return {
        overview: {
          totalSlots,
          activeTeachers: teacherStats.active,
          activeRooms: roomStats.active,
          activeSubjects: subjectStats.active
        },
        teachers: teacherStats,
        rooms: roomStats,
        subjects: subjectStats,
        timeDistribution,
        departments: departmentStats,
        generatedAt: new Date()
      };

    } catch (error) {
      throw new Error(`Dashboard analytics generation failed: ${error.message}`);
    }
  }

  /**
   * Get total routine slots count
   * @param {Object} filter - MongoDB filter
   * @returns {Number} Total slots count
   */
  async getTotalSlotsCount(filter) {
    return await RoutineSlot.countDocuments(filter);
  }

  /**
   * Get teacher statistics
   * @param {String} academicYearId - Academic year ID
   * @param {String} departmentId - Department ID (optional)
   * @returns {Object} Teacher statistics
   */
  async getTeacherStatistics(academicYearId, departmentId = null) {
    const teacherFilter = { isActive: true };
    if (departmentId) teacherFilter.departmentId = departmentId;

    const teachers = await Teacher.find(teacherFilter);
    
    // Get workload distribution
    const workloadData = await Promise.all(
      teachers.map(async (teacher) => {
        const slotCount = await RoutineSlot.countDocuments({
          teacherIds: teacher._id,
          academicYearId,
          isActive: true
        });
        
        const utilization = teacher.maxWeeklyHours > 0 
          ? (slotCount / teacher.maxWeeklyHours) * 100 
          : 0;

        return {
          teacherId: teacher._id,
          shortName: teacher.shortName,
          fullName: teacher.fullName,
          designation: teacher.designation,
          maxHours: teacher.maxWeeklyHours,
          currentHours: slotCount,
          utilization: Math.round(utilization * 100) / 100
        };
      })
    );

    // Categorize by utilization
    const underutilized = workloadData.filter(t => t.utilization < 60).length;
    const optimal = workloadData.filter(t => t.utilization >= 60 && t.utilization <= 90).length;
    const overloaded = workloadData.filter(t => t.utilization > 90).length;

    return {
      total: teachers.length,
      active: teachers.filter(t => t.isActive).length,
      workloadDistribution: {
        underutilized,
        optimal,
        overloaded
      },
      averageUtilization: workloadData.length > 0 
        ? workloadData.reduce((sum, t) => sum + t.utilization, 0) / workloadData.length 
        : 0,
      details: workloadData.sort((a, b) => b.utilization - a.utilization)
    };
  }

  /**
   * Get room statistics
   * @param {String} academicYearId - Academic year ID
   * @param {String} departmentId - Department ID (optional)
   * @returns {Object} Room statistics
   */
  async getRoomStatistics(academicYearId, departmentId = null) {
    const roomFilter = { isActive: true };
    if (departmentId) roomFilter.departmentId = departmentId;

    const rooms = await Room.find(roomFilter);

    // Calculate room utilization
    const roomUtilization = await Promise.all(
      rooms.map(async (room) => {
        const slotCount = await RoutineSlot.countDocuments({
          roomId: room._id,
          academicYearId,
          isActive: true
        });

        // Assuming 54 possible slots per week (6 days × 9 slots)
        const totalPossibleSlots = 54;
        const utilization = (slotCount / totalPossibleSlots) * 100;

        return {
          roomId: room._id,
          name: room.name,
          building: room.building,
          capacity: room.capacity,
          type: room.type,
          currentSlots: slotCount,
          utilization: Math.round(utilization * 100) / 100
        };
      })
    );

    // Group by room type
    const byType = roomUtilization.reduce((acc, room) => {
      if (!acc[room.type]) {
        acc[room.type] = { count: 0, totalUtilization: 0 };
      }
      acc[room.type].count++;
      acc[room.type].totalUtilization += room.utilization;
      return acc;
    }, {});

    // Calculate average utilization by type
    Object.keys(byType).forEach(type => {
      byType[type].averageUtilization = byType[type].totalUtilization / byType[type].count;
    });

    return {
      total: rooms.length,
      active: rooms.filter(r => r.isActive).length,
      byType,
      averageUtilization: roomUtilization.length > 0 
        ? roomUtilization.reduce((sum, r) => sum + r.utilization, 0) / roomUtilization.length 
        : 0,
      details: roomUtilization.sort((a, b) => b.utilization - a.utilization)
    };
  }

  /**
   * Get subject statistics
   * @param {String} academicYearId - Academic year ID
   * @param {String} departmentId - Department ID (optional)
   * @returns {Object} Subject statistics
   */
  async getSubjectStatistics(academicYearId, departmentId = null) {
    let matchStage = { academicYearId: mongoose.Types.ObjectId(academicYearId), isActive: true };
    
    if (departmentId) {
      const programs = await Program.find({ departmentId, isActive: true });
      const programIds = programs.map(p => p._id);
      matchStage.programId = { $in: programIds };
    }

    const subjectStats = await RoutineSlot.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$subjectId',
          totalSlots: { $sum: 1 },
          theorySlots: {
            $sum: { $cond: [{ $eq: ['$classType', 'theory'] }, 1, 0] }
          },
          labSlots: {
            $sum: { $cond: [{ $eq: ['$classType', 'lab'] }, 1, 0] }
          },
          programs: { $addToSet: '$programId' },
          semesters: { $addToSet: '$semester' }
        }
      },
      {
        $lookup: {
          from: 'subjects',
          localField: '_id',
          foreignField: '_id',
          as: 'subject'
        }
      },
      { $unwind: '$subject' },
      {
        $project: {
          subjectCode: '$subject.code',
          subjectName: '$subject.name',
          weeklyHours: '$subject.weeklyHours',
          hasLab: '$subject.hasLab',
          isElective: '$subject.isElective',
          totalSlots: 1,
          theorySlots: 1,
          labSlots: 1,
          programCount: { $size: '$programs' },
          semesterCount: { $size: '$semesters' }
        }
      },
      { $sort: { totalSlots: -1 } }
    ]);

    const totalSubjects = await Subject.countDocuments({ isActive: true });
    const electiveSubjects = subjectStats.filter(s => s.isElective).length;
    const coreSubjects = subjectStats.filter(s => !s.isElective).length;

    return {
      total: totalSubjects,
      active: subjectStats.length,
      elective: electiveSubjects,
      core: coreSubjects,
      averageSlotsPerSubject: subjectStats.length > 0 
        ? subjectStats.reduce((sum, s) => sum + s.totalSlots, 0) / subjectStats.length 
        : 0,
      details: subjectStats
    };
  }

  /**
   * Get time distribution analytics
   * @param {String} academicYearId - Academic year ID
   * @param {String} departmentId - Department ID (optional)
   * @returns {Object} Time distribution data
   */
  async getTimeDistribution(academicYearId, departmentId = null) {
    let matchStage = { academicYearId: mongoose.Types.ObjectId(academicYearId), isActive: true };
    
    if (departmentId) {
      const programs = await Program.find({ departmentId, isActive: true });
      const programIds = programs.map(p => p._id);
      matchStage.programId = { $in: programIds };
    }

    const [dayDistribution, slotDistribution, classTypeDistribution] = await Promise.all([
      // By day of week
      RoutineSlot.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$dayIndex',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // By time slot
      RoutineSlot.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$slotIndex',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // By class type
      RoutineSlot.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$classType',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Convert day indices to day names
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayData = dayDistribution.map(d => ({
      day: dayNames[d._id] || `Day ${d._id}`,
      dayIndex: d._id,
      count: d.count
    }));

    return {
      byDay: dayData,
      byTimeSlot: slotDistribution,
      byClassType: classTypeDistribution,
      peakDay: dayData.reduce((max, day) => day.count > max.count ? day : max, dayData[0] || { count: 0 }),
      peakSlot: slotDistribution.reduce((max, slot) => slot.count > max.count ? slot : max, slotDistribution[0] || { count: 0 })
    };
  }

  /**
   * Get department-wise statistics
   * @param {String} academicYearId - Academic year ID
   * @returns {Object} Department statistics
   */
  async getDepartmentStatistics(academicYearId) {
    const departments = await Department.find({ isActive: true });
    
    const departmentStats = await Promise.all(
      departments.map(async (dept) => {
        const programs = await Program.find({ departmentId: dept._id, isActive: true });
        const programIds = programs.map(p => p._id);
        
        const [slotCount, teacherCount, subjectCount] = await Promise.all([
          RoutineSlot.countDocuments({
            academicYearId,
            programId: { $in: programIds },
            isActive: true
          }),
          Teacher.countDocuments({ departmentId: dept._id, isActive: true }),
          Subject.countDocuments({ 
            programId: { $in: programIds }, 
            isActive: true 
          })
        ]);

        return {
          departmentId: dept._id,
          code: dept.code,
          name: dept.name,
          programCount: programs.length,
          teacherCount,
          subjectCount,
          slotCount
        };
      })
    );

    return departmentStats.sort((a, b) => b.slotCount - a.slotCount);
  }

  /**
   * Generate weekly routine report
   * @param {Object} filters - Filtering criteria
   * @returns {Object} Weekly routine report
   */
  async getWeeklyRoutineReport(filters) {
    const { academicYearId, programId, semester, year, section } = filters;
    
    const matchStage = {
      academicYearId: mongoose.Types.ObjectId(academicYearId),
      isActive: true
    };
    
    if (programId) matchStage.programId = mongoose.Types.ObjectId(programId);
    if (semester) matchStage.semester = semester;
    if (year) matchStage.year = year;
    if (section) matchStage.section = section;

    const routineData = await RoutineSlot.find(matchStage)
      .populate('programId', 'code name')
      .populate('subjectId', 'code name weeklyHours')
      .populate('teacherIds', 'shortName fullName')
      .populate('roomId', 'name building capacity')
      .populate('labGroupId', 'name groups')
      .sort({ dayIndex: 1, slotIndex: 1 });

    // Organize by day and time
    const weeklySchedule = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Initialize days
    dayNames.forEach((day, index) => {
      weeklySchedule[day] = {
        dayIndex: index,
        slots: []
      };
    });

    // Populate schedule
    routineData.forEach(slot => {
      const dayName = dayNames[slot.dayIndex];
      if (weeklySchedule[dayName]) {
        weeklySchedule[dayName].slots.push({
          slotIndex: slot.slotIndex,
          subject: {
            code: slot.display.subjectCode || slot.subjectId?.code,
            name: slot.display.subjectName || slot.subjectId?.name
          },
          teacher: slot.display.teacherName || slot.teacherIds?.map(t => t.shortName).join(', '),
          room: slot.display.roomName || slot.roomId?.name,
          classType: slot.classType,
          labGroup: slot.labGroupName,
          recurrence: slot.recurrence
        });
      }
    });

    // Sort slots within each day
    Object.keys(weeklySchedule).forEach(day => {
      weeklySchedule[day].slots.sort((a, b) => a.slotIndex - b.slotIndex);
    });

    return {
      filters,
      schedule: weeklySchedule,
      summary: {
        totalSlots: routineData.length,
        subjectsCount: [...new Set(routineData.map(s => s.subjectId?.toString()))].length,
        teachersCount: [...new Set(routineData.flatMap(s => s.teacherIds?.map(t => t.toString()) || []))].length,
        roomsCount: [...new Set(routineData.map(s => s.roomId?.toString()))].filter(Boolean).length
      },
      generatedAt: new Date()
    };
  }

  /**
   * Get conflict analysis report
   * @param {String} academicYearId - Academic year ID
   * @returns {Object} Conflict analysis
   */
  async getConflictAnalysis(academicYearId) {
    const conflictDetection = require('./conflictDetection');
    
    const allSlots = await RoutineSlot.find({
      academicYearId,
      isActive: true
    });

    const conflicts = [];
    
    // Check each slot for conflicts
    for (const slot of allSlots) {
      const slotConflicts = await conflictDetection.checkSlotConflicts(slot.toObject());
      if (slotConflicts.hasConflicts) {
        conflicts.push({
          slotId: slot._id,
          slot: {
            day: slot.dayIndex,
            time: slot.slotIndex,
            program: slot.programId,
            semester: slot.semester,
            section: slot.section
          },
          conflicts: slotConflicts.conflicts
        });
      }
    }

    return {
      totalSlots: allSlots.length,
      conflictingSlots: conflicts.length,
      conflictRate: allSlots.length > 0 ? (conflicts.length / allSlots.length) * 100 : 0,
      conflicts: conflicts.slice(0, 50), // Limit to first 50 conflicts
      conflictTypes: this.categorizeConflicts(conflicts)
    };
  }

  /**
   * Categorize conflicts by type
   * @param {Array} conflicts - Array of conflicts
   * @returns {Object} Categorized conflicts
   */
  categorizeConflicts(conflicts) {
    const categories = {
      teacher: 0,
      room: 0,
      section: 0,
      other: 0
    };

    conflicts.forEach(conflict => {
      conflict.conflicts.forEach(c => {
        if (c.type === 'teacher_conflict') categories.teacher++;
        else if (c.type === 'room_conflict') categories.room++;
        else if (c.type === 'section_conflict') categories.section++;
        else categories.other++;
      });
    });

    return categories;
  }
}

module.exports = new DataAnalyticsService();
