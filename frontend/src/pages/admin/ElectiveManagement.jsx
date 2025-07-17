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
  InputNumber,
  message,
  Popconfirm,
  Descriptions,
  Progress
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BranchesOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  BookOutlined,
  TeamOutlined,
  SettingOutlined,
  UserOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { electiveGroupsAPI, programsAPI } from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

const ElectiveManagement = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingElective, setEditingElective] = useState(null);
  const [selectedElective, setSelectedElective] = useState(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch elective groups
  const fetchElectiveGroups = useCallback(async () => {
    const response = await electiveGroupsAPI.getElectiveGroups();
    return response.data;
  }, []);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['elective-groups'],
    queryFn: fetchElectiveGroups,
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });

  const electiveGroups = data?.data || [];

  // Fetch programs for form
  const { data: programsData } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => {
      const response = await programsAPI.getPrograms();
      return response.data;
    }
  });

  const programs = programsData?.data || [];

  // Create elective group mutation
  const createMutation = useMutation({
    mutationFn: (electiveData) => electiveGroupsAPI.createElectiveGroup(electiveData),
    onSuccess: () => {
      message.success('Elective group created successfully');
      queryClient.invalidateQueries(['elective-groups']);
      setIsModalVisible(false);
      form.resetFields();
    },
    onError: (error) => {
      message.error(`Failed to create elective group: ${error.response?.data?.message || error.message}`);
    }
  });

  // Update elective group mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => electiveGroupsAPI.updateElectiveGroup(id, data),
    onSuccess: () => {
      message.success('Elective group updated successfully');
      queryClient.invalidateQueries(['elective-groups']);
      setIsModalVisible(false);
      setEditingElective(null);
      form.resetFields();
    },
    onError: (error) => {
      message.error(`Failed to update elective group: ${error.response?.data?.message || error.message}`);
    }
  });

  // Delete elective group mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => electiveGroupsAPI.deleteElectiveGroup(id),
    onSuccess: () => {
      message.success('Elective group deleted successfully');
      queryClient.invalidateQueries(['elective-groups']);
    },
    onError: (error) => {
      message.error(`Failed to delete elective group: ${error.response?.data?.message || error.message}`);
    }
  });

  const handleCreate = () => {
    setEditingElective(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (elective) => {
    setEditingElective(elective);
    form.setFieldsValue({
      name: elective.name,
      code: elective.code,
      programId: elective.programId,
      semester: elective.semester,
      maxSections: elective.maxSections,
      description: elective.description
    });
    setIsModalVisible(true);
  };

  const handleDelete = (id) => {
    deleteMutation.mutate(id);
  };

  const handleViewDetails = (elective) => {
    setSelectedElective(elective);
    setIsDetailModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingElective) {
        updateMutation.mutate({ 
          id: editingElective._id, 
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
      title: 'Elective Group',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      render: (text, record) => (
        <div>
          <Text strong style={{ fontSize: '14px' }}>{text || 'N/A'}</Text>
          <br />
          <Tag color="purple" style={{ fontSize: '11px' }}>{record.code}</Tag>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.description || 'No description'}
          </Text>
        </div>
      )
    },
    {
      title: 'Program & Semester',
      key: 'program',
      render: (_, record) => (
        <div>
          <Text strong>{record.program?.code || 'N/A'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.program?.name || 'Unknown Program'}
          </Text>
          <br />
          <Tag color="blue">Semester {record.semester}</Tag>
        </div>
      )
    },
    {
      title: 'Available Subjects',
      dataIndex: 'subjects',
      key: 'subjects',
      render: (subjects) => (
        <div>
          <Text strong>{subjects?.length || 0}</Text>
          <Text type="secondary"> subjects</Text>
          <br />
          {subjects && subjects.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              {subjects.slice(0, 2).map((subject, index) => (
                <Tag key={index} size="small" style={{ marginBottom: '2px' }}>
                  {subject.subjectCode}
                </Tag>
              ))}
              {subjects.length > 2 && (
                <Tag size="small">+{subjects.length - 2} more</Tag>
              )}
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Section Capacity',
      key: 'capacity',
      align: 'center',
      render: (_, record) => {
        const totalCapacity = record.maxSections || 0;
        const currentSelections = record.currentSelections || 0;
        const percentage = totalCapacity > 0 ? (currentSelections / totalCapacity) * 100 : 0;
        
        return (
          <div>
            <Progress 
              percent={percentage} 
              size="small" 
              status={percentage === 100 ? 'success' : 'active'}
              format={() => `${currentSelections}/${totalCapacity}`}
            />
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {totalCapacity - currentSelections} sections available
            </Text>
          </div>
        );
      }
    },
    {
      title: 'Status',
      key: 'status',
      align: 'center',
      render: (_, record) => {
        const isActive = record.isActive !== false;
        const isFull = (record.currentSelections || 0) >= (record.maxSections || 0);
        
        return (
          <div>
            <Tag color={isActive ? 'success' : 'error'}>
              {isActive ? 'ACTIVE' : 'INACTIVE'}
            </Tag>
            {isFull && <Tag color="warning">FULL</Tag>}
          </div>
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
            <Button
              type="link"
              icon={<BookOutlined />}
              onClick={() => handleViewDetails(record)}
              size="small"
            >
              Details
            </Button>
          </Space>
          <Popconfirm
            title="Delete Elective Group"
            description="Are you sure you want to delete this elective group?"
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
          message="Error Loading Elective Groups"
          description={`Failed to load elective groups: ${error?.message || 'Unknown error'}`}
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

  const semester7Groups = electiveGroups.filter(e => e.semester === 7);
  const semester8Groups = electiveGroups.filter(e => e.semester === 8);
  const totalSubjects = electiveGroups.reduce((sum, group) => sum + (group.subjects?.length || 0), 0);
  const totalSections = electiveGroups.reduce((sum, group) => sum + (group.currentSelections || 0), 0);

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <Row gutter={[16, 16]}>
        {/* Header */}
        <Col span={24}>
          <Card>
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                  <BranchesOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
                  Elective Management
                </Title>
                <Text type="secondary">Manage 7th and 8th semester elective groups and subject choices</Text>
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
                    Create Elective Group
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
                  title="Total Elective Groups"
                  value={electiveGroups.length}
                  prefix={<BranchesOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="7th Semester Groups"
                  value={semester7Groups.length}
                  prefix={<BookOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="8th Semester Groups"
                  value={semester8Groups.length}
                  prefix={<BookOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Total Elective Subjects"
                  value={totalSubjects}
                  prefix={<BookOutlined />}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Elective Groups Table */}
        <Col span={24}>
          <Card title="Elective Groups" extra={
            <Text type="secondary">{electiveGroups.length} groups</Text>
          }>
            <Spin spinning={isLoading}>
              {electiveGroups.length === 0 && !isLoading ? (
                <Empty 
                  description="No elective groups found"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                    Create First Elective Group
                  </Button>
                </Empty>
              ) : (
                <Table
                  columns={columns}
                  dataSource={electiveGroups}
                  rowKey="_id"
                  pagination={{
                    total: electiveGroups.length,
                    pageSize: 10,
                    showTotal: (total, range) => 
                      `${range[0]}-${range[1]} of ${total} elective groups`,
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
        title={editingElective ? 'Edit Elective Group' : 'Create New Elective Group'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingElective(null);
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
                name="name"
                label="Group Name"
                rules={[
                  { required: true, message: 'Please enter group name' }
                ]}
              >
                <Input placeholder="e.g., Technical Electives A" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="code"
                label="Group Code"
                rules={[
                  { required: true, message: 'Please enter group code' }
                ]}
              >
                <Input placeholder="e.g., 7TH-TECH-A" style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="programId"
                label="Program"
                rules={[
                  { required: true, message: 'Please select program' }
                ]}
              >
                <Select placeholder="Select program">
                  {programs.map(program => (
                    <Option key={program._id} value={program._id}>
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
                rules={[
                  { required: true, message: 'Please select semester' }
                ]}
              >
                <Select placeholder="Select semester">
                  <Option value={7}>7th Semester</Option>
                  <Option value={8}>8th Semester</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="maxSections"
            label="Maximum Sections"
            rules={[
              { required: true, message: 'Please enter maximum sections' }
            ]}
          >
            <InputNumber 
              min={1} 
              max={10} 
              placeholder="How many sections can choose from this group"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea 
              rows={3} 
              placeholder="Description of this elective group"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Details Modal */}
      <Modal
        title="Elective Group Details"
        open={isDetailModalVisible}
        onCancel={() => setIsDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsDetailModalVisible(false)}>
            Close
          </Button>
        ]}
        width={700}
      >
        {selectedElective && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="Group Name">{selectedElective.name}</Descriptions.Item>
              <Descriptions.Item label="Code">{selectedElective.code}</Descriptions.Item>
              <Descriptions.Item label="Program">
                {selectedElective.program?.code} - {selectedElective.program?.name}
              </Descriptions.Item>
              <Descriptions.Item label="Semester">{selectedElective.semester}</Descriptions.Item>
              <Descriptions.Item label="Max Sections">{selectedElective.maxSections}</Descriptions.Item>
              <Descriptions.Item label="Current Selections">{selectedElective.currentSelections || 0}</Descriptions.Item>
              <Descriptions.Item label="Status" span={2}>
                <Tag color={selectedElective.isActive !== false ? 'success' : 'error'}>
                  {selectedElective.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            {selectedElective.description && (
              <>
                <Title level={4} style={{ marginTop: '16px' }}>Description</Title>
                <Text>{selectedElective.description}</Text>
              </>
            )}

            <Title level={4} style={{ marginTop: '16px' }}>Available Subjects</Title>
            {selectedElective.subjects && selectedElective.subjects.length > 0 ? (
              <Table
                dataSource={selectedElective.subjects}
                columns={[
                  {
                    title: 'Subject Code',
                    dataIndex: 'subjectCode',
                    key: 'subjectCode'
                  },
                  {
                    title: 'Subject Name',
                    dataIndex: 'subjectName',
                    key: 'subjectName'
                  },
                  {
                    title: 'Credits',
                    key: 'credits',
                    render: (_, record) => 
                      `${record.credits?.theory || 0}+${record.credits?.practical || 0}+${record.credits?.tutorial || 0}`
                  },
                  {
                    title: 'Status',
                    dataIndex: 'isAvailable',
                    key: 'isAvailable',
                    render: (isAvailable) => (
                      <Tag color={isAvailable !== false ? 'success' : 'error'}>
                        {isAvailable !== false ? 'Available' : 'Unavailable'}
                      </Tag>
                    )
                  }
                ]}
                pagination={false}
                size="small"
              />
            ) : (
              <Text type="secondary">No subjects assigned to this elective group</Text>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ElectiveManagement;
