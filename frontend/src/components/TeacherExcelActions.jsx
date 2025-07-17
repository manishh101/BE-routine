import React, { useState } from 'react';
import { Button, message, Space, Tooltip } from 'antd';
import { FileExcelOutlined, DownloadOutlined, LoadingOutlined } from '@ant-design/icons';
import { teachersAPI } from '../services/api';

/**
 * Teacher Excel Actions Component
 * Handles Excel export functionality for teacher schedules
 */
const TeacherExcelActions = ({ teacherId, teacherName = 'Teacher' }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportTeacherSchedule = async () => {
    if (!teacherId) {
      message.error('No teacher selected');
      return;
    }

    setIsExporting(true);
    
    try {
      console.log(' Starting teacher schedule export...');
      
      // Call the API to get the Excel file
      const response = await teachersAPI.exportTeacherSchedule(teacherId);
      
      // Create blob from response
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const sanitizedName = teacherName.replace(/[^a-zA-Z0-9]/g, '_');
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `${sanitizedName}_Schedule_${timestamp}.xlsx`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success(`✅ ${teacherName}'s schedule exported successfully!`);
      console.log('✅ Teacher schedule export completed');
      
    } catch (error) {
      console.error('❌ Teacher schedule export failed:', error);
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to export teacher schedule';
      
      message.error(`❌ Export failed: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Space>
      <Tooltip title={`Export ${teacherName}'s schedule to Excel`}>
        <Button
          type="primary"
          icon={isExporting ? <LoadingOutlined /> : <FileExcelOutlined />}
          onClick={handleExportTeacherSchedule}
          loading={isExporting}
          style={{
            background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '500'
          }}
        >
          {isExporting ? 'Exporting...' : 'Export Excel'}
        </Button>
      </Tooltip>
    </Space>
  );
};

export default TeacherExcelActions;