const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { processRoutineSlots, processMultiGroupClasses } = require('./routineDataProcessor');
const { getLabGroupsForSection, getSectionLabGroupLabel } = require('./sectionUtils');

// Base PDF Generation Service - Scalable Architecture
class PDFGenerationService {
  constructor() {
    this.defaultConfig = {
      size: 'A4',
      layout: 'landscape',
      margins: { top: 40, bottom: 40, left: 30, right: 30 }
    };
    
    this.colors = {
      primary: '#667EEA',
      secondary: '#764BA2',
      text: '#333333',
      lightText: '#666666',
      border: '#c0c0c0',
      background: '#ffffff',
      headerBg: '#f8f9fa',
      breakBg: '#f5f5f5'
    };
    
    this.dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  }

  /**
   * Create a new PDF document with standard configuration
   * @param {Object} config - PDF configuration
   * @returns {PDFDocument} - PDF document instance
   */
  createDocument(config = {}) {
    return new PDFDocument({
      ...this.defaultConfig,
      ...config
    });
  }

  /**
   * Convert PDF document to buffer
   * @param {PDFDocument} doc - PDF document
   * @returns {Promise<Buffer>} - PDF buffer
   */
  documentToBuffer(doc) {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    
    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }

  /**
   * Add standard header to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {Object} headerInfo - Header information
   */
  addHeader(doc, headerInfo) {
    const { title, subtitle, institutionName = 'IOE Pulchowk Campus', academicYear } = headerInfo;
    
    // Main title
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor(this.colors.text)
       .text(title, doc.options.margins.left, 50, {
         align: 'center',
         width: doc.page.width - doc.options.margins.left - doc.options.margins.right
       });

    // Institution and subtitle
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor(this.colors.lightText)
       .text(institutionName, doc.options.margins.left, 75, { align: 'center' });

    if (subtitle) {
      doc.text(subtitle, doc.options.margins.left, 90, { align: 'center' });
    }

    if (academicYear) {
      doc.text(`Academic Year: ${academicYear}`, doc.options.margins.left, 105, { align: 'center' });
    }

    return 130; // Return Y position for content start
  }

  /**
   * Add footer to PDF
   * @param {PDFDocument} doc - PDF document
   */
  addFooter(doc) {
    // Footer removed to give more space to the routine grid
    // Previously contained: Generated on date and system info
  }

  /**
   * Calculate table dimensions based on content - matches frontend layout
   * @param {Array} timeSlots - Time slots array
   * @param {Object} pageInfo - Page information
   * @returns {Object} - Table dimensions
   */
  calculateTableDimensions(timeSlots, pageInfo) {
    const availableWidth = pageInfo.width - pageInfo.margins.left - pageInfo.margins.right;
    const availableHeight = pageInfo.height - pageInfo.margins.top - pageInfo.margins.bottom - 160; // Space for header/footer
    
    const dayColumnWidth = 150; // Increased for better readability
    const timeColumnWidth = (availableWidth - dayColumnWidth) / timeSlots.length;
    const headerHeight = 35;
    
    // Increase row height to accommodate multi-group classes and elective indicators (matches frontend)
    const rowHeight = Math.min(140, (availableHeight - headerHeight) / this.dayNames.length); // Increased for multi-group
    
    return {
      dayColumnWidth,
      timeColumnWidth,
      headerHeight,
      rowHeight,
      tableWidth: availableWidth,
      tableHeight: headerHeight + (rowHeight * this.dayNames.length)
    };
  }

  /**
   * Draw table structure
   * @param {PDFDocument} doc - PDF document
   * @param {Object} dimensions - Table dimensions
   * @param {Array} timeSlots - Time slots
   * @param {Number} startY - Starting Y position
   */
  drawTableStructure(doc, dimensions, timeSlots, startY) {
    const { dayColumnWidth, timeColumnWidth, headerHeight, rowHeight } = dimensions;
    let currentX = doc.options.margins.left;
    
    // Draw header row
    this.drawTableHeaders(doc, timeSlots, currentX, startY, dayColumnWidth, timeColumnWidth, headerHeight);
    
    // Draw day rows
    this.dayNames.forEach((dayName, dayIndex) => {
      const rowY = startY + headerHeight + (dayIndex * rowHeight);
      this.drawDayRow(doc, dayName, currentX, rowY, dayColumnWidth, timeColumnWidth, rowHeight, timeSlots.length);
    });
  }

