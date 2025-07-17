import React, { useState } from 'react';
import { Button, message, Space, Tooltip } from 'antd';
import { FileExcelOutlined, DownloadOutlined, LoadingOutlined } from '@ant-design/icons';
import { roomsAPI } from '../services/api';

/**
 * Room Excel Actions Component
 * Handles Excel export functionality for room schedules
 */
const RoomExcelActions = ({ roomId, roomName = 'Room' }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportRoomSchedule = async () => {
    if (!roomId) {
      message.error('No room selected');
      return;
    }

    setIsExporting(true);
    
    try {
      console.log('🏢 Starting room schedule export...');
      
      // Call the API to get the Excel file
      const response = await roomsAPI.exportRoomSchedule(roomId);
      
      // Create blob from response
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const sanitizedName = roomName.replace(/[^a-zA-Z0-9]/g, '_');
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `${sanitizedName}_Schedule_${timestamp}.xlsx`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success(`✅ ${roomName} schedule exported successfully!`);
      console.log('✅ Room schedule export completed');
      
    } catch (error) {
      console.error('❌ Room schedule export failed:', error);
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to export room schedule';
      
      message.error(`❌ Export failed: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Space>
      <Tooltip title={`Export ${roomName} schedule to Excel`}>
        <Button
          type="primary"
          icon={isExporting ? <LoadingOutlined /> : <FileExcelOutlined />}
          onClick={handleExportRoomSchedule}
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

export default RoomExcelActions;
