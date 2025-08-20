/**
 * Centralized Cache Invalidation Utility for Real-time Data Synchronization
 * 
 * This utility provides a consistent way to invalidate React Query caches
 * when routine data changes, ensuring all schedule viewers are synchronized.
 * 
 * CRITICAL: This fixes the data synchronization issue where changes in the
 * routine manager were not reflected in teacher and room schedule viewers.
 */

import React, { useCallback, useEffect } from 'react';

/**
 * Invalidate all routine-related caches across the application
 * @param {QueryClient} queryClient - React Query client instance
 * @param {Object} options - Additional options for cache invalidation
 */
export const invalidateAllRoutineRelatedCaches = async (queryClient, options = {}) => {
  console.log('🔄 [CacheInvalidation] Starting comprehensive cache invalidation...');
  
  const { programCode, semester, section, affectedTeachers = [], affectedRooms = [] } = options;
  
  try {
    // Collect all invalidation promises
    const invalidationPromises = [
      // 1. ROUTINE-RELATED QUERIES
      queryClient.invalidateQueries(['routine']),
      queryClient.invalidateQueries(['routines']),
      queryClient.invalidateQueries(['routineData']),
      queryClient.invalidateQueries(['programRoutines']),
      
      // 2. TEACHER SCHEDULE QUERIES (ALL POSSIBLE KEYS)
      queryClient.invalidateQueries(['teachers']),
      queryClient.invalidateQueries(['teacherSchedule']),
      queryClient.invalidateQueries(['teacherSchedules']),
      queryClient.invalidateQueries(['teacher-schedule-from-routine']), // CRITICAL FIX
      queryClient.invalidateQueries(['teacherAvailability']),
      queryClient.invalidateQueries(['teacherWorkload']),
      queryClient.invalidateQueries(['teacherConflicts']),
      
      // 3. ROOM SCHEDULE QUERIES (ALL POSSIBLE KEYS)
      queryClient.invalidateQueries(['rooms']),
      queryClient.invalidateQueries(['roomSchedule']),
      queryClient.invalidateQueries(['roomAvailability']),
      queryClient.invalidateQueries(['roomConflicts']),
      queryClient.invalidateQueries(['vacantRooms']),
      
      // 4. SUBJECT-RELATED QUERIES
      queryClient.invalidateQueries(['subjects']),
      queryClient.invalidateQueries(['subjectSchedule']),
      queryClient.invalidateQueries(['availableSubjects']),
      
      // 5. CONFLICT DETECTION QUERIES
      queryClient.invalidateQueries(['conflicts']),
      queryClient.invalidateQueries(['scheduleConflicts']),
      queryClient.invalidateQueries(['timeConflicts']),
      
      // 6. ANALYTICS AND REPORTS
      queryClient.invalidateQueries(['analytics']),
      queryClient.invalidateQueries(['reports']),
      queryClient.invalidateQueries(['statistics']),
      queryClient.invalidateQueries(['utilization']),
      
      // 7. TIME SLOTS (might be cached)
      queryClient.invalidateQueries(['timeSlots']),
    ];
    
    // 8. SPECIFIC PROGRAM/SEMESTER/SECTION QUERIES
    if (programCode && semester && section) {
      invalidationPromises.push(
        queryClient.invalidateQueries(['routine', programCode, semester, section]),
        queryClient.invalidateQueries(['program', programCode]),
        queryClient.invalidateQueries(['programSemesters', programCode]),
        queryClient.invalidateQueries(['programSections', programCode])
      );
    }
    
    // 9. PREDICATE-BASED COMPREHENSIVE INVALIDATION
    invalidationPromises.push(
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          if (!key) return false;
          
          const routineRelatedKeys = [
            'routine', 'teacher', 'room', 'subject', 'program', 
            'schedule', 'availability', 'conflict', 'workload',
            'analytics', 'report', 'statistic', 'utilization',
            'vacant', 'timeslot', 'session', 'calendar'
          ];
          
          return routineRelatedKeys.some(relatedKey => 
            key.toString().toLowerCase().includes(relatedKey.toLowerCase())
          );
        }
      })
    );
    
    // 10. SPECIFIC TEACHER AND ROOM INVALIDATION
    if (affectedTeachers.length > 0) {
      affectedTeachers.forEach(teacherId => {
        invalidationPromises.push(
          queryClient.invalidateQueries(['teacherSchedule', teacherId]),
          queryClient.invalidateQueries(['teacher-schedule-from-routine', teacherId])
        );
      });
    }
    
    if (affectedRooms.length > 0) {
      affectedRooms.forEach(roomId => {
        invalidationPromises.push(
          queryClient.invalidateQueries(['roomSchedule', roomId])
        );
      });
    }
    
    // Execute all invalidations
    await Promise.all(invalidationPromises);
    
    console.log('✅ [CacheInvalidation] Cache invalidation completed successfully');
    console.log(`📊 [CacheInvalidation] Invalidated ${invalidationPromises.length} cache patterns`);
    
  } catch (error) {
    console.error('❌ [CacheInvalidation] Error during cache invalidation:', error);
    throw error;
  }
};