  /**
   * Draw table headers
   */
  drawTableHeaders(doc, timeSlots, startX, startY, dayColumnWidth, timeColumnWidth, headerHeight) {
    let currentX = startX;
    
    // Day/Time header
    doc.rect(currentX, startY, dayColumnWidth, headerHeight)
       .fillAndStroke(this.colors.headerBg, this.colors.border)
       .fillColor(this.colors.text)
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('Day / Time', currentX + 5, startY + 15, {
         width: dayColumnWidth - 10,
         align: 'center'
       });

    currentX += dayColumnWidth;

    // Time slot headers
    timeSlots.forEach((timeSlot) => {
      doc.rect(currentX, startY, timeColumnWidth, headerHeight)
         .fillAndStroke(this.colors.headerBg, this.colors.border)
         .fillColor(this.colors.text)
         .fontSize(9)
         .font('Helvetica-Bold');

      if (timeSlot.isBreak) {
        doc.text('BREAK', currentX + 5, startY + 18, {
          width: timeColumnWidth - 10,
          align: 'center'
        });
      } else {
        doc.text(`${timeSlot.startTime}-${timeSlot.endTime}`, currentX + 5, startY + 18, {
          width: timeColumnWidth - 10,
          align: 'center'
        });
      }
      currentX += timeColumnWidth;
    });
  }

  /**
   * Draw day row
   */
  drawDayRow(doc, dayName, startX, startY, dayColumnWidth, timeColumnWidth, rowHeight, timeSlotCount) {
    // Day name cell
    doc.rect(startX, startY, dayColumnWidth, rowHeight)
       .fillAndStroke(this.colors.headerBg, this.colors.border)
       .fillColor(this.colors.text)
       .fontSize(12)
       .font('Helvetica-Bold')
       .text(dayName, startX + 5, startY + (rowHeight / 2) - 6, {
         width: dayColumnWidth - 10,
         align: 'center'
       });

    // Time slot cells (empty borders)
    let currentX = startX + dayColumnWidth;
    for (let i = 0; i < timeSlotCount; i++) {
      doc.rect(currentX, startY, timeColumnWidth, rowHeight)
         .stroke(this.colors.border);
      currentX += timeColumnWidth;
    }
  }

  /**
   * Fill cell with class data
   * @param {PDFDocument} doc - PDF document
   * @param {Object} classData - Class information
   * @param {Number} x - X position
   * @param {Number} y - Y position
   * @param {Number} width - Cell width
   * @param {Number} height - Cell height
   * @param {Boolean} isBreak - Is break slot
   */
  fillClassCell(doc, classData, x, y, width, height, isBreak = false) {
    if (isBreak) {
      doc.rect(x, y, width, height)
         .fillAndStroke(this.colors.breakBg, this.colors.border)
         .fillColor(this.colors.lightText)
         .fontSize(10)
         .font('Helvetica-Bold-Oblique')
         .text('BREAK', x + 5, y + (height / 2) - 5, {
           width: width - 10,
           align: 'center'
         });
      return;
    }

    if (!classData) {
      // Empty cell
      doc.rect(x, y, width, height)
         .fillAndStroke(this.colors.background, this.colors.border);
      return;
    }

    // Class data cell
    doc.rect(x, y, width, height)
       .fillAndStroke(this.colors.background, this.colors.border);

    // Cell content layout
    this.renderClassContent(doc, classData, x, y, width, height);
  }

