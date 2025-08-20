import React from 'react';
import { teachersAPI } from '../services/api';

/**
 * React Query Cache Management for Teacher Schedule Synchronization
 * 
 * This utility provides functions to manage React Query cache invalidation
 * to ensure teacher schedules are automatically updated when routine changes occur.
 */

/**
 * Invalidate teacher schedule cache when routine data changes
 * @param {Object} queryClient - React Query client instance
 * @param {Array} affectedTeacherIds - Array of teacher IDs that need cache invalidation
 */
export const invalidateTeacherSchedules = async (queryClient, affectedTeacherIds = []) => {
  const invalidationPromises = [];

  // Invalidate specific teacher schedules
  if (affectedTeacherIds && affectedTeacherIds.length > 0) {
    affectedTeacherIds.forEach(teacherId => {
      if (teacherId) {
        invalidationPromises.push(
          queryClient.invalidateQueries(['teacherSchedule', teacherId])
        );
      }
    });
  }

  // Invalidate all teacher schedules if no specific teachers provided
  if (affectedTeacherIds.length === 0) {
    invalidationPromises.push(
      queryClient.invalidateQueries(['teacherSchedule'])
    );
  }

  // Also invalidate teachers list in case of changes
  invalidationPromises.push(
    queryClient.invalidateQueries(['teachers'])
  );

  try {
    await Promise.all(invalidationPromises);
    console.log('[Cache] Teacher schedule cache invalidated for teachers:', affectedTeacherIds);
  } catch (error) {
    console.error('[Cache] Error invalidating teacher schedule cache:', error);
  }
};

/**
 * Set up automatic cache invalidation when routine changes occur
 * This function should be called in components that modify routine data
 * @param {Object} queryClient - React Query client instance
 * @param {Object} mutationResult - Result from routine mutation (assign/clear class)
 */
export const handleRoutineChangeCache = async (queryClient, mutationResult) => {
  try {
    // Extract affected teacher IDs from mutation result
    const affectedTeacherIds = extractAffectedTeachers(mutationResult);
    
    // Invalidate teacher schedules
    await invalidateTeacherSchedules(queryClient, affectedTeacherIds);
    
    // Invalidate routine data as well
    await queryClient.invalidateQueries(['routine']);
    
    console.log('[Cache] Cache invalidated after routine change');
  } catch (error) {
    console.error('[Cache] Error handling routine change cache:', error);
  }
};

/**
 * Extract affected teacher IDs from mutation result
 * @param {Object} mutationResult - Result from routine mutation
 * @returns {Array} Array of teacher IDs
 */
const extractAffectedTeachers = (mutationResult) => {
  // This function extracts teacher IDs from the mutation result
  // The exact structure depends on your API response format
  
  if (!mutationResult) return [];
  
  const teachers = [];
  
  // From assign class result
  if (mutationResult.data?.teacherIds) {
    teachers.push(...mutationResult.data.teacherIds);
  }
  
  // From clear class result (might include affected teachers)
  if (mutationResult.affectedTeachers) {
    teachers.push(...mutationResult.affectedTeachers);
  }
  
  // From spanned class result
  if (mutationResult.data?.slots) {
    mutationResult.data.slots.forEach(slot => {
      if (slot.teacherIds) {
        teachers.push(...slot.teacherIds);
      }
    });
  }
  
  // Remove duplicates and null values
  return [...new Set(teachers.filter(id => id))];
};

/**
 * Set up real-time cache management for teacher schedules
 * @param {Object} queryClient - React Query client instance
 * @returns {Object} Cache management functions
 */
export const useTeacherScheduleCache = (queryClient) => {
  return {
    invalidateTeacherSchedules: (teacherIds) => invalidateTeacherSchedules(queryClient, teacherIds),
    handleRoutineChange: (mutationResult) => handleRoutineChangeCache(queryClient, mutationResult),
    
    // Manual refresh all teacher data
    refreshAllTeacherData: async () => {
      try {
        await Promise.all([
          queryClient.invalidateQueries(['teachers']),
          queryClient.invalidateQueries(['teacherSchedule']),
          queryClient.invalidateQueries(['timeSlots'])
        ]);
        console.log('[Cache] All teacher data refreshed');
      } catch (error) {
        console.error('[Cache] Error refreshing teacher data:', error);
      }
    },
    
    // Prefetch teacher schedule
    prefetchTeacherSchedule: async (teacherId) => {
      if (!teacherId) return;
      
      try {
        await queryClient.prefetchQuery({
          queryKey: ['teacherSchedule', teacherId],
          queryFn: () => teachersAPI.getTeacherSchedule(teacherId).then(res => res.data),
          staleTime: 30000, // 30 seconds
        });
        console.log(`[Cache] Prefetched schedule for teacher: ${teacherId}`);
      } catch (error) {
        console.error(`[Cache] Error prefetching schedule for teacher ${teacherId}:`, error);
      }
    }
  };
};

/**
 * Hook to automatically set up teacher schedule cache management
 * @param {Object} queryClient - React Query client instance
 * @param {Array} watchedTeacherIds - Array of teacher IDs to monitor
 */
export const useAutoTeacherScheduleSync = (queryClient, watchedTeacherIds = []) => {
  const cacheManager = useTeacherScheduleCache(queryClient);
  
  // Set up periodic cache invalidation for watched teachers
  React.useEffect(() => {
    if (watchedTeacherIds.length === 0) return;
    
    const interval = setInterval(() => {
      cacheManager.invalidateTeacherSchedules(watchedTeacherIds);
    }, 60000); // Refresh every minute
    
    return () => clearInterval(interval);
  }, [watchedTeacherIds, cacheManager]);
  
  return cacheManager;
};
