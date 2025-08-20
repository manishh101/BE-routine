const { PDFGenerationService } = require('./pdfGeneration');
const { processRoutineSlots, processMultiGroupClasses } = require('./routineDataProcessor');

/**
 * Teacher PDF Generator - Extends base PDF service for teacher-specific functionality
 * Generates PDF schedules showing teacher's weekly routine with identical layout to class routines
 */
class TeacherPDFGenerator extends PDFGenerationService {
  constructor() {
    super();
    // Lazy load models to avoid database connection issues during module loading
    this._RoutineSlot = null;
    this._TimeSlotDefinition = null;
    this._Teacher = null;
  }

  // Lazy loading getters for models
  get RoutineSlot() {
    if (!this._RoutineSlot) {
      this._RoutineSlot = require('../models/RoutineSlot');
    }
    return this._RoutineSlot;
  }

  get TimeSlotDefinition() {
    if (!this._TimeSlotDefinition) {
      this._TimeSlotDefinition = require('../models/TimeSlot');
    }
    return this._TimeSlotDefinition;
  }

  get Teacher() {
    if (!this._Teacher) {
      this._Teacher = require('../models/Teacher');
    }
    return this._Teacher;
  }

  /**
   * Get all time slots (global + context-specific) for teacher view
   * Teachers show all time slots across all programs/semesters/sections
   */
  async getGlobalTimeSlots() {
    try {
      // For teacher view, we want to see ALL time slots to get complete picture
      // This includes both global and context-specific time slots
      const timeSlots = await this.TimeSlotDefinition.find().sort({ sortOrder: 1, startTime: 1 });
      
      console.log(`👨‍🏫 Teacher PDF: Found ${timeSlots.length} total time slots (global + context-specific)`);
      
      return timeSlots;
      
    } catch (error) {
      console.error('❌ Error fetching time slots for teacher PDF:', error);
      // Fallback to basic global time slots
      return await this.TimeSlotDefinition.find({ 
        $or: [
          { isGlobal: true },
          { isGlobal: { $exists: false } },
          { isGlobal: null }
        ]
      }).sort({ sortOrder: 1, startTime: 1 });
    }
  }

