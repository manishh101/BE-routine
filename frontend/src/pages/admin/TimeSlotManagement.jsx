import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  TimePicker,
  Switch,
  message,
  Popconfirm,
  Tag,
  Typography,
  Row,
  Col,
  Alert
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeSlotsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const TimeSlotManagement = () => {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTimeSlot, setEditingTimeSlot] = useState(null);
  
  const queryClient = useQueryClient();

  // Fetch time slots
  const { 
    data: timeSlotsData, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['timeSlots'],
    queryFn: () => timeSlotsAPI.getTimeSlots()
  });

  // Create time slot mutation
  const createMutation = useMutation({
    mutationFn: (timeSlotData) => timeSlotsAPI.createTimeSlot(timeSlotData),
    onSuccess: () => {
      message.success('Time slot created successfully');
      queryClient.invalidateQueries(['timeSlots']);
      setModalVisible(false);
      form.resetFields();
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to create time slot');
    }
  });

  // Update time slot mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => timeSlotsAPI.updateTimeSlot(id, data),
    onSuccess: () => {
      message.success('Time slot updated successfully');
      queryClient.invalidateQueries(['timeSlots']);
      setModalVisible(false);
      setEditingTimeSlot(null);
      form.resetFields();
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to update time slot');
    }
  });

  // Delete time slot mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => timeSlotsAPI.deleteTimeSlot(id),
    onSuccess: () => {
      message.success('Time slot deleted successfully');
      queryClient.invalidateQueries(['timeSlots']);
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to delete time slot');
    }
  });

  // Initialize default time slots mutation
  const initializeMutation = useMutation({
    mutationFn: () => timeSlotsAPI.initializeTimeSlots(),
    onSuccess: () => {
      message.success('Default time slots initialized successfully');
      queryClient.invalidateQueries(['timeSlots']);
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to initialize time slots');
    }
  });

  const timeSlots = timeSlotsData?.data?.data || [];

  const handleAdd = () => {
    setEditingTimeSlot(null);
    setModalVisible(true);
    form.resetFields();
  };

  const handleEdit = (timeSlot) => {
    setEditingTimeSlot(timeSlot);
    setModalVisible(true);
    form.setFieldsValue({
      ...timeSlot,
      startTime: dayjs(timeSlot.startTime, 'HH:mm'),
      endTime: dayjs(timeSlot.endTime, 'HH:mm')
    });
  };

  const handleDelete = (id) => {
    deleteMutation.mutate(id);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      const timeSlotData = {
        ...values,
        startTime: values.startTime.format('HH:mm'),
        endTime: values.endTime.format('HH:mm')
      };
      
      if (editingTimeSlot) {
        updateMutation.mutate({ id: editingTimeSlot._id, data: timeSlotData });
      } else {
        createMutation.mutate(timeSlotData);
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleCancel = () => {
    setModalVisible(false);
    setEditingTimeSlot(null);
    form.resetFields();
  };

  const handleInitialize = () => {
    initializeMutation.mutate();
  };

  const columns = [
    {
      title: 'Index',
      dataIndex: '_id',
      key: 'index',
      width: 80,
      align: 'center',
      render: (_, __, index) => (
        <Tag color="blue">{index}</Tag>
      )
    },
    {
      title: 'Label',
      dataIndex: 'label',
      key: 'label',
      width: 150
    },
    {
      title: 'Start Time',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 120,
      align: 'center',
      render: (time) => (
        <Tag color="green">{time}</Tag>
      )
    },
    {
      title: 'End Time',
      dataIndex: 'endTime',
      key: 'endTime',
      width: 120,
      align: 'center',
      render: (time) => (
        <Tag color="orange">{time}</Tag>
      )
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const start = dayjs(record.startTime, 'HH:mm');
        const end = dayjs(record.endTime, 'HH:mm');
        const duration = end.diff(start, 'minute');
        return `${duration} min`;
      }
    },
    {
      title: 'Type',
      dataIndex: 'isBreak',
      key: 'isBreak',
      width: 100,
      align: 'center',
      render: (isBreak) => (
        <Tag color={isBreak ? 'red' : 'blue'}>
          {isBreak ? 'Break' : 'Class'}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Delete Time Slot"
            description="Are you sure you want to delete this time slot?"
            onConfirm={() => handleDelete(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="text"
              icon={<DeleteOutlined />}
              danger
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Header */}
      <Row justify="space-between" align="middle" className="admin-page-header mobile-stack">
        <Col xs={24} lg={16}>
          <Space align="center" className="mobile-stack-vertical">
            <ClockCircleOutlined style={{ fontSize: '32px', color: '#1677ff' }} />
            <div className="mobile-center">
              <Title level={2} style={{ margin: 0 }}>
                Time Slot Management
              </Title>
              <Text type="secondary">
                Configure daily time slots for class scheduling
              </Text>
            </div>
          </Space>
        </Col>
        <Col xs={24} lg={8}>
          <div className="admin-actions" style={{ textAlign: 'right' }}>
            <Space className="mobile-full-width">
              <Button
                icon={<SettingOutlined />}
                onClick={handleInitialize}
                loading={initializeMutation.isLoading}
              >
                Initialize Default
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                Add Time Slot
              </Button>
            </Space>
          </div>
        </Col>
      </Row>

      {/* Information Alert */}
      <Alert
        message="Time Slot Configuration"
        description="Time slots define the daily schedule structure. Each slot can be either a class period or a break. The order in the table determines the sequence during the day."
        type="info"
        showIcon
      />

      {/* Time Slots Table */}
      <Card title={`Time Slots (${timeSlots.length})`}>
        <Table
          columns={columns}
          dataSource={timeSlots}
          rowKey="_id"
          loading={isLoading}
          pagination={false}
          size="middle"
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={
          <Space>
            <ClockCircleOutlined />
            <span>{editingTimeSlot ? 'Edit Time Slot' : 'Add New Time Slot'}</span>
          </Space>
        }
        open={modalVisible}
        onOk={handleSave}
        onCancel={handleCancel}
        confirmLoading={createMutation.isLoading || updateMutation.isLoading}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            isBreak: false
          }}
        >
          <Form.Item
            name="label"
            label="Label"
            rules={[
              { required: true, message: 'Please enter a label' },
              { max: 50, message: 'Label must be 50 characters or less' }
            ]}
          >
            <Input placeholder="e.g., Period 1, Morning Break" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="startTime"
                label="Start Time"
                rules={[{ required: true, message: 'Please select start time' }]}
              >
                <TimePicker
                  format="HH:mm"
                  style={{ width: '100%' }}
                  placeholder="Select start time"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="endTime"
                label="End Time"
                rules={[{ required: true, message: 'Please select end time' }]}
              >
                <TimePicker
                  format="HH:mm"
                  style={{ width: '100%' }}
                  placeholder="Select end time"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="isBreak"
            label="Time Slot Type"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Break"
              unCheckedChildren="Class"
            />
          </Form.Item>

          <Alert
            message="Note"
            description="Ensure that time slots don't overlap and are in chronological order for proper scheduling."
            type="warning"
            showIcon
            style={{ marginTop: '16px' }}
          />
        </Form>
      </Modal>
    </Space>
  );
};

export default TimeSlotManagement;
