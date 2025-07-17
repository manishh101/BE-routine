/**
 * Analytics Service
 * Provides data analysis and optimization functions for the routine management system
 */

const RoutineSlot = require('../models/RoutineSlot');
const Teacher = require('../models/Teacher');
const Room = require('../models/Room');
const AcademicSession = require('../models/AcademicSession');

/**
 * Generates comprehensive analytics for an academic session
 * @param {Object} session - The academic session object
 * @returns {Object} Analytics data
 */
const generateSessionAnalytics = async (session) => {
  try {
    const sessionId = session._id;
    
    // Get all routine slots for this session
    const routineSlots = await RoutineSlot.find({ academicSessionId: sessionId })
      .populate('roomId')
      .populate('teacherIds')
      .populate('subjectId');
      
    // Calculate utilization metrics
    const totalSlots = routineSlots.length;
    
    // Room utilization
    const roomUtilization = await calculateRoomUtilization(sessionId);
    
    // Teacher workload
    const teacherWorkload = await calculateTeacherWorkload(sessionId);
    
    // Time slot distribution
    const timeDistribution = calculateTimeDistribution(routineSlots);
    
    // Conflict analysis
    const conflicts = await analyzeConflicts(sessionId);
    
    return {
      overview: {
        totalClasses: totalSlots,
        conflictCount: conflicts.totalConflicts,
        utilizationRate: roomUtilization.overallUtilization
      },
      utilization: roomUtilization,
      teacherWorkload: teacherWorkload,
      timeDistribution: timeDistribution,
      conflicts: conflicts,
      recommendations: generateRecommendations(roomUtilization, teacherWorkload, conflicts)
    };
  } catch (error) {
    console.error('Error generating session analytics:', error);
    throw error;
  }
};

/**
 * Calculates room utilization rates
 * @param {String} sessionId - Academic session ID
 * @returns {Object} Room utilization data
 */
const calculateRoomUtilization = async (sessionId) => {
  try {
    // Get all rooms
    const rooms = await Room.find();
    
    // Get all routine slots for this session
    const routineSlots = await RoutineSlot.find({ academicSessionId: sessionId });
    
    // Calculate utilization for each room
    const roomStats = [];
    let totalUtilization = 0;
    let totalRooms = 0;
    
    for (const room of rooms) {
      const roomSlots = routineSlots.filter(slot => 
        slot.roomId && slot.roomId.toString() === room._id.toString()
      );
      
      // Calculate utilization percentage (based on available slots)
      const utilization = (roomSlots.length / 42) * 100; // Assuming 7 slots per day, 6 days a week
      
      roomStats.push({
        roomId: room._id,
        roomName: room.roomName,
        roomType: room.roomType,
        utilization: utilization.toFixed(1),
        totalClasses: roomSlots.length
      });
      
      totalUtilization += utilization;
      totalRooms++;
    }
    
    // Sort rooms by utilization (descending)
    roomStats.sort((a, b) => b.utilization - a.utilization);
    
    // Identify peak days and quiet days
    const dayStats = calculateDayUtilization(routineSlots);
    
    return {
      overallUtilization: (totalUtilization / totalRooms).toFixed(1),
      roomStats: roomStats,
      mostUtilized: roomStats.slice(0, 3),
      leastUtilized: roomStats.slice(-3).reverse(),
      peakDays: dayStats.peak,
      quietDays: dayStats.quiet
    };
  } catch (error) {
    console.error('Error calculating room utilization:', error);
    throw error;
  }
};

/**
 * Calculates teacher workload distribution
 * @param {String} sessionId - Academic session ID
 * @returns {Object} Teacher workload data
 */
