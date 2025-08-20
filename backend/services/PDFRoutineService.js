const UnifiedPDFService = require('./UnifiedPDFService');

/**
 * PDFRoutineService - Unified PDF service wrapper
 * 
 * This service has been completely refactored to:
 * 1. Fix the critical time slot mapping bug (slotIndex -> TimeSlot._id instead of array index)
 * 2. Consolidate all PDF generation logic into a single service
 * 3. Remove code duplication across multiple PDF services
 * 4. Provide consistent PDF output for all types (class, teacher, room)
 */
class PDFRoutineService {
  constructor() {
    this.unifiedService = new UnifiedPDFService();
  }

  /**
   * Generate PDF for class schedule (program/semester/section)
   * FIXED: Now uses correct time slot mapping
   */
  async generateClassSchedulePDF(programCode, semester, section, options = {}) {
    return await this.unifiedService.generateClassSchedulePDF(programCode, semester, section, options);
  }

  /**
   * Generate PDF for teacher schedule
   * FIXED: Now uses correct time slot mapping
   */
  async generateTeacherSchedulePDF(teacherId, teacherName, semesterFilter = 'all', options = {}) {
    return await this.unifiedService.generateTeacherSchedulePDF(teacherId, teacherName, semesterFilter, options);
  }

  /**
   * Generate PDF for room schedule
   * FIXED: Now uses correct time slot mapping
   */
  async generateRoomSchedulePDF(roomId, roomName, semesterFilter = 'all', options = {}) {
    return await this.unifiedService.generateRoomSchedulePDF(roomId, roomName, semesterFilter, options);
  }

  /**
   * Generate combined PDF for all sections in a semester
   * FIXED: Now uses correct time slot mapping
   */
  async generateAllSemesterSchedulesPDF(programCode, semester) {
    return await this.unifiedService.generateAllSemesterSchedulesPDF(programCode, semester);
  }

  /**
   * Generate combined PDF for all teachers schedules
   * FIXED: Now uses correct time slot mapping
   */
  async generateAllTeachersSchedulesPDF(semesterGroup = 'all') {
    return await this.unifiedService.generateAllTeachersSchedulesPDF(semesterGroup);
  }

  /**
   * Generate combined PDF for all rooms schedules
   * FIXED: Now uses correct time slot mapping
   */
  async generateAllRoomsSchedulePDF(semesterGroup = 'all') {
    return await this.unifiedService.generateAllRoomsSchedulePDF(semesterGroup);
  }
}

module.exports = PDFRoutineService;
