/**
 * Excel Service - Clean Architecture for Import/Export
 * Redesigned from first principles for better maintainability
 */

import { message } from 'antd';

// Constants
const EXCEL_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ],
  ALLOWED_EXTENSIONS: ['.xlsx', '.xls']
};

const MESSAGES = {
  EXPORT: {
    LOADING: 'Generating Excel file...',
    SUCCESS: (filename) => `Routine exported successfully as ${filename}`,
    ERROR: 'Failed to export routine'
  },
  IMPORT: {
    LOADING: 'Importing Excel file...',
    SUCCESS: 'Routine imported successfully from Excel!',
    ERROR: 'Failed to import routine from Excel',
    VALIDATION: {
      FILE_TYPE: 'Please upload a valid Excel file (.xlsx or .xls)',
      FILE_SIZE: 'File must be smaller than 10MB',
      DEMO_MODE: 'Excel operations are not available in demo mode'
    }
  }
};

/**
 * File Validation Service
 */
class FileValidator {
  static validateExcelFile(file) {
    const errors = [];

    // Check file type
    const isValidType = EXCEL_CONFIG.ALLOWED_TYPES.includes(file.type) ||
                       EXCEL_CONFIG.ALLOWED_EXTENSIONS.some(ext => 
                         file.name.toLowerCase().endsWith(ext)
                       );
    
    if (!isValidType) {
      errors.push(MESSAGES.IMPORT.VALIDATION.FILE_TYPE);
    }

    // Check file size
    if (file.size > EXCEL_CONFIG.MAX_FILE_SIZE) {
      errors.push(MESSAGES.IMPORT.VALIDATION.FILE_SIZE);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Export Service
 */
class ExcelExportService {
  constructor(apiService) {
    this.apiService = apiService;
  }

  async exportRoutine(programCode, semester, section, options = {}) {
    const { onStart, onSuccess, onError } = options;
    
    try {
      onStart?.();
      message.loading(MESSAGES.EXPORT.LOADING, 0);

      const response = await this.apiService.exportRoutineToExcel(programCode, semester, section);
      
      // Create download
      const filename = this._generateFilename(programCode, semester, section);
      this._downloadFile(response, filename);

      message.destroy();
      message.success(MESSAGES.EXPORT.SUCCESS(filename));
      onSuccess?.(filename);

    } catch (error) {
      message.destroy();
      const errorMessage = error.response?.data?.message || MESSAGES.EXPORT.ERROR;
      message.error(errorMessage);
      onError?.(error);
      throw error;
    }
  }

  _generateFilename(programCode, semester, section) {
    const timestamp = new Date().toISOString().slice(0, 10);
    return `${programCode.toUpperCase()}_Sem${semester}_${section.toUpperCase()}_Routine_${timestamp}.xlsx`;
  }

  _downloadFile(response, filename) {
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
}

/**
 * Import Service - DISABLED
 * Import functionality has been removed as per requirements
 */
// class ExcelImportService {
//   constructor(apiService) {
//     this.apiService = apiService;
//   }

//   async importRoutine(programCode, semester, section, file, options = {}) {
//     throw new Error('Import functionality has been disabled');
//   }
// }

/**
 * Main Excel Service - Facade Pattern (Export Only)
 */
class ExcelService {
  constructor(apiService) {
    this.exportService = new ExcelExportService(apiService);
    // Import service removed
  }

  // Export Methods
  async export(programCode, semester, section, options = {}) {
    return this.exportService.exportRoutine(programCode, semester, section, options);
  }

  // Import Methods (disabled)
  async import(programCode, semester, section, file, options = {}) {
    throw new Error('Import functionality has been disabled');
  }

  // Validation Methods
  validateFile(file) {
    return FileValidator.validateExcelFile(file);
  }

  // Utility Methods
  generateTemplateFilename(programCode, semester, section) {
    return `${programCode.toUpperCase()}_Sem${semester}_${section.toUpperCase()}_Template.xlsx`;
  }

  isValidExcelFile(file) {
    return FileValidator.validateExcelFile(file).isValid;
  }
}

export default ExcelService;