  /**
   * Render class content in cell - matches frontend exactly
   */
  renderClassContent(doc, classData, x, y, width, height) {
    const padding = 6;
    const contentX = x + padding;
    const contentWidth = width - (padding * 2);
    let currentY = y + padding;
    const lineHeight = 12;

    // Check if this is a multi-group slot (Group A and Group B) - CONSOLIDATED DISPLAY
    if (classData.isMultiGroup && classData.groups && classData.groups.length > 1) {
      console.log('🔧 Multi-group rendering:', {
        subject: classData.subjectName,
        groupCount: classData.groups.length,
        groups: classData.groups.map(g => ({
          labGroup: g.labGroup,
          subject: g.subjectName,
          teacher: g.teacherShortNames,
          room: g.roomName
        }))
      });

      // CONSOLIDATED display for multi-group practical classes
      
      // Subject Name - show the combined subject name
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(this.colors.text);
      
      // Use the combined subject from multi-group processing or first group subject
      const subjectText = classData.subjectName || classData.groups[0].subjectName;
      doc.text(subjectText, contentX, currentY, {
        width: contentWidth,
        align: 'center',
        lineBreak: false
      });
      currentY += 14;
      
      // Show consolidated group labels (Group A & Group B)
      const groupLabels = classData.groups
        .map(group => this.getLabGroupLabel(classData, group))
        .filter(label => label)
        .join(' & ');
      
      if (groupLabels) {
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor('#2c5234');
        doc.text(groupLabels, contentX, currentY, {
          width: contentWidth,
          align: 'center'
        });
        currentY += 12;
      }
      
      // Class Type
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#666');
      doc.text(`[${this.getClassTypeText(classData.groups[0].classType)}]`, contentX, currentY, {
        width: contentWidth,
        align: 'center'
      });
      currentY += 12;

      // Teacher - CONSOLIDATED (show unique teachers only once)
      if (!classData.hideTeacher && !classData.hideRoom) {
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#666');
        
        // Get unique teachers from all groups
        const allTeachers = classData.groups.map(group => 
          Array.isArray(group.teacherShortNames) ? 
            group.teacherShortNames.join(', ') : 
            group.teacherShortNames || 'TBA'
        );
        const uniqueTeachers = [...new Set(allTeachers)];
        
        doc.text(uniqueTeachers.join(' / '), contentX, currentY, {
          width: contentWidth,
          align: 'center'
        });
        currentY += 12;
      }

      // Room - CONSOLIDATED (show unique rooms only once)
      if (!classData.hideRoom) {
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#666');
        
        // Get unique rooms from all groups
        const allRooms = classData.groups.map(group => group.roomName || 'TBA');
        const uniqueRooms = [...new Set(allRooms)];
        
        doc.text(uniqueRooms.join(' / '), contentX, currentY, {
          width: contentWidth,
          align: 'center'
        });
        currentY += 12;
      }

      // Program-Semester-Section (show in room view mode)
      if (classData.hideRoom && classData.groups[0].programSemesterSection) {
        doc.fontSize(8)
           .fillColor('#666');
        doc.text(classData.groups[0].programSemesterSection, contentX, currentY, {
          width: contentWidth,
          align: 'center'
        });
        currentY += 8;
      }

      // Teacher (show in room view mode)
      if (classData.hideRoom) {
        doc.fontSize(8)
           .fillColor('#666');
        // Same consolidation logic for room view
        const allTeachers = classData.groups.map(group => 
          Array.isArray(group.teacherShortNames) ? 
            group.teacherShortNames.join(', ') : 
            group.teacherShortNames || group.teacherNames?.join(', ') || 'TBA'
        );
        const uniqueTeachers = [...new Set(allTeachers)];
        
        doc.text(uniqueTeachers.join(' / '), contentX, currentY, {
          width: contentWidth,
          align: 'center'
        });
      }

      // Elective indicator for multi-group classes - displayed at the bottom
      if (classData.isElectiveClass) {
        const electiveY = y + height - 18;
        doc.fontSize(7)
           .font('Helvetica')
           .fillColor('#ffffff');
        
        const labelText = classData.electiveLabel || 'Elective';
        const labelWidth = Math.min(contentWidth, doc.widthOfString(labelText) + 12);
        const labelX = contentX + (contentWidth - labelWidth) / 2;
        
        doc.roundedRect(labelX, electiveY, labelWidth, 12, 3)
           .fill('#666666');
        
        doc.text(labelText, labelX, electiveY + 3, {
          width: labelWidth,
          align: 'center'
        });
      }

      return;
    }

    // Single group/class display (matches frontend logic exactly)
    
    // Subject Name with Lab Group indicator INLINE (matches frontend)
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor(this.colors.text);
    
    const subjectText = this.getSubjectDisplayText(classData);
    
    // Show lab group indicator INLINE for practical classes or alternative week classes (matches frontend)
    let displayText = subjectText;
    if ((classData.classType === 'P' || classData.isAlternativeWeek === true) && classData.labGroup) {
      const labGroupLabel = this.getLabGroupLabel(classData);
      if (labGroupLabel) {
        displayText = `${subjectText} ${labGroupLabel}`;
      }
    }
    
    doc.text(displayText, contentX, currentY, {
      width: contentWidth,
      align: 'center',
      lineBreak: false
    });
    currentY += 14;

    // Class Type
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('#666');
    doc.text(`[${this.getClassTypeText(classData.classType || classData.type)}]`, contentX, currentY, {
      width: contentWidth,
      align: 'center'
    });
    currentY += 12;

    // Teacher (if not teacher view and not room view)
    if (!classData.hideTeacher && !classData.hideRoom) {
      doc.fontSize(9)
         .fillColor('#666');
      doc.text(`${this.formatTeachers(classData)}`, contentX, currentY, {
        width: contentWidth,
        align: 'center',
        lineBreak: false
      });
      currentY += 12;
    }

    // Room (if not room view)
    if (!classData.hideRoom) {
      doc.fontSize(9)
         .fillColor('#666');
      doc.text(`${this.formatRoom(classData)}`, contentX, currentY, {
        width: contentWidth,
        align: 'center',
        lineBreak: false
      });
      currentY += 12;
    }

    // Program-Semester-Section (show in teacher view mode) - matches frontend
    if (classData.hideTeacher && classData.programSemesterSection) {
      doc.fontSize(7)
         .fillColor('#666');
      doc.text(classData.programSemesterSection, contentX, currentY, {
        width: contentWidth,
        align: 'center'
      });
      currentY += 10;
    }

    // Program-Semester-Section (show in room view mode) - matches frontend
    if (classData.hideRoom && classData.programSemesterSection) {
      doc.fontSize(7)
         .fillColor('#666');
      doc.text(classData.programSemesterSection, contentX, currentY, {
        width: contentWidth,
        align: 'center'
      });
      currentY += 10;
    }

    // Teacher (show in room view mode) - matches frontend
    if (classData.hideRoom) {
      doc.fontSize(7)
         .fillColor('#666');
      doc.text(`${this.formatTeachers(classData)}`, contentX, currentY, {
        width: contentWidth,
        align: 'center',
        lineBreak: false
      });
      currentY += 10;
    }

    // Elective indicator - displayed at the bottom (matches frontend exactly)
    if (classData.isElectiveClass) {
      const electiveY = y + height - 18;
      doc.fontSize(7)
         .font('Helvetica')
         .fillColor('#ffffff');
      
      const labelText = classData.electiveLabel || 'Elective';
      const labelWidth = Math.min(contentWidth, doc.widthOfString(labelText) + 12);
      const labelX = contentX + (contentWidth - labelWidth) / 2;
      
      doc.roundedRect(labelX, electiveY, labelWidth, 12, 3)
         .fill('#666666');
      
      doc.text(labelText, labelX, electiveY + 3, {
        width: labelWidth,
        align: 'center'
      });
    }
  }

