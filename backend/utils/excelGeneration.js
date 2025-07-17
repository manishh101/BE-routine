const ExcelJS = require('exceljs');
const RoutineSlot = require('../models/RoutineSlot');
const TimeSlotDefinition = require('../models/TimeSlot');

/**
 * Generate Excel file for class routine
 * @param {String} programCode - Program code (e.g., 'BCT')
 * @param {Number} semester - Semester number
 * @param {String} section - Section (e.g., 'AB', 'CD')
 * @returns {Buffer} - Excel file buffer
 */
async function generateClassRoutineExcel(programCode, semester, section) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${programCode} Sem ${semester} ${section} Routine`);

    // Get time slots for headers
    const timeSlots = await TimeSlotDefinition.find().sort({ sortOrder: 1 });
    
    // Get routine slots
    const routineSlots = await RoutineSlot.find({
      programCode: programCode.toUpperCase(),
      semester: parseInt(semester),
      section: section.toUpperCase()
    })
      .populate('subjectId', 'name code')
      .populate('teacherIds', 'fullName shortName')
      .populate('roomId', 'name')
      .sort({ dayIndex: 1, slotIndex: 1 });

    // Day names
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    // Create headers - include ALL time slots (including breaks)
    const headers = ['Day/Time'];
    const timeSlotMap = new Map(); // Map slot._id to column index
    
    timeSlots.forEach((slot, index) => {
      timeSlotMap.set(slot._id.toString(), index + 1); // +1 because first column is Day/Time
      
      if (slot.isBreak) {
        headers.push('BREAK');
      } else {
        headers.push(`${slot.startTime}-${slot.endTime}`);
      }
    });

    // Add header row
    worksheet.addRow(headers);
    
    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.height = 35;
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF667EEA' } // Gradient-like color matching frontend
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF666666' } },
        left: { style: 'thin', color: { argb: 'FF666666' } },
        bottom: { style: 'thin', color: { argb: 'FF666666' } },
        right: { style: 'thin', color: { argb: 'FF666666' } }
      };
    });

    // Create routine data structure using time slot IDs
    const routineGrid = {};
    const spanGroups = {}; // Track multi-period classes
    dayNames.forEach((day, dayIndex) => {
      routineGrid[dayIndex] = {};
      // Initialize all time slots for each day using their _id as key
      timeSlots.forEach(slot => {
        routineGrid[dayIndex][slot._id.toString()] = null;
      });
    });

    // Populate routine grid and track span groups
    const multiGroupSlots = {}; // Track multi-group classes by dayIndex-slotIndex
    
    routineSlots.forEach(slot => {
      const teacherNames = slot.teacherIds.map(t => t.shortName || t.fullName).join(', ');
      const roomName = slot.roomName_display || slot.roomId?.name || 'TBA';
      const classTypeDisplay = slot.classType === 'L' ? 'Lecture' : 
                              slot.classType === 'P' ? 'Practical' : 'Tutorial';
      
      // Enhanced class data formatting to match frontend display
      const subjectCode = slot.subjectCode_display || slot.subjectId?.code || 'N/A';
      const subjectName = slot.subjectName_display || slot.subjectId?.name || 'N/A';
      
      // Build lab group indicator like frontend
      let labGroupIndicator = '';
      if (slot.labGroup) {
        if (slot.isAlternativeWeek) {
          labGroupIndicator = ` (Group ${slot.labGroup} - Alt Week)`;
        } else if (slot.labGroup === 'bothGroups') {
          labGroupIndicator = ' (Both Groups)';
        } else {
          labGroupIndicator = ` (Group ${slot.labGroup})`;
        }
      } else if (slot.isAlternativeWeek) {
        labGroupIndicator = ' (Alt Week)';
      }
      
      // Enhanced subject display with lab group
      const enhancedSubject = `${subjectName}${labGroupIndicator}`;
      
      // Build elective indicator
      let electiveIndicator = '';
      if (slot.isElectiveClass) {
        electiveIndicator = `\n[${slot.electiveLabel || 'Elective'}]`;
      }
      
      const classData = {
        subject: enhancedSubject,
        subjectCode: subjectCode,
        teacher: teacherNames,
        room: roomName,
        type: classTypeDisplay,
        notes: slot.notes || '',
        spanId: slot.spanId,
        spanMaster: slot.spanMaster,
        labGroup: slot.labGroup,
        isAlternativeWeek: slot.isAlternativeWeek,
        isElectiveClass: slot.isElectiveClass,
        electiveLabel: slot.electiveLabel,
        electiveIndicator: electiveIndicator
      };
      
      // Use slot.slotIndex directly (it should match time slot _id)
      const slotKey = slot.slotIndex.toString();
      const multiGroupKey = `${slot.dayIndex}-${slotKey}`;
      
      if (routineGrid[slot.dayIndex] && routineGrid[slot.dayIndex].hasOwnProperty(slotKey)) {
        // Check if this is a multi-group slot (Group A and Group B)
        if (slot.labGroup && ['A', 'B'].includes(slot.labGroup)) {
          if (!multiGroupSlots[multiGroupKey]) {
            multiGroupSlots[multiGroupKey] = [];
          }
          multiGroupSlots[multiGroupKey].push(classData);
        } else {
          routineGrid[slot.dayIndex][slotKey] = classData;
        }
      } else {
        console.warn(`Invalid slot mapping: dayIndex=${slot.dayIndex}, slotIndex=${slot.slotIndex}`);
      }
      
      // Track span groups for multi-period classes
      if (slot.spanId) {
        if (!spanGroups[slot.spanId]) {
          spanGroups[slot.spanId] = [];
        }
        spanGroups[slot.spanId].push({
          dayIndex: slot.dayIndex,
          slotId: slotKey,
          slotIndex: parseInt(slotKey),
          spanMaster: slot.spanMaster
        });
      }
    });
    
    // Handle multi-group slots (combine Group A and Group B into one cell)
    Object.keys(multiGroupSlots).forEach(multiGroupKey => {
      const [dayIndex, slotKey] = multiGroupKey.split('-');
      const groups = multiGroupSlots[multiGroupKey];
      
      if (groups.length > 1) {
        // Sort groups by labGroup to ensure consistent order (A first, then B)
        groups.sort((a, b) => {
          if (a.labGroup === 'A' && b.labGroup === 'B') return -1;
          if (a.labGroup === 'B' && b.labGroup === 'A') return 1;
          return 0;
        });
        
        // Create combined multi-group class data
        const combinedClassData = {
          subject: groups[0].subject.replace(` (Group ${groups[0].labGroup})`, ''), // Remove individual group labels
          subjectCode: groups[0].subjectCode,
          type: groups[0].type,
          isMultiGroup: true,
          groups: groups,
          spanId: groups[0].spanId,
          spanMaster: groups[0].spanMaster,
          electiveIndicator: groups[0].electiveIndicator
        };
        
        routineGrid[dayIndex][slotKey] = combinedClassData;
      } else if (groups.length === 1) {
        // Single group - place normally
        routineGrid[dayIndex][slotKey] = groups[0];
      }
    });

    // Add data rows
    dayNames.forEach((dayName, dayIndex) => {
      const row = [dayName];
      
      timeSlots.forEach((timeSlot) => {
        const slotKey = timeSlot._id.toString();
        const classData = routineGrid[dayIndex][slotKey];
        
        // Check if this is a break slot - either by time slot definition or by class data
        if (timeSlot.isBreak || (classData && classData.subject === 'BREAK')) {
          row.push('BREAK');
        } else if (classData) {
          // Check if this is part of a multi-period class
          if (classData.spanId && !classData.spanMaster) {
            // This is a spanned slot but not the master - leave empty for merging
            row.push('');
          } else {
            let cellContent = '';
            
            // Handle multi-group classes (Group A and Group B)
            if (classData.isMultiGroup && classData.groups && classData.groups.length > 1) {
              // Multi-group class display
              cellContent += `${classData.subject}\n`;
              cellContent += `[${classData.type}]\n`;
              cellContent += `═══════════════════════\n`; // Separator
              
              classData.groups.forEach((group, index) => {
                cellContent += `Group ${group.labGroup}:\n`;
                cellContent += `  Teacher: ${group.teacher}\n`;
                cellContent += `  Room: ${group.room}\n`;
                
                if (index < classData.groups.length - 1) {
                  cellContent += `─────────────────────\n`; // Sub-separator
                }
              });
              
              // Add elective indicator if present
              if (classData.electiveIndicator) {
                cellContent += classData.electiveIndicator;
              }
            } else {
              // Single group/class display (enhanced format)
              cellContent += `${classData.subject}\n`;
              cellContent += `[${classData.type}]\n`;
              cellContent += `Teacher: ${classData.teacher}\n`;
              cellContent += `Room: ${classData.room}`;
              
              // Add elective indicator if present
              if (classData.electiveIndicator) {
                cellContent += classData.electiveIndicator;
              }
              
              // Add notes if present
              if (classData.notes) {
                cellContent += `\nNotes: ${classData.notes}`;
              }
            }
            
            row.push(cellContent);
          }
        } else {
          row.push(''); // Empty cell
        }
      });
      
      worksheet.addRow(row);
    });

    // Handle cell merging for multi-period classes with enhanced styling
    Object.values(spanGroups).forEach(spanGroup => {
      if (spanGroup.length > 1) {
        // Sort span group by slot index to ensure proper merging
        spanGroup.sort((a, b) => a.slotIndex - b.slotIndex);
        
        // Find the master cell
        const masterCell = spanGroup.find(cell => cell.spanMaster);
        if (masterCell) {
          const startCol = masterCell.slotIndex + 2; // +2 because col 1 is day name and slots start from col 2
          const endCol = spanGroup[spanGroup.length - 1].slotIndex + 2;
          const rowNum = masterCell.dayIndex + 2; // +2 because row 1 is header and days start from row 2
          
          // Merge cells horizontally for multi-period classes
          if (startCol < endCol) {
            try {
              worksheet.mergeCells(rowNum, startCol, rowNum, endCol);
              
              // Set enhanced styling for merged cells
              const mergedCell = worksheet.getCell(rowNum, startCol);
              mergedCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
              mergedCell.font = { size: 9, bold: true, color: { argb: 'FF333333' } };
              
              // Special styling for multi-period classes
              mergedCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF0F8FF' } // Light blue background for multi-period
              };
              
              mergedCell.border = {
                top: { style: 'thick', color: { argb: 'FF4A90E2' } },
                left: { style: 'thick', color: { argb: 'FF4A90E2' } },
                bottom: { style: 'thick', color: { argb: 'FF4A90E2' } },
                right: { style: 'thick', color: { argb: 'FF4A90E2' } }
              };
              
              // Add multi-period indicator to cell content
              const currentValue = mergedCell.value || '';
              if (currentValue && !currentValue.toString().includes('[Multi-Period]')) {
                mergedCell.value = `[Multi-Period Class]\n${currentValue}`;
              }
              
            } catch (error) {
              console.warn('Warning: Could not merge cells for multi-period class:', error.message);
            }
          }
        }
      }
    });

    // Style data rows
    for (let rowIndex = 2; rowIndex <= dayNames.length + 1; rowIndex++) {
      const row = worksheet.getRow(rowIndex);
      const dayIndex = rowIndex - 2;
      row.height = 100; // Increased height for better readability
      
      row.eachCell((cell, colNumber) => {
        if (colNumber === 1) {
          // Day name column - styled like frontend
          cell.font = { bold: true, size: 12, color: { argb: 'FF333333' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8F9FA' }
          };
        } else {
          // Check if it's a break column
          const slotIndex = colNumber - 2;
          const timeSlot = timeSlots[slotIndex];
          const isBreak = timeSlot?.isBreak;
          
          // Also check if there's class data that indicates this is a break
          const slotKey = timeSlot?._id?.toString();
          const classData = routineGrid[dayIndex] && routineGrid[dayIndex][slotKey];
          const isBreakClass = classData && classData.subject === 'BREAK';
          
          if (isBreak || isBreakClass) {
            cell.font = { bold: true, size: 10, italic: true, color: { argb: 'FF666666' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF5F5F5' }
            };
          } else if (timeSlot) {
            // Enhanced styling for class content (only if timeSlot exists)
            cell.font = { size: 9, color: { argb: 'FF333333' } };
            cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
            
            // Check if this is a multi-group class for special styling
            const slotKey = timeSlot._id.toString();
            const classData = routineGrid[dayIndex] && routineGrid[dayIndex][slotKey];
            
            if (classData && classData.isMultiGroup) {
              // Special styling for multi-group classes
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF0F8FF' } // Light blue for multi-group
              };
              cell.font = { size: 8, color: { argb: 'FF333333' } }; // Smaller font for more content
              row.height = 120; // Taller row for multi-group content
            } else if (cell.value && cell.value.toString().trim() !== '') {
              // Regular class cells
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFFFF' }
              };
            }
          } else {
            // Default styling for columns without corresponding time slots
            cell.font = { size: 9, color: { argb: 'FF333333' } };
            cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFFFF' }
            };
          }
        }
        
        // Enhanced border styling
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFC0C0C0' } },
          left: { style: 'thin', color: { argb: 'FFC0C0C0' } },
          bottom: { style: 'thin', color: { argb: 'FFC0C0C0' } },
          right: { style: 'thin', color: { argb: 'FFC0C0C0' } }
        };
      });
    }

    // Set column widths for better readability
    worksheet.getColumn(1).width = 18; // Day column - wider for better visibility
    for (let i = 2; i <= headers.length; i++) {
      worksheet.getColumn(i).width = 25; // Increased width for more content
    }

    // Add enhanced title with styling
    worksheet.insertRow(1, [`${programCode.toUpperCase()} Semester ${semester} Section ${section.toUpperCase()} - Class Routine`]);
    worksheet.mergeCells(1, 1, 1, headers.length);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF333333' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8F9FA' }
    };
    titleCell.border = {
      top: { style: 'thick', color: { argb: 'FF666666' } },
      left: { style: 'thick', color: { argb: 'FF666666' } },
      bottom: { style: 'thick', color: { argb: 'FF666666' } },
      right: { style: 'thick', color: { argb: 'FF666666' } }
    };
    
    // Add some padding to the title row
    worksheet.getRow(1).height = 40;
    
    return await workbook.xlsx.writeBuffer();
  } catch (error) {
    console.error('Error generating class routine Excel:', error);
    throw error;
  }
}

module.exports = {
  generateClassRoutineExcel
};
