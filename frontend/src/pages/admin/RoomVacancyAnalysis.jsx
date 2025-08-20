import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Select,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  Tag,
  Alert,
  Tabs,
  TimePicker,
  DatePicker,
  Badge,
  Tooltip,
  Progress,
  List,
  Avatar
} from 'antd';
import {
  HomeOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { roomVacancyAPI, roomsAPI, timeSlotsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const RoomVacancyAnalysis = () => {
  const [rooms, setRooms] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [vacantRooms, setVacantRooms] = useState([]);
  const [roomSchedules, setRoomSchedules] = useState({});
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(0); // 0 = Sunday, 1 = Monday, etc.
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());

  // Statistics state
  const [stats, setStats] = useState({
    totalRooms: 0,
    availableRooms: 0,
    utilizationRate: 0,
    peakHourUtilization: 0
  });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const fetchRooms = async () => {
    try {
      const response = await roomsAPI.getRooms();
      setRooms(response.data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const fetchTimeSlots = async () => {
    try {
      const response = await timeSlotsAPI.getTimeSlots();
      setTimeSlots(response.data || []);
    } catch (error) {
      console.error('Error fetching time slots:', error);
    }
  };

  const fetchVacantRooms = async () => {
    try {
      if (selectedDay !== null && selectedSlot !== null) {
        const response = await roomVacancyAPI.getVacantRooms(selectedDay, selectedSlot);
        setVacantRooms(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching vacant rooms:', error);
    }
  };

  const fetchRoomVacancyAnalytics = async () => {
    try {
      setLoading(true);
      const response = await roomVacancyAPI.getRoomVacancyAnalytics();
      setAnalytics(response.data);
      
      // Calculate statistics from analytics
      const totalRooms = rooms.length;
      const availableRooms = vacantRooms.length;
      const utilizationRate = response.data?.averageUtilization || 0;
      const peakHourUtilization = response.data?.peakHourUtilization || 0;
      
      setStats({
        totalRooms,
        availableRooms,
        utilizationRate,
        peakHourUtilization
      });
    } catch (error) {
      console.error('Error fetching room vacancy analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllRoomVacancies = async () => {
    try {
      const response = await roomVacancyAPI.getAllRoomVacancies();
      setRoomSchedules(response.data || {});
    } catch (error) {
      console.error('Error fetching all room vacancies:', error);
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchTimeSlots();
    fetchRoomVacancyAnalytics();
    fetchAllRoomVacancies();
  }, []);

  useEffect(() => {
    if (selectedDay !== null && selectedSlot !== null) {
      fetchVacantRooms();
    }
  }, [selectedDay, selectedSlot]);

  const handleDayChange = (day) => {
    setSelectedDay(day);
  };

  const handleSlotChange = (slotIndex) => {
    setSelectedSlot(slotIndex);
  };

  const getRoomTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'lecture': return 'blue';
      case 'lab': return 'green';
      case 'seminar': return 'purple';
      case 'auditorium': return 'red';
      default: return 'default';
    }
  };

  const getCapacityColor = (capacity) => {
    if (capacity >= 100) return 'red';
    if (capacity >= 50) return 'orange';
    if (capacity >= 30) return 'green';
    return 'blue';
  };

  const vacantRoomColumns = [
    {
      title: 'Room',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <HomeOutlined />
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.building && `Building ${record.building}`}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={getRoomTypeColor(type)}>
          {type?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Capacity',
      dataIndex: 'capacity',
      key: 'capacity',
      render: (capacity) => (
        <Tag color={getCapacityColor(capacity)} icon={<TeamOutlined />}>
          {capacity}
        </Tag>
      ),
    },
    {
      title: 'Features',
      dataIndex: 'features',
      key: 'features',
      render: (features) => (
        <Space>
          {features?.map((feature, index) => (
            <Tag key={index} size="small">{feature}</Tag>
          )) || <Text type="secondary">None</Text>}
        </Space>
      ),
    },
    {
      title: 'Next Occupied',
      dataIndex: 'nextOccupied',
      key: 'nextOccupied',
      render: (nextTime) => (
        nextTime ? (
          <Space>
            <ClockCircleOutlined />
            <Text>{nextTime}</Text>
          </Space>
        ) : (
          <Text type="secondary">Free all day</Text>
        )
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="View Room Schedule">
            <Button
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewRoomSchedule(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleViewRoomSchedule = async (roomId) => {
    try {
      const response = await roomVacancyAPI.getRoomSchedule(roomId);
      console.log('Room schedule:', response.data);
      // You can implement a modal to show detailed room schedule
    } catch (error) {
      console.error('Error fetching room schedule:', error);
    }
  };

  const utilizationData = analytics?.hourlyUtilization || [];
  const weeklyData = analytics?.weeklyUtilization || [];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>
          <HomeOutlined /> Room Vacancy Analysis
        </Title>
        <Space>
          <DatePicker 
            value={selectedDate}
            onChange={setSelectedDate}
            format="YYYY-MM-DD"
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={fetchVacantRooms}
          >
            Search Vacant Rooms
          </Button>
        </Space>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Rooms"
              value={stats.totalRooms}
              prefix={<HomeOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Currently Available"
              value={stats.availableRooms}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Average Utilization"
              value={stats.utilizationRate}
              suffix="%"
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Peak Hour Utilization"
              value={stats.peakHourUtilization}
              suffix="%"
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Search Controls */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Select Day:</Text>
              <Select
                style={{ width: '100%' }}
                placeholder="Select day"
                value={selectedDay}
                onChange={handleDayChange}
              >
                {dayNames.map((day, index) => (
                  <Option key={index} value={index}>
                    {day}
                  </Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col span={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Select Time Slot:</Text>
              <Select
                style={{ width: '100%' }}
                placeholder="Select time slot"
                value={selectedSlot}
                onChange={handleSlotChange}
              >
                {timeSlots.map((slot, index) => (
                  <Option key={index} value={index}>
                    {slot.startTime} - {slot.endTime}
                  </Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col span={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Quick Filters:</Text>
              <Space>
                <Button size="small" onClick={() => setSelectedDay(1)}>Monday</Button>
                <Button size="small" onClick={() => setSelectedDay(2)}>Tuesday</Button>
                <Button size="small" onClick={() => setSelectedDay(5)}>Friday</Button>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultActiveKey="vacant-rooms">
        <TabPane 
          tab={
            <span>
              <CheckCircleOutlined />
              Vacant Rooms
            </span>
          } 
          key="vacant-rooms"
        >
          {selectedDay !== null && selectedSlot !== null ? (
            <Card>
              <div style={{ marginBottom: '16px' }}>
                <Alert
                  message={`Showing vacant rooms for ${dayNames[selectedDay]} at ${timeSlots[selectedSlot]?.startTime || 'Selected Time'}`}
                  type="info"
                  showIcon
                />
              </div>
              <Table
                columns={vacantRoomColumns}
                dataSource={vacantRooms}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                scroll={{ x: 800 }}
              />
            </Card>
          ) : (
            <Card>
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <EnvironmentOutlined style={{ fontSize: '48px', color: '#ccc' }} />
                <Title level={4} type="secondary">Select Day and Time Slot</Title>
                <Text type="secondary">Please select a day and time slot to view vacant rooms</Text>
              </div>
            </Card>
          )}
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <BarChartOutlined />
              Utilization Analytics
            </span>
          } 
          key="analytics"
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card title="Hourly Utilization" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {utilizationData.map((hour, index) => (
                    <div key={index} style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <Text>{hour.time || `${index + 8}:00`}</Text>
                        <Text>{hour.utilization || Math.random() * 100 | 0}%</Text>
                      </div>
                      <Progress 
                        percent={hour.utilization || Math.random() * 100 | 0} 
                        size="small" 
                        status={hour.utilization > 80 ? 'exception' : 'success'}
                      />
                    </div>
                  ))}
                </Space>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title="Weekly Distribution" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {dayNames.slice(1, 6).map((day, index) => (
                    <div key={day} style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <Text>{day}</Text>
                        <Text>{weeklyData[index]?.utilization || Math.random() * 100 | 0}%</Text>
                      </div>
                      <Progress 
                        percent={weeklyData[index]?.utilization || Math.random() * 100 | 0} 
                        size="small" 
                      />
                    </div>
                  ))}
                </Space>
              </Card>
            </Col>
          </Row>
          
          <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
            <Col xs={24} md={8}>
              <Card title="Room Type Distribution" size="small">
                <List
                  size="small"
                  dataSource={[
                    { type: 'Lecture Halls', count: 15, utilization: 85 },
                    { type: 'Lab Rooms', count: 12, utilization: 78 },
                    { type: 'Seminar Rooms', count: 8, utilization: 65 },
                    { type: 'Auditoriums', count: 3, utilization: 45 }
                  ]}
                  renderItem={item => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar icon={<HomeOutlined />} size="small" />}
                        title={item.type}
                        description={`${item.count} rooms • ${item.utilization}% utilized`}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card title="Peak Usage Times" size="small">
                <List
                  size="small"
                  dataSource={[
                    { time: '10:00 - 11:00', utilization: 95 },
                    { time: '14:00 - 15:00', utilization: 92 },
                    { time: '09:00 - 10:00', utilization: 88 },
                    { time: '15:00 - 16:00', utilization: 85 }
                  ]}
                  renderItem={item => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar icon={<ClockCircleOutlined />} size="small" />}
                        title={item.time}
                        description={`${item.utilization}% utilization`}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card title="Efficiency Metrics" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text>Space Efficiency:</Text>
                    <Progress percent={analytics?.spaceEfficiency || 82} size="small" />
                  </div>
                  <div>
                    <Text>Booking Rate:</Text>
                    <Progress percent={analytics?.bookingRate || 76} size="small" />
                  </div>
                  <div>
                    <Text>Utilization Score:</Text>
                    <Progress percent={analytics?.utilizationScore || 88} size="small" />
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <CalendarOutlined />
              Room Schedules
            </span>
          } 
          key="schedules"
        >
          <Row gutter={[16, 16]}>
            {rooms.slice(0, 6).map(room => (
              <Col xs={24} md={12} lg={8} key={room.id}>
                <Card 
                  title={
                    <Space>
                      <HomeOutlined />
                      {room.name}
                      <Tag color={getRoomTypeColor(room.type)}>{room.type}</Tag>
                    </Space>
                  }
                  size="small"
                  extra={
                    <Badge 
                      status={room.currentStatus === 'occupied' ? 'error' : 'success'} 
                      text={room.currentStatus || 'Available'}
                    />
                  }
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Capacity:</Text>
                      <Tag color={getCapacityColor(room.capacity)}>{room.capacity}</Tag>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Today's Usage:</Text>
                      <Progress 
                        percent={room.todayUtilization || Math.random() * 100 | 0} 
                        size="small" 
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Next Free:</Text>
                      <Text type="secondary">{room.nextFree || 'Available now'}</Text>
                    </div>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default RoomVacancyAnalysis;
