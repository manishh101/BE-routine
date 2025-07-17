import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { 
  Card, 
  Tag, 
  Button, 
  Space, 
  Typography, 
  Alert, 
  Spin, 
  Empty, 
  Modal, 
  message,
  Tooltip,
  App
} from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined,
  WarningOutlined,
  CalendarOutlined,
  ClearOutlined
} from '@ant-design/icons';
import AssignClassModal from './AssignClassModal';
import ExcelActions from './ExcelActions';
import TeacherExcelActions from './TeacherExcelActions';
import { routinesAPI, timeSlotsAPI } from '../services/api';
import { handleRoutineChangeCache } from '../utils/teacherScheduleCache';
import * as timeSlotUtils from '../utils/timeSlotUtils';
import './RoutineGrid.css';

// Extract the utility functions we need
const { 
  normalizeTimeSlotId, 
  findTimeSlotById, 
  createRoutineGrid, 
  populateRoutineGrid, 
  getClassData,
  getTimeSlotPositionIndex 
} = timeSlotUtils;

const { Text } = Typography;
// Demo data function for demonstration purposes
const getDemoRoutineData = (programCode, semester, section) => {
  return {
    data: {
      routine: {
        // Sunday
        '0': {
          '0': {
            _id: "demo_sun_0",
            subjectName: "Engineering Mathematics I",
            subjectCode: "MATH101",
            teacherNames: ["Dr. Shyam Kumar Shrestha"],
            teacherShortNames: ["Dr. SK"],
            roomName: "Room A-101 (Lecture Hall)",
            classType: "L",
            notes: ""
          },
          '1': {
            _id: "demo_sun_1",
            subjectName: "Engineering Physics",
            subjectCode: "PHYS101",
            teacherNames: ["Prof. Dr. Narayan Prasad Adhikari"],
            teacherShortNames: ["Prof. NP"],
            roomName: "Room A-102 (Lecture Hall)",
            classType: "L",
            notes: ""
          }
        },
        // Monday  
        '1': {
          '0': {
            _id: "demo_mon_0",
            subjectName: "English",
            subjectCode: "ENG101",
            teacherNames: ["Dr. Prakash Sayami"],
            teacherShortNames: ["Dr. PS"],
            roomName: "Room A-201 (Tutorial Room)",
            classType: "L",
            notes: ""
          }
        }
      }
    }
  };
};

// Demo time slots data
const getDemoTimeSlots = () => {
  return {
    data: {
      data: [
        {
          _id: '1',
          label: '10:15-11:05',
          startTime: '10:15',
          endTime: '11:05',
          sortOrder: 1,
          isBreak: false
        },
        {
          _id: '2',
          label: '11:05-11:55',
          startTime: '11:05',
          endTime: '11:55',
          sortOrder: 2,
          isBreak: false
        },
        {
          _id: '3',
          label: '11:55-12:45',
          startTime: '11:55',
          endTime: '12:45',
          sortOrder: 3,
          isBreak: false
        },
        {
          _id: '4',
          label: '12:45-13:35',
          startTime: '12:45',
          endTime: '13:35',
          sortOrder: 4,
          isBreak: false
        },
        {
          _id: '5',
          label: '13:35-14:25',
          startTime: '13:35',
          endTime: '14:25',
          sortOrder: 5,
          isBreak: false
        }
      ]
    }
  };
};

