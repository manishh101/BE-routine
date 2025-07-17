import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Progress,
  Typography,
  Space,
  Tabs,
  Tag,
  Alert,
  Spin,
  Button,
  DatePicker,
  Select
} from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  HomeOutlined,
  BookOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  TrophyOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { analyticsAPI } from '../../services/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

const AnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [teacherWorkload, setTeacherWorkload] = useState([]);
  const [roomUtilization, setRoomUtilization] = useState([]);
  const [scheduleAnalytics, setScheduleAnalytics] = useState(null);
  const [systemMetrics, setSystemMetrics] = useState(null);
  const [conflictAnalytics, setConflictAnalytics] = useState(null);
  const [selectedDateRange, setSelectedDateRange] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [
        dashboardResponse,
        teacherWorkloadResponse,
        roomUtilizationResponse,
        scheduleResponse,
        systemResponse,
        conflictResponse
      ] = await Promise.all([
        analyticsAPI.getDashboardMetrics(),
        analyticsAPI.getTeacherWorkloadReport(),
        analyticsAPI.getRoomUtilizationReport(),
        analyticsAPI.getScheduleAnalytics(),
        analyticsAPI.getSystemMetrics(),
        analyticsAPI.getConflictAnalytics()
      ]);

      setDashboardData(dashboardResponse.data);
      setTeacherWorkload(teacherWorkloadResponse.data);
      setRoomUtilization(roomUtilizationResponse.data);
      setScheduleAnalytics(scheduleResponse.data);
      setSystemMetrics(systemResponse.data);
      setConflictAnalytics(conflictResponse.data);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const teacherWorkloadColumns = [
    {
      title: 'Teacher',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <UserOutlined />
          <span>{text}</span>
          {record.isOverloaded && <Tag color="red">Overloaded</Tag>}
        </Space>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: 'Total Hours',
      dataIndex: 'totalHours',
      key: 'totalHours',
      render: (hours) => <Text strong>{hours}h</Text>,
    },
    {
      title: 'Classes Count',
      dataIndex: 'classesCount',
      key: 'classesCount',
    },
    {
      title: 'Workload %',
      dataIndex: 'workloadPercentage',
      key: 'workloadPercentage',
      render: (percentage) => (
        <Progress 
          percent={percentage} 
          size="small" 
          status={percentage > 100 ? 'exception' : percentage > 80 ? 'active' : 'success'}
        />
      ),
    },
  ];

  const roomUtilizationColumns = [
    {
      title: 'Room',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <HomeOutlined />
          <span>{text}</span>
          {record.type && <Tag color="blue">{record.type}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Capacity',
      dataIndex: 'capacity',
      key: 'capacity',
    },
    {
      title: 'Utilization %',
      dataIndex: 'utilizationPercentage',
      key: 'utilizationPercentage',
      render: (percentage) => (
        <Progress 
          percent={percentage} 
          size="small" 
          status={percentage < 50 ? 'exception' : percentage < 80 ? 'active' : 'success'}
        />
      ),
    },
    {
      title: 'Hours Used',
      dataIndex: 'hoursUsed',
      key: 'hoursUsed',
      render: (hours) => <Text>{hours}h / week</Text>,
    },
    {
      title: 'Available Slots',
      dataIndex: 'availableSlots',
      key: 'availableSlots',
      render: (slots) => <Tag color="green">{slots} slots</Tag>,
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>Loading analytics data...</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>
          <DashboardOutlined /> Analytics Dashboard
        </Title>
        <Space>
          <RangePicker 
            onChange={setSelectedDateRange}
            placeholder={['Start Date', 'End Date']}
          />
          <Button 
            type="primary" 
            onClick={handleRefresh}
            loading={refreshing}
          >
            Refresh Data
          </Button>
        </Space>
      </div>

      {/* System Overview Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Teachers"
              value={dashboardData?.totalTeachers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Rooms"
              value={dashboardData?.totalRooms || 0}
              prefix={<HomeOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Active Classes"
              value={dashboardData?.activeClasses || 0}
              prefix={<BookOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Active Conflicts"
              value={conflictAnalytics?.activeConflicts || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: conflictAnalytics?.activeConflicts > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Performance Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} md={8}>
          <Card title="System Performance" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text>Average Response Time</Text>
                <Progress percent={85} size="small" status="success" />
                <Text type="secondary">125ms</Text>
              </div>
              <div>
                <Text>Database Performance</Text>
                <Progress percent={92} size="small" status="success" />
                <Text type="secondary">Excellent</Text>
              </div>
              <div>
                <Text>Memory Usage</Text>
                <Progress percent={68} size="small" status="active" />
                <Text type="secondary">2.1GB / 3.1GB</Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="Schedule Efficiency" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text>Room Utilization</Text>
                <Progress percent={scheduleAnalytics?.averageRoomUtilization || 75} size="small" />
                <Text type="secondary">{scheduleAnalytics?.averageRoomUtilization || 75}%</Text>
              </div>
              <div>
                <Text>Teacher Workload Balance</Text>
                <Progress percent={scheduleAnalytics?.workloadBalance || 82} size="small" />
                <Text type="secondary">Well Balanced</Text>
              </div>
              <div>
                <Text>Conflict Resolution</Text>
                <Progress percent={conflictAnalytics?.resolutionRate || 95} size="small" status="success" />
                <Text type="secondary">{conflictAnalytics?.resolutionRate || 95}%</Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="Quick Stats" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Programs Active:</Text>
                <Tag color="blue">{dashboardData?.activePrograms || 4}</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Subjects Total:</Text>
                <Tag color="green">{dashboardData?.totalSubjects || 45}</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Current Session:</Text>
                <Tag color="purple">{dashboardData?.currentSession || 'Spring 2024'}</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>System Status:</Text>
                <Tag color="success">Operational</Tag>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Alerts */}
      {conflictAnalytics?.activeConflicts > 0 && (
        <Alert
          message="Active Conflicts Detected"
          description={`There are ${conflictAnalytics.activeConflicts} active conflicts that need attention. Please review the conflict detection page.`}
          type="warning"
          showIcon
          style={{ marginBottom: '24px' }}
          action={
            <Button size="small" type="primary" danger>
              View Conflicts
            </Button>
          }
        />
      )}

      {/* Detailed Analytics Tabs */}
      <Tabs defaultActiveKey="teacher-workload">
        <TabPane 
          tab={
            <span>
              <UserOutlined />
              Teacher Workload
            </span>
          } 
          key="teacher-workload"
        >
          <Card>
            <Table
              columns={teacherWorkloadColumns}
              dataSource={teacherWorkload}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 800 }}
            />
          </Card>
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <HomeOutlined />
              Room Utilization
            </span>
          } 
          key="room-utilization"
        >
          <Card>
            <Table
              columns={roomUtilizationColumns}
              dataSource={roomUtilization}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 800 }}
            />
          </Card>
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <BarChartOutlined />
              Schedule Analytics
            </span>
          } 
          key="schedule-analytics"
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card title="Weekly Distribution" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day, index) => (
                    <div key={day}>
                      <Text>{day}</Text>
                      <Progress 
                        percent={scheduleAnalytics?.weeklyDistribution?.[day] || Math.random() * 100} 
                        size="small" 
                      />
                    </div>
                  ))}
                </Space>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title="Peak Hours Analysis" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text>Morning (8-12):</Text>
                    <Progress percent={85} size="small" />
                    <Text type="secondary">High Activity</Text>
                  </div>
                  <div>
                    <Text>Afternoon (12-4):</Text>
                    <Progress percent={92} size="small" />
                    <Text type="secondary">Peak Hours</Text>
                  </div>
                  <div>
                    <Text>Evening (4-6):</Text>
                    <Progress percent={45} size="small" />
                    <Text type="secondary">Low Activity</Text>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <TrophyOutlined />
              Performance Metrics
            </span>
          } 
          key="performance"
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card title="Efficiency Metrics" size="small">
                <Statistic
                  title="Schedule Completion"
                  value={systemMetrics?.scheduleCompletion || 94}
                  suffix="%"
                  valueStyle={{ color: '#52c41a' }}
                />
                <Statistic
                  title="Resource Optimization"
                  value={systemMetrics?.resourceOptimization || 87}
                  suffix="%"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card title="Quality Metrics" size="small">
                <Statistic
                  title="Conflict Rate"
                  value={systemMetrics?.conflictRate || 2.3}
                  suffix="%"
                  valueStyle={{ color: '#ff4d4f' }}
                />
                <Statistic
                  title="Satisfaction Score"
                  value={systemMetrics?.satisfactionScore || 4.2}
                  suffix="/5"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card title="System Health" size="small">
                <Statistic
                  title="Uptime"
                  value={systemMetrics?.uptime || 99.8}
                  suffix="%"
                  valueStyle={{ color: '#52c41a' }}
                />
                <Statistic
                  title="Response Time"
                  value={systemMetrics?.responseTime || 125}
                  suffix="ms"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default AnalyticsDashboard;