  /**
   * Generate PDF file for teacher schedule - STANDARDIZED METHOD PATTERN
   * @param {Object} teacher - Teacher object with _id, fullName, etc.
   * @param {Object} options - Additional options (scheduleData, academicYear, etc.)
   * @returns {Buffer} - PDF file buffer
   */
  async generateTeacherRoutinePDF(teacher, options = {}) {
    try {
      console.log(`👨‍🏫 Generating teacher routine PDF for: ${teacher.fullName}`);

      const doc = this.createDocument();

      // Check if pre-processed schedule data is provided (from frontend-matching API)
      let processedRoutine, timeSlots;
      
      if (options.scheduleData && options.scheduleData.routine) {
        console.log('🔄 Using pre-processed schedule data (frontend-compatible)');
        
        // Use the provided schedule data (same as frontend)
        const scheduleData = options.scheduleData;
        
        // Get time slots for headers - ROBUST SORTING (same as always)
        timeSlots = await this.TimeSlotDefinition.find().sort({ sortOrder: 1, _id: 1 });
        
        if (timeSlots.length === 0 || timeSlots.some(slot => slot.sortOrder == null)) {
          console.warn('⚠️  TimeSlots missing sortOrder, falling back to startTime sorting');
          timeSlots = await this.TimeSlotDefinition.find().sort({ startTime: 1 });
        }
        
        // Convert the frontend schedule format to our processed format
        processedRoutine = this.convertFrontendScheduleToProcessed(scheduleData.routine);
        
        console.log('📊 Frontend schedule data received:', JSON.stringify(scheduleData.routine, null, 2));
        console.log('🔄 Converted processed routine:', JSON.stringify(processedRoutine, null, 2));
        
        console.log('📊 Using frontend-compatible data with', Object.keys(processedRoutine).length, 'days');
        
      } else {
        console.log('🔄 Fetching data independently (legacy mode)');
        
        // Legacy mode: fetch data independently (same as before)
        // Get time slots using global logic (teachers can see all time slots)
        timeSlots = await this.getGlobalTimeSlots();
        
        console.log('📅 Teacher PDF Time Slots (global):', timeSlots.map((slot, idx) => ({ 
          idx, 
          id: slot._id, 
          time: `${slot.startTime}-${slot.endTime}`,
          sortOrder: slot.sortOrder,
          isBreak: slot.isBreak,
          isGlobal: slot.isGlobal,
          context: slot.isGlobal ? 'Global' : `${slot.programCode} ${slot.semester} ${slot.section}`
        })));
        
        // Get routine slots with enhanced population - SAME AS CLASS ROUTINE
        const routineSlots = await this.RoutineSlot.find({
          teacherIds: teacher._id,
          isActive: true
        })
          .populate('subjectId', 'name code')
          .populate('subjectIds', 'name code') // Populate multiple subjects for electives
          .populate('teacherIds', 'fullName shortName')
          .populate('roomId', 'name')
          .sort({ dayIndex: 1, slotIndex: 1 });

        console.log(`📊 Found ${routineSlots.length} routine slots for teacher ${teacher.fullName}`);

        // Process routine data using shared logic - ENSURES CONSISTENCY WITH CLASS ROUTINE
        const routineData = processRoutineSlots(routineSlots, { viewMode: 'teacher' });
        processedRoutine = processMultiGroupClasses(routineData);

        console.log('🔄 Processed teacher routine data:', Object.keys(processedRoutine).length, 'days');
      }

      // Add header
      const startY = this.addHeader(doc, {
        title: `${teacher.fullName} - Weekly Teaching Schedule`,
        subtitle: `Faculty Schedule${teacher.department ? ` - ${teacher.department}` : ''}`,
        institutionName: 'IOE Pulchowk Campus',
        academicYear: options.academicYear || new Date().getFullYear()
      });

      // Create routine grid using processed data (base class method ensures consistency)
      const routineGrid = this.createRoutineGridFromProcessedData(processedRoutine, timeSlots);
      
      console.log('🗂️ Generated routine grid:', JSON.stringify(routineGrid, null, 2));
      console.log('🕐 Time slots structure:', timeSlots.map((slot, idx) => ({ 
        idx, 
        id: slot._id, 
        time: `${slot.startTime}-${slot.endTime}` 
      })));

      // Calculate table dimensions
      const dimensions = this.calculateTableDimensions(timeSlots, {
        width: doc.page.width,
        height: doc.page.height,
        margins: doc.options.margins
      });

      // Draw table structure
      this.drawTableStructure(doc, dimensions, timeSlots, startY);

      // Fill cells with class data using base class method (ensures consistency)
      this.fillRoutineData(doc, routineGrid, timeSlots, dimensions, startY);

      // Add footer
      this.addTeacherFooter(doc, teacher);

      // Finalize the PDF
      doc.end();

      console.log(`✅ Teacher routine PDF generated successfully for ${teacher.fullName}`);
      return this.documentToBuffer(doc);

    } catch (error) {
      console.error('Error generating teacher routine PDF:', error);
      throw error;
    }
  }

    /**
   * Convert frontend schedule format to processed routine format
   * This ensures the PDF uses the same data structure as the frontend display
   * MATCHES THE EXACT PATTERN FROM CLASS ROUTINE GENERATOR
   */
  convertFrontendScheduleToProcessed(frontendRoutine) {
    console.log('🔄 Converting frontend routine to processed format for PDF...');
    const processedRoutine = {};
    
    // Convert each day - EXACT SAME PATTERN AS CLASS ROUTINE
    Object.keys(frontendRoutine).forEach(dayIndex => {
      const dayData = frontendRoutine[dayIndex];
      processedRoutine[dayIndex] = {};
      
      // Convert each slot - EXACT SAME PATTERN AS CLASS ROUTINE
      Object.keys(dayData).forEach(slotIndex => {
        const slotData = dayData[slotIndex];
        
        if (slotData) {
          // Convert frontend slot data to processed format with teacher view flags
          if (Array.isArray(slotData)) {
            // Multiple classes in same slot - EXACT SAME PATTERN AS CLASS ROUTINE
            processedRoutine[dayIndex][slotIndex] = {
              isMultiGroup: true,
              groups: slotData.map(slot => ({
                ...slot,
                hideTeacher: true, // Teacher view specific
                programSemesterSection: slot.programSemesterSection || `${slot.programCode} Sem${slot.semester} ${slot.section}`
              })),
              hideTeacher: true
            };
          } else {
            // Single class - EXACT SAME PATTERN AS CLASS ROUTINE
            processedRoutine[dayIndex][slotIndex] = {
              ...slotData,
              hideTeacher: true, // Teacher view specific
              programSemesterSection: slotData.programSemesterSection || `${slotData.programCode} Sem${slotData.semester} ${slotData.section}`
            };
          }
        }
      });
    });
    
    console.log(`✅ Converted ${Object.keys(processedRoutine).length} days`);
    return processedRoutine;
  }

