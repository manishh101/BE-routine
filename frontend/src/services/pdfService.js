/**
 * PDF Service - Clean Architecture for PDF Export
 * Replaces Excel export functionality with PDF export
 */

import { message } from 'antd';
import { routinesAPI, teachersAPI, roomsAPI } from './api';

// We'll need to get semesterGroup from caller since this is a service
// Services shouldn't directly use React context

// Constants
const PDF_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB (PDFs can be larger)
  ALLOWED_TYPES: [
    'application/pdf'
  ],
  ALLOWED_EXTENSIONS: ['.pdf']
};

const MESSAGES = {
  EXPORT: {
    LOADING: 'Generating PDF file...',
    SUCCESS: (filename) => `Schedule exported successfully as ${filename}`,
    ERROR: 'Failed to export schedule to PDF'
  },
  TEACHER: {
    LOADING: 'Generating teacher schedule PDF...',
    SUCCESS: (filename) => `Teacher schedule exported successfully as ${filename}`,
    ERROR: 'Failed to export teacher schedule'
  },
  ROOM: {
    LOADING: 'Generating room schedule PDF...',
    SUCCESS: (filename) => `Room schedule exported successfully as ${filename}`,
    ERROR: 'Failed to export room schedule'
  },
  ALL_TEACHERS: {
    LOADING: 'Generating all teachers schedules PDF...',
    SUCCESS: (filename) => `All teachers schedules exported successfully as ${filename}`,
    ERROR: 'Failed to export all teachers schedules'
  },
  ALL_ROOMS: {
    LOADING: 'Generating all room schedules PDF...',
    SUCCESS: (filename) => `All room schedules exported successfully as ${filename}`,
    ERROR: 'Failed to export all room schedules'
  }
};

/**
 * PDF Export Service for Routines
 */
