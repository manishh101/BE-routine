import React, { useState, useCallback } from 'react';
import { 
  Card, 
  Table, 
  Typography, 
  Button, 
  Space,
  Tag,
  Row,
  Col,
  Empty,
  Spin,
  Alert,
  Statistic,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  message,
  Popconfirm,
  Divider,
  Badge,
  Tooltip
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  BookOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { academicCalendarsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const AcademicCalendarManagement = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch academic calendars with improved error handling
  const fetchCalendars = useCallback(async () => {
    try {
      console.log('Fetching academic calendars');
      const response = await academicCalendarsAPI.getCalendars();
      console.log('Academic calendars response:', response);
      
      // Handle both API response formats
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data;
      } else if (Array.isArray(response.data)) {
        return response.data;
      } else {
        console.warn('Unexpected API response format:', response.data);
        return [];
      }
    } catch (error) {
      console.error('Failed to fetch calendars:', error);
      throw error;
    }
  }, []);

  const { data: calendars = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['academic-calendars'],
    queryFn: fetchCalendars,
    retry: 2,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  // Find active calendar
  const activeCalendar = calendars.find(calendar => calendar.isCurrentYear);
  const currentDate = dayjs();

  // Create calendar mutation with enhanced error handling
  const createMutation = useMutation({
    mutationFn: async (calendarData) => {
      try {
        console.log('Creating calendar with data:', calendarData);
        const response = await academicCalendarsAPI.createCalendar(calendarData);
        console.log('Create calendar response:', response);
        return response.data;
      } catch (error) {
        console.error('Error in createCalendar mutation:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      message.success('Academic calendar created successfully');
      queryClient.invalidateQueries(['academic-calendars']);
      setIsModalVisible(false);
      setEditingCalendar(null);
      form.resetFields();
    },
    onError: (error) => {
      console.error('Create calendar error:', error);
      const errorMessage = error?.response?.data?.msg || 
                          error?.response?.data?.message || 
                          error?.message || 
                          'Failed to create calendar';
      message.error(errorMessage);
    }
  });

  // Update calendar mutation with improved error handling
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      try {
        console.log('Updating calendar ID:', id, 'with data:', data);
        const response = await academicCalendarsAPI.updateCalendar(id, data);
        console.log('Update calendar response:', response);
        return response.data;
      } catch (error) {
        console.error('Error in updateCalendar mutation:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      message.success('Academic calendar updated successfully');
      queryClient.invalidateQueries(['academic-calendars']);
      setIsModalVisible(false);
      setEditingCalendar(null);
      form.resetFields();
    },
    onError: (error) => {
      console.error('Update calendar error:', error);
      const errorMessage = error?.response?.data?.msg || 
                          error?.response?.data?.message || 
                          error?.message || 
                          'Failed to update calendar';
      message.error(errorMessage);
    }
  });

  // Delete calendar mutation with improved error handling
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      try {
        console.log('Deleting calendar ID:', id);
        const response = await academicCalendarsAPI.deleteCalendar(id);
        console.log('Delete calendar response:', response);
        return response.data;
      } catch (error) {
        console.error('Error in deleteCalendar mutation:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      message.success('Academic calendar deleted successfully');
      queryClient.invalidateQueries(['academic-calendars']);
    },
    onError: (error) => {
      console.error('Delete calendar error:', error);
      const errorMessage = error?.response?.data?.msg || 
                          error?.response?.data?.message || 
                          error?.message || 
                          'Failed to delete calendar';
      message.error(errorMessage);
      
      // Provide more detailed feedback to the user
      if (error?.response?.status === 409) {
        message.error('Cannot delete this academic year as it has associated data');
      } else if (error?.response?.status === 404) {
        message.error('Academic year not found');
        // Refresh the list to reflect current state
        queryClient.invalidateQueries(['academic-calendars']);
      }
    }
  });

  const handleCreate = () => {
    setEditingCalendar(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (calendar) => {
    console.log('Editing calendar:', calendar);
    setEditingCalendar(calendar);
    
    // Make sure to handle all the form fields with proper date formatting
    form.setFieldsValue({
      title: calendar.title,
      nepaliYear: calendar.nepaliYear,
      englishYear: calendar.englishYear,
      startDate: calendar.startDate ? dayjs(calendar.startDate) : null,
      endDate: calendar.endDate ? dayjs(calendar.endDate) : null,
      status: calendar.status || 'Planning',
      isCurrentYear: calendar.isCurrentYear || false,
      description: calendar.description || ''
    });
    
    setIsModalVisible(true);
  };

  const handleDelete = (id) => {
    console.log('Deleting academic year:', id);
    Modal.confirm({
      title: 'Delete Academic Year',
      content: 'Are you sure you want to delete this academic year? This action cannot be undone.',
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk() {
        deleteMutation.mutate(id);
      }
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // Format dates and prepare data structure
      const formattedValues = {
        title: values.title,
        nepaliYear: values.nepaliYear,
        englishYear: values.englishYear,
        startDate: values.startDate ? values.startDate.toISOString() : null,
        endDate: values.endDate ? values.endDate.toISOString() : null,
        status: values.status || 'Planning',
        isCurrentYear: values.isCurrentYear || false,
        description: values.description || '',
        terms: editingCalendar?.terms || [], // Preserve existing terms if editing
        holidays: editingCalendar?.holidays || [] // Preserve existing holidays if editing
      };
      
      console.log('Submitting academic year data:', formattedValues);
      
      if (editingCalendar) {
        console.log('Updating academic year:', editingCalendar._id);
        updateMutation.mutate({ 
          id: editingCalendar._id, 
          data: formattedValues 
        });
      } else {
        console.log('Creating new academic year');
        createMutation.mutate(formattedValues);
      }
    } catch (error) {
      console.error('Validation failed:', error);
      message.error('Please fill all required fields correctly');
    }
  };

  const columns = [
    {
      title: 'Academic Year',
      key: 'academicYear',
      render: (_, record) => (
        <div>
          <Text strong style={{ fontSize: '14px' }}>
            {record.title || 'N/A'}
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.nepaliYear} ({record.englishYear})
          </Text>
          {record.isCurrentYear && (
            <div style={{ marginTop: '4px' }}>
              <Badge status="processing" text="Current Year" />
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Duration',
      key: 'duration',
      render: (_, record) => (
        <div>
          <div style={{ marginBottom: '4px' }}>
            <Text style={{ fontSize: '12px' }}>
              {record.startDate ? dayjs(record.startDate).format('MMM DD, YYYY') : 'N/A'} - 
              {record.endDate ? dayjs(record.endDate).format('MMM DD, YYYY') : 'N/A'}
            </Text>
          </div>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {record.startDate && record.endDate ? 
              `${dayjs(record.endDate).diff(dayjs(record.startDate), 'days')} days` : 
              'Duration not set'}
          </Text>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      filters: [
        { text: 'Planning', value: 'Planning' },
        { text: 'Current', value: 'Current' },
        { text: 'Completed', value: 'Completed' }
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => {
        const colors = {
          Planning: 'blue',
          Current: 'green',
          Completed: 'default'
        };
        return (
          <Tag color={colors[status] || 'default'}>
            {status || 'Planning'}
          </Tag>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button 
              type="link" 
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              size="small"
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Popconfirm
              title="Are you sure you want to delete this academic calendar?"
              onConfirm={() => handleDelete(record._id)}
              okText="Yes"
              cancelText="No"
            >
              <Button 
                type="link" 
                icon={<DeleteOutlined />}
                danger
                size="small"
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  // Handle error state
  if (isError) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Error Loading Academic Calendars"
          description={error?.message || 'Failed to load academic calendars. Please try again.'}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={refetch}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]}>
        {/* Header */}
        <Col span={24}>
          <Card>
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                  <CalendarOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
                  Academic Year Management
                </Title>
                <Text type="secondary">Manage academic years and set the current active year for routine management</Text>
              </Col>
              <Col>
                <Space>
                  <Button 
                    icon={<ReloadOutlined />} 
                    onClick={refetch}
                    loading={isLoading}
                  >
                    Refresh
                  </Button>
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={handleCreate}
                  >
                    Add Academic Year
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Statistics */}
        <Col span={24}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Total Academic Years"
                  value={calendars.length}
                  prefix={<CalendarOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Active Calendar"
                  value={activeCalendar ? 1 : 0}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Current Academic Year"
                  value={activeCalendar?.title || 'None Set'}
                  prefix={<BookOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Current Active Calendar Info */}
        {activeCalendar && (
          <Col span={24}>
            <Card title="Current Academic Year Information">
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ marginBottom: '16px' }}>
                    <Text strong style={{ fontSize: '16px' }}>
                      {activeCalendar.title}
                    </Text>
                    <br />
                    <Text type="secondary">
                      {activeCalendar.nepaliYear} ({activeCalendar.englishYear})
                    </Text>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ marginBottom: '16px' }}>
                    <Text strong>Duration:</Text>
                    <br />
                    <Text type="secondary">
                      {dayjs(activeCalendar.startDate).format('MMMM DD, YYYY')} - {dayjs(activeCalendar.endDate).format('MMMM DD, YYYY')}
                    </Text>
                  </div>
                </Col>
              </Row>
              
              <Row gutter={16}>
                <Col span={12}>
                  <div>
                    <Text strong>Status:</Text>
                    <br />
                    <Tag color={activeCalendar.status === 'Current' ? 'green' : 'blue'}>
                      {activeCalendar.status}
                    </Tag>
                  </div>
                </Col>
                <Col span={12}>
                  <div>
                    <Text strong>Days Remaining:</Text>
                    <br />
                    <Text type="secondary">
                      {Math.max(0, dayjs(activeCalendar.endDate).diff(currentDate, 'days'))} days
                    </Text>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
        )}

        {/* Calendars Table */}
        <Col span={24}>
          <Card title="Academic Years" extra={
            <Text type="secondary">{calendars.length} academic years</Text>
          }>
            <Spin spinning={isLoading}>
              {calendars.length === 0 && !isLoading ? (
                <Empty 
                  description="No academic years found"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                    Create First Academic Year
                  </Button>
                </Empty>
              ) : (
                <Table
                  columns={columns}
                  dataSource={calendars}
                  rowKey="_id"
                  pagination={{
                    total: calendars.length,
                    pageSize: 10,
                    showTotal: (total, range) => 
                      `${range[0]}-${range[1]} of ${total} academic years`,
                    showSizeChanger: true,
                    showQuickJumper: true,
                  }}
                  scroll={{ x: 1000 }}
                />
              )}
            </Spin>
          </Card>
        </Col>
      </Row>

      {/* Create/Edit Modal */}
      <Modal
        title={editingCalendar ? 'Edit Academic Year' : 'Create New Academic Year'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingCalendar(null);
          form.resetFields();
        }}
        confirmLoading={createMutation.isLoading || updateMutation.isLoading}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="title"
                label="Academic Year Title"
                rules={[
                  { required: true, message: 'Please enter academic year title' }
                ]}
              >
                <Input placeholder="e.g., Academic Year 2080-2081" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="nepaliYear"
                label="Nepali Year"
                rules={[
                  { required: true, message: 'Please enter Nepali year' }
                ]}
              >
                <Input placeholder="e.g., 2080/2081" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="englishYear"
                label="English Year"
                rules={[
                  { required: true, message: 'Please enter English year' }
                ]}
              >
                <Input placeholder="e.g., 2023/2024" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="startDate"
                label="Academic Year Start Date"
                rules={[
                  { required: true, message: 'Please select start date' }
                ]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="endDate"
                label="Academic Year End Date"
                rules={[
                  { required: true, message: 'Please select end date' }
                ]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="status"
                label="Status"
                rules={[
                  { required: true, message: 'Please select status' }
                ]}
              >
                <Select placeholder="Select status">
                  <Option value="Planning">Planning</Option>
                  <Option value="Current">Current</Option>
                  <Option value="Completed">Completed</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="isCurrentYear"
                label="Set as Current Year"
                valuePropName="checked"
              >
                <Select placeholder="Set as current year">
                  <Option value={true}>Yes - Make this the active year</Option>
                  <Option value={false}>No - Keep as inactive</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Description (Optional)"
          >
            <Input.TextArea 
              rows={2} 
              placeholder="Additional notes about this academic year"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AcademicCalendarManagement;
