/**
 * Teacher PDF Demo Page
 * Showcases the teacher PDF export functionality
 */

import React, { useState } from 'react';
import { Card, Select, Space, Typography, Divider, Alert, Button } from 'antd';
import { UserOutlined, FilePdfOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { teachersAPI } from '../services/api';
import TeacherPDFActions from '../components/TeacherPDFActions';
import TeacherScheduleManager from '../components/TeacherScheduleManager';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

const TeacherPDFDemo = () => {
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  // Fetch teachers for demo
  const { data: teachersData, isLoading: teachersLoading } = useQuery({
    queryKey: ['teachers'],
    queryFn: teachersAPI.getAllTeachers,
  });

  const teachers = teachersData?.data || [];
  const selectedTeacherInfo = teachers.find(t => t._id === selectedTeacher);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        
        {/* Header */}
        <Card>
          <Title level={2}>👨‍🏫 Teacher PDF Export Demo</Title>
          <Paragraph>
            This demo showcases the teacher PDF export functionality.
            Teachers can export their individual schedules in PDF format with professional formatting.
          </Paragraph>
          
          <Alert
            message="PDF Export Features"
            description={
              <ul style={{ marginBottom: 0, paddingLeft: '20px' }}>
                <li><strong>Individual Export:</strong> Export any teacher's schedule to PDF</li>
                <li><strong>Professional Format:</strong> Clean, readable PDF layout</li>
                <li><strong>Real-time Data:</strong> Always up-to-date with current schedules</li>
                <li><strong>Easy Download:</strong> One-click download with proper filenames</li>
                <li><strong>Schedule Integration:</strong> Automatically generated from routine data</li>
              </ul>
            }
            type="info"
            showIcon
            style={{ marginTop: '16px' }}
          />
        </Card>

        {/* Quick Export Section */}
        <Card title="🚀 Quick Export Demo">
          <Space direction="vertical" size="medium" style={{ width: '100%' }}>
            <div>
              <Text strong>Select a teacher to export their schedule:</Text>
            </div>
            
            <Space wrap size="middle">
              <Select
                placeholder="Choose a teacher..."
                style={{ minWidth: '250px' }}
                loading={teachersLoading}
                onChange={setSelectedTeacher}
                value={selectedTeacher}
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
              >
                {teachers.map(teacher => (
                  <Option key={teacher._id} value={teacher._id}>
                    <Space>
                      <UserOutlined />
                      <span>{teacher.name}</span>
                      <Text type="secondary">({teacher.department})</Text>
                    </Space>
                  </Option>
                ))}
              </Select>

              {selectedTeacher && (
                <TeacherPDFActions 
                  teacherId={selectedTeacher}
                  teacherName={selectedTeacherInfo?.name}
                />
              )}
            </Space>

            {selectedTeacherInfo && (
              <Alert
                message={`Ready to export ${selectedTeacherInfo.name}'s schedule`}
                description={`Department: ${selectedTeacherInfo.department} | Position: ${selectedTeacherInfo.designation}`}
                type="success"
                showIcon
              />
            )}
          </Space>
        </Card>

        <Divider>
          <Text type="secondary">Complete Teacher Schedule Management</Text>
        </Divider>

        {/* Full Teacher Schedule Manager */}
        <Card title="📋 Complete Teacher Schedule View">
          <Paragraph>
            Below is the full teacher schedule management interface, which includes 
            viewing capabilities along with export functionality:
          </Paragraph>
          
          <TeacherScheduleManager />
        </Card>

        {/* Instructions */}
        <Card title="📖 How to Use">
          <Space direction="vertical" size="medium">
            <div>
              <Text strong>1. Quick Export (Above):</Text>
              <Paragraph style={{ marginLeft: '20px', marginBottom: '8px' }}>
                Select a teacher from the dropdown and click "Export PDF" for instant download.
              </Paragraph>
            </div>
            
            <div>
              <Text strong>2. Full Schedule View:</Text>
              <Paragraph style={{ marginLeft: '20px', marginBottom: '8px' }}>
                Use the complete interface below to view teacher schedules in detail before exporting.
              </Paragraph>
            </div>
            
            <div>
              <Text strong>3. File Format:</Text>
              <Paragraph style={{ marginLeft: '20px', marginBottom: '8px' }}>
                PDF files are saved with the format: TeacherName_Schedule_YYYY-MM-DD.pdf
              </Paragraph>
            </div>
          </Space>
        </Card>

      </Space>
    </div>
  );
};

export default TeacherPDFDemo;
