import React, { useState, useEffect, useCallback } from 'react';
import { Card, Select, Space, Typography, Alert, Spin, Button, Row, Col, Statistic, Tag, message } from 'antd';
import { UserOutlined, ReloadOutlined, BookOutlined, CalendarOutlined, ClockCircleOutlined, TeamOutlined, DownloadOutlined, BugOutlined, ExperimentOutlined, ReadOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { teachersAPI, timeSlotsAPI, routinesAPI } from '../services/api';
import RoutineGrid from './RoutineGrid';
import SemesterGroupToggle from './SemesterGroupToggle';
import { SemesterGroupProvider } from '../contexts/SemesterGroupContext';
import { useFilteredRoutine } from '../hooks/useFilteredRoutine';
import { useRoutineChangeListener, nukeAllRoutineRelatedCaches } from '../utils/robustCacheInvalidation';
import { fetchTeacherScheduleDirectly, flushAllCaches } from '../utils/debugRoutine';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * Teacher Schedule Manager Component
 * Displays teacher schedules using the same Excel-like grid as class routines
 */
const TeacherScheduleManagerContent = () => {
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const queryClient = useQueryClient();
  const [refreshKey, setRefreshKey] = useState(0); // Added refresh key for manual refresh
  const [isDebugMode, setIsDebugMode] = useState(false); // Added debug mode toggle
  const [directApiData, setDirectApiData] = useState(null); // Store data from direct API call
  
  // Use the new robust routine change listener
  useRoutineChangeListener(queryClient, (changeData) => {
    console.log('🔔 Teacher schedule detected routine change:', changeData);
    
    // If this change affects the selected teacher, force refresh
    if (selectedTeacher && changeData.teacherIds && changeData.teacherIds.includes(selectedTeacher)) {
      console.log('🔄 Forcing teacher schedule refresh due to relevant change');
      setRefreshKey(prev => prev + 1);
    }
  });
  
  // Special handling for Teacher BA issue
  const checkForTeacherBA = useCallback(async (teacherId) => {
    // If this is the teacher with synchronization issues, add special debug
    if (teacherId && teacherId.includes("BA")) {
      console.log('🔍 Special debug for Teacher BA enabled');
      setIsDebugMode(true);
      
      try {
        // Make direct API request to compare with cached data
        const directData = await fetchTeacherScheduleDirectly(teacherId);
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
  }, []);
  
  // Function to force refresh all data
  const handleRefresh = async () => {
    console.log('🔄 Manually refreshing teacher schedule data...');
    setRefreshKey(prevKey => prevKey + 1);
    
    // Use the nuclear cache invalidation option
    await nukeAllRoutineRelatedCaches(queryClient);
    
    // If debug mode is on, make a direct API call
    if (isDebugMode && selectedTeacher) {
      await checkForTeacherBA(selectedTeacher);
    }
    
    message.success('Schedule data refreshed!');
  };
  
  // Super flush function for debug - completely clears all caches
  const handleSuperFlush = async () => {
    if (await nukeAllRoutineRelatedCaches(queryClient)) {
      message.success('All cache data flushed! Fresh data will be fetched.');
      setRefreshKey(prevKey => prevKey + 1);
    } else {
      message.error('Failed to flush caches. Check console for details.');
    }
  };

  // Fetch teachers list from real API (same as routine manager)
  const { data: teachersData, isLoading: teachersLoading, error: teachersError } = useQuery({
    queryKey: ['teachers'],
    queryFn: teachersAPI.getAllTeachers,
    retry: 1,
    staleTime: 30000,
  });

  // Generate teacher schedule from routine data (same source as routine manager)
  const { 
    data: scheduleData, 
    isLoading: scheduleLoading, 
    error: scheduleError,
    refetch: refetchSchedule 
  } = useQuery({
    queryKey: ['teacher-schedule-from-routine', selectedTeacher, refreshKey], // Add refreshKey for forced updates
    queryFn: async () => {
      if (!selectedTeacher) return null;
      
      try {
        // Use the teacher schedule API which already generates from RoutineSlot data
        const response = await teachersAPI.getTeacherSchedule(selectedTeacher);
        
        // Log the raw response for debugging
        console.log('Raw teacher schedule response:', response);
        
        // The API response structure should have success and data properties
        // Handle both direct response and data.success patterns
        if (response && response.data && response.data.success === false) {
          throw new Error(response.data.message || 'Failed to load teacher schedule');
        }
        
        if (!response || (typeof response.success !== 'undefined' && !response.success)) {
          throw new Error(response?.message || 'Failed to load teacher schedule');
        }
        
        // The backend already returns data in the correct format
        return response;
      } catch (error) {
        console.error('Error in teacher schedule query:', error);
        throw error;
      }
    },
    enabled: !!selectedTeacher,
    staleTime: 1 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  // Fetch time slots from real API (same as routine manager)
  const { data: timeSlotsData } = useQuery({
    queryKey: ['timeSlots'],
    queryFn: () => timeSlotsAPI.getTimeSlots({ includeAll: 'true', includeGlobal: 'true' }),
    staleTime: 5 * 60 * 1000,
  });

  const teachers = teachersData?.data || [];
  const selectedTeacherInfo = teachers.find(t => t._id === selectedTeacher);
  const timeSlots = timeSlotsData?.data?.data || [];

  // Transform teacher schedule data to match EXACT routine manager format
  const routineData = React.useMemo(() => {
    // Check for data in both response formats (direct or nested)
    if (!scheduleData) return null;
    
    console.log('Raw scheduleData received:', scheduleData);
    
    // The backend now returns data in the exact same format as routine manager
    // Handle potential response structure variations
    let responseData;
    
    // Check various response structures that could be returned
    if (scheduleData.data?.data) {
      // API returns { data: { data: { ... } } }
      responseData = scheduleData.data.data;
      console.log('Using scheduleData.data.data structure');
    } else if (scheduleData.data) {
      // API returns { data: { ... } }
      responseData = scheduleData.data;
      console.log('Using scheduleData.data structure');
    } else {
      // Direct data structure
      responseData = scheduleData;
      console.log('Using direct scheduleData structure');
    }
    
    // If there's no data object at all, return null
    if (!responseData) {
      console.error('No valid response data found in API response');
      return null;
    }
    
    console.log('Response data structure:', responseData);
    
    // Since backend now returns data in the exact same format as routine manager,
    // we can use it directly without transformation
    const programCode = responseData.programCode || 'TEACHER_VIEW';
    const semester = responseData.semester || 'ALL';
    const section = responseData.section || 'ALL';
    const routine = responseData.routine || {};
    
    console.log('Extracted routine object:', routine);
    console.log('Routine days:', Object.keys(routine));
    
    // If there are days, log the content of the first day for deeper inspection
    const firstDay = Object.keys(routine)[0];
    if (firstDay) {
      console.log(`Sample day (${firstDay}) content:`, routine[firstDay]);
    }
    
    // Return in EXACT same structure as routine manager expects
    return {
      programCode,
      semester, 
      section,
      routine
    };
  }, [scheduleData]);

  // Use the filtered routine hook for semester-based filtering
  const { filteredRoutine, stats: filteredStats, isFiltered } = useFilteredRoutine(
    routineData, 
    { 
      enabled: true, // Always apply filtering for teacher views
      forTeacherView: true 
    }
  );

  // Use filtered routine for display
  const displayRoutine = filteredRoutine;

  // Add detailed diagnostic logging for troubleshooting
  // Extended diagnostic logging
  useEffect(() => {
    if (routineData) {
      console.log('--------- TEACHER SCHEDULE DIAGNOSTIC ---------');
      console.log('Current routineData structure:', routineData);
      
      if (routineData.routine) {
        const days = Object.keys(routineData.routine);
        console.log(`Routine has ${days.length} day entries`);
        
        days.forEach(day => {
          const slots = routineData.routine[day] || {};
          const slotKeys = Object.keys(slots);
          console.log(`Day ${day}: ${slotKeys.length} slots`);
          
          // Focus on Sunday (day index 0) and look for the 10:15-11:55 slot
          if (day === '0') {
            console.log('🔎 SUNDAY SCHEDULE DETAIL:', slots);
            // Find any slots that might match the 10:15-11:55 time range
            Object.entries(slots).forEach(([slotKey, slotData]) => {
              console.log(`Slot ${slotKey}:`, slotData);
              
              // Look for any slot that might contain the problem time
              if (slotData && (
                  (slotData.startTime && slotData.startTime.includes('10:15')) ||
                  (slotData.timeSlot && slotData.timeSlot.startTime && slotData.timeSlot.startTime.includes('10:15'))
              )) {
                console.log('🎯 FOUND POTENTIAL MATCHING SLOT FOR SUNDAY 10:15-11:55:', slotData);
              }
            });
          }
          
          if (slotKeys.length > 0) {
            const firstSlot = slots[slotKeys[0]];
            console.log(`Sample class data for day ${day}:`, firstSlot);
          }
        });
      }
      console.log('---------------------------------------------');
    }
  }, [routineData]);
  
  // Add effect to compare direct API data with React Query data
  useEffect(() => {
    if (directApiData && routineData) {
      console.log('🔍 COMPARING DIRECT API DATA VS REACT QUERY DATA:');
      
      // Check if direct API data has the specific Sunday 10:15-11:55 class
      const directSundayData = directApiData.data?.routine?.['0'] || directApiData.routine?.['0'];
      const querySundayData = routineData.routine?.['0'];
      
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
    }
  }, [directApiData, routineData]);
  
  // Show demo notice when using demo data - check if we have real API data
  const isUsingDemoData = !teachersData || teachersError;

  const handleTeacherChange = async (teacherId) => {
    setSelectedTeacher(teacherId);
    
    // First invalidate any existing queries
    queryClient.invalidateQueries(['teacher-schedule-from-routine', teacherId]);
    
    // Check if this is teacher BA to enable special debugging
    await checkForTeacherBA(teacherId);
  };

  // Calculate schedule statistics for the selected teacher  
  // Using the filtered routine data
  const scheduleStats = React.useMemo(() => {
    // Use filtered stats if filtering is applied
    if (isFiltered) {
      // We need to calculate theory and practical from filtered data
      let filteredTheoryClasses = 0;
      let filteredPracticalClasses = 0;
      
      // If we have access to filtered routine data, calculate the breakdown
      if (filteredRoutine?.routine) {
        Object.entries(filteredRoutine.routine).forEach(([dayIndex, daySlots]) => {
          if (daySlots && typeof daySlots === 'object') {
            Object.entries(daySlots).forEach(([slotIndex, classInfo]) => {
              if (classInfo && typeof classInfo === 'object') {
                if (classInfo.classType === 'P') {
                  filteredPracticalClasses++;
                } else {
                  filteredTheoryClasses++;
                }
              }
            });
          }
        });
      }
      
      return {
        ...filteredStats,
        theoryClasses: filteredTheoryClasses,
        practicalClasses: filteredPracticalClasses
      };
    }

    if (!displayRoutine?.routine) return { 
      totalClasses: 0, 
      uniqueSubjects: 0, 
      busyDays: 0, 
      totalHours: 0,
      theoryClasses: 0,
      practicalClasses: 0
    };

    // Log for debugging
    console.log('Calculating stats for routine data:', displayRoutine.routine);
    
    let totalClasses = 0;
    let theoryClasses = 0;
    let practicalClasses = 0;
    const uniqueSubjects = new Set();
    const busyDays = new Set();
    let totalHours = 0;

    try {
      // Now displayRoutine.routine uses numeric day indices (0-6) - same as routine manager
      Object.entries(displayRoutine.routine).forEach(([dayIndex, daySlots]) => {
        // Make sure daySlots is an object and not null/undefined
        if (daySlots && typeof daySlots === 'object') {
          const slotsForDay = Object.keys(daySlots);
          
          if (slotsForDay.length > 0) {
            busyDays.add(dayIndex);
            console.log(`Day ${dayIndex} has ${slotsForDay.length} slots`);
            
            Object.entries(daySlots).forEach(([slotIndex, classInfo]) => {
              // Ensure the class info is valid
              if (classInfo && typeof classInfo === 'object') {
                totalClasses++;
                totalHours += 1; // Assuming each slot is 1 hour
                
                // Count theory and practical classes based on classType
                if (classInfo.classType === 'P') { // Practical
                  practicalClasses++;
                } else { // All non-practical classes (L, T, or any other type) are theory
                  theoryClasses++;
                }
                
                // Extract subject name safely
                if (classInfo.subjectName) {
                  uniqueSubjects.add(classInfo.subjectName);
                } else if (classInfo.subjectCode) {
                  uniqueSubjects.add(classInfo.subjectCode);
                }
              }
            });
          }
        }
      });
    } catch (error) {
      console.error('Error calculating schedule statistics:', error);
    }

    return {
      totalClasses,
      theoryClasses,
      practicalClasses,
      uniqueSubjects: uniqueSubjects.size,
      busyDays: busyDays.size,
      totalHours
    };
  }, [displayRoutine, isFiltered, filteredStats]);

  return (
    <div className="teacher-schedule-manager" style={{ background: '#f5f7fa', minHeight: '100vh', padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: '1800px', margin: '0 auto' }}>
        
        {/* Backend Connection Notice */}
        {isUsingDemoData && (
          <Alert
            message=" Backend Connection Issue"
            description="Cannot connect to the backend server. Please ensure the backend is running and accessible to view real teacher data."
            type="error"
            showIcon
            style={{
              borderRadius: '12px',
              border: '1px solid #ff4d4f',
              background: 'linear-gradient(135deg, #fff2f0 0%, #ffebe6 100%)'
            }}
            closable
          />
        )}
        
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
          <Row gutter={[32, 24]} align="middle">
            <Col xs={24} lg={14}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <TeamOutlined style={{ fontSize: '24px', color: 'white' }} />
                  </div>
                  <div>
                    <Title level={1} style={{ margin: 0, color: 'white', fontSize: '32px', fontWeight: '700' }}>
                      Teacher Schedule Viewer
                    </Title>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '16px', fontWeight: '400' }}>
                      Professional schedule Viewer with real-time synchronization
                    </Text>
                  </div>
                </div>
              </Space>
            </Col>
            
            <Col xs={24} lg={10}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '24px',
                backdropFilter: 'blur(10px)'
              }}>
                <Space direction="vertical" size="medium" style={{ width: '100%' }}>
                  <Text strong style={{ color: 'white', fontSize: '16px', display: 'block' }}>
                     Select Teacher
                  </Text>
                  <Select
                    placeholder={isUsingDemoData ? " Backend not connected - No teachers available" : "Search and select a teacher..."}
                    style={{ width: '100%' }}
                    loading={teachersLoading}
                    onChange={handleTeacherChange}
                    value={selectedTeacher}
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) => {
                      const teacher = teachers.find(t => t._id === option.value);
                      if (!teacher) return false;
                      
                      const searchText = input.toLowerCase();
                      const fullName = (teacher.fullName || teacher.name || '').toLowerCase();
                      const department = (teacher.department || '').toLowerCase();
                      const designation = (teacher.designation || '').toLowerCase();
                      
                      return fullName.includes(searchText) ||
                             department.includes(searchText) ||
                             designation.includes(searchText);
                    }}
                    size="large"
                    disabled={isUsingDemoData}
                    styles={{
                      popup: {
                        root: {
                          borderRadius:'12px',
                          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
                          padding: '8px'
                        }
                      }
                    }}
                    // Custom display for selected value
                    optionLabelProp="label"
                  >
                    {teachers.map(teacher => (
                      <Option 
                        key={teacher._id} 
                        value={teacher._id}
                        label={
                          // Custom label for selected display - horizontal layout
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            maxWidth: '100%',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              flexShrink: 0
                            }}>
                              {(teacher.fullName || teacher.name).charAt(0).toUpperCase()}
                            </div>
                            <div style={{ 
                              overflow: 'hidden',
                              flex: 1,
                              minWidth: 0,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <span style={{ 
                                fontWeight: '600', 
                                color: '#1a1a1a',
                                fontSize: '14px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                flexShrink: 1
                              }}>
                                {teacher.fullName || teacher.name}
                              </span>
                              <span style={{ 
                                fontSize: '12px', 
                                color: '#667eea',
                                fontWeight: '500',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}>
                                • {teacher.department}
                              </span>
                            </div>
                          </div>
                        }
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 4px' }}>
                          <div style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: '50%',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}>
                            {(teacher.fullName || teacher.name).charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              fontWeight: '600', 
                              color: '#1a1a1a',
                              fontSize: '15px',
                              marginBottom: '2px'
                            }}>
                              {teacher.fullName || teacher.name}
                            </div>
                            <div style={{ 
                              fontSize: '13px', 
                              color: '#666',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <span style={{ 
                                background: '#667eea',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '500'
                              }}>
                                {teacher.department}
                              </span>
                              <span>
                                {teacher.designation || teacher.shortName}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Option>
                    ))}
                  </Select>
                  
                  {isUsingDemoData && (
                    <div style={{
                      background: 'rgba(255, 77, 79, 0.2)',
                      border: '1px solid rgba(255, 77, 79, 0.4)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      marginTop: '8px'
                    }}>
                      <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.9)' }}>
                         Backend not connected: Unable to load teachers from database
                      </Text>
                    </div>
                  )}
                </Space>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Teacher Info & Statistics Card */}
        {selectedTeacherInfo && (
          <Card
            style={{
              borderRadius: '16px',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              background: 'white'
            }}
          >
            <Row gutter={[32, 24]} align="middle">
              <Col xs={24} lg={12}>
                <Space direction="vertical" size="medium" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '50%',
                      width: '60px',
                      height: '60px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <UserOutlined style={{ fontSize: '24px', color: 'white' }} />
                    </div>
                    <div>
                      <Title level={3} style={{ margin: 0, color: '#1a1a1a', fontWeight: '600' }}>
                        {selectedTeacherInfo.fullName || selectedTeacherInfo.name}
                      </Title>
                      <Space wrap size="small" style={{ marginTop: '8px' }}>
                        <Tag color="blue" style={{ borderRadius: '20px', padding: '4px 12px', border: 'none' }}>
                           {selectedTeacherInfo.department}
                        </Tag>
                        <Tag color="green" style={{ borderRadius: '20px', padding: '4px 12px', border: 'none' }}>
                           {selectedTeacherInfo.designation}
                        </Tag>
                      </Space>
                    </div>
                  </div>
                </Space>
              </Col>
              
              <Col xs={24} lg={12}>
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <Card
                      size="small"
                      style={{
                        background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)',
                        border: 'none',
                        borderRadius: '12px',
                        textAlign: 'center'
                      }}
                    >
                      <Statistic
                        title="Total Classes"
                        value={scheduleStats.totalClasses}
                        prefix={<ClockCircleOutlined style={{ color: '#667eea' }} />}
                        valueStyle={{ color: '#667eea', fontWeight: '600' }}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card
                      size="small"
                      style={{
                        background: 'linear-gradient(135deg, #1890ff20 0%, #40a9ff20 100%)',
                        border: 'none',
                        borderRadius: '12px',
                        textAlign: 'center'
                      }}
                    >
                      <Statistic
                        title="Theory Classes"
                        value={scheduleStats.theoryClasses}
                        prefix={<ReadOutlined style={{ color: '#1890ff' }} />}
                        valueStyle={{ color: '#1890ff', fontWeight: '600' }}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card
                      size="small"
                      style={{
                        background: 'linear-gradient(135deg, #13c2c220 0%, #36cfc920 100%)',
                        border: 'none',
                        borderRadius: '12px',
                        textAlign: 'center'
                      }}
                    >
                      <Statistic
                        title="Practical Classes"
                        value={scheduleStats.practicalClasses}
                        prefix={<ExperimentOutlined style={{ color: '#13c2c2' }} />}
                        valueStyle={{ color: '#13c2c2', fontWeight: '600' }}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card
                      size="small"
                      style={{
                        background: 'linear-gradient(135deg, #52c41a20 0%, #73d13d20 100%)',
                        border: 'none',
                        borderRadius: '12px',
                        textAlign: 'center'
                      }}
                    >
                      <Statistic
                        title="Subjects"
                        value={scheduleStats.uniqueSubjects}
                        prefix={<BookOutlined style={{ color: '#52c41a' }} />}
                        valueStyle={{ color: '#52c41a', fontWeight: '600' }}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card
                      size="small"
                      style={{
                        background: 'linear-gradient(135deg, #fa8c1620 0%, #ffa94020 100%)',
                        border: 'none',
                        borderRadius: '12px',
                        textAlign: 'center'
                      }}
                    >
                      <Statistic
                        title="Active Days"
                        value={scheduleStats.busyDays}
                        suffix="/ 7"
                        prefix={<CalendarOutlined style={{ color: '#fa8c16' }} />}
                        valueStyle={{ color: '#fa8c16', fontWeight: '600' }}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card
                      size="small"
                      style={{
                        background: 'linear-gradient(135deg, #722ed120 0%, #c084fc20 100%)',
                        border: 'none',
                        borderRadius: '12px',
                        textAlign: 'center'
                      }}
                    >
                      <Statistic
                        title="Total Hours"
                        value={scheduleStats.totalHours}
                        suffix="hrs"
                        valueStyle={{ color: '#722ed1', fontWeight: '600' }}
                      />
                    </Card>
                  </Col>
                </Row>
              </Col>
            </Row>

            {/* Action Buttons */}
            {selectedTeacher && (
              <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <Space size="large">
                  <Button 
                    onClick={handleRefresh}
                    icon={<ReloadOutlined />}
                    loading={scheduleLoading}
                    size="large"
                    style={{
                      borderRadius: '12px',
                      height: '48px',
                      padding: '0 24px',
                      fontWeight: '500'
                    }}
                  >
                    🔄 Refresh Schedule
                  </Button>
                  
                  {/* Special debug options for Teacher BA issue */}
                  {isDebugMode && (
                    <Button 
                      onClick={handleSuperFlush}
                      icon={<BugOutlined />}
                      type="primary"
                      danger
                      size="large"
                      style={{
                        borderRadius: '12px',
                        height: '48px',
                        padding: '0 24px',
                        fontWeight: '500',
                        marginLeft: '12px'
                      }}
                    >
                      🧹 Super Flush Cache
                    </Button>
                  )}
                  
                  {/* Debug button to help diagnose issues */}
                  <Button 
                    onClick={() => {
                      console.log('--------- MANUAL DEBUG TRIGGERED ---------');
                      console.log('Current teacher ID:', selectedTeacher);
                      console.log('Current schedule data:', scheduleData);
                      console.log('Current routine data:', routineData);
                      
                      // Check if we have routine data
                      if (routineData?.routine) {
                        const days = Object.keys(routineData.routine);
                        console.log(`Routine has ${days.length} day entries`);
                        
                        // Check each day for slot data
                        days.forEach(day => {
                          const dayData = routineData.routine[day];
                          const slots = Object.keys(dayData || {});
                          console.log(`Day ${day} has ${slots.length} slots:`, slots);
                          
                          // Peek into slot contents
                          if (slots.length > 0) {
                            for (const slotKey of slots) {
                              const slotData = dayData[slotKey];
                              console.log(`  Slot ${slotKey}:`, {
                                subject: slotData.subjectName,
                                room: slotData.roomName,
                                teachers: slotData.teacherNames,
                                classType: slotData.classType,
                                programInfo: slotData.programSemesterSection
                              });
                            }
                          }
                        });
                      } else {
                        console.log('No routine data available for debugging');
                      }
                      
                      console.log('------------------------------------');
                    }}
                    size="large"
                    style={{
                      borderRadius: '12px',
                      height: '48px',
                      padding: '0 24px',
                      fontWeight: '500',
                      background: '#f0f0f0'
                    }}
                  >
                     Debug Info
                  </Button>
                </Space>
              </div>
            )}
          </Card>
        )}

        {/* Semester Group Toggle - Only show when teacher is selected */}
        {selectedTeacherInfo && (
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

        {/* Debug Panel for BA Teacher issue */}
        {isDebugMode && directApiData && (
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #f5222d 0%, #ff7a45 100%)',
                  borderRadius: '8px',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <BugOutlined style={{ fontSize: '16px', color: 'white' }} />
                </div>
                <div>
                  <span style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a' }}>
                    Debug Mode Active - Direct API Data
                  </span>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '2px' }}>
                    Special diagnostics for Teacher BA issue
                  </div>
                </div>
              </div>
            }
            style={{
              borderRadius: '16px',
              border: '1px solid #ff4d4f20',
              boxShadow: '0 4px 20px rgba(255, 77, 79, 0.1)',
              marginBottom: '24px',
              background: '#fff2f0'
            }}
          >
            {/* Display direct API data */}
            <div style={{ padding: '16px 0' }}>
              <Alert 
                type="warning"
                message="Class synchronization issue detected"
                description={
                  <div>
                    <p>We've detected a potential issue with real-time synchronization. The direct API data may contain classes that are not showing in the UI.</p>
                    <p><strong>Focus on Sunday 10:15-11:55 classes for Teacher BA in room BCT AB</strong></p>
                  </div>
                }
                showIcon
                style={{ marginBottom: '16px' }}
              />
              
              <div style={{ marginBottom: '16px' }}>
                <h4>Direct API Data for Sunday:</h4>
                <pre style={{ 
                  background: '#282c34', 
                  color: '#abb2bf',
                  padding: '16px',
                  borderRadius: '8px',
                  overflowX: 'auto',
                  fontSize: '12px'
                }}>
                  {JSON.stringify(directApiData?.data?.routine?.['0'] || directApiData?.routine?.['0'] || {}, null, 2)}
                </pre>
              </div>
              
              <div>
                <h4>React Query Cached Data for Sunday:</h4>
                <pre style={{ 
                  background: '#282c34', 
                  color: '#abb2bf',
                  padding: '16px',
                  borderRadius: '8px',
                  overflowX: 'auto',
                  fontSize: '12px'
                }}>
                  {JSON.stringify(routineData?.routine?.['0'] || {}, null, 2)}
                </pre>
              </div>
              
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Button 
                  type="primary" 
                  danger
                  onClick={handleSuperFlush}
                  icon={<ReloadOutlined />}
                >
                  Force Full Cache Refresh
                </Button>
              </div>
            </div>
          </Card>
        )}
      
        {/* Modern Schedule Grid Card */}
        {selectedTeacher && (
          <Card
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
                    Weekly Schedule
                  </span>
                  {selectedTeacherInfo && (
                    <div style={{ fontSize: '14px', color: '#666', marginTop: '2px' }}>
                      {selectedTeacherInfo.fullName || selectedTeacherInfo.name} • {selectedTeacherInfo.department}
                    </div>
                  )}
                </div>
              </div>
            }
            style={{
              borderRadius: '16px',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              background: 'white'
            }}
            styles={{
              header: {
                borderBottom: '1px solid #f0f2f5',
                padding: '20px 24px'
              },
              body: {
                padding: '4px 8px'
              }
            }}
          >
            {scheduleLoading ? (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '400px',
                flexDirection: 'column',
                gap: '16px',
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                borderRadius: '12px',
                padding: '40px'
              }}>
                <Spin size="large" />
                <Text type="secondary" style={{ fontSize: '16px' }}>
                  Loading teacher schedule...
                </Text>
                <Text type="secondary" style={{ fontSize: '14px', textAlign: 'center' }}>
                  Fetching real-time data from the routine system
                </Text>
              </div>
            ) : scheduleError ? (
              <Alert
                message="Unable to Load Schedule"
                description={
                  <div>
                    <p>{scheduleError.response?.data?.message || scheduleError.message}</p>
                    <p style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
                      This could be due to network issues or the teacher may not have any assigned classes yet.
                    </p>
                  </div>
                }
                type="error"
                showIcon
                style={{
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #fff2f0 0%, #ffebe6 100%)'
                }}
                action={
                  <Button 
                    size="small" 
                    onClick={refetchSchedule}
                    style={{ borderRadius: '8px' }}
                  >
                    Try Again
                  </Button>
                }
              />
            ) : routineData ? (
              // Always show the grid if we have routine data
              console.log('✅ Rendering RoutineGrid with teacher schedule data:', {
                hasRoutineData: !!routineData,
                hasRoutineProperty: !!(routineData && routineData.routine),
                dayCount: routineData && routineData.routine ? Object.keys(routineData.routine).length : 0,
                totalSlots: routineData && routineData.routine ? 
                  Object.values(routineData.routine).reduce((total, day) => total + Object.keys(day || {}).length, 0) : 0,
                daysWithClasses: routineData && routineData.routine ? 
                  Object.entries(routineData.routine)
                    .filter(([day, slots]) => slots && typeof slots === 'object' && Object.keys(slots).length > 0)
                    .map(([day]) => day)
                  : []
              }),
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                borderRadius: '12px',
                padding: '4px 6px'
              }}>
                <RoutineGrid 
                  teacherViewMode={true}
                  routineData={displayRoutine} 
                  isEditable={false}
                  showExcelActions={false}
                  showPDFActions={true}
                  selectedTeacher={selectedTeacher}
                  selectedTeacherInfo={{
                    ...selectedTeacherInfo,
                    name: selectedTeacherInfo?.fullName || selectedTeacherInfo?.name || 'Teacher'
                  }}
                  onCellDoubleClicked={() => {}} // Read-only for teacher view
                />
              </div>
            ) : (
              <Alert
                message="No Schedule Available"
                description={
                  <div>
                    <p>This teacher does not have any scheduled classes in the current routine.</p>
                    <p style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
                      • Check if the teacher is assigned to any subjects<br/>
                      • Verify routine data is up to date<br/>
                      • Contact admin if this seems incorrect
                    </p>
                  </div>
                }
                type="info"
                showIcon
                style={{
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%)',
                  margin: '40px 0'
                }}
              />
            )}
          </Card>
        )}

        {/* Welcome Card for New Users */}
        {!selectedTeacher && (
          <Card
            style={{
              borderRadius: '16px',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
            }}
          >
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
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
                <TeamOutlined style={{ fontSize: '32px', color: 'white' }} />
              </div>
              
              <Title level={3} style={{ color: '#1a1a1a', marginBottom: '16px' }}>
                 Get Started with Teacher Schedules
              </Title>
              
              <Text style={{ fontSize: '16px', color: '#666', display: 'block', marginBottom: '32px' }}>
                Select a teacher from the dropdown above to view their personalized weekly schedule
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
                    <Text strong style={{ color: '#1a1a1a' }}>Real-time Sync</Text>
                    <div style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
                      Automatically updated from routine changes
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
                      <DownloadOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
                    </div>
                    <Text strong style={{ color: '#1a1a1a' }}>Excel Export</Text>
                    <div style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
                      Professional formatted schedules
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
                      <BookOutlined style={{ fontSize: '24px', color: '#fa8c16' }} />
                    </div>
                    <Text strong style={{ color: '#1a1a1a' }}>Complete View</Text>
                    <div style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
                      All subjects and time slots
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          </Card>
        )}
      </Space>
    </div>
  );
};

// Main wrapper component with context provider
const TeacherScheduleManager = () => {
  return (
    <SemesterGroupProvider>
      <TeacherScheduleManagerContent />
    </SemesterGroupProvider>
  );
};

export default TeacherScheduleManager;