  /**
   * Format subject display text - matches frontend exactly
   */
  getSubjectDisplayText(classData) {
    // For elective classes, show subject codes instead of full names (matches frontend)
    if (classData.isElectiveClass) {
      // If it has multiple subjects (like "CE752, CT754"), extract codes
      if (classData.displayName && classData.displayName.includes(' - ')) {
        const parts = classData.displayName.split(' - ');
        if (parts.length > 1) {
          // Extract the subject codes part (e.g., "CE752, CT754")
          const subjectsPart = parts[1];
          return subjectsPart;
        }
      }
      // Fallback to subject code if available
      return classData.subjectCode || classData.subjectName || 'Elective';
    }
    
    // For non-elective classes, show full subject name (not code) - matches frontend
    return classData.subjectName || classData.subject || classData.subjectCode || 'N/A';
  }

  /**
   * Generate lab group label matching frontend logic
   */
  getLabGroupLabel(classData, group = null) {
    const isAltWeek = classData.isAlternativeWeek === true;
    
    // For multi-group classes, use the individual group data
    if (group) {
      if (group.labGroupLabel) {
        return isAltWeek ? `${group.labGroupLabel} - Alt Week` : group.labGroupLabel;
      }
      
      const groupLetter = group.labGroup;
      return isAltWeek ? `(Group ${groupLetter} - Alt Week)` : `(Group ${groupLetter})`;
    }
    
    // For single classes, use backend-provided labGroupLabel if available
    if (classData.labGroupLabel) {
      return isAltWeek ? `${classData.labGroupLabel} - Alt Week` : classData.labGroupLabel;
    }
    
    // Alternative week handling - using dynamic section utils
    if (isAltWeek) {
      return getSectionLabGroupLabel(classData.labGroup || 'ALL', classData.section, {
        altWeekSuffix: 'Alt Week'
      });
    }
    
    // Regular lab group labels - using dynamic section utils
    if (classData.labGroup) {
      return getSectionLabGroupLabel(classData.labGroup, classData.section);
    }
    
    return '';
  }

