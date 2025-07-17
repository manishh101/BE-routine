import React, { useCallback } from 'react';
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
  Spin
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import {
  BookOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { programsAPI } from '../../services/api';

const { Title, Text } = Typography;

const Programs = () => {
  const fetchPrograms = useCallback(async () => {
    return await programsAPI.getPrograms();
  }, []);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['programs'],
    queryFn: fetchPrograms,
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });

  const programs = data?.data || [];

  const columns = [
    {
      title: 'Program Name',
      dataIndex: 'programName',
      key: 'name',
      sorter: (a, b) => (a.programName || a.name || '').localeCompare(b.programName || b.name || ''),
      render: (text, record) => (
        <div>
          <Text strong>{text || record.name || 'N/A'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.description || 'No description'}
          </Text>
        </div>
      )
    },
    {
      title: 'Program Code',
      dataIndex: 'programCode',
      key: 'code',
      align: 'center',
      render: (text) => text ? <Tag color="blue">{text}</Tag> : <Text type="secondary">N/A</Text>
    },
    {
      title: 'Semesters',
      dataIndex: 'semesters',
      key: 'semesters',
      align: 'center',
      render: (text) => text || <Text type="secondary">N/A</Text>
    },
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      align: 'center',
      filters: [
        { text: 'Undergraduate', value: 'undergraduate' },
        { text: 'Graduate', value: 'graduate' },
        { text: 'Diploma', value: 'diploma' },
      ],
      onFilter: (value, record) => record.level === value,
      render: (text) => {
        let color = 'default';
        if (text === 'undergraduate') color = 'success';
        else if (text === 'graduate') color = 'processing';
        else if (text === 'diploma') color = 'warning';
        return text ? <Tag color={color}>{text.toUpperCase()}</Tag> : <Text type="secondary">N/A</Text>;
      }
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
          {isActive !== false ? 'Active' : 'Inactive'}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button 
            type="primary" 
            ghost
            size="small" 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Button 
            type="primary" 
            danger 
            ghost
            size="small" 
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            Delete
          </Button>
        </Space>
      )
    }
  ];

  const handleEdit = (program) => {
    console.log('Edit program:', program);
    // TODO: Implement edit functionality
  };

  const handleDelete = (program) => {
    console.log('Delete program:', program);
    // TODO: Implement delete functionality
  };

  const handleAddNew = () => {
    console.log('Add new program');
    // TODO: Implement add functionality
  };

  if (isError) {
    return (
      <Card style={{ textAlign: 'center', padding: '40px', borderRadius: '8px' }}>
        <Title level={4} type="danger">Error Loading Programs</Title>
        <Text type="secondary">{error?.message || 'An unknown error occurred.'}</Text>
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
            <BookOutlined style={{ fontSize: '32px', color: '#52c41a' }} />
            <div className="mobile-center">
              <Title level={2} style={{ margin: 0 }}>
                Programs
              </Title>
              <Text type="secondary" style={{ fontSize: '15px' }}>
                Manage academic programs and curricula.
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
              Add New Program
            </Button>
          </div>
        </Col>
      </Row>

      {/* Statistics Cards */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} md={8}>
          <Card variant="borderless" style={{ textAlign: 'center', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Text type="secondary" style={{ fontSize: '16px' }}>Total Programs</Text>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#52c41a', margin: '8px 0' }}>
              {isLoading ? <Spin size="small" /> : programs.length}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card variant="borderless" style={{ textAlign: 'center', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Text type="secondary" style={{ fontSize: '16px' }}>Active Programs</Text>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#1677ff', margin: '8px 0' }}>
              {isLoading ? <Spin size="small" /> : programs.filter(p => p.isActive !== false).length}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card variant="borderless" style={{ textAlign: 'center', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Text type="secondary" style={{ fontSize: '16px' }}>Program Levels</Text>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#722ed1', margin: '8px 0' }}>
              {isLoading ? <Spin size="small" /> : (new Set(programs.map(p => p.level).filter(Boolean)).size || (programs.length > 0 ? 1 : 0))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Programs Table */}
      <Card style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={programs}
          loading={isLoading}
          rowKey={(record) => record._id || record.id || Math.random().toString()}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} of ${total} programs`,
            style: { padding: '16px' }
          }}
          scroll={{ x: true }}
          locale={{
            emptyText: (
              <Empty
                image={<BookOutlined style={{ fontSize: '48px', color: '#ccc' }} />}
                imageStyle={{ height: 60 }}
                description={
                  <span>
                    No programs found.
                    <br />
                    How about adding the first one?
                  </span>
                }
              >
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={handleAddNew}
                  style={{ marginTop: 16 }}
                >
                  Add First Program
                </Button>
              </Empty>
            )
          }}
          style={{ borderRadius: '8px', overflow: 'hidden' }}
        />
      </Card>
    </Space>
  );
};

export default Programs;