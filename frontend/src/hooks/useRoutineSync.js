/**
 * Custom Hook for Routine Data Synchronization
 * Ensures data consistency across components after import/export operations
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const useRoutineSync = () => {
  const queryClient = useQueryClient();

  /**
   * Comprehensive routine data synchronization
   * This ensures all routine-related queries are properly invalidated and refetched
   */
  const syncRoutineData = useCallback(async (programCode, semester, section, options = {}) => {
    console.log('🔄 Starting comprehensive routine data sync:', { programCode, semester, section });
    
    try {
      // Step 1: Remove stale data completely
      console.log('Step 1: Removing stale routine data...');
      queryClient.removeQueries({ 
        queryKey: ['routine']
      });

      // Step 2: Reset all routine queries to ensure fresh fetch
      console.log('Step 2: Resetting routine queries...');
      await queryClient.resetQueries({
        queryKey: ['routine']
      });

      // Step 3: Invalidate specific routine
      console.log('Step 3: Invalidating specific routine...');
      await queryClient.invalidateQueries({ 
        queryKey: ['routine', programCode, semester, section],
        exact: true,
        refetchType: 'all'
      });

      // Step 4: Force immediate refetch
      console.log('Step 4: Force refetching routine data...');
      await queryClient.refetchQueries({ 
        queryKey: ['routine', programCode, semester, section],
        exact: true
      });

      // Step 5: Invalidate teacher schedules that might be affected
      console.log('Step 5: Invalidating related teacher schedules...');
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return key === 'teacherSchedule' || 
                 key === 'teacher-schedule' ||
                 key === 'teacherSchedules' ||
                 key === 'teacher-schedule-from-routine';
        }
      });

      // Step 6: Wait a bit and verify data loaded
      if (options.verifyData) {
        setTimeout(async () => {
          console.log('Step 6: Verifying data was loaded...');
          const freshData = queryClient.getQueryData(['routine', programCode, semester, section]);
          
          if (!freshData || !freshData.routine || Object.keys(freshData.routine).length === 0) {
            console.warn('⚠️ Data verification failed - attempting fallback refresh');
            if (options.onVerificationFailed) {
              options.onVerificationFailed();
            }
          } else {
            console.log('✅ Data verification successful');
            if (options.onVerificationSuccess) {
              options.onVerificationSuccess(freshData);
            }
          }
        }, 1000);
      }

      console.log('✅ Routine data sync completed successfully');
      return true;

    } catch (error) {
      console.error('❌ Routine data sync failed:', error);
      
      // Ultimate fallback
      if (options.enablePageRefreshFallback) {
        console.log('🔄 Falling back to page refresh...');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
      
      return false;
    }
  }, [queryClient]);

  /**
   * Quick routine refresh for immediate updates
   */
  const quickRefresh = useCallback(async (programCode, semester, section) => {
    console.log('⚡ Quick routine refresh:', { programCode, semester, section });
    
    try {
      await queryClient.refetchQueries({ 
        queryKey: ['routine', programCode, semester, section],
        exact: true
      });
      return true;
    } catch (error) {
      console.error('Quick refresh failed:', error);
      return false;
    }
  }, [queryClient]);

  /**
   * Check if routine data is stale or empty
   */
  const isRoutineStale = useCallback((programCode, semester, section) => {
    const data = queryClient.getQueryData(['routine', programCode, semester, section]);
    
    if (!data) return true;
    if (!data.routine) return true;
    
    const slotCount = Object.values(data.routine).reduce((total, day) => {
      return total + Object.keys(day || {}).length;
    }, 0);
    
    return slotCount === 0;
  }, [queryClient]);

  return {
    syncRoutineData,
    quickRefresh,
    isRoutineStale
  };
};

export default useRoutineSync;