/**
 * Invalidate caches after a class assignment
 * @param {QueryClient} queryClient - React Query client instance
 * @param {Object} context - Context about the assignment
 */
export const invalidateAfterClassAssignment = async (queryClient, context = {}) => {
  console.log('🎯 [CacheInvalidation] Invalidating caches after class assignment...', context);
  
  const { teacherIds, roomId } = context;
  
  // Extract affected teachers and rooms for more targeted invalidation
  const affectedTeachers = teacherIds || [];
  const affectedRooms = roomId ? [roomId] : [];
  
  console.log('📌 [CacheInvalidation] Affected entities:', { 
    teachers: affectedTeachers, 
    rooms: affectedRooms 
  });
  
  await invalidateAllRoutineRelatedCaches(queryClient, {
    ...context,
    affectedTeachers,
    affectedRooms,
    reason: 'class_assignment'
  });
  
  // Additional specific and targeted invalidations for assignment
  // EMERGENCY FIX: Clear cache entries completely and force hard refetch for all related queries
  // This is more aggressive than just invalidating - it removes entries from cache entirely
  
  // Force remove all relevant cache entries
  queryClient.removeQueries(['teacher-schedule-from-routine']);
  queryClient.removeQueries(['roomSchedule']);
  queryClient.removeQueries(['teacherSchedule']);
  
  // Then set up invalidation and refetch promises
  const invalidationPromises = [
    // Program routine
    queryClient.refetchQueries(['routine', context.programCode, context.semester, context.section]),
    
    // Teacher schedules (general) - CRITICAL FIX: Add 'invalidateQueries' in addition to refetch
    queryClient.refetchQueries(['teachers']),
    queryClient.refetchQueries(['teacher-schedule-from-routine']),
    queryClient.invalidateQueries(['teacher-schedule-from-routine']), // CRITICAL FIX
    queryClient.invalidateQueries(['teacherSchedule']), // CRITICAL FIX
    
    // Room schedules (general) - CRITICAL FIX: Add 'invalidateQueries' in addition to refetch
    queryClient.refetchQueries(['rooms']),
    queryClient.refetchQueries(['roomSchedule']),
    queryClient.invalidateQueries(['roomSchedule']), // CRITICAL FIX
    
    // Force refetch timeslots
    queryClient.refetchQueries(['timeSlots']),
    
    // CRITICAL FIX: Force invalidate teacher and room queries with extreme prejudice
    queryClient.invalidateQueries({
      queryKey: ['teacher-schedule-from-routine'],
      refetchType: 'all',
      exact: false // Ensure all queries that start with this key are invalidated
    }),
    queryClient.invalidateQueries({
      queryKey: ['roomSchedule'],
      refetchType: 'all',
      exact: false // Ensure all queries that start with this key are invalidated
    }),
    
    // Force a refetch with no arguments to update general section views
    queryClient.refetchQueries(['teacher-schedule-from-routine']),
    queryClient.refetchQueries(['roomSchedule'])
  ];
  
  // Add specific teacher ID invalidations
  if (affectedTeachers && affectedTeachers.length > 0) {
    affectedTeachers.forEach(teacherId => {
      if (teacherId) {
        invalidationPromises.push(
          queryClient.refetchQueries(['teacher-schedule-from-routine', teacherId])
        );
      }
    });
  }
  
  // Add specific room ID invalidations
  if (affectedRooms && affectedRooms.length > 0) {
    affectedRooms.forEach(roomId => {
      if (roomId) {
        invalidationPromises.push(
          queryClient.refetchQueries(['roomSchedule', roomId])
        );
      }
    });
  }
  
  // Execute all invalidations
  await Promise.all(invalidationPromises);
  
  console.log('✅ [CacheInvalidation] Completed targeted cache invalidation for assignment');
};

/**
 * Invalidate caches after a class is cleared
 * @param {QueryClient} queryClient - React Query client instance
 * @param {Object} context - Context about the clearing
 */
export const invalidateAfterClassClear = async (queryClient, context = {}) => {
  console.log('🗑️ [CacheInvalidation] Invalidating caches after class clear...');
  
  await invalidateAllRoutineRelatedCaches(queryClient, {
    ...context,
    reason: 'class_clear'
  });
};

/**
 * Invalidate caches after routine import
 * @param {QueryClient} queryClient - React Query client instance
 * @param {Object} context - Context about the import
 */
export const invalidateAfterRoutineImport = async (queryClient, context = {}) => {
  console.log('📥 [CacheInvalidation] Invalidating caches after routine import...');
  
  await invalidateAllRoutineRelatedCaches(queryClient, {
    ...context,
    reason: 'routine_import'
  });
  
  // Force refetch all data after import
  await queryClient.refetchQueries();
};

/**
 * Get all teacher IDs from a routine data structure
 * @param {Object} routineData - Routine data structure
 * @returns {Array} Array of unique teacher IDs
 */