  /**
   * Format class type text
   */
  getClassTypeText(classType) {
    switch (classType) {
      case 'L': return 'Lecture';
      case 'P': return 'Practical';
      case 'T': return 'Tutorial';
      default: return classType || 'Class';
    }
  }

  /**
   * Format teacher names - SMART consolidation for multi-group
   */
  formatTeachers(classData) {
    if (classData.isMultiGroup && classData.groups) {
      // Check if all groups have the same teacher
      const firstGroup = classData.groups[0];
      const firstTeacher = Array.isArray(firstGroup.teacherShortNames) ? 
                          firstGroup.teacherShortNames.join(', ') : 
                          firstGroup.teacherShortNames || firstGroup.teacherNames || 'TBA';
      
      const allSameTeacher = classData.groups.every(group => {
        const groupTeacher = Array.isArray(group.teacherShortNames) ? 
                            group.teacherShortNames.join(', ') : 
                            group.teacherShortNames || group.teacherNames || 'TBA';
        return groupTeacher === firstTeacher;
      });
      
      if (allSameTeacher) {
        // Same teacher for all groups - show once
        return firstTeacher;
      } else {
        // Different teachers - show all
        const teachers = classData.groups.map(group => 
          Array.isArray(group.teacherShortNames) ? group.teacherShortNames.join(', ') : 
          group.teacherShortNames || group.teacherNames || 'TBA'
        );
        return teachers.join(' / ');
      }
    }
    
    if (Array.isArray(classData.teacherShortNames)) {
      return classData.teacherShortNames.join(', ');
    }
    
    if (Array.isArray(classData.teacherNames)) {
      return classData.teacherNames.join(', ');
    }
    
    return classData.teacherShortNames || classData.teacherNames || classData.teacher || 'TBA';
  }

  /**
   * Format room information - SMART consolidation for multi-group
   */
  formatRoom(classData) {
    if (classData.isMultiGroup && classData.groups) {
      // Check if all groups have the same room
      const firstRoom = classData.groups[0].roomName || classData.groups[0].room || 'TBA';
      const allSameRoom = classData.groups.every(group => 
        (group.roomName || group.room || 'TBA') === firstRoom
      );
      
      if (allSameRoom) {
        // Same room for all groups - show once
        return firstRoom;
      } else {
        // Different rooms - show all
        const rooms = classData.groups.map(group => group.roomName || group.room || 'TBA');
        return rooms.join(' / ');
      }
    }
    
    return classData.roomName || classData.room || 'TBA';
  }

