// TimeSlot Management Utility
// This module provides centralized logic for handling time slot IDs, mapping, and matching

/**
 * Normalize time slot ID to ensure consistent string representation
 * @param {string|number} id - The time slot ID
 * @returns {string} Normalized string ID
 */
export const normalizeTimeSlotId = (id) => {
  if (id === null || id === undefined) return '';
  return String(id);
};

/**
 * Create a time slot lookup map for fast access
 * @param {Array} timeSlots - Array of time slot objects
 * @returns {Map} Map with normalized ID as key and time slot object as value
 */
export const createTimeSlotMap = (timeSlots) => {
  const map = new Map();
  if (!Array.isArray(timeSlots)) return map;
  
  timeSlots.forEach(slot => {
    if (slot && slot._id !== undefined) {
      const normalizedId = normalizeTimeSlotId(slot._id);
      map.set(normalizedId, slot);
    }
  });
  
  return map;
};

/**
 * Find time slot by ID using normalized comparison
 * @param {Array} timeSlots - Array of time slot objects
 * @param {string|number} targetId - The ID to search for
 * @returns {Object|null} Found time slot or null
 */
export const findTimeSlotById = (timeSlots, targetId) => {
  if (!Array.isArray(timeSlots) || targetId === null || targetId === undefined) {
    return null;
  }
  
  const normalizedTargetId = normalizeTimeSlotId(targetId);
  return timeSlots.find(slot => {
    return slot && normalizeTimeSlotId(slot._id) === normalizedTargetId;
  }) || null;
};

/**
 * Get the position index of a time slot in the array - SIMPLIFIED VERSION
 * @param {Array} timeSlots - Array of time slot objects
 * @param {string|number} slotIdentifier - The identifier to find
 * @returns {number} Position index in the array or -1 if not found
 */
export const getTimeSlotPositionIndex = (timeSlots, slotIdentifier) => {
  if (!Array.isArray(timeSlots) || timeSlots.length === 0) return -1;
  
  // If it's already a valid array index, return it
  if (typeof slotIdentifier === 'number' && 
      slotIdentifier >= 0 && 
      slotIdentifier < timeSlots.length) {
    return slotIdentifier;
  }
  
  // Convert to string for comparison
  const idStr = String(slotIdentifier);
  
  // Try to find by array position first (most reliable)
  for (let i = 0; i < timeSlots.length; i++) {
    const slot = timeSlots[i];
    if (!slot) continue;
    
    // Match by exact ID
    if (String(slot._id) === idStr) {
      return i;
    }
    
    // Match by exact time range
    const timeRange = `${slot.startTime}-${slot.endTime}`;
    if (timeRange === idStr) {
      return i;
    }
    
    // Match by array index as string
    if (String(i) === idStr) {
      return i;
    }
  }
  
  return -1; // Not found
};

/**
 * Create routine grid structure with normalized slot IDs
 * @param {Array} timeSlots - Array of time slot objects
 * @param {number} dayCount - Number of days (default 7)
 * @returns {Object} Grid structure with normalized slot IDs as keys
 */
export const createRoutineGrid = (timeSlots, dayCount = 7) => {
  const grid = {};
  
  for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
    grid[dayIndex] = {};
    
    if (Array.isArray(timeSlots)) {
      timeSlots.forEach(slot => {
        if (slot && slot._id !== undefined) {
          const normalizedId = normalizeTimeSlotId(slot._id);
          grid[dayIndex][normalizedId] = null;
        }
      });
    }
  }
  
  return grid;
};

/**
 * Populate routine grid with class data using normalized slot IDs
 * @param {Object} grid - Empty grid structure
 * @param {Object} routineData - Routine data from API
 * @returns {Object} Populated grid with class data
 */
export const populateRoutineGrid = (grid, routineData) => {
  if (!grid || !routineData) return grid;
  
  const populatedGrid = JSON.parse(JSON.stringify(grid)); // Deep copy
  
  Object.keys(routineData).forEach(dayIndex => {
    const dayData = routineData[dayIndex];
    if (dayData && typeof dayData === 'object') {
      Object.keys(dayData).forEach(slotIndex => {
        const classData = dayData[slotIndex];
        if (classData && populatedGrid[dayIndex]) {
          const normalizedSlotId = normalizeTimeSlotId(slotIndex);
          if (populatedGrid[dayIndex].hasOwnProperty(normalizedSlotId)) {
            populatedGrid[dayIndex][normalizedSlotId] = classData;
          }
        }
      });
    }
  });
  
  return populatedGrid;
};