const RoutineGrid = ({ 
  programCode, 
  semester, 
  section, 
  isEditable = false,
  demoMode = false,
  onCellDoubleClicked = null,
  teacherViewMode = false,
  roomViewMode = false,
  routineData: providedRoutineData,
  showExcelActions = false,
  selectedTeacher = null,
  selectedTeacherInfo = null,
  selectedRoom = null,
  viewType = 'routine' // 'routine', 'teacher', 'room'
}) => {
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState({ dayIndex: null, slotIndex: null });
  const [existingClass, setExistingClass] = useState(null);
  const [lastDeletedClass, setLastDeletedClass] = useState(null);
  const [showUndoButton, setShowUndoButton] = useState(false);

  // Use App.useApp for proper context support in modals
  const { modal, message: contextMessage } = App.useApp();
  
  // Set room view mode based on viewType or explicit flag
  const isRoomViewMode = roomViewMode || viewType === 'room';
  
  // Safe message function that uses context message if available, falling back to regular message
  const safeMessage = {
    success: (...args) => (contextMessage || message).success(...args),
    error: (...args) => (contextMessage || message).error(...args),
    warning: (...args) => (contextMessage || message).warning(...args),
    info: (...args) => (contextMessage || message).info(...args),
  };

  const queryClient = useQueryClient();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Force refresh when selection changes
  useEffect(() => {
    if (programCode && semester && section && !demoMode && !teacherViewMode && !isRoomViewMode) {
      queryClient.invalidateQueries(['routine', programCode, semester, section]);
    }
  }, [programCode, semester, section, queryClient, demoMode, teacherViewMode, isRoomViewMode]);

  // Fetch routine data (use demo data if in demo mode)
  const { 
    data: fetchedRoutineData, 
    isLoading: routineLoading,
    error: routineError,
    dataUpdatedAt,
    isRefetching,
    refetch: refetchRoutine
  } = useQuery({
    queryKey: ['routine', programCode, semester, section],
    queryFn: async () => {
      if (demoMode) {
        return getDemoRoutineData(programCode, semester, section);
      } else {
        const response = await routinesAPI.getRoutine(programCode, semester, section);
        
        // Ensure consistent data structure
        if (response.data?.data) {
          return { data: response.data.data };
        } else if (response.data) {
          return { data: response.data };
        } else {
          return { data: { routine: {} } };
        }
      }
    },
    enabled: !providedRoutineData && !teacherViewMode && !isRoomViewMode && (demoMode || !!(programCode && semester && section)),
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0, // Always fetch fresh data
    gcTime: 0 // Don't cache data
  });
  
  // Use either the provided routine data or fetch new data
  const routineData = providedRoutineData || fetchedRoutineData;

  // Fetch time slots (use demo data if in demo mode)
  const { 
    data: timeSlotsData, 
    isLoading: timeSlotsLoading 
  } = useQuery({
    queryKey: ['timeSlots'],
    queryFn: async () => {
      if (demoMode) {
        return getDemoTimeSlots();
      } else {
        return timeSlotsAPI.getTimeSlots();
      }
    },
    staleTime: 5 * 60 * 1000
  });

  // Helper function to group lab classes by time slot
  const groupLabClassesBySlot = (routineData) => {
    const groupedRoutine = {};
    
    // Process each day
    Object.keys(routineData).forEach(dayIndex => {
      groupedRoutine[dayIndex] = {};
      const dayData = routineData[dayIndex];
      
      if (!dayData || typeof dayData !== 'object') return;
      
      // Process each slot
      Object.keys(dayData).forEach(slotIndex => {
        const slotData = dayData[slotIndex];
        if (!slotData) return;
        
        // Check if this is already an array (multiple groups from backend)
        if (Array.isArray(slotData)) {
          // Sort by labGroup to ensure consistent order (A/C first, then B/D)
          const sortedClasses = slotData.sort((a, b) => {
            // Define sorting order for all groups
            const groupOrder = { 'A': 1, 'C': 1, 'B': 2, 'D': 2, 'ALL': 3 };
            const aOrder = groupOrder[a.labGroup] || 4;
            const bOrder = groupOrder[b.labGroup] || 4;
            return aOrder - bOrder;
          });
          
          // Create a combined class object for display
          groupedRoutine[dayIndex][slotIndex] = {
            ...sortedClasses[0], // Use first class as base
            isMultiGroup: true,
            groups: sortedClasses
          };
        } else if (slotData.isAlternativeWeek && slotData.alternateGroupData) {
          // Handle alternate weeks lab - create display for both groups based on section
          const section = slotData.section || 'AB';
          const groupLabels = section === 'CD' ? ['C', 'D'] : ['A', 'B'];
          
          const groupAData = {
            ...slotData,
            labGroup: groupLabels[0]
          };
          
          const groupBData = {
            ...slotData,
            labGroup: groupLabels[1]
          };
          
          // Apply alternate group configuration if available
          // The alternateGroupData still uses groupA/groupB keys but maps to section-appropriate groups
          if (slotData.alternateGroupData.groupA) {
            Object.assign(groupAData, slotData.alternateGroupData.groupA);
          }
          if (slotData.alternateGroupData.groupB) {
            Object.assign(groupBData, slotData.alternateGroupData.groupB);
          }
          
          groupedRoutine[dayIndex][slotIndex] = {
            ...slotData,
            isAlternativeWeek: true,
            isMultiGroup: true,
            groups: [groupAData, groupBData]
          };
        } else {
          // Single class - use as is
          groupedRoutine[dayIndex][slotIndex] = slotData;
        }
      });
    });
    
    return groupedRoutine;
  };

  // Memoized data processing for performance
  const routine = useMemo(() => {
    // Handle both direct routine data and nested data structures
    let result = {};
    
    if (routineData?.routine) {
      // Case 1: Data structure is { routine: {...} }
      result = routineData.routine;
    } else if (routineData?.data?.routine) {
      // Case 2: Data structure is { data: { routine: {...} } }
      result = routineData.data.routine;
    } else if (routineData?.data) {
      // Case 3: Data structure is just { data: {...} } where data is the routine
      result = routineData.data;
    } else {
      // Case 4: Empty or invalid data
      result = {};
    }
    
    // Group lab classes by slot to handle bothGroups display
    result = groupLabClassesBySlot(result);
    
    return result;
  }, [routineData, demoMode, teacherViewMode]);

  const timeSlots = useMemo(() => {
    // The API returns time slots directly as an array
    let slots = [];
    
    if (demoMode) {
      // For demo mode, extract from nested structure
      if (timeSlotsData?.data?.data && Array.isArray(timeSlotsData.data.data)) {
        slots = timeSlotsData.data.data;
      }
    } else {
      // For real API, handle axios response structure
      if (Array.isArray(timeSlotsData)) {
        // Direct array response (shouldn't happen with axios)
        slots = timeSlotsData;
      } else if (timeSlotsData?.data && Array.isArray(timeSlotsData.data)) {
        // Axios wraps response in .data property
        slots = timeSlotsData.data;
      }
    }
    
    // Make sure all time slots are properly sorted
    const sortedSlots = slots.sort((a, b) => a.sortOrder - b.sortOrder);
    
    return sortedSlots;
  }, [timeSlotsData, demoMode]);

  // Transform routine data into 2D grid structure for easier rendering
  const routineGridData = useMemo(() => {
    if (demoMode) {
      return routine;
    }
    
    // Create empty grid structure with normalized time slot IDs
    const emptyGrid = createRoutineGrid(timeSlots);
    
    // Populate grid with actual routine data
    const populatedGrid = populateRoutineGrid(emptyGrid, routine);
    
    return populatedGrid;
  }, [routine, timeSlots, demoMode]);

  // Helper function to generate lab group display labels
  const getLabGroupLabel = (classData, group = null) => {
    const isAltWeek = classData.isAlternativeWeek === true;
    
    // For multi-group classes, use the individual group data
    if (group) {
      // Use backend-provided labGroupLabel if available
      if (group.labGroupLabel) {
        return isAltWeek ? `${group.labGroupLabel} - Alt Week` : group.labGroupLabel;
      }
      
      const groupLetter = group.labGroup;
      return isAltWeek ? `(Group ${groupLetter} - Alt Week)` : `(Group ${groupLetter})`;
    }
    
    // For single classes, use backend-provided labGroupLabel if available
    if (classData.labGroupLabel) {
      return isAltWeek ? `${classData.labGroupLabel} - Alt Week` : classData.labGroupLabel;
    }
    
    // IMPORTANT: Don't fall back to hardcoded labels, let the backend handle the mapping
    // For single classes - fallback to manual mapping ONLY if backend doesn't provide labGroupLabel
    if (isAltWeek) {
      // For alt week, construct from section-aware backend data
      const sectionGroups = classData.section === 'CD' ? ['C', 'D'] : ['A', 'B'];
      if (classData.labGroup === 'ALL') {
        return `(Groups ${sectionGroups.join(' & ')} - Alt Week)`;
      }
      return classData.labGroup ? `(Group ${classData.labGroup} - Alt Week)` : '(Alt Week)';
    }
    
    // Regular lab group labels - use section-aware mapping
    if (classData.labGroup) {
      const sectionGroups = classData.section === 'CD' ? ['C', 'D'] : ['A', 'B'];
      if (classData.labGroup === 'ALL') {
        return `(Groups ${sectionGroups.join(' & ')})`;
      }
      // Map the lab group based on section
      if (classData.section === 'CD') {
        if (classData.labGroup === 'A') return '(Group C)';
        if (classData.labGroup === 'B') return '(Group D)';
      } else {
        if (classData.labGroup === 'A') return '(Group A)';
        if (classData.labGroup === 'B') return '(Group B)';
      }
      // Direct mapping for C, D groups
      if (classData.labGroup === 'C') return '(Group C)';
      if (classData.labGroup === 'D') return '(Group D)';
      return `(Group ${classData.labGroup})`;
    }
    
    return '';
  };

  // Helper functions
  const getClassTypeColor = (classType) => {
    switch (classType) {
      case 'L': return 'blue';
      case 'P': return 'green';
      case 'T': return 'orange';
      default: return 'default';
    }
  };

  const getClassTypeText = (classType) => {
    switch (classType) {
      case 'L': return 'Lecture';
      case 'P': return 'Practical';
      case 'T': return 'Tutorial';
      default: return classType;
    }
  };

  const getCellBackgroundColor = (classType) => {
    // All class types now have consistent white background
    return '#ffffff';
  };

  const calculateColSpan = (classData, dayData, slotIndex) => {
    // If not part of a span group, return 1 (normal cell)
    if (!classData?.spanId) return 1;
    
    // If it's part of a span group but not the master, 
    // return 1 but we'll style it differently
    if (classData.spanId && !classData.spanMaster) return 1;
    
    // For the span master, calculate the total span length
    const spanGroup = Object.values(dayData || {}).filter(
      slot => slot?.spanId && slot.spanId === classData.spanId
    );
    
    return spanGroup.length;
  };

  const isPartOfSpanGroup = (classData) => {
    return classData?.spanId != null;
  };

  // Clear entire routine mutation
  const clearEntireRoutineMutation = useMutation({
    mutationFn: () => routinesAPI.clearEntireRoutine(programCode, semester, section),
    onSuccess: async (result) => {
      // Show success message with stats
      const deletedCount = result?.data?.deletedCount || 0;
      
      safeMessage.success({
        content: (
          <span>
            ✅ Entire routine cleared successfully. {deletedCount} class{deletedCount === 1 ? '' : 'es'} removed.
          </span>
        ),
        duration: 5
      });
      
      // Use enhanced cache management for teacher schedule synchronization
      await handleRoutineChangeCache(queryClient, result);
      
      // Invalidate routine queries
      queryClient.invalidateQueries(['routine', programCode, semester, section]);
      
      // Invalidate teacher schedules if any were affected
      if (result?.data?.affectedTeachers?.length > 0) {
        queryClient.invalidateQueries(['teacherSchedules']);
      }
    },
    onError: (error) => {
      console.error('Clear entire routine error:', error);
      safeMessage.error({
        content: (
          <div>
            <div>❌ Failed to clear the entire routine</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {error.response?.data?.message || error.message || 'Unknown error occurred'}
            </div>
          </div>
        ),
        duration: 5
      });
    },
  });

  // Clear class mutation
  const clearClassMutation = useMutation({
    mutationFn: ({ dayIndex, slotIndex }) => 
      routinesAPI.clearClass(programCode, semester, section, { dayIndex, slotIndex }),
    onSuccess: async (result, variables) => {
      const { dayIndex, slotIndex } = variables;
      const timeSlot = findTimeSlotById(timeSlots, slotIndex);
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      // Show undo option
      setShowUndoButton(true);
      setTimeout(() => setShowUndoButton(false), 10000); // Hide after 10 seconds
      
      safeMessage.success({
        content: (
          <span>
            ✅ Class cleared successfully from {dayNames[dayIndex]}, {timeSlot?.label || `Slot ${slotIndex}`}
          </span>
        ),
        duration: 3
      });
      
      // Use enhanced cache management for teacher schedule synchronization
      await handleRoutineChangeCache(queryClient, result);
      
      // Force immediate refetch of routine data
      await refetchRoutine();
      
      // Invalidate routine queries for comprehensive updates
      queryClient.invalidateQueries(['routine', programCode, semester, section]);
      
      // CRITICAL FIX: Invalidate teacher and room schedule caches
      await Promise.all([
        queryClient.invalidateQueries(['teacher-schedule-from-routine']),
        queryClient.invalidateQueries(['teacherSchedule']),
        queryClient.invalidateQueries(['roomSchedule']),
        queryClient.invalidateQueries(['teachers']),
        queryClient.invalidateQueries(['rooms']),
        queryClient.invalidateQueries(['timeSlots'])
      ]);
    },
    onError: (error, variables) => {
      const { dayIndex, slotIndex } = variables;
      const timeSlot = findTimeSlotById(timeSlots, slotIndex);
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      console.error('Clear class error:', error);
      safeMessage.error({
        content: (
          <div>
            <div>❌ Failed to clear class from {dayNames[dayIndex]}, {timeSlot?.label || `Slot ${slotIndex}`}</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {error.response?.data?.message || error.message || 'Unknown error occurred'}
            </div>
          </div>
        ),
        duration: 5
      });
    },
  });
  
  // Clear span group mutation
  const clearSpanGroupMutation = useMutation({
    mutationFn: (spanId) => routinesAPI.clearSpanGroup(spanId),
    onSuccess: async (result, spanId) => {
      const deletedCount = result?.data?.deletedCount || 'Multiple';
      
      // Show undo option
      setShowUndoButton(true);
      setTimeout(() => setShowUndoButton(false), 10000); // Hide after 10 seconds
      
      safeMessage.success({
        content: (
          <span>
            ✅ Multi-period class cleared successfully! ({deletedCount} periods removed)
          </span>
        ),
        duration: 3
      });
      
      // Use enhanced cache management for teacher schedule synchronization
      await handleRoutineChangeCache(queryClient, result);
      
      // Force immediate refetch of routine data
      await refetchRoutine();
      
      // Invalidate routine queries for comprehensive updates
      queryClient.invalidateQueries(['routine', programCode, semester, section]);
      queryClient.refetchQueries(['routine', programCode, semester, section]);
    },
    onError: (error, spanId) => {
      console.error('Clear span group error:', error);
      safeMessage.error({
        content: (
          <div>
            <div>❌ Failed to clear multi-period class</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {error.response?.data?.message || error.message || 'Unknown error occurred'}
            </div>
          </div>
        ),
        duration: 5
      });
    }
  });

  const handleSlotClick = (dayIndex, slotIndex) => {
    if (!isEditable || demoMode) return;
    
    // Normalize the slot ID for consistent handling
    const normalizedSlotId = normalizeTimeSlotId(slotIndex);
    
    // Find the time slot using the utility function
    const timeSlot = findTimeSlotById(timeSlots, normalizedSlotId);
    
    if (timeSlot?.isBreak) {
      // For break time slots, we can assign BREAK class types but not regular classes
      // Let the modal handle this validation
    }

    // Set selected slot with normalized ID
    setSelectedSlot({ dayIndex, slotIndex: normalizedSlotId });
    
    // Get existing class data using the utility function
    const existingClassData = getClassData(routineGridData, dayIndex, normalizedSlotId);
    setExistingClass(existingClassData || null);
    setAssignModalVisible(true);
  };

  // Function to handle clearing the entire weekly routine
  const handleClearEntireRoutine = () => {
    modal.confirm({
      title: (
        <Space>
          <DeleteOutlined style={{ color: '#ff4d4f', fontSize: '18px' }} />
          <span style={{ fontWeight: 'bold' }}>Clear Entire Weekly Routine</span>
        </Space>
      ),
      content: (
        <div style={{ padding: '20px 0' }}>
          <Alert 
            message={`Do you want to delete the entire weekly routine for ${programCode} Semester ${semester} Section ${section}?`}
            description="This action will permanently delete ALL classes from the entire weekly schedule. This cannot be undone."
            type="error"
            showIcon
            style={{ marginBottom: '16px' }}
          />
          
          <div style={{ fontSize: '14px', marginTop: '16px' }}>
            <p><strong>This will delete:</strong></p>
            <ul style={{ paddingLeft: '20px' }}>
              <li>All subjects scheduled across all days</li>
              <li>All assigned teachers and rooms</li>
              <li>All multi-period classes</li>
              <li>All special arrangements</li>
            </ul>
            <p style={{ marginTop: '16px' }}>After deletion, you will need to rebuild the routine from scratch or import from Excel.</p>
          </div>
        </div>
      ),
      okText: 'Yes, Clear Entire Routine',
      okType: 'danger',
      cancelText: 'Cancel',
      width: 550,
      onOk: () => {
        clearEntireRoutineMutation.mutate();
      }
    });
  };

  const handleClearClass = (dayIndex, slotIndex) => {
    // Normalize slot ID for consistent handling
    const normalizedSlotId = normalizeTimeSlotId(slotIndex);
    const classData = getClassData(routineGridData, dayIndex, normalizedSlotId);
    // Find time slot using utility function
    const timeSlot = findTimeSlotById(timeSlots, normalizedSlotId);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    if (!classData) {
      // If no class is found, ask if user wants to clear the entire routine instead
      modal.confirm({
        title: (
          <Space>
            <DeleteOutlined style={{ color: '#ff4d4f' }} />
            <span>No Class Found - Clear Entire Routine?</span>
          </Space>
        ),
        content: (
          <div style={{ padding: '16px 0' }}>
            <Alert 
              message="Do you want to delete the entire weekly routine for this semester?"
              description="This action will permanently delete ALL classes from the entire weekly schedule."
              type="warning"
              showIcon
              style={{ marginBottom: '16px' }}
            />
          </div>
        ),
        okText: 'Yes, Clear Entire Routine',
        okType: 'danger',
        cancelText: 'Cancel',
        width: 500,
        onOk: () => {
          handleClearEntireRoutine();
        }
      });
      return;
    }
    
    // When called from modal, clear class directly without confirmation
    if (assignModalVisible) {
      // Store the class data for potential undo
      setLastDeletedClass({
        classData,
        dayIndex,
        slotIndex,
        type: classData.spanId ? 'span' : 'single'
      });
      
      if (classData.spanId) {
        clearSpanGroupMutation.mutate(classData.spanId, {
          onSuccess: () => onModalClose() // Close modal after successful deletion
        });
      } else {
        clearClassMutation.mutate({ 
          dayIndex, 
          slotIndex: parseInt(normalizedSlotId) || normalizedSlotId // Ensure integer for backend
        }, {
          onSuccess: () => onModalClose() // Close modal after successful deletion
        });
      }
      return;
    }
    
    if (classData?.spanId) {
      // Multi-period class deletion
      const spanGroupSlots = Object.values(routineGridData[dayIndex] || {})
        .filter(slot => slot?.spanId === classData.spanId);
      
      modal.confirm({
        title: (
          <Space>
            <DeleteOutlined style={{ color: '#ff4d4f' }} />
            <span>Clear Multi-Period Class</span>
          </Space>
        ),
        content: (
          <div style={{ padding: '16px 0' }}>
            <div style={{ marginBottom: '12px', fontWeight: 'bold' }}>
              {classData.subjectName || classData.subjectCode}
            </div>
            <div style={{ marginBottom: '8px' }}>
              {dayNames[dayIndex]}, {timeSlot?.label || `Slot ${slotIndex}`}
            </div>
            <div style={{ marginBottom: '8px' }}>
              {Array.isArray(classData.teacherNames) 
                ? classData.teacherNames.join(', ') 
                : classData.teacherNames || 'No teacher assigned'}
            </div>
            <div style={{ marginBottom: '12px' }}>
              {classData.roomName || 'No room assigned'}
            </div>
            <Alert 
              message={`This will clear all ${spanGroupSlots.length} periods of this multi-period class.`}
              type="warning"
              size="small"
              showIcon
            />
          </div>
        ),
        okText: 'Yes, clear all periods',
        okType: 'danger',
        cancelText: 'Cancel',
        width: 500,
        onOk: () => {
          // Store the span group data for potential undo
          setLastDeletedClass({
            classData,
            dayIndex,
            slotIndex,
            type: 'span',
            spanId: classData.spanId
          });
          
          clearSpanGroupMutation.mutate(classData.spanId);
        }
      });
    } else {
      // Single period class deletion
      modal.confirm({
        title: (
          <Space>
            <DeleteOutlined style={{ color: '#ff4d4f' }} />
            <span>Clear Class</span>
          </Space>
        ),
        content: (
          <div style={{ padding: '16px 0' }}>
            <div style={{ marginBottom: '12px', fontWeight: 'bold' }}>
              {classData.subjectName || classData.subjectCode}
            </div>
            <div style={{ marginBottom: '8px' }}>
              {dayNames[dayIndex]}, {timeSlot?.label || `Slot ${slotIndex}`}
            </div>
            <div style={{ marginBottom: '8px' }}>
              {Array.isArray(classData.teacherNames) 
                ? classData.teacherNames.join(', ') 
                : classData.teacherNames || 'No teacher assigned'}
            </div>
            <div style={{ marginBottom: '12px' }}>
              {classData.roomName || 'No room assigned'}
            </div>
            <Alert 
              message="This will remove the class from this time slot."
              type="info"
              size="small"
              showIcon
            />
          </div>
        ),
        okText: 'Yes, clear class',
        okType: 'danger',
        cancelText: 'Cancel',
        width: 500,
        onOk: () => {
          // Store the class data for potential undo
          setLastDeletedClass({
            classData,
            dayIndex,
            slotIndex,
            type: 'single'
          });
          
          clearClassMutation.mutate({ 
            dayIndex, 
            slotIndex: parseInt(normalizedSlotId) || normalizedSlotId // Ensure integer for backend
          });
        }
      });
    }
  };

  // Undo last delete operation
  const handleUndoDelete = async () => {
    if (!lastDeletedClass) {
      safeMessage.warning('No recent deletion to undo');
      return;
    }

    try {
      const { classData, dayIndex, slotIndex, type } = lastDeletedClass;
      
      if (type === 'span') {
        // Restore span group - this would require a more complex implementation
        safeMessage.info('Undo for multi-period classes is not yet supported. Please recreate the class manually.');
      } else {
        // Restore single class
        await routinesAPI.assignClass(programCode, semester, section, {
          dayIndex,
          slotIndex,
          subjectId: classData.subjectId,
          teacherIds: classData.teacherIds || [],
          roomId: classData.roomId,
          classType: classData.classType,
          notes: classData.notes || ''
        });
        
        safeMessage.success('Class restored successfully!');
        queryClient.invalidateQueries(['routine', programCode, semester, section]);
      }
      
      setLastDeletedClass(null);
      setShowUndoButton(false);
    } catch (error) {
      console.error('Undo error:', error);
      safeMessage.error('Failed to restore class. Please recreate it manually.');
    }
  };

  const onModalClose = () => {
    setAssignModalVisible(false);
    setSelectedSlot({ dayIndex: null, slotIndex: null });
    setExistingClass(null);
  };

  // Render class cell content
  const renderClassContent = (classData) => {
    if (!classData) {
      return null;
    }

    const classCellContentStyle = {
      fontSize: '12px',
      lineHeight: '1.3',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      textAlign: 'center',
      color: '#333',
      padding: '4px'
    };

    const isSpanned = isPartOfSpanGroup(classData);
    const isSpanMaster = classData.spanMaster === true;
    
    // Check if this is a multi-group slot (Group A and Group B)
    if (classData.isMultiGroup && classData.groups && classData.groups.length > 1) {
      return (
        <div style={classCellContentStyle}>
          {classData.groups.map((group, index) => (
            <div key={index}>
              {/* Group content */}                  <div style={{
                    padding: '6px 4px',
                    borderBottomWidth: index < classData.groups.length - 1 ? '1px' : '0',
                    borderBottomStyle: index < classData.groups.length - 1 ? 'solid' : 'none',
                    borderBottomColor: index < classData.groups.length - 1 ? '#d9d9d9' : 'transparent',
                    marginBottom: index < classData.groups.length - 1 ? '6px' : '0',
                    backgroundColor: '#ffffff',
                    borderRadius: '4px'
                  }}>
                {/* Subject Name with Group indicator */}
                <div style={{ 
                  fontWeight: '600', 
                  marginBottom: '2px',
                  fontSize: '12px',
                  color: '#333'
                }}>
                  {group.subjectName || group.subjectCode}
                  <span style={{ 
                    fontSize: '10px', 
                    marginLeft: '4px',
                    fontWeight: 'normal',
                    opacity: 0.8,
                    color: '#666'
                  }}>
                    {getLabGroupLabel(classData, group)}
                  </span>
                </div>
                
                {/* Class Type */}
                <div style={{ 
                  fontSize: '10px',
                  color: '#666',
                  marginBottom: '1px'
                }}>
                  [{getClassTypeText(group.classType)}]
                </div>
                
                {/* Teacher */}
                {!teacherViewMode && !isRoomViewMode && (
                  <div style={{ 
                    fontSize: '10px',
                    color: '#666',
                    marginBottom: '1px'
                  }}>
                    {Array.isArray(group.teacherShortNames) 
                      ? group.teacherShortNames.join(', ')
                      : group.teacherShortNames || 'TBA'}
                  </div>
                )}
                
                {/* Room - only show if not in room view mode */}
                {!isRoomViewMode && (
                  <div style={{ 
                    fontSize: '10px',
                    color: '#666'
                  }}>
                    {group.roomName || 'TBA'}
                  </div>
                )}
                
                {/* Program-Semester-Section - show in room view mode */}
                {isRoomViewMode && group.programSemesterSection && (
                  <div style={{ 
                    fontSize: '9px',
                    color: '#666',
                    marginBottom: '1px'
                  }}>
                    {group.programSemesterSection}
                  </div>
                )}
                
                {/* Teacher - show in room view mode */}
                {isRoomViewMode && (
                  <div style={{ 
                    fontSize: '9px',
                    color: '#666'
                  }}>
                    {Array.isArray(group.teacherShortNames) 
                      ? group.teacherShortNames.join(', ')
                      : group.teacherShortNames || group.teacherNames?.join(', ') || 'TBA'}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {/* Elective indicator for multi-group classes - displayed at the bottom */}
          {classData.isElectiveClass && (
            <div style={{ 
              display: 'flex',
              justifyContent: 'center',
              marginTop: '4px'
            }}>
              <span style={{ 
                fontSize: '8px', 
                padding: '2px 4px',
                backgroundColor: classData.electiveLabel === 'Elective 2' ? '#666' : '#666',
                color: '#fff',
                borderRadius: '3px',
                fontWeight: 'normal',
                textAlign: 'center'
              }}>
                {classData.electiveLabel || 'Elective'}
              </span>
            </div>
          )}
        </div>
      );
    }
    
    // Single group/class display (original logic)
    return (
      <div style={classCellContentStyle}>
        
        {/* Subject Name with Lab Group indicator */}
        <div style={{ 
          fontWeight: '600', 
          marginBottom: '3px',
          fontSize: '13px'
        }}>
          {classData.subjectName || classData.subjectCode}
          {/* Show lab group indicator for practical classes or alternative week classes */}
          {(classData.classType === 'P' || classData.isAlternativeWeek === true) && classData.labGroup && (
            <span style={{ 
              fontSize: '10px', 
              marginLeft: '4px',
              fontWeight: 'normal',
              opacity: 0.8,
              color: '#666'
            }}>
              {getLabGroupLabel(classData)}
            </span>
          )}
        </div>
        
        {/* Class Type */}
        <div style={{ 
          fontSize: '11px',
          color: '#666',
          marginBottom: '2px'
        }}>
          [{getClassTypeText(classData.classType)}]
        </div>
        
        {/* Teacher */}
        {!teacherViewMode && !isRoomViewMode && (
          <div style={{ 
            fontSize: '11px',
            color: '#666',
            marginBottom: '2px'
          }}>
            {Array.isArray(classData.teacherShortNames) 
              ? classData.teacherShortNames.join(', ')
              : classData.teacherShortNames || 'TBA'}
          </div>
        )}
        
        {/* Room - only show if not in room view mode */}
        {!isRoomViewMode && (
          <div style={{ 
            fontSize: '11px',
            color: '#666',
            marginBottom: classData.isElectiveClass ? '3px' : '0px'
          }}>
            {classData.roomName || 'TBA'}
          </div>
        )}
        
        {/* Program-Semester-Section - show in room view mode */}
        {isRoomViewMode && classData.programSemesterSection && (
          <div style={{ 
            fontSize: '10px',
            color: '#666',
            marginBottom: '2px'
          }}>
            {classData.programSemesterSection}
          </div>
        )}
        
        {/* Teacher - show in room view mode */}
        {isRoomViewMode && (
          <div style={{ 
            fontSize: '10px',
            color: '#666',
            marginBottom: classData.isElectiveClass ? '3px' : '0px'
          }}>
            {Array.isArray(classData.teacherShortNames) 
              ? classData.teacherShortNames.join(', ')
              : classData.teacherShortNames || classData.teacherNames?.join(', ') || 'TBA'}
          </div>
        )}
        
        {/* Elective indicator - displayed at the bottom */}
        {classData.isElectiveClass && (
          <div style={{ 
            display: 'flex',
            justifyContent: 'center',
            marginTop: '3px'
          }}>
            <span style={{ 
              fontSize: '9px', 
              padding: '2px 6px',
              backgroundColor: '#666',
              color: '#fff',
              borderRadius: '4px',
              fontWeight: 'normal',
              textAlign: 'center'
            }}>
              {classData.electiveLabel || 'Elective'}
            </span>
          </div>
        )}
        
      </div>
    );
  };

  const renderCell = (dayIndex, slotIndex) => {
    const normalizedSlotId = normalizeTimeSlotId(slotIndex);
    const timeSlot = findTimeSlotById(timeSlots, normalizedSlotId);
    const isBreak = timeSlot?.isBreak;
    const classData = getClassData(routineGridData, dayIndex, normalizedSlotId);

    if (isBreak) {
      return (
        <div style={{
          textAlign: 'center',
          fontStyle: 'italic',
          color: '#666',
          padding: '8px'
        }}>
          BREAK
        </div>
      );
    }

    return (
      <div style={{ padding: '8px' }}>
        {renderClassContent(classData)}
      </div>
    );
  };

  const handleSaveClass = async (classData) => {
    try {
      // Check if this is an elective class that was already saved
      if (classData.isElectiveClass && classData.crossSectionScheduled) {
        safeMessage.success('Elective class scheduled successfully for both sections!');
        
        // Refresh data to show the new elective
        await refetchRoutine();
        queryClient.invalidateQueries(['routine', programCode, semester, section]);
        
        onModalClose();
        return;
      }
      
      // Check if this is a multi-period class
      if (classData.isMultiPeriod && classData.slotIndexes && classData.slotIndexes.length > 1) {
        return await handleSaveSpannedClass(classData, classData.slotIndexes);
      }
      
      // Single-period class assignment - use slot ID directly
      const slotIndex = selectedSlot.slotIndex;
      
      const requestData = {
        ...classData,
        dayIndex: selectedSlot.dayIndex,
        slotIndex: parseInt(slotIndex) // Convert to integer for backend
      };
      
      await routinesAPI.assignClass(programCode, semester, section, requestData);
      safeMessage.success('Class assigned successfully!');
      
      // Refresh data
      await refetchRoutine();
      queryClient.invalidateQueries(['routine', programCode, semester, section]);
      
      onModalClose();
      
    } catch (error) {
      console.error('❌ Single-period save error:', error);
      
      if (error.response?.status === 409) {
        safeMessage.error('Schedule conflict detected. Please check teacher and room availability.');
      } else {
        safeMessage.error(error.message || 'Failed to assign class. Please try again.');
      }
    }
  };

  const handleSaveSpannedClass = async (classData, slotIndexes) => {
    try {
      // Convert slot IDs to integers for backend
      const validIndices = slotIndexes.map(slotId => {
        const slotIndex = parseInt(slotId);
        if (isNaN(slotIndex)) {
          throw new Error(`Invalid slot ID: ${slotId} - must be a number`);
        }
        return slotIndex;
      });

      console.log('✅ Using slot IDs directly as slot indices:', {
        original: slotIndexes,
        converted: validIndices
      });

      // Prepare data for backend
      const requestData = {
        ...classData,
        dayIndex: selectedSlot.dayIndex,
        slotIndexes: validIndices,
        programCode,
        semester,
        section
      };

      console.log('📤 Sending to backend:', requestData);

      // Send to backend
      await routinesAPI.assignClassSpanned(requestData);
      
      safeMessage.success(`Multi-period class assigned successfully across ${validIndices.length} periods!`);
      
      // Refresh data
      await refetchRoutine();
      
      // Invalidate cache
      queryClient.invalidateQueries(['routine', programCode, semester, section]);
      
      onModalClose();
      
    } catch (error) {
      console.error('❌ Multi-period save error:', error);
      
      if (error.response?.status === 409) {
        // Handle conflicts
        const conflict = error.response.data?.conflict;
        if (conflict) {
          let message = `Conflict detected in period ${conflict.slotIndex + 1}`;
          if (conflict.type === 'teacher') {
            message += `: Teacher ${conflict.teacherName} is already assigned`;
          } else if (conflict.type === 'room') {
            message += `: Room ${conflict.roomName} is already occupied`;
          } else {
            message += `: ${conflict.type} conflict`;
          }
          safeMessage.error(message);
        } else {
          safeMessage.error('Schedule conflict detected. Please check teacher and room availability.');
        }
      } else {
        safeMessage.error(error.message || 'Failed to assign multi-period class. Please try again.');
      }
    }
  };

  // Show loading or empty state
  if (!teacherViewMode && !isRoomViewMode && !demoMode && (!programCode || !semester || !section)) {
    return (
      <Card>
        <Empty 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Please select program, semester, and section to view routine"
        />
      </Card>
    );
  }

  if (routineLoading || timeSlotsLoading) {
    return (
      <Card>
        <div style={{ width: '100%', textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>Loading routine...</div>
        </div>
      </Card>
    );
  }

  if (!demoMode && routineError) {
    return (
      <Card>
        <Alert
          message="Error Loading Routine"
          description={routineError.response?.data?.message || routineError.message || 'Failed to load routine data'}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <style>{`
        .ag-cell-merged {
          background-color: #ffffff;
          box-shadow: 0 0 0 1px #d9d9d9;
          position: relative;
          z-index: 1;
        }
        
        .ag-cell-spanned-hidden {
          display: none;
        }
        

      `}</style>
      
      <Card 
        className="routine-grid-container"
        title={demoMode ? 'BCT - Semester 1 - Section A (Demo)' : 
              teacherViewMode ? 'Weekly Schedule' : 
              isRoomViewMode ? `${selectedRoom?.name || 'Room'} Weekly Schedule` :
              `${programCode} - Semester ${semester} - Section ${section}`}
        extra={
          <Space className="routine-actions">
            {!demoMode && !teacherViewMode && !isRoomViewMode && isEditable && (
              <Tooltip title="Clear Entire Routine">
                <Button 
                  type="default"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  onClick={handleClearEntireRoutine}
                  style={{ marginRight: '8px' }}
                >
                  Clear All
                </Button>
              </Tooltip>
            )}
            {!demoMode && !teacherViewMode && showExcelActions && (
              <ExcelActions
                programCode={programCode}
                semester={semester}
                section={section}
                allowImport={isEditable}
                allowExport={true}
                demoMode={demoMode}
                size="small"
                onImportSuccess={() => {
                  safeMessage.success('Routine imported successfully!');
                  queryClient.invalidateQueries(['routine', programCode, semester, section]);
                }}
                onImportError={(error) => {
                  safeMessage.error(error?.message || 'Failed to import routine');
                }}
                onExportSuccess={() => {
                  safeMessage.success('Routine exported successfully!');
                }}
                onExportError={(error) => {
                  safeMessage.error(error?.message || 'Failed to export routine');
                }}
              />
            )}
            {teacherViewMode && showExcelActions && selectedTeacher && (
              <TeacherExcelActions
                teacherId={selectedTeacher}
                teacherName={selectedTeacherInfo?.name || 'Teacher'}
              />
            )}
            {/* Undo Button */}
            {!demoMode && !teacherViewMode && !isRoomViewMode && isEditable && showUndoButton && lastDeletedClass && (
              <Button
                size="small"
                icon={<WarningOutlined />}
                onClick={handleUndoDelete}
                style={{
                  backgroundColor: '#f0f0f0',
                  borderColor: '#d9d9d9',
                  color: '#333'
                }}
              >
                Undo Delete
              </Button>
            )}
          </Space>
        }
      >
        <div className="routine-grid" style={{ overflowX: 'auto', marginTop: '7px', WebkitOverflowScrolling: 'touch' }}>
          <table className="routine-grid-table" style={{ 
            width: '100%', 
            borderCollapse: 'separate',
            borderSpacing: '0',
            minWidth: '1200px',
            tableLayout: 'fixed',
            border: '2px solid #666666',
            backgroundColor: '#ffffff'
          }}>
            <thead>
              <tr>
                <th className="day-time-header" style={{ 
                  padding: '12px', 
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: '#c0c0c0',
                  backgroundColor: '#ffffff',
                  fontWeight: '600',
                  textAlign: 'center',
                  width: '150px',
                  minWidth: '150px',
                  maxWidth: '150px',
                  fontSize: '13px',
                  color: '#333',
                  position: 'sticky',
                  left: 0,
                  top: 0,
                  zIndex: 25,
                  cursor: 'default', // Explicitly set non-interactive cursor
                  userSelect: 'none' // Prevent text selection
                }}>
                  <div style={{ fontWeight: '600', fontSize: '13px' }}>
                    Days / Time
                  </div>
                </th>
                {timeSlots.map((timeSlot, index) => (
                  <th 
                    key={`header-${timeSlot._id}-${index}`}
                    className="time-slot-header" 
                    style={{ 
                      padding: '12px 8px', 
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: '#c0c0c0',
                      backgroundColor: timeSlot.isBreak ? '#ffffff' : '#ffffff',
                      fontWeight: '600',
                      textAlign: 'center',
                      width: `calc((100% - 150px) / ${timeSlots.length})`,
                      minWidth: '160px',
                      fontSize: '12px',
                      color: '#333',
                      position: 'sticky',
                      top: 0,
                      zIndex: 15
                    }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      gap: '2px' 
                    }}>
                      <div style={{ fontWeight: '600', fontSize: '12px', color: '#333' }}>
                        {timeSlot.isBreak ? 'BREAK' : `${timeSlot.startTime} - ${timeSlot.endTime}`}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dayNames.map((dayName, dayIndex) => {
                return (
                  <tr key={dayIndex} className="day-row">
                    <td className="day-cell" style={{ 
                      padding: '12px', 
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: '#c0c0c0',
                      backgroundColor: '#ffffff',
                      fontWeight: '600',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      width: '150px',
                      minWidth: '150px',
                      maxWidth: '150px',
                      fontSize: '13px',
                      color: '#333',
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      cursor: 'default', // Explicitly set non-interactive cursor
                      userSelect: 'none' // Prevent text selection
                    }}>
                      <div style={{ fontWeight: '600', fontSize: '13px', color: '#333' }}>
                        {dayName}
                      </div>
                    </td>
                    {timeSlots.map((timeSlot, timeSlotIndex) => {
                    // Use centralized utility for consistent ID handling
                    const slotId = normalizeTimeSlotId(timeSlot._id);
                    // Get class data using utility function
                    const classData = getClassData(routineGridData, dayIndex, slotId);
                    
                    if (timeSlot.isBreak) {
                      return (
                        <td key={`${dayIndex}-${timeSlot._id}-${timeSlotIndex}`} className="break-cell" style={{
                          padding: '8px',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: '#c0c0c0',
                          backgroundColor: '#ffffff',
                          textAlign: 'center',
                          fontStyle: 'italic',
                          color: '#666',
                          height: '80px',
                          minWidth: '160px',
                          verticalAlign: 'middle',
                          fontSize: '12px'
                        }}>
                          BREAK
                        </td>
                      );
                    }

                    // CRITICAL FIX: Use normalized slotId consistently throughout
                    const isSpanMaster = classData?.spanMaster === true;
                    const isPartOfSpan = classData?.spanId != null;
                    
                    // Only calculate colspan for the span master
                    const colSpan = isSpanMaster ? 
                      calculateColSpan(classData, routineGridData[dayIndex], slotId) : 1;
                    
                    // Check if this cell should be hidden because it's covered by a previous span master
                    // We need to check all previous slots in the same day to see if any span master covers this slot
                    let isHiddenBySpan = false;
                    if (isPartOfSpan && !isSpanMaster) {
                      // Check if there's a span master that covers this cell
                      const spanMasterId = classData.spanId;
                      // Find the span master for this span group
                      const spanMaster = Object.values(routineGridData[dayIndex] || {}).find(
                        cell => cell?.spanId === spanMasterId && cell?.spanMaster === true
                      );
                      
                      if (spanMaster) {
                        isHiddenBySpan = true;
                      }
                    }
                    
                    if (isHiddenBySpan) {
                      return null;
                    }
                    
                    return (
                      <td 
                        key={`${dayIndex}-${timeSlot._id}-${timeSlotIndex}`} 
                        className={`routine-cell ${classData ? 'has-content' : 'empty-content'} ${isSpanMaster ? 'span-master' : ''} ${classData?.isMultiGroup ? 'multi-group' : ''} ${classData?.isAlternativeWeek === true ? 'alternate-weeks' : ''}`}
                        style={{ 
                          padding: '0', 
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: '#c0c0c0',
                          verticalAlign: 'top',
                          backgroundColor: classData ? '#ffffff' : '#ffffff',
                          height: classData?.isMultiGroup ? '120px' : '80px', // Taller for multi-group slots
                          minWidth: '160px',
                          cursor: (isEditable && !demoMode && !teacherViewMode && !isRoomViewMode) || 
                                  (isRoomViewMode && onCellDoubleClicked) ? 'pointer' : 'default',
                          position: 'relative',
                          ...(isSpanMaster ? { 
                            backgroundColor: '#ffffff',
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            borderColor: '#c0c0c0'
                          } : {})
                        }}
                        colSpan={colSpan > 1 ? colSpan : undefined}
                        onClick={() => {
                          if (isEditable && !demoMode && !teacherViewMode && !isRoomViewMode) {
                            // Use already normalized slotId consistently
                            handleSlotClick(dayIndex, slotId);
                          }
                        }}
                        onDoubleClick={(!teacherViewMode && !isRoomViewMode) && onCellDoubleClicked ? 
                          () => onCellDoubleClicked(dayIndex, slotId, classData) : 
                          (isRoomViewMode && onCellDoubleClicked) ?
                          () => onCellDoubleClicked(dayIndex, slotId, classData) :
                          undefined}
                      >
                        <div style={{ padding: '10px', height: '100%', position: 'relative' }}>
                          {renderClassContent(classData)}
                          {/* Show program-semester-section in teacher view mode */}
                          {teacherViewMode && classData && classData.programSemesterSection && (
                            <div style={{ 
                              fontSize: '10px', 
                              color: '#666', 
                              marginTop: '4px',
                              borderTop: '1px dashed #ddd',
                              paddingTop: '2px'
                            }}>
                              {classData.programSemesterSection}
                            </div>
                          )}
                          {(() => {
                            // Fixed: Use consistent slot ID and ensure proper conditions
                            return isEditable && !demoMode && !teacherViewMode && !isRoomViewMode && !classData && !timeSlot.isBreak && (
                              <div style={{ 
                                height: '100%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                color: '#bfbfbf',
                                fontSize: '12px'
                              }}>
                                <div style={{ 
                                  textAlign: 'center',
                                  padding: '8px',
                                  border: '2px dashed #e6e6e6',
                                  borderRadius: '6px',
                                  backgroundColor: '#fafafa',
                                  transition: 'all 0.2s ease'
                                }}>
                                  <div style={{ fontSize: '10px', marginBottom: '4px' }} />
                                  <div style={{ fontSize: '10px' }}>Add Class</div>
                                  <div style={{ fontSize: '9px', marginTop: '2px', color: '#aaa' }}>
                                    {`${timeSlot.startTime}-${timeSlot.endTime}`}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
        
        {/* Enhanced Empty State */}
        {!demoMode && !teacherViewMode && !isRoomViewMode && isEditable && 
         routineGridData && Object.values(routineGridData).every(day => 
           !day || Object.keys(day).length === 0
         ) && (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            backgroundColor: '#fafafa',
            borderRadius: '8px',
            border: '2px dashed #d9d9d9',
            margin: '20px 0'
          }}>
            <CalendarOutlined style={{ fontSize: '48px', color: '#bfbfbf', marginBottom: '16px' }} />
            <div style={{ fontSize: '18px', fontWeight: '500', color: '#595959', marginBottom: '8px' }}>
              No Classes Scheduled
            </div>
            <div style={{ fontSize: '14px', color: '#8c8c8c', marginBottom: '16px' }}>
              Click on any time slot to start building your routine
            </div>
            <Space direction="vertical" size="small">
              <div style={{ fontSize: '12px', color: '#bfbfbf' }}>
                 Tip: You can also import an existing routine using the import button above
              </div>
            </Space>
          </div>
        )}
      </Card>

      {!teacherViewMode && (
        <AssignClassModal
          visible={assignModalVisible}
          onCancel={onModalClose}
          onSave={handleSaveClass}
          onClear={handleClearClass}
          programCode={programCode}
          semester={semester}
          section={section}
          dayIndex={selectedSlot.dayIndex}
          slotIndex={selectedSlot.slotIndex}
          timeSlots={timeSlots}
          existingClass={existingClass}
          loading={clearClassMutation.isLoading}
        />
      )}
    </Space>
  );
};

export default RoutineGrid;