  /**
   * Parse time string to minutes for comparison
   */
  parseTime(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Create routine grid from processed data - EXACT FRONTEND LOGIC
   * Shared method for all PDF generators - matches timeSlotUtils.js exactly
   */
  createRoutineGridFromProcessedData(processedRoutine, timeSlots, programCode = null, semester = null, section = null) {
    // Step 1: Create grid structure using normalized time slot IDs (matches frontend createRoutineGrid)
    const grid = {};
    
    for (let dayIndex = 0; dayIndex < this.dayNames.length; dayIndex++) {
      grid[dayIndex] = {};
      
      if (Array.isArray(timeSlots)) {
        timeSlots.forEach(slot => {
          if (slot && slot._id !== undefined) {
            const normalizedId = this.normalizeTimeSlotId(slot._id);
            grid[dayIndex][normalizedId] = null;
          }
        });
      }
    }
    
    // Step 2: Populate grid with routine data (matches frontend populateRoutineGrid)
    Object.keys(processedRoutine).forEach(dayIndex => {
      const dayData = processedRoutine[dayIndex];
      if (dayData && typeof dayData === 'object') {
        Object.keys(dayData).forEach(slotIndex => {
          const classData = dayData[slotIndex];
          if (classData && grid[dayIndex]) {
            // CRITICAL: Normalize slotIndex exactly like frontend does
            const normalizedSlotId = this.normalizeTimeSlotId(slotIndex);
            if (grid[dayIndex].hasOwnProperty(normalizedSlotId)) {
              grid[parseInt(dayIndex)][normalizedSlotId] = classData;
            }
          }
        });
      }
    });

    return grid;
  }

  /**
   * Normalize time slot ID - matches frontend exactly
   */
  normalizeTimeSlotId(id) {
    if (id === null || id === undefined) return '';
    return String(id);
  }

  /**
   * Fill routine data into PDF table - EXACTLY matches frontend logic with normalized slot IDs
   * Shared method for all PDF generators to ensure consistency
   */
  fillRoutineData(doc, routineGrid, timeSlots, dimensions, startY) {
    const { dayColumnWidth, timeColumnWidth, headerHeight, rowHeight } = dimensions;

    this.dayNames.forEach((dayName, dayIndex) => {
      const rowY = startY + headerHeight + (dayIndex * rowHeight);
      
      timeSlots.forEach((timeSlot, slotIndex) => {
        const cellX = doc.options.margins.left + dayColumnWidth + (slotIndex * timeColumnWidth);
        
        // CRITICAL FIX: Use normalized slot ID for data lookup (matches frontend exactly)
        const normalizedSlotId = this.normalizeTimeSlotId(timeSlot._id);
        const classData = routineGrid[dayIndex][normalizedSlotId];
        
        console.log(`PDF Processing cell day=${dayIndex}, slotIndex=${slotIndex}, normalizedSlotId=${normalizedSlotId}, time=${timeSlot.startTime}-${timeSlot.endTime}, hasData=${!!classData}, subject=${classData?.subjectName || 'empty'}`);
        
        // Handle break slots first
        if (timeSlot.isBreak) {
          this.fillClassCell(doc, null, cellX, rowY, timeColumnWidth, rowHeight, true);
          return;
        }
        
        // Frontend spanning logic implementation - matches RoutineGrid.jsx exactly
        const isSpanMaster = classData?.spanMaster === true;
        const isPartOfSpan = classData?.spanId != null;
        
        // Check if this cell should be hidden because it's covered by a span master
        let isHiddenBySpan = false;
        if (isPartOfSpan && !isSpanMaster) {
          // Find the span master for this span group in the same day
          const spanMasterId = classData.spanId;
          const spanMaster = Object.values(routineGrid[dayIndex] || {}).find(
            cell => cell?.spanId === spanMasterId && cell?.spanMaster === true
          );
          
          if (spanMaster) {
            isHiddenBySpan = true;
          }
        }
        
        // EXACT FRONTEND LOGIC: Hidden cells are completely skipped
        if (isHiddenBySpan) {
          console.log(`PDF Skipping hidden span cell: day=${dayIndex}, slot=${slotIndex}, spanId=${classData.spanId}`);
          return;
        }
        
        // Calculate colSpan only for span masters (matches frontend calculateColSpan)
        let colSpan = 1;
        let spanWidth = timeColumnWidth;
        
        if (isSpanMaster) {
          // FIXED: Get all slots in the day and filter by spanId using proper slot indexing
          const daySlots = routineGrid[dayIndex] || {};
          const spanGroup = timeSlots
            .map((_, idx) => daySlots[idx])  // Use timeSlots indices to get all possible slots
            .filter(slot => slot?.spanId && slot.spanId.toString() === classData.spanId.toString());
          
          colSpan = spanGroup.length;
          spanWidth = colSpan * timeColumnWidth;
          
          console.log(`PDF Rendering span master: day=${dayIndex}, slot=${slotIndex}, spanId=${classData.spanId}, colSpan=${colSpan}`);
        }
        
        // Render the cell (normal cell, empty cell, or span master with colSpan)
        this.fillClassCell(doc, classData, cellX, rowY, spanWidth, rowHeight, false);
      });
    });
  }
}

// Specialized PDF generators using the base service
class RoutinePDFGenerator extends PDFGenerationService {
  constructor() {
    super();
    // Lazy load models to avoid database connection issues
    this._RoutineSlot = null;
    this._TimeSlotDefinition = null;
  }

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