  /**
   * Backward compatibility method - delegates to standardized method
   * @deprecated Use generateTeacherRoutinePDF instead
   */
  async generateTeacherSchedulePDF(teacher, options = {}) {
    console.warn('⚠️  generateTeacherSchedulePDF is deprecated, use generateTeacherRoutinePDF instead');
    return this.generateTeacherRoutinePDF(teacher, options);
  }

  /**
   * Generate batch PDF for all teachers
   * @param {Object} options - Options for batch generation
   * @returns {Buffer} - Combined PDF buffer
   */
  async generateAllTeachersScheduleBatch(options = {}) {
    try {
      console.log('📋 Generating batch PDF for all teachers...');

      // Get all active teachers
      const teachers = await this.Teacher.find({ isActive: { $ne: false } })
        .sort({ fullName: 1 });

      if (teachers.length === 0) {
        throw new Error('No active teachers found');
      }

      console.log(`👥 Found ${teachers.length} active teachers for batch PDF generation`);

      const doc = this.createDocument();
      let isFirstPage = true;

      // Get time slots once for all teachers
      let timeSlots = await this.TimeSlotDefinition.find().sort({ sortOrder: 1, _id: 1 });
      
      if (timeSlots.length === 0 || timeSlots.some(slot => slot.sortOrder == null)) {
        console.warn('⚠️  TimeSlots missing sortOrder, falling back to startTime sorting');
        timeSlots = await this.TimeSlotDefinition.find().sort({ startTime: 1 });
      }

      for (const teacher of teachers) {
        try {
          console.log(`📄 Processing teacher: ${teacher.fullName}`);

          // Add new page for each teacher (except the first one)
          if (!isFirstPage) {
            doc.addPage();
          }
          isFirstPage = false;

          // Get routine slots for this teacher
          const routineSlots = await this.RoutineSlot.find({
            teacherIds: teacher._id,
            isActive: true
          })
            .populate('subjectId', 'name code')
            .populate('subjectIds', 'name code')
            .populate('teacherIds', 'fullName shortName')
            .populate('roomId', 'name')
            .populate('programId', 'code name')
            .sort({ dayIndex: 1, slotIndex: 1 });

          // Process routine data with teacher view mode
          const routineData = processRoutineSlots(routineSlots, { viewMode: 'teacher' });
          const processedRoutine = processMultiGroupClasses(routineData);

          // Add teacher-specific header
          const startY = this.addHeader(doc, {
            title: `${teacher.fullName} - Weekly Schedule`,
            subtitle: `Teacher ID: ${teacher.shortName || teacher._id}`,
            institutionName: 'IOE Pulchowk Campus',
            academicYear: options.academicYear || new Date().getFullYear()
          });

          // Create and render routine grid
          const routineGrid = this.createRoutineGridFromProcessedData(processedRoutine, timeSlots);
          const dimensions = this.calculateTableDimensions(timeSlots, {
            width: doc.page.width,
            height: doc.page.height,
            margins: doc.options.margins
          });

          this.drawTableStructure(doc, dimensions, timeSlots, startY);
          this.fillRoutineData(doc, routineGrid, timeSlots, dimensions, startY);
          this.addTeacherFooter(doc, teacher);

        } catch (teacherError) {
          console.error(`❌ Error processing teacher ${teacher.fullName}:`, teacherError);
          // Continue with next teacher instead of failing entire batch
        }
      }

      // Finalize the PDF
      doc.end();

      console.log(`✅ Batch teacher schedules PDF generated for ${teachers.length} teachers`);
      return this.documentToBuffer(doc);

    } catch (error) {
      console.error('❌ Error generating batch teachers schedules PDF:', error);
      throw error;
    }
  }

  /**
   * Add teacher-specific footer to PDF (removed to save space for routine grid)
   * @param {PDFDocument} doc - PDF document
   * @param {Object} teacher - Teacher information
   */
  addTeacherFooter(doc, teacher) {
    // Footer removed to give more space to the routine grid
    // Previously contained: Generated on date and teacher info
  }
}

module.exports = TeacherPDFGenerator;