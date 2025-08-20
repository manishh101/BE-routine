/**
 * PDF Actions Component - Clean UI for PDF Export
 * Replaces Excel Actions for PDF export functionality
 */

import React, { useState } from 'react';
import { Button, Space } from 'antd';
import { DownloadOutlined, FilePdfOutlined } from '@ant-design/icons';
import usePDFOperations from '../hooks/usePDFOperations';
import ClassDateModal from './ClassDateModal';

const PDFActions = ({ 
  programCode, 
  semester, 
  section,
  allowExport = true,
  allowAllSemesterExport = false,
  demoMode = false,
  size = 'small',
  onExportSuccess,
  onExportError,
  style = {}
}) => {
  const {
    isExporting,
    exportToPDF,
    exportAllSemesterToPDF
  } = usePDFOperations(programCode, semester, section);

  const [showDateModal, setShowDateModal] = useState(false);

  // Handle All Semester Export
  const handleAllSemesterExport = async () => {
    if (demoMode) {
      return;
    }

    try {
      await exportAllSemesterToPDF({
        onSuccess: onExportSuccess,
        onError: onExportError
      });
    } catch (error) {
      console.error('All semester export error:', error);
    }
  };

  // Handle Export with Date Modal
  const handleExport = async () => {
    if (demoMode) {
      return;
    }

    // Show the date modal instead of directly exporting
    setShowDateModal(true);
  };

  // Handle Export with Dates
  const handleExportWithDates = async ({ startDate, endDate }) => {
    try {
      setShowDateModal(false);
      await exportToPDF({
        startDate,
        endDate,
        onSuccess: onExportSuccess,
        onError: onExportError
      });
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  // Handle modal cancel
  const handleModalCancel = () => {
    setShowDateModal(false);
  };

  // Don't render if no program selected
  if (!programCode || !semester) {
    return null;
  }

  return (
    <Space size="small" style={style}>
      {/* Export Button - Only if allowed and section provided */}
      {allowExport && section && (
        <Button
          type="primary"
          icon={<FilePdfOutlined />}
          onClick={handleExport}
          size={size}
          loading={isExporting}
          disabled={demoMode}
          title={demoMode ? 'Not available in demo mode' : 'Export routine to PDF'}
          style={{
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '500'
          }}
        >
          Export to PDF
        </Button>
      )}

      {/* All Semester Export Button - Only if allowed */}
      {allowAllSemesterExport && (
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleAllSemesterExport}
          size={size}
          loading={isExporting}
          disabled={demoMode}
          title={demoMode ? 'Not available in demo mode' : 'Export all sections for this semester to PDF'}
          style={{
            background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '500'
          }}
        >
          Export All Sections
        </Button>
      )}

      {/* Class Date Modal */}
      <ClassDateModal
        visible={showDateModal}
        onOk={handleExportWithDates}
        onCancel={handleModalCancel}
        programCode={programCode}
        semester={semester}
        section={section}
      />
    </Space>
  );
};

export default PDFActions;
