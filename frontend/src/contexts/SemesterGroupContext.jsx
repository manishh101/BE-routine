import React, { createContext, useContext, useState, useMemo } from 'react';

// Create the semester group context
const SemesterGroupContext = createContext();

// Semester group provider component
export const SemesterGroupProvider = ({ children }) => {
  const [semesterGroup, setSemesterGroup] = useState('odd'); // Default to 'odd' instead of 'all'

  const value = useMemo(() => ({
    semesterGroup,
    setSemesterGroup,
    isOddGroup: semesterGroup === 'odd',
    isEvenGroup: semesterGroup === 'even'
  }), [semesterGroup]);

  return (
    <SemesterGroupContext.Provider value={value}>
      {children}
    </SemesterGroupContext.Provider>
  );
};

// Custom hook to use the semester group context
export const useSemesterGroup = () => {
  const context = useContext(SemesterGroupContext);
  if (!context) {
    throw new Error('useSemesterGroup must be used within a SemesterGroupProvider');
  }
  return context;
};

// Helper function to filter routine data based on semester group
export const filterRoutineBySemesterGroup = (routineData, semesterGroup) => {
  console.log('🔍 filterRoutineBySemesterGroup called with:', { semesterGroup, routineData });
  
  if (!routineData?.routine) {
    console.log('❌ No routine data found');
    return routineData;
  }

  const filteredRoutineData = {};
  
  // Initialize with same structure
  for (let day = 0; day <= 6; day++) {
    filteredRoutineData[day] = {};
  }

  let totalOriginalSlots = 0;
  let totalFilteredSlots = 0;

  Object.entries(routineData.routine).forEach(([dayIndex, daySlots]) => {
    if (daySlots && typeof daySlots === 'object') {
      Object.entries(daySlots).forEach(([slotIndex, slotData]) => {
        if (slotData) {
          totalOriginalSlots++;
          
          // Handle both single slot objects and arrays of slots
          if (Array.isArray(slotData)) {
            // For teacher/room routines with arrays of slots
            const filteredSlots = slotData.filter(classInfo => {
              if (classInfo && typeof classInfo === 'object') {
                const semester = parseInt(classInfo.semester);
                const isInGroup = isSemesterInGroup(semester, semesterGroup);
                console.log(`  Slot [${dayIndex}][${slotIndex}] array item: semester=${semester}, group=${semesterGroup}, included=${isInGroup}`);
                return isInGroup;
              }
              return false;
            });
            
            // Only include if there are filtered slots
            if (filteredSlots.length > 0) {
              filteredRoutineData[dayIndex][slotIndex] = filteredSlots;
              totalFilteredSlots++;
            }
          } else if (typeof slotData === 'object') {
            // For main routine with single slot objects
            const semester = parseInt(slotData.semester);
            const isInGroup = isSemesterInGroup(semester, semesterGroup);
            console.log(`  Slot [${dayIndex}][${slotIndex}] object: semester=${semester}, group=${semesterGroup}, included=${isInGroup}`);
            
            if (isInGroup) {
              filteredRoutineData[dayIndex][slotIndex] = slotData;
              totalFilteredSlots++;
            }
          }
        }
      });
    }
  });

  console.log(`📊 Filtering result: ${totalOriginalSlots} → ${totalFilteredSlots} slots for ${semesterGroup} group`);

  return {
    ...routineData,
    routine: filteredRoutineData
  };
};

// Helper function to check if a semester belongs to a group
export const isSemesterInGroup = (semester, semesterGroup) => {
  // Custom semester grouping logic:
  // Odd group: [2, 4, 5, 7]
  // Even group: [1, 3, 6, 8]
  
  // Transform semester for grouping calculation
  let transformedSemester = semester;
  if (semester <= 4) {
    transformedSemester = semester + 1;
  }
  
  if (semesterGroup === 'odd') return transformedSemester % 2 === 1;
  if (semesterGroup === 'even') return transformedSemester % 2 === 0;
  return false;
};

// Helper function to check if a semester is in the even group (1, 3, 6, 8)
export const isEvenSemesterGroup = (semester) => {
  return isSemesterInGroup(semester, 'even');
};

// Helper function to check if a semester is in the odd group (2, 4, 5, 7)
export const isOddSemesterGroup = (semester) => {
  return isSemesterInGroup(semester, 'odd');
};

// Helper function to get semester group label
export const getSemesterGroupLabel = (semesterGroup) => {
  switch (semesterGroup) {
    case 'odd':
      return 'Odd Semester Group (2, 4, 5, 7)';
    case 'even':
      return 'Even Semester Group (1, 3, 6, 8)';
    default:
      return 'Unknown Group';
  }
};
