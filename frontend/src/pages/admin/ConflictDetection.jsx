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
  Descriptions,
  message,
  Timeline,
  Badge,
  Progress,
  Tabs
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  WarningOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  HomeOutlined,
  BookOutlined,
  CalendarOutlined,
  FireOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { conflictsAPI } from '../../services/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const ConflictDetection = () => {
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const queryClient = useQueryClient();

  // Fetch active conflicts
  const fetchActiveConflicts = useCallback(async () => {
    const response = await conflictsAPI.getActiveConflicts();
    return response.data;
  }, []);

  const { data: activeConflictsData, isLoading: loadingActive, isError: errorActive, error: activeError, refetch: refetchActive } = useQuery({
    queryKey: ['active-conflicts'],
    queryFn: fetchActiveConflicts,
    retry: 1,
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Fetch conflict report
  const fetchConflictReport = useCallback(async () => {
    const response = await conflictsAPI.getConflictReport();
    return response.data;
  }, []);

  const { data: reportData, isLoading: loadingReport, isError: errorReport, error: reportError, refetch: refetchReport } = useQuery({
    queryKey: ['conflict-report'],
    queryFn: fetchConflictReport,
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });

  // Detect conflicts mutation
  const detectMutation = useMutation({
    mutationFn: () => conflictsAPI.detectConflicts(),
    onSuccess: () => {
      message.success('Conflict detection completed');
      queryClient.invalidateQueries(['active-conflicts']);
      queryClient.invalidateQueries(['conflict-report']);
    },
    onError: (error) => {
      message.error(`Failed to detect conflicts: ${error.response?.data?.message || error.message}`);
    }
  });

  // Resolve conflict mutation
  const resolveMutation = useMutation({
    mutationFn: (conflictId) => conflictsAPI.markConflictResolved(conflictId),
    onSuccess: () => {
      message.success('Conflict marked as resolved');
      queryClient.invalidateQueries(['active-conflicts']);
      queryClient.invalidateQueries(['conflict-report']);
      setIsDetailModalVisible(false);
    },
    onError: (error) => {
      message.error(`Failed to resolve conflict: ${error.response?.data?.message || error.message}`);
    }
  });

  const activeConflicts = activeConflictsData?.data || [];
  const report = reportData?.data || {};

  const handleViewDetails = (conflict) => {
    setSelectedConflict(conflict);
    setIsDetailModalVisible(true);
  };

  const handleResolveConflict = (conflictId) => {
    resolveMutation.mutate(conflictId);
  };

  const handleDetectConflicts = () => {
    detectMutation.mutate();
  };

  const getConflictSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  const getConflictTypeIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'teacher':
        return <UserOutlined />;
      case 'room':
        return <HomeOutlined />;
      case 'subject':
        return <BookOutlined />;
      case 'time':
        return <ClockCircleOutlined />;
      default:
        return <ExclamationCircleOutlined />;
    }
  };

  const conflictColumns = [
    {
      title: 'Conflict Type',
      dataIndex: 'type',
      key: 'type',
      render: (type, record) => (
        <div>
          <Space>
            {getConflictTypeIcon(type)}
            <Text strong>{type || 'Unknown'}</Text>
          </Space>
          <br />
          <Tag color={getConflictSeverityColor(record.severity)} size="small">
            {record.severity || 'Medium'}
          </Tag>
        </div>
      )
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text, record) => (
        <div>
          <Text>{text || 'No description available'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.details || 'No additional details'}
          </Text>
        </div>
      )
    },
    {
      title: 'Affected Resources',
      key: 'resources',
      render: (_, record) => (
        <div>
          {record.teacherName && (
            <div>
              <UserOutlined style={{ marginRight: '4px' }} />
              <Text style={{ fontSize: '12px' }}>{record.teacherName}</Text>
            </div>
          )}
          {record.roomName && (
            <div>
              <HomeOutlined style={{ marginRight: '4px' }} />
              <Text style={{ fontSize: '12px' }}>{record.roomName}</Text>
            </div>
          )}
          {record.subjectName && (
            <div>
              <BookOutlined style={{ marginRight: '4px' }} />
              <Text style={{ fontSize: '12px' }}>{record.subjectName}</Text>
            </div>
          )}
          {record.timeSlot && (
            <div>
              <ClockCircleOutlined style={{ marginRight: '4px' }} />
              <Text style={{ fontSize: '12px' }}>{record.timeSlot}</Text>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Detected At',
      dataIndex: 'detectedAt',
      key: 'detectedAt',
      render: (date) => (
        <Text style={{ fontSize: '12px' }}>
          {date ? new Date(date).toLocaleString() : 'Unknown'}
        </Text>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: (status) => {
        const colors = {
          active: 'error',
          resolved: 'success',
          pending: 'warning'
        };
        return (
          <Tag color={colors[status] || 'default'}>
            {(status || 'active').toUpperCase()}
          </Tag>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<ExclamationCircleOutlined />}
            onClick={() => handleViewDetails(record)}
            size="small"
          >
            Details
          </Button>
          {record.status !== 'resolved' && (
            <Button
              type="link"
              icon={<CheckCircleOutlined />}
              onClick={() => handleResolveConflict(record._id)}
              size="small"
              loading={resolveMutation.isLoading}
            >
              Resolve
            </Button>
          )}
        </Space>
      )
    }
  ];

  if (errorActive || errorReport) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Error Loading Conflict Data"
          description={`Failed to load conflicts: ${activeError?.message || reportError?.message || 'Unknown error'}`}
          type="error"
          action={
            <Button size="small" onClick={() => { refetchActive(); refetchReport(); }}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const criticalConflicts = activeConflicts.filter(c => c.severity === 'high' || c.severity === 'critical');
  const mediumConflicts = activeConflicts.filter(c => c.severity === 'medium');
  const lowConflicts = activeConflicts.filter(c => c.severity === 'low');

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <Row gutter={[16, 16]}>
        {/* Header */}
        <Col span={24}>
          <Card>
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                  <WarningOutlined style={{ marginRight: '12px', color: '#ff4d4f' }} />
                  Conflict Detection Dashboard
                </Title>
                <Text type="secondary">Real-time monitoring and resolution of scheduling conflicts</Text>
              </Col>
              <Col>
                <Space>
                  <Button 
                    icon={<ReloadOutlined />} 
                    onClick={() => { refetchActive(); refetchReport(); }}
                    loading={loadingActive || loadingReport}
                  >
                    Refresh
                  </Button>
                  <Button 
                    type="primary" 
                    icon={<FireOutlined />}
                    onClick={handleDetectConflicts}
                    loading={detectMutation.isLoading}
                  >
                    Run Detection
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
                  title="Total Active Conflicts"
                  value={activeConflicts.length}
                  prefix={<WarningOutlined />}
                  valueStyle={{ color: activeConflicts.length > 0 ? '#ff4d4f' : '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Critical Conflicts"
                  value={criticalConflicts.length}
                  prefix={<ExclamationCircleOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Resolved Today"
                  value={report.resolvedToday || 0}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="System Health"
                  value={activeConflicts.length === 0 ? "Healthy" : "Issues"}
                  prefix={<SafetyOutlined />}
                  valueStyle={{ color: activeConflicts.length === 0 ? '#52c41a' : '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Conflict Severity Overview */}
        {activeConflicts.length > 0 && (
          <Col span={24}>
            <Card title="Conflict Severity Breakdown">
              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="Critical/High"
                      value={criticalConflicts.length}
                      valueStyle={{ color: '#ff4d4f' }}
                      prefix={<ExclamationCircleOutlined />}
                    />
                    <Progress 
                      percent={activeConflicts.length > 0 ? (criticalConflicts.length / activeConflicts.length) * 100 : 0}
                      status="exception"
                      size="small"
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="Medium"
                      value={mediumConflicts.length}
                      valueStyle={{ color: '#fa8c16' }}
                      prefix={<WarningOutlined />}
                    />
                    <Progress 
                      percent={activeConflicts.length > 0 ? (mediumConflicts.length / activeConflicts.length) * 100 : 0}
                      status="normal"
                      size="small"
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="Low"
                      value={lowConflicts.length}
                      valueStyle={{ color: '#52c41a' }}
                      prefix={<CheckCircleOutlined />}
                    />
                    <Progress 
                      percent={activeConflicts.length > 0 ? (lowConflicts.length / activeConflicts.length) * 100 : 0}
                      status="success"
                      size="small"
                    />
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>
        )}

        {/* Main Content Tabs */}
        <Col span={24}>
          <Card>
            <Tabs defaultActiveKey="active" type="card">
              <TabPane tab={
                <span>
                  <Badge count={activeConflicts.length} offset={[10, 0]}>
                    <WarningOutlined />
                    Active Conflicts
                  </Badge>
                </span>
              } key="active">
                <Spin spinning={loadingActive}>
                  {activeConflicts.length === 0 && !loadingActive ? (
                    <Empty 
                      description="No active conflicts detected"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      style={{ margin: '40px 0' }}
                    >
                      <Text type="secondary">
                        The system is operating without conflicts. Run detection to check for new conflicts.
                      </Text>
                    </Empty>
                  ) : (
                    <Table
                      columns={conflictColumns}
                      dataSource={activeConflicts}
                      rowKey="_id"
                      pagination={{
                        total: activeConflicts.length,
                        pageSize: 10,
                        showTotal: (total, range) => 
                          `${range[0]}-${range[1]} of ${total} conflicts`,
                        showSizeChanger: true,
                        showQuickJumper: true,
                      }}
                      scroll={{ x: 800 }}
                      rowClassName={(record) => {
                        if (record.severity === 'high' || record.severity === 'critical') {
                          return 'conflict-row-critical';
                        }
                        if (record.severity === 'medium') {
                          return 'conflict-row-warning';
                        }
                        return '';
                      }}
                    />
                  )}
                </Spin>
              </TabPane>
              
              <TabPane tab={
                <span>
                  <BarChartOutlined />
                  Report & Analytics
                </span>
              } key="report">
                <Spin spinning={loadingReport}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Card title="Conflict Summary" size="small">
                        <Descriptions column={1} size="small">
                          <Descriptions.Item label="Total Conflicts Detected">
                            {report.totalDetected || 0}
                          </Descriptions.Item>
                          <Descriptions.Item label="Resolved Conflicts">
                            {report.totalResolved || 0}
                          </Descriptions.Item>
                          <Descriptions.Item label="Active Conflicts">
                            {report.totalActive || 0}
                          </Descriptions.Item>
                          <Descriptions.Item label="Resolution Rate">
                            {report.totalDetected > 0 ? 
                              `${Math.round((report.totalResolved / report.totalDetected) * 100)}%` : 
                              '0%'}
                          </Descriptions.Item>
                        </Descriptions>
                      </Card>
                    </Col>
                    <Col span={12}>
                      <Card title="Recent Activity" size="small">
                        {report.recentActivity && report.recentActivity.length > 0 ? (
                          <Timeline size="small">
                            {report.recentActivity.slice(0, 5).map((activity, index) => (
                              <Timeline.Item 
                                key={`activity-${index}-${activity.timestamp || Date.now()}`}
                                color={activity.type === 'resolved' ? 'green' : 'red'}
                              >
                                <Text style={{ fontSize: '12px' }}>
                                  {activity.description}
                                </Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: '11px' }}>
                                  {new Date(activity.timestamp).toLocaleString()}
                                </Text>
                              </Timeline.Item>
                            ))}
                          </Timeline>
                        ) : (
                          <Text type="secondary">No recent activity</Text>
                        )}
                      </Card>
                    </Col>
                  </Row>
                </Spin>
              </TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>

      {/* Conflict Details Modal */}
      <Modal
        title="Conflict Details"
        open={isDetailModalVisible}
        onCancel={() => setIsDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsDetailModalVisible(false)}>
            Close
          </Button>,
          selectedConflict?.status !== 'resolved' && (
            <Button 
              key="resolve" 
              type="primary" 
              onClick={() => handleResolveConflict(selectedConflict._id)}
              loading={resolveMutation.isLoading}
            >
              Mark as Resolved
            </Button>
          )
        ].filter(Boolean)}
        width={600}
      >
        {selectedConflict && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Conflict Type">
                <Space>
                  {getConflictTypeIcon(selectedConflict.type)}
                  {selectedConflict.type}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Severity">
                <Tag color={getConflictSeverityColor(selectedConflict.severity)}>
                  {selectedConflict.severity}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={selectedConflict.status === 'resolved' ? 'success' : 'error'}>
                  {selectedConflict.status?.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Detected At">
                {selectedConflict.detectedAt ? 
                  new Date(selectedConflict.detectedAt).toLocaleString() : 
                  'Unknown'}
              </Descriptions.Item>
              <Descriptions.Item label="Description" span={2}>
                {selectedConflict.description}
              </Descriptions.Item>
            </Descriptions>

            {selectedConflict.details && (
              <>
                <Title level={4} style={{ marginTop: '16px' }}>Additional Details</Title>
                <Text>{selectedConflict.details}</Text>
              </>
            )}

            <Title level={4} style={{ marginTop: '16px' }}>Affected Resources</Title>
            <div>
              {selectedConflict.teacherName && (
                <div style={{ marginBottom: '8px' }}>
                  <UserOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                  <Text strong>Teacher: </Text>
                  <Text>{selectedConflict.teacherName}</Text>
                </div>
              )}
              {selectedConflict.roomName && (
                <div style={{ marginBottom: '8px' }}>
                  <HomeOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
                  <Text strong>Room: </Text>
                  <Text>{selectedConflict.roomName}</Text>
                </div>
              )}
              {selectedConflict.subjectName && (
                <div style={{ marginBottom: '8px' }}>
                  <BookOutlined style={{ marginRight: '8px', color: '#722ed1' }} />
                  <Text strong>Subject: </Text>
                  <Text>{selectedConflict.subjectName}</Text>
                </div>
              )}
              {selectedConflict.timeSlot && (
                <div style={{ marginBottom: '8px' }}>
                  <ClockCircleOutlined style={{ marginRight: '8px', color: '#fa8c16' }} />
                  <Text strong>Time Slot: </Text>
                  <Text>{selectedConflict.timeSlot}</Text>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <style jsx>{`
        .conflict-row-critical {
          background-color: #fff2f0;
          border-left: 4px solid #ff4d4f;
        }
        .conflict-row-warning {
          background-color: #fffbf0;
          border-left: 4px solid #fa8c16;
        }
      `}</style>
    </div>
  );
};

export default ConflictDetection;
