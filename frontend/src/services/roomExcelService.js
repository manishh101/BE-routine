/**
 * Room Excel Service - Clean Architecture for Room Schedule Export
 * Following the same pattern as teacher excel service
 */

import { message } from 'antd';
import { roomsAPI } from './api';

// Constants for Room Excel Operations
const ROOM_EXCEL_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
};

const ROOM_MESSAGES = {
  EXPORT: {
    INDIVIDUAL: {
      LOADING: 'Generating room schedule...',
      SUCCESS: (filename) => `Room schedule exported successfully as ${filename}`,
      ERROR: 'Failed to export room schedule'
    },
    ALL: {
      LOADING: 'Generating all room schedules...',
      SUCCESS: (filename) => `All room schedules exported successfully as ${filename}`,
      ERROR: 'Failed to export all room schedules'
    }
  }
};

/**
 * Room Excel Export Service
 */
class RoomExcelExportService {
  constructor(apiService) {
    this.apiService = apiService;
  }

  async exportRoomSchedule(roomId, options = {}) {
    const { roomName, onStart, onSuccess, onError } = options;
    
    try {
      onStart?.();
      message.loading(ROOM_MESSAGES.EXPORT.INDIVIDUAL.LOADING, 0);

      const response = await this.apiService.exportRoomSchedule(roomId);
      
      // Create download
      const filename = this._generateRoomFilename(roomName || 'Room');
      this._downloadFile(response, filename);

      message.destroy();
      message.success(ROOM_MESSAGES.EXPORT.INDIVIDUAL.SUCCESS(filename));
      onSuccess?.(filename);

    } catch (error) {
      message.destroy();
      const errorMessage = error.response?.data?.message || ROOM_MESSAGES.EXPORT.INDIVIDUAL.ERROR;
      message.error(errorMessage);
      onError?.(error);
      throw error;
    }
  }

  async exportAllRoomSchedules(options = {}) {
    const { onStart, onSuccess, onError } = options;
    
    try {
      onStart?.();
      message.loading(ROOM_MESSAGES.EXPORT.ALL.LOADING, 0);

      const response = await this.apiService.exportAllRoomSchedules();
      
      // Create download
      const filename = this._generateAllRoomsFilename();
      this._downloadFile(response, filename);

      message.destroy();
      message.success(ROOM_MESSAGES.EXPORT.ALL.SUCCESS(filename));
      onSuccess?.(filename);

    } catch (error) {
      message.destroy();
      const errorMessage = error.response?.data?.message || ROOM_MESSAGES.EXPORT.ALL.ERROR;
      message.error(errorMessage);
      onError?.(error);
      throw error;
    }
  }

  _generateRoomFilename(roomName) {
    const timestamp = new Date().toISOString().slice(0, 10);
    const safeName = roomName.replace(/[^a-zA-Z0-9]/g, '_');
    return `${safeName}_Schedule_${timestamp}.xlsx`;
  }

  _generateAllRoomsFilename() {
    const timestamp = new Date().toISOString().slice(0, 10);
    return `All_Rooms_Schedules_${timestamp}.xlsx`;
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

// Export service instance
export const roomExcelService = new RoomExcelExportService(roomsAPI);

// Export service class for custom instances
export default RoomExcelExportService;
