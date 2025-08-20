/**
 * Time Slot Utilities
 * Provides consistent time slot ordering and fetching across the application
 */

const TimeSlot = require('../models/TimeSlot');

/**
 * Get all time slots sorted chronologically by sortOrder
 * This ensures consistent ordering across frontend and PDF generation
 * @param {Object} filter - Optional filter criteria
 * @returns {Promise<Array>} Array of time slots sorted by sortOrder
 */
const getTimeSlotsSorted = async (filter = {}) => {
  return await TimeSlot.find(filter).sort({ sortOrder: 1 });
};

/**
 * Get time slots for a specific context (program/semester/section)
 * @param {string} programCode - Program code
 * @param {number} semester - Semester number
 * @param {string} section - Section identifier
 * @param {boolean} includeGlobal - Whether to include global time slots
 * @returns {Promise<Array>} Array of time slots sorted by sortOrder
 */
const getTimeSlotsByContext = async (programCode, semester, section, includeGlobal = true) => {
  const filters = [];
  
  // Always include global time slots unless explicitly excluded
  if (includeGlobal) {
    filters.push({ 
      $or: [
        { isGlobal: true },
        { isGlobal: { $exists: false } }, // Legacy time slots without isGlobal field
        { isGlobal: null }
      ]
    });
  }
  
  // Add context-specific time slots if context is provided
  if (programCode || semester || section) {
    const contextFilter = { isGlobal: false };
    
    if (programCode) contextFilter.programCode = programCode;
    if (semester) contextFilter.semester = parseInt(semester);
    if (section) contextFilter.section = section.toUpperCase();
    
    filters.push(contextFilter);
  }
  
  // Build the main filter
  const mainFilter = filters.length > 1 ? { $or: filters } : (filters[0] || {});
  
  return await TimeSlot.find(mainFilter).sort({ sortOrder: 1 });
};

/**
 * Create a time slot map for quick lookup by slotIndex
 * @param {Array} timeSlots - Array of time slots
 * @returns {Map} Map with slotIndex (TimeSlot._id) as key and timeSlot as value
 */
const createTimeSlotMap = (timeSlots) => {
  const timeSlotMap = new Map();
  timeSlots.forEach((slot) => {
    timeSlotMap.set(slot._id, slot);
  });
  return timeSlotMap;
};

/**
 * Reorder all time slots chronologically based on start time
 * Updates sortOrder to match chronological order
 * @returns {Promise<Object>} Result with count of reordered slots
 */
const reorderTimeSlots = async () => {
  try {
    // Get all time slots and sort by start time
    const timeSlots = await TimeSlot.find().sort({ startTime: 1 });
    
    // Update sortOrder to match chronological order
    for (let i = 0; i < timeSlots.length; i++) {
      await TimeSlot.findByIdAndUpdate(
        timeSlots[i]._id,
        { sortOrder: i + 1 },
        { new: true }
      );
    }
    
    return {
      success: true,
      message: `Successfully reordered ${timeSlots.length} time slots chronologically`,
      count: timeSlots.length
    };
  } catch (error) {
    throw new Error(`Error reordering time slots: ${error.message}`);
  }
};

/**
 * Convert time string to minutes for comparison
 * @param {string} timeStr - Time in HH:MM format
 * @returns {number} Time in minutes
 */
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Find the correct insert position for a new time slot based on start time
 * @param {string} newStartTime - Start time of new time slot
 * @param {Array} existingSlots - Existing time slots sorted by sortOrder
 * @returns {number} Position where new time slot should be inserted
 */
const findInsertPosition = (newStartTime, existingSlots) => {
  const newStartMinutes = timeToMinutes(newStartTime);
  
  let insertPosition = 1;
  let foundPosition = false;
  
  for (let i = 0; i < existingSlots.length; i++) {
    const existingStartMinutes = timeToMinutes(existingSlots[i].startTime);
    
    if (newStartMinutes < existingStartMinutes) {
      // New slot should be inserted before this existing slot
      insertPosition = existingSlots[i].sortOrder;
      foundPosition = true;
      break;
    }
  }
  
  if (!foundPosition) {
    // New slot should be added at the end
    const lastSlot = existingSlots[existingSlots.length - 1];
    insertPosition = lastSlot ? lastSlot.sortOrder + 1 : 1;
  }
  
  return { insertPosition, foundPosition };
};

module.exports = {
  getTimeSlotsSorted,
  getTimeSlotsByContext,
  createTimeSlotMap,
  reorderTimeSlots,
  timeToMinutes,
  findInsertPosition
};