const calculateTeacherWorkload = async (sessionId) => {
  try {
    // Get all teachers
    const teachers = await Teacher.find();
    
    // Get all routine slots for this session
    const routineSlots = await RoutineSlot.find({ academicSessionId: sessionId });
    
    // Calculate workload for each teacher
    const teacherStats = [];
    let totalHours = 0;
    let totalTeachers = 0;
    
    for (const teacher of teachers) {
      // Find slots where this teacher is assigned
      const teacherSlots = routineSlots.filter(slot => 
        slot.teacherIds && slot.teacherIds.some(id => id.toString() === teacher._id.toString())
      );
      
      // Calculate hours (assuming each slot is 1.5 hours)
      const hours = teacherSlots.length * 1.5;
      
      if (hours > 0) {
        teacherStats.push({
          teacherId: teacher._id,
          teacherName: teacher.name,
          department: teacher.department,
          hoursPerWeek: hours,
          classesPerWeek: teacherSlots.length
        });
        
        totalHours += hours;
        totalTeachers++;
      }
    }
    
    // Sort teachers by workload (descending)
    teacherStats.sort((a, b) => b.hoursPerWeek - a.hoursPerWeek);
    
    return {
      averageHoursPerWeek: totalTeachers > 0 ? (totalHours / totalTeachers).toFixed(1) : 0,
      teacherStats: teacherStats,
      mostLoaded: teacherStats.slice(0, 3),
      leastLoaded: teacherStats.length > 3 ? teacherStats.slice(-3).reverse() : []
    };
  } catch (error) {
    console.error('Error calculating teacher workload:', error);
    throw error;
  }
};

/**
 * Calculates time slot distribution
 * @param {Array} routineSlots - Array of routine slots
 * @returns {Object} Time distribution data
 */
const calculateTimeDistribution = (routineSlots) => {
  // Initialize count for each day and time slot
  const distribution = {
    byDay: [0, 0, 0, 0, 0, 0, 0],  // Sunday to Saturday
    bySlot: [0, 0, 0, 0, 0, 0, 0]  // 7 time slots
  };
  
  // Count classes in each day and slot
  for (const slot of routineSlots) {
    if (slot.dayIndex >= 0 && slot.dayIndex <= 6) {
      distribution.byDay[slot.dayIndex]++;
    }
    
    if (slot.slotIndex >= 0 && slot.slotIndex <= 6) {
      distribution.bySlot[slot.slotIndex]++;
    }
  }
  
  return distribution;
};

/**
 * Calculates utilization by day
 * @param {Array} routineSlots - Array of routine slots
 * @returns {Object} Day utilization data
 */
const calculateDayUtilization = (routineSlots) => {
  // Initialize count for each day
  const dayCount = [0, 0, 0, 0, 0, 0, 0];  // Sunday to Saturday
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Count classes on each day
  for (const slot of routineSlots) {
    if (slot.dayIndex >= 0 && slot.dayIndex <= 6) {
      dayCount[slot.dayIndex]++;
    }
  }
  
  // Convert counts to utilization percentages
  const dayUtilization = dayCount.map(count => (count / 50) * 100);  // Assuming capacity of 50 classes per day
  
  // Sort days by utilization
  const sortedDays = dayNames
    .map((name, index) => ({ name, utilization: dayUtilization[index] }))
    .sort((a, b) => b.utilization - a.utilization);
  
  // Return peak and quiet days
  return {
    peak: sortedDays.slice(0, 2).map(day => day.name),
    quiet: sortedDays.slice(-2).map(day => day.name)
  };
};

/**
 * Analyzes conflicts in routine
 * @param {String} sessionId - Academic session ID
 * @returns {Object} Conflict analysis data
 */