  /**
   * Get time slots with context-specific logic - MATCHES FRONTEND API EXACTLY
   * This ensures PDF uses the same time slots as the frontend display
   */
  async getTimeSlotsByContext(programCode, semester, section, includeGlobal = true) {
    try {
      // Build filter for context-specific or global time slots - EXACT SAME LOGIC AS timeSlotController.js
      const filters = [];
      
      // Always include global time slots unless explicitly excluded
      if (includeGlobal) {
        // Include both isGlobal: true AND null/undefined (for legacy time slots)
        filters.push({ 
          $or: [
            { isGlobal: true },
            { isGlobal: { $exists: false } }, // Legacy time slots without isGlobal field
            { isGlobal: null }
          ]
        });
      }
      
      // Add context-specific time slots if context is provided
      if (programCode || semester || section) {
        const contextFilter = { isGlobal: false };
        
        if (programCode) contextFilter.programCode = programCode.toUpperCase();
        if (semester) contextFilter.semester = parseInt(semester);
        if (section) contextFilter.section = section.toUpperCase();
        
        filters.push(contextFilter);
      }
      
      // Build the main filter
      const mainFilter = filters.length > 1 ? { $or: filters } : (filters[0] || {});
      
      // Get time slots sorted by sortOrder (matches frontend exactly)
      const timeSlots = await this.TimeSlotDefinition.find(mainFilter).sort({ sortOrder: 1 });
      
      console.log(`🔍 PDF Context Time Slots Query:`, {
        programCode, 
        semester, 
        section, 
        includeGlobal,
        filter: JSON.stringify(mainFilter, null, 2),
        resultCount: timeSlots.length
      });
      
      return timeSlots;
      
    } catch (error) {
      console.error('❌ Error fetching context time slots for PDF:', error);
      // Fallback to all global time slots
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
   * Generate PDF file for class routine
   * @param {String} programCode - Program code (e.g., 'BCT')
   * @param {Number} semester - Semester number
   * @param {String} section - Section (e.g., 'AB', 'CD')
   * @returns {Buffer} - PDF file buffer
   */
  async generateClassRoutinePDF(programCode, semester, section) {
    try {
      const doc = this.createDocument();

      // Get time slots using the same logic as frontend API - CRITICAL FIX
      let timeSlots = await this.getTimeSlotsByContext(programCode, semester, section);
      
      if (timeSlots.length === 0) {
        console.warn('⚠️  No time slots found for context, falling back to global only');
        timeSlots = await this.TimeSlotDefinition.find({ 
          $or: [
            { isGlobal: true },
            { isGlobal: { $exists: false } }, // Legacy time slots
            { isGlobal: null }
          ]
        }).sort({ sortOrder: 1, startTime: 1 });
      }
      
      console.log('📅 PDF Time Slots (context-aware):', timeSlots.map((slot, idx) => ({ 
        idx, 
        id: slot._id, 
        time: `${slot.startTime}-${slot.endTime}`,
        sortOrder: slot.sortOrder,
        isBreak: slot.isBreak,
        isGlobal: slot.isGlobal,
        context: slot.isGlobal ? 'Global' : `${slot.programCode} ${slot.semester} ${slot.section}`
      })));
      
      // Get routine slots with enhanced population - SAME AS FRONTEND API
      const routineSlots = await this.RoutineSlot.find({
        programCode: programCode.toUpperCase(),
        semester: parseInt(semester),
        section: section.toUpperCase(),
        isActive: true
      })
        .populate('subjectId', 'name code')
        .populate('subjectIds', 'name code') // Populate multiple subjects for electives
        .populate('teacherIds', 'fullName shortName')
        .populate('roomId', 'name')
        .sort({ dayIndex: 1, slotIndex: 1 });

      // Process routine data using shared logic - ENSURES CONSISTENCY WITH FRONTEND
      const routineData = processRoutineSlots(routineSlots, { viewMode: 'class' });
      const processedRoutine = processMultiGroupClasses(routineData);

      // Add header
      const startY = this.addHeader(doc, {
        title: `${programCode.toUpperCase()} Semester ${semester} Section ${section.toUpperCase()} - Class Routine`,
        institutionName: 'IOE Pulchowk Campus',
        academicYear: new Date().getFullYear()
      });

      // Create routine grid using processed data with frontend logic
      const routineGrid = this.createRoutineGridFromProcessedData(processedRoutine, timeSlots, programCode, semester, section);

      // Calculate table dimensions
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
      this.addFooter(doc);

      // Finalize the PDF
      doc.end();

      return this.documentToBuffer(doc);

    } catch (error) {
      console.error('Error generating class routine PDF:', error);
      throw error;
    }
  }

  /**
   * Fill routine data into PDF table - EXACTLY matches frontend logic
   */
  fillRoutineData(doc, routineGrid, timeSlots, dimensions, startY) {
    const { dayColumnWidth, timeColumnWidth, headerHeight, rowHeight } = dimensions;

    this.dayNames.forEach((dayName, dayIndex) => {
      const rowY = startY + headerHeight + (dayIndex * rowHeight);
      
      timeSlots.forEach((timeSlot, slotIndex) => {
        const cellX = doc.options.margins.left + dayColumnWidth + (slotIndex * timeColumnWidth);
        
        // CRITICAL FIX: Use slotIndex for data lookup (matches frontend exactly)
        const classData = routineGrid[dayIndex][slotIndex];
        
        console.log(`Processing cell day=${dayIndex}, slotIndex=${slotIndex}, time=${timeSlot.startTime}-${timeSlot.endTime}, hasData=${!!classData}, subject=${classData?.subjectName || 'empty'}`);
        
        // Handle break slots first
        if (timeSlot.isBreak) {
          this.fillClassCell(doc, null, cellX, rowY, timeColumnWidth, rowHeight, true);
          return;
        }
        
        // Frontend spanning logic implementation - matches RoutineGrid.jsx exactly
        const isSpanMaster = classData?.spanMaster === true;
        const isPartOfSpan = classData?.spanId != null;
        
        // Check if this cell should be hidden because it's covered by a span master
        let isHiddenBySpan = false;
        if (isPartOfSpan && !isSpanMaster) {
          // Find the span master for this span group in the same day
          const spanMasterId = classData.spanId;
          const spanMaster = Object.values(routineGrid[dayIndex] || {}).find(
            cell => cell?.spanId === spanMasterId && cell?.spanMaster === true
          );
          
          if (spanMaster) {
            isHiddenBySpan = true;
          }
        }
        
        // EXACT FRONTEND LOGIC: Hidden cells are completely skipped
        if (isHiddenBySpan) {
          console.log(`Skipping hidden span cell: day=${dayIndex}, slot=${slotIndex}, spanId=${classData.spanId}`);
          return;
        }
        
        // Calculate colSpan only for span masters (matches frontend calculateColSpan)
        let colSpan = 1;
        let spanWidth = timeColumnWidth;
        
        if (isSpanMaster) {
          // For the span master, calculate the total span length
          const spanGroup = Object.values(routineGrid[dayIndex] || {}).filter(
            slot => slot?.spanId && slot.spanId === classData.spanId
          );
          colSpan = spanGroup.length;
          spanWidth = colSpan * timeColumnWidth;
          
          console.log(`Rendering span master: day=${dayIndex}, slot=${slotIndex}, spanId=${classData.spanId}, colSpan=${colSpan}`);
        }
        
        // Render the cell (normal cell, empty cell, or span master with colSpan)
        this.fillClassCell(doc, classData, cellX, rowY, spanWidth, rowHeight, false);
      });
    });
  }
}



// Factory function to create appropriate PDF generator
function createPDFGenerator(type) {
  switch (type) {
    case 'routine':
      return new RoutinePDFGenerator();
    case 'teacher':
      const TeacherPDFGenerator = require('./teacherPdfGeneration');
      return new TeacherPDFGenerator();
    case 'room':
      const RoomPDFGenerator = require('./roomPdfGeneration');
      return new RoomPDFGenerator();
    default:
      throw new Error(`Unknown PDF generator type: ${type}`);
  }
}

// Export functions for backward compatibility and new scalable approach
const routineGenerator = new RoutinePDFGenerator();

module.exports = {
  // Backward compatible exports
  generateClassRoutinePDF: (programCode, semester, section) => 
    routineGenerator.generateClassRoutinePDF(programCode, semester, section),
  
  // Backward compatibility exports
  generateRoutinePDF: (scheduleData, timeSlots) => 
    routineGenerator.generateSchedulePDF(scheduleData, timeSlots),

  // New scalable exports
  PDFGenerationService,
  RoutinePDFGenerator,
  createPDFGenerator
};
