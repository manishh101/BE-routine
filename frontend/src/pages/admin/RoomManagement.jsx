import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Popconfirm,
  Tag,
  Typography,
  Row,
  Col,
  Tooltip,
  Divider,
  Alert,
  App
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  HomeOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  FilterOutlined,
  ClearOutlined,
  TeamOutlined,
  UserOutlined,
  SyncOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomsAPI, timeSlotsAPI, routinesAPI } from '../../services/api';
import { invalidateAllRoutineRelatedCaches } from '../../utils/cacheInvalidation';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

const RoomManagement = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  
  const queryClient = useQueryClient();

  const columns = [
    {
      title: 'Room Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name) => <Tag color="blue">{name}</Tag>
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 130,
      render: (type) => {
        const color = {
          'Lecture Hall': 'green',
          'Computer Lab': 'orange',
          'Electronics Lab': 'purple',
          'Microprocessor Lab': 'blue',
          'Project Lab': 'cyan',
          'Tutorial Room': 'gold',
          'Auditorium': 'red'
        }[type] || 'default';
        return <Tag color={color}>{type}</Tag>;
      }
    },
    {
      title: 'Building',
      dataIndex: 'building',
      key: 'building',
      width: 120
    },
    {
      title: 'Floor',
      dataIndex: 'floor',
      key: 'floor',
      width: 80,
      align: 'center'
    },
    {
      title: 'Capacity',
      dataIndex: 'capacity',
      key: 'capacity',
      width: 100,
      align: 'center',
      render: (capacity) => (
        <Space>
          <TeamOutlined />
          {capacity}
        </Space>
      )
    },
    {
      title: 'Features',
      dataIndex: 'features',
      key: 'features',
      width: 200,
      render: (features) => {
        if (!features || features.length === 0) return '-';
        return (
          <Space size={[0, 4]} wrap>
            {features.slice(0, 3).map((feature, index) => (
              <Tag key={index} size="small">{feature}</Tag>
            ))}
            {features.length > 3 && (
              <Tooltip title={features.slice(3).join(', ')}>
                <Tag size="small">+{features.length - 3} more</Tag>
              </Tooltip>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Status',
      key: 'status',
      width: 150,
      render: (_, record) => {
        if (!selectedDay || !selectedTimeSlot) {
          return <Tag color="default">Select day & time</Tag>;
        }
        
        if (availabilityLoading) {
          return <Tag icon={<SyncOutlined spin />} color="processing">Checking...</Tag>;
        }
        
        if (availabilityError) {
          return <Tag color="error">Error</Tag>;
        }
        
        // Check if this room is available
        const isAvailable = availabilityData?.data?.vacantRooms?.some(room => room._id === record._id);
        const occupiedRoom = availabilityData?.data?.occupiedRoomDetails?.find(room => room._id === record._id);
        
        if (isAvailable) {
          return <Tag color="success">Available</Tag>;
        } else if (occupiedRoom) {
          return (
            <Tooltip title={`Occupied by ${occupiedRoom.programCode}-${occupiedRoom.semester}-${occupiedRoom.section} (${occupiedRoom.subjectName})`}>
              <Tag color="error">Occupied</Tag>
            </Tooltip>
          );
        } else {
          return <Tag color="default">Unknown</Tag>;
        }
      }
    },
    // {
    //   title: 'Actions',
    //   key: 'actions',
    //   width: 120,
    //   fixed: 'right',
    //   render: (_, record) => (
    //     <Space size="small">
    //       <Tooltip title="Edit Room">
    //         <Button
    //           type="text"
    //           icon={<EditOutlined />}
    //           onClick={() => handleEdit(record)}
    //         />
    //       </Tooltip>
    //       <Tooltip title="Delete Room">
    //         <Popconfirm
    //           title="Delete Room"
    //           description="Are you sure you want to delete this room?"
    //           onConfirm={() => handleDelete(record)}
    //           okText="Yes"
    //           cancelText="No"
    //         >
    //           <Button
    //             type="text"
    //             icon={<DeleteOutlined />}
    //             danger
    //           />
    //         </Popconfirm>
    //       </Tooltip>
    //     </Space>
    //   )
    // }

    {
          title: 'Actions',
          key: 'actions',
          align: 'center',
          width: 180,
          render: (_, record) => (
            <Space>
              <Button 
                //type="primary" 
                ghost
                size="small" 
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
                style={{ borderColor: '#1677ff', color: '#1677ff' }}
              >
                Edit
              </Button>
              <Popconfirm
                title="Delete Room"
                description="Are you sure you want to delete this room?"
                onConfirm={() => handleDelete(record)}
                okText="Yes"
                cancelText="No"
              >
                <Button 
                  danger 
                  ghost
                  size="small" 
                  icon={<DeleteOutlined />}
                  style={{ borderColor: '#ff4d4f', color: '#ff4d4f' }}
                >
                  Delete
                </Button>
              </Popconfirm>
            </Space>
          )
        }

  ];

  // Fetch rooms
  const { 
    data: roomsData, 
    isLoading: roomsLoading, 
    error: roomsError 
  } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const response = await roomsAPI.getRooms();
      return response; // Return the full response
    }
  });

  // Fetch timeslots
  const {
    data: timeSlotsData,
    isLoading: timeSlotsLoading
  } = useQuery({
    queryKey: ['timeSlots'],
    queryFn: async () => {
      const response = await timeSlotsAPI.getTimeSlots();
      return response.data; // Extract the actual data
    }
  });

  // Create room mutation
  const createMutation = useMutation({
    mutationFn: async (roomData) => {
      const response = await roomsAPI.createRoom(roomData);
      return response.data; // Extract the actual data
    },
    onSuccess: () => {
      message.success('Room created successfully');
      // Use centralized cache invalidation for real-time sync across components
      invalidateAllRoutineRelatedCaches(queryClient, { reason: 'room_created' });
      setModalVisible(false);
      form.resetFields();
    },
    onError: (error) => {
      message.error(error.response?.data?.msg || error.response?.data?.message || 'Failed to create room');
    }
  });

  // Update room mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await roomsAPI.updateRoom(id, data);
      return response.data; // Extract the actual data
    },
    onSuccess: () => {
      message.success('Room updated successfully');
      // Use centralized cache invalidation for real-time sync across components
      invalidateAllRoutineRelatedCaches(queryClient, { reason: 'room_updated' });
      setModalVisible(false);
      setEditingRoom(null);
      form.resetFields();
    },
    onError: (error) => {
      message.error(error.response?.data?.msg || error.response?.data?.message || 'Failed to update room');
    }
  });

  // Delete room mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      console.log('Deleting room with ID:', id);
      const response = await roomsAPI.deleteRoom(id);
      console.log('Delete response:', response);
      return response.data; // Extract the actual data
    },
    onSuccess: () => {
      message.success('Room deleted successfully');
      // Use centralized cache invalidation for real-time sync across components
      invalidateAllRoutineRelatedCaches(queryClient, { reason: 'room_deleted' });
    },
    onError: (error) => {
      console.error('Delete error:', error);
      console.error('Error response:', error.response);
      const errorMessage = error.response?.data?.msg || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to delete room';
      message.error(errorMessage);
    }
  });

  // Query for room availability
  const {
    data: availabilityData,
    isLoading: availabilityLoading,
    error: availabilityError
  } = useQuery({
    queryKey: ['roomAvailability', selectedDay, selectedTimeSlot],
    queryFn: async () => {
      if (!selectedDay || !selectedTimeSlot) return { data: { vacantRooms: [], occupiedRoomDetails: [] } };
      
      try {
        const dayIndex = DAYS_OF_WEEK.indexOf(selectedDay);
        if (dayIndex === -1) {
          throw new Error('Invalid day selected');
        }

        const response = await routinesAPI.getVacantRooms(dayIndex, selectedTimeSlot);
        
        if (!response?.data?.success) {
          throw new Error('Invalid response format from server');
        }

        return {
          data: {
            vacantRooms: response.data.data.vacantRooms || [],
            occupiedRoomDetails: response.data.data.occupiedRoomDetails || [],
            timeSlot: response.data.data.queryInfo?.timeSlot,
            totalRooms: response.data.data.summary?.totalRooms || 0,
            availableCount: response.data.data.summary?.vacantCount || 0,
            occupiedCount: response.data.data.summary?.occupiedCount || 0
          }
        };
      } catch (error) {
        console.error('Room availability error:', error);
        throw error;
      }
    },
    enabled: !!(selectedDay && selectedTimeSlot),
    retry: 2,
    retryDelay: 1000,
    refetchInterval: 30000 // Refetch every 30 seconds for real-time updates
  });

  // Query for specific room availability when room is selected
  const {
    data: specificRoomAvailability,
    isLoading: specificRoomLoading,
    error: specificRoomError
  } = useQuery({
    queryKey: ['specificRoomAvailability', selectedRoom, selectedDay, selectedTimeSlot],
    queryFn: async () => {
      if (!selectedRoom || !selectedDay || !selectedTimeSlot) return null;
      
      try {
        const dayIndex = DAYS_OF_WEEK.indexOf(selectedDay);
        if (dayIndex === -1) {
          throw new Error('Invalid day selected');
        }

        const response = await routinesAPI.checkRoomAvailability(selectedRoom, dayIndex, selectedTimeSlot);
        
        if (!response?.data?.success) {
          throw new Error('Invalid response format from server');
        }

        return response.data.data;
      } catch (error) {
        console.error('Specific room availability error:', error);
        throw error;
      }
    },
    enabled: !!(selectedRoom && selectedDay && selectedTimeSlot),
    retry: 2,
    retryDelay: 1000,
    refetchInterval: 10000 // Refetch every 10 seconds for real-time updates
  });

  // Filter rooms based on selected room
  const filteredRooms = React.useMemo(() => {
    if (!roomsData?.data?.data) return [];
    
    let filtered = roomsData.data.data;

    // Apply room filter if selected
    if (selectedRoom) {
      filtered = filtered.filter(room => room._id === selectedRoom);
    }

    return filtered;
  }, [roomsData?.data?.data, selectedRoom]);

  const handleRoomChange = (value) => {
    setSelectedRoom(value);
  };

  const handleDayChange = (value) => {
    setSelectedDay(value);
  };

  const handleTimeSlotChange = (value) => {
    setSelectedTimeSlot(value);
  };

  const handleClearFilters = () => {
    setSelectedRoom(null);
    setSelectedDay(null);
    setSelectedTimeSlot(null);
  };

  // Ensure rooms is always an array and consistently access the same data structure
  const rooms = roomsData?.data?.data || [];

  // Event handlers
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      const formattedValues = {
        name: values.name.trim(),
        capacity: values.capacity,
        type: values.type,
        building: values.building || 'Main Building',
        floor: values.floor || 0,
        features: values.features || [],
        notes: values.notes?.trim() || ''
      };

      if (editingRoom) {
        updateMutation.mutate({ id: editingRoom._id, data: formattedValues });
      } else {
        createMutation.mutate(formattedValues);
      }
    } catch (error) {
      console.error('Form validation error:', error);
      message.error('Please check the form fields');
    }
  };

  const handleCancel = () => {
    setModalVisible(false);
    setEditingRoom(null);
    form.resetFields();
  };

  const handleAdd = () => {
    setEditingRoom(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (room) => {
    setEditingRoom(room);
    form.setFieldsValue({
      name: room.name,
      capacity: room.capacity,
      type: room.type,
      building: room.building,
      floor: room.floor,
      features: room.features,
      notes: room.notes
    });
    setModalVisible(true);
  };

  const handleDelete = (room) => {
    deleteMutation.mutate(room._id);
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Header */}
      <Row justify="space-between" align="middle" className="admin-page-header mobile-stack">
        <Col xs={24} lg={16}>
          <Space align="center" className="mobile-stack-vertical">
            <HomeOutlined style={{ fontSize: '32px', color: '#fa8c16' }} />
            <div className="mobile-center">
              <Title level={2} style={{ margin: 0 }}>
                Room Management
              </Title>
              <Text type="secondary">
                Manage classrooms, laboratories, and other facilities
              </Text>
            </div>
          </Space>
        </Col>
        <Col xs={24} lg={8}>
          <div className="admin-actions" style={{ textAlign: 'right' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              Add Room
            </Button>
          </div>
        </Col>
      </Row>

      {/* Search and Filters */}
      <Card>
        <Row gutter={16} className="admin-filters">
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Select Room (Optional)"
              value={selectedRoom}
              onChange={handleRoomChange}
              style={{ width: '100%' }}
              allowClear
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={(roomsData?.data?.data || []).map(room => ({
                value: room._id,
                label: `${room.name} (${room.building || 'N/A'})`,
              }))}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Select Day"
              value={selectedDay}
              onChange={handleDayChange}
              style={{ width: '100%' }}
              allowClear
              options={DAYS_OF_WEEK.map(day => ({
                value: day,
                label: (
                  <span>
                    <CalendarOutlined /> {day}
                  </span>
                ),
              }))}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Select Time Slot"
              value={selectedTimeSlot}
              onChange={handleTimeSlotChange}
              style={{ width: '100%' }}
              loading={timeSlotsLoading}
              allowClear
              optionFilterProp="label"
              options={(timeSlotsData?.data || []).map(slot => ({
                value: slot._id,
                label: `${slot.startTime} - ${slot.endTime}`,
              }))}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Button 
              icon={<ClearOutlined />}
              onClick={handleClearFilters}
              disabled={!selectedRoom && !selectedDay && !selectedTimeSlot}
              style={{ width: '100%' }}
            >
              Clear Filters
            </Button>
          </Col>
        </Row>
        
        {/* Statistics for all rooms */}
        {availabilityData?.data && selectedDay && selectedTimeSlot && !selectedRoom && (
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Alert
                message="Room Availability Summary"
                description={
                  <Space split={<Divider type="vertical" />}>
                    <Text>
                      Total Rooms: <Text strong>{availabilityData.data.totalRooms}</Text>
                    </Text>
                    <Text>
                      Available: <Text strong type="success">{availabilityData.data.availableCount}</Text>
                    </Text>
                    <Text>
                      Occupied: <Text strong type="danger">{availabilityData.data.occupiedCount}</Text>
                    </Text>
                    <Text>
                      Availability Rate:{' '}
                      <Text strong type={availabilityData.data.availableCount / availabilityData.data.totalRooms > 0.3 ? 'success' : 'warning'}>
                        {Math.round((availabilityData.data.availableCount / availabilityData.data.totalRooms) * 100)}%
                      </Text>
                    </Text>
                  </Space>
                }
                type="info"
                showIcon
              />
            </Col>
          </Row>
        )}

        {/* Specific room availability */}
        {specificRoomAvailability && selectedRoom && selectedDay && selectedTimeSlot && (
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Alert
                message="Selected Room Status"
                description={
                  <Space direction="vertical">
                    <Space split={<Divider type="vertical" />}>
                      <Text>
                        Room: <Text strong>{filteredRooms.length > 0 ? filteredRooms[0].name : 'Selected Room'}</Text>
                      </Text>
                      <Text>
                        Status: {specificRoomAvailability.isAvailable ? (
                          <Tag color="success">Available</Tag>
                        ) : (
                          <Tag color="error">Occupied</Tag>
                        )}
                      </Text>
                      <Text>
                        Day: <Text strong>{selectedDay}</Text>
                      </Text>
                      <Text>
                        Time: <Text strong>
                          {timeSlotsData?.data?.find(slot => slot._id === selectedTimeSlot)?.startTime} - 
                          {timeSlotsData?.data?.find(slot => slot._id === selectedTimeSlot)?.endTime}
                        </Text>
                      </Text>
                    </Space>
                    {specificRoomAvailability.conflict && (
                      <Space>
                        <Text type="danger">
                          Occupied by: {specificRoomAvailability.conflict.programCode}-{specificRoomAvailability.conflict.semester}-{specificRoomAvailability.conflict.section}
                        </Text>
                        <Text type="secondary">
                          Subject: {specificRoomAvailability.conflict.subjectName}
                        </Text>
                      </Space>
                    )}
                  </Space>
                }
                type={specificRoomAvailability.isAvailable ? "success" : "error"}
                showIcon
              />
            </Col>
          </Row>
        )}

        {/* Loading state for specific room */}
        {specificRoomLoading && selectedRoom && selectedDay && selectedTimeSlot && (
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Alert
                message="Checking Room Availability"
                description="Please wait while we check the availability of the selected room..."
                type="info"
                showIcon
                icon={<SyncOutlined spin />}
              />
            </Col>
          </Row>
        )}

        {/* Error states */}
        {availabilityError && !selectedRoom && (
          <Alert
            message="Error checking room availability"
            description="There was an error checking room availability. Please try again or contact support if the problem persists."
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {specificRoomError && selectedRoom && (
          <Alert
            message="Error checking specific room availability"
            description="There was an error checking the availability of the selected room. Please try again."
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* Rooms Table */}
      <Card 
        title={
          <Space>
            <span>
              {selectedRoom ? 'Selected Room' : 'Rooms'} ({filteredRooms?.length || 0})
            </span>
            {selectedRoom && (
              <Tag color="blue">
                <HomeOutlined /> {filteredRooms.length > 0 ? filteredRooms[0].name : 'Selected Room'}
              </Tag>
            )}
            {(selectedDay || selectedTimeSlot) && (
              <>
                <Tag color="green">
                  {selectedDay && <><CalendarOutlined /> {selectedDay}</>}
                  {selectedDay && selectedTimeSlot && ' | '}
                  {selectedTimeSlot && timeSlotsData?.data && (
                    <><ClockCircleOutlined /> {
                      (() => {
                        const slot = timeSlotsData.data.find(s => s._id === selectedTimeSlot);
                        return slot ? `${slot.startTime} - ${slot.endTime}` : '';
                      })()
                    }</>
                  )}
                </Tag>
                {(availabilityLoading || specificRoomLoading) && (
                  <Tag icon={<SyncOutlined spin />} color="processing">
                    Checking availability...
                  </Tag>
                )}
              </>
            )}
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredRooms || []}
          rowKey="_id"
          loading={roomsLoading || availabilityLoading}
          scroll={{ x: 1000 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} rooms`
          }}
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={
          <Space>
            <HomeOutlined />
            <span>{editingRoom ? 'Edit Room' : 'Add New Room'}</span>
          </Space>
        }
        open={modalVisible}
        onCancel={handleCancel}
        width={600}
        footer={[
          <Button key="cancel" onClick={handleCancel}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={createMutation.isLoading || updateMutation.isLoading}
            onClick={handleSave}
          >
            {editingRoom ? 'Update' : 'Create'}
          </Button>
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            type: 'Lecture Hall',
            floor: 0,
            capacity: 30,
            building: 'Main Building'
          }}
        >
          <Form.Item
            name="name"
            label="Room Name"
            rules={[
              { required: true, message: 'Please enter room name' },
              { max: 50, message: 'Room name must be 50 characters or less' }
            ]}
          >
            <Input placeholder="e.g., CIC-401, DOECE-Lab1" />
          </Form.Item>

          <Form.Item
            name="type"
            label="Room Type"
            rules={[{ required: true, message: 'Please select room type' }]}
          >
            <Select placeholder="Select room type">
              <Option value="Lecture Hall">Lecture Hall</Option>
              <Option value="Computer Lab">Computer Lab</Option>
              <Option value="Electronics Lab">Electronics Lab</Option>
              <Option value="Microprocessor Lab">Microprocessor Lab</Option>
              <Option value="Project Lab">Project Lab</Option>
              <Option value="Tutorial Room">Tutorial Room</Option>
              <Option value="Auditorium">Auditorium</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="capacity"
            label="Capacity"
            rules={[
              { required: true, message: 'Please enter capacity' },
              { type: 'number', min: 1, max: 1000, message: 'Capacity must be between 1-1000' }
            ]}
          >
            <InputNumber 
              placeholder="30" 
              style={{ width: '100%' }}
              min={1}
              max={1000}
            />
          </Form.Item>

          <Form.Item
            name="building"
            label="Building"
            rules={[{ required: true, message: 'Please select building' }]}
          >
            <Select placeholder="Select building">
              <Option value="CIC">CIC</Option>
              <Option value="DOECE">DOECE</Option>
              <Option value="Main Building">Main Building</Option>
              <Option value="Library">Library</Option>
              <Option value="Other">Other</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="floor"
            label="Floor"
            rules={[
              { type: 'number', min: 0, max: 20, message: 'Floor must be between 0-20' }
            ]}
          >
            <InputNumber 
              placeholder="1" 
              style={{ width: '100%' }}
              min={0}
              max={20}
            />
          </Form.Item>

          <Form.Item
            name="features"
            label="Features"
          >
            <Select
              mode="tags"
              placeholder="Add features (type and press Enter)"
              style={{ width: '100%' }}
            >
              <Option value="Projector">Projector</Option>
              <Option value="Whiteboard">Whiteboard</Option>
              <Option value="AC">AC</Option>
              <Option value="Smart Board">Smart Board</Option>
              <Option value="Oscilloscope">Oscilloscope</Option>
              <Option value="Function Generator">Function Generator</Option>
              <Option value="Computers">Computers</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="notes"
            label="Notes"
          >
            <TextArea
              rows={3}
              placeholder="Additional notes about the room..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default RoomManagement;