const analyzeConflicts = async (sessionId) => {
  try {
    // Get all routine slots for this session
    const routineSlots = await RoutineSlot.find({ academicSessionId: sessionId })
      .populate('roomId')
      .populate('teacherIds')
      .populate('subjectId');
    
    // Initialize conflict counters
    let teacherConflicts = 0;
    let roomConflicts = 0;
    let detailedConflicts = [];
    
    // Group slots by day and time
    const slotsByDayAndTime = {};
    
    for (const slot of routineSlots) {
      const key = `${slot.dayIndex}-${slot.slotIndex}`;
      if (!slotsByDayAndTime[key]) {
        slotsByDayAndTime[key] = [];
      }
      slotsByDayAndTime[key].push(slot);
    }
    
    // Check for conflicts in each time block
    for (const key in slotsByDayAndTime) {
      const slots = slotsByDayAndTime[key];
      if (slots.length > 1) {
        // Check for teacher conflicts
        const teacherMap = {};
        for (const slot of slots) {
          if (slot.teacherIds && slot.teacherIds.length > 0) {
            for (const teacher of slot.teacherIds) {
              const teacherId = teacher._id ? teacher._id.toString() : teacher.toString();
              if (teacherMap[teacherId]) {
                // Found a teacher conflict
                teacherConflicts++;
                detailedConflicts.push({
                  type: 'TEACHER_CONFLICT',
                  teacher: teacher.name || teacherId,
                  dayIndex: slot.dayIndex,
                  slotIndex: slot.slotIndex,
                  conflictingClasses: [
                    {
                      id: teacherMap[teacherId]._id,
                      info: `${teacherMap[teacherId].programId}-${teacherMap[teacherId].semester}${teacherMap[teacherId].section}`
                    },
                    {
                      id: slot._id,
                      info: `${slot.programId}-${slot.semester}${slot.section}`
                    }
                  ]
                });
                break;  // Count one conflict per slot
              } else {
                teacherMap[teacherId] = slot;
              }
            }
          }
        }
        
        // Check for room conflicts
        const roomMap = {};
        for (const slot of slots) {
          if (slot.roomId) {
            const roomId = slot.roomId._id ? slot.roomId._id.toString() : slot.roomId.toString();
            if (roomMap[roomId]) {
              // Found a room conflict
              roomConflicts++;
              detailedConflicts.push({
                type: 'ROOM_CONFLICT',
                room: slot.roomId.roomName || roomId,
                dayIndex: slot.dayIndex,
                slotIndex: slot.slotIndex,
                conflictingClasses: [
                  {
                    id: roomMap[roomId]._id,
                    info: `${roomMap[roomId].programId}-${roomMap[roomId].semester}${roomMap[roomId].section}`
                  },
                  {
                    id: slot._id,
                    info: `${slot.programId}-${slot.semester}${slot.section}`
                  }
                ]
              });
              break;  // Count one conflict per slot
            } else {
              roomMap[roomId] = slot;
            }
          }
        }
      }
    }
    
    return {
      totalConflicts: teacherConflicts + roomConflicts,
      teacherConflicts,
      roomConflicts,
      detailedConflicts: detailedConflicts.slice(0, 10)  // Limit to 10 detailed conflicts
    };
  } catch (error) {
    console.error('Error analyzing conflicts:', error);
    throw error;
  }
};

/**
 * Generates recommendations based on analytics
 * @param {Object} roomUtilization - Room utilization data
 * @param {Object} teacherWorkload - Teacher workload data
 * @param {Object} conflicts - Conflict analysis data
 * @returns {Array} Array of recommendations
 */
const generateRecommendations = (roomUtilization, teacherWorkload, conflicts) => {
  const recommendations = [];
  
  // Room utilization recommendations
  if (roomUtilization.leastUtilized.length > 0) {
    const leastUsedRooms = roomUtilization.leastUtilized
      .filter(room => parseFloat(room.utilization) < 30)
      .map(room => room.roomName)
      .join(', ');
      
    if (leastUsedRooms) {
      recommendations.push(`Consider scheduling more classes in underutilized rooms: ${leastUsedRooms}`);
    }
  }
  
  // Day balance recommendations
  if (roomUtilization.peakDays.length > 0 && roomUtilization.quietDays.length > 0) {
    recommendations.push(`Consider moving some classes from ${roomUtilization.peakDays[0]} to ${roomUtilization.quietDays[0]} for better balance`);
  }
  
  // Teacher workload recommendations
  if (teacherWorkload.mostLoaded.length > 0 && teacherWorkload.leastLoaded.length > 0) {
    const mostLoaded = teacherWorkload.mostLoaded[0];
    const leastLoaded = teacherWorkload.leastLoaded[0];
    
    if (mostLoaded.hoursPerWeek > 20 && leastLoaded.hoursPerWeek < 10) {
      recommendations.push(`Consider redistributing workload from ${mostLoaded.teacherName} (${mostLoaded.hoursPerWeek} hrs) to ${leastLoaded.teacherName} (${leastLoaded.hoursPerWeek} hrs)`);
    }
  }
  
  // Conflict recommendations
  if (conflicts.totalConflicts > 0) {
    recommendations.push(`Address ${conflicts.totalConflicts} scheduling conflicts (${conflicts.teacherConflicts} teacher, ${conflicts.roomConflicts} room)`);
  }
  
  return recommendations;
};

