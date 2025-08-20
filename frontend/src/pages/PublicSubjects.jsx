import React, { useState, useMemo, useCallback } from 'react';
import { subjectsAPI } from '../services/subjectsAPI';
import { useFilters, useFilteredData } from '../hooks/useFilters';
import {
  Card, 
  Table, 
  Typography, 
  Space,
  Tag,
  Row,
  Col,
  Alert,
  Select,
  Spin,
  Input,
  Button
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import {
  SearchOutlined,
  ReloadOutlined,
  FilterOutlined,
  BookOutlined,
  ReadOutlined
} from '@ant-design/icons';
import { programsAPI } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

const PublicSubjects = () => {
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
        throw error;
      }
    },
    enabled: true,
    retry: 2,
    staleTime: 60000,
    cacheTime: 5 * 60 * 1000,
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

  // Enhanced subjects with program abbreviations and active status
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
        status: 'Active', // Force all subjects to show as Active
        key: subject._id
      };
    });
  }, [filteredSubjects, getProgramAbbreviation]);

  // Filter data using custom hook
  const filteredData = enhancedSubjects;

  // Generate semester options (hardcoded like admin panel)
  const semesterOptions = [1, 2, 3, 4, 5, 6, 7, 8];

  // Event handlers
  const handleFilterChange = useCallback((type, value) => {
    updateFilter(type, value);
  }, [updateFilter]);

  // Table columns configuration
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
      title: 'Theory Hours',
      dataIndex: 'weeklyHours',
      key: 'theoryHours',
      align: 'center',
      width: 100,
      render: (weeklyHours, record) => {
        if (typeof weeklyHours === 'object' && weeklyHours !== null) {
          return <Text>{weeklyHours.theory || 0}</Text>;
        }
        return <Text>{record.theoryHours || 0}</Text>;
      }
    },
    {
      title: 'Lab Hours',
      dataIndex: 'weeklyHours',
      key: 'labHours',
      align: 'center',
      width: 100,
      render: (weeklyHours, record) => {
        if (typeof weeklyHours === 'object' && weeklyHours !== null) {
          return <Text>{weeklyHours.practical || 0}</Text>;
        }
        return <Text>{record.labHours || 0}</Text>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      width: 100,
      render: (status) => (
        <Tag color={status === 'Active' ? 'green' : 'red'}>
          {status}
        </Tag>
      )
    }
  ];

  // Loading state
  if (subjectsLoading || programsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <Alert
        message="Error Loading Subjects"
        description={error?.message || "Unable to load subjects data"}
        type="error"
        showIcon
        style={{ margin: '20px 0' }}
      />
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <Title level={2} style={{ margin: 0 }}>
                <BookOutlined style={{ marginRight: '8px' }} />
                Subjects
              </Title>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={refetch}
                type="default"
              >
                Refresh
              </Button>
            </div>

            {/* Filters */}
            <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Input.Search
                  placeholder="Search subjects..."
                  value={searchText}
                  onChange={handleSearchChange}
                  prefix={<SearchOutlined />}
                  allowClear
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Select
                  placeholder="Select Program"
                  value={filters.program}
                  onChange={(value) => handleFilterChange('program', value)}
                  style={{ width: '100%' }}
                  allowClear
                >
                  {programsData?.map(program => (
                    <Option key={program._id} value={program._id}>
                      {program.name}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Select
                  placeholder="Select Semester"
                  value={filters.semester}
                  onChange={(value) => handleFilterChange('semester', value)}
                  style={{ width: '100%' }}
                  allowClear
                >
                  {semesterOptions.map(semester => (
                    <Option key={semester} value={semester}>
                      Semester {semester}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Button 
                  onClick={resetFilters}
                  icon={<ReloadOutlined />}
                  type="default"
                  style={{ width: '100%' }}
                >
                  Clear Filters
                </Button>
              </Col>
            </Row>

            {/* Results Summary */}
            <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
              <Col span={12}>
                <Text>
                  Showing <strong>{filteredData.length}</strong> subjects
                  {filters.program && ` for selected program`}
                  {filters.semester && ` in semester ${filters.semester}`}
                </Text>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                {subjectsLoading && <Spin size="small" />}
              </Col>
            </Row>

            {/* Statistics */}
            <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Card size="small">
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary">Total Subjects</Text>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                      {filteredData.length}
                    </div>
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Card size="small">
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary">Active Subjects</Text>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                      {filteredData.length}
                    </div>
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Card size="small">
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary">Programs</Text>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#722ed1' }}>
                      {new Set(filteredData.map(subject => subject.programAbbreviations)).size}
                    </div>
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Card size="small">
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary">Semesters</Text>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fa8c16' }}>
                      {new Set(filteredData.map(subject => subject.semester)).size}
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>

            {/* Subjects Table */}
            <Table
              columns={columns}
              dataSource={filteredData}
              rowKey="key"
              loading={subjectsLoading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} subjects`
              }}
              scroll={{ x: 1000 }}
              size="middle"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default PublicSubjects;