export const extractTeacherIdsFromRoutine = (routineData) => {
  const teacherIds = new Set();
  
  if (!routineData || !routineData.routine) return [];
  
  try {
    Object.values(routineData.routine).forEach(dayData => {
      if (dayData && typeof dayData === 'object') {
        Object.values(dayData).forEach(slotData => {
          if (slotData && slotData.teacherIds) {
            if (Array.isArray(slotData.teacherIds)) {
              slotData.teacherIds.forEach(id => teacherIds.add(id));
            } else {
              teacherIds.add(slotData.teacherIds);
            }
          }
        });
      }
    });
  } catch (error) {
    console.error('Error extracting teacher IDs:', error);
  }
  
  return Array.from(teacherIds);
};

/**
 * Get all room IDs from a routine data structure
 * @param {Object} routineData - Routine data structure
 * @returns {Array} Array of unique room IDs
 */
export const extractRoomIdsFromRoutine = (routineData) => {
  const roomIds = new Set();
  
  if (!routineData || !routineData.routine) return [];
  
  try {
    Object.values(routineData.routine).forEach(dayData => {
      if (dayData && typeof dayData === 'object') {
        Object.values(dayData).forEach(slotData => {
          if (slotData && slotData.roomId) {
            roomIds.add(slotData.roomId);
          }
        });
      }
    });
  } catch (error) {
    console.error('Error extracting room IDs:', error);
  }
  
  return Array.from(roomIds);
};

/**
 * Custom hook for automatic cache invalidation
 * @param {QueryClient} queryClient - React Query client instance
 * @param {Array} watchedKeys - Keys to watch for changes
 */
export const useAutoCacheInvalidation = (queryClient, watchedKeys = []) => {
  // Create a stable reference to the invalidate function
  const invalidateAll = useCallback(() => {
    if (queryClient) {
      // CRITICAL FIX: Force immediate refetch of key queries for teacher and room schedules
      queryClient.refetchQueries(['teacher-schedule-from-routine']);
      queryClient.refetchQueries(['roomSchedule']);
      
      return invalidateAllRoutineRelatedCaches(queryClient);
    }
    return Promise.resolve();
  }, [queryClient]);
  
  // Listen for custom events
  useEffect(() => {
    // Skip if no queryClient is provided
    if (!queryClient) {
      console.warn('useAutoCacheInvalidation: No queryClient provided');
      return;
    }
    
    // Skip if window is not available (for SSR environments)
    if (typeof window === 'undefined') {
      console.warn('useAutoCacheInvalidation: Window is not available');
      return;
    }
    
    const handleRoutineDataChange = (event) => {
      try {
        console.log('📢 [CacheInvalidation] Received routine data change event:', event.detail);
        
        // EMERGENCY FIX: Completely reset cache for problematic queries
        console.log('📢 [CacheInvalidation] EMERGENCY RESET: Removing cached queries completely...');
        
        // First remove all caches for these query keys
        queryClient.removeQueries(['teacher-schedule-from-routine']);
        queryClient.removeQueries(['roomSchedule']);
        queryClient.removeQueries(['teacherSchedule']);
        
        // Then invalidate them to ensure fresh data is fetched
        queryClient.invalidateQueries(['teacher-schedule-from-routine']);
        queryClient.invalidateQueries(['roomSchedule']);
        queryClient.invalidateQueries(['teacherSchedule']);
        
        // Force immediate refetch to get fresh data from server
        queryClient.refetchQueries(['teacher-schedule-from-routine']);
        queryClient.refetchQueries(['roomSchedule']);
        
        // Get specific teacher and room data if available
        const { teacherIds, roomId, programCode, semester, section } = event.detail || {};
        
        // Then do targeted invalidation if we have specific data
        if (teacherIds || roomId) {
          console.log('📢 [CacheInvalidation] Performing targeted invalidation with:', {
            teacherIds, roomId, programCode, semester, section
          });
          
          invalidateAllRoutineRelatedCaches(queryClient, {
            programCode,
            semester,
            section,
            affectedTeachers: Array.isArray(teacherIds) ? teacherIds : [],
            affectedRooms: roomId ? [roomId] : [],
            reason: 'event_triggered'
          });
        } else {
          // Fallback to invalidate everything
          invalidateAll();
        }
      } catch (error) {
        console.error('Error in routine data change handler:', error);
      }
    };
    
    window.addEventListener('routineDataChanged', handleRoutineDataChange);
    
    return () => {
      window.removeEventListener('routineDataChanged', handleRoutineDataChange);
    };
  }, [queryClient, invalidateAll]); // Add proper dependencies
  
  return { invalidateAll };
};

export default {
  invalidateAllRoutineRelatedCaches,
  invalidateAfterClassAssignment,
  invalidateAfterClassClear,
  invalidateAfterRoutineImport,
  extractTeacherIdsFromRoutine,
  extractRoomIdsFromRoutine,
  useAutoCacheInvalidation
};
