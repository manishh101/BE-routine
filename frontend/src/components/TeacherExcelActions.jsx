/**
 * TeacherExcelActions Placeholder Component
 * This is a placeholder component that replaces the Excel functionality
 * while keeping the UI intact.
 */

import React from 'react';
import { Button, Tooltip, Space, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

const { Text } = Typography;

const TeacherExcelActions = ({ teacherId, teacherName }) => {
  return (
    <div className="teacher-excel-actions-placeholder" style={{ marginBottom: '16px' }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <div style={{ marginBottom: '8px' }}>
          <Text strong style={{ color: '#1a1a1a' }}>Teacher Export Options</Text>
        </div>
        <Space>
          <Tooltip title="Excel export is currently unavailable">
            <Button 
              icon={<FileTextOutlined />} 
              disabled
            >
              Export Teacher Schedule
            </Button>
          </Tooltip>
        </Space>
      </Space>
    </div>
  );
};

export default TeacherExcelActions;
