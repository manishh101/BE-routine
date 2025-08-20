/**
 * Shared Routine Data Processing Logic
 * Used by both API responses and PDF generation to ensure consistency
 */

/**
 * Process routine slots into frontend-compatible format
 * This ensures PDF and frontend see exactly the same data structure
 */
const processRoutineSlots = (routineSlots, options = {}) => {
  const { viewMode = 'class', teacherId = null, roomId = null } = options;
  
  // Group by days and slots for easier consumption
  const routine = {};
  for (let day = 0; day <= 6; day++) {
    routine[day] = {};
  }

  routineSlots.forEach(slot => {
    if (!routine[slot.dayIndex]) {
      routine[slot.dayIndex] = {};
    }
    
    const slotData = formatSlotData(slot, viewMode, { teacherId, roomId });
    
    // Handle multiple lab groups in the same time slot
    if (routine[slot.dayIndex][slot.slotIndex]) {
      // If slot already exists, convert to array or add to existing array
      const existing = routine[slot.dayIndex][slot.slotIndex];
      
      if (Array.isArray(existing)) {
        // Already an array, add new slot
        existing.push(slotData);
      } else {
        // Convert single slot to array with both slots
        routine[slot.dayIndex][slot.slotIndex] = [existing, slotData];
      }
    } else {
      // First slot for this time - store directly
      routine[slot.dayIndex][slot.slotIndex] = slotData;
    }
  });

  return routine;
};

/**
 * Format individual slot data consistently
 */
const formatSlotData = (slot, viewMode, options = {}) => {
  const { teacherId, roomId } = options;
  
  return {
    _id: slot._id,
    subjectId: slot.subjectId?._id,
    subjectName: slot.subjectName_display || slot.subjectId?.name,
    subjectCode: slot.subjectCode_display || slot.subjectId?.code,
    
    // Handle multiple subjects for elective classes
    subjectIds: slot.subjectIds?.map(s => s._id) || [],
    subjects: slot.subjectIds?.map(s => ({
      id: s._id,
      code: s.code,
      name: s.name
    })) || [],
    
    teacherIds: slot.teacherIds,
    teacherNames: slot.teacherIds.map(t => t.fullName),
    teacherShortNames: slot.teacherShortNames_display || slot.teacherIds.map(t => 
      t.shortName || t.fullName.split(' ').map(n => n[0]).join('.')
    ),
    
    roomId: slot.roomId?._id,
    roomName: slot.roomName_display || slot.roomId?.name,
    classType: slot.classType,
    notes: slot.notes,
    timeSlot_display: slot.timeSlot_display,
    
    // Multi-period spanning information
    spanId: slot.spanId,
    spanMaster: slot.spanMaster,
    
    // Lab group information
    labGroup: slot.labGroup,
    isAlternativeWeek: slot.isAlternativeWeek,
    alternateGroupData: slot.alternateGroupData,
    
    // Elective information
    isElectiveClass: slot.isElectiveClass || false,
    classCategory: slot.classCategory || 'CORE',
    electiveInfo: slot.electiveInfo || null,
    electiveLabel: slot.isElectiveClass ? (
      slot.electiveInfo?.electiveNumber ? 
        `Elective ${slot.electiveInfo.electiveNumber}` : 
        'Elective'
    ) : null,
    
    // Enhanced display for multiple electives
    isMultipleElectives: slot.isElectiveClass && slot.subjectIds?.length > 1,
    electiveCount: slot.isElectiveClass ? (slot.subjectIds?.length || 1) : 0,
    
    // View-specific data
    ...(viewMode === 'teacher' && {
      programCode: slot.programCode,
      semester: slot.semester,
      section: slot.section,
      programSemesterSection: `${slot.programCode} Sem${slot.semester} ${slot.section}`,
      hideTeacher: true  // Don't show teacher in their own schedule
    }),
    
    ...(viewMode === 'room' && {
      programCode: slot.programCode,
      semester: slot.semester,
      section: slot.section,
      programSemesterSection: `${slot.programCode} Sem${slot.semester} ${slot.section}`,
      hideRoom: true  // Don't show room in room schedule
    })
  };
};

/**
 * Process multi-group classes for display
 * Combines Group A and Group B into a single multi-group class with enhanced separation
 */
const processMultiGroupClasses = (routine) => {
  const processed = {};
  
  Object.keys(routine).forEach(dayIndex => {
    processed[dayIndex] = {};
    const dayData = routine[dayIndex];
    
    Object.keys(dayData).forEach(slotIndex => {
      const slotData = dayData[slotIndex];
      
      if (Array.isArray(slotData) && slotData.length > 1) {
        // Multi-group class - combine groups with enhanced labeling
        // Sort groups by labGroup to ensure consistent A, B ordering
        const sortedGroups = slotData.sort((a, b) => {
          const groupA = a.labGroup || '';
          const groupB = b.labGroup || '';
          return groupA.localeCompare(groupB);
        });
        
        // Enhanced group processing with better labels
        const enhancedGroups = sortedGroups.map(group => ({
          ...group,
          // Ensure lab group label is properly formatted for PDF display
          labGroupLabel: group.labGroup ? `Group ${group.labGroup}` : 'Group',
          // Add section-aware display name for better identification
          displayName: `${group.subjectName || group.subjectCode} (Group ${group.labGroup || '?'})`
        }));
        
        processed[dayIndex][slotIndex] = {
          isMultiGroup: true,
          groups: enhancedGroups,
          // Use combined subject names for main properties to show both subjects
          subjectName: enhancedGroups.map(g => g.subjectName || g.subjectCode).join(' / '),
          subjectCode: enhancedGroups.map(g => g.subjectCode).join(' / '),
          classType: enhancedGroups[0].classType,
          isElectiveClass: enhancedGroups.some(g => g.isElectiveClass),
          electiveLabel: enhancedGroups.find(g => g.electiveLabel)?.electiveLabel,
          spanId: enhancedGroups[0].spanId,
          spanMaster: enhancedGroups[0].spanMaster,
          // Enhanced combined data with proper separation
          teacherNames: enhancedGroups.map(g => g.teacherNames).flat(),
          teacherShortNames: enhancedGroups.map(g => g.teacherShortNames).flat(),
          rooms: enhancedGroups.map(g => g.roomName),
          // Add section information for proper group mapping - dynamic fallback
          section: enhancedGroups[0].section || 'AB' // Keep AB as default for backward compatibility
        };
      } else {
        // Single class or single item from array
        processed[dayIndex][slotIndex] = Array.isArray(slotData) ? slotData[0] : slotData;
      }
    });
  });
  
  return processed;
};

module.exports = {
  processRoutineSlots,
  formatSlotData,
  processMultiGroupClasses
};
