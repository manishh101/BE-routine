/**
 * Robust Cache Invalidation System for Real-time Data Synchronization
 * 
 * This utility provides aggressive cache invalidation to ensure that when classes
 * are assigned in the Program Routine Manager, the changes are immediately reflected
 * in the Teacher Schedule and Room Schedule components.
 * 
 * Strategy:
 * 1. Complete cache removal (not just invalidation)
 * 2. Immediate refetch of all related queries
 * 3. Custom event broadcasting for cross-component communication
 * 4. Fallback mechanisms for edge cases
 */

/**
 * Completely flush all routine-related caches and force fresh data fetch
 * This is the nuclear option - removes all caches and forces fresh data
 */
export const nukeAllRoutineRelatedCaches = async (queryClient) => {
  try {
    console.log('🔥 NUCLEAR CACHE FLUSH: Removing all routine-related caches...');
    
    // 1. Remove all routine-related queries completely
    const routineKeys = [
      'routine',
      'routines', 
      'teacher-schedule',
      'teacher-schedule-from-routine',
      'teacherSchedule',
      'roomSchedule',
      'room-schedule',
      'teachers',
      'rooms',
      'subjects',
      'timeSlots',
      'programs',
      'semesters',
      'sections'
    ];
    
    // Remove all queries with these keys
    for (const key of routineKeys) {
      queryClient.removeQueries([key]);
      queryClient.removeQueries({ queryKey: [key] });
      queryClient.removeQueries({ queryKey: [key], exact: false });
    }
    
    // 2. Clear the entire cache as a fallback
    await queryClient.clear();
    
    // 3. Force immediate refetch of critical queries
    const criticalQueries = [
      ['teachers'],
      ['rooms'],
      ['timeSlots'],
      ['programs']
    ];
    
    for (const queryKey of criticalQueries) {
      try {
        await queryClient.prefetchQuery(queryKey);
      } catch (error) {
        console.warn(`Failed to prefetch ${queryKey.join('.')}: ${error.message}`);
      }
    }
    
    console.log('✅ Nuclear cache flush completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Nuclear cache flush failed:', error);
    return false;
  }
};

/**
 * Invalidate caches after class assignment with specific teacher and room data
 */
export const invalidateAfterClassAssignment = async (queryClient, options = {}) => {
  const {
    programCode,
    semester,
    section,
    teacherIds = [],
    roomId,
    dayIndex,
    slotIndex
  } = options;
  
  try {
    console.log('🔄 ROBUST CACHE INVALIDATION: Starting comprehensive cache invalidation...');
    console.log('Target data:', { programCode, semester, section, teacherIds, roomId, dayIndex, slotIndex });
    
    // 1. Remove specific program routine caches
    if (programCode && semester && section) {
      const programCacheKeys = [
        ['routine', programCode, parseInt(semester), section],
        ['routine', programCode, semester, section],
        ['routines', programCode, parseInt(semester), section],
        ['routines', programCode, semester, section]
      ];
      
      for (const key of programCacheKeys) {
        queryClient.removeQueries(key);
        queryClient.removeQueries({ queryKey: key });
      }
    }
    
    // 2. Remove all teacher schedule caches for affected teachers
    if (teacherIds && teacherIds.length > 0) {
      for (const teacherId of teacherIds) {
        const teacherCacheKeys = [
          ['teacher-schedule-from-routine', teacherId],
          ['teacher-schedule', teacherId],
          ['teacherSchedule', teacherId],
          ['teachers', teacherId, 'schedule']
        ];
        
        for (const key of teacherCacheKeys) {
          queryClient.removeQueries(key);
          queryClient.removeQueries({ queryKey: key });
        }
      }
      
      // Also remove general teacher schedule queries
      queryClient.removeQueries(['teacher-schedule-from-routine']);
      queryClient.removeQueries(['teacherSchedule']);
    }
    
    // 3. Remove all room schedule caches for affected room
    if (roomId) {
      const roomCacheKeys = [
        ['roomSchedule', roomId],
        ['room-schedule', roomId],
        ['rooms', roomId, 'schedule']
      ];
      
      for (const key of roomCacheKeys) {
        queryClient.removeQueries(key);
        queryClient.removeQueries({ queryKey: key });
      }
      
      // Also remove general room schedule queries
      queryClient.removeQueries(['roomSchedule']);
      queryClient.removeQueries(['room-schedule']);
    }
    
    // 4. Remove all general queries that might be affected
    const generalQueries = [
      'teachers',
      'rooms', 
      'routine',
      'routines'
    ];
    
    for (const query of generalQueries) {
      queryClient.removeQueries([query]);
      queryClient.removeQueries({ queryKey: [query] });
    }
    
    // 5. Force immediate refetch of affected queries
    const refetchPromises = [];
    
    // Refetch program routine
    if (programCode && semester && section) {
      refetchPromises.push(
        queryClient.refetchQueries(['routine', programCode, semester, section])
      );
    }
    
    // Refetch teacher schedules
    if (teacherIds && teacherIds.length > 0) {
      for (const teacherId of teacherIds) {
        refetchPromises.push(
          queryClient.refetchQueries(['teacher-schedule-from-routine', teacherId])
        );
      }
    }
    
    // Refetch room schedule
    if (roomId) {
      refetchPromises.push(
        queryClient.refetchQueries(['roomSchedule', roomId])
      );
    }
    
    // Wait for all refetches to complete
    await Promise.allSettled(refetchPromises);
    
    console.log('✅ Robust cache invalidation completed successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Robust cache invalidation failed:', error);
    return false;
  }
};

