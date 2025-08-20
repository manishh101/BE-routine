/**
 * Semester Group Utility Functions
 * 
 * This module provides utilities for mapping semesters to groups using a custom logic:
 * - Odd semester group: [2, 4, 5, 7]
 * - Even semester group: [1, 3, 6, 8]
 * 
 * The transformation is done by adding 1 to semesters 1-4 before applying the odd/even logic.
 */

/**
 * Transform semester number for grouping calculation
 * @param {number} semester - Original semester number (1-8)
 * @returns {number} - Transformed semester number for group calculation
 */
function transformSemesterForGrouping(semester) {
  // Semesters 1,2,3,4 need transformation to achieve desired grouping
  // 1,3 should become even (add 1): 1→2, 3→4
  // 2,4 should become odd (add 1): 2→3, 4→5
  // 5,6,7,8 stay as they are
  
  if (semester <= 4) {
    return semester + 1;
  }
  return semester;
}

/**
 * Check if a semester belongs to the odd semester group
 * @param {number} semester - Semester number (1-8)
 * @returns {boolean} - True if semester belongs to odd group [2, 4, 5, 7]
 */
function isOddSemesterGroup(semester) {
  const transformedSemester = transformSemesterForGrouping(semester);
  return transformedSemester % 2 === 1;
}

/**
 * Check if a semester belongs to the even semester group
 * @param {number} semester - Semester number (1-8)
 * @returns {boolean} - True if semester belongs to even group [1, 3, 6, 8]
 */
function isEvenSemesterGroup(semester) {
  const transformedSemester = transformSemesterForGrouping(semester);
  return transformedSemester % 2 === 0;
}

/**
 * Get semester group name ('odd' or 'even') for a given semester
 * @param {number} semester - Semester number (1-8)
 * @returns {string} - 'odd' or 'even'
 */
function getSemesterGroupName(semester) {
  return isOddSemesterGroup(semester) ? 'odd' : 'even';
}

/**
 * Get all semesters that belong to a specific group
 * @param {string} groupName - 'odd' or 'even'
 * @returns {number[]} - Array of semester numbers
 */
function getSemestersForGroup(groupName) {
  if (groupName === 'odd') {
    return [2, 4, 5, 7];
  } else if (groupName === 'even') {
    return [1, 3, 6, 8];
  }
  return [1, 2, 3, 4, 5, 6, 7, 8]; // Return all if invalid group name
}

module.exports = {
  transformSemesterForGrouping,
  isOddSemesterGroup,
  isEvenSemesterGroup,
  getSemesterGroupName,
  getSemestersForGroup
};
