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

import { useEffect, useRef } from 'react';

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
    
    // Remove all queries with these keys using correct React Query v5 API
    for (const key of routineKeys) {
      queryClient.removeQueries({ queryKey: [key] });
    }
    
    // 2. Invalidate everything to trigger refetches for active queries
    await queryClient.invalidateQueries();
    
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
      queryClient.removeQueries({ queryKey: ['routine', programCode, parseInt(semester), section] });
      queryClient.removeQueries({ queryKey: ['routine', programCode, semester, section] });
    }
    
    // 2. Remove all teacher schedule caches for affected teachers
    if (teacherIds && teacherIds.length > 0) {
      for (const teacherId of teacherIds) {
        queryClient.removeQueries({ queryKey: ['teacher-schedule-from-routine', teacherId] });
      }
    }
    // Also remove all teacher schedule queries (any teacher might be affected by reassignment)
    queryClient.removeQueries({ queryKey: ['teacher-schedule-from-routine'] });
    queryClient.removeQueries({ queryKey: ['teacherSchedule'] });
    
    // 3. Remove all room schedule caches for affected room
    if (roomId) {
      queryClient.removeQueries({ queryKey: ['roomSchedule', roomId] });
    }
    // Also remove all room schedule queries (room reassignment affects old and new room)
    queryClient.removeQueries({ queryKey: ['roomSchedule'] });
    
    // 4. Force immediate refetch of affected active queries
    const refetchPromises = [];
    
    // Refetch program routine
    if (programCode && semester && section) {
      refetchPromises.push(
        queryClient.refetchQueries({ queryKey: ['routine', programCode, semester, section] })
      );
    }
    
    // Refetch all active teacher schedules
    refetchPromises.push(
      queryClient.refetchQueries({ queryKey: ['teacher-schedule-from-routine'] })
    );
    
    // Refetch all active room schedules
    refetchPromises.push(
      queryClient.refetchQueries({ queryKey: ['roomSchedule'] })
    );
    
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
    console.log(' Broadcasting routine change event:', changeData);
    
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
    console.log(' HANDLING CLASS ASSIGNMENT SUCCESS:', assignmentData);
    
    // Step 1: Robust cache invalidation
    await invalidateAfterClassAssignment(queryClient, assignmentData);
    
    // Step 2: Broadcast change event to all listening components
    broadcastRoutineChange(assignmentData);
    
    // Step 3: Small delay to ensure UI updates
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Step 4: Nuclear cache flush to guarantee fresh data across all views
    await nukeAllRoutineRelatedCaches(queryClient);
    
    console.log('✅ Class assignment success handling completed');
    return true;
    
  } catch (error) {
    console.error('❌ Class assignment success handling failed:', error);
    return false;
  }
};

/**
 * Hook for components to listen to routine changes
 * Properly implemented as a React hook with useEffect for cleanup
 */

export const useRoutineChangeListener = (queryClient, callback) => {
  const callbackRef = useRef(callback);
  const queryClientRef = useRef(queryClient);
  
  // Keep refs up to date
  useEffect(() => {
    callbackRef.current = callback;
    queryClientRef.current = queryClient;
  }, [callback, queryClient]);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleRoutineChange = (event) => {
      console.log(' Routine change detected:', event.detail);
      
      // Invalidate all schedule-related queries immediately
      if (queryClientRef.current) {
        // Invalidate teacher schedules
        queryClientRef.current.invalidateQueries({ queryKey: ['teacher-schedule-from-routine'] });
        queryClientRef.current.invalidateQueries({ queryKey: ['teacherSchedule'] });
        // Invalidate room schedules
        queryClientRef.current.invalidateQueries({ queryKey: ['roomSchedule'] });
        queryClientRef.current.invalidateQueries({ queryKey: ['room-schedule'] });
        // Invalidate routine data
        queryClientRef.current.invalidateQueries({ queryKey: ['routine'] });
      }
      
      // Call the callback if provided
      if (callbackRef.current && typeof callbackRef.current === 'function') {
        callbackRef.current(event.detail);
      }
    };
    
    const handleScheduleUpdate = (event) => {
      console.log(' Schedule update detected:', event.detail);
      
      // Force a general refresh of all schedule queries
      if (queryClientRef.current) {
        queryClientRef.current.invalidateQueries({ queryKey: ['teacher-schedule-from-routine'] });
        queryClientRef.current.invalidateQueries({ queryKey: ['roomSchedule'] });
        queryClientRef.current.invalidateQueries({ queryKey: ['routine'] });
      }
      
      if (callbackRef.current && typeof callbackRef.current === 'function') {
        callbackRef.current(event.detail);
      }
    };
    
    window.addEventListener('routineDataChanged', handleRoutineChange);
    window.addEventListener('scheduleUpdated', handleScheduleUpdate);
    
    return () => {
      window.removeEventListener('routineDataChanged', handleRoutineChange);
      window.removeEventListener('scheduleUpdated', handleScheduleUpdate);
    };
  }, []); // Empty deps - refs handle the updates
};

export default {
  nukeAllRoutineRelatedCaches,
  invalidateAfterClassAssignment,
  broadcastRoutineChange,
  handleClassAssignmentSuccess,
  useRoutineChangeListener
};