/**
 * Optimizes routine for better resource utilization
 * @param {Object} session - The academic session object
 * @returns {Object} Optimization results
 */
const optimizeRoutine = async (session) => {
  try {
    const sessionId = session._id;
    
    // Get analytics for current state
    const beforeAnalytics = await generateSessionAnalytics(session);
    
    // Perform optimization
    // 1. Balance teacher workload
    await balanceTeacherWorkload(sessionId);
    
    // 2. Improve room utilization
    await improveRoomUtilization(sessionId);
    
    // 3. Resolve conflicts
    const resolvedConflicts = await autoResolveConflicts(sessionId);
    
    // Get analytics after optimization
    const afterAnalytics = await generateSessionAnalytics(session);
    
    return {
      before: beforeAnalytics.overview,
      after: afterAnalytics.overview,
      improvements: {
        utilizationImprovement: (afterAnalytics.overview.utilizationRate - beforeAnalytics.overview.utilizationRate).toFixed(1),
        conflictsResolved: resolvedConflicts.resolved
      },
      recommendations: afterAnalytics.recommendations
    };
  } catch (error) {
    console.error('Error optimizing routine:', error);
    throw error;
  }
};

/**
 * Balances teacher workload
 * @param {String} sessionId - Academic session ID
 */
const balanceTeacherWorkload = async (sessionId) => {
  try {
    // For now, this is a placeholder
    // Actual implementation would redistribute classes from overloaded to underloaded teachers
    return true;
  } catch (error) {
    console.error('Error balancing teacher workload:', error);
    throw error;
  }
};

/**
 * Improves room utilization
 * @param {String} sessionId - Academic session ID
 */
const improveRoomUtilization = async (sessionId) => {
  try {
    // For now, this is a placeholder
    // Actual implementation would move classes to underutilized rooms and time slots
    return true;
  } catch (error) {
    console.error('Error improving room utilization:', error);
    throw error;
  }
};

/**
 * Automatically resolves conflicts
 * @param {String} sessionId - Academic session ID
 * @returns {Object} Conflict resolution results
 */
const autoResolveConflicts = async (sessionId) => {
  try {
    // For now, this is a placeholder
    // Actual implementation would automatically resolve conflicts where possible
    return {
      resolved: 0,
      unresolved: 0
    };
  } catch (error) {
    console.error('Error resolving conflicts:', error);
    throw error;
  }
};

/**
 * Generates analytics for a routine template
 * @param {Object} template - The routine template object
 * @returns {Object} Template analytics data
 */
const generateTemplateAnalytics = async (template) => {
  try {
    // For now, return basic template information with placeholder success metrics
    return {
      templateName: template.templateName,
      category: template.category,
      successRate: template.successRate || 95,
      usageCount: template.usageCount || 3,
      compatiblePrograms: template.applicableTo?.programs || [],
      recommendedFor: generateRecommendations([]),
      lastUsed: template.lastUsed || new Date()
    };
  } catch (error) {
    console.error('Error generating template analytics:', error);
    throw error;
  }
};

module.exports = {
  generateSessionAnalytics,
  optimizeRoutine,
  generateTemplateAnalytics
};
