import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Select,
  Space,
  Typography,
  Alert,
  Tag,
  Spin,
  Row,
  Col,
  message,
  Button,
  Statistic,
  Empty,
  App,
  Progress,
  Modal,
  Tooltip
} from 'antd';
import {
  HomeOutlined,
  BookOutlined,
  UserOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  BuildOutlined,
  TeamOutlined,
  CalendarOutlined,
  SyncOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
  BugOutlined
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { roomsAPI, timeSlotsAPI, routineSlotsAPI } from '../services/api';
import RoutineGrid from './RoutineGrid';
import RoomPDFActions from './RoomPDFActions';
import SemesterGroupToggle from './SemesterGroupToggle';
import { SemesterGroupProvider } from '../contexts/SemesterGroupContext';
import { useFilteredRoutine } from '../hooks/useFilteredRoutine';
import { useRoutineChangeListener, nukeAllRoutineRelatedCaches } from '../utils/robustCacheInvalidation';
import { fetchRoomScheduleDirectly, flushAllCaches } from '../utils/debugRoutine';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * RoomScheduleManager - Component for viewing and managing room schedules
 * 
 * Features:
 * - Modern UI with consistent styling matching program routine manager
 * - Interactive room selection with detailed information display
 * - Visual grid display of room schedule
 * - Refreshable data with cache management
 * 
 * @component
 */
const RoomScheduleManagerContent = () => {
  const queryClient = useQueryClient();
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isDebugMode, setIsDebugMode] = useState(false); // Added debug mode toggle
  const [directApiData, setDirectApiData] = useState(null); // Store data from direct API call
  
  const forceRefresh = () => setRefreshKey(prev => prev + 1);
  
  // Use the new robust routine change listener
  useRoutineChangeListener(queryClient, (changeData) => {
    console.log('🔔 Room schedule detected routine change:', changeData);
    
    // If this change affects the selected room, force refresh
    if (selectedRoomId && changeData.roomId === selectedRoomId) {
      console.log('🔄 Forcing room schedule refresh due to relevant change');
      forceRefresh();
    }
  });
  
  // Fetch all rooms
  const { 
    data: roomsData, 
    isLoading: roomsLoading,
    error: roomsError
  } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomsAPI.getRooms(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch time slots
  const { 
    data: timeSlotsData, 
    isLoading: timeSlotsLoading 
  } = useQuery({
    queryKey: ['timeSlots'],
    queryFn: () => timeSlotsAPI.getTimeSlots(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Get the basic data first
  const rooms = roomsData?.data?.data || [];
  const timeSlots = timeSlotsData?.data || [];

  // Special handling for Room BCT AB issue
  const checkForRoomBCTAB = useCallback(async (roomId) => {
    // Check if this is the room with synchronization issues (BCT AB)
    const room = rooms.find(r => r._id === roomId);
    if (roomId && room && room.name === 'BCT AB') {
      console.log('🔍 Special debug for Room BCT AB enabled');
      setIsDebugMode(true);
      
      try {
        // Make direct API request to compare with cached data
        const directData = await fetchRoomScheduleDirectly(roomId);
        setDirectApiData(directData);
        
        // Log detailed comparison
        console.log('📊 Comparison between direct API and React Query data:');
        console.log('Direct API data:', directData);
        
        // Return the data for potential use
        return directData;
      } catch (error) {
        console.error('Error in direct API request:', error);
      }
    } else {
      setIsDebugMode(false);
      setDirectApiData(null);
    }
  }, [rooms]);
  
  // Super flush function for debug - completely clears all caches
  const handleSuperFlush = async () => {
    if (await nukeAllRoutineRelatedCaches(queryClient)) {
      message.success('All cache data flushed! Fresh data will be fetched.');
      setRefreshKey(prevKey => prevKey + 1);
    } else {
      message.error('Failed to flush caches. Check console for details.');
    }
  };

  // Fetch room schedule directly from the public API endpoint
  const {
    data: roomScheduleData,
    isLoading: roomScheduleLoading,
    error: roomScheduleError,
    refetch: refetchRoomSchedule
  } = useQuery({
    queryKey: ['roomSchedule', selectedRoomId, refreshKey],
    queryFn: async () => {
      if (!selectedRoomId) {
        console.log('🔍 Room schedule query - no room selected');
        return Promise.resolve(null);
      }
      
      try {
        console.log('🔍 Fetching room schedule for room:', selectedRoomId);
        
        // Use the public room schedule endpoint
        const response = await fetch(`/api/routines/rooms/${selectedRoomId}/schedule`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch room schedule: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('� Room schedule API response:', data);
        
        // The API should return the schedule data in the expected format
        return data;
      } catch (error) {
        console.error('Error fetching room schedule:', error);
        throw new Error(`Failed to fetch room schedule: ${error.message}`);
      }
    },
    enabled: !!selectedRoomId,
    staleTime: 60000, // Cache for 1 minute
    retry: 1, // Only retry once on failure
    onError: (error) => {
      // Show error message to user
      message.error(`Failed to load room schedule: ${error.message}`);
    }
  });

  // Debug logging for query enablement
  console.log('🔍 Room schedule query enablement check:', {
    selectedRoomId: !!selectedRoomId,
    timeSlotsLength: timeSlots.length,
    isEnabled: !!selectedRoomId,
    roomScheduleLoading,
    roomScheduleError,
    roomScheduleData
  });
  
  // Use the filtered routine hook for semester-based filtering
  const { filteredRoutine, stats: filteredStats, isFiltered } = useFilteredRoutine(
    roomScheduleData?.data, 
    { 
      enabled: true, // Always apply filtering for room views
      forRoomView: true 
    }
  );

  // Use filtered routine for display
  const displayRoomSchedule = filteredRoutine ? { data: filteredRoutine } : roomScheduleData;
  
  // Format rooms for select dropdown
  const roomOptions = rooms.map(room => ({
    value: room._id,
    label: `${room.name}${room.capacity ? ` (${room.capacity} seats)` : ''}${room.building ? ` - ${room.building}` : ''}${room.isLab ? ' [Lab]' : ''}`,
    isLab: room.isLab
  }));
  
  // Update selected room object when room ID changes
  useEffect(() => {
    if (selectedRoomId && rooms.length > 0) {
      const room = rooms.find(r => r._id === selectedRoomId);
      setSelectedRoom(room);
    } else {
      setSelectedRoom(null);
    }
  }, [selectedRoomId, rooms]);
  
  // Debug effect to compare direct API data with React Query data
  useEffect(() => {
    if (directApiData && roomScheduleData) {
      console.log('🔍 COMPARING DIRECT API DATA VS REACT QUERY DATA:');
      
      // Check if direct API data has the specific Sunday 10:15-11:55 class
      const directSundayData = directApiData.data?.routine?.['0'] || 
                              directApiData.routine?.['0'] || 
                              directApiData.data?.data?.routine?.['0'];
                              
      const querySundayData = roomScheduleData.routine?.['0'] || 
                              roomScheduleData.data?.routine?.['0'] ||
                              roomScheduleData.data?.data?.routine?.['0'];
      
      console.log('Direct API Sunday data:', directSundayData);
      console.log('React Query Sunday data:', querySundayData);
      
      // Compare the keys (time slots)
      const directKeys = directSundayData ? Object.keys(directSundayData) : [];
      const queryKeys = querySundayData ? Object.keys(querySundayData) : [];
      
      console.log('Direct API time slots:', directKeys);
      console.log('React Query time slots:', queryKeys);
      
      // Check for differences
      const missingInQueryData = directKeys.filter(key => !queryKeys.includes(key));
      const extraInQueryData = queryKeys.filter(key => !directKeys.includes(key));
      
      if (missingInQueryData.length > 0) {
        console.log('❌ Slots missing in React Query data:', missingInQueryData);
        missingInQueryData.forEach(key => {
          console.log(`Missing slot ${key} data:`, directSundayData[key]);
        });
      }
      
      if (extraInQueryData.length > 0) {
        console.log('⚠️ Extra slots in React Query data:', extraInQueryData);
      }
      
      if (missingInQueryData.length === 0 && extraInQueryData.length === 0) {
        console.log('✅ Both datasets have the same time slots for Sunday');
      }
      
      // Check for specific focus class - Sunday at 10:15-11:55 with Teacher BA
      if (directSundayData) {
        Object.entries(directSundayData).forEach(([slotKey, slotData]) => {
          if (slotData && 
              ((slotData.startTime && slotData.startTime.includes('10:15')) ||
               (slotData.timeSlot && slotData.timeSlot.startTime && slotData.timeSlot.startTime.includes('10:15')))) {
            console.log('🎯 FOUND TARGET CLASS IN DIRECT API:', slotData);
            
            // Check if teacher BA is assigned
            const teacherIds = slotData.teacherIds || [];
            const teacherNames = slotData.teacherNames || [];
            console.log('Teacher IDs:', teacherIds);
            console.log('Teacher Names:', teacherNames);
            
            // See if any teacher name contains "BA"
            const hasBATeacher = teacherNames.some(name => name.includes('BA'));
            if (hasBATeacher) {
              console.log('✅ TARGET CLASS FOUND - Teacher BA on Sunday 10:15-11:55');
            }
          }
        });
      }
    }
  }, [directApiData, roomScheduleData]);

  const handleRoomChange = async (roomId) => {
    setSelectedRoomId(roomId);
    
    // Use nuclear cache invalidation to ensure fresh data
    await nukeAllRoutineRelatedCaches(queryClient);
    
    // Check if this is Room BCT AB to enable special debugging
    await checkForRoomBCTAB(roomId);
  };

  const handleRefresh = async () => {
    if (selectedRoomId) {
      console.log('🔄 Manually refreshing room schedule data...');
      
      // Use nuclear cache invalidation to completely clear all caches
      await nukeAllRoutineRelatedCaches(queryClient);
      
      // Force refresh by incrementing the refresh key
      forceRefresh();
      
      // Also explicitly refetch room schedule
      refetchRoomSchedule();
      
      // If debug mode is on, make a direct API call
      if (isDebugMode && selectedRoomId) {
        checkForRoomBCTAB(selectedRoomId);
      }
      
      // Show loading message
      message.loading({
        content: 'Refreshing room schedule data...',
        key: 'refreshMessage',
        duration: 1
      });
      
      // After a short delay, show success message
      setTimeout(() => {
        message.success({
          content: 'Room schedule refreshed successfully!',
          key: 'refreshMessage',
          duration: 2
        });
      }, 1000);
    }
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Calculate schedule statistics
  const calculateStats = () => {
    // Use filtered stats if filtering is applied
    if (isFiltered) {
      return {
        totalClasses: filteredStats.totalClasses,
        busyDays: filteredStats.busyDays,
        programs: [], // This would need to be calculated from filtered data
        utilizationRate: Math.round((filteredStats.totalClasses / (6 * timeSlots.length)) * 100)
      };
    }

    // Handle cases where data might not be available
    if (!displayRoomSchedule || !displayRoomSchedule.data || !displayRoomSchedule.data.routine) {
      return { totalClasses: 0, busyDays: 0, programs: [], utilizationRate: 0 };
    }

    const routine = displayRoomSchedule.data.routine;
    
    // Count total classes and busy days
    let totalClasses = 0;
    const busyDays = new Set();
    const programs = new Set();
    
    Object.entries(routine).forEach(([dayIndex, slots]) => {
      if (slots && Object.keys(slots).length > 0) {
        let hasClasses = false;
        
        Object.entries(slots).forEach(([timeSlotId, classInfo]) => {
          if (classInfo) {
            totalClasses++;
            hasClasses = true;
            
            // Add to programs set if program code exists
            if (classInfo.programCode) {
              programs.add(classInfo.programCode);
            }
          }
        });
        
        if (hasClasses) {
          busyDays.add(parseInt(dayIndex));
        }
      }
    });
    
    // Calculate utilization rate (assuming 6 days, and time slots that are not breaks)
    const nonBreakSlots = timeSlots.filter(slot => !slot.isBreak).length;
    const totalPossibleSlots = 6 * nonBreakSlots; // 6 days per week
    const utilizationRate = totalPossibleSlots > 0 
      ? Math.round((totalClasses / totalPossibleSlots) * 100) 
      : 0;
    
    return {
      totalClasses,
      busyDays: busyDays.size,
      programs: Array.from(programs),
      utilizationRate
    };
  };

  const stats = calculateStats();

  // Use App.useApp for proper context support
  // Using App hooks for notifications and modals
  const { modal, notification, message: contextMessage } = App.useApp();
  
  // Prepare room data for RoutineGrid
  const prepareRoomDataForRoutineGrid = () => {
    console.log('🔍 PrepareRoomDataForRoutineGrid called:', {
      hasRoomScheduleData: !!displayRoomSchedule,
      hasSelectedRoom: !!selectedRoom,
      roomScheduleLoading: roomScheduleLoading,
      selectedRoomId: selectedRoomId,
      displayRoomSchedule: displayRoomSchedule,
      selectedRoom: selectedRoom
    });
    
    if (!selectedRoom) {
      console.log('❌ No selected room');
      return null;
    }
    
    if (!displayRoomSchedule || !displayRoomSchedule.data) {
      console.log('❌ No room schedule data or data structure');
      return null;
    }

    // Initialize structure if it's the fallback empty data
    const routine = displayRoomSchedule.data?.routine || {};
    
    // console.log('🔍 Room Schedule Data Debug:', {
    //   roomScheduleData: roomScheduleData,
    //   routine: routine,
    //   selectedRoom: selectedRoom,
    //   timeSlots: timeSlots,
    //   routineKeys: Object.keys(routine),
    //   routineEntries: Object.entries(routine).map(([day, slots]) => ({
    //     day,
    //     slotsCount: Object.keys(slots || {}).length,
    //     slots: slots
    //   }))
    // });
    
    // Return data in the same format as used by TeacherScheduleManager
    // This ensures consistency with the existing RoutineGrid component
    return {
      // Program context (null for room view)
      programCode: null,
      semester: null,
      section: null,
      
      // The main routine data organized by day and timeslot
      routine: routine,
      
      // Room context for display
      room: selectedRoom,
      
      // Additional metadata
      metadata: {
        viewType: 'room',
        roomName: selectedRoom?.name || 'Selected Room',
        roomId: selectedRoomId,
        building: selectedRoom?.building || '',
        capacity: selectedRoom?.capacity || '',
        type: selectedRoom?.type || 'Standard',
        isLab: selectedRoom?.isLab || false
      }
    };
  };
  
  // Handle cell click for viewing class details
  const handleCellClick = (dayIndex, timeSlotId, existingClassData = null) => {
    if (!existingClassData) return; // Only show details for classes that exist
    
    console.log('🔍 Cell click debug:', {
      dayIndex,
      timeSlotId,
      existingClassData,
      selectedRoom: selectedRoom?.name
    });
    
    // Get the time slot information
    const timeSlot = timeSlots.find(slot => slot._id === timeSlotId);
    
    // Format teacher names for display
    let teacherNames = [];
    
    // Handle different data structures for teachers
    if (existingClassData.teacherNames && Array.isArray(existingClassData.teacherNames)) {
      teacherNames = existingClassData.teacherNames;
    } else if (existingClassData.teachers && Array.isArray(existingClassData.teachers)) {
      teacherNames = existingClassData.teachers.map(t => typeof t === 'object' ? (t.name || t.fullName || t.shortname) : t);
    } else if (typeof existingClassData.teacherNames === 'string') {
      teacherNames = [existingClassData.teacherNames];
    }
    
    // Get class type display
    const getClassTypeDisplay = (type) => {
      if (!type) return 'Lecture';
      
      switch(type) {
        case 'P': return 'Practical';
        case 'T': return 'Tutorial';
        case 'L': return 'Lecture';
        default: return type;
      }
    };
    
    // Get subject name from different possible properties
    const subjectName = existingClassData.subjectName || 
                        existingClassData.name || 
                        existingClassData.subject ||
                        'N/A';
    
    // Format program-semester-section
    const programDisplay = (existingClassData.programCode || existingClassData.program || 'N/A');
    const semesterDisplay = existingClassData.semester || 'N/A';
    const sectionDisplay = existingClassData.section || 'N/A';
    
    modal.info({
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CalendarOutlined style={{ color: '#1890ff' }} />
          <span>Class Details - {selectedRoom?.name}</span>
        </div>
      ),
      content: (
        <div style={{ padding: '16px 0' }}>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card 
                bordered={false} 
                style={{ 
                  background: 'linear-gradient(135deg, #f6f9fe 0%, #f0f4ff 100%)',
                  borderRadius: '8px'
                }}
              >
                <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '4px' }}> {/* Increased from 18px to 20px */}
                  {subjectName}
                </div>
                <div style={{ fontSize: '16px', color: '#666' }}> {/* Increased from 14px to 16px */}
                  {programDisplay}-{semesterDisplay}-{sectionDisplay}
                </div>
              </Card>
            </Col>
            
            <Col span={12}>
              <div style={{ fontSize: '16px', color: '#888', marginBottom: '4px' }}> {/* Increased from 14px to 16px */}
                Day
              </div>
              <div style={{ fontSize: '17px', fontWeight: '500' }}> {/* Increased from 15px to 17px */}
                {dayNames[dayIndex] || 'N/A'}
              </div>
            </Col>
            
            <Col span={12}>
              <div style={{ fontSize: '14px', color: '#888', marginBottom: '4px' }}>
                Time
              </div>
              <div style={{ fontSize: '17px', fontWeight: '500' }}> {/* Increased from 15px to 17px */}
                {timeSlot ? `${timeSlot.startTime} - ${timeSlot.endTime}` : 'N/A'}
              </div>
            </Col>
            
            <Col span={12}>
              <div style={{ fontSize: '16px', color: '#888', marginBottom: '4px' }}> {/* Increased from 14px to 16px */}
                Room
              </div>
              <div style={{ fontSize: '17px', fontWeight: '500' }}> {/* Increased from 15px to 17px */}
                {selectedRoom?.name || 'N/A'}
              </div>
            </Col>
            
            <Col span={12}>
              <div style={{ fontSize: '16px', color: '#888', marginBottom: '4px' }}> {/* Increased from 14px to 16px */}
                Class Type
              </div>
              <div style={{ fontSize: '17px', fontWeight: '500' }}> {/* Increased from 15px to 17px */}
                {getClassTypeDisplay(existingClassData.classType)}
              </div>
            </Col>
            
            <Col span={24}>
              <div style={{ fontSize: '14px', color: '#888', marginBottom: '8px' }}>
                Teachers
              </div>
              {teacherNames.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {teacherNames.map((teacher, idx) => (
                    <Tag 
                      color="blue" 
                      icon={<UserOutlined />} 
                      key={idx}
                    >
                      {teacher}
                    </Tag>
                  ))}
                </div>
              ) : (
                <Text type="secondary">No teachers assigned</Text>
              )}
            </Col>
            
            {existingClassData.isLab && existingClassData.labGroups && existingClassData.labGroups.length > 0 && (
              <Col span={24}>
                <div style={{ fontSize: '14px', color: '#888', marginBottom: '8px' }}>
                  Lab Groups
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {existingClassData.labGroups.map((group, idx) => (
                    <Tag 
                      color="green" 
                      icon={<TeamOutlined />} 
                      key={idx}
                    >
                      {group}
                    </Tag>
                  ))}
                </div>
              </Col>
            )}
            
            {existingClassData.notes && (
              <Col span={24}>
                <div style={{ fontSize: '14px', color: '#888', marginBottom: '4px' }}>
                  Notes
                </div>
                <div style={{ 
                  background: '#fffbe6', 
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ffe58f'
                }}>
                  {existingClassData.notes}
                </div>
              </Col>
            )}
          </Row>
        </div>
      ),
      width: 550
    });
  };

  return (
    <App>
      <div className="room-schedule-manager mobile-stack-vertical" style={{ background: '#f5f7fa', minHeight: '100vh', padding: '24px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: '1800px', margin: '0 auto' }}>
        
        {/* Modern Header Section */}
        <Card 
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)',
            color: 'white'
          }}
        >
          <Row gutter={[32, 24]} align="middle" className="mobile-stack">
            <Col xs={24} lg={14}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} className="mobile-stack-vertical mobile-center">
                  <div className="mobile-center">
                    <Title level={1} style={{ margin: 0, color: 'white', fontSize: '32px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        padding: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '8px'
                      }}>
                        <HomeOutlined style={{ fontSize: '24px', color: 'white' }} />
                      </div>
                      Room Schedule Viewer
                    </Title>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '16px', fontWeight: '400', marginLeft: '60px' }}>
                      View classroom schedules and availability
                    </Text>
                  </div>
                </div>
              </Space>
            </Col>
            
            <Col xs={24} lg={10}>
              <div className="room-controls" style={{
                background: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '24px',
                backdropFilter: 'blur(10px)'
              }}>
                <Space direction="vertical" size="medium" style={{ width: '100%' }}>
                  <Text strong style={{ color: 'white', fontSize: '16px', display: 'block' }}>
                    Select Room
                  </Text>
                  
                  <Select
                    placeholder="Search and select a room to view its schedule"
                    style={{ width: '100%' }}
                    value={selectedRoomId}
                    onChange={handleRoomChange}
                    loading={roomsLoading}
                    size="large"
                    showSearch
                    optionFilterProp="label"
                    filterOption={(input, option) => {
                      const room = rooms.find(r => r._id === option.value);
                      if (!room) return false;
                      
                      const searchText = input.toLowerCase();
                      const roomName = (room.name || '').toLowerCase();
                      const building = (room.building || '').toLowerCase();
                      const roomType = room.isLab ? 'lab' : 'classroom';
                      
                      return roomName.includes(searchText) ||
                             building.includes(searchText) ||
                             roomType.includes(searchText) ||
                             (room.capacity && room.capacity.toString().includes(searchText));
                    }}
                    options={rooms.map(room => ({
                      value: room._id,
                      label: `${room.name}${room.capacity ? ` (${room.capacity} seats)` : ''}${room.building ? ` - ${room.building}` : ''}${room.isLab ? ' [Lab]' : ''}`,
                    }))}
                    notFoundContent={roomsLoading ? "Loading rooms..." : "No rooms available"}
                  >
                  </Select>

                  {selectedRoom && (
                    <Button 
                      type="default" 
                      icon={<ReloadOutlined />} 
                      onClick={handleRefresh}
                      loading={roomScheduleLoading}
                      style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        color: 'white',
                      }}
                      size="large"
                    >
                      Refresh Schedule
                    </Button>
                  )}
                </Space>
              </div>
            </Col>
          </Row>
        </Card>
        
        {/* Error Alert for Rooms Loading */}
        {roomsError && (
          <Alert
            message="Error Loading Rooms"
            description={roomsError.response?.data?.message || roomsError.message || 'Failed to load rooms. Please refresh the page or contact support.'}
            type="error"
            showIcon
            closable
            style={{ borderRadius: '8px' }}
            action={
              <Button size="small" onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
            }
          />
        )}

        {/* Room Details Card - Only visible when a room is selected */}
        {selectedRoom && (
          <Card 
            style={{
              borderRadius: '16px',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
            }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} md={16}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    width: '48px', 
                    height: '48px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <BuildOutlined style={{ fontSize: '20px', color: 'white' }} />
                  </div>
                  <div>
                    <Title level={3} style={{ margin: 0, color: '#1a1a1a', fontWeight: '600' }}>
                      {selectedRoom.name}
                    </Title>
                    <Text type="secondary" style={{ fontSize: '14px' }}>
                      {selectedRoom.building || 'Main Building'} 
                      {selectedRoom.floor && `, Floor ${selectedRoom.floor}`}
                      {selectedRoom.capacity && ` • ${selectedRoom.capacity} seats`}
                      {selectedRoom.type && ` • ${selectedRoom.type} room`}
                    </Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} md={8} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <Space>
                  {selectedRoom && (
                    <RoomPDFActions 
                      roomId={selectedRoomId} 
                      roomName={selectedRoom.name} 
                    />
                  )}
                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={handleRefresh}
                    loading={roomScheduleLoading}
                    style={{ borderRadius: '8px', height: '40px' }}
                  >
                    Refresh Data
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        )}
        
        {/* Semester Group Toggle - Only show when room is selected */}
        {selectedRoom && (
          <Card
            style={{
              borderRadius: '16px',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              background: 'white'
            }}
          >
            <Row gutter={[16, 16]} align="middle">
              <Col span={18}>
                <SemesterGroupToggle 
                  size="default"
                  showLabel={true}
                  showDescription={true}
                />
              </Col>
              <Col span={6}>
                {isFiltered && (
                  <div style={{ textAlign: 'right' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Filtered: {filteredStats.filteredFromTotal} classes hidden
                    </Text>
                  </div>
                )}
              </Col>
            </Row>
          </Card>
        )}
        
        {/* Room Schedule Grid Card */}
        {selectedRoomId ? (
          <Card
            style={{
              borderRadius: '16px',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              background: 'white'
            }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '8px',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CalendarOutlined style={{ fontSize: '16px', color: 'white' }} />
                </div>
                <div>
                  <span style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a' }}>
                    {selectedRoom?.name} Weekly Schedule
                  </span>
                </div>
              </div>
            }
            styles={{
              header: {
                borderBottom: '1px solid #f0f2f5',
                padding: '20px 24px'
              },
              body: {
                padding: '4px 8px'
              }
            }}
            extra={
              <Space wrap>
                {roomScheduleData && (
                  <Space size="large">
                    <Statistic 
                      title={<span style={{ fontSize: '13px' }}>Utilization</span>}
                      value={stats.utilizationRate}
                      suffix="%" 
                      valueStyle={{ color: '#667eea', fontSize: '18px' }}
                    />
                    <Statistic 
                      title={<span style={{ fontSize: '13px' }}>Classes</span>}
                      value={stats.totalClasses} 
                      valueStyle={{ color: '#667eea', fontSize: '18px' }}
                    />
                  </Space>
                )}
              </Space>
            }
          >
            {/* Display error if room schedule loading failed */}
            {roomScheduleError && (
              <div style={{ marginBottom: '16px' }}>
                <Alert
                  message="Error Loading Schedule"
                  description={roomScheduleError.response?.data?.message || roomScheduleError.message || 'Failed to load room schedule data'}
                  type="error"
                  showIcon
                  closable
                  style={{ borderRadius: '8px' }}
                />
              </div>
            )}
            
            {/* Display notice if using empty schedule due to missing endpoint */}
            {!roomScheduleError && roomScheduleData && roomScheduleData.data && 
              (!roomScheduleData.data.routine || Object.values(roomScheduleData.data.routine).every(day => Object.keys(day).length === 0)) && (
              <div style={{ marginBottom: '16px' }}>
                <Alert
                  message="Room Schedule Viewer"
                  description="Currently showing an empty schedule. This room doesn't have any classes assigned yet."
                  type="info"
                  showIcon
                  style={{ borderRadius: '8px' }}
                />
              </div>
            )}
            
            {/* Loading state */}
            {roomScheduleLoading && (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: '20px', color: '#666' }}>
                  Loading room schedule data...
                </div>
              </div>
            )}
            
            {/* Room schedule grid */}
            {!roomScheduleLoading && selectedRoom && (
              <div style={{ 
                background: 'white',
                borderRadius: '12px',
                padding: '4px 6px' 
              }}>
                {/* Debug info */}
                {/* {import.meta.env.DEV && (
                  <div style={{ 
                    padding: '8px', 
                    backgroundColor: '#f0f8ff', 
                    borderRadius: '4px', 
                    fontSize: '12px',
                    marginBottom: '8px'
                  }}>
                    <strong>Debug Info:</strong> 
                    {JSON.stringify({
                      hasRoutineData: !!prepareRoomDataForRoutineGrid(),
                      routineKeys: Object.keys(prepareRoomDataForRoutineGrid()?.routine || {}),
                      timeSlotCount: timeSlots.length,
                      selectedRoom: selectedRoom?.name,
                      hasRoomScheduleData: !!roomScheduleData,
                      roomScheduleLoading: roomScheduleLoading
                    }, null, 2)}
                  </div>
                )} */}
                
                {/* Show empty state or the grid */}
                {(() => {
                  const gridData = prepareRoomDataForRoutineGrid();
                  
                  if (!gridData) {
                    return (
                      <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Empty 
                          description="No schedule data available for this room" 
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      </div>
                    );
                  }
                  
                  return (
                    <RoutineGrid
                      // Don't pass program/semester/section for room view
                      programCode={null}
                      semester={null}
                      section={null}
                      
                      // Pass the room routine data directly
                      routineData={gridData}
                      
                      // Configure for room view mode
                      isEditable={false}
                      demoMode={false}
                      teacherViewMode={false}
                      showExcelActions={false}
                      showPDFActions={false} // PDF actions are handled separately above
                      
                      // Handle cell clicks for viewing class details
                      onCellDoubleClicked={handleCellClick}
                      
                      // Room-specific props
                      selectedRoom={selectedRoom}
                      viewType="room"
                      
                      // Additional props for room context
                      loading={roomScheduleLoading}
                    />
                  );
                })()}
              </div>
            )}
          </Card>
        ) : (
          <Card
            style={{
              borderRadius: '16px',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              background: 'white'
            }}
          >
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <HomeOutlined style={{ fontSize: '32px', color: 'white' }} />
              </div>
              
              <Title level={3} style={{ color: '#1a1a1a', marginBottom: '16px' }}>
                View Room Schedule
              </Title>
              
              <Text style={{ fontSize: '16px', color: '#666', display: 'block', marginBottom: '32px' }}>
                Select a room from the dropdown above to view its schedule
              </Text>

              <Row gutter={[24, 16]} style={{ maxWidth: '800px', margin: '0 auto' }}>
                <Col xs={24} md={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)',
                      borderRadius: '12px',
                      padding: '20px',
                      marginBottom: '12px'
                    }}>
                      <CalendarOutlined style={{ fontSize: '24px', color: '#667eea' }} />
                    </div>
                    <Text strong style={{ color: '#1a1a1a' }}>Weekly View</Text>
                    <div style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
                      Complete weekly schedule
                    </div>
                  </div>
                </Col>
                <Col xs={24} md={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #52c41a20 0%, #73d13d20 100%)',
                      borderRadius: '12px',
                      padding: '20px',
                      marginBottom: '12px'
                    }}>
                      <BuildOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
                    </div>
                    <Text strong style={{ color: '#1a1a1a' }}>Room Details</Text>
                    <div style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
                      Capacity and facilities
                    </div>
                  </div>
                </Col>
                <Col xs={24} md={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #fa8c1620 0%, #ffa94020 100%)',
                      borderRadius: '12px',
                      padding: '20px',
                      marginBottom: '12px'
                    }}>
                      <TeamOutlined style={{ fontSize: '24px', color: '#fa8c16' }} />
                    </div>
                    <Text strong style={{ color: '#1a1a1a' }}>Usage Stats</Text>
                    <div style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
                      Utilization analytics
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          </Card>
        )}
        
        {/* Room usage statistics */}
        {selectedRoom && roomScheduleData && stats.totalClasses > 0 && (
          <Card
            style={{
              borderRadius: '16px',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              background: 'white'
            }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '8px',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <TeamOutlined style={{ fontSize: '16px', color: 'white' }} />
                </div>
                <div>
                  <span style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a' }}>
                    Room Usage Statistics
                  </span>
                </div>
              </div>
            }
          >
            <Row gutter={[24, 24]}>
              <Col xs={24} sm={12} md={6}>
                <Card bordered={false} style={{ background: '#f9f9ff', borderRadius: '12px' }}>
                  <Statistic 
                    title="Total Classes" 
                    value={stats.totalClasses} 
                    prefix={<BookOutlined />} 
                    valueStyle={{ color: '#667eea' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card bordered={false} style={{ background: '#f9f9ff', borderRadius: '12px' }}>
                  <Statistic 
                    title="Utilization Rate" 
                    value={stats.utilizationRate} 
                    suffix="%" 
                    prefix={<ClockCircleOutlined />}
                    valueStyle={{ color: '#667eea' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card bordered={false} style={{ background: '#f9f9ff', borderRadius: '12px' }}>
                  <Statistic 
                    title="Active Days" 
                    value={stats.busyDays} 
                    prefix={<CalendarOutlined />}
                    valueStyle={{ color: '#667eea' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card bordered={false} style={{ background: '#f9f9ff', borderRadius: '12px' }}>
                  <Statistic 
                    title="Programs" 
                    value={stats.programs.length} 
                    prefix={<TeamOutlined />}
                    valueStyle={{ color: '#667eea' }}
                  />
                </Card>
              </Col>
            </Row>
            
            {stats.programs.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <Text strong style={{ display: 'block', marginBottom: '12px' }}>Programs Using This Room:</Text>
                <div>
                  {stats.programs.map(program => (
                    <Tag 
                      color="purple" 
                      key={program}
                      style={{ 
                        margin: '0 8px 8px 0', 
                        padding: '4px 10px',
                        borderRadius: '4px'
                      }}
                    >
                      {program}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </Space>
      </div>
    </App>
  );
};

// Main wrapper component with context provider
const RoomScheduleManager = () => {
  return (
    <SemesterGroupProvider>
      <RoomScheduleManagerContent />
    </SemesterGroupProvider>
  );
};

export default RoomScheduleManager;