/**
 * Get class data for a specific day and time slot
 * @param {Object} routineGrid - The routine grid
 * @param {number} dayIndex - Day index (0-6)
 * @param {string|number} slotId - Time slot ID
 * @returns {Object|null} Class data or null
 */
export const getClassData = (routineGrid, dayIndex, slotId) => {
  if (!routineGrid || dayIndex === null || dayIndex === undefined) {
    return null;
  }
  
  const normalizedSlotId = normalizeTimeSlotId(slotId);
  return routineGrid[dayIndex]?.[normalizedSlotId] || null;
};

/**
 * Set class data for a specific day and time slot
 * @param {Object} routineGrid - The routine grid (will be mutated)
 * @param {number} dayIndex - Day index (0-6)
 * @param {string|number} slotId - Time slot ID
 * @param {Object} classData - Class data to set
 * @returns {boolean} Success status
 */
export const setClassData = (routineGrid, dayIndex, slotId, classData) => {
  if (!routineGrid || dayIndex === null || dayIndex === undefined) {
    return false;
  }
  
  const normalizedSlotId = normalizeTimeSlotId(slotId);
  if (routineGrid[dayIndex] && routineGrid[dayIndex].hasOwnProperty(normalizedSlotId)) {
    routineGrid[dayIndex][normalizedSlotId] = classData;
    return true;
  }
  
  return false;
};

/**
 * Validate time slot ID exists in the time slots array
 * @param {Array} timeSlots - Array of time slot objects
 * @param {string|number} slotId - Time slot ID to validate
 * @returns {boolean} True if valid, false otherwise
 */
export const isValidTimeSlotId = (timeSlots, slotId) => {
  return findTimeSlotById(timeSlots, slotId) !== null;
};

/**
 * Get all available time slot IDs in normalized format
 * @param {Array} timeSlots - Array of time slot objects
 * @returns {Array} Array of normalized time slot IDs
 */
export const getTimeSlotIds = (timeSlots) => {
  if (!Array.isArray(timeSlots)) return [];
  
  return timeSlots
    .filter(slot => slot && slot._id !== undefined)
    .map(slot => normalizeTimeSlotId(slot._id));
};

/**
 * Debug helper to log time slot mapping information
 * @param {Array} timeSlots - Array of time slot objects
 * @param {string} context - Context description for logging
 */
export const debugTimeSlotMapping = (timeSlots, context = '') => {
  if (!Array.isArray(timeSlots)) {
    console.log(`[TimeSlot Debug${context ? ' - ' + context : ''}] Invalid timeSlots array`);
    return;
  }
  
  console.log(`[TimeSlot Debug${context ? ' - ' + context : ''}] Time slots mapping:`);
  timeSlots.forEach((slot, index) => {
    if (slot) {
      console.log(`  ${index}: ID=${slot._id} (${typeof slot._id}) -> Normalized=${normalizeTimeSlotId(slot._id)} | ${slot.startTime}-${slot.endTime} | ${slot.label}`);
    }
  });
};

/**
 * Map Excel slot index to internal slot ID (Excel uses 1-based indexing)
 * @param {Array} timeSlots - Array of time slot objects
 * @param {number} excelSlotIndex - Excel slot index (1-based)
 * @returns {string} Normalized internal slot ID
 */
export const mapExcelToInternalSlot = (timeSlots, excelSlotIndex) => {
  if (!Array.isArray(timeSlots)) {
    console.warn('mapExcelToInternalSlot: Invalid timeSlots array');
    return normalizeTimeSlotId(excelSlotIndex);
  }
  
  // Excel uses 1-based indexing, convert to 0-based for array access
  const arrayIndex = excelSlotIndex - 1;
  if (arrayIndex >= 0 && arrayIndex < timeSlots.length) {
    return normalizeTimeSlotId(timeSlots[arrayIndex]._id);
  }
  
  console.warn(`mapExcelToInternalSlot: Invalid Excel slot index ${excelSlotIndex}, timeSlots length: ${timeSlots.length}`);
  return normalizeTimeSlotId(excelSlotIndex);
};

/**
 * Map internal slot ID to Excel slot index (Excel uses 1-based indexing)
 * @param {Array} timeSlots - Array of time slot objects
 * @param {string|number} internalSlotId - Internal slot ID
 * @returns {number} Excel slot index (1-based)
 */
export const mapInternalToExcelSlot = (timeSlots, internalSlotId) => {
  if (!Array.isArray(timeSlots)) {
    console.warn('mapInternalToExcelSlot: Invalid timeSlots array');
    return parseInt(normalizeTimeSlotId(internalSlotId)) || 1;
  }
  
  const normalizedId = normalizeTimeSlotId(internalSlotId);
  const slotIndex = timeSlots.findIndex(
    slot => normalizeTimeSlotId(slot._id) === normalizedId
  );
  
  if (slotIndex === -1) {
    console.warn(`mapInternalToExcelSlot: Internal slot ID ${internalSlotId} not found in timeSlots`);
    return parseInt(normalizedId) || 1;
  }
  
  return slotIndex + 1; // Convert to 1-based for Excel
};

