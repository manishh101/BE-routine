/**
 * Teacher PDF Actions Component
 * Replaces TeacherExcelActions for PDF export
 */

import React, { useState } from 'react';
import { Button, Space, Tooltip } from 'antd';
import { FilePdfOutlined, LoadingOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { teachersAPI } from '../services/api';
import { useSemesterGroup } from '../contexts/SemesterGroupContext';
import ClassDateModal from './ClassDateModal';

const TeacherPDFActions = ({ 
  teacherId,
  teacherName = 'Teacher',
  size = 'small',
  showAllTeachersExport = false
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const { semesterGroup } = useSemesterGroup();

  const handleExportTeacherSchedule = async () => {
    if (!teacherId) {
      message.error('Teacher ID is required');
      return;
    }

    // Show the date modal instead of directly exporting
    setShowDateModal(true);
  };

  // Handle Export with Dates and Authority Info
  const handleExportWithDates = async (data) => {
    setIsExporting(true);
    
    try {
      setShowDateModal(false);
      console.log('🎯 Exporting teacher schedule to PDF:', { teacherId, teacherName, semesterGroup, ...data });
      
      const response = await teachersAPI.exportTeacherScheduleToPDF(teacherId, semesterGroup, data);
      
      // Create blob and download
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const sanitizedName = teacherName.replace(/[^a-zA-Z0-9]/g, '_');
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `${sanitizedName}_Schedule_${timestamp}.pdf`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success(`✅ ${teacherName}'s schedule exported successfully!`);
      console.log('✅ Teacher schedule PDF export completed');
      
    } catch (error) {
      console.error('❌ Teacher schedule PDF export failed:', error);
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to export teacher schedule';
      
      message.error(`❌ Export failed: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle modal cancel
  const handleModalCancel = () => {
    setShowDateModal(false);
  };

  const handleExportAllTeachersSchedules = async () => {
    setIsExportingAll(true);
    
    try {
      console.log('🎯 Exporting all teachers schedules to PDF', { semesterGroup });
      
      const response = await teachersAPI.exportAllTeachersSchedulesToPDF(semesterGroup);
      
      // Create blob and download
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `All_Teachers_Schedules_${timestamp}.pdf`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success('✅ All teachers schedules exported successfully!');
      console.log('✅ All teachers schedules PDF export completed');
      
    } catch (error) {
      console.error('❌ All teachers schedules PDF export failed:', error);
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to export all teachers schedules';
      
      message.error(`❌ Export failed: ${errorMessage}`);
    } finally {
      setIsExportingAll(false);
    }
  };

  return (
    <Space size="small">
      {/* Individual Teacher Export */}
      <Tooltip title={`Export ${teacherName} schedule to PDF`}>
        <Button
          type="primary"
          icon={isExporting ? <LoadingOutlined /> : <FilePdfOutlined />}
          onClick={handleExportTeacherSchedule}
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

      {/* All Teachers Export (if enabled) */}
      {showAllTeachersExport && (
        <Tooltip title="Export all teachers schedules to PDF">
          <Button
            type="default"
            icon={isExportingAll ? <LoadingOutlined /> : <FilePdfOutlined />}
            onClick={handleExportAllTeachersSchedules}
            loading={isExportingAll}
            size={size}
            style={{
              borderColor: '#ff6b6b',
              color: '#ff6b6b',
              borderRadius: '6px',
              fontWeight: '500'
            }}
          >
            {isExportingAll ? 'Exporting All...' : 'Export All Teachers'}
          </Button>
        </Tooltip>
      )}

      {/* Class Date Modal */}
      <ClassDateModal
        visible={showDateModal}
        onOk={handleExportWithDates}
        onCancel={handleModalCancel}
        programCode="TEACHER"
        semester="ALL"
        section={teacherName}
        exportType="teacher"
      />
    </Space>
  );
};

export default TeacherPDFActions;
