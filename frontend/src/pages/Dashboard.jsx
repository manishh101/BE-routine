import React, { useCallback, useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Typography, 
  Button, 
  Statistic,
  List,
  Space,
  Spin,
  Alert,
  Avatar,
  Tag,
  Card
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import {
  TeamOutlined,
  BookOutlined,
  ReadOutlined,
  ScheduleOutlined,
  EyeOutlined,
  DashboardFilled,
  CalendarOutlined,
  UserOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { teachersAPI, programsAPI, subjectsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../contexts/authStore';

const { Title, Text, Paragraph } = Typography;

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  
  // Mobile state
  const [isMobile, setIsMobile] = useState(false);

  // Handle screen size changes for mobile optimization
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Memoize the fetch functions to prevent infinite re-renders
  const fetchTeachers = useCallback(async () => {
    const response = await teachersAPI.getTeachers();
    return response.data || [];
  }, []);

  const fetchPrograms = useCallback(async () => {
    const response = await programsAPI.getPrograms();
    return response.data || [];
  }, []);

  const fetchSubjects = useCallback(async () => {
    const response = await subjectsAPI.getSubjects();
    return response.data || [];
  }, []);

  const teachersQuery = useQuery({ 
    queryKey: ['teachers_dashboard'], 
    queryFn: fetchTeachers,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });
  
  const programsQuery = useQuery({ 
    queryKey: ['programs_dashboard'], 
    queryFn: fetchPrograms,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: teachersQuery.isSuccess || teachersQuery.isError // Wait for teachers to finish
  });
  
  const subjectsQuery = useQuery({ 
    queryKey: ['subjects_dashboard'], 
    queryFn: fetchSubjects,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: programsQuery.isSuccess || programsQuery.isError // Wait for programs to finish
  });

  const teachers = teachersQuery.data || [];
  const programs = programsQuery.data || [];
  const subjects = subjectsQuery.data || [];

  const isLoading = teachersQuery.isLoading || programsQuery.isLoading || subjectsQuery.isLoading;
  const isFetching = teachersQuery.isFetching || programsQuery.isFetching || subjectsQuery.isFetching;

  const hasError = teachersQuery.isError || programsQuery.isError || subjectsQuery.isError;
  const errorMessages = [
    teachersQuery.error?.message,
    programsQuery.error?.message,
    subjectsQuery.error?.message
  ].filter(Boolean).join(', ');

  // Stats cards are shown to all users
  const stats = [
    { title: 'Total Teachers', value: teachers.length, icon: <TeamOutlined />, color: '#1677ff', path: isAdmin ? '/teachers-manager' : '/teacher-routine' },
    { title: 'Total Programs', value: programs.length, icon: <BookOutlined />, color: '#52c41a', path: isAdmin ? '/programs-manager' : '' },
    { title: 'Total Subjects', value: subjects.length, icon: <ReadOutlined />, color: '#722ed1', path: isAdmin ? '/subjects-manager' : '' }
  ];

  // Different quick actions based on user role
  const adminQuickActions = [
    { title: 'Routine Manager', description: 'Create and manage class schedules', icon: <ScheduleOutlined />, path: '/program-routine-manager', color: '#1677ff' },
    { title: 'Teachers Management', description: 'Manage faculty and check availability', icon: <TeamOutlined />, path: '/teachers-manager', color: '#52c41a' },
    { title: 'Room Management', description: 'Manage rooms and check vacancy', icon: <CalendarOutlined />, path: '/rooms-manager', color: '#722ed1' },
    { title: 'Academic Calendar', description: 'Manage academic sessions and events', icon: <CalendarOutlined />, path: '/academic-calendar-manager', color: '#eb2f96' },
    { title: 'Programs', description: 'Configure academic programs and semesters', icon: <BookOutlined />, path: '/programs-manager', color: '#fa8c16' },
    { title: 'Subjects', description: 'Manage course subjects and details', icon: <ReadOutlined />, path: '/subjects-manager', color: '#f5222d' }
  ];

  const userQuickActions = [
    { title: 'Class Routine', description: 'View program class schedules', icon: <CalendarOutlined />, path: '/program-routine', color: '#1677ff' },
    { title: 'Teacher Timetable', description: 'Check faculty teaching schedules', icon: <TeamOutlined />, path: '/teacher-routine', color: '#52c41a' },
    { title: 'Room Timetable', description: 'View room occupation schedules', icon: <CalendarOutlined />, path: '/room-routine', color: '#722ed1' },
    { title: 'Syllabus', description: 'Browse course subjects and details', icon: <ReadOutlined />, path: '/subjects', color: '#eb2f96' }
  ];
  
  // Use appropriate quick actions based on user role
  const quickActions = isAdmin ? adminQuickActions : userQuickActions;

  // Different getting started guides based on user role and current project status
  const adminGettingStarted = [
    { title: 'Setup Academic Session', description: 'Configure current academic year and sessions' },
    { title: 'Add Teachers & Rooms', description: 'Register faculty members and available rooms' },
    { title: 'Create Programs', description: 'Define academic programs, semesters, and subjects' },
    { title: 'Build Class Routines', description: 'Generate optimized class schedules and timetables' }
  ];

  const userGettingStarted = [
    { title: 'Browse Class Routines', description: 'View schedules by program and semester' },
    { title: 'Check Teacher Timetables', description: 'Find when instructors are teaching' },
    { title: 'View Room Schedules', description: 'Check which rooms are free or occupied' },
    { title: 'Access Syllabus', description: 'Browse course subjects and their details' }
  ];

  // Use appropriate getting started guide based on user role
  const gettingStarted = isAdmin ? adminGettingStarted : userGettingStarted;

  return (
    <div className="fade-in" style={{ width: '100%' }}>
      {/* Modern Header Section */}
      <div className="dashboard-header" style={{ 
        marginBottom: '32px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '16px',
        padding: '32px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '200px',
          height: '200px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '50%',
          transform: 'translate(50%, -50%)'
        }} />
        <Row justify="space-between" align="center" className="mobile-stack">
          <Col xs={24} lg={16}>
            <Space align="center" size="large" className="mobile-stack-vertical mobile-center">
              <div style={{
                width: isMobile ? '48px' : '56px',
                height: isMobile ? '48px' : '56px',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <DashboardFilled style={{ fontSize: isMobile ? '24px' : '28px', color: 'white' }} />
              </div>
              <div className="mobile-center">
                <Title level={1} style={{ 
                  margin: 0, 
                  color: 'white',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  fontSize: isMobile ? '24px' : '32px'
                }}>
                  {isAdmin ? 'Admin Dashboard' : 'Welcome Back'}
                </Title>
                <Paragraph style={{ 
                  margin: '8px 0 0 0', 
                  fontSize: isMobile ? '14px' : '16px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontWeight: 400
                }}>
                  {isAdmin 
                    ? 'Manage your institution\'s routine system' 
                    : 'Access class schedules and teacher information'
                  }
                </Paragraph>
              </div>
            </Space>
          </Col>
          {isFetching && !isLoading && (
            <Col xs={24} lg={8}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '8px 16px',
                borderRadius: '8px',
                justifyContent: isMobile ? 'center' : 'flex-end',
                marginTop: isMobile ? '16px' : '0'
              }}>
                <Spin size="small" />
                <Text style={{ color: 'white', fontSize: '14px' }}>Syncing data...</Text>
              </div>
            </Col>
          )}
        </Row>
      </div>

      {hasError && (
        <Alert
          message="Data Loading Error"
          description={`Failed to load some data. Please check your connection or try refreshing. ${errorMessages ? `Details: ${errorMessages}` : ''}`}
          type="warning"
          showIcon
          closable
          style={{ marginBottom: '32px' }}
        />
      )}

      {/* Modern Statistics Cards */}
      <Row gutter={[24, 24]} className="dashboard-stats" style={{ marginBottom: '32px' }}>
        {stats.map((stat) => (
          <Col xs={24} sm={12} lg={8} key={stat.title}>
            <Card
              hoverable={!!stat.path}
              onClick={() => stat.path && navigate(stat.path)}
              style={{ 
                borderRadius: '16px', 
                border: '1px solid rgba(0, 0, 0, 0.06)',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              styles={{ body: { padding: '24px' } }}
              className="slide-up"
            >
              <Row align="middle" justify="space-between">
                <Col>
                  <div style={{ marginBottom: '8px' }}>
                    <Text type="secondary" style={{ 
                      fontSize: '14px', 
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {stat.title}
                    </Text>
                  </div>
                  <div style={{ 
                    fontSize: '32px', 
                    fontWeight: 700,
                    color: stat.color,
                    lineHeight: 1.2,
                    marginBottom: '4px'
                  }}>
                    {isLoading && stat.value === 0 ? <Spin size="small" /> : stat.value}
                  </div>
                  {stat.subtitle && (
                    <Text type="secondary" style={{ fontSize: '13px' }}>
                      {stat.subtitle}
                    </Text>
                  )}
                </Col>
                <Col>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    background: `linear-gradient(135deg, ${stat.color}20 0%, ${stat.color}10 100%)`,
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    color: stat.color
                  }}>
                    {stat.icon}
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[24, 24]} className="dashboard-content">
        {/* Quick Actions */}
        <Col xs={24} lg={12}>
          <Card 
            title={<Text strong>Quick Actions</Text>}
            style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', height: '100%' }}
            styles={{ body: { padding: '0 16px 16px 16px' } }}
          >
            {isMobile ? (
              // Mobile: Show compact list
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {quickActions.slice(0, 3).map((action, index) => (
                  <Button
                    key={index}
                    block
                    size="large"
                    type={index === 0 ? 'primary' : 'default'}
                    icon={action.icon}
                    onClick={() => navigate(action.path)}
                    style={{
                      height: '56px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      background: index === 0 ? `${action.color}` : undefined,
                      borderColor: action.color,
                      color: index === 0 ? 'white' : action.color
                    }}
                  >
                    <div style={{ marginLeft: '8px' }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{action.title}</div>
                      <div style={{ fontSize: '12px', opacity: 0.8 }}>{action.description}</div>
                    </div>
                  </Button>
                ))}
              </Space>
            ) : (
              // Desktop: Show full list
              <List
                className="quick-actions-list"
                itemLayout="horizontal"
                dataSource={quickActions}
                renderItem={(action) => (
                <List.Item
                  actions={[<Button type="text" shape="circle" icon={<EyeOutlined />} onClick={() => navigate(action.path)} />]}
                  style={{padding: '12px 0'}}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar 
                        size={40} 
                        icon={action.icon} 
                        style={{ backgroundColor: `${action.color}20`, color: action.color }}
                      />
                    }
                    title={
                      <Button type="link" onClick={() => navigate(action.path)} style={{ padding: 0, height: 'auto', fontWeight: 500 }}>
                        {action.title}
                      </Button>
                    }
                    description={<Text type="secondary" style={{fontSize: '13px'}}>{action.description}</Text>}
                  />
                </List.Item>
              )}
            />
            )}
          </Card>
        </Col>

        {/* Getting Started Guide */}
        <Col xs={24} lg={12}>
          <Card 
            title={<Text strong>Getting Started</Text>}
            style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', height: '100%' }}
            styles={{ body: { padding: '0 16px 16px 16px' } }}
          >
            {isMobile ? (
              // Mobile: Compact step-by-step guide with cards
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {gettingStarted.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      background: index === 0 ? '#f0f9ff' : '#fafafa',
                      border: `1px solid ${index === 0 ? '#0ea5e9' : '#e5e5e5'}`,
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px'
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: index === 0 ? '#0ea5e9' : '#d1d5db',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}
                    >
                      {index + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontWeight: 600, 
                        fontSize: '14px', 
                        color: '#1f2937',
                        marginBottom: '4px'
                      }}>
                        {item.title}
                      </div>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#6b7280',
                        lineHeight: '1.4'
                      }}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{
                  textAlign: 'center',
                  marginTop: '12px',
                  padding: '8px',
                  background: '#f8fafc',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#64748b'
                }}>
                  Tip: Tap any action above to get started quickly
                </div>
              </Space>
            ) : (
              // Desktop: Original list layout
              <List
                itemLayout="horizontal"
                dataSource={gettingStarted}
                renderItem={(item, index) => (
                  <List.Item style={{padding: '12px 0'}}>
                    <List.Item.Meta
                      avatar={
                        <Avatar 
                          size={32} 
                          style={{ backgroundColor: '#f0f0f0', color: '#666' }}
                        >
                          {index + 1}
                        </Avatar>
                      }
                      title={<Text strong style={{fontSize: '14px'}}>{item.title}</Text>}
                      description={<Text type="secondary" style={{fontSize: '13px'}}>{item.description}</Text>}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;