import React, { useState, useEffect } from 'react';
import { Card, Select, Space, Typography, Alert, Spin, Button, Row, Col, Tag, message } from 'antd';
import { UserOutlined, ReloadOutlined, CalendarOutlined, ClockCircleOutlined, TeamOutlined } from '@ant-design/icons';
import { teachersAPI, timeSlotsAPI } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

const TeacherMeetingScheduler = () => {
  const [teachers, setTeachers] = useState([]);
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [teacherScheduleData, setTeacherScheduleData] = useState({});
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [minDuration, setMinDuration] = useState(1);
  const [excludeDays, setExcludeDays] = useState([]);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

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
      setTeachers(response.data || []);
    } catch (err) {
      console.error('Error fetching teachers:', err);
      setError('Failed to load teachers');
    }
  };

  const fetchTimeSlots = async () => {
    try {
      const response = await timeSlotsAPI.getTimeSlots({ includeGlobal: 'true' });
      setTimeSlots(response.data?.data || []);
    } catch (err) {
      console.error('Error fetching time slots:', err);
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
  const getTeachersInSlot = (dayIndex, slotIndex) => {
    const teachersInSlot = [];
    
    selectedTeachers.forEach(teacherId => {
      const teacherSchedule = teacherScheduleData[teacherId];
      if (teacherSchedule && teacherSchedule[dayIndex] && teacherSchedule[dayIndex][slotIndex]) {
        const teacher = teachers.find(t => t._id === teacherId);
        if (teacher) {
          teachersInSlot.push(teacher.shortName || teacher.fullName?.split(' ')[0] || 'T');
        }
      }
    });
    
    return teachersInSlot;
  };

  // Function to determine if slot is free for meeting
  const isSlotFreeForMeeting = (dayIndex, slotIndex) => {
    // Skip if day is excluded
    if (excludeDays.includes(dayIndex)) return false;
    
    // Check if ALL selected teachers are free in this slot
    return selectedTeachers.every(teacherId => {
      const teacherSchedule = teacherScheduleData[teacherId];
      return !teacherSchedule || !teacherSchedule[dayIndex] || !teacherSchedule[dayIndex][slotIndex];
    });
  };

  const getSlotStyle = (dayIndex, slotIndex) => {
    const teachersInSlot = getTeachersInSlot(dayIndex, slotIndex);
    
    if (selectedTeachers.length === 0) {
      return {
        backgroundColor: '#f5f5f5',
        border: '1px solid #d9d9d9',
        color: '#666'
      };
    }
    
    if (teachersInSlot.length > 0) {
      // Red background for slots with selected teachers' classes
      return {
        backgroundColor: '#ff4d4f',
        border: '1px solid #cf1322',
        color: '#fff',
        fontWeight: 'bold'
      };
    } else if (isSlotFreeForMeeting(dayIndex, slotIndex)) {
      // Green background for available meeting slots
      return {
        backgroundColor: '#52c41a',
        border: '1px solid #389e0d',
        color: '#fff',
        fontWeight: 'bold'
      };
    } else {
      // Default styling
      return {
        backgroundColor: '#f5f5f5',
        border: '1px solid #d9d9d9',
        color: '#666'
      };
    }
  };

  return (
    <div className="teacher-schedule-manager" style={{ background: '#f5f7fa', minHeight: '100vh', padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: '1800px', margin: '0 auto' }}>
        
        {/* Header */}
        <Card style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          borderRadius: '16px',
          color: 'white'
        }}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <TeamOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
            <Title level={1} style={{ color: 'white', margin: '0 0 8px 0', fontSize: '2.5rem' }}>
              Teacher Meeting Scheduler
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem' }}>
              Visual schedule grid for finding common meeting times
            </Text>
          </div>
        </Card>

        {/* Teacher Selection */}
        <Card title={
          <Space>
            <UserOutlined />
            <span>Select Teachers ({selectedTeachers.length} selected)</span>
          </Space>
        } style={{ borderRadius: '12px' }}>
          <Row gutter={[16, 16]}>
            {teachers.map(teacher => (
              <Col xs={24} sm={12} md={8} lg={6} key={teacher._id}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => handleTeacherToggle(teacher._id)}
                  style={{
                    backgroundColor: selectedTeachers.includes(teacher._id) ? '#e6f7ff' : '#fafafa',
                    border: selectedTeachers.includes(teacher._id) ? '2px solid #1890ff' : '1px solid #d9d9d9',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      {teacher.fullName}
                    </div>
                    <div style={{ color: '#666', fontSize: '12px' }}>
                      {teacher.shortName}
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>

        {/* Search Criteria */}
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
            }
            extra={
              <Button 
                icon={<ReloadOutlined />} 
                onClick={fetchTeacherSchedules}
                loading={loading}
              >
                Refresh
              </Button>
            }
            style={{ borderRadius: '12px' }}
          >
            <div style={{ marginBottom: '16px' }}>
              <Space>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '16px', height: '16px', backgroundColor: '#52c41a', border: '1px solid #389e0d' }}></div>
                  <Text>Available for meeting</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '16px', height: '16px', backgroundColor: '#ff4d4f', border: '1px solid #cf1322' }}></div>
                  <Text>Teachers busy</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '16px', height: '16px', backgroundColor: '#f5f5f5', border: '1px solid #d9d9d9' }}></div>
                  <Text>Not applicable</Text>
                </div>
              </Space>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr>
                    <th style={{ 
                      padding: '12px 8px', 
                      border: '1px solid #d9d9d9', 
                      backgroundColor: '#fafafa',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      minWidth: '100px'
                    }}>
                      Day / Time
                    </th>
                    {timeSlots.map((slot, index) => (
                      <th key={index} style={{ 
                        padding: '12px 8px', 
                        border: '1px solid #d9d9d9', 
                        backgroundColor: '#fafafa',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        minWidth: '120px',
                        textAlign: 'center'
                      }}>
                        <div>{slot.label}</div>
                        <div style={{ fontSize: '10px', color: '#666' }}>
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
                        padding: '12px 8px', 
                        border: '1px solid #d9d9d9', 
                        backgroundColor: '#fafafa',
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}>
                        {dayName}
                      </td>
                      {timeSlots.map((slot, slotIndex) => {
                        const teachersInSlot = getTeachersInSlot(dayIndex, slotIndex);
                        const slotStyle = getSlotStyle(dayIndex, slotIndex);
                        
                        return (
                          <td
                            key={slotIndex}
                            style={{
                              padding: '8px',
                              border: '1px solid #d9d9d9',
                              height: '60px',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              fontSize: '12px',
                              ...slotStyle
                            }}
                          >
                            {teachersInSlot.length > 0 ? (
                              <div>
                                {teachersInSlot.join(', ')}
                              </div>
                            ) : isSlotFreeForMeeting(dayIndex, slotIndex) ? (
                              <div>
                                ✓ FREE
                              </div>
                            ) : (
                              <div style={{ color: '#999' }}>
                                -
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

export default TeacherMeetingScheduler;