/**
 * Broadcast real-time change event to all components
 */
export const broadcastRoutineChange = (changeData) => {
  try {
    console.log('📡 Broadcasting routine change event:', changeData);
    
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      // Create custom event with detailed data
      const event = new CustomEvent('routineDataChanged', {
        detail: {
          timestamp: new Date().toISOString(),
          ...changeData
        }
      });
      
      window.dispatchEvent(event);
      
      // Also dispatch a more general event for components that just want to know something changed
      const generalEvent = new CustomEvent('scheduleUpdated', {
        detail: { timestamp: new Date().toISOString() }
      });
      
      window.dispatchEvent(generalEvent);
      
      console.log('✅ Routine change event broadcasted successfully');
      return true;
    } else {
      console.warn('⚠️ Window or dispatchEvent not available, skipping event broadcast');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to broadcast routine change event:', error);
    return false;
  }
};

/**
 * The main function to call after successful class assignment
 * This combines all the strategies above
 */
export const handleClassAssignmentSuccess = async (queryClient, assignmentData) => {
  try {
    console.log('🎯 HANDLING CLASS ASSIGNMENT SUCCESS:', assignmentData);
    
    // Step 1: Robust cache invalidation
    await invalidateAfterClassAssignment(queryClient, assignmentData);
    
    // Step 2: Broadcast change event
    broadcastRoutineChange(assignmentData);
    
    // Step 3: Small delay to ensure UI updates
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Step 4: Nuclear option if needed (can be enabled for debugging)
    const enableNuclearOption = false; // Set to true for debugging
    if (enableNuclearOption) {
      await nukeAllRoutineRelatedCaches(queryClient);
    }
    
    console.log('✅ Class assignment success handling completed');
    return true;
    
  } catch (error) {
    console.error('❌ Class assignment success handling failed:', error);
    return false;
  }
};

/**
 * Hook for components to listen to routine changes
 */
export const useRoutineChangeListener = (queryClient, callback) => {
  const handleRoutineChange = (event) => {
    console.log('🔔 Routine change detected:', event.detail);
    
    // Invalidate queries in the component
    if (queryClient) {
      queryClient.invalidateQueries(['teacher-schedule-from-routine']);
      queryClient.invalidateQueries(['roomSchedule']);
      queryClient.invalidateQueries(['routine']);
    }
    
    // Call the callback if provided
    if (callback && typeof callback === 'function') {
      callback(event.detail);
    }
  };
  
  const handleScheduleUpdate = (event) => {
    console.log('📅 Schedule update detected:', event.detail);
    
    // Force a general refresh
    if (queryClient) {
      queryClient.invalidateQueries();
    }
    
    if (callback && typeof callback === 'function') {
      callback(event.detail);
    }
  };
  
  // Set up listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('routineDataChanged', handleRoutineChange);
    window.addEventListener('scheduleUpdated', handleScheduleUpdate);
    
    // Return cleanup function
    return () => {
      window.removeEventListener('routineDataChanged', handleRoutineChange);
      window.removeEventListener('scheduleUpdated', handleScheduleUpdate);
    };
  }
  
  return () => {}; // No-op cleanup for server-side
};

export default {
  nukeAllRoutineRelatedCaches,
  invalidateAfterClassAssignment,
  broadcastRoutineChange,
  handleClassAssignmentSuccess,
  useRoutineChangeListener
};
