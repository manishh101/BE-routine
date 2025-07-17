/**
 * Format class type for display
 * @param {string} classType - Class type code (L, P, T)
 * @returns {string} - Full class type name
 */
export const formatClassType = (classType) => {
  const types = {
    'L': 'Lecture',
    'P': 'Practical',
    'T': 'Tutorial'
  };
  return types[classType] || classType;
};

/**
 * Get color for class type
 * @param {string} classType - Class type code (L, P, T)
 * @returns {string} - Color code
 */
export const getClassTypeColor = (classType) => {
  const colors = {
    'L': 'blue',
    'P': 'green',
    'T': 'orange'
  };
  return colors[classType] || 'default';
};

/**
 * Format semester display
 * @param {number} semester - Semester number
 * @returns {string} - Formatted semester
 */
export const formatSemester = (semester) => {
  return `Semester ${semester}`;
};

/**
 * Format section display
 * @param {string} section - Section code
 * @returns {string} - Formatted section
 */
export const formatSection = (section) => {
  return `Section ${section}`;
};

/**
 * Format program display
 * @param {string} code - Program code
 * @param {string} name - Program name
 * @returns {string} - Formatted program
 */
export const formatProgram = (code, name) => {
  return name ? `${name} (${code})` : code;
};

/**
 * Format teacher display
 * @param {string} fullName - Teacher full name
 * @param {string} shortName - Teacher short name
 * @returns {string} - Formatted teacher
 */
export const formatTeacher = (fullName, shortName) => {
  return shortName ? `${fullName} (${shortName})` : fullName;
};

/**
 * Format room display
 * @param {string} name - Room name
 * @param {string} building - Building name
 * @param {number} capacity - Room capacity
 * @returns {string} - Formatted room
 */
export const formatRoom = (name, building, capacity) => {
  let formatted = name;
  if (building) formatted += ` - ${building}`;
  if (capacity) formatted += ` (Capacity: ${capacity})`;
  return formatted;
};

/**
 * Generate routine grid data structure
 * @param {Object} routineData - Raw routine data from API
 * @param {Array} timeSlots - Time slots array
 * @returns {Object} - Grid data structure
 */
export const generateRoutineGrid = (routineData, timeSlots) => {
  const grid = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  
  // Initialize grid
  dayNames.forEach((_, dayIndex) => {
    grid[dayIndex] = {};
    timeSlots.forEach((_, slotIndex) => {
      grid[dayIndex][slotIndex] = null;
    });
  });
  
  // Populate grid with routine data
  if (routineData && routineData.routine) {
    Object.keys(routineData.routine).forEach(dayIndex => {
      Object.keys(routineData.routine[dayIndex]).forEach(slotIndex => {
        grid[parseInt(dayIndex)][parseInt(slotIndex)] = routineData.routine[dayIndex][slotIndex];
      });
    });
  }
  
  return grid;
};

/**
 * Check if a routine slot is empty
 * @param {Object} slot - Routine slot data
 * @returns {boolean} - True if slot is empty
 */
export const isEmptySlot = (slot) => {
  return !slot || !slot.subjectId;
};

/**
 * Get routine statistics
 * @param {Object} routineData - Raw routine data from API
 * @returns {Object} - Statistics object
 */
export const getRoutineStats = (routineData) => {
  if (!routineData || !routineData.routine) {
    return {
      totalClasses: 0,
      classesByDay: {},
      classesByType: { L: 0, P: 0, T: 0 }
    };
  }
  
  const stats = {
    totalClasses: 0,
    classesByDay: {},
    classesByType: { L: 0, P: 0, T: 0 }
  };
  
  // Initialize days
  for (let day = 0; day <= 5; day++) {
    stats.classesByDay[day] = 0;
  }
  
  // Count classes
  Object.keys(routineData.routine).forEach(dayIndex => {
    const daySlots = routineData.routine[dayIndex];
    const classCount = Object.keys(daySlots).length;
    
    stats.classesByDay[parseInt(dayIndex)] = classCount;
    stats.totalClasses += classCount;
    
    // Count by type
    Object.values(daySlots).forEach(slot => {
      if (slot.classType && stats.classesByType.hasOwnProperty(slot.classType)) {
        stats.classesByType[slot.classType]++;
      }
    });
  });
  
  return stats;
};

/**
 * Validate routine slot data
 * @param {Object} slotData - Slot data to validate
 * @returns {Object} - Validation result
 */
export const validateRoutineSlot = (slotData) => {
  const errors = [];
  
  if (!slotData.subjectId) {
    errors.push('Subject is required');
  }
  
  if (!slotData.teacherIds || slotData.teacherIds.length === 0) {
    errors.push('At least one teacher is required');
  }
  
  if (!slotData.roomId) {
    errors.push('Room is required');
  }
  
  if (!slotData.classType) {
    errors.push('Class type is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
