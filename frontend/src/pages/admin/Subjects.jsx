import React, { useState, useMemo, useCallback } from 'react';
import { subjectsAPI } from '../../services/subjectsAPI';
import { useFilters, useFilteredData } from '../../hooks/useFilters';
import {
  Card, 
  Table, 
  Typography, 
  Button, 
  Space,
  Tag,
  Row,
  Col,
  Alert,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Popconfirm,
  Spin
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  FilterOutlined
} from '@ant-design/icons';
import { programsAPI } from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const Subjects = () => {
  const [form] = Form.useForm();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const queryClient = useQueryClient();

  // Initialize filters
  const {
    filters,
    searchText,
    updateFilter,
    handleSearchChange,
    resetFilters
  } = useFilters({
    search: '',
    program: null,
    semester: null,
    status: null
  });

  // Subjects query - dynamically fetch based on filters
  const { data: subjectsData, isLoading: subjectsLoading, isError, error, refetch } = useQuery({
    queryKey: ['subjects', filters.program, filters.semester],
    queryFn: async () => {
      try {
        let subjects = [];
        
        // Fetch subjects based on selected filters
        if (filters.program && filters.semester) {
          // Both program and semester selected - get specific subjects
          const programSubjects = await subjectsAPI.getSubjectsByProgram(filters.program);
          subjects = programSubjects.filter(subject => Number(subject.semester) === Number(filters.semester));
        } else if (filters.program) {
          // Only program selected - get all subjects for that program
          subjects = await subjectsAPI.getSubjectsByProgram(filters.program);
        } else if (filters.semester) {
          // Only semester selected - get all subjects for that semester
          subjects = await subjectsAPI.getSubjectsBySemester(filters.semester);
        } else {
          // No filters - get all subjects
          subjects = await subjectsAPI.getAllSubjects();
        }
        
        return subjects;
      } catch (error) {
        console.error('Error fetching subjects:', error);
        throw error;
      }
    },
    enabled: true,
    retry: 2,
    staleTime: 30000,
    cacheTime: 5 * 60 * 1000,
  });

  // Programs query
  const { data: programsData, isLoading: programsLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => {
      try {
        const response = await programsAPI.getPrograms();
        const programs = response.data || [];
        return programs;
      } catch (error) {
        console.error('Error fetching programs:', error);
        message.error('Failed to load programs');
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
  });

  // Apply client-side filtering for search and status
  const filteredSubjects = useFilteredData(subjectsData || [], filters, {
    searchFields: ['name', 'code', 'description']
  });

  // Get program abbreviation helper
  const getProgramAbbreviation = useCallback((programId) => {
    if (!programId) return 'N/A';
    
    let program = null;
    
    // If programId is already a populated object
    if (typeof programId === 'object' && programId.code) {
      program = programId;
    } else if (typeof programId === 'object' && programId.name) {
      // Handle different field names - check if it has code field
      program = programId.code ? programId : { code: programId.name };
    } else if (typeof programId === 'string' && programsData) {
      // Find program in programsData
      program = programsData.find(p => p._id === programId);
    }
    
    if (!program) return 'N/A';
    
    // Use the code field directly if available
    if (program.code) {
      return program.code.toUpperCase();
    }
    
    // Fallback to name if no code field
    if (program.name) {
      return program.name.toUpperCase();
    }
    
    if (program.programName) {
      return program.programName.toUpperCase();
    }
    
    return 'N/A';
  }, [programsData]);

  // Enhanced subjects with program abbreviations
  const enhancedSubjects = useMemo(() => {
    if (!Array.isArray(filteredSubjects)) return [];
    
    return filteredSubjects.map(subject => {
      let programAbbreviations = 'N/A';
      
      if (Array.isArray(subject.programId)) {
        programAbbreviations = subject.programId.map(program => {
          return getProgramAbbreviation(program);
        }).join(', ');
      } else if (subject.programId) {
        programAbbreviations = getProgramAbbreviation(subject.programId);
      }
      
      return {
        ...subject,
        programAbbreviations,
        key: subject._id
      };
    });
  }, [filteredSubjects, getProgramAbbreviation]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data) => {
      return await subjectsAPI.createSubject(data);
    },
    onSuccess: () => {
      message.success('Subject created successfully');
      queryClient.invalidateQueries(['subjects']);
      setEditModalVisible(false);
      setEditingSubject(null);
      form.resetFields();
    },
    onError: (error) => {
      console.error('Create error:', error);
      message.error(error.response?.data?.message || 'Failed to create subject');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await subjectsAPI.updateSubject(id, data);
    },
    onSuccess: () => {
      message.success('Subject updated successfully');
      queryClient.invalidateQueries(['subjects']);
      setEditModalVisible(false);
      setEditingSubject(null);
      form.resetFields();
    },
    onError: (error) => {
      console.error('Update error:', error);
      message.error(error.response?.data?.message || 'Failed to update subject');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return await subjectsAPI.deleteSubject(id);
    },
    onSuccess: () => {
      message.success('Subject deleted successfully');
      queryClient.invalidateQueries(['subjects']);
    },
    onError: (error) => {
      console.error('Delete error:', error);
      message.error(error.response?.data?.message || 'Failed to delete subject');
    }
  });

  const createBulkMutation = useMutation({
    mutationFn: async (subjects) => {
      return await subjectsAPI.createSubjectsBulk(subjects);
    },
    onSuccess: (data) => {
      const count = data?.insertedCount || 0;
      message.success(`Successfully created subject for ${count} semester(s)`);
      queryClient.invalidateQueries(['subjects']);
      setEditModalVisible(false);
      setEditingSubject(null);
      form.resetFields();
    },
    onError: (error) => {
      console.error('Bulk create error:', error);
      message.error(error.response?.data?.message || 'Failed to create subjects');
    }
  });

  // Event handlers
  const handleFilterChange = useCallback((type, value) => {
    updateFilter(type, value);
  }, [updateFilter]);

  const handleEdit = (subject) => {
    setEditingSubject(subject);
    
    // Handle programId - extract IDs from populated objects
    let programIds = [];
    if (Array.isArray(subject.programId)) {
      programIds = subject.programId.map(program => 
        typeof program === 'object' && program._id ? program._id : program
      );
    } else if (subject.programId) {
      programIds = [typeof subject.programId === 'object' && subject.programId._id ? subject.programId._id : subject.programId];
    }
    
    form.setFieldsValue({
      name: subject.name,
      code: subject.code,
      programId: programIds,
      semester: subject.semester,
      credits: subject.credits?.theory || subject.credits,
      description: subject.description
    });
    setEditModalVisible(true);
  };

  const handleDelete = (subject) => {
    deleteMutation.mutate(subject._id);
  };

  const handleAddNew = () => {
    setEditingSubject(null);
    form.resetFields();
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingSubject) {
        // For editing, maintain the single subject approach
        const formattedValues = {
          name: values.name.trim(),
          code: values.code.trim().toUpperCase(),
          programId: Array.isArray(values.programId) ? values.programId : [values.programId],
          semester: Array.isArray(values.semester) ? values.semester[0] : values.semester,
          credits: {
            theory: values.credits,
            practical: 0,
            tutorial: 0
          },
          weeklyHours: {
            theory: values.credits,
            practical: 0,
            tutorial: 0
          },
          description: values.description || '',
          isActive: true
        };
        updateMutation.mutate({ id: editingSubject._id, data: formattedValues });
      } else {
        // For creating new subjects, handle multiple semesters
        const semesters = Array.isArray(values.semester) ? values.semester : [values.semester];
        
        if (semesters.length === 1) {
          // Single semester - use normal creation
          const formattedValues = {
            name: values.name.trim(),
            code: values.code.trim().toUpperCase(),
            programId: Array.isArray(values.programId) ? values.programId : [values.programId],
            semester: semesters[0],
            credits: {
              theory: values.credits,
              practical: 0,
              tutorial: 0
            },
            weeklyHours: {
              theory: values.credits,
              practical: 0,
              tutorial: 0
            },
            description: values.description || '',
            isActive: true
          };
          createMutation.mutate(formattedValues);
        } else {
          // Multiple semesters - create multiple subjects
          const subjects = semesters.map(semester => ({
            name: values.name.trim(),
            code: `${values.code.trim().toUpperCase()}`,
            programId: Array.isArray(values.programId) ? values.programId : [values.programId],
            semester: semester,
            credits: {
              theory: values.credits,
              practical: 0,
              tutorial: 0
            },
            weeklyHours: {
              theory: values.credits,
              practical: 0,
              tutorial: 0
            },
            description: values.description || '',
            isActive: true
          }));
          
          // Use bulk creation for multiple semesters
          createBulkMutation.mutate(subjects);
        }
      }
    } catch (error) {
      console.error('Form validation error:', error);
      message.error('Please check the form fields');
    }
  };

  const handleCancel = () => {
    setEditModalVisible(false);
    setEditingSubject(null);
    form.resetFields();
  };

  // Table columns
  const columns = [
    {
      title: 'Subject Details',
      key: 'details',
      width: 300,
      render: (_, record) => (
        <div>
          <Text strong>{record.name}</Text>
          <br />
          <Tag color="purple">{record.code}</Tag>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.description || 'No description'}
          </Text>
        </div>
      )
    },
    {
      title: 'Credits',
      dataIndex: 'credits',
      key: 'credits',
      align: 'center',
      width: 100,
      render: (credits) => {
        if (typeof credits === 'object' && credits !== null) {
          const total = (credits.theory || 0) + (credits.practical || 0) + (credits.tutorial || 0);
          return <Tag color="blue">{total}</Tag>;
        }
        return <Tag color="blue">{credits || 0}</Tag>;
      }
    },
    {
      title: 'Semester',
      dataIndex: 'semester',
      key: 'semester',
      align: 'center',
      width: 100,
      render: (semester) => <Tag color="green">Sem {semester}</Tag>
    },
    {
      title: 'Program(s)',
      dataIndex: 'programAbbreviations',
      key: 'programs',
      align: 'center',
      width: 120,
      render: (abbreviations) => (
        <Tag color="cyan" style={{ fontWeight: 'bold' }}>
          {abbreviations}
        </Tag>
      )
    },

    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button 
            //type="primary" 
            ghost
            size="small" 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{ borderColor: '#1677ff', color: '#1677ff' }}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete Subject"
            description="Are you sure you want to delete this subject?"
            onConfirm={() => handleDelete(record)}
            okText="Yes"
            cancelText="No"
          >
            <Button 
              //type="primary" 
              danger 
              ghost
              size="small" 
              icon={<DeleteOutlined />}
              style={{ borderColor: '#ff4d4f', color: '#ff4d4f' }}
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const isLoading = subjectsLoading || programsLoading;

  return (
    <div>
      {/* Error Alert */}
      {isError && (
        <Alert
          message="Error Loading Subjects"
          description={error?.message || 'Failed to load subjects'}
          type="error"
          showIcon
          action={
            <Button onClick={() => refetch()} type="primary">
              Retry
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Filter Section */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Title level={4} style={{ margin: 0 }}>
              <FilterOutlined /> Subject Filters
            </Title>
          </Col>
          <Col>
            <Button 
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddNew}
            >
              Add Subject
            </Button>
          </Col>
        </Row>
        
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Form.Item label="Program" style={{ marginBottom: 0 }}>
              <Select
                placeholder="Select Program"
                value={filters.program}
                onChange={(value) => handleFilterChange('program', value)}
                allowClear
                loading={programsLoading}
                style={{ width: '100%' }}
                optionLabelProp="label"
                notFoundContent={programsLoading ? <Spin size="small" /> : 'No programs found'}
              >
                {(programsData || []).map(program => (
                  <Option 
                    key={program._id} 
                    value={program._id}
                    label={getProgramAbbreviation(program._id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{program.name}</span>
                      <Tag color="blue" size="small">{getProgramAbbreviation(program._id)}</Tag>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Form.Item label="Semester" style={{ marginBottom: 0 }}>
              <Select
                placeholder="Select Semester"
                value={filters.semester}
                onChange={(value) => handleFilterChange('semester', value)}
                allowClear
                style={{ width: '100%' }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                  <Option key={sem} value={sem}>
                    Semester {sem}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Form.Item label="Search" style={{ marginBottom: 0 }}>
              <Input
                placeholder="Search subjects..."
                value={searchText}
                onChange={handleSearchChange}
                allowClear
                prefix={<SearchOutlined />}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button 
                onClick={resetFilters}
                icon={<ReloadOutlined />}
                style={{ width: '100%' }}
              >
                Clear Filters
              </Button>
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* Results Summary */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Text>
              Showing <strong>{enhancedSubjects.length}</strong> subjects
              {filters.program && ` for selected program`}
              {filters.semester && ` in semester ${filters.semester}`}
            </Text>
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            {isLoading && <Spin size="small" />}
          </Col>
        </Row>
      </Card>

      {/* Subjects Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={enhancedSubjects}
          loading={isLoading}
          rowKey="key"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} of ${total} subjects`
          }}
          scroll={{ x: true }}
          locale={{
            emptyText: filters.program || filters.semester 
              ? 'No subjects found for the selected filters'
              : 'No subjects available'
          }}
        />
      </Card>

      {/* Edit/Add Modal */}
      <Modal
        title={editingSubject ? 'Edit Subject' : 'Add New Subject'}
        open={editModalVisible}
        onOk={handleSave}
        onCancel={handleCancel}
        confirmLoading={createMutation.isLoading || updateMutation.isLoading || createBulkMutation.isLoading}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Subject Name"
            rules={[
              { required: true, message: 'Please enter subject name' },
              { max: 200, message: 'Subject name must be 200 characters or less' }
            ]}
          >
            <Input placeholder="e.g., Computer Programming" />
          </Form.Item>

          <Form.Item
            name="code"
            label="Subject Code"
            rules={[
              { required: true, message: 'Please enter subject code' },
              { max: 10, message: 'Subject code must be 10 characters or less' }
            ]}
          >
            <Input placeholder="e.g., CSC101" />
          </Form.Item>

          <Form.Item
            name="programId"
            label="Program(s)"
            rules={[{ required: true, message: 'Please select at least one program' }]}
          >
            <Select 
              mode="multiple" 
              placeholder="Select programs"
              showSearch
              optionFilterProp="children"
              optionLabelProp="label"
            >
              {(programsData || []).map(program => (
                <Option 
                  key={program._id} 
                  value={program._id}
                  label={getProgramAbbreviation(program._id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{program.name}</span>
                    <Tag color="blue" size="small">{getProgramAbbreviation(program._id)}</Tag>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="semester"
            label={editingSubject ? "Semester" : "Semester(s)"}
            rules={[{ required: true, message: editingSubject ? 'Please select semester' : 'Please select at least one semester' }]}
          >
            <Select 
              mode={editingSubject ? undefined : "multiple"}
              placeholder={editingSubject ? "Select semester" : "Select semester(s)"}
              showSearch={false}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                <Option key={sem} value={sem}>Semester {sem}</Option>
              ))}
            </Select>
          </Form.Item>

          {!editingSubject && (
            <div style={{ marginTop: '-16px', marginBottom: '16px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                💡 Selecting multiple semesters will create separate subject records for each semester
              </Text>
            </div>
          )}

          <Form.Item
            name="credits"
            label="Credits"
            rules={[
              { required: true, message: 'Please enter credits' },
              { type: 'number', min: 1, max: 6, message: 'Credits must be between 1-6' }
            ]}
          >
            <InputNumber min={1} max={6} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea
              rows={4}
              placeholder="Enter subject description..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Subjects;