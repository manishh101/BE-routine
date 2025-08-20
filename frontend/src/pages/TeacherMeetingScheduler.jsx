import React, { useState, useEffect, useMemo } from 'react';
import { Card, Select, Space, Typography, Alert, Spin, Button, Row, Col, Tag, message, Input } from 'antd';
import { UserOutlined, ReloadOutlined, CalendarOutlined, ClockCircleOutlined, TeamOutlined, SearchOutlined, CloseOutlined } from '@ant-design/icons';
import { teachersAPI, timeSlotsAPI } from '../services/api';
import { SemesterGroupProvider, useSemesterGroup, filterRoutineBySemesterGroup } from '../contexts/SemesterGroupContext';
import SemesterGroupToggle from '../components/SemesterGroupToggle';

const { Title, Text } = Typography;
const { Option } = Select;

const TeacherMeetingSchedulerContent = () => {
  const [teachers, setTeachers] = useState([]);
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [teacherScheduleData, setTeacherScheduleData] = useState({});
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [minDuration, setMinDuration] = useState(1);
  const [excludeDays, setExcludeDays] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { semesterGroup } = useSemesterGroup();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Filter teachers based on search term
  const filteredTeachers = useMemo(() => {
    if (!searchTerm.trim()) return teachers;
    
    const search = searchTerm.toLowerCase();
    return teachers.filter(teacher => 
      teacher.fullName?.toLowerCase().includes(search) ||
      teacher.shortName?.toLowerCase().includes(search) ||
      teacher.email?.toLowerCase().includes(search)
    );
  }, [teachers, searchTerm]);

  // Apply semester group filtering to teacher schedule data using useMemo
  const filteredTeacherScheduleData = useMemo(() => {
    console.log('🔄 Filtering teacher schedule data for semester group:', semesterGroup);
    const filtered = {};
    
    Object.keys(teacherScheduleData).forEach(teacherId => {
      const teacherData = teacherScheduleData[teacherId];
      if (teacherData) {
        // Always apply filtering since we removed 'all' option
        const wrappedData = { routine: teacherData };
        const filteredData = filterRoutineBySemesterGroup(wrappedData, semesterGroup);
        filtered[teacherId] = filteredData?.routine || {};
      }
    });
    
    return filtered;
  }, [teacherScheduleData, semesterGroup]);

  // Fetch teachers on component mount
  useEffect(() => {
    fetchTeachers();
    fetchTimeSlots();
  }, []);

  // Fetch teacher schedules when selected teachers change
  useEffect(() => {
    if (selectedTeachers.length > 0) {
      fetchTeacherSchedules();
    } else {
      setTeacherScheduleData({});
    }
  }, [selectedTeachers]);

  const fetchTeachers = async () => {
    try {
      const response = await teachersAPI.getAllTeachers();
      console.log('Teachers API response:', response);
      
      // Handle different response structures
      let teachersData = [];
      if (response.data?.data) {
        teachersData = response.data.data;
      } else if (response.data) {
        teachersData = response.data;
      } else if (Array.isArray(response)) {
        teachersData = response;
      }
      
      setTeachers(teachersData);
    } catch (err) {
      console.error('Error fetching teachers:', err);
      setError('Failed to load teachers');
    }
  };

  const fetchTimeSlots = async () => {
    try {
      const response = await timeSlotsAPI.getTimeSlots({ includeGlobal: 'true' });
      // Handle different response structures
      let timeSlotsData = [];
      if (response.data?.data) {
        timeSlotsData = response.data.data;
      } else if (response.data) {
        timeSlotsData = response.data;
      } else if (Array.isArray(response)) {
        timeSlotsData = response;
      }
      
      setTimeSlots(timeSlotsData);
      
      // If still empty, create fallback time slots
      if (!timeSlotsData || timeSlotsData.length === 0) {
        const fallbackSlots = [
          { _id: '1', label: '10:15-11:05', startTime: '10:15', endTime: '11:05', sortOrder: 1 },
          { _id: '2', label: '11:05-11:55', startTime: '11:05', endTime: '11:55', sortOrder: 2 },
          { _id: '3', label: '11:55-12:45', startTime: '11:55', endTime: '12:45', sortOrder: 3 },
          { _id: '4', label: '12:45-13:35', startTime: '12:45', endTime: '13:35', sortOrder: 4 },
          { _id: '5', label: '13:35-14:25', startTime: '13:35', endTime: '14:25', sortOrder: 5 },
          { _id: '6', label: '14:25-15:15', startTime: '14:25', endTime: '15:15', sortOrder: 6 },
          { _id: '7', label: '15:15-16:05', startTime: '15:15', endTime: '16:05', sortOrder: 7 }
        ];
        setTimeSlots(fallbackSlots);
      }
    } catch (err) {
      console.error('Error fetching time slots:', err);
      // Set fallback time slots on error
      const fallbackSlots = [
        { _id: '1', label: '10:15-11:05', startTime: '10:15', endTime: '11:05', sortOrder: 1 },
        { _id: '2', label: '11:05-11:55', startTime: '11:05', endTime: '11:55', sortOrder: 2 },
        { _id: '3', label: '11:55-12:45', startTime: '11:55', endTime: '12:45', sortOrder: 3 },
        { _id: '4', label: '12:45-13:35', startTime: '12:45', endTime: '13:35', sortOrder: 4 },
        { _id: '5', label: '13:35-14:25', startTime: '13:35', endTime: '14:25', sortOrder: 5 },
        { _id: '6', label: '14:25-15:15', startTime: '14:25', endTime: '15:15', sortOrder: 6 },
        { _id: '7', label: '15:15-16:05', startTime: '15:15', endTime: '16:05', sortOrder: 7 }
      ];
      setTimeSlots(fallbackSlots);
    }
  };

  const fetchTeacherSchedules = async () => {
    setLoading(true);
    const scheduleData = {};
    
    try {
      // Fetch schedule for each selected teacher
      for (const teacherId of selectedTeachers) {
        try {
          const response = await teachersAPI.getTeacherSchedule(teacherId);
          if (response.data?.routine) {
            scheduleData[teacherId] = response.data.routine;
          }
        } catch (err) {
          console.error(`Error fetching schedule for teacher ${teacherId}:`, err);
        }
      }
      setTeacherScheduleData(scheduleData);
    } catch (err) {
      console.error('Error fetching teacher schedules:', err);
      setError('Failed to load teacher schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherToggle = (teacherId) => {
    setSelectedTeachers(prev => 
      prev.includes(teacherId) 
        ? prev.filter(id => id !== teacherId)
        : [...prev, teacherId]
    );
  };

  const handleDayToggle = (dayIndex) => {
    setExcludeDays(prev =>
      prev.includes(dayIndex)
        ? prev.filter(day => day !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  // Function to get teacher short names for a slot
  const getTeachersInSlot = (dayIndex, timeSlotArrayIndex) => {
    const teachersInSlot = [];
    
    // Map timeSlot array index to actual slot index used in schedule data
    // timeSlots array starts from 0, but schedule data uses slot indices starting from 1
    const actualSlotIndex = timeSlotArrayIndex + 1;
    
    selectedTeachers.forEach(teacherId => {
      const teacherSchedule = filteredTeacherScheduleData[teacherId];
      if (teacherSchedule && teacherSchedule[dayIndex]) {
        // Check if this slot exists for this teacher on this day
        // Handle both single objects and arrays of slots
        const slotData = teacherSchedule[dayIndex][actualSlotIndex];
        if (slotData) {
          const teacher = teachers.find(t => t._id === teacherId);
          if (teacher) {
            teachersInSlot.push(teacher.shortName || teacher.fullName?.split(' ')[0] || 'T');
          }
        }
      }
    });
    
    return teachersInSlot;
  };

  // Function to determine if slot is free for meeting
  const isSlotFreeForMeeting = (dayIndex, timeSlotArrayIndex) => {
    // Skip if day is excluded
    if (excludeDays.includes(dayIndex)) return false;
    
    // Map timeSlot array index to actual slot index used in schedule data
    const actualSlotIndex = timeSlotArrayIndex + 1;
    
    // Check if ALL selected teachers are free in this slot
    return selectedTeachers.every(teacherId => {
      const teacherSchedule = filteredTeacherScheduleData[teacherId];
      if (!teacherSchedule || !teacherSchedule[dayIndex]) return true;
      
      const slotData = teacherSchedule[dayIndex][actualSlotIndex];
      // Slot is free if there's no data or if it's an empty array
      return !slotData || (Array.isArray(slotData) && slotData.length === 0);
    });
  };

  const getSlotStyle = (dayIndex, timeSlotArrayIndex) => {
    const teachersInSlot = getTeachersInSlot(dayIndex, timeSlotArrayIndex);
    
    if (selectedTeachers.length === 0) {
      return {
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        color: '#64748b',
        fontSize: '13px'
      };
    }
    
    if (teachersInSlot.length > 0) {
      // Amber/Orange for busy slots - more appealing than red
      return {
        backgroundColor: '#fef3c7',
        border: '1px solid #f59e0b',
        color: '#92400e',
        fontWeight: '600',
        fontSize: '13px',
        boxShadow: '0 1px 3px rgba(245, 158, 11, 0.1)'
      };
    } else if (isSlotFreeForMeeting(dayIndex, timeSlotArrayIndex)) {
      // Emerald green for available slots - more appealing than bright green
      return {
        backgroundColor: '#d1fae5',
        border: '1px solid #10b981',
        color: '#065f46',
        fontWeight: '600',
        fontSize: '13px',
        boxShadow: '0 1px 3px rgba(16, 185, 129, 0.1)'
      };
    } else {
      // Default styling
      return {
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        color: '#64748b',
        fontSize: '13px'
      };
    }
  };

  return (
    <div className="teacher-schedule-manager" style={{ background: '#f5f7fa', minHeight: '100vh', padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: '1800px', margin: '0 auto' }}>
             {/* Header */}
        <Card style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
          border: 'none',
          borderRadius: '16px',
          color: 'white',
          boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)'
        }}>
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <TeamOutlined style={{ fontSize: '52px', marginBottom: '16px', color: 'rgba(255,255,255,0.9)' }} />
            <Title level={1} style={{ color: 'white', margin: '0 0 12px 0', fontSize: '2.5rem', fontWeight: '700' }}>
              Teacher Meeting Scheduler
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.1rem', lineHeight: '1.5' }}>
              Find optimal meeting times by analyzing teacher schedules and identifying conflicts
            </Text>
          </div>
        </Card>{/* Teacher Selection */}
        <Card title={
          <Space>
            <UserOutlined />
            <span>Select Teachers ({selectedTeachers.length} selected)</span>
          </Space>
        } style={{ borderRadius: '12px' }}>
          
          {/* Search Bar */}
          <div style={{ marginBottom: '16px' }}>
            <Input
              placeholder="Search teachers by name, short name, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              prefix={<SearchOutlined style={{ color: '#1890ff' }} />}
              suffix={
                searchTerm && (
                  <CloseOutlined 
                    style={{ color: '#999', cursor: 'pointer' }} 
                    onClick={() => setSearchTerm('')}
                  />
                )
              }
              size="large"
              style={{ borderRadius: '8px' }}
            />
          </div>

          {/* Selected Teachers Display */}
          {selectedTeachers.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                Selected Teachers:
              </Text>
              <Space wrap>
                {selectedTeachers.map(teacherId => {
                  const teacher = teachers.find(t => t._id === teacherId);
                  return (
                    <Tag
                      key={teacherId}
                      closable
                      onClose={() => handleTeacherToggle(teacherId)}
                      color="blue"
                      style={{ padding: '4px 8px', fontSize: '13px' }}
                    >
                      {teacher?.fullName}
                    </Tag>
                  );
                })}
              </Space>
            </div>
          )}

          {/* Teacher Grid */}
          <Row gutter={[16, 16]}>
            {filteredTeachers.map(teacher => (
              <Col xs={24} sm={12} md={8} lg={6} key={teacher._id}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => handleTeacherToggle(teacher._id)}
                  style={{
                    backgroundColor: selectedTeachers.includes(teacher._id) ? '#f0f9ff' : '#fafafa',
                    border: selectedTeachers.includes(teacher._id) ? '2px solid #3b82f6' : '1px solid #d9d9d9',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    transition: 'all 0.2s ease'
                  }}
                  bodyStyle={{ padding: '12px' }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '14px' }}>
                      {teacher.fullName}
                    </div>
                    <div style={{ color: '#666', fontSize: '12px', marginBottom: '2px' }}>
                      {teacher.shortName}
                    </div>
                    {teacher.email && (
                      <div style={{ color: '#888', fontSize: '11px' }}>
                        {teacher.email}
                      </div>
                    )}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
          
          {filteredTeachers.length === 0 && searchTerm && (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px', 
              color: '#999',
              background: '#f8f9fa',
              borderRadius: '8px',
              border: '1px dashed #ddd'
            }}>
              <SearchOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
              <div>No teachers found matching "{searchTerm}"</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Try searching by name, short name, or email
              </div>
            </div>
          )}
        </Card>{/* Search Criteria */}
        <Card title={
          <Space>
            <CalendarOutlined />
            <span>Meeting Preferences</span>
          </Space>
        } style={{ borderRadius: '12px' }}>
          <Row gutter={[24, 16]}>
            <Col span={12}>
              <div>
                <Text strong>Minimum Duration: </Text>
                <Select
                  value={minDuration}
                  onChange={setMinDuration}
                  style={{ width: '120px', marginLeft: '8px' }}
                >
                  {[1, 2, 3, 4].map(duration => (
                    <Option key={duration} value={duration}>
                      {duration} slot{duration > 1 ? 's' : ''}
                    </Option>
                  ))}
                </Select>
              </div>
            </Col>
            <Col span={12}>
              <div>
                <Text strong>Exclude Days: </Text>
                <Space wrap style={{ marginLeft: '8px' }}>
                  {dayNames.map((day, index) => (
                    <Tag
                      key={index}
                      color={excludeDays.includes(index) ? 'red' : 'default'}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleDayToggle(index)}
                    >
                      {day}
                    </Tag>
                  ))}
                </Space>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Semester Group Filter - Only show when teachers are selected */}
        {selectedTeachers.length > 0 && (
          <Card
            title={
              <Space>
                <CalendarOutlined />
                <span>Semester Group Filter</span>
              </Space>
            }
            style={{ borderRadius: '12px' }}
          >
            <SemesterGroupToggle 
              size="default"
              showLabel={true}
              showDescription={true}
            />
            <div style={{ marginTop: '12px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Choose which semester group to analyze for meeting conflicts. 
                Odd and even semester groups have separate schedules and don't conflict with each other.
              </Text>
            </div>
          </Card>
        )}

          {/* Error Display */}
          {error && (
            <Alert
              message="Error"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
            />
          )}

          {/* Meeting Schedule Grid */}
          {selectedTeachers.length > 0 && (
            <Card
              title={
                <Space>
                  <ClockCircleOutlined />
                  <span>Meeting Schedule Grid</span>
                  {loading && <Spin size="small" />}
                </Space>
              }            extra={
              <Space>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={fetchTeacherSchedules}
                  loading={loading}
                >
                  Refresh
                </Button>
              </Space>
            }
            style={{ borderRadius: '12px' }}
          >
            <div style={{ marginBottom: '16px' }}>
              <Space size="large">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ 
                    width: '18px', 
                    height: '18px', 
                    backgroundColor: '#10b981', 
                    border: '1px solid #059669',
                    borderRadius: '4px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}></div>
                  <Text style={{ fontSize: '14px', fontWeight: '500' }}>
                    Available for meeting ({semesterGroup} semesters)
                  </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ 
                    width: '18px', 
                    height: '18px', 
                    backgroundColor: '#f59e0b', 
                    border: '1px solid #d97706',
                    borderRadius: '4px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}></div>
                  <Text style={{ fontSize: '14px', fontWeight: '500' }}>
                    Teachers busy ({semesterGroup} semesters)
                  </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ 
                    width: '18px', 
                    height: '18px', 
                    backgroundColor: '#e5e7eb', 
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}></div>
                  <Text style={{ fontSize: '14px', fontWeight: '500' }}>
                    Not applicable
                  </Text>
                </div>
              </Space>
            </div>
                 <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'separate',
                borderSpacing: '0',
                minWidth: '900px',
                backgroundColor: 'white'
              }}>
                <thead>
                  <tr>
                    <th style={{ 
                      padding: '16px 12px', 
                      border: '1px solid #e2e8f0',
                      borderTopLeftRadius: '12px',
                      backgroundColor: '#f8fafc',
                      fontSize: '15px',
                      fontWeight: '600',
                      color: '#374151',
                      minWidth: '120px',
                      position: 'sticky',
                      left: 0,
                      zIndex: 10
                    }}>
                      Day / Time
                    </th>
                    {timeSlots.map((slot, index) => (
                      <th key={index} style={{ 
                        padding: '16px 12px', 
                        border: '1px solid #e2e8f0',
                        borderTopRightRadius: index === timeSlots.length - 1 ? '12px' : '0',
                        backgroundColor: '#f8fafc',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#374151',
                        minWidth: '140px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{slot.label}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '400' }}>
                          {slot.startTime}-{slot.endTime}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dayNames.map((dayName, dayIndex) => (
                    <tr key={dayIndex}>
                      <td style={{ 
                        padding: '16px 12px', 
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        fontWeight: '600',
                        fontSize: '14px',
                        color: '#374151',
                        position: 'sticky',
                        left: 0,
                        zIndex: 5
                      }}>
                        {dayName}
                      </td>
                      {timeSlots.map((slot, timeSlotArrayIndex) => {
                        const teachersInSlot = getTeachersInSlot(dayIndex, timeSlotArrayIndex);
                        const slotStyle = getSlotStyle(dayIndex, timeSlotArrayIndex);
                        
                        return (
                          <td
                            key={timeSlotArrayIndex}
                            style={{
                              padding: '12px 8px',
                              border: '1px solid #e2e8f0',
                              height: '70px',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              transition: 'all 0.2s ease',
                              ...slotStyle
                            }}
                          >
                            {teachersInSlot.length > 0 ? (
                              <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center',
                                gap: '2px'
                              }}>
                                <div style={{ fontWeight: '600', fontSize: '12px' }}>
                                  {teachersInSlot.join(', ')}
                                </div>
                                <div style={{ fontSize: '10px', opacity: 0.8 }}>
                                  BUSY
                                </div>
                              </div>
                            ) : isSlotFreeForMeeting(dayIndex, timeSlotArrayIndex) ? (
                              <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center',
                                gap: '2px'
                              }}>
                                <div style={{ fontSize: '16px' }}>✓</div>
                                <div style={{ fontSize: '11px', fontWeight: '600' }}>
                                  AVAILABLE
                                </div>
                              </div>
                            ) : (
                              <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                                —
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </Card>
          )}

          {/* Instructions */}
          {selectedTeachers.length === 0 && (
            <Card style={{ borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ padding: '40px 20px' }}>
                <TeamOutlined style={{ fontSize: '64px', color: '#d9d9d9', marginBottom: '16px' }} />
                <Title level={3} style={{ color: '#666' }}>
                  Select Teachers to View Schedule
                </Title>
                <Text style={{ color: '#999' }}>
                  Choose teachers from the list above to see their combined schedule and find meeting slots
                </Text>
              </div>
            </Card>
          )}
        </Space>
      </div>
  );
};

// Main component wrapped with provider
const TeacherMeetingScheduler = () => {
  return (
    <SemesterGroupProvider>
      <TeacherMeetingSchedulerContent />
    </SemesterGroupProvider>
  );
};

export default TeacherMeetingScheduler;
