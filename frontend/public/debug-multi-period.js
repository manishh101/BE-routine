// Debug script to verify multi-period visual merging
console.log('🔧 Multi-Period Visual Merging Debug Script');

// Function to test CSS and DOM for multi-period cells
function debugMultiPeriodCells() {
  console.log('📊 Checking for multi-period cells...');
  
  // Find all multi-period master cells
  const masterCells = document.querySelectorAll('.multi-period-master-cell');
  console.log(`Found ${masterCells.length} multi-period master cells`);
  
  masterCells.forEach((cell, index) => {
    const rowSpan = cell.getAttribute('rowspan');
    const computedStyles = window.getComputedStyle(cell);
    
    console.log(`Multi-period cell ${index + 1}:`, {
      rowSpan: rowSpan,
      height: computedStyles.height,
      border: computedStyles.border,
      backgroundColor: computedStyles.backgroundColor,
      borderCollapse: computedStyles.borderCollapse,
      verticalAlign: computedStyles.verticalAlign,
      className: cell.className,
      cellRect: cell.getBoundingClientRect()
    });
  });
  
  // Check table border-collapse
  const table = document.querySelector('.routine-grid-table');
  if (table) {
    const tableStyles = window.getComputedStyle(table);
    console.log('Table styles:', {
      borderCollapse: tableStyles.borderCollapse,
      borderSpacing: tableStyles.borderSpacing
    });
  }
  
  // Check for visual merging
  console.log('🎯 Visual Merging Check:');
  console.log('✓ Multi-period cells should have rowSpan > 1');
  console.log('✓ Non-master cells should not be rendered (skipped)');
  console.log('✓ Table should have border-collapse: collapse');
  console.log('✓ Multi-period cells should have distinctive border');
}

// Function to simulate a multi-period class creation
function simulateMultiPeriodCreation() {
  console.log('🧪 Simulating multi-period class creation...');
  
  // This would be called when the user creates a multi-period class
  const sampleMultiPeriodData = {
    dayIndex: 1,
    slotIndex: 0,
    duration: 2,
    isMultiPeriod: true,
    classData: {
      subject: 'Sample Multi-Period Subject',
      teacher: 'Sample Teacher',
      room: 'Sample Room',
      classType: 'L'
    }
  };
  
  console.log('Sample multi-period data:', sampleMultiPeriodData);
  console.log('This should create a cell with rowSpan=2 and blue border');
}

// Auto-run when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(debugMultiPeriodCells, 2000);
  });
} else {
  setTimeout(debugMultiPeriodCells, 2000);
}

// Expose functions globally for manual testing
window.debugMultiPeriodCells = debugMultiPeriodCells;
window.simulateMultiPeriodCreation = simulateMultiPeriodCreation;

console.log('🔧 Debug functions available:');
console.log('- debugMultiPeriodCells() - Check current multi-period cells');
console.log('- simulateMultiPeriodCreation() - Log sample creation data');
