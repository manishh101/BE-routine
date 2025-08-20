const { PDFGenerationService } = require('./pdfGeneration');
const { processRoutineSlots, processMultiGroupClasses } = require('./routineDataProcessor');

/**
 * Room PDF Generator - Extends base PDF service for room-specific functionality
 * Generates PDF schedules showing room utilization with identical layout to class routines
 */
class RoomPDFGenerator extends PDFGenerationService {
  constructor() {
    super();
    // Lazy load models to avoid database connection issues during module loading
    this._RoutineSlot = null;
    this._TimeSlotDefinition = null;
    this._Room = null;
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

  get Room() {
    if (!this._Room) {
      this._Room = require('../models/Room');
    }
    return this._Room;
  }

  /**
   * Get all time slots (global + context-specific) for room view
   * Rooms show all time slots across all programs/semesters/sections
   */
  async getGlobalTimeSlots() {
    try {
      // For room view, we want to see ALL time slots to get complete picture
      // This includes both global and context-specific time slots
      const timeSlots = await this.TimeSlotDefinition.find().sort({ sortOrder: 1, startTime: 1 });
      
      console.log(`🏢 Room PDF: Found ${timeSlots.length} total time slots (global + context-specific)`);
      
      return timeSlots;
      
    } catch (error) {
      console.error('❌ Error fetching time slots for room PDF:', error);
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
   * Generate PDF file for room schedule - STANDARDIZED METHOD PATTERN
   * @param {Object} room - Room object with _id, name, building
   * @param {Object} options - Additional options (scheduleData, academicYear, etc.)
   * @returns {Buffer} - PDF file buffer
   */
  async generateRoomRoutinePDF(room, options = {}) {
    try {
      console.log(`🏢 Generating room routine PDF for: ${room.name}`);

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
        
        console.log('📊 Using frontend-compatible data with', Object.keys(processedRoutine).length, 'days');
        
      } else {
        console.log('🔄 Fetching data independently (legacy mode)');
        
        // Legacy mode: fetch data independently - UPDATED TO USE CONTEXT-AWARE TIME SLOTS
        // Get time slots using global logic (rooms can see all time slots)
        timeSlots = await this.getGlobalTimeSlots();
        
        console.log('📅 Room PDF Time Slots (global):', timeSlots.map((slot, idx) => ({ 
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
          roomId: room._id,
          isActive: true
        })
          .populate('subjectId', 'name code')
          .populate('subjectIds', 'name code') // Populate multiple subjects for electives
          .populate('teacherIds', 'fullName shortName')
          .populate('roomId', 'name')
          .populate('programId', 'code name') // Add program info for room view display
          .sort({ dayIndex: 1, slotIndex: 1 });

        console.log(`📊 Found ${routineSlots.length} routine slots for room ${room.name}`);

        // Process routine data using shared logic - ENSURES CONSISTENCY WITH CLASS ROUTINE
        const routineData = processRoutineSlots(routineSlots, { viewMode: 'room' });
        processedRoutine = processMultiGroupClasses(routineData);

        console.log('🔄 Processed room routine data:', Object.keys(processedRoutine).length, 'days');
      }

      // Add header
      const startY = this.addHeader(doc, {
        title: `${room.name} - Weekly Schedule`,
        subtitle: `Room Utilization Schedule${room.building ? ` - ${room.building}` : ''}`,
        institutionName: 'IOE Pulchowk Campus',
        academicYear: options.academicYear || new Date().getFullYear()
      });

      // Create routine grid using processed data  
      const routineGrid = this.createRoutineGridFromProcessedData(processedRoutine, timeSlots);      // Calculate table dimensions
      const dimensions = this.calculateTableDimensions(timeSlots, {
        width: doc.page.width,
        height: doc.page.height,
        margins: doc.options.margins
      });

      // Draw table structure
      this.drawTableStructure(doc, dimensions, timeSlots, startY);

      // Fill cells with class data
      this.fillRoutineData(doc, routineGrid, timeSlots, dimensions, startY);

      // Add footer
      this.addRoomFooter(doc, room);

      // Finalize the PDF
      doc.end();

      console.log(`✅ Room routine PDF generated successfully for ${room.name}`);
      return this.documentToBuffer(doc);

    } catch (error) {
      console.error('Error generating room routine PDF:', error);
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
          // Convert frontend slot data to processed format with room view flags
          if (Array.isArray(slotData)) {
            // Multiple classes in same slot - EXACT SAME PATTERN AS CLASS ROUTINE
            processedRoutine[dayIndex][slotIndex] = {
              isMultiGroup: true,
              groups: slotData.map(slot => ({
                ...slot,
                hideRoom: true, // Room view specific
                programSemesterSection: slot.programSemesterSection || `${slot.programCode} Sem${slot.semester} ${slot.section}`
              })),
              hideRoom: true
            };
          } else {
            // Single class - EXACT SAME PATTERN AS CLASS ROUTINE
            processedRoutine[dayIndex][slotIndex] = {
              ...slotData,
              hideRoom: true, // Room view specific
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
   * @deprecated Use generateRoomRoutinePDF instead
   */
  async generateRoomSchedulePDF(room, options = {}) {
    console.warn('⚠️  generateRoomSchedulePDF is deprecated, use generateRoomRoutinePDF instead');
    return this.generateRoomRoutinePDF(room, options);
  }

  /**
   * Generate batch PDF for all rooms
   * @param {Object} options - Options for batch generation
   * @returns {Buffer} - Combined PDF buffer
   */
  async generateAllRoomsScheduleBatch(options = {}) {
    try {
      console.log('📋 Generating batch PDF for all rooms...');

      // Get all active rooms
      const rooms = await this.Room.find({ isActive: { $ne: false } })
        .sort({ name: 1 });

      if (rooms.length === 0) {
        throw new Error('No active rooms found');
      }

      console.log(`🏢 Found ${rooms.length} active rooms for batch PDF generation`);

      const doc = this.createDocument();
      let isFirstPage = true;

      // Get time slots once for all rooms - UPDATED TO USE GLOBAL LOGIC
      const timeSlots = await this.getGlobalTimeSlots();

      for (const room of rooms) {
        try {
          console.log(`📄 Processing room: ${room.name}`);

          // Add new page for each room (except the first one)
          if (!isFirstPage) {
            doc.addPage();
          }
          isFirstPage = false;

          // Get routine slots for this room
          const routineSlots = await this.RoutineSlot.find({
            roomId: room._id,
            isActive: true
          })
            .populate('subjectId', 'name code')
            .populate('subjectIds', 'name code')
            .populate('teacherIds', 'fullName shortName')
            .populate('roomId', 'name')
            .populate('programId', 'code name')
            .sort({ dayIndex: 1, slotIndex: 1 });

          // Process routine data with room view mode
          const routineData = processRoutineSlots(routineSlots, { viewMode: 'room' });
          const processedRoutine = processMultiGroupClasses(routineData);

          // Add room-specific header
          const startY = this.addHeader(doc, {
            title: `${room.name} - Weekly Schedule`,
            subtitle: `Room Utilization Schedule${room.building ? ` - ${room.building}` : ''}`,
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
          this.addRoomFooter(doc, room);

        } catch (roomError) {
          console.error(`❌ Error processing room ${room.name}:`, roomError);
          // Continue with next room instead of failing entire batch
        }
      }

      // Finalize the PDF
      doc.end();

      console.log(`✅ Batch room schedules PDF generated for ${rooms.length} rooms`);
      return this.documentToBuffer(doc);

    } catch (error) {
      console.error('❌ Error generating batch rooms schedules PDF:', error);
      throw error;
    }
  }

  /**
   * Add room-specific footer to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {Object} room - Room information
   */
  addRoomFooter(doc, room) {
    // Footer removed to give more space to the routine grid
    // Previously contained: Generated on date and room info
  }
}

module.exports = RoomPDFGenerator;
