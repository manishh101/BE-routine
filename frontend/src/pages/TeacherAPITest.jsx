import React, { useState } from 'react';
import { Card, Button, Space, Typography, Alert, Spin, Select, Divider } from 'antd';
import { ApiOutlined, UserOutlined, PlayCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { teachersAPI } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

/**
 * Teacher API Test Page
 * For testing teacher-related API endpoints
 */
const TeacherAPITest = () => {
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [loading, setLoading] = useState({});

  // Fetch teachers list
  const { data: teachersData, isLoading: teachersLoading } = useQuery({
    queryKey: ['teachers'],
    queryFn: teachersAPI.getAllTeachers,
  });

  const teachers = teachersData?.data || [];

  const setTestLoading = (testName, isLoading) => {
    setLoading(prev => ({ ...prev, [testName]: isLoading }));
  };

  const setTestResult = (testName, result) => {
    setTestResults(prev => ({ ...prev, [testName]: result }));
  };

  const testGetAllTeachers = async () => {
    setTestLoading('getAllTeachers', true);
    try {
      const response = await teachersAPI.getAllTeachers();
      setTestResult('getAllTeachers', {
        success: true,
        data: response.data,
        message: `Successfully fetched ${response.data.length} teachers`
      });
    } catch (error) {
      setTestResult('getAllTeachers', {
        success: false,
        error: error.response?.data || error.message,
        message: 'Failed to fetch teachers'
      });
    } finally {
      setTestLoading('getAllTeachers', false);
    }
  };

  const testGetTeacherSchedule = async () => {
    if (!selectedTeacher) {
      setTestResult('getTeacherSchedule', {
        success: false,
        message: 'Please select a teacher first'
      });
      return;
    }

    setTestLoading('getTeacherSchedule', true);
    try {
      const response = await teachersAPI.getTeacherSchedule(selectedTeacher);
      setTestResult('getTeacherSchedule', {
        success: true,
        data: response.data,
        message: 'Successfully fetched teacher schedule'
      });
    } catch (error) {
      setTestResult('getTeacherSchedule', {
        success: false,
        error: error.response?.data || error.message,
        message: 'Failed to fetch teacher schedule'
      });
    } finally {
      setTestLoading('getTeacherSchedule', false);
    }
  };

  const testExportTeacherSchedule = async () => {
    if (!selectedTeacher) {
      setTestResult('exportTeacherSchedule', {
        success: false,
        message: 'Please select a teacher first'
      });
      return;
    }

    setTestLoading('exportTeacherSchedule', true);
    try {
      const response = await teachersAPI.exportTeacherSchedule(selectedTeacher);
      
      // Check if response is a blob (Excel file)
      const isBlob = response.data instanceof Blob;
      const size = isBlob ? response.data.size : 0;
      
      setTestResult('exportTeacherSchedule', {
        success: true,
        data: { 
          isExcelFile: isBlob,
          fileSize: size,
          contentType: response.headers?.['content-type'] || 'unknown'
        },
        message: `Successfully generated Excel file (${size} bytes)`
      });
    } catch (error) {
      setTestResult('exportTeacherSchedule', {
        success: false,
        error: error.response?.data || error.message,
        message: 'Failed to export teacher schedule'
      });
    } finally {
      setTestLoading('exportTeacherSchedule', false);
    }
  };

  const renderTestResult = (testName) => {
    const result = testResults[testName];
    if (!result) return null;

    return (
      <Alert
        message={result.success ? 'Success' : 'Error'}
        description={
          <div>
            <Text>{result.message}</Text>
            {result.data && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', color: '#1890ff' }}>
                  View Response Data
                </summary>
                <pre style={{ 
                  background: '#f5f5f5', 
                  padding: '8px', 
                  marginTop: '8px',
                  fontSize: '12px',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </details>
            )}
            {result.error && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', color: '#ff4d4f' }}>
                  View Error Details
                </summary>
                <pre style={{ 
                  background: '#fff2f0', 
                  padding: '8px', 
                  marginTop: '8px',
                  fontSize: '12px',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {JSON.stringify(result.error, null, 2)}
                </pre>
              </details>
            )}
          </div>
        }
        type={result.success ? 'success' : 'error'}
        style={{ marginTop: 12 }}
      />
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        
        <Card>
          <Title level={2}>
            <ApiOutlined style={{ color: '#1890ff' }} /> Teacher API Test
          </Title>
          <Paragraph>
            Test the teacher-related API endpoints to ensure they're working correctly.
            This page is useful for debugging and verifying API functionality.
          </Paragraph>
        </Card>

        {/* Teacher Selection */}
        <Card title="👨‍🏫 Teacher Selection">
          <Space direction="vertical" size="medium" style={{ width: '100%' }}>
            <div>
              <Text strong>Select a teacher for schedule-related tests:</Text>
            </div>
            <Select
              placeholder="Choose a teacher..."
              style={{ width: '100%', maxWidth: '400px' }}
              loading={teachersLoading}
              onChange={setSelectedTeacher}
              value={selectedTeacher}
              showSearch
              optionFilterProp="children"
            >
              {teachers.map(teacher => (
                <Option key={teacher._id} value={teacher._id}>
                  <Space>
                    <UserOutlined />
                    {teacher.name} ({teacher.department})
                  </Space>
                </Option>
              ))}
            </Select>
          </Space>
        </Card>

        {/* API Tests */}
        <Card title="🧪 API Tests">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            
            {/* Test 1: Get All Teachers */}
            <div>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>1. GET /api/teachers</Text>
                    <br />
                    <Text type="secondary">Fetch all teachers list</Text>
                  </div>
                  <Button
                    type="primary"
                    icon={loading.getAllTeachers ? <Spin size="small" /> : <PlayCircleOutlined />}
                    onClick={testGetAllTeachers}
                    loading={loading.getAllTeachers}
                  >
                    Test
                  </Button>
                </div>
                {renderTestResult('getAllTeachers')}
              </Space>
            </div>

            <Divider />

            {/* Test 2: Get Teacher Schedule */}
            <div>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>2. GET /api/teachers/:id/schedule</Text>
                    <br />
                    <Text type="secondary">Fetch teacher's schedule data</Text>
                    {!selectedTeacher && (
                      <div><Text type="warning">⚠️ Select a teacher first</Text></div>
                    )}
                  </div>
                  <Button
                    type="primary"
                    icon={loading.getTeacherSchedule ? <Spin size="small" /> : <FileTextOutlined />}
                    onClick={testGetTeacherSchedule}
                    loading={loading.getTeacherSchedule}
                    disabled={!selectedTeacher}
                  >
                    Test
                  </Button>
                </div>
                {renderTestResult('getTeacherSchedule')}
              </Space>
            </div>

            <Divider />

            {/* Test 3: Export Teacher Schedule */}
            <div>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>3. GET /api/teachers/:id/schedule/excel</Text>
                    <br />
                    <Text type="secondary">Export teacher schedule as Excel file</Text>
                    {!selectedTeacher && (
                      <div><Text type="warning">⚠️ Select a teacher first</Text></div>
                    )}
                  </div>
                  <Button
                    type="primary"
                    icon={loading.exportTeacherSchedule ? <Spin size="small" /> : <FileTextOutlined />}
                    onClick={testExportTeacherSchedule}
                    loading={loading.exportTeacherSchedule}
                    disabled={!selectedTeacher}
                  >
                    Test Export
                  </Button>
                </div>
                {renderTestResult('exportTeacherSchedule')}
              </Space>
            </div>

          </Space>
        </Card>

        {/* Instructions */}
        <Card title="📖 Instructions">
          <Space direction="vertical" size="small">
            <Text>• <strong>Step 1:</strong> Test "Get All Teachers" to verify the teachers endpoint works</Text>
            <Text>• <strong>Step 2:</strong> Select a teacher from the dropdown</Text>
            <Text>• <strong>Step 3:</strong> Test "Get Teacher Schedule" to verify schedule data</Text>
            <Text>• <strong>Step 4:</strong> Test "Export Teacher Schedule" to verify Excel generation</Text>
            <Divider />
            <Text type="secondary">
              This page helps verify that all teacher-related API endpoints are functioning correctly.
              Check the response data and error details for debugging.
            </Text>
          </Space>
        </Card>

      </Space>
    </div>
  );
};

export default TeacherAPITest;
