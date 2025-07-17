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
  Tabs,
  DatePicker,
  Switch,
  Progress,
  Badge
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { templatesAPI, programsAPI, sessionsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

const TemplateManagement = () => {
  const [templates, setTemplates] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [form] = Form.useForm();
  const [applyForm] = Form.useForm();

  // Statistics state
  const [stats, setStats] = useState({
    totalTemplates: 0,
    activeTemplates: 0,
    totalApplications: 0,
    successRate: 0
  });

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await templatesAPI.getTemplates();
      const templatesData = response.data || [];
      setTemplates(templatesData);
      
      // Calculate statistics
      const activeTemplates = templatesData.filter(template => template.status === 'active').length;
      const totalApplications = templatesData.reduce((sum, template) => sum + (template.applicationsCount || 0), 0);
      const successRate = templatesData.length > 0 
        ? Math.round(templatesData.reduce((sum, template) => sum + (template.successRate || 0), 0) / templatesData.length)
        : 0;
      
      setStats({
        totalTemplates: templatesData.length,
        activeTemplates,
        totalApplications,
        successRate
      });
    } catch (error) {
      console.error('Error fetching templates:', error);
      message.error('Failed to fetch templates');
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

  const fetchSessions = async () => {
    try {
      const response = await sessionsAPI.getAllSessions();
      setSessions(response.data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchPrograms();
    fetchSessions();
  }, []);

  const handleCreateTemplate = async (values) => {
    try {
      if (editingTemplate) {
        await templatesAPI.updateTemplate(editingTemplate.id, values);
        message.success('Template updated successfully');
      } else {
        await templatesAPI.createTemplate(values);
        message.success('Template created successfully');
      }
      
      setModalVisible(false);
      setEditingTemplate(null);
      form.resetFields();
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      message.error('Failed to save template');
    }
  };

  const handleApplyTemplate = async (values) => {
    try {
      await templatesAPI.applyTemplate(selectedTemplate.id, values);
      message.success('Template applied successfully');
      setApplyModalVisible(false);
      setSelectedTemplate(null);
      applyForm.resetFields();
    } catch (error) {
      console.error('Error applying template:', error);
      message.error('Failed to apply template');
    }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      await templatesAPI.deleteTemplate(id);
      message.success('Template deleted successfully');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      message.error('Failed to delete template');
    }
  };

  const handleCloneTemplate = async (id) => {
    try {
      await templatesAPI.cloneTemplate(id);
      message.success('Template cloned successfully');
      fetchTemplates();
    } catch (error) {
      console.error('Error cloning template:', error);
      message.error('Failed to clone template');
    }
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    form.setFieldsValue({
      ...template,
      createdAt: template.createdAt ? dayjs(template.createdAt) : null
    });
    setModalVisible(true);
  };

  const handleApplyTemplateModal = (template) => {
    setSelectedTemplate(template);
    setApplyModalVisible(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'green';
      case 'draft': return 'blue';
      case 'archived': return 'default';
      case 'deprecated': return 'red';
      default: return 'default';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'weekly': return 'blue';
      case 'semester': return 'green';
      case 'academic_year': return 'purple';
      case 'custom': return 'orange';
      default: return 'default';
    }
  };

  const columns = [
    {
      title: 'Template',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <FileTextOutlined />
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.version && `v${record.version}`}
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
        <Tag color={getTypeColor(type)}>
          {type?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Program',
      dataIndex: 'programCode',
      key: 'programCode',
      render: (text) => text ? <Tag color="blue">{text}</Tag> : <Text type="secondary">All Programs</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Badge 
          status={status === 'active' ? 'success' : status === 'draft' ? 'processing' : 'default'} 
          text={status?.toUpperCase()}
        />
      ),
    },
    {
      title: 'Applications',
      dataIndex: 'applicationsCount',
      key: 'applicationsCount',
      render: (count) => <Text>{count || 0}</Text>,
    },
    {
      title: 'Success Rate',
      dataIndex: 'successRate',
      key: 'successRate',
      render: (rate) => (
        <Progress 
          percent={rate || 0} 
          size="small" 
          status={rate > 80 ? 'success' : rate > 60 ? 'active' : 'exception'}
        />
      ),
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
          <Tooltip title="Apply Template">
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleApplyTemplateModal(record)}
              disabled={record.status !== 'active'}
            />
          </Tooltip>
          <Tooltip title="Clone Template">
            <Button
              type="default"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCloneTemplate(record.id)}
            />
          </Tooltip>
          <Tooltip title="Edit Template">
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditTemplate(record)}
            />
          </Tooltip>
          <Tooltip title="Delete Template">
            <Popconfirm
              title="Are you sure you want to delete this template?"
              onConfirm={() => handleDeleteTemplate(record.id)}
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
          <FileTextOutlined /> Template Management
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalVisible(true)}
        >
          Create Template
        </Button>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Templates"
              value={stats.totalTemplates}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Active Templates"
              value={stats.activeTemplates}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Applications"
              value={stats.totalApplications}
              prefix={<PlayCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Average Success Rate"
              value={stats.successRate}
              suffix="%"
              prefix={<SettingOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Info Alert */}
      <Alert
        message="Template Management"
        description="Create and manage routine templates that can be applied to different sessions, programs, or semesters to standardize scheduling patterns."
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />

      {/* Templates Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={templates}
          rowKey="id"
          loading={loading}
          pagination={{
            total: templates.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} templates`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Create/Edit Template Modal */}
      <Modal
        title={editingTemplate ? 'Edit Template' : 'Create New Template'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingTemplate(null);
          form.resetFields();
        }}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateTemplate}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Template Name"
                rules={[{ required: true, message: 'Please enter template name' }]}
              >
                <Input placeholder="e.g., BCE Standard Weekly Template" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="type"
                label="Template Type"
                rules={[{ required: true, message: 'Please select template type' }]}
              >
                <Select placeholder="Select template type">
                  <Option value="weekly">Weekly Template</Option>
                  <Option value="semester">Semester Template</Option>
                  <Option value="academic_year">Academic Year Template</Option>
                  <Option value="custom">Custom Template</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="programId"
                label="Target Program"
              >
                <Select placeholder="Select program (optional for general templates)">
                  <Option value="">All Programs</Option>
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
                name="status"
                label="Status"
                initialValue="draft"
              >
                <Select>
                  <Option value="draft">Draft</Option>
                  <Option value="active">Active</Option>
                  <Option value="archived">Archived</Option>
                  <Option value="deprecated">Deprecated</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter template description' }]}
          >
            <TextArea 
              rows={3} 
              placeholder="Describe the template purpose and usage"
            />
          </Form.Item>

          <Form.Item name="configuration" label="Template Configuration">
            <TextArea 
              rows={6} 
              placeholder="JSON configuration for template structure, constraints, and rules"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="version"
                label="Version"
                initialValue="1.0"
              >
                <Input placeholder="e.g., 1.0, 2.1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="tags"
                label="Tags"
              >
                <Select 
                  mode="tags" 
                  placeholder="Add tags for categorization"
                >
                  <Option value="standard">Standard</Option>
                  <Option value="experimental">Experimental</Option>
                  <Option value="optimized">Optimized</Option>
                  <Option value="minimal">Minimal</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                setEditingTemplate(null);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Apply Template Modal */}
      <Modal
        title={`Apply Template: ${selectedTemplate?.name}`}
        open={applyModalVisible}
        onCancel={() => {
          setApplyModalVisible(false);
          setSelectedTemplate(null);
          applyForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Alert
          message="Template Application"
          description="Applying this template will modify the target session's routine according to the template configuration. This action may overwrite existing schedules."
          type="warning"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        <Form
          form={applyForm}
          layout="vertical"
          onFinish={handleApplyTemplate}
        >
          <Form.Item
            name="sessionId"
            label="Target Session"
            rules={[{ required: true, message: 'Please select target session' }]}
          >
            <Select placeholder="Select session to apply template">
              {sessions.map(session => (
                <Option key={session.id} value={session.id}>
                  {session.name} - {session.status}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="programId"
            label="Target Program"
          >
            <Select placeholder="Select specific program (optional)">
              <Option value="">All Programs in Session</Option>
              {programs.map(program => (
                <Option key={program.id} value={program.id}>
                  {program.code} - {program.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="semester"
            label="Target Semester"
          >
            <Select placeholder="Select specific semester (optional)">
              <Option value="">All Semesters</Option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                <Option key={sem} value={sem}>
                  Semester {sem}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="overrideExisting" valuePropName="checked">
            <Switch /> Override existing schedules
          </Form.Item>

          <Form.Item name="backupBeforeApply" valuePropName="checked" initialValue={true}>
            <Switch /> Create backup before applying
          </Form.Item>

          <Form.Item name="notes" label="Application Notes">
            <TextArea 
              rows={2} 
              placeholder="Optional notes about this template application"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Apply Template
              </Button>
              <Button onClick={() => {
                setApplyModalVisible(false);
                setSelectedTemplate(null);
                applyForm.resetFields();
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

export default TemplateManagement;
