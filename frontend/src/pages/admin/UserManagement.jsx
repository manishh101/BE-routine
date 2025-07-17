import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Statistic,
  Tooltip,
  Alert,
  Switch,
  DatePicker,
  Avatar,
  Badge,
  Tabs
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  KeyOutlined,
  TeamOutlined,
  SettingOutlined,
  EyeOutlined,
  UserAddOutlined,
  CrownOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { usersAPI, departmentsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [form] = Form.useForm();

  // Statistics state
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    adminUsers: 0,
    recentLogins: 0
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAllUsers();
      const usersData = response.data || [];
      setUsers(usersData);
      
      // Calculate statistics
      const activeUsers = usersData.filter(user => user.status === 'active').length;
      const adminUsers = usersData.filter(user => user.role === 'admin').length;
      const recentLogins = usersData.filter(user => {
        if (!user.lastLogin) return false;
        return dayjs(user.lastLogin).isAfter(dayjs().subtract(7, 'days'));
      }).length;
      
      setStats({
        totalUsers: usersData.length,
        activeUsers,
        adminUsers,
        recentLogins
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      message.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentsAPI.getDepartments();
      setDepartments(response.data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  const handleCreateUser = async (values) => {
    try {
      if (editingUser) {
        await usersAPI.updateUser(editingUser.id, values);
        message.success('User updated successfully');
      } else {
        await usersAPI.createUser(values);
        message.success('User created successfully');
      }
      
      setModalVisible(false);
      setEditingUser(null);
      form.resetFields();
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      message.error('Failed to save user');
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      await usersAPI.deleteUser(id);
      message.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      message.error('Failed to delete user');
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    form.setFieldsValue({
      ...user,
      departmentId: user.departmentId,        lastLogin: user.lastLogin ? dayjs(user.lastLogin) : null
    });
    setModalVisible(true);
  };

  const handleViewUser = (user) => {
    setViewingUser(user);
    setViewModalVisible(true);
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'red';
      case 'teacher': return 'blue';
      case 'student': return 'green';
      case 'staff': return 'orange';
      default: return 'default';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <CrownOutlined />;
      case 'teacher': return <UserOutlined />;
      case 'student': return <TeamOutlined />;
      case 'staff': return <SafetyCertificateOutlined />;
      default: return <UserOutlined />;
    }
  };

  const columns = [
    {
      title: 'User',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <Avatar 
            size={32} 
            icon={<UserOutlined />} 
            src={record.avatar}
            style={{ backgroundColor: record.status === 'active' ? '#87d068' : '#f56a00' }}
          />
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={getRoleColor(role)} icon={getRoleIcon(role)}>
          {role?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'departmentName',
      key: 'departmentName',
      render: (text) => text || <Text type="secondary">Not assigned</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Badge 
          status={status === 'active' ? 'success' : 'error'} 
          text={status?.toUpperCase()}
        />
      ),
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (date) => date ? dayjs(date).format('MMM DD, YYYY HH:mm') : 'Never',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="default"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewUser(record)}
            />
          </Tooltip>
          <Tooltip title="Edit User">
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditUser(record)}
            />
          </Tooltip>
          <Tooltip title="Delete User">
            <Popconfirm
              title="Are you sure you want to delete this user?"
              onConfirm={() => handleDeleteUser(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="primary"
                danger
                size="small"
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>
          <TeamOutlined /> User Management
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalVisible(true)}
        >
          Add User
        </Button>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={stats.totalUsers}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Active Users"
              value={stats.activeUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Admin Users"
              value={stats.adminUsers}
              prefix={<CrownOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Recent Logins (7d)"
              value={stats.recentLogins}
              prefix={<SafetyCertificateOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Users Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            total: users.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} users`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Create/Edit User Modal */}
      <Modal
        title={editingUser ? 'Edit User' : 'Create New User'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingUser(null);
          form.resetFields();
        }}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateUser}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Full Name"
                rules={[{ required: true, message: 'Please enter full name' }]}
              >
                <Input placeholder="Enter full name" />
              </Form.Item>
            </Col>
            <Col span={12}>
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
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="role"
                label="Role"
                rules={[{ required: true, message: 'Please select role' }]}
              >
                <Select placeholder="Select user role">
                  <Option value="admin">
                    <CrownOutlined /> Admin
                  </Option>
                  <Option value="teacher">
                    <UserOutlined /> Teacher
                  </Option>
                  <Option value="student">
                    <TeamOutlined /> Student
                  </Option>
                  <Option value="staff">
                    <SafetyCertificateOutlined /> Staff
                  </Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="departmentId"
                label="Department"
              >
                <Select placeholder="Select department (optional)">
                  {departments.map(dept => (
                    <Option key={dept.id} value={dept.id}>
                      {dept.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {!editingUser && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="password"
                  label="Password"
                  rules={[
                    { required: true, message: 'Please enter password' },
                    { min: 6, message: 'Password must be at least 6 characters' }
                  ]}
                >
                  <Input.Password placeholder="Enter password" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="confirmPassword"
                  label="Confirm Password"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: 'Please confirm password' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Passwords do not match'));
                      },
                    }),
                  ]}
                >
                  <Input.Password placeholder="Confirm password" />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Phone Number"
              >
                <Input placeholder="Enter phone number" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="Status"
                initialValue="active"
              >
                <Select>
                  <Option value="active">Active</Option>
                  <Option value="inactive">Inactive</Option>
                  <Option value="suspended">Suspended</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="bio" label="Bio">
            <Input.TextArea 
              rows={3} 
              placeholder="Optional bio or description"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingUser ? 'Update User' : 'Create User'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                setEditingUser(null);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* View User Modal */}
      <Modal
        title="User Details"
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setViewingUser(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setViewModalVisible(false);
            setViewingUser(null);
          }}>
            Close
          </Button>
        ]}
        width={600}
      >
        {viewingUser && (
          <div>
            <Row gutter={16} style={{ marginBottom: '16px' }}>
              <Col span={24} style={{ textAlign: 'center' }}>
                <Avatar 
                  size={80} 
                  icon={<UserOutlined />} 
                  src={viewingUser.avatar}
                  style={{ backgroundColor: viewingUser.status === 'active' ? '#87d068' : '#f56a00' }}
                />
                <Title level={4} style={{ marginTop: '8px', marginBottom: '4px' }}>
                  {viewingUser.name}
                </Title>
                <Tag color={getRoleColor(viewingUser.role)} icon={getRoleIcon(viewingUser.role)}>
                  {viewingUser.role?.toUpperCase()}
                </Tag>
              </Col>
            </Row>

            <Tabs defaultActiveKey="basic">
              <TabPane tab="Basic Info" key="basic">
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Text strong>Email:</Text>
                    <br />
                    <Text>{viewingUser.email}</Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>Phone:</Text>
                    <br />
                    <Text>{viewingUser.phone || 'Not provided'}</Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>Department:</Text>
                    <br />
                    <Text>{viewingUser.departmentName || 'Not assigned'}</Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>Status:</Text>
                    <br />
                    <Badge 
                      status={viewingUser.status === 'active' ? 'success' : 'error'} 
                      text={viewingUser.status?.toUpperCase()}
                    />
                  </Col>
                </Row>
              </TabPane>
              
              <TabPane tab="Activity" key="activity">
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Text strong>Created:</Text>
                    <br />
                    <Text>{dayjs(viewingUser.createdAt).format('MMMM DD, YYYY HH:mm')}</Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>Last Login:</Text>
                    <br />
                    <Text>
                      {viewingUser.lastLogin 
                        ? dayjs(viewingUser.lastLogin).format('MMMM DD, YYYY HH:mm')
                        : 'Never logged in'
                      }
                    </Text>
                  </Col>
                  <Col span={24}>
                    <Text strong>Bio:</Text>
                    <br />
                    <Text>{viewingUser.bio || 'No bio provided'}</Text>
                  </Col>
                </Row>
              </TabPane>
            </Tabs>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UserManagement;
