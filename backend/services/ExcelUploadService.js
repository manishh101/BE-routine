/**
 * 🚀 Excel Data Upload Service - STUB VERSION
 * This is a stub implementation that maintains the API but removes Excel dependencies
 */

// Import all models
const Department = require('../models/Department');
const Program = require('../models/Program');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Room = require('../models/Room');
const TimeSlot = require('../models/TimeSlot');
const RoutineSlot = require('../models/RoutineSlot');
const AcademicSession = require('../models/AcademicSession');
const LabGroup = require('../models/LabGroup');
const ElectiveGroup = require('../models/ElectiveGroup');

class ExcelUploadService {
  constructor() {
    this.uploadResults = {
      success: 0,
      failed: 0,
      errors: [],
      created: [],
      skipped: []
    };
  }

  /**
   * Main upload handler - STUB
   */
  async uploadFromExcel(filePath, dataType, options = {}) {
    try {
      console.log(`📁 Excel Upload functionality has been disabled.`);
      
      // Reset results
      this.resetResults();
      
      // Add error message
      this.addError({
        message: 'Excel upload functionality has been disabled',
        details: 'This feature is no longer available'
      });
      
      return this.getResults();
    } catch (error) {
      console.error(`❌ Error in Excel upload handler:`, error);
      this.addError({
        message: 'Excel upload functionality has been disabled',
        details: error.message
      });
      return this.getResults();
    }
  }

  /**
   * Reset upload results
   */
  resetResults() {
    this.uploadResults = {
      success: 0,
      failed: 0,
      errors: [],
      created: [],
      skipped: []
    };
  }

  /**
   * Add error to results
   */
  addError(error) {
    this.uploadResults.errors.push(error);
    this.uploadResults.failed++;
  }

  /**
   * Get upload results
   */
  getResults() {
    return this.uploadResults;
  }

  // Stub methods for all previous functionality
  async processRoutineUpload() {
    this.addError({
      message: 'Excel upload functionality has been disabled',
      details: 'This feature is no longer available'
    });
    return this.getResults();
  }
  
  async processSubjectsUpload() {
    this.addError({
      message: 'Excel upload functionality has been disabled',
      details: 'This feature is no longer available'
    });
    return this.getResults();
  }
  
  async processTeachersUpload() {
    this.addError({
      message: 'Excel upload functionality has been disabled',
      details: 'This feature is no longer available'
    });
    return this.getResults();
  }
  
  async processRoomsUpload() {
    this.addError({
      message: 'Excel upload functionality has been disabled',
      details: 'This feature is no longer available'
    });
    return this.getResults();
  }
  
  async processLabGroupsUpload() {
    this.addError({
      message: 'Excel upload functionality has been disabled',
      details: 'This feature is no longer available'
    });
    return this.getResults();
  }
  
  async processElectiveGroupsUpload() {
    this.addError({
      message: 'Excel upload functionality has been disabled',
      details: 'This feature is no longer available'
    });
    return this.getResults();
  }
}

module.exports = ExcelUploadService;
