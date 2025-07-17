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
  message,
  Popconfirm,
  Divider
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BankOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  ReloadOutlined,
  TeamOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import { departmentsAPI } from '../../services/api';

const { Title, Text } = Typography;

const DepartmentManagement = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch departments
  const fetchDepartments = useCallback(async () => {
    const response = await departmentsAPI.getDepartments();
    return response.data;
  }, []);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });

  const departments = data?.data || [];

  // Create department mutation
  const createMutation = useMutation({
    mutationFn: (departmentData) => departmentsAPI.createDepartment(departmentData),
    onSuccess: () => {
      message.success('Department created successfully');
      queryClient.invalidateQueries(['departments']);
      setIsModalVisible(false);
      form.resetFields();
    },
    onError: (error) => {
      message.error(`Failed to create department: ${error.response?.data?.message || error.message}`);
    }
  });

  // Update department mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => departmentsAPI.updateDepartment(id, data),
    onSuccess: () => {
      message.success('Department updated successfully');
      queryClient.invalidateQueries(['departments']);
      setIsModalVisible(false);
      setEditingDepartment(null);
      form.resetFields();
    },
    onError: (error) => {
      message.error(`Failed to update department: ${error.response?.data?.message || error.message}`);
    }
  });

  // Delete department mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => departmentsAPI.deleteDepartment(id),
    onSuccess: () => {
      message.success('Department deleted successfully');
      queryClient.invalidateQueries(['departments']);
    },
    onError: (error) => {
      message.error(`Failed to delete department: ${error.response?.data?.message || error.message}`);
    }
  });

  const handleCreate = () => {
    setEditingDepartment(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (department) => {
    setEditingDepartment(department);
    form.setFieldsValue({
      code: department.code,
      name: department.name,
      fullName: department.fullName,
      contactEmail: department.contactEmail,
      contactPhone: department.contactPhone,
      location: department.location
    });
    setIsModalVisible(true);
  };

  const handleDelete = (id) => {
    deleteMutation.mutate(id);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingDepartment) {
        updateMutation.mutate({ 
          id: editingDepartment._id, 
          data: values 
        });
      } else {
        createMutation.mutate(values);
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const columns = [
    {
      title: 'Department Code',
      dataIndex: 'code',
      key: 'code',
      align: 'center',
      sorter: (a, b) => (a.code || '').localeCompare(b.code || ''),
      render: (text) => text ? <Tag color="blue" style={{ fontWeight: 'bold' }}>{text}</Tag> : <Text type="secondary">N/A</Text>
    },
    {
      title: 'Department Details',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      render: (text, record) => (
        <div>
          <Text strong style={{ fontSize: '14px' }}>{text || 'N/A'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.fullName || 'No full name provided'}
          </Text>
        </div>
      )
    },
    {
      title: 'Contact Information',
      key: 'contact',
      render: (_, record) => (
        <div>
          {record.contactEmail && (
            <div style={{ marginBottom: '4px' }}>
              <MailOutlined style={{ marginRight: '6px', color: '#1890ff' }} />
              <Text style={{ fontSize: '12px' }}>{record.contactEmail}</Text>
            </div>
          )}
          {record.contactPhone && (
            <div style={{ marginBottom: '4px' }}>
              <PhoneOutlined style={{ marginRight: '6px', color: '#52c41a' }} />
              <Text style={{ fontSize: '12px' }}>{record.contactPhone}</Text>
            </div>
          )}
          {record.location && (
            <div>
              <EnvironmentOutlined style={{ marginRight: '6px', color: '#fa8c16' }} />
              <Text style={{ fontSize: '12px' }}>{record.location}</Text>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Teachers',
      key: 'teacherCount',
      align: 'center',
      render: (_, record) => (
        <div>
          <TeamOutlined style={{ color: '#722ed1', marginRight: '6px' }} />
          <Text>{record.teacherCount || 0}</Text>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      align: 'center',
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value, record) => record.isActive === value,
      render: (isActive) => (
        <Tag color={isActive !== false ? 'success' : 'error'}>
          {isActive !== false ? 'ACTIVE' : 'INACTIVE'}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{ padding: '4px 8px' }}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete Department"
            description="Are you sure you want to delete this department?"
            onConfirm={() => handleDelete(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              style={{ padding: '4px 8px' }}
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
          message="Error Loading Departments"
          description={`Failed to load departments: ${error?.message || 'Unknown error'}`}
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

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <Row gutter={[16, 16]}>
        {/* Header */}
        <Col span={24}>
          <Card>
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                  <BankOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
                  Department Management
                </Title>
                <Text type="secondary">Manage academic departments and their information</Text>
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
                    Add Department
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
                  title="Total Departments"
                  value={departments.length}
                  prefix={<BankOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Active Departments"
                  value={departments.filter(d => d.isActive !== false).length}
                  prefix={<BankOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Total Teachers"
                  value={departments.reduce((sum, d) => sum + (d.teacherCount || 0), 0)}
                  prefix={<UserOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Avg Teachers/Dept"
                  value={departments.length > 0 ? 
                    Math.round(departments.reduce((sum, d) => sum + (d.teacherCount || 0), 0) / departments.length) : 0}
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Departments Table */}
        <Col span={24}>
          <Card title="Departments List" extra={
            <Text type="secondary">{departments.length} departments</Text>
          }>
            <Spin spinning={isLoading}>
              {departments.length === 0 && !isLoading ? (
                <Empty 
                  description="No departments found"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                    Create First Department
                  </Button>
                </Empty>
              ) : (
                <Table
                  columns={columns}
                  dataSource={departments}
                  rowKey="_id"
                  pagination={{
                    total: departments.length,
                    pageSize: 10,
                    showTotal: (total, range) => 
                      `${range[0]}-${range[1]} of ${total} departments`,
                    showSizeChanger: true,
                    showQuickJumper: true,
                  }}
                  scroll={{ x: 800 }}
                />
              )}
            </Spin>
          </Card>
        </Col>
      </Row>

      {/* Create/Edit Modal */}
      <Modal
        title={editingDepartment ? 'Edit Department' : 'Create New Department'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingDepartment(null);
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
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="code"
                label="Department Code"
                rules={[
                  { required: true, message: 'Please enter department code' },
                  { max: 10, message: 'Code must not exceed 10 characters' }
                ]}
              >
                <Input placeholder="e.g., CE, EE, IT" maxLength={10} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Department Name"
                rules={[
                  { required: true, message: 'Please enter department name' },
                  { max: 100, message: 'Name must not exceed 100 characters' }
                ]}
              >
                <Input placeholder="e.g., Computer Engineering" maxLength={100} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="fullName"
            label="Full Department Name"
            rules={[
              { required: true, message: 'Please enter full department name' },
              { max: 200, message: 'Full name must not exceed 200 characters' }
            ]}
          >
            <Input placeholder="e.g., Department of Computer Engineering" maxLength={200} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="contactEmail"
                label="Contact Email"
                rules={[
                  { type: 'email', message: 'Please enter a valid email' }
                ]}
              >
                <Input placeholder="department@example.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contactPhone"
                label="Contact Phone"
                rules={[
                  { max: 20, message: 'Phone must not exceed 20 characters' }
                ]}
              >
                <Input placeholder="+977-1-xxxxxxx" maxLength={20} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="location"
            label="Location"
            rules={[
              { max: 100, message: 'Location must not exceed 100 characters' }
            ]}
          >
            <Input placeholder="Building/Floor/Room information" maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DepartmentManagement;
