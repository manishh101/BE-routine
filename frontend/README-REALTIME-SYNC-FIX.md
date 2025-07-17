# Room Management System - Real-time Data Synchronization Fix

## Problem Description
When a new class is assigned in the Routine Manager, the changes were not being reflected immediately in the Teacher Schedule and Room Schedule views. This was caused by different React Query cache keys being used across components, which prevented real-time updates.

## Solution
We've implemented a comprehensive cache invalidation system that ensures all components stay in sync. The key changes include:

1. **Centralized Cache Invalidation**:
   - Created a utility (`cacheInvalidation.js`) to standardize cache invalidation across the app
   - Implemented specific invalidation functions for different operations

2. **Enhanced Data Passing**:
   - Modified ProgramRoutineManager to pass teacher IDs and room IDs to the invalidation function
   - Updated custom events to include these specific IDs for more targeted invalidation

3. **Component Integration**:
   - Added useAutoCacheInvalidation hook to TeacherScheduleManager and RoomScheduleManager
   - Enhanced error handling and debugging

## How the Fix Works

### 1. When Assigning a Class:
```jsx
// ProgramRoutineManager.jsx
const handleAssignmentSuccess = async (classData) => {
  // Extract specific IDs from class data
  const teacherIds = classData?.teacherIds || [];
  const roomId = classData?.roomId;
  
  // Use enhanced cache invalidation with specific IDs
  await invalidateAfterClassAssignment(queryClient, {
    programCode: selectedProgram,
    semester: selectedSemester,
    section: selectedSection,
    teacherIds,  // Add teacher IDs for targeted invalidation
    roomId       // Add room ID for targeted invalidation
  });
}
```

### 2. Improved Cache Invalidation:
```jsx
// cacheInvalidation.js
export const invalidateAfterClassAssignment = async (queryClient, context = {}) => {
  const { teacherIds, roomId } = context;
  
  // Extract affected teachers and rooms for targeted invalidation
  const affectedTeachers = teacherIds || [];
  const affectedRooms = roomId ? [roomId] : [];
  
  // Invalidate specific teacher and room caches
  if (affectedTeachers.length > 0) {
    affectedTeachers.forEach(teacherId => {
      invalidationPromises.push(
        queryClient.refetchQueries(['teacher-schedule-from-routine', teacherId])
      );
    });
  }
  
  if (affectedRooms.length > 0) {
    affectedRooms.forEach(roomId => {
      invalidationPromises.push(
        queryClient.refetchQueries(['roomSchedule', roomId])
      );
    });
  }
}
```

### 3. Real-time Event Listening:
```jsx
// RoomScheduleManager.jsx and TeacherScheduleManager.jsx
const { invalidateAll } = useAutoCacheInvalidation(queryClient);
```

```jsx
// cacheInvalidation.js
export const useAutoCacheInvalidation = (queryClient, watchedKeys = []) => {
  React.useEffect(() => {
    const handleRoutineDataChange = (event) => {
      const { teacherIds, roomId } = event.detail;
      
      // Perform targeted invalidation based on the affected entities
      invalidateAllRoutineRelatedCaches(queryClient, {
        affectedTeachers: teacherIds || [],
        affectedRooms: roomId ? [roomId] : []
      });
    };
    
    window.addEventListener('routineDataChanged', handleRoutineDataChange);
    return () => window.removeEventListener('routineDataChanged', handleRoutineDataChange);
  }, []);
};
```

## Testing the Fix
To verify the fix works properly:

1. Add or modify a class in Program Routine Manager
2. Without refreshing the page, switch to Teacher Schedule Manager and select the teacher you assigned
3. The schedule should immediately reflect your changes
4. Similarly, switch to Room Schedule Manager and select the room you assigned
5. The room schedule should also show the updated class

## Debugging Tips
If synchronization issues persist:

1. Check browser console for cache invalidation logs (look for '🔄 Using centralized cache invalidation')
2. Verify that teacher and room IDs are correctly being passed to the invalidation function
3. Check if the custom event is being dispatched with the correct data
4. If needed, use the manual refresh button in the Teacher/Room Schedule views
