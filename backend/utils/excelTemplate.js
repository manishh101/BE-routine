const ExcelJS = require('exceljs');
const path = require('path');

/**
 * Generates a template Excel file for routine import
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function generateRoutineImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Routine Import Template');

  // Define headers
  const headers = [
    'Program Code',
    'Semester',
    'Section',
    'Day Index',
    'Slot Index',
    'Subject Code',
    'Teacher Short Name',
    'Room Name',
    'Class Type',
    'Notes'
  ];

  // Add header row with styling
  const headerRow = worksheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' }
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Add sample data rows
  const sampleData = [
    ['BCT', 1, 'AB', 0, 0, 'COMP201', 'JD', 'Room A-101', 'L', 'Data Structures Lecture'],
    ['BCT', 1, 'AB', 0, 1, 'MATH201', 'SM', 'Room A-102', 'L', 'Mathematics Lecture'],
    ['BCT', 1, 'AB', 1, 0, 'COMP201', 'JD', 'Lab-1', 'P', 'Data Structures Lab'],
    ['BCE', 2, 'CD', 2, 2, 'CIVIL301', 'RK', 'Room B-201', 'T', 'Structural Engineering Tutorial']
  ];

  sampleData.forEach(row => {
    const dataRow = worksheet.addRow(row);
    dataRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  // Add data validation and formatting
  worksheet.getColumn(1).width = 15; // Program Code
  worksheet.getColumn(2).width = 10; // Semester
  worksheet.getColumn(3).width = 10; // Section
  worksheet.getColumn(4).width = 12; // Day Index
  worksheet.getColumn(5).width = 12; // Slot Index
  worksheet.getColumn(6).width = 15; // Subject Code
  worksheet.getColumn(7).width = 20; // Teacher Short Name
  worksheet.getColumn(8).width = 15; // Room Name
  worksheet.getColumn(9).width = 12; // Class Type
  worksheet.getColumn(10).width = 25; // Notes

  // Add instructions worksheet
  const instructionsSheet = workbook.addWorksheet('Instructions');
  
  const instructions = [
    ['Column', 'Description', 'Valid Values', 'Example'],
    ['Program Code', 'Academic program code', 'BCT, BCE, BEE, etc.', 'BCT'],
    ['Semester', 'Semester number', '1-8', '1'],
    ['Section', 'Class section', 'AB, CD', 'AB'],
    ['Day Index', 'Day of week (0=Sunday)', '0-6 (0=Sun, 1=Mon, ...)', '0'],
    ['Slot Index', 'Time slot number', 'Check time slot definitions', '0'],
    ['Subject Code', 'Subject code from database', 'Valid subject codes only', 'COMP201'],
    ['Teacher Short Name', 'Teacher short name/initials', 'Valid teacher names only', 'JD'],
    ['Room Name', 'Room name from database', 'Valid room names only', 'Room A-101'],
    ['Class Type', 'Type of class', 'L (Lecture), P (Practical), T (Tutorial)', 'L'],
    ['Notes', 'Additional notes (optional)', 'Any text', 'Data Structures Lecture']
  ];

  instructions.forEach((row, index) => {
    const instructionRow = instructionsSheet.addRow(row);
    if (index === 0) {
      instructionRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE6E6FA' }
        };
      });
    }
    instructionRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  // Set column widths for instructions
  instructionsSheet.getColumn(1).width = 20;
  instructionsSheet.getColumn(2).width = 30;
  instructionsSheet.getColumn(3).width = 25;
  instructionsSheet.getColumn(4).width = 20;

  return await workbook.xlsx.writeBuffer();
}

module.exports = {
  generateRoutineImportTemplate
};
