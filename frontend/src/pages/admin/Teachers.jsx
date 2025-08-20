import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { 
  Card, 
  Table, 
  Typography, 
  Button, 
  Space,
  Tag,
  Avatar,
  Row,
  Col,
  Empty,
  Spin,
  Select,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Popconfirm,
  Divider,
  Tooltip,
  Alert,
  Checkbox
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TeamOutlined,
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FilterOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  ClearOutlined,
  SyncOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { teachersAPI, routinesAPI, timeSlotsAPI, departmentsAPI } from '../../services/api';
// import { useNavigate } from 'react-router-dom'; // Not used

const { Title, Text } = Typography;

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

const Teachers = () => {
  // Component state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const fetchTeachers = useCallback(async () => {
    return await teachersAPI.getTeachers();
  }, []);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['teachers'],
    queryFn: fetchTeachers,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    meta: {
      timeout: 30000
    }
  });

  // Fetch time slots for proper display
  const { data: timeSlotsData, isLoading: timeSlotsLoading } = useQuery({
    queryKey: ['timeSlots'],
    queryFn: () => timeSlotsAPI.getTimeSlots({ includeAll: 'true', includeGlobal: 'true' }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });

  // Fetch departments for teacher creation/editing
  const { data: departmentsData, isLoading: departmentsLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsAPI.getDepartments,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });

  const timeSlots = timeSlotsData?.data || [];
  const departments = departmentsData?.data || [];
  const teachers = data?.data || [];

  // Query for teacher availability
  const {
    data: availabilityData,
    isLoading: availabilityLoading,
    error: availabilityError
  } = useQuery({
    queryKey: ['teacherAvailability', selectedDay, selectedTimeSlot],
    queryFn: async () => {
      if (!selectedDay || !selectedTimeSlot) return { data: { vacantTeachers: [], occupiedTeacherDetails: [] } };
      
      try {
        const dayIndex = DAYS_OF_WEEK.indexOf(selectedDay);
        if (dayIndex === -1) {
          throw new Error('Invalid day selected');
        }

        const response = await routinesAPI.getVacantTeachers(dayIndex, selectedTimeSlot);
        
        if (!response?.data?.success) {
          throw new Error('Invalid response format from server');
        }

        return {
          data: {
            vacantTeachers: response.data.data.vacantTeachers || [],
            occupiedTeacherDetails: response.data.data.occupiedTeacherDetails || [],
            timeSlot: response.data.data.queryInfo?.timeSlot,
            totalTeachers: response.data.data.summary?.totalTeachers || 0,
            availableCount: response.data.data.summary?.vacantCount || 0,
            occupiedCount: response.data.data.summary?.occupiedCount || 0
          }
        };
      } catch (error) {
        console.error('Teacher availability error:', error);
        throw error;
      }
    },
    enabled: !!(selectedDay && selectedTimeSlot),
    retry: 2,
    retryDelay: 1000,
    refetchInterval: 30000 // Refetch every 30 seconds for real-time updates
  });

  // Query for specific teacher availability when teacher is selected
  const {
    data: specificTeacherAvailability,
    isLoading: specificTeacherLoading,
    error: specificTeacherError
  } = useQuery({
    queryKey: ['specificTeacherAvailability', selectedTeacher, selectedDay, selectedTimeSlot],
    queryFn: async () => {
      if (!selectedTeacher || !selectedDay || !selectedTimeSlot) return null;
      
      try {
        const dayIndex = DAYS_OF_WEEK.indexOf(selectedDay);
        if (dayIndex === -1) {
          throw new Error('Invalid day selected');
        }

        const response = await routinesAPI.checkTeacherAvailability(selectedTeacher, dayIndex, selectedTimeSlot);
        
        if (!response?.data?.success) {
          throw new Error('Invalid response format from server');
        }

        return response.data.data;
      } catch (error) {
        console.error('Specific teacher availability error:', error);
        throw error;
      }
    },
    enabled: !!(selectedTeacher && selectedDay && selectedTimeSlot),
    retry: 2,
    retryDelay: 1000,
    refetchInterval: 10000 // Refetch every 10 seconds for real-time updates
  });

  // Filter teachers based on selected teacher
  const filteredTeachers = React.useMemo(() => {
    if (!teachers) return [];
    
    let filtered = teachers;

    // Apply teacher filter if selected
    if (selectedTeacher) {
      filtered = filtered.filter(teacher => teacher._id === selectedTeacher);
    }

    return filtered;
  }, [teachers, selectedTeacher]);

  const handleTeacherChange = (value) => {
    setSelectedTeacher(value);
  };

  const handleDayChange = (value) => {
    setSelectedDay(value);
  };

  const handleTimeSlotChange = (value) => {
    setSelectedTimeSlot(value);
  };

  const handleClearFilters = () => {
    setSelectedTeacher(null);
    setSelectedDay(null);
    setSelectedTimeSlot(null);
  };

  // Check individual teacher availability
  const checkIndividualTeacherAvailability = async (teacherId) => {
    if (!teacherId || selectedDay === null || selectedTimeSlot === null) {
      return { isAvailable: null, conflict: null };
    }

    try {
      const dayIndex = DAYS_OF_WEEK.indexOf(selectedDay);
      const response = await routinesAPI.checkTeacherAvailability(teacherId, dayIndex, selectedTimeSlot);
      return response.data.data;
    } catch (error) {
      console.error('Error checking teacher availability:', error);
      return { isAvailable: null, conflict: null };
    }
  };

  // Update teacher mutation
  const updateTeacherMutation = useMutation({
    mutationFn: ({ id, data }) => teachersAPI.updateTeacher(id, data),
    onSuccess: () => {
      message.success('Teacher updated successfully');
      queryClient.invalidateQueries(['teachers']);
      setEditModalVisible(false);
      setEditingTeacher(null);
      form.resetFields();
    },
    onError: (error) => {
      message.error(error.response?.data?.msg || 'Failed to update teacher');
    }
  });

  // Delete teacher mutation
  const deleteTeacherMutation = useMutation({
    mutationFn: (id) => teachersAPI.deleteTeacher(id),
    onSuccess: () => {
      message.success('Teacher deleted successfully');
      queryClient.invalidateQueries(['teachers']);
    },
    onError: (error) => {
      message.error(error.response?.data?.msg || 'Failed to delete teacher');
    }
  });

  // Create teacher mutation
  const createTeacherMutation = useMutation({
    mutationFn: (data) => teachersAPI.createTeacher(data),
    onSuccess: () => {
      message.success('Teacher created successfully');
      queryClient.invalidateQueries(['teachers']);
      setEditModalVisible(false);
      setEditingTeacher(null);
      form.resetFields();
    },
    onError: (error) => {
      message.error(error.response?.data?.msg || 'Failed to create teacher');
    }
  });

  const columns = [
    {
      title: 'Avatar',
      dataIndex: 'avatar',
      key: 'avatar',
      width: 80,
      align: 'center',
      render: (avatarUrl) => <Avatar icon={<UserOutlined />} size="large" src={avatarUrl} />
    },
    {
      title: 'Name',
      dataIndex: 'fullName',
      key: 'fullName',
      sorter: (a, b) => (a.fullName || '').localeCompare(b.fullName || ''),
      render: (text, record) => (
        <div>
          <Text strong>{text || 'N/A'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.email || 'No email'}
          </Text>
        </div>
      )
    },
    {
      title: 'Short Name',
      dataIndex: 'shortName',
      key: 'shortName',
      align: 'center',
      render: (text) => text ? <Tag color="blue">{text}</Tag> : <Text type="secondary">N/A</Text>
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      key: 'designation',
      render: (text) => text || <Text type="secondary">Teacher</Text>
    },
    {
      title: 'Department',
      dataIndex: 'departmentId',
      key: 'department',
      render: (department) => {
        if (department && department.code) {
          return (
            <div>
              <Text strong>{department.code}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {department.name || 'N/A'}
              </Text>
            </div>
          );
        }
        return <Text type="secondary">Not specified</Text>;
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
        
        // Check if this teacher is available
        const isAvailable = availabilityData?.data?.vacantTeachers?.some(teacher => teacher._id === record._id);
        const occupiedTeacher = availabilityData?.data?.occupiedTeacherDetails?.find(teacher => teacher._id === record._id);
        
        if (isAvailable) {
          return <Tag color="success">Available</Tag>;
        } else if (occupiedTeacher) {
          return (
            <Tooltip title={`Occupied by ${occupiedTeacher.occupiedDetails.programCode}-${occupiedTeacher.occupiedDetails.semester}-${occupiedTeacher.occupiedDetails.section} (${occupiedTeacher.occupiedDetails.subjectName})`}>
              <Tag color="error">Occupied</Tag>
            </Tooltip>
          );
        } else {
          return <Tag color="default">Unknown</Tag>;
        }
      }
    },
    {
      title: 'Active Status',
      dataIndex: 'isActive',
      key: 'isActive',
      align: 'center',
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value, record) => record.isActive === value,
      render: (isActive) => (
        <Tag color={isActive !== false ? 'success' : 'error'}>
          {isActive !== false ? 'Active' : 'Inactive'}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      width: 220,
      render: (_, record) => (
        <Space>
          <Button 
            
            ghost
            size="small" 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{ borderColor: '#1677ff', color: '#1677ff' }}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete Teacher"
            description="Are you sure you want to delete this teacher? This action cannot be undone."
            onConfirm={() => handleDelete(record)}
            okText="Yes"
            cancelText="No"
          >
            <Button 
              //type="primary" 
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

  const handleEdit = (teacher) => {
    setEditingTeacher(teacher);
    form.setFieldsValue({
      fullName: teacher.fullName,
      shortName: teacher.shortName,
      email: teacher.email,
      designation: teacher.designation,
      departmentId: teacher.departmentId?._id || teacher.departmentId,
      phoneNumber: teacher.phoneNumber,
      isActive: teacher.isActive,
      isFullTime: teacher.isFullTime,
      maxWeeklyHours: teacher.maxWeeklyHours,
      availableDays: teacher.availableDays || [0, 1, 2, 3, 4, 5, 6] // Default to all days if not set
    });
    setEditModalVisible(true);
  };

  const handleDelete = (teacher) => {
    deleteTeacherMutation.mutate(teacher._id);
  };

  const handleAddNew = () => {
    setEditingTeacher(null);
    form.resetFields();
    // Set default values for new teacher
    form.setFieldsValue({
      isActive: true,
      isFullTime: true,
      maxWeeklyHours: 16,
      availableDays: [0, 1, 2, 3, 4, 5, 6] // Default: all days available
    });
    setEditModalVisible(true);
  };

  const handleEditSubmit = (values) => {
    if (editingTeacher) {
      updateTeacherMutation.mutate({
        id: editingTeacher._id,
        data: values
      });
    } else {
      createTeacherMutation.mutate(values);
    }
  };

  const handleEditCancel = () => {
    setEditModalVisible(false);
    setEditingTeacher(null);
    form.resetFields();
  };

  if (isError) {
    return (
      <Card style={{ textAlign: 'center', padding: '40px', borderRadius: '8px' }}>
        <Title level={4} type="danger">Error Loading Teachers</Title>
        <Text type="secondary">
          {error?.code === 'ECONNABORTED' ? 
            'Request timed out - Backend server may not be running' :
            error?.message || 'An unknown error occurred.'
          }
        </Text>
        <br />
        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
          Error details: {JSON.stringify({
            code: error?.code,
            status: error?.response?.status,
            timeout: error?.code === 'ECONNABORTED'
          })}
        </Text>
        <br />
        <Button 
          type="primary" 
          style={{ marginTop: '24px' }}
          onClick={() => refetch()}
        >
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Page Header */}
      <Row justify="space-between" align="middle" className="admin-page-header mobile-stack" style={{ marginBottom: '16px' }}>
        <Col xs={24} lg={16}>
          <Space align="center" size="middle" className="mobile-stack-vertical">
            <TeamOutlined style={{ fontSize: '32px', color: '#1677ff' }} />
            <div className="mobile-center">
              <Title level={2} style={{ margin: 0 }}>
                Teachers
              </Title>
              <Text type="secondary" style={{ fontSize: '15px' }}>
                Manage faculty members and their information.
              </Text>
            </div>
          </Space>
        </Col>
        <Col xs={24} lg={8}>
          <div className="admin-actions" style={{ textAlign: 'right' }}>
            <Button 
              type="primary" 
              size="large"
              icon={<PlusOutlined />}
              onClick={handleAddNew}
              style={{ borderRadius: '6px' }}
            >
              Add New Teacher
            </Button>
          </div>
        </Col>
      </Row>

      {/* Search and Filters */}
      <Card>
        <Row gutter={16} className="admin-filters">
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Select Teacher (Optional)"
              value={selectedTeacher}
              onChange={handleTeacherChange}
              style={{ width: '100%' }}
              allowClear
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={teachers.map(teacher => ({
                value: teacher._id,
                label: `${teacher.fullName} (${teacher.shortName || 'N/A'})`,
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
              disabled={!selectedTeacher && !selectedDay && !selectedTimeSlot}
              style={{ width: '100%' }}
            >
              Clear Filters
            </Button>
          </Col>
        </Row>
        
        {/* Statistics for all teachers */}
        {availabilityData?.data && selectedDay && selectedTimeSlot && !selectedTeacher && (
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Alert
                message="Teacher Availability Summary"
                description={
                  <Space split={<Divider type="vertical" />}>
                    <Text>
                      Total Teachers: <Text strong>{availabilityData.data.totalTeachers}</Text>
                    </Text>
                    <Text>
                      Available: <Text strong type="success">{availabilityData.data.availableCount}</Text>
                    </Text>
                    <Text>
                      Occupied: <Text strong type="danger">{availabilityData.data.occupiedCount}</Text>
                    </Text>
                    <Text>
                      Availability Rate:{' '}
                      <Text strong type={availabilityData.data.availableCount / availabilityData.data.totalTeachers > 0.3 ? 'success' : 'warning'}>
                        {Math.round((availabilityData.data.availableCount / availabilityData.data.totalTeachers) * 100)}%
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

        {/* Specific teacher availability */}
        {specificTeacherAvailability && selectedTeacher && selectedDay && selectedTimeSlot && (
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Alert
                message="Selected Teacher Status"
                description={
                  <Space direction="vertical">
                    <Space split={<Divider type="vertical" />}>
                      <Text>
                        Teacher: <Text strong>{filteredTeachers.length > 0 ? filteredTeachers[0].fullName : 'Selected Teacher'}</Text>
                      </Text>
                      <Text>
                        Status: {specificTeacherAvailability.isAvailable ? (
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
                    {specificTeacherAvailability.conflict && (
                      <Space>
                        <Text type="danger">
                          Occupied by: {specificTeacherAvailability.conflict.programCode}-{specificTeacherAvailability.conflict.semester}-{specificTeacherAvailability.conflict.section}
                        </Text>
                        <Text type="secondary">
                          Subject: {specificTeacherAvailability.conflict.subjectName}
                        </Text>
                      </Space>
                    )}
                  </Space>
                }
                type={specificTeacherAvailability.isAvailable ? "success" : "error"}
                showIcon
              />
            </Col>
          </Row>
        )}

        {/* Loading state for specific teacher */}
        {specificTeacherLoading && selectedTeacher && selectedDay && selectedTimeSlot && (
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Alert
                message="Checking Teacher Availability"
                description="Please wait while we check the availability of the selected teacher..."
                type="info"
                showIcon
                icon={<SyncOutlined spin />}
              />
            </Col>
          </Row>
        )}

        {/* Error states */}
        {availabilityError && !selectedTeacher && (
          <Alert
            message="Error checking teacher availability"
            description="There was an error checking teacher availability. Please try again or contact support if the problem persists."
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {specificTeacherError && selectedTeacher && (
          <Alert
            message="Error checking specific teacher availability"
            description="There was an error checking the availability of the selected teacher. Please try again."
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* Teachers Table */}
      <Card 
        title={
          <Space>
            <span>
              {selectedTeacher ? 'Selected Teacher' : 'Teachers'} ({filteredTeachers?.length || 0})
            </span>
            {selectedTeacher && (
              <Tag color="blue">
                <UserOutlined /> {filteredTeachers.length > 0 ? filteredTeachers[0].fullName : 'Selected Teacher'}
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
                {(availabilityLoading || specificTeacherLoading) && (
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
          dataSource={filteredTeachers || []}
          rowKey="_id"
          loading={isLoading || availabilityLoading}
          scroll={{ x: 1000 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} teachers`
          }}
        />
      </Card>

      {/* Edit Teacher Modal */}
      <Modal
      title={editingTeacher ? "Edit Teacher" : "Add New Teacher"}
      open={editModalVisible}
      onOk={form.submit}
      onCancel={handleEditCancel}
      confirmLoading={updateTeacherMutation.isLoading || createTeacherMutation.isLoading}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleEditSubmit}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="fullName"
              label="Full Name"
              rules={[{ required: true, message: 'Please enter full name' }]}
            >
              <Input placeholder="Enter full name" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="shortName"
              label="Short Name"
              rules={[{ required: true, message: 'Please enter short name' }]}
            >
              <Input placeholder="Enter short name" />
            </Form.Item>
          </Col>
        </Row>
        
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Please enter email' },
            { type: 'email', message: 'Please enter valid email' }
          ]}
        >
          <Input placeholder="Enter email address" />
        </Form.Item>
        
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="designation"
              label="Designation"
              rules={[{ required: true, message: 'Please select designation' }]}
            >
              <Select placeholder="Select designation">
                <Select.Option value="Professor">Professor</Select.Option>
                <Select.Option value="Associate Professor">Associate Professor</Select.Option>
                <Select.Option value="Assistant Professor">Assistant Professor</Select.Option>
                <Select.Option value="Senior Lecturer">Senior Lecturer</Select.Option>
                <Select.Option value="Lecturer">Lecturer</Select.Option>
                <Select.Option value="Teaching Assistant">Teaching Assistant</Select.Option>
                <Select.Option value="Lab Instructor">Lab Instructor</Select.Option>
                <Select.Option value="Sr. Instructor">Sr. Instructor</Select.Option>
                <Select.Option value="Deputy Instructor">Deputy Instructor</Select.Option>
                <Select.Option value="Instructor">Instructor</Select.Option>
                <Select.Option value="Chief Technical Assistant">Chief Technical Assistant</Select.Option>
                <Select.Option value="Asst. Instuctor">Asst. Instructor</Select.Option>
                <Select.Option value="Office Assistant">Office Assistant</Select.Option>
                <Select.Option value="RA">RA</Select.Option>
                <Select.Option value="TA">TA</Select.Option>
                <Select.Option value="Office Attendant">Office Attendant</Select.Option>
                <Select.Option value="Chief Account Assistant">Chief Account Assistant</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="departmentId"
              label="Department"
              rules={[{ required: true, message: 'Please select department' }]}
            >
              <Select 
                placeholder="Select department"
                loading={departmentsLoading}
                showSearch
                optionFilterProp="children"
              >
                {departments.map(dept => (
                  <Select.Option key={dept._id} value={dept._id}>
                    {dept.code} - {dept.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>
        
        <Form.Item
          name="phoneNumber"
          label="Phone Number"
        >
          <Input placeholder="Enter phone number" />
        </Form.Item>
        
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="isActive"
              label="Status"
              valuePropName="checked"
            >
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="isFullTime"
              label="Full Time"
              valuePropName="checked"
            >
              <Switch checkedChildren="Yes" unCheckedChildren="No" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="maxWeeklyHours"
              label="Max Weekly Hours"
              rules={[{ type: 'number', min: 1, max: 24, message: 'Must be between 1 and 24' }]}
            >
              <Input type="number" placeholder="16" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="availableDays"
          label="Available Days"
          rules={[{ required: true, message: 'Please select at least one available day' }]}
        >
          <Checkbox.Group style={{ width: '100%' }}>
            <Row>
              <Col span={8}><Checkbox value={0}>Sun</Checkbox></Col>
              <Col span={8}><Checkbox value={1}>Mon</Checkbox></Col>
              <Col span={8}><Checkbox value={2}>Tue</Checkbox></Col>
              <Col span={8}><Checkbox value={3}>Wed</Checkbox></Col>
              <Col span={8}><Checkbox value={4}>Thu</Checkbox></Col>
              <Col span={8}><Checkbox value={5}>Fri</Checkbox></Col>
              <Col span={8}><Checkbox value={6}>Sat</Checkbox></Col>
            </Row>
          </Checkbox.Group>
        </Form.Item>
      </Form>
    </Modal>
    </Space>
  );
};

export default Teachers;