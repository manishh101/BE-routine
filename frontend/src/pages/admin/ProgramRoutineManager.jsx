import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, Card, Typography, Button, Alert, message, Space, Row, Col, Spin, Tag, Statistic, Modal, Form } from 'antd';
import { PlusOutlined, CalendarOutlined, BookOutlined, ClockCircleOutlined, TeamOutlined, ReloadOutlined } from '@ant-design/icons';
import RoutineGrid from '../../components/RoutineGrid';
import AssignClassModal from '../../components/AssignClassModal';
import PDFActions from '../../components/PDFActions';
import useRoutineSync from '../../hooks/useRoutineSync';
import { programsAPI, programSemestersAPI, routinesAPI, timeSlotsAPI } from '../../services/api';
import { handleClassAssignmentSuccess, useRoutineChangeListener } from '../../utils/robustCacheInvalidation';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * ProgramRoutineManager - Main administrative component for creating and editing program class routines
 * 
 * Features:
 * - Features a visual grid display that mimics spreadsheet layout (Excel-like)
 * - Three dropdown controls for Program, Semester, and Section selection
 * - Uses @tanstack/react-query for state management with dependent query keys
 * - Integrates with RoutineGrid component that renders HTML table with spreadsheet styling
 * - Interactive cells that open AssignClassModal for class assignment/editing
 * - Automatic refetching when selections change
 * 
 * @component
 */
