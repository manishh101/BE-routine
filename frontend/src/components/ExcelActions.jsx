/**
 * Excel Actions Component - Clean UI for Import/Export
 * Reusable component following clean architecture principles
 */

import React from 'react';
import { Button, Space, Upload } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import useExcelOperations from '../hooks/useExcelOperations';

const ExcelActions = ({ 
  programCode, 
  semester, 
  section,
  allowImport = false,
  allowExport = true,
  demoMode = false,
  size = 'small',
  onImportSuccess,
  onImportError,
  onExportSuccess,
  onExportError,
  style = {}
}) => {
  const {
    isExporting,
    isImporting,
    exportToExcel,
    importFromExcel,
    validateFile
  } = useExcelOperations(programCode, semester, section);

  // Handle Export
  const handleExport = async () => {
    if (demoMode) {
      return;
    }

    try {
      await exportToExcel({
        onSuccess: onExportSuccess,
        onError: onExportError
      });
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  // Handle Import
  const handleImport = async (file) => {
    if (demoMode) {
      return false;
    }

    // Validate file first
    const validation = validateFile(file);
    if (!validation.isValid) {
      return false;
    }

    try {
      await importFromExcel(file, {
        onSuccess: onImportSuccess,
        onError: onImportError
      });
    } catch (error) {
      console.error('Import error:', error);
    }

    return false; // Prevent default upload behavior
  };

  // Don't render if no program selected
  if (!programCode || !semester || !section) {
    return null;
  }

  return (
    <Space size="small" style={style}>
      {/* Import Button - Only if allowed */}
      {allowImport && (
        <Upload
          accept=".xlsx,.xls"
          beforeUpload={handleImport}
          showUploadList={false}
          disabled={isImporting || demoMode}
        >
          <Button
            type="default"
            icon={<UploadOutlined />}
            size={size}
            loading={isImporting}
            disabled={demoMode}
            title={demoMode ? 'Not available in demo mode' : 'Import routine from Excel'}
          >
            Import from Excel
          </Button>
        </Upload>
      )}

      {/* Export Button - Only if allowed */}
      {allowExport && (
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleExport}
          size={size}
          loading={isExporting}
          disabled={demoMode}
          title={demoMode ? 'Not available in demo mode' : 'Export routine to Excel'}
        >
          Export to Excel
        </Button>
      )}
    </Space>
  );
};

export default ExcelActions;
