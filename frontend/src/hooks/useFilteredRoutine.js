import { useMemo } from 'react';
import { useSemesterGroup, filterRoutineBySemesterGroup } from '../contexts/SemesterGroupContext';

// Hook to get filtered routine data based on semester group
export const useFilteredRoutine = (routineData, options = {}) => {
  const { semesterGroup } = useSemesterGroup();
  const { 
    enabled = true, // Whether to apply filtering
    forTeacherView = false, // Special handling for teacher views
    forRoomView = false // Special handling for room views
  } = options;

  const filteredRoutine = useMemo(() => {
    if (!enabled || !routineData) {
      return routineData;
    }

    // Always apply filtering now that we removed 'all' option
    return filterRoutineBySemesterGroup(routineData, semesterGroup);
  }, [routineData, semesterGroup, enabled]);

  // Calculate statistics for the filtered routine
  const stats = useMemo(() => {
    if (!filteredRoutine?.routine) {
      return { 
        totalClasses: 0, 
        uniqueSubjects: 0, 
        busyDays: 0, 
        totalHours: 0,
        semesterGroup,
        filteredFromTotal: 0
      };
    }

    let totalClasses = 0;
    const uniqueSubjects = new Set();
    const busyDays = new Set();
    let totalHours = 0;

    try {
      Object.entries(filteredRoutine.routine).forEach(([dayIndex, daySlots]) => {
        if (daySlots && typeof daySlots === 'object') {
          const slotsForDay = Object.keys(daySlots);
          
          if (slotsForDay.length > 0) {
            busyDays.add(parseInt(dayIndex));
            
            Object.entries(daySlots).forEach(([slotIndex, slotData]) => {
              if (slotData) {
                // Handle both single slot objects and arrays of slots
                if (Array.isArray(slotData)) {
                  // For teacher/room routines with arrays of slots
                  slotData.forEach(classInfo => {
                    if (classInfo && typeof classInfo === 'object') {
                      totalClasses++;
                      totalHours += 1; // Assuming each slot is 1 hour
                      
                      if (classInfo.subjectName) {
                        uniqueSubjects.add(classInfo.subjectName);
                      } else if (classInfo.subjectCode) {
                        uniqueSubjects.add(classInfo.subjectCode);
                      }
                    }
                  });
                } else if (typeof slotData === 'object') {
                  // For main routine with single slot objects
                  totalClasses++;
                  totalHours += 1; // Assuming each slot is 1 hour
                  
                  if (slotData.subjectName) {
                    uniqueSubjects.add(slotData.subjectName);
                  } else if (slotData.subjectCode) {
                    uniqueSubjects.add(slotData.subjectCode);
                  }
                }
              }
            });
          }
        }
      });
    } catch (error) {
      console.error('Error calculating filtered routine statistics:', error);
    }

    // Calculate how many classes were filtered out
    const originalStats = calculateOriginalStats(routineData);

    return {
      totalClasses,
      uniqueSubjects: uniqueSubjects.size,
      busyDays: busyDays.size,
      totalHours,
      semesterGroup,
      filteredFromTotal: originalStats.totalClasses - totalClasses
    };
  }, [filteredRoutine, semesterGroup]);

  return {
    filteredRoutine,
    stats,
    semesterGroup,
    isFiltered: semesterGroup !== 'all'
  };
};

// Helper function to calculate original stats
const calculateOriginalStats = (routineData) => {
  if (!routineData?.routine) {
    return { totalClasses: 0, uniqueSubjects: 0, busyDays: 0, totalHours: 0 };
  }

  let totalClasses = 0;
  const uniqueSubjects = new Set();
  const busyDays = new Set();
  let totalHours = 0;

  try {
    Object.entries(routineData.routine).forEach(([dayIndex, daySlots]) => {
      if (daySlots && typeof daySlots === 'object') {
        const slotsForDay = Object.keys(daySlots);
        
        if (slotsForDay.length > 0) {
          busyDays.add(parseInt(dayIndex));
          
          Object.entries(daySlots).forEach(([slotIndex, slotData]) => {
            if (slotData) {
              // Handle both single slot objects and arrays of slots
              if (Array.isArray(slotData)) {
                // For teacher/room routines with arrays of slots
                slotData.forEach(classInfo => {
                  if (classInfo && typeof classInfo === 'object') {
                    totalClasses++;
                    totalHours += 1;
                    
                    if (classInfo.subjectName) {
                      uniqueSubjects.add(classInfo.subjectName);
                    } else if (classInfo.subjectCode) {
                      uniqueSubjects.add(classInfo.subjectCode);
                    }
                  }
                });
              } else if (typeof slotData === 'object') {
                // For main routine with single slot objects
                totalClasses++;
                totalHours += 1;
                
                if (slotData.subjectName) {
                  uniqueSubjects.add(slotData.subjectName);
                } else if (slotData.subjectCode) {
                  uniqueSubjects.add(slotData.subjectCode);
                }
              }
            }
          });
        }
      }
    });
  } catch (error) {
    console.error('Error calculating original routine statistics:', error);
  }

  return {
    totalClasses,
    uniqueSubjects: uniqueSubjects.size,
    busyDays: busyDays.size,
    totalHours
  };
};