class PDFExportService {
  async exportRoutine(programCode, semester, section, options = {}) {
    const { onStart, onSuccess, onError, startDate, endDate } = options;
    
    try {
      onStart?.();
      message.loading(MESSAGES.EXPORT.LOADING, 0);

      const response = await routinesAPI.exportRoutineToPDF(programCode, semester, section, { startDate, endDate });
      
      // Create download
      const filename = this._generateRoutineFilename(programCode, semester, section);
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

  async exportAllSemesterRoutines(programCode, semester, options = {}) {
    const { onStart, onSuccess, onError } = options;
    
    try {
      onStart?.();
      message.loading('Generating combined semester PDF...', 0);

      const response = await routinesAPI.exportAllSemesterRoutinesToPDF(programCode, semester);
      
      // Create download
      const filename = this._generateAllSemesterFilename(programCode, semester);
      this._downloadFile(response, filename);

      message.destroy();
      message.success(`All sections for ${programCode} Semester ${semester} exported successfully as ${filename}`);
      onSuccess?.(filename);

    } catch (error) {
      message.destroy();
      const errorMessage = error.response?.data?.message || 'Failed to export all semester routines';
      message.error(errorMessage);
      onError?.(error);
      throw error;
    }
  }

  _generateRoutineFilename(programCode, semester, section) {
    const timestamp = new Date().toISOString().slice(0, 10);
    return `${programCode.toUpperCase()}_Sem${semester}_${section.toUpperCase()}_Routine_${timestamp}.pdf`;
  }

  _generateAllSemesterFilename(programCode, semester) {
    const timestamp = new Date().toISOString().slice(0, 10);
    return `${programCode.toUpperCase()}_Sem${semester}_All_Sections_Routine_${timestamp}.pdf`;
  }

  _downloadFile(response, filename) {
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
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
 * PDF Export Service for Teachers
 */
class TeacherPDFExportService {
  async exportTeacherSchedule(teacherId, options = {}) {
    const { teacherName, semesterGroup = 'all', onStart, onSuccess, onError } = options;
    
    try {
      onStart?.();
      message.loading(MESSAGES.TEACHER.LOADING, 0);

      const response = await teachersAPI.exportTeacherScheduleToPDF(teacherId, semesterGroup);
      
      // Create download
      const filename = this._generateTeacherFilename(teacherName || 'Teacher');
      this._downloadFile(response, filename);

      message.destroy();
      message.success(MESSAGES.TEACHER.SUCCESS(filename));
      onSuccess?.(filename);

    } catch (error) {
      message.destroy();
      const errorMessage = error.response?.data?.message || MESSAGES.TEACHER.ERROR;
      message.error(errorMessage);
      onError?.(error);
      throw error;
    }
  }

  async exportAllTeachersSchedules(options = {}) {
    const { semesterGroup = 'all', onStart, onSuccess, onError, onProgress } = options;
    
    try {
      onStart?.();
      message.loading(MESSAGES.ALL_TEACHERS.LOADING, 0);

      const response = await teachersAPI.exportAllTeachersSchedulesToPDF(semesterGroup);
      
      // Create download
      const filename = this._generateAllTeachersFilename();
      this._downloadFile(response, filename);

      message.destroy();
      message.success(MESSAGES.ALL_TEACHERS.SUCCESS(filename));
      onSuccess?.(filename);

    } catch (error) {
      message.destroy();
      const errorMessage = error.response?.data?.message || MESSAGES.ALL_TEACHERS.ERROR;
      message.error(errorMessage);
      onError?.(error);
      throw error;
    }
  }

  _generateTeacherFilename(teacherName) {
    const timestamp = new Date().toISOString().slice(0, 10);
    const safeName = teacherName.replace(/[^a-zA-Z0-9]/g, '_');
    return `${safeName}_Schedule_${timestamp}.pdf`;
  }

  _generateAllTeachersFilename() {
    const timestamp = new Date().toISOString().slice(0, 10);
    return `All_Teachers_Schedules_${timestamp}.pdf`;
  }

  _downloadFile(response, filename) {
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
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
 * PDF Export Service for Rooms
 */
class RoomPDFExportService {
  async exportRoomSchedule(roomId, options = {}) {
    const { roomName, semesterGroup = 'all', onStart, onSuccess, onError } = options;
    
    try {
      onStart?.();
      message.loading(MESSAGES.ROOM.LOADING, 0);

      const response = await roomsAPI.exportRoomScheduleToPDF(roomId, semesterGroup);
      
      // Create download
      const filename = this._generateRoomFilename(roomName || 'Room');
      this._downloadFile(response, filename);

      message.destroy();
      message.success(MESSAGES.ROOM.SUCCESS(filename));
      onSuccess?.(filename);

    } catch (error) {
      message.destroy();
      const errorMessage = error.response?.data?.message || MESSAGES.ROOM.ERROR;
      message.error(errorMessage);
      onError?.(error);
      throw error;
    }
  }

  async exportAllRoomsSchedules(options = {}) {
    const { semesterGroup = 'all', onStart, onSuccess, onError } = options;
    
    try {
      onStart?.();
      message.loading(MESSAGES.ALL_ROOMS.LOADING, 0);

      const response = await roomsAPI.exportAllRoomSchedulesToPDF(semesterGroup);
      
      // Create download
      const filename = this._generateAllRoomsFilename();
      this._downloadFile(response, filename);

      message.destroy();
      message.success(MESSAGES.ALL_ROOMS.SUCCESS(filename));
      onSuccess?.(filename);

    } catch (error) {
      message.destroy();
      const errorMessage = error.response?.data?.message || MESSAGES.ALL_ROOMS.ERROR;
      message.error(errorMessage);
      onError?.(error);
      throw error;
    }
  }

  // Utility methods for room exports
  _generateRoomFilename(roomName) {
    const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
    const safeName = roomName.replace(/[^a-zA-Z0-9]/g, '_');
    return `Room_${safeName}_Schedule_${timestamp}.pdf`;
  }

  _generateAllRoomsFilename() {
    const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
    return `All_Rooms_Schedules_${timestamp}.pdf`;
  }

  _downloadFile(response, filename) {
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}

/**
 * Main PDF Service - Facade Pattern (Export Only)
 * Replaces ExcelService for PDF operations
 */
class PDFService {
  constructor() {
    this.exportService = new PDFExportService();
    this.teacherService = new TeacherPDFExportService();
    this.roomService = new RoomPDFExportService();
  }

  // Routine Export Methods
  async export(programCode, semester, section, options = {}) {
    return this.exportService.exportRoutine(programCode, semester, section, options);
  }

  async exportRoutine(programCode, semester, section, options = {}) {
    return this.exportService.exportRoutine(programCode, semester, section, options);
  }

  async exportAllSemesterRoutines(programCode, semester, options = {}) {
    return this.exportService.exportAllSemesterRoutines(programCode, semester, options);
  }

  // Teacher Export Methods
  async exportTeacherSchedule(teacherId, options = {}) {
    return this.teacherService.exportTeacherSchedule(teacherId, options);
  }

  async exportAllTeachersSchedules(options = {}) {
    return this.teacherService.exportAllTeachersSchedules(options);
  }

  // Room Export Methods
  async exportRoomSchedule(roomId, options = {}) {
    return this.roomService.exportRoomSchedule(roomId, options);
  }

  async exportAllRoomSchedules(options = {}) {
    return this.roomService.exportAllRoomSchedules(options);
  }

  // Utility Methods
  generateTemplateFilename(programCode, semester, section) {
    return `${programCode.toUpperCase()}_Sem${semester}_${section.toUpperCase()}_Template.pdf`;
  }

  // Validation Methods (for consistency with Excel service interface)
  validateFile(file) {
    const errors = [];
    
    // Check file type
    const isValidType = PDF_CONFIG.ALLOWED_TYPES.includes(file.type) ||
                       PDF_CONFIG.ALLOWED_EXTENSIONS.some(ext => 
                         file.name.toLowerCase().endsWith(ext)
                       );
    
    if (!isValidType) {
      errors.push('Please select a valid PDF file');
    }

    // Check file size
    if (file.size > PDF_CONFIG.MAX_FILE_SIZE) {
      errors.push('File must be smaller than 50MB');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  isValidPDFFile(file) {
    return this.validateFile(file).isValid;
  }
}

export default PDFService;