const ProgramRoutineManager = () => {
  console.log('ProgramRoutineManager mounted');
  const queryClient = useQueryClient();
  const { syncRoutineData, quickRefresh } = useRoutineSync();

  // Selection state
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  
  // Modal state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  
  // Day/Time selection modal state
  const [dayTimeSelectionVisible, setDayTimeSelectionVisible] = useState(false);
  const [selectedDayTime, setSelectedDayTime] = useState({ dayIndex: 0, slotIndex: 0 });
  
  // Force refresh key for immediate UI updates
  const [refreshKey, setRefreshKey] = useState(0);
  const forceRefresh = () => setRefreshKey(prev => prev + 1);
  
  // Listen for routine changes from other components
  useRoutineChangeListener(queryClient, (changeData) => {
    console.log('🔔 Routine change detected in ProgramRoutineManager:', changeData);
    // Force refresh if this is for the same program/semester/section
    if (changeData.programCode === selectedProgram && 
        changeData.semester === selectedSemester && 
        changeData.section === selectedSection) {
      forceRefresh();
    }
  });

  // Fetch programs
  const { data: programs, isLoading: programsLoading, error: programsError } = useQuery({
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
    retry: 2,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Enhanced debug logs
  console.log('Programs for dropdown:', programs, '| type:', typeof programs, '| isArray:', Array.isArray(programs), '| error:', programsError);

  // Generate semesters based on selected program
  const semesters = React.useMemo(() => {
    console.log('Generating semesters for program:', selectedProgram);
    console.log('Available programs:', programs);
    
    if (!selectedProgram || !programs || !Array.isArray(programs)) {
      console.log('No program selected or programs not available');
      return [];
    }
    
    const program = programs.find(p => p.code === selectedProgram);
    console.log('Found program:', program);
    
    if (!program) {
      console.log('Program not found for code:', selectedProgram);
      return [];
    }
    
    const totalSemesters = program.totalSemesters || program.semesters || 8; // Try multiple fields, default to 8
    console.log('Total semesters for program:', totalSemesters);
    
    // Generate array of semesters from 1 to totalSemesters
    const semesterArray = Array.from({ length: totalSemesters }, (_, index) => ({
      semester: index + 1,
      semesterName: `Semester ${index + 1}`
    }));
    
    console.log('Generated semester array:', semesterArray);
    return semesterArray;
  }, [selectedProgram, programs]);

  // Debug log for semesters
  console.log('Final semesters state:', semesters, '| length:', semesters.length);

  // Available sections (hardcoded as per business logic)
  const sections = ['AB', 'CD'];

  // Fetch routine data (dependent on all three selections)
  const { 
    data: routineData, 
    isLoading: routineLoading, 
    error: routineError,
    refetch: refetchRoutine 
  } = useQuery({
    queryKey: ['routine', selectedProgram, selectedSemester, selectedSection],
    queryFn: () => selectedProgram && selectedSemester && selectedSection
      ? routinesAPI.getRoutine(selectedProgram, selectedSemester, selectedSection)
          .then(res => {
            console.log('ProgramRoutineManager - Fresh data fetched:', res.data);
            return res.data.data;
          })
      : Promise.resolve(null),
    enabled: !!(selectedProgram && selectedSemester && selectedSection),
    staleTime: 0, // No stale time - always fresh data
    gcTime: 0, // Don't cache data
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    // Force new data fetch when refreshKey changes
    meta: { refreshKey }
  });
  
  // Fetch timeslots for Excel export
  const { data: timeSlotsData } = useQuery({
    queryKey: ['timeSlots'],
    queryFn: () => timeSlotsAPI.getTimeSlots(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Enhanced handle cell click with better error handling and validation
  const handleCellClick = (dayIndex, slotIndex, existingClassData = null) => {
    console.log('Cell clicked:', { dayIndex, slotIndex, existingClassData });
    console.log('Selected program/semester/section:', { selectedProgram, selectedSemester, selectedSection });
    
    // Validate input parameters
    if (dayIndex === null || dayIndex === undefined || slotIndex === null || slotIndex === undefined) {
      message.error('Invalid cell selection. Please try again.');
      return;
    }

    // Validate that program/semester/section are selected
    if (!selectedProgram || !selectedSemester || !selectedSection) {
      message.error('Please select Program, Semester, and Section first.');
      return;
    }

    // Validate day/time selection
    const validationErrors = validateDayTimeSelection(dayIndex, slotIndex);
    if (validationErrors.length > 0) {
      message.error(validationErrors.join(', '));
      return;
    }
    
    const cellData = {
      dayIndex,
      slotIndex,
      existingClass: existingClassData,
      programCode: selectedProgram,
      semester: selectedSemester,
      section: selectedSection,
    };
    
    console.log('Setting selectedCell to:', cellData);
    setSelectedCell(cellData);
    console.log('Setting modal visible to true');
    setIsModalVisible(true);
  };

  // Handle modal close
  const handleModalClose = () => {
    setIsModalVisible(false);
    setSelectedCell(null);
  };

  // Enhanced handle assignment success with comprehensive cache invalidation and error handling
  const handleAssignmentSuccess = async (classData) => {
    try {
      console.log('🎯 Class assignment successful - starting comprehensive synchronization', classData);
      
      // Close modal first
      handleModalClose();
      
      // Show success message
      message.success('Class assigned successfully!');
      
      // Refetch routine data to show updated grid
      await refetchRoutine();
      
      // Use the new robust cache invalidation system
      console.log('🔄 Using robust cache invalidation for real-time sync...');
      
      // Prepare assignment data for cache invalidation
      const assignmentData = {
        programCode: selectedProgram,
        semester: selectedSemester,
        section: selectedSection,
        teacherIds: classData?.teacherIds || [],
        roomId: classData?.roomId,
        dayIndex: classData?.dayIndex,
        slotIndex: classData?.slotIndex,
        classData: classData
      };
      
      // Use the new robust cache invalidation system
      await handleClassAssignmentSuccess(queryClient, assignmentData);
      
      // Force refresh as additional safety net
      forceRefresh();
      
      console.log("✅ Real-time data synchronization completed successfully");
      
    } catch (error) {
      console.error('❌ Error during assignment success handling:', error);
      message.error('Class assigned but there was an issue updating the display. Please refresh the page.');
    }
  };

  // Reset selections
  const handleReset = () => {
    setSelectedProgram(null);
    setSelectedSemester(null);
    setSelectedSection(null);
  };

  // Enhanced helper function to check if a slot is already occupied
  const isSlotOccupied = (dayIndex, slotIndex) => {
    if (!routineData || !routineData.routine) return false;
    
    const day = routineData.routine[dayIndex];
    if (!day) return false;
    
    const slot = day[slotIndex];
    return !!slot;
  };

  // Helper function to get slot details
  const getSlotDetails = (dayIndex, slotIndex) => {
    if (!routineData || !routineData.routine) return null;
    
    const day = routineData.routine[dayIndex];
    if (!day) return null;
    
    return day[slotIndex] || null;
  };

  // Enhanced validation for day/time selection
  const validateDayTimeSelection = (dayIndex, slotIndex) => {
    const errors = [];

    // Check if it's a valid day
    if (dayIndex < 0 || dayIndex > 6) {
      errors.push('Invalid day selected');
    }

    // Check if time slot exists
    if (!timeSlotsData?.data || slotIndex >= timeSlotsData.data.length) {
      errors.push('Invalid time slot selected');
    }

    // Check if it's a break time
    const timeSlot = timeSlotsData?.data?.[slotIndex];
    if (timeSlot?.isBreak) {
      errors.push('Cannot assign classes during break time');
    }

    return errors;
  };

  return (
    <div className="program-routine-manager mobile-stack-vertical" style={{ background: '#f5f7fa', minHeight: '100vh', padding: '24px' }}>
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
                  <div className="mobile-center">
                    <Title level={1} style={{ margin: 0, color: 'white', fontSize: '32px', fontWeight: '700' }}>
                      Program Routine Manager
                    </Title>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '16px', fontWeight: '400' }}>
                      Create and manage class schedules for academic programs with real-time synchronization
                    </Text>
                  </div>
                </div>
              </Space>
            </Col>
            
            <Col xs={24} lg={10}>
              <div className="routine-controls" style={{
                background: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '24px',
                backdropFilter: 'blur(10px)'
              }}>
                <Space direction="vertical" size="medium" style={{ width: '100%' }}>
                  <Text strong style={{ color: 'white', fontSize: '16px', display: 'block' }}>
                    Configure Class Schedule
                  </Text>
                  
                  <Select
                    placeholder="Select Program"
                    style={{ width: '100%', marginBottom: '12px' }}
                    value={selectedProgram}
                    onChange={(value) => {
                      console.log('Program selected:', value);
                      setSelectedProgram(value);
                      setSelectedSemester(null);
                      setSelectedSection(null);
                    }}
                    loading={programsLoading}
                    size="large"
                    styles={{
                      popup: {
                        root: {
                          borderRadius: '12px',
                          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
                        }
                      }
                    }}
                    notFoundContent={programsLoading ? "Loading programs..." : "No programs available"}
                  >
                    {(Array.isArray(programs) ? programs : []).map(program => (
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
        
        {/* Error Alert for Programs Loading */}
        {programsError && (
          <Alert
            message="Error Loading Programs"
            description={programsError.response?.data?.message || programsError.message || 'Failed to load programs. Please refresh the page or contact support.'}
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
        

        
        {/* Selection Summary Card - Only visible when all selections are made */}
        {selectedProgram && selectedSemester && selectedSection && (
          <Card 
            style={{
              borderRadius: '16px',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              background: 'white'
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
                      {selectedProgram} - Semester {selectedSemester} - Section {selectedSection}
                    </Title>
                    <Space size="large" style={{ marginTop: '8px' }}>
                      <Statistic 
                        valueStyle={{ fontSize: '16px', color: '#667eea' }}
                        value={routineLoading ? '-' : 
                          routineError ? '0' : 
                          !routineData ? '0' :
                          Object.values(routineData.routine || {}).reduce((total, day) => 
                            total + Object.keys(day || {}).length, 0)}
                        prefix={<BookOutlined style={{ fontSize: '16px' }} />}
                        suffix="classes"
                      />
                      <Statistic 
                        valueStyle={{ fontSize: '16px', color: '#667eea' }}
                        value={routineLoading ? '-' : 
                          routineError ? '0' : 
                          !routineData ? '0' :
                          Object.keys(routineData.routine || {}).filter(day => 
                            Object.keys(routineData.routine[day] || {}).length > 0).length}
                        prefix={<CalendarOutlined style={{ fontSize: '16px' }} />}
                        suffix="days"
                      />
                    </Space>
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
        
        {/* Routine Grid Card */}
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
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '2px' }}>
                    {selectedProgram} • Semester {selectedSemester} • Section {selectedSection}
                  </div>
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
              <Space>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={() => setDayTimeSelectionVisible(true)}
                  style={{ borderRadius: '8px', height: '40px' }}
                >
                  Add New Class
                </Button>
                
                {/* PDF Export Actions */}
                <PDFActions 
                  programCode={selectedProgram}
                  semester={selectedSemester}
                  section={selectedSection}
                  allowImport={false}
                  allowExport={true}
                  size="middle"
                  style={{ borderRadius: '8px', height: '40px' }}
                  onExportSuccess={(filename) => {
                    message.success(`Routine exported as ${filename}`);
                  }}
                  onExportError={(error) => {
                    message.error('Failed to export routine: ' + (error.response?.data?.message || error.message));
                  }}
                />
              </Space>
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
            <div style={{ 
              background: 'white',
              borderRadius: '12px',
              padding: '4px 6px' 
            }}>
              <RoutineGrid
                programCode={selectedProgram}
                semester={selectedSemester}
                section={selectedSection}
                isEditable={true}
                demoMode={false}
                onCellDoubleClicked={handleCellClick}
                routineData={routineData}
                refetchRoutine={refetchRoutine}
              />
            </div>
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
                <CalendarOutlined style={{ fontSize: '32px', color: 'white' }} />
              </div>
              
              <Title level={3} style={{ color: '#1a1a1a', marginBottom: '16px' }}>
                Get Started with Class Schedule
              </Title>
              
              <Text style={{ fontSize: '16px', color: '#666', display: 'block', marginBottom: '32px' }}>
                Select a Program, Semester, and Section from the options above to create and manage class schedules
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
                    <Text strong style={{ color: '#1a1a1a' }}>Visual Schedule</Text>
                    <div style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
                      Interactive grid-based interface
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
                    <Text strong style={{ color: '#1a1a1a' }}>Excel Integration</Text>
                    <div style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
                      Import and export capabilities
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
                    <Text strong style={{ color: '#1a1a1a' }}>Real-time Sync</Text>
                    <div style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
                      Automatic updates for all users
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          </Card>
        )}
        
      </Space>
      
      {/* Assign Class Modal */}
      {isModalVisible && selectedCell && (
        <AssignClassModal
          visible={isModalVisible}
          onCancel={handleModalClose}
          onSave={handleAssignmentSuccess}
          programCode={selectedCell.programCode}
          semester={selectedCell.semester}
          section={selectedCell.section}
          dayIndex={selectedCell.dayIndex}
          slotIndex={selectedCell.slotIndex}
          timeSlots={timeSlotsData?.data || []}
          existingClass={selectedCell.existingClass}
          loading={false}
        />
      )}

      {/* Enhanced Day/Time Selection Modal */}
      {dayTimeSelectionVisible && (
        <Modal
          title={
            <Space>
              <CalendarOutlined />
              <span>Select Day and Time Slot</span>
            </Space>
          }
          open={dayTimeSelectionVisible}
          onCancel={() => setDayTimeSelectionVisible(false)}
          footer={[
            <Button key="cancel" onClick={() => setDayTimeSelectionVisible(false)}>
              Cancel
            </Button>,
            <Button 
              key="submit" 
              type="primary"
              disabled={
                selectedDayTime.dayIndex === null || 
                selectedDayTime.slotIndex === null ||
                validateDayTimeSelection(selectedDayTime.dayIndex, selectedDayTime.slotIndex).length > 0
              }
              onClick={() => {
                const validationErrors = validateDayTimeSelection(selectedDayTime.dayIndex, selectedDayTime.slotIndex);
                if (validationErrors.length > 0) {
                  message.error(validationErrors.join(', '));
                  return;
                }
                
                setDayTimeSelectionVisible(false);
                handleCellClick(selectedDayTime.dayIndex, selectedDayTime.slotIndex, null);
              }}
            >
              Continue to Assign Class
            </Button>
          ]}
          width={600}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* Info Card */}
            <Card size="small" style={{ backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Text strong>Program:</Text> {selectedProgram}
                </Col>
                <Col span={8}>
                  <Text strong>Semester:</Text> {selectedSemester}
                </Col>
                <Col span={8}>
                  <Text strong>Section:</Text> {selectedSection}
                </Col>
              </Row>
            </Card>

            <Form layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item 
                    label={
                      <Space>
                        <CalendarOutlined />
                        <span>Day</span>
                      </Space>
                    }
                    required
                  >
                    <Select
                      value={selectedDayTime.dayIndex}
                      onChange={(value) => setSelectedDayTime({...selectedDayTime, dayIndex: value})}
                      style={{ width: '100%' }}
                      placeholder="Select day"
                    >
                      <Option value={0}>Sunday</Option>
                      <Option value={1}>Monday</Option>
                      <Option value={2}>Tuesday</Option>
                      <Option value={3}>Wednesday</Option>
                      <Option value={4}>Thursday</Option>
                      <Option value={5}>Friday</Option>
                      <Option value={6}>Saturday</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item 
                    label={
                      <Space>
                        <ClockCircleOutlined />
                        <span>Time Slot</span>
                      </Space>
                    }
                    required
                  >
                    <Select
                      value={selectedDayTime.slotIndex}
                      onChange={(value) => setSelectedDayTime({...selectedDayTime, slotIndex: value})}
                      style={{ width: '100%' }}
                      placeholder="Select time slot"
                      loading={!timeSlotsData?.data}
                    >
                      {(timeSlotsData?.data || []).map((slot, index) => (
                        <Option 
                          key={index} 
                          value={index}
                          disabled={slot.isBreak}
                        >
                          <Space>
                            <span>{slot.startTime} - {slot.endTime}</span>
                            {slot.isBreak && <Tag color="orange">Break</Tag>}
                          </Space>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Form>
            
            {/* Enhanced slot status indicator */}
            {routineData && selectedDayTime.dayIndex !== null && selectedDayTime.slotIndex !== null && (
              <div>
                {(() => {
                  const validationErrors = validateDayTimeSelection(selectedDayTime.dayIndex, selectedDayTime.slotIndex);
                  const isOccupied = isSlotOccupied(selectedDayTime.dayIndex, selectedDayTime.slotIndex);
                  const slotDetails = getSlotDetails(selectedDayTime.dayIndex, selectedDayTime.slotIndex);
                  
                  if (validationErrors.length > 0) {
                    return (
                      <Alert
                        type="error"
                        message="Invalid Selection"
                        description={validationErrors.join(', ')}
                        showIcon
                      />
                    );
                  }
                  
                  if (isOccupied && slotDetails) {
                    return (
                      <Alert
                        type="warning"
                        message="Slot Already Occupied"
                        description={
                          <div>
                            <div><strong>Subject:</strong> {slotDetails.subjectName}</div>
                            <div><strong>Teacher:</strong> {Array.isArray(slotDetails.teacherNames) ? slotDetails.teacherNames.join(', ') : slotDetails.teacherNames}</div>
                            <div><strong>Room:</strong> {slotDetails.roomName}</div>
                            <div style={{ marginTop: '8px' }}>
                              Continuing will let you edit or replace the existing class.
                            </div>
                          </div>
                        }
                        showIcon
                      />
                    );
                  }
                  
                  return (
                    <Alert
                      type="success"
                      message="Slot Available"
                      description="This time slot is available for a new class assignment."
                      showIcon
                    />
                  );
                })()}
              </div>
            )}

            {/* Quick slot availability overview */}
            {selectedDayTime.dayIndex !== null && (
              <Card 
                size="small" 
                title={
                  <Space>
                    <CalendarOutlined />
                    <span>
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][selectedDayTime.dayIndex]} 
                      Schedule Overview
                    </span>
                  </Space>
                }
                style={{ backgroundColor: '#fafafa' }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(timeSlotsData?.data || []).map((slot, index) => {
                    const isCurrentSlot = index === selectedDayTime.slotIndex;
                    const isOccupied = isSlotOccupied(selectedDayTime.dayIndex, index);
                    const isBreak = slot.isBreak;
                    
                    let color = 'default';
                    let text = 'Free';
                    
                    if (isBreak) {
                      color = 'orange';
                      text = 'Break';
                    } else if (isOccupied) {
                      color = 'red';
                      text = 'Occupied';
                    } else {
                      color = 'green';
                      text = 'Free';
                    }
                    
                    if (isCurrentSlot) {
                      color = 'blue';
                    }
                    
                    return (
                      <Tag 
                        key={index} 
                        color={color}
                        style={{ 
                          margin: '2px',
                          cursor: isBreak ? 'not-allowed' : 'pointer',
                          border: isCurrentSlot ? '2px solid #1890ff' : undefined
                        }}
                        onClick={() => {
                          if (!isBreak) {
                            setSelectedDayTime({...selectedDayTime, slotIndex: index});
                          }
                        }}
                      >
                        {slot.startTime} {isCurrentSlot && '(Selected)'}
                      </Tag>
                    );
                  })}
                </div>
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                  Click on any time slot above to select it quickly
                </div>
              </Card>
            )}
          </Space>
        </Modal>
      )}
    </div>
  );
};

export default ProgramRoutineManager;
