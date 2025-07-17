/**
 * Teacher Excel Service - Clean Architecture for Teacher Export
 * Shows how teacher functionality could follow the same pattern as routine export
 */

import { message } from 'antd';

// Constants for Teacher Excel Operations
const TEACHER_EXCEL_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
};

const TEACHER_MESSAGES = {
  EXPORT: {
    INDIVIDUAL: {
      LOADING: 'Generating teacher schedule...',
      SUCCESS: (filename) => `Teacher schedule exported successfully as ${filename}`,
      ERROR: 'Failed to export teacher schedule'
    },
    ALL: {
      LOADING: 'Generating all teachers schedules...',
      SUCCESS: (filename) => `All teachers schedules exported successfully as ${filename}`,
      ERROR: 'Failed to export all teachers schedules'
    }
  }
};

/**
 * Teacher Excel Export Service
 */
class TeacherExcelExportService {
  constructor(apiService) {
    this.apiService = apiService;
  }

  async exportTeacherSchedule(teacherId, options = {}) {
    const { teacherName, onStart, onSuccess, onError } = options;
    
    try {
      onStart?.();
      message.loading(TEACHER_MESSAGES.EXPORT.INDIVIDUAL.LOADING, 0);

      const response = await this.apiService.exportTeacherScheduleToExcel(teacherId);
      
      // Create download
      const filename = this._generateTeacherFilename(teacherName || 'Teacher');
      this._downloadFile(response, filename);

      message.destroy();
      message.success(TEACHER_MESSAGES.EXPORT.INDIVIDUAL.SUCCESS(filename));
      onSuccess?.(filename);

    } catch (error) {
      message.destroy();
      const errorMessage = error.response?.data?.message || TEACHER_MESSAGES.EXPORT.INDIVIDUAL.ERROR;
      message.error(errorMessage);
      onError?.(error);
      throw error;
    }
  }

  async exportAllTeachersSchedules(options = {}) {
    const { onStart, onSuccess, onError, onProgress } = options;
    
    try {
      onStart?.();
      message.loading(TEACHER_MESSAGES.EXPORT.ALL.LOADING, 0);

      const response = await this.apiService.exportAllTeachersSchedulesToExcel();
      
      // Create download
      const filename = this._generateAllTeachersFilename();
      this._downloadFile(response, filename);

      message.destroy();
      message.success(TEACHER_MESSAGES.EXPORT.ALL.SUCCESS(filename));
      onSuccess?.(filename);

    } catch (error) {
      message.destroy();
      const errorMessage = error.response?.data?.message || TEACHER_MESSAGES.EXPORT.ALL.ERROR;
      message.error(errorMessage);
      onError?.(error);
      throw error;
    }
  }

  _generateTeacherFilename(teacherName) {
    const timestamp = new Date().toISOString().slice(0, 10);
    const safeName = teacherName.replace(/[^a-zA-Z0-9]/g, '_');
    return `${safeName}_Schedule_${timestamp}.xlsx`;
  }

  _generateAllTeachersFilename() {
    const timestamp = new Date().toISOString().slice(0, 10);
    return `All_Teachers_Schedules_${timestamp}.xlsx`;
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
 * Main Teacher Excel Service - Facade Pattern
 */
class TeacherExcelService {
  constructor(apiService) {
    this.exportService = new TeacherExcelExportService(apiService);
  }

  // Export Methods
  async exportTeacherSchedule(teacherId, options = {}) {
    return this.exportService.exportTeacherSchedule(teacherId, options);
  }

  async exportAllTeachersSchedules(options = {}) {
    return this.exportService.exportAllTeachersSchedules(options);
  }

  // Utility Methods
  generateTeacherFilename(teacherName) {
    return this.exportService._generateTeacherFilename(teacherName);
  }

  generateAllTeachersFilename() {
    return this.exportService._generateAllTeachersFilename();
  }
}

export default TeacherExcelService;
