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
  InputNumber,
  Divider,
  Badge
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  UsergroupAddOutlined,
  TeamOutlined,
  BookOutlined,
  SettingOutlined,
  BulbOutlined
} from '@ant-design/icons';
import { labGroupsAPI, programsAPI, subjectsAPI } from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

const LabGroupManagement = () => {
  const [labGroups, setLabGroups] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [autoCreateModalVisible, setAutoCreateModalVisible] = useState(false);
  const [editingLabGroup, setEditingLabGroup] = useState(null);
  const [form] = Form.useForm();
  const [autoCreateForm] = Form.useForm();

  // Statistics state
  const [stats, setStats] = useState({
    totalLabGroups: 0,
    totalStudents: 0,
    averageGroupSize: 0,
    labSubjects: 0
  });

  const fetchLabGroups = async () => {
    try {
      setLoading(true);
      const response = await labGroupsAPI.getLabGroups();
      setLabGroups(response.data || []);
      
      // Calculate statistics
      const groups = response.data || [];
      const totalStudents = groups.reduce((sum, group) => sum + (group.studentCount || 0), 0);
      const labSubjects = [...new Set(groups.map(group => group.subjectId))].length;
      
      setStats({
        totalLabGroups: groups.length,
        totalStudents,
        averageGroupSize: groups.length > 0 ? Math.round(totalStudents / groups.length) : 0,
        labSubjects
      });
    } catch (error) {
      console.error('Error fetching lab groups:', error);
      message.error('Failed to fetch lab groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrograms = async () => {
    try {
      const response = await programsAPI.getPrograms();
      setPrograms(response.data || []);
    } catch (error) {
      console.error('Error fetching programs:', error);
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await subjectsAPI.getSubjects();
      // Filter for lab subjects (typically those with practical hours)
      const labSubjects = (response.data || []).filter(subject => 
        subject.practicalHours > 0 || 
        subject.name.toLowerCase().includes('lab') ||
        subject.type === 'lab'
      );
      setSubjects(labSubjects);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  useEffect(() => {
    fetchLabGroups();
    fetchPrograms();
    fetchSubjects();
  }, []);

  const handleCreateLabGroup = async (values) => {
    try {
      if (editingLabGroup) {
        await labGroupsAPI.updateLabGroup(editingLabGroup.id, values);
        message.success('Lab group updated successfully');
      } else {
        await labGroupsAPI.createLabGroup(values);
        message.success('Lab group created successfully');
      }
      
      setModalVisible(false);
      setEditingLabGroup(null);
      form.resetFields();
      fetchLabGroups();
    } catch (error) {
      console.error('Error saving lab group:', error);
      message.error('Failed to save lab group');
    }
  };

  const handleAutoCreateLabGroups = async (values) => {
    try {
      await labGroupsAPI.autoCreateLabGroups(values);
      message.success('Lab groups created automatically based on your criteria');
      setAutoCreateModalVisible(false);
      autoCreateForm.resetFields();
      fetchLabGroups();
    } catch (error) {
      console.error('Error auto-creating lab groups:', error);
      message.error('Failed to auto-create lab groups');
    }
  };

  const handleDeleteLabGroup = async (id) => {
    try {
      await labGroupsAPI.deleteLabGroup(id);
      message.success('Lab group deleted successfully');
      fetchLabGroups();
    } catch (error) {
      console.error('Error deleting lab group:', error);
      message.error('Failed to delete lab group');
    }
  };

  const handleEditLabGroup = (labGroup) => {
    setEditingLabGroup(labGroup);
    form.setFieldsValue({
      ...labGroup,
      programId: labGroup.programId,
      subjectId: labGroup.subjectId
    });
    setModalVisible(true);
  };

  const handleAssignStudents = async (labGroupId) => {
    // This would open a modal to assign students to the lab group
    message.info('Student assignment feature coming soon');
  };

  const columns = [
    {
      title: 'Group Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <ExperimentOutlined />
          <span style={{ fontWeight: 500 }}>{text}</span>
          {record.isActive && <Badge status="success" />}
        </Space>
      ),
    },
    {
      title: 'Program',
      dataIndex: 'programCode',
      key: 'programCode',
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Semester',
      dataIndex: 'semester',
      key: 'semester',
      render: (text) => <Tag color="green">Sem {text}</Tag>,
    },
    {
      title: 'Subject',
      dataIndex: 'subjectName',
      key: 'subjectName',
      render: (text) => (
        <Space>
          <BookOutlined />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: 'Section',
      dataIndex: 'section',
      key: 'section',
      render: (text) => <Tag color="purple">{text}</Tag>,
    },
    {
      title: 'Group Size',
      dataIndex: 'maxStudents',
      key: 'maxStudents',
      render: (max, record) => (
        <Space>
          <TeamOutlined />
          <span>{record.studentCount || 0}/{max}</span>
          {record.studentCount === max && <Tag color="orange">Full</Tag>}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const color = status === 'active' ? 'green' : status === 'full' ? 'orange' : 'red';
        return <Tag color={color}>{status?.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit Lab Group">
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditLabGroup(record)}
            />
          </Tooltip>
          <Tooltip title="Assign Students">
            <Button
              type="default"
              size="small"
              icon={<UsergroupAddOutlined />}
              onClick={() => handleAssignStudents(record.id)}
            />
          </Tooltip>
          <Tooltip title="Delete Lab Group">
            <Popconfirm
              title="Are you sure you want to delete this lab group?"
              onConfirm={() => handleDeleteLabGroup(record.id)}
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
          <ExperimentOutlined /> Lab Group Management
        </Title>
        <Space>
          <Button
            type="primary"
            icon={<BulbOutlined />}
            onClick={() => setAutoCreateModalVisible(true)}
          >
            Auto Create Groups
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
          >
            Add Lab Group
          </Button>
        </Space>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Lab Groups"
              value={stats.totalLabGroups}
              prefix={<ExperimentOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Students"
              value={stats.totalStudents}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Average Group Size"
              value={stats.averageGroupSize}
              prefix={<UsergroupAddOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Lab Subjects"
              value={stats.labSubjects}
              prefix={<BookOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Info Alert */}
      <Alert
        message="Lab Group Management"
        description="Manage practical session groups for laboratory subjects. You can create groups manually or use auto-creation based on enrollment data."
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />

      {/* Lab Groups Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={labGroups}
          rowKey="id"
          loading={loading}
          pagination={{
            total: labGroups.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} lab groups`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Create/Edit Lab Group Modal */}
      <Modal
        title={editingLabGroup ? 'Edit Lab Group' : 'Create New Lab Group'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingLabGroup(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateLabGroup}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Group Name"
                rules={[{ required: true, message: 'Please enter group name' }]}
              >
                <Input placeholder="e.g., Group A, Lab 1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="maxStudents"
                label="Maximum Students"
                rules={[{ required: true, message: 'Please enter maximum students' }]}
              >
                <InputNumber 
                  min={1} 
                  max={50} 
                  placeholder="e.g., 20"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="programId"
                label="Program"
                rules={[{ required: true, message: 'Please select program' }]}
              >
                <Select placeholder="Select program">
                  {programs.map(program => (
                    <Option key={program.id} value={program.id}>
                      {program.code} - {program.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="semester"
                label="Semester"
                rules={[{ required: true, message: 'Please select semester' }]}
              >
                <Select placeholder="Select semester">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                    <Option key={sem} value={sem}>
                      Semester {sem}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="subjectId"
                label="Lab Subject"
                rules={[{ required: true, message: 'Please select subject' }]}
              >
                <Select placeholder="Select lab subject">
                  {subjects.map(subject => (
                    <Option key={subject.id} value={subject.id}>
                      {subject.code} - {subject.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="section"
                label="Section"
                rules={[{ required: true, message: 'Please enter section' }]}
              >
                <Input placeholder="e.g., A, B, C" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Description">
            <Input.TextArea 
              rows={3} 
              placeholder="Optional description for the lab group"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingLabGroup ? 'Update Lab Group' : 'Create Lab Group'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                setEditingLabGroup(null);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Auto Create Lab Groups Modal */}
      <Modal
        title="Auto Create Lab Groups"
        open={autoCreateModalVisible}
        onCancel={() => {
          setAutoCreateModalVisible(false);
          autoCreateForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Alert
          message="Automatic Lab Group Creation"
          description="This feature will automatically create lab groups based on student enrollment and your specified criteria."
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        <Form
          form={autoCreateForm}
          layout="vertical"
          onFinish={handleAutoCreateLabGroups}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="programId"
                label="Program"
                rules={[{ required: true, message: 'Please select program' }]}
              >
                <Select placeholder="Select program">
                  {programs.map(program => (
                    <Option key={program.id} value={program.id}>
                      {program.code} - {program.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="semester"
                label="Semester"
                rules={[{ required: true, message: 'Please select semester' }]}
              >
                <Select placeholder="Select semester">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                    <Option key={sem} value={sem}>
                      Semester {sem}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="maxStudentsPerGroup"
                label="Max Students Per Group"
                rules={[{ required: true, message: 'Please enter max students' }]}
              >
                <InputNumber 
                  min={5} 
                  max={30} 
                  placeholder="e.g., 20"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="groupNamingPattern"
                label="Group Naming Pattern"
                initialValue="Group {index}"
              >
                <Input placeholder="e.g., Group {index}, Lab {index}" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="subjectIds"
            label="Lab Subjects"
            rules={[{ required: true, message: 'Please select lab subjects' }]}
          >
            <Select 
              mode="multiple" 
              placeholder="Select lab subjects for group creation"
            >
              {subjects.map(subject => (
                <Option key={subject.id} value={subject.id}>
                  {subject.code} - {subject.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Divider />

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Create Lab Groups Automatically
              </Button>
              <Button onClick={() => {
                setAutoCreateModalVisible(false);
                autoCreateForm.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LabGroupManagement;