/**
 * Validate slot position consistency between internal representation and Excel
 * @param {Array} timeSlots - Array of time slot objects
 * @returns {Object} Validation result with details
 */
export const validateSlotPositions = (timeSlots) => {
  if (!Array.isArray(timeSlots)) {
    return { 
      isValid: false, 
      errors: ['Invalid timeSlots array'] 
    };
  }
  
  const errors = [];
  const warnings = [];
  
  timeSlots.forEach((slot, arrayIndex) => {
    if (!slot) {
      errors.push(`Slot at index ${arrayIndex} is null or undefined`);
      return;
    }
    
    if (slot._id === null || slot._id === undefined) {
      errors.push(`Slot at index ${arrayIndex} has null/undefined _id`);
      return;
    }
    
    const expectedExcelPos = arrayIndex + 1; // Excel is 1-based
    const actualExcelPos = mapInternalToExcelSlot(timeSlots, slot._id);
    
    if (expectedExcelPos !== actualExcelPos) {
      errors.push(`Slot ${slot._id}: Expected Excel position ${expectedExcelPos}, got ${actualExcelPos}`);
    }
    
    // Test roundtrip consistency
    const backToInternal = mapExcelToInternalSlot(timeSlots, actualExcelPos);
    const normalizedOriginal = normalizeTimeSlotId(slot._id);
    
    if (normalizedOriginal !== backToInternal) {
      errors.push(`Slot ${slot._id}: Roundtrip failed - ${normalizedOriginal} -> Excel:${actualExcelPos} -> ${backToInternal}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalSlots: timeSlots.length
  };
};

/**
 * Enhanced routine grid population with validation and error handling
 * @param {Object} grid - Empty grid structure
 * @param {Object} routineData - Routine data from API/Excel
 * @param {Array} timeSlots - Array of time slot objects for validation
 * @returns {Object} Populated grid with validation results
 */
export const populateRoutineGridEnhanced = (grid, routineData, timeSlots = null) => {
  if (!grid || !routineData) {
    return { 
      grid: grid || {}, 
      errors: ['Invalid grid or routine data'], 
      warnings: [] 
    };
  }
  
  const populatedGrid = JSON.parse(JSON.stringify(grid)); // Deep copy
  const errors = [];
  const warnings = [];
  
  Object.keys(routineData).forEach(dayIndex => {
    const dayData = routineData[dayIndex];
    if (dayData && typeof dayData === 'object') {
      Object.keys(dayData).forEach(slotIndex => {
        const classData = dayData[slotIndex];
        if (classData && populatedGrid[dayIndex]) {
          const normalizedSlotId = normalizeTimeSlotId(slotIndex);
          
          if (populatedGrid[dayIndex].hasOwnProperty(normalizedSlotId)) {
            populatedGrid[dayIndex][normalizedSlotId] = classData;
          } else {
            errors.push(`Day ${dayIndex}, Slot ${slotIndex}: Slot ID not found in grid structure`);
            
            // Check if it's an Excel position mapping issue
            if (timeSlots && Array.isArray(timeSlots)) {
              const possibleExcelIndex = parseInt(slotIndex);
              if (!isNaN(possibleExcelIndex) && possibleExcelIndex >= 1 && possibleExcelIndex <= timeSlots.length) {
                const correctedSlotId = mapExcelToInternalSlot(timeSlots, possibleExcelIndex);
                if (populatedGrid[dayIndex].hasOwnProperty(correctedSlotId)) {
                  populatedGrid[dayIndex][correctedSlotId] = classData;
                  warnings.push(`Day ${dayIndex}, Slot ${slotIndex}: Auto-corrected using Excel mapping to slot ${correctedSlotId}`);
                }
              }
            }
          }
        }
      });
    }
  });
  
  return {
    grid: populatedGrid,
    errors,
    warnings
  };
};

export default {
  normalizeTimeSlotId,
  createTimeSlotMap,
  findTimeSlotById,
  createRoutineGrid,
  populateRoutineGrid,
  populateRoutineGridEnhanced,
  getClassData,
  setClassData,
  isValidTimeSlotId,
  getTimeSlotIds,
  debugTimeSlotMapping,
  mapExcelToInternalSlot,
  mapInternalToExcelSlot,
  validateSlotPositions
};
