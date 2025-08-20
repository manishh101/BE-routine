/**
 * Room PDF Actions Component
 * Replaces RoomExcelActions for PDF export
 */

import React, { useState } from 'react';
import { Button, Space, Tooltip } from 'antd';
import { FilePdfOutlined, LoadingOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { roomsAPI } from '../services/api';
import { useSemesterGroup } from '../contexts/SemesterGroupContext';
import ClassDateModal from './ClassDateModal';

const RoomPDFActions = ({ 
  roomId,
  roomName = 'Room',
  size = 'small',
  showAllRoomsExport = false
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const { semesterGroup } = useSemesterGroup();

  const handleExportRoomSchedule = async () => {
    if (!roomId) {
      message.error('Room ID is required');
      return;
    }

    // Show the date modal instead of directly exporting
    setShowDateModal(true);
  };

  // Handle Export with Dates
  const handleExportWithDates = async ({ startDate, endDate }) => {
    setIsExporting(true);
    
    try {
      setShowDateModal(false);
      console.log('🎯 Exporting room schedule to PDF:', { roomId, roomName, semesterGroup, startDate, endDate });
      
      const response = await roomsAPI.exportRoomScheduleToPDF(roomId, semesterGroup, { startDate, endDate });
      
      // Create blob and download
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const sanitizedName = roomName.replace(/[^a-zA-Z0-9]/g, '_');
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `${sanitizedName}_Schedule_${timestamp}.pdf`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success(`✅ ${roomName} schedule exported successfully!`);
      console.log('✅ Room schedule PDF export completed');
      
    } catch (error) {
      console.error('❌ Room schedule PDF export failed:', error);
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to export room schedule';
      
      message.error(`❌ Export failed: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle modal cancel
  const handleModalCancel = () => {
    setShowDateModal(false);
  };

  const handleExportAllRoomSchedules = async () => {
    setIsExportingAll(true);
    
    try {
      console.log('🎯 Exporting all room schedules to PDF', { semesterGroup });
      
      const response = await roomsAPI.exportAllRoomSchedulesToPDF(semesterGroup);
      
      // Create blob and download
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `All_Room_Schedules_${timestamp}.pdf`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success('✅ All room schedules exported successfully!');
      console.log('✅ All room schedules PDF export completed');
      
    } catch (error) {
      console.error('❌ All room schedules PDF export failed:', error);
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to export all room schedules';
      
      message.error(`❌ Export failed: ${errorMessage}`);
    } finally {
      setIsExportingAll(false);
    }
  };

  return (
    <Space size="small">
      {/* Individual Room Export */}
      <Tooltip title={`Export ${roomName} schedule to PDF`}>
        <Button
          type="primary"
          icon={isExporting ? <LoadingOutlined /> : <FilePdfOutlined />}
          onClick={handleExportRoomSchedule}
          loading={isExporting}
          size={size}
          style={{
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '500'
          }}
        >
          {isExporting ? 'Exporting...' : 'Export PDF'}
        </Button>
      </Tooltip>

      {/* All Rooms Export (if enabled) */}
      {showAllRoomsExport && (
        <Tooltip title="Export all room schedules to PDF">
          <Button
            type="default"
            icon={isExportingAll ? <LoadingOutlined /> : <FilePdfOutlined />}
            onClick={handleExportAllRoomSchedules}
            loading={isExportingAll}
            size={size}
            style={{
              borderColor: '#ff6b6b',
              color: '#ff6b6b',
              borderRadius: '6px',
              fontWeight: '500'
            }}
          >
            {isExportingAll ? 'Exporting All...' : 'Export All Rooms'}
          </Button>
        </Tooltip>
      )}

      {/* Class Date Modal */}
      <ClassDateModal
        visible={showDateModal}
        onOk={handleExportWithDates}
        onCancel={handleModalCancel}
        programCode="ROOM"
        semester="ALL"
        section={roomName}
      />
    </Space>
  );
};

export default RoomPDFActions;
