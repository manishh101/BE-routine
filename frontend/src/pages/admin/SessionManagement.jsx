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
  Select,
  message,
  Popconfirm,
  Progress,
  Steps,
  Divider
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  SettingOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  BarChartOutlined,
  CopyOutlined
} from '@ant-design/icons';
import { sessionsAPI, academicCalendarsAPI, programsAPI } from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { Step } = Steps;

const SessionManagement = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'dashboard'
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    const response = await sessionsAPI.getAllSessions();
    return response.data;
  }, []);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });

  const sessions = data?.data || [];

  // Fetch academic calendars for form
  const { data: calendarsData } = useQuery({
    queryKey: ['academic-calendars'],
    queryFn: async () => {
      const response = await academicCalendarsAPI.getCalendars();
      return response.data;
    }
  });

  const calendars = calendarsData?.data || [];

  // Fetch programs for form
  const { data: programsData } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => {
      const response = await programsAPI.getPrograms();
      return response.data;
    }
  });

  const programs = programsData?.data || [];

  // Create session mutation
  const createMutation = useMutation({
    mutationFn: (sessionData) => sessionsAPI.createSession(sessionData),
    onSuccess: () => {
      message.success('Academic session created successfully');
      queryClient.invalidateQueries(['sessions']);
      setIsModalVisible(false);
      form.resetFields();
    },
    onError: (error) => {
      message.error(`Failed to create session: ${error.response?.data?.message || error.message}`);
    }
  });

  // Update session mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => sessionsAPI.updateSession(id, data),
    onSuccess: () => {
      message.success('Academic session updated successfully');
      queryClient.invalidateQueries(['sessions']);
      setIsModalVisible(false);
      setEditingSession(null);
      form.resetFields();
    },
    onError: (error) => {
      message.error(`Failed to update session: ${error.response?.data?.message || error.message}`);
    }
  });

  // Delete session mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => sessionsAPI.deleteSession(id),
    onSuccess: () => {
      message.success('Academic session deleted successfully');
      queryClient.invalidateQueries(['sessions']);
    },
    onError: (error) => {
      message.error(`Failed to delete session: ${error.response?.data?.message || error.message}`);
    }
  });

  // Status change mutations
  const activateMutation = useMutation({
    mutationFn: (id) => sessionsAPI.activateSession(id),
    onSuccess: () => {
      message.success('Session activated successfully');
      queryClient.invalidateQueries(['sessions']);
    },
    onError: (error) => {
      message.error(`Failed to activate session: ${error.response?.data?.message || error.message}`);
    }
  });

  const completeMutation = useMutation({
    mutationFn: (id) => sessionsAPI.completeSession(id),
    onSuccess: () => {
      message.success('Session completed successfully');
      queryClient.invalidateQueries(['sessions']);
    },
    onError: (error) => {
      message.error(`Failed to complete session: ${error.response?.data?.message || error.message}`);
    }
  });

  const archiveMutation = useMutation({
    mutationFn: (id) => sessionsAPI.archiveSession(id),
    onSuccess: () => {
      message.success('Session archived successfully');
      queryClient.invalidateQueries(['sessions']);
    },
    onError: (error) => {
      message.error(`Failed to archive session: ${error.response?.data?.message || error.message}`);
    }
  });

  const handleCreate = () => {
    setEditingSession(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (session) => {
    setEditingSession(session);
    form.setFieldsValue({
      name: session.name,
      academicCalendarId: session.academicCalendarId,
      programIds: session.programIds,
      description: session.description,
      status: session.status
    });
    setIsModalVisible(true);
  };

  const handleDelete = (id) => {
    deleteMutation.mutate(id);
  };

  const handleStatusChange = (action, sessionId) => {
    switch (action) {
      case 'activate':
        activateMutation.mutate(sessionId);
        break;
      case 'complete':
        completeMutation.mutate(sessionId);
        break;
      case 'archive':
        archiveMutation.mutate(sessionId);
        break;
      default:
        break;
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingSession) {
        updateMutation.mutate({ 
          id: editingSession._id, 
          data: values 
        });
      } else {
        createMutation.mutate(values);
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const getSessionStepStatus = (status) => {
    const statuses = ['PLANNING', 'DRAFT', 'APPROVED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'];
    return statuses.indexOf(status);
  };

  const getStatusColor = (status) => {
    const colors = {
      PLANNING: 'default',
      DRAFT: 'processing',
      APPROVED: 'warning',
      ACTIVE: 'success',
      COMPLETED: 'purple',
      ARCHIVED: 'magenta'
    };
    return colors[status] || 'default';
  };

  const columns = [
    {
      title: 'Session Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      render: (text, record) => (
        <div>
          <Text strong style={{ fontSize: '14px' }}>{text || 'N/A'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.description || 'No description'}
          </Text>
        </div>
      )
    },
    {
      title: 'Academic Year',
      dataIndex: 'academicCalendar',
      key: 'academicYear',
      render: (calendar) => (
        <Text>{calendar?.academicYear || 'N/A'}</Text>
      )
    },
    {
      title: 'Programs',
      dataIndex: 'programs',
      key: 'programs',
      render: (programs) => (
        <div>
          {programs && programs.length > 0 ? (
            programs.slice(0, 2).map(program => (
              <Tag key={program._id} style={{ marginBottom: '2px' }}>
                {program.code}
              </Tag>
            ))
          ) : (
            <Text type="secondary">No programs</Text>
          )}
          {programs && programs.length > 2 && (
            <Tag>+{programs.length - 2} more</Tag>
          )}
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      filters: [
        { text: 'Planning', value: 'PLANNING' },
        { text: 'Draft', value: 'DRAFT' },
        { text: 'Approved', value: 'APPROVED' },
        { text: 'Active', value: 'ACTIVE' },
        { text: 'Completed', value: 'COMPLETED' },
        { text: 'Archived', value: 'ARCHIVED' }
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {status || 'PLANNING'}
        </Tag>
      )
    },
    {
      title: 'Progress',
      key: 'progress',
      align: 'center',
      render: (_, record) => {
        const currentStep = getSessionStepStatus(record.status);
        const totalSteps = 6;
        const percentage = Math.round((currentStep / (totalSteps - 1)) * 100);
        
        return (
          <Progress 
            percent={percentage} 
            size="small" 
            status={record.status === 'ACTIVE' ? 'active' : 'normal'}
          />
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      render: (_, record) => (
        <Space size="small" direction="vertical">
          <Space size="small">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              size="small"
            >
              Edit
            </Button>
            {record.status === 'DRAFT' && (
              <Button
                type="link"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStatusChange('activate', record._id)}
                size="small"
              >
                Activate
              </Button>
            )}
            {record.status === 'ACTIVE' && (
              <Button
                type="link"
                icon={<CheckCircleOutlined />}
                onClick={() => handleStatusChange('complete', record._id)}
                size="small"
              >
                Complete
              </Button>
            )}
            {record.status === 'COMPLETED' && (
              <Button
                type="link"
                icon={<FileTextOutlined />}
                onClick={() => handleStatusChange('archive', record._id)}
                size="small"
              >
                Archive
              </Button>
            )}
          </Space>
          <Popconfirm
            title="Delete Session"
            description="Are you sure you want to delete this session?"
            onConfirm={() => handleDelete(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  if (isError) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Error Loading Sessions"
          description={`Failed to load sessions: ${error?.message || 'Unknown error'}`}
          type="error"
          action={
            <Button size="small" onClick={refetch}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const activeSession = sessions.find(s => s.status === 'ACTIVE');
  const statusCounts = sessions.reduce((acc, session) => {
    acc[session.status] = (acc[session.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <Row gutter={[16, 16]}>
        {/* Header */}
        <Col span={24}>
          <Card>
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                  <SettingOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
                  Session Management
                </Title>
                <Text type="secondary">Manage academic session lifecycle and workflows</Text>
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
                    Create Session
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Statistics */}
        <Col span={24}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Total Sessions"
                  value={sessions.length}
                  prefix={<SettingOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Active Sessions"
                  value={statusCounts.ACTIVE || 0}
                  prefix={<PlayCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Completed Sessions"
                  value={statusCounts.COMPLETED || 0}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Draft Sessions"
                  value={statusCounts.DRAFT || 0}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Active Session Overview */}
        {activeSession && (
          <Col span={24}>
            <Card title="Current Active Session" extra={
              <Tag color="success">ACTIVE</Tag>
            }>
              <Row gutter={16}>
                <Col span={12}>
                  <Title level={4}>{activeSession.name}</Title>
                  <Text type="secondary">{activeSession.description}</Text>
                </Col>
                <Col span={12}>
                  <Steps current={getSessionStepStatus(activeSession.status)} size="small">
                    <Step title="Planning" />
                    <Step title="Draft" />
                    <Step title="Approved" />
                    <Step title="Active" />
                    <Step title="Completed" />
                    <Step title="Archived" />
                  </Steps>
                </Col>
              </Row>
            </Card>
          </Col>
        )}

        {/* Sessions Table */}
        <Col span={24}>
          <Card title="Academic Sessions" extra={
            <Text type="secondary">{sessions.length} sessions</Text>
          }>
            <Spin spinning={isLoading}>
              {sessions.length === 0 && !isLoading ? (
                <Empty 
                  description="No academic sessions found"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                    Create First Session
                  </Button>
                </Empty>
              ) : (
                <Table
                  columns={columns}
                  dataSource={sessions}
                  rowKey="_id"
                  pagination={{
                    total: sessions.length,
                    pageSize: 10,
                    showTotal: (total, range) => 
                      `${range[0]}-${range[1]} of ${total} sessions`,
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
        title={editingSession ? 'Edit Academic Session' : 'Create New Academic Session'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingSession(null);
          form.resetFields();
        }}
        confirmLoading={createMutation.isLoading || updateMutation.isLoading}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="name"
            label="Session Name"
            rules={[
              { required: true, message: 'Please enter session name' }
            ]}
          >
            <Input placeholder="e.g., Spring 2024 Session" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="academicCalendarId"
                label="Academic Calendar"
                rules={[
                  { required: true, message: 'Please select academic calendar' }
                ]}
              >
                <Select placeholder="Select academic calendar">
                  {calendars.map(calendar => (
                    <Option key={calendar._id} value={calendar._id}>
                      {calendar.academicYear}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="Status"
                rules={[
                  { required: true, message: 'Please select status' }
                ]}
              >
                <Select placeholder="Select status">
                  <Option value="PLANNING">Planning</Option>
                  <Option value="DRAFT">Draft</Option>
                  <Option value="APPROVED">Approved</Option>
                  <Option value="ACTIVE">Active</Option>
                  <Option value="COMPLETED">Completed</Option>
                  <Option value="ARCHIVED">Archived</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="programIds"
            label="Programs"
            rules={[
              { required: true, message: 'Please select at least one program' }
            ]}
          >
            <Select 
              mode="multiple" 
              placeholder="Select programs"
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {programs.map(program => (
                <Option key={program._id} value={program._id}>
                  {program.code} - {program.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea 
              rows={3} 
              placeholder="Description of this academic session"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SessionManagement;
