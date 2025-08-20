/**
 * Teacher Excel Service - Placeholder
 * This is a stub implementation that provides minimal functionality
 * to keep the UI working without Excel dependencies
 */

class TeacherExcelService {
  constructor(teachersAPI) {
    // Stub constructor
  }

  // Export teacher schedule (stub)
  async exportTeacherSchedule(teacherId, callbacks = {}) {
    callbacks.onError?.({ message: 'Excel export functionality has been disabled.' });
    return false;
  }

  // Export all teachers schedules (stub)
  async exportAllTeachersSchedules(callbacks = {}) {
    callbacks.onError?.({ message: 'Excel export functionality has been disabled.' });
    return false;
  }
}

export default TeacherExcelService;
