import React, { useState, useEffect } from 'react';
import { Card, Typography, Select, Space, Alert, Spin, Button, Row, Col, Tag, Statistic } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarOutlined, DownloadOutlined, ReloadOutlined, BookOutlined, TeamOutlined } from '@ant-design/icons';
import RoutineGrid from '../components/RoutineGrid';
import { programsAPI, programSemestersAPI, routinesAPI, teachersAPI } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

// This component handles both program routine view and teacher routine view
const ProgramRoutineView = ({ teacherId = null }) => {
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  
  const queryClient = useQueryClient();
  
  // Reset semester when program changes
  useEffect(() => {
    if (selectedProgram) {
      setSelectedSemester(null);
    }
  }, [selectedProgram]);

  // Reset section when semester changes
  useEffect(() => {
    if (selectedSemester) {
      setSelectedSection(null);
    }
  }, [selectedSemester]);

  // For teacher view mode
  const teacherMode = !!teacherId;

  // Fetch teacher data if in teacher mode
  const { 
    data: teacherData,
    isLoading: teacherLoading,
    error: teacherError
  } = useQuery({
    queryKey: ['teacher', teacherId],
    queryFn: () => teachersAPI.getTeacher(teacherId).then(res => res.data),
    enabled: teacherMode,
    staleTime: 60000, // 1 minute
  });

  const teacher = teacherData?.data;

  // Fetch all programs - Same as Routine Manager
  const { 
    data: programsData, 
    isLoading: programsLoading,
    error: programsError 
  } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => {
      try {
        const response = await programsAPI.getPrograms();
        console.log('Programs API response:', response);
        // Handle both response.data and response.data.data formats
        return response.data.data || response.data || [];
      } catch (error) {
        console.error('Error fetching programs:', error);
        throw error;
      }
    },
    enabled: !teacherMode // Only fetch programs in program view mode
  });

  const programs = Array.isArray(programsData) ? programsData : [];

  // Generate semesters based on selected program - Same as Admin Routine Manager
  const semesters = React.useMemo(() => {
    console.log('🔍 ProgramRoutineViewNew - Generating semesters for program:', selectedProgram);
    console.log('🔍 Available programs:', programs);
    
    if (!selectedProgram || !programs || !Array.isArray(programs)) {
      console.log('❌ No program selected or programs not available');
      return [];
    }
    
    const program = programs.find(p => p.code === selectedProgram);
    console.log('🔍 Found program:', program);
    
    if (!program) {
      console.log('❌ Program not found for code:', selectedProgram);
      return [];
    }
    
    const totalSemesters = program.totalSemesters || program.semesters || 8; // Default to 8
    console.log('🔍 Total semesters for program:', totalSemesters);
    
    // Generate array of semesters from 1 to totalSemesters
    const semesterArray = Array.from({ length: totalSemesters }, (_, index) => ({
      semester: index + 1,
      semesterName: `Semester ${index + 1}`
    }));
    
    console.log('✅ Generated semester array:', semesterArray);
    return semesterArray;
  }, [selectedProgram, programs]);

  // Available sections - Same as Routine Manager
  const sections = ['AB', 'CD'];

  // Fetch routine data - Same as Routine Manager
  const { 
    data: routineData, 
    isLoading: routineLoading,
    error: routineError,
    refetch: refetchRoutine
  } = useQuery({
    queryKey: teacherMode 
      ? ['teacherSchedule', teacherId] 
      : ['routine', selectedProgram, selectedSemester, selectedSection],
    queryFn: () => {
      if (teacherMode) {
        console.log('Fetching teacher schedule for:', teacherId);
        return teachersAPI.getTeacherSchedule(teacherId).then(res => res.data);
      } else {
        return selectedProgram && selectedSemester && selectedSection
          ? routinesAPI.getRoutine(selectedProgram, selectedSemester, selectedSection)
              .then(res => res.data.data)
          : Promise.resolve(null);
      }
    },
    enabled: teacherMode ? !!teacherId : !!(selectedProgram && selectedSemester && selectedSection),
    staleTime: 30000, // 30 seconds - Same as Routine Manager
  });

  const routine = teacherMode ? (routineData?.data || {}) : (routineData || {});

  // Calculate schedule statistics for the view
  const scheduleStats = React.useMemo(() => {
    if ((!routine?.routine && !teacherMode) || (!routine && teacherMode)) {
      return { totalClasses: 0, uniqueSubjects: 0, busyDays: 0, totalHours: 0 };
    }

    let totalClasses = 0;
    const uniqueSubjects = new Set();
    const busyDays = new Set();
    let totalHours = 0;
    
    try {
      // Extract routine object correctly based on mode
      const routineObj = teacherMode ? (routine?.routine || {}) : (routine?.routine || {});
      
      Object.entries(routineObj).forEach(([dayIndex, daySlots]) => {
        // Make sure daySlots is an object and not null/undefined
        if (daySlots && typeof daySlots === 'object') {
          const slotsForDay = Object.keys(daySlots);
          
          if (slotsForDay.length > 0) {
            busyDays.add(parseInt(dayIndex));
            
            Object.entries(daySlots).forEach(([slotIndex, classInfo]) => {
              if (classInfo && typeof classInfo === 'object') {
                totalClasses++;
                totalHours += 1; // Assuming each slot is 1 hour
                
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
      uniqueSubjects: uniqueSubjects.size,
      busyDays: busyDays.size,
      totalHours
    };
  }, [routine, teacherMode]);

  // Handle reset selections
  const handleReset = () => {
    setSelectedProgram(null);
    setSelectedSemester(null);
    setSelectedSection(null);
  };

  // If in teacher mode and there's an error
  if (teacherMode && teacherError) {
    return (
      <div style={{ padding: '24px', background: '#f5f7fa', minHeight: '100vh' }}>
        <Card
          style={{
            maxWidth: '800px',
            margin: '0 auto',
            borderRadius: '16px',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
          }}
        >
          <Alert 
            message="Error Loading Teacher Data" 
            description={`Failed to load teacher data: ${teacherError.message}`}
            type="error" 
            showIcon 
            style={{ borderRadius: '8px' }}
          />
        </Card>
      </div>
    );
  }

  // If in teacher mode and loading teacher data
  if (teacherMode && teacherLoading) {
    return (
      <div style={{ 
        padding: '24px', 
        background: '#f5f7fa', 
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Card
          style={{
            width: '400px',
            textAlign: 'center',
            borderRadius: '16px',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
          }}
        >
          <Spin size="large" />
          <div style={{ marginTop: '16px', color: '#666' }}>
            Loading teacher data...
          </div>
        </Card>
      </div>
    );
  }

  // Render teacher mode UI
  if (teacherMode && teacher) {
    return (
      <div className="teacher-routine" style={{ background: '#f5f7fa', minHeight: '100vh', padding: '24px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
          {/* Teacher Header Card */}
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
                        {teacher.fullName || teacher.name}'s Schedule
                      </Title>
                      <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '16px', fontWeight: '400' }}>
                        {teacher.department} • {teacher.designation || 'Faculty'}
                      </Text>
                    </div>
                  </div>
                </Space>
              </Col>
              <Col xs={24} lg={10}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button 
                    type="default" 
                    icon={<DownloadOutlined />}
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      color: 'white',
                      height: '40px',
                      borderRadius: '8px',
                      padding: '0 20px'
                    }}
                  >
                    Export Schedule
                  </Button>
                </div>
              </Col>
            </Row>
          </Card>

          {/* Teacher Stats Card */}
          <Card
            style={{
              borderRadius: '16px',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              background: 'white'
            }}
          >
            <Row gutter={[16, 16]}>
              <Col span={6}>
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
                    prefix={<CalendarOutlined style={{ color: '#667eea' }} />}
                    valueStyle={{ color: '#667eea', fontWeight: '600' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
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
              <Col span={6}>
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
              <Col span={6}>
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

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
              <Button 
                onClick={() => refetchRoutine()}
                icon={<ReloadOutlined />}
                loading={routineLoading}
                size="large"
                style={{
                  borderRadius: '12px',
                  height: '48px',
                  padding: '0 24px',
                  fontWeight: '500'
                }}
              >
                Refresh Schedule
              </Button>
            </div>
          </Card>

          {/* Schedule Grid Card */}
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
                    Weekly Schedule Grid
                  </span>
                </div>
              </div>
            }
            styles={{
              header: {
                borderBottom: '1px solid #f0f2f5',
                padding: '20px 24px'
              }
            }}
          >
            {routineLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px', color: '#666' }}>
                  Loading schedule...
                </div>
              </div>
            ) : routineError ? (
              <Alert 
                message="Error Loading Schedule" 
                description={`Failed to load schedule data: ${routineError.message}`}
                type="error" 
                showIcon 
                style={{ borderRadius: '8px' }}
              />
            ) : (
              <div style={{ 
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                borderRadius: '12px',
                padding: '16px' 
              }}>
                <RoutineGrid 
                  teacherViewMode={true}
                  routineData={{ data: routine }} 
                  isEditable={false}
                  showExcelActions={false}
                  selectedTeacher={teacherId}
                  selectedTeacherInfo={{
                    ...teacher,
                    name: teacher?.fullName || teacher?.name || 'Teacher'
                  }}
                />
              </div>
            )}
          </Card>
        </Space>
      </div>
    );
  }

  // Render program view UI
  return (
    <div className="program-routine-view" style={{ background: '#f5f7fa', minHeight: '100vh', padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
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
                    <CalendarOutlined style={{ fontSize: '24px', color: 'white' }} />
                  </div>
                  <div>
                    <Title level={1} style={{ margin: 0, color: 'white', fontSize: '32px', fontWeight: '700' }}>
                      Class Routine Viewer
                    </Title>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '16px', fontWeight: '400' }}>
                      View class schedules for specific programs and sections
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
                    🎯 Select Class to View
                  </Text>
                  
                  <Select
                    placeholder="Select Program"
                    style={{ width: '100%', marginBottom: '12px' }}
                    value={selectedProgram}
                    onChange={(value) => {
                      setSelectedProgram(value);
                      setSelectedSemester(null);
                      setSelectedSection(null);
                    }}
                    loading={programsLoading}
                    size="large"
                  >
                    {programs.map(program => (
                      <Option key={program.code} value={program.code}>
                        {program.name} ({program.code})
                      </Option>
                    ))}
                  </Select>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <Select
                      placeholder="Semester"
                      style={{ width: '100%' }}
                      value={selectedSemester}
                      onChange={(value) => {
                        console.log('Semester selected:', value);
                        setSelectedSemester(value);
                        setSelectedSection(null);
                      }}
                      disabled={!selectedProgram}
                      size="large"
                      notFoundContent={!selectedProgram ? "Select a program first" : "No semesters available"}
                    >
                      {semesters.map(semester => (
                        <Option key={semester.semester} value={semester.semester}>
                          Semester {semester.semester}
                        </Option>
                      ))}
                    </Select>
                    
                    <Select
                      placeholder="Section"
                      style={{ width: '100%' }}
                      value={selectedSection}
                      onChange={setSelectedSection}
                      disabled={!selectedSemester}
                      size="large"
                    >
                      {sections.map(section => (
                        <Option key={section} value={section}>
                          Section {section}
                        </Option>
                      ))}
                    </Select>
                    
                    <Button 
                      onClick={handleReset}
                      size="large"
                      style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        color: 'white',
                        height: '40px'
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </Space>
              </div>
            </Col>
          </Row>
        </Card>
        
        {/* Selection Summary Card - Only visible when all selections are made */}
        {selectedProgram && selectedSemester && selectedSection && (
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
                    <BookOutlined style={{ fontSize: '20px', color: 'white' }} />
                  </div>
                  <div>
                    <Title level={3} style={{ margin: 0, color: '#1a1a1a', fontWeight: '600' }}>
                      {programs.find(p => p.code === selectedProgram)?.name || selectedProgram} - Semester {selectedSemester} - Section {selectedSection}
                    </Title>
                    <Text type="secondary" style={{ fontSize: '14px' }}>
                      {routineLoading ? 'Loading schedule data...' : 
                      routineError ? 'Error loading schedule' : 
                      !routineData ? 'No schedule data yet' :
                      `${Object.values(routineData.routine || {}).reduce((total, day) => 
                        total + Object.keys(day || {}).length, 0)} classes scheduled`}
                    </Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} md={8} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <Space>
                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={() => refetchRoutine()}
                    loading={routineLoading}
                    style={{ borderRadius: '8px', height: '40px' }}
                  >
                    Refresh Data
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        )}
        
        {/* Routine Grid or Welcome Screen */}
        {selectedProgram && selectedSemester && selectedSection ? (
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
                    Weekly Schedule Grid
                  </span>
                </div>
              </div>
            }
            styles={{
              header: {
                borderBottom: '1px solid #f0f2f5',
                padding: '20px 24px'
              }
            }}
            extra={
              <Button
                icon={<DownloadOutlined />}
                style={{ borderRadius: '8px', height: '40px' }}
              >
                Export Schedule
              </Button>
            }
          >
            {/* Display error if routine loading failed */}
            {routineError && (
              <div style={{ marginBottom: '16px' }}>
                <Alert
                  message="Error Loading Routine"
                  description={routineError.response?.data?.message || routineError.message || 'Failed to load routine data'}
                  type="error"
                  showIcon
                  closable
                  style={{ borderRadius: '8px' }}
                />
              </div>
            )}
            
            {/* Routine Grid component */}
            {routineLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px', color: '#666' }}>
                  Loading schedule...
                </div>
              </div>
            ) : (
              <div style={{ 
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                borderRadius: '12px',
                padding: '16px' 
              }}>
                <RoutineGrid
                  programCode={selectedProgram}
                  semester={selectedSemester}
                  section={selectedSection}
                  isEditable={false}
                  demoMode={false}
                  routineData={routineData}
                />
              </div>
            )}
          </Card>
        ) : (
          <Card
            style={{
              borderRadius: '16px',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
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
                <CalendarOutlined style={{ fontSize: '32px', color: 'white' }} />
              </div>
              
              <Title level={3} style={{ color: '#1a1a1a', marginBottom: '16px' }}>
                🔍 View Class Schedule
              </Title>
              
              <Text style={{ fontSize: '16px', color: '#666', display: 'block', marginBottom: '32px' }}>
                Select a Program, Semester, and Section from the options above to view the schedule
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
                    <Text strong style={{ color: '#1a1a1a' }}>Clear View</Text>
                    <div style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
                      Easy to read weekly schedule
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
                      <BookOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
                    </div>
                    <Text strong style={{ color: '#1a1a1a' }}>Complete Details</Text>
                    <div style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
                      Shows subjects, teachers, and rooms
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
                      <DownloadOutlined style={{ fontSize: '24px', color: '#fa8c16' }} />
                    </div>
                    <Text strong style={{ color: '#1a1a1a' }}>Export Feature</Text>
                    <div style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
                      Download schedule for offline use
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

export default ProgramRoutineView;
