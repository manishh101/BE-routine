/**
 * Debug Utility for Teacher BA Schedule Issue
 * 
 * This file contains special debugging tools to diagnose the issue with
 * Teacher BA's schedule not appearing in the teacher schedule page despite
 * being assigned in the Routine Manager.
 * 
 * Potential issues:
 * 1. Backend API might not be returning the expected data
 * 2. Cache invalidation might not be working as expected
 * 3. Time slot mapping between different components might be inconsistent
 */

// Helper to create a direct API request to bypass React Query caching
export const fetchTeacherScheduleDirectly = async (teacherId) => {
  try {
    console.log(`🔍 Direct API request for teacher ${teacherId} schedule...`);
    const response = await fetch(`/api/teachers/${teacherId}/schedule`);
    const data = await response.json();
    
    console.log(`✅ Direct API response for teacher ${teacherId} schedule:`, data);
    
    // Check if the routine contains any entries for Sunday
    if (data.data?.routine && data.data.routine['0']) {
      console.log(`📊 Sunday schedule:`, data.data.routine['0']);
    } else if (data.routine && data.routine['0']) {
      console.log(`📊 Sunday schedule:`, data.routine['0']);
    } else {
      console.log(`❌ No Sunday schedule found for teacher ${teacherId}`);
    }
    
    return data;
  } catch (error) {
    console.error(`❌ Error fetching teacher ${teacherId} schedule directly:`, error);
    throw error;
  }
};

// Helper to create a direct API request to bypass React Query caching
export const fetchRoomScheduleDirectly = async (roomId) => {
  try {
    console.log(`🔍 Direct API request for room ${roomId} schedule...`);
    const response = await fetch(`/api/routines/rooms/${roomId}/schedule`);
    const data = await response.json();
    
    console.log(`✅ Direct API response for room ${roomId} schedule:`, data);
    
    // Check if the routine contains any entries for Sunday
    if (data.data?.routine && data.data.routine['0']) {
      console.log(`📊 Sunday schedule:`, data.data.routine['0']);
    } else if (data.routine && data.routine['0']) {
      console.log(`📊 Sunday schedule:`, data.routine['0']);
    } else {
      console.log(`❌ No Sunday schedule found for room ${roomId}`);
    }
    
    return data;
  } catch (error) {
    console.error(`❌ Error fetching room ${roomId} schedule directly:`, error);
    throw error;
  }
};

// Helper to flush React Query cache in browser console
export const flushAllCaches = (queryClient) => {
  if (!queryClient) {
    console.error('❌ QueryClient not provided to flushAllCaches');
    return false;
  }
  
  try {
    // Clear the entire cache
    queryClient.clear();
    console.log('✅ Successfully cleared the entire React Query cache');
    
    // Force immediate refetch of critical queries
    queryClient.refetchQueries(['teacher-schedule-from-routine']);
    queryClient.refetchQueries(['roomSchedule']);
    console.log('✅ Triggered refetch of critical queries');
    
    return true;
  } catch (error) {
    console.error('❌ Error flushing React Query cache:', error);
    return false;
  }
};

// Add this function to the window for easy console debugging
if (typeof window !== 'undefined') {
  window.debugRoutineSystem = {
    fetchTeacherScheduleDirectly,
    fetchRoomScheduleDirectly,
    flushAllCaches
  };
  
  console.log('🔧 Debug utilities loaded: Use window.debugRoutineSystem in console to debug scheduling issues');
}

export default {
  fetchTeacherScheduleDirectly,
  fetchRoomScheduleDirectly,
  flushAllCaches
};
