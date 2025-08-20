/**
 * Excel Service - Placeholder
 * This is a stub implementation that provides minimal functionality
 * to keep the UI working without Excel dependencies
 */

class ExcelService {
  constructor(routinesAPI) {
    // Stub constructor
  }

  // Export method (stub)
  async export(programCode, semester, section, callbacks = {}) {
    callbacks.onError?.({ message: 'Excel export functionality has been disabled.' });
    return false;
  }

  // File validation (stub)
  validateFile(file) {
    return false;
  }

  // Check if file is valid Excel (stub)
  isValidExcelFile(file) {
    return false;
  }
}

export default ExcelService;
