/**
 * Room Excel Service - Placeholder
 * This is a stub implementation that provides minimal functionality
 * to keep the UI working without Excel dependencies
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
 * Room Excel Export Service (Stub)
 */
class RoomExcelExportService {
  constructor(apiService) {
    this.apiService = apiService;
  }

  async exportRoomSchedule(roomId, options = {}) {
    const { roomName, onStart, onSuccess, onError } = options;
    
    try {
      onError?.({ message: 'Excel export functionality has been disabled.' });
      return false;
    } catch (error) {
      onError?.(error);
      return false;
    }
  }

  async exportAllRoomSchedules(options = {}) {
    const { onStart, onSuccess, onError, onProgress } = options;
    
    try {
      onError?.({ message: 'Excel export functionality has been disabled.' });
      return false;
    } catch (error) {
      onError?.(error);
      return false;
    }
  }

  _generateRoomFilename(roomName) {
    return `Room_${roomName?.replace(/\s+/g, '_') || 'Unknown'}_Schedule.xlsx`;
  }

  _generateAllRoomsFilename() {
    return `All_Rooms_Schedules.xlsx`;
  }

  _downloadFile(response, filename) {
    // Stub implementation
    return false;
  }
}

export default RoomExcelExportService;
