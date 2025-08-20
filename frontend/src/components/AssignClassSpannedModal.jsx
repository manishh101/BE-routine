import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  Button,
  Space,
  Typography,
  Alert,
  Row,
  Col,
  Tag,
  Card,
  Spin,
  InputNumber,
  Slider,
  message,
  App,
  Checkbox
} from 'antd';
import {
  BookOutlined,
  UserOutlined,
  HomeOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ColumnWidthOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { 
  programSemestersAPI, 
  teachersAPI, 
  roomsAPI, 
  routinesAPI,
  timeSlotsAPI
} from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const AssignClassSpannedModal = ({
  visible,
  onCancel,
  onSave,
  onSaveSpanned,
  programCode,
  semester,
  section,
  dayIndex,
  slotIndex,
  timeSlots,
  existingClass,
  loading
}) => {
  const [form] = Form.useForm();
  const [conflicts, setConflicts] = useState([]);
  const [checking, setChecking] = useState(false);
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [duration, setDuration] = useState(1);
  const [spannedSlots, setSpannedSlots] = useState([]);
  const [spannedConflicts, setSpannedConflicts] = useState([]);

  // Use App.useApp for proper context support in modals
  const { modal } = App.useApp();

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const selectedTimeSlot = timeSlots.find(slot => slot._id === slotIndex);

  // Fetch subjects for this program-semester
  const { 
    data: subjectsData, 
    isLoading: subjectsLoading 
  } = useQuery({
    queryKey: ['programSemesterSubjects', programCode, semester],
    queryFn: () => programSemestersAPI.getSubjectsForSemester(programCode, semester),
    enabled: !!(programCode && semester && visible),
  });

  // Fetch all teachers
  const { 
    data: teachersData, 
    isLoading: teachersLoading 
  } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => teachersAPI.getTeachers(),
    enabled: visible,
  });

  // Fetch all rooms
  const { 
    data: roomsData, 
    isLoading: roomsLoading 
  } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomsAPI.getRooms(),
    enabled: visible,
  });

  const subjects = subjectsData?.data || [];
  const teachers = teachersData?.data || [];
  const rooms = roomsData?.data?.data || [];

  // Set form values when editing existing class
  useEffect(() => {
    if (existingClass && visible) {
      // Convert lab group data to form fields
      let labGroupType = 'groupA'; // default
      let isAlternativeWeek = false;
      
      if (existingClass.isAlternativeWeek) {
        isAlternativeWeek = true;
      }
      
      if (existingClass.labGroup === 'bothGroups') {
        labGroupType = 'bothGroups';
      } else if (existingClass.labGroup === 'B') {
        labGroupType = 'groupB';
      } else {
        labGroupType = 'groupA';
      }
      
      form.setFieldsValue({
        subjectId: existingClass.subjectId,
        teacherIds: existingClass.teacherIds || [],
        roomId: existingClass.roomId,
        classType: existingClass.classType,
        notes: existingClass.notes || '',
        labGroupType: existingClass.classType === 'P' ? labGroupType : undefined,
        isAlternativeWeek: existingClass.classType === 'P' ? isAlternativeWeek : false
      });

      // If this is a span master class, set the duration accordingly
      if (existingClass.spanMaster && existingClass.spanLength) {
        setDuration(existingClass.spanLength);
      } else {
        setDuration(1);
      }
    } else if (visible) {
      form.resetFields();
      setDuration(1);
    }
  }, [existingClass, visible, form]);

  // Update spanned slots when duration changes
  useEffect(() => {
    if (!timeSlots || !slotIndex) return;
    
    const sortedTimeSlots = [...timeSlots].sort((a, b) => a.sortOrder - b.sortOrder);
    const currentSlotIndex = sortedTimeSlots.findIndex(slot => slot._id === slotIndex);
    
    if (currentSlotIndex === -1) return;
    
    const slots = [];
    for (let i = 0; i < duration; i++) {
      const targetIndex = currentSlotIndex + i;
      
      // Don't go beyond available time slots or include break slots
      if (targetIndex >= sortedTimeSlots.length || sortedTimeSlots[targetIndex].isBreak) {
        break;
      }
      
      slots.push(sortedTimeSlots[targetIndex]._id);
    }
    
    setSpannedSlots(slots);
  }, [duration, slotIndex, timeSlots]);

  // Check for conflicts when form values change
  const checkConflicts = async (values) => {
    if (!values.teacherIds?.length && !values.roomId) return;

    setChecking(true);
    try {
      const conflictChecks = [];

      // Check teacher availability
      if (values.teacherIds?.length > 0) {
        for (const teacherId of values.teacherIds) {
          conflictChecks.push(
            schedulesAPI.checkTeacherAvailability(teacherId, dayIndex, slotIndex, semester)
              .then(response => ({
                type: 'teacher',
                id: teacherId,
                name: teachers.find(t => t._id === teacherId)?.fullName || 'Unknown Teacher',
                available: response.data.available,
                conflictDetails: response.data.conflictDetails
              }))
              .catch(() => ({
                type: 'teacher',
                id: teacherId,
                name: teachers.find(t => t._id === teacherId)?.fullName || 'Unknown Teacher',
                available: true
              }))
          );
        }
      }

      // Check room availability
      if (values.roomId) {
        conflictChecks.push(
          routinesAPI.checkRoomAvailability(values.roomId, dayIndex, slotIndex, semester)
            .then(response => ({
              type: 'room',
              id: values.roomId,
              name: rooms.find(r => r._id === values.roomId)?.name || 'Unknown Room',
              available: response.data.available,
              conflictDetails: response.data.conflictDetails
            }))
            .catch(() => ({
              type: 'room',
              id: values.roomId,
              name: rooms.find(r => r._id === values.roomId)?.name || 'Unknown Room',
              available: true
            }))
        );
      }

      const results = await Promise.all(conflictChecks);
      const newConflicts = results.filter(result => !result.available);
      setConflicts(newConflicts);

      // Update available teachers and rooms for smart filtering
      const unavailableTeacherIds = results
        .filter(r => r.type === 'teacher' && !r.available)
        .map(r => r.id);
      
      setAvailableTeachers(teachers.map(teacher => ({
        ...teacher,
        isAvailable: !unavailableTeacherIds.includes(teacher._id)
      })));

      const unavailableRoomIds = results
        .filter(r => r.type === 'room' && !r.available)
        .map(r => r.id);
      
      setAvailableRooms(rooms.map(room => ({
        ...room,
        isAvailable: !unavailableRoomIds.includes(room._id)
      })));

      // If duration > 1, check for conflicts in all spanned slots
      if (duration > 1 && spannedSlots.length > 1) {
        const spannedConflictChecks = [];
        
        // Check all slots except the first one (which was already checked above)
        for (let i = 1; i < spannedSlots.length; i++) {
          const currentSlotId = spannedSlots[i];
          
          // Check teacher conflicts for each spanned slot
          if (values.teacherIds?.length > 0) {
            for (const teacherId of values.teacherIds) {
              spannedConflictChecks.push(
                schedulesAPI.checkTeacherAvailability(teacherId, dayIndex, currentSlotId, semester)
                  .then(response => ({
                    type: 'teacher',
                    id: teacherId,
                    slotIndex: i,
                    name: teachers.find(t => t._id === teacherId)?.fullName || 'Unknown Teacher',
                    available: response.data.available,
                    conflictDetails: response.data.conflictDetails
                  }))
                  .catch(() => ({
                    type: 'teacher',
                    id: teacherId,
                    slotIndex: i,
                    name: teachers.find(t => t._id === teacherId)?.fullName || 'Unknown Teacher',
                    available: true
                  }))
              );
            }
          }

          // Check room conflicts for each spanned slot
          if (values.roomId) {
            spannedConflictChecks.push(
              routinesAPI.checkRoomAvailability(values.roomId, dayIndex, currentSlotId, semester)
                .then(response => ({
                  type: 'room',
                  id: values.roomId,
                  slotIndex: i,
                  name: rooms.find(r => r._id === values.roomId)?.name || 'Unknown Room',
                  available: response.data.available,
                  conflictDetails: response.data.conflictDetails
                }))
                .catch(() => ({
                  type: 'room',
                  id: values.roomId,
                  slotIndex: i,
                  name: rooms.find(r => r._id === values.roomId)?.name || 'Unknown Room',
                  available: true
                }))
            );
          }
        }
        
        const spannedResults = await Promise.all(spannedConflictChecks);
        const newSpannedConflicts = spannedResults.filter(result => !result.available);
        setSpannedConflicts(newSpannedConflicts);
      } else {
        setSpannedConflicts([]);
      }

    } catch (error) {
      console.error('Error checking conflicts:', error);
    }
    setChecking(false);
  };

  const handleFormChange = (changedValues, allValues) => {
    // Check if duration has changed
    if ('duration' in changedValues) {
      const newDuration = changedValues.duration;
      setDuration(newDuration);
    }

    // Debounce conflict checking
    const timeoutId = setTimeout(() => checkConflicts(allValues), 500);
    return () => clearTimeout(timeoutId);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // Process lab group types for practical classes
      if (values.classType === 'P' && values.labGroupType) {
        switch (values.labGroupType) {
          case 'groupA':
            values.labGroup = 'A';
            break;
          case 'groupB':
            values.labGroup = 'B';
            break;
          case 'bothGroups':
            values.labGroup = 'bothGroups';
            break;
          default:
            values.labGroup = 'A'; // fallback
        }
        
        // Add alternative week flag
        values.isAlternativeWeek = values.isAlternativeWeek || false;
        
        // Remove the temporary field
        delete values.labGroupType;
      }
      
      // Check if we have any conflicts
      const hasConflicts = conflicts.length > 0 || spannedConflicts.length > 0;
      
      // If single period class (duration = 1)
      if (duration === 1) {
        if (hasConflicts) {
          modal.confirm({
            title: 'Conflicts Detected',
            content: 'There are scheduling conflicts. Do you want to proceed anyway?',
            okText: 'Proceed',
            cancelText: 'Cancel',
            onOk: () => onSave(values)
          });
        } else {
          onSave(values);
        }
      } 
      // If multi-period class (duration > 1)
      else {
        if (hasConflicts) {
          modal.confirm({
            title: 'Multi-Period Conflicts Detected',
            content: `There are scheduling conflicts in ${spannedConflicts.length + conflicts.length} periods. Do you want to proceed anyway?`,
            okText: 'Proceed',
            cancelText: 'Cancel',
            onOk: () => onSaveSpanned(values, spannedSlots)
          });
        } else {
          onSaveSpanned(values, spannedSlots);
        }
      }
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  const renderConflictAlert = () => {
    if (conflicts.length === 0 && spannedConflicts.length === 0) return null;
    
    const allConflicts = [...conflicts, ...spannedConflicts];

    return (
      <Alert
        message={`Scheduling Conflicts Detected (${allConflicts.length})`}
        description={
          <div>
            {allConflicts.map((conflict, index) => {
              // Find the time slot label for spanned conflicts
              let periodLabel = "Period 1";
              if (conflict.slotIndex !== undefined && conflict.slotIndex > 0) {
                const slotId = spannedSlots[conflict.slotIndex];
                const slot = timeSlots.find(s => s._id === slotId);
                periodLabel = `Period ${conflict.slotIndex + 1} (${slot?.label || ''})`;
              }
              
              return (
                <div key={index} style={{ marginBottom: '4px' }}>
                  {conflict.slotIndex !== undefined && (
                    <Tag color="purple">{periodLabel}</Tag>
                  )}
                  <Tag color="red">{conflict.type}</Tag>
                  <strong>{conflict.name}</strong> is already assigned to:
                  {conflict.conflictDetails && (
                    <div style={{ marginLeft: '8px', fontSize: '12px' }}>
                      {conflict.conflictDetails.programCode} - Sem {conflict.conflictDetails.semester} - Sec {conflict.conflictDetails.section}
                      {conflict.conflictDetails.subjectName && ` (${conflict.conflictDetails.subjectName})`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        }
        type="warning"
        showIcon
        style={{ marginBottom: '16px' }}
      />
    );
  };

  // Get all time slot labels for preview
  const spannedTimeSlotLabels = spannedSlots.map(slotId => {
    const slot = timeSlots.find(s => s._id === slotId);
    return slot?.label || '';
  });

  return (
    <Modal
      title={
        <Space>
          <ClockCircleOutlined />
          <span>
            {existingClass ? 'Edit' : 'Assign'} Class - {dayNames[dayIndex]} {selectedTimeSlot?.label}
          </span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button 
          key="save" 
          type="primary" 
          loading={loading || checking}
          onClick={handleSubmit}
          icon={conflicts.length > 0 || spannedConflicts.length > 0 ? <WarningOutlined /> : <CheckCircleOutlined />}
        >
          {conflicts.length > 0 || spannedConflicts.length > 0 ? 'Save with Conflicts' : 'Save'}
        </Button>
      ]}
      width={800}
      destroyOnHidden
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Time Slot Info */}
        <Card size="small" style={{ backgroundColor: '#f6ffed' }}>
          <Row gutter={16}>
            <Col span={8}>
              <Text strong>Program:</Text> {programCode}
            </Col>
            <Col span={8}>
              <Text strong>Semester:</Text> {semester}
            </Col>
            <Col span={8}>
              <Text strong>Section:</Text> {section}
            </Col>
          </Row>
          <Row gutter={16} style={{ marginTop: '8px' }}>
            <Col span={12}>
              <Text strong>Day:</Text> {dayNames[dayIndex]}
            </Col>
            <Col span={12}>
              <Text strong>Time:</Text> {selectedTimeSlot?.startTime} - {selectedTimeSlot?.endTime}
            </Col>
          </Row>
        </Card>

        {/* Duration Selector */}
        <Form.Item 
          label={<Space><ColumnWidthOutlined />Duration (periods)</Space>} 
          name="duration"
          initialValue={duration}
          tooltip="Select how many consecutive periods this class will span"
        >
          <Row gutter={16} align="middle">
            <Col span={16}>
              <Slider
                min={1}
                max={Math.min(5, timeSlots.filter(ts => !ts.isBreak).length)}
                value={duration}
                onChange={value => {
                  setDuration(value);
                  form.setFieldsValue({ duration: value });
                  handleFormChange({ duration: value }, form.getFieldsValue());
                }}
                marks={{
                  1: '1',
                  2: '2',
                  3: '3',
                  4: '4',
                  5: '5'
                }}
              />
            </Col>
            <Col span={8}>
              <InputNumber
                min={1}
                max={Math.min(5, timeSlots.filter(ts => !ts.isBreak).length)}
                value={duration}
                onChange={value => {
                  if (value !== null) {
                    setDuration(value);
                    form.setFieldsValue({ duration: value });
                    handleFormChange({ duration: value }, form.getFieldsValue());
                  }
                }}
                style={{ width: '100%' }}
              />
            </Col>
          </Row>
        </Form.Item>
        
        {/* Spanned Slots Preview */}
        {duration > 1 && (
          <Card size="small" style={{ backgroundColor: '#e6f7ff', marginBottom: '16px' }}>
            <div>
              <Text strong>Multi-Period Class:</Text> This class will span {duration} periods
            </div>
            <div style={{ marginTop: '8px' }}>
              <Text strong>Periods:</Text>
            </div>
            <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {spannedTimeSlotLabels.map((label, index) => (
                <Tag color="blue" key={index}>
                  Period {index + 1}: {label}
                </Tag>
              ))}
            </div>
          </Card>
        )}

        {/* Conflict Alert */}
        {renderConflictAlert()}

        {/* Form */}
        <Form
          form={form}
          layout="vertical"
          onValuesChange={handleFormChange}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="subjectId"
                label={<Space><BookOutlined />Subject</Space>}
                rules={[{ required: true, message: 'Please select a subject' }]}
              >
                <Select
                  placeholder="Select subject"
                  loading={subjectsLoading}
                  showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {subjects.map(subject => (
                    <Option key={subject.subjectId} value={subject.subjectId}>
                      {subject.subjectName_display || subject.subjectCode_display}
                      <br />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {subject.courseType} - {subject.defaultHoursTheory}h Theory, {subject.defaultHoursPractical}h Practical
                      </Text>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="classType"
                label="Class Type"
                rules={[{ required: true, message: 'Please select class type' }]}
              >
                <Select placeholder="Select class type">
                  <Option value="L">
                    <Tag color="blue">Lecture</Tag>
                  </Option>
                  <Option value="P">
                    <Tag color="green">Practical</Tag>
                  </Option>
                  <Option value="T">
                    <Tag color="orange">Tutorial</Tag>
                  </Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* Lab Group Selection for Practical Classes */}
          <Form.Item shouldUpdate>
            {({ getFieldValue }) => {
              const classType = getFieldValue('classType');
              if (classType === 'P') {
                return (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="labGroupType"
                        label={<Space><TeamOutlined />Lab Group Type</Space>}
                        rules={[{ required: true, message: 'Please select lab group type' }]}
                      >
                        <Select placeholder="Select lab group type">
                          <Option value="groupA">
                            <Tag color="blue">Group A Only</Tag>
                          </Option>
                          <Option value="groupB">
                            <Tag color="green">Group B Only</Tag>
                          </Option>
                          <Option value="bothGroups">
                            <Tag color="purple">Both Groups (Same Time)</Tag>
                          </Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="isAlternativeWeek" valuePropName="checked">
                        <Checkbox>
                          <Text strong>Alternative Week</Text>
                        </Checkbox>
                      </Form.Item>
                    </Col>
                  </Row>
                );
              }
              return null;
            }}
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="teacherIds"
                label={<Space><UserOutlined />Teacher(s)</Space>}
                rules={[{ required: true, message: 'Please select at least one teacher' }]}
              >
                <Select
                  mode="multiple"
                  placeholder="Select teacher(s)"
                  loading={teachersLoading}
                  showSearch
                  filterOption={(input, option) =>
                    option.children?.toString().toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {(availableTeachers.length > 0 ? availableTeachers : teachers).map(teacher => (
                    <Option 
                      key={teacher._id} 
                      value={teacher._id}
                      disabled={availableTeachers.length > 0 && !teacher.isAvailable}
                    >
                      <Space>
                        {teacher.fullName} ({teacher.shortName})
                        {availableTeachers.length > 0 && !teacher.isAvailable && (
                          <Tag color="red" size="small">Busy</Tag>
                        )}
                        {availableTeachers.length > 0 && teacher.isAvailable && (
                          <Tag color="green" size="small">Available</Tag>
                        )}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="roomId"
                label={<Space><HomeOutlined />Room</Space>}
                rules={[{ required: true, message: 'Please select a room' }]}
              >
                <Select
                  placeholder="Select room"
                  loading={roomsLoading}
                  showSearch
                  filterOption={(input, option) =>
                    option.children?.toString().toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {(availableRooms.length > 0 ? availableRooms : rooms).map(room => (
                    <Option 
                      key={room._id} 
                      value={room._id}
                      disabled={availableRooms.length > 0 && !room.isAvailable}
                    >
                      <Space>
                        {room.name} ({room.capacity} seats)
                        {availableRooms.length > 0 && !room.isAvailable && (
                          <Tag color="red" size="small">Occupied</Tag>
                        )}
                        {availableRooms.length > 0 && room.isAvailable && (
                          <Tag color="green" size="small">Available</Tag>
                        )}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="notes"
            label="Notes (Optional)"
          >
            <TextArea 
              placeholder="Add any notes or instructions for this class"
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </Form.Item>
        </Form>
      </Space>
    </Modal>
  );
};

export default AssignClassSpannedModal;
