/**
 * Format time from 24-hour format to 12-hour format
 * @param {string} time - Time in HH:mm format
 * @returns {string} - Time in 12-hour format
 */
export const formatTime12Hour = (time) => {
  if (!time) return '';
  
  const [hours, minutes] = time.split(':');
  const hour12 = parseInt(hours) % 12 || 12;
  const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM';
  
  return `${hour12}:${minutes} ${ampm}`;
};

/**
 * Get day name from day index
 * @param {number} dayIndex - Day index (0-6, Sunday-Saturday)
 * @returns {string} - Day name
 */
export const getDayName = (dayIndex) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayIndex] || '';
};

/**
 * Get short day name from day index
 * @param {number} dayIndex - Day index (0-6, Sunday-Saturday)
 * @returns {string} - Short day name
 */
export const getShortDayName = (dayIndex) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[dayIndex] || '';
};

/**
 * Convert time slots array to time slot map for easy lookup
 * @param {Array} timeSlots - Array of time slot objects
 * @returns {Object} - Map of slot index to time slot data
 */
export const createTimeSlotMap = (timeSlots) => {
  const map = {};
  timeSlots.forEach((slot, index) => {
    map[index] = slot;
  });
  return map;
};

/**
 * Generate time range string from start and end time
 * @param {string} startTime - Start time in HH:mm format
 * @param {string} endTime - End time in HH:mm format
 * @returns {string} - Time range string
 */
export const getTimeRange = (startTime, endTime) => {
  if (!startTime || !endTime) return '';
  return `${startTime} - ${endTime}`;
};

/**
 * Calculate duration between two times
 * @param {string} startTime - Start time in HH:mm format
 * @param {string} endTime - End time in HH:mm format
 * @returns {number} - Duration in minutes
 */
export const calculateDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  
  return endTotalMinutes - startTotalMinutes;
};

/**
 * Check if two time ranges overlap
 * @param {string} start1 - First range start time
 * @param {string} end1 - First range end time
 * @param {string} start2 - Second range start time
 * @param {string} end2 - Second range end time
 * @returns {boolean} - True if ranges overlap
 */
export const timeRangesOverlap = (start1, end1, start2, end2) => {
  const time1Start = new Date(`2000-01-01 ${start1}`);
  const time1End = new Date(`2000-01-01 ${end1}`);
  const time2Start = new Date(`2000-01-01 ${start2}`);
  const time2End = new Date(`2000-01-01 ${end2}`);
  
  return time1Start < time2End && time2Start < time1End;
};

/**
 * Sort time slots by start time
 * @param {Array} timeSlots - Array of time slot objects
 * @returns {Array} - Sorted time slots
 */
export const sortTimeSlots = (timeSlots) => {
  return [...timeSlots].sort((a, b) => {
    const timeA = new Date(`2000-01-01 ${a.startTime}`);
    const timeB = new Date(`2000-01-01 ${b.startTime}`);
    return timeA - timeB;
  });
};

/**
 * Get current time slot index based on current time
 * @param {Array} timeSlots - Array of time slot objects
 * @returns {number|null} - Current slot index or null if no current slot
 */
export const getCurrentTimeSlotIndex = (timeSlots) => {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:mm format
  
  for (let i = 0; i < timeSlots.length; i++) {
    const slot = timeSlots[i];
    if (currentTime >= slot.startTime && currentTime <= slot.endTime) {
      return i;
    }
  }
  
  return null;
};
