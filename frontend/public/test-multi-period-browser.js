// Test script to run in browser console for multi-period functionality testing
console.log('🧪 Multi-Period Visual Merging Test Script');

// Function to test if multi-period rendering is working
async function testMultiPeriodRendering() {
  console.log('🔍 Testing Multi-Period Rendering...');
  
  // Check if we're on the routine page
  const routineTable = document.querySelector('.routine-grid-table');
  if (!routineTable) {
    console.error('❌ Routine table not found. Make sure you\'re on the routine page.');
    return;
  }
  
  console.log('✅ Routine table found');
  
  // Check table styles
  const tableStyles = window.getComputedStyle(routineTable);
  console.log('📊 Table Styles:', {
    borderCollapse: tableStyles.borderCollapse,
    borderSpacing: tableStyles.borderSpacing
  });
  
  // Check for existing multi-period cells
  const multiPeriodCells = document.querySelectorAll('.multi-period-master-cell');
  console.log(`📋 Found ${multiPeriodCells.length} multi-period master cells`);
  
  if (multiPeriodCells.length > 0) {
    multiPeriodCells.forEach((cell, index) => {
      const rowSpan = cell.getAttribute('rowspan');
      const styles = window.getComputedStyle(cell);
      console.log(`🎯 Multi-period cell ${index + 1}:`, {
        rowSpan: rowSpan,
        height: styles.height,
        border: styles.border,
        backgroundColor: styles.backgroundColor,
        className: cell.className
      });
    });
  } else {
    console.log('ℹ️ No multi-period cells found. Let\'s test creating one...');
  }
  
  // Find an empty cell to test with
  const emptyCells = document.querySelectorAll('.class-cell-container:not(.has-class)');
  if (emptyCells.length > 0) {
    console.log(`✅ Found ${emptyCells.length} empty cells available for testing`);
    const testCell = emptyCells[0];
    console.log('🎯 First empty cell found:', testCell);
    
    // Simulate clicking on it
    console.log('🖱️ You can click on any empty cell to open the assignment modal');
    console.log('🔧 Then enable multi-period and set duration > 1 to test');
  }
}

// Function to monitor for DOM changes (multi-period cells appearing)
function monitorMultiPeriodChanges() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        const addedNodes = Array.from(mutation.addedNodes);
        addedNodes.forEach((node) => {
          if (node.classList && node.classList.contains('multi-period-master-cell')) {
            console.log('🎉 NEW MULTI-PERIOD CELL DETECTED!', node);
            
            const rowSpan = node.getAttribute('rowspan');
            const styles = window.getComputedStyle(node);
            console.log('📊 New cell details:', {
              rowSpan: rowSpan,
              height: styles.height,
              border: styles.border,
              position: node.getBoundingClientRect()
            });
          }
        });
      }
    });
  });
  
  const routineTable = document.querySelector('.routine-grid-table');
  if (routineTable) {
    observer.observe(routineTable, { childList: true, subtree: true });
    console.log('👀 Monitoring for multi-period cell changes...');
  }
}

// Function to simulate multi-period class creation (for testing)
function simulateMultiPeriodCreation() {
  console.log('🎭 Simulating multi-period class creation...');
  
  // This would create a test multi-period cell
  const testData = {
    dayIndex: 1, // Monday
    slotIndex: 0, // First slot
    duration: 2, // 2 periods
    spanId: 'test-span-' + Date.now(),
    classData: {
      classType: 'L',
      subjectName: 'Test Multi-Period Subject',
      teacherNames: ['Test Teacher'],
      roomName: 'Test Room'
    }
  };
  
  console.log('📝 Test data prepared:', testData);
  console.log('💡 To test: Open assignment modal and create a 2-period class');
}

// Auto-run initial test
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    testMultiPeriodRendering();
    monitorMultiPeriodChanges();
  }, 1000);
});

// If DOM already loaded
if (document.readyState !== 'loading') {
  setTimeout(() => {
    testMultiPeriodRendering();
    monitorMultiPeriodChanges();
  }, 1000);
}

// Expose functions for manual testing
window.testMultiPeriodRendering = testMultiPeriodRendering;
window.simulateMultiPeriodCreation = simulateMultiPeriodCreation;
window.monitorMultiPeriodChanges = monitorMultiPeriodChanges;

console.log('🔧 Functions available:');
console.log('- testMultiPeriodRendering() - Check current state');
console.log('- simulateMultiPeriodCreation() - Log test data');
console.log('- monitorMultiPeriodChanges() - Watch for DOM changes');
console.log('');
console.log('📋 Testing Steps:');
console.log('1. Click on any empty cell in the routine grid');
console.log('2. In the modal, toggle "Enable Multi-Period"');
console.log('3. Set duration to 2 or 3 periods');
console.log('4. Fill subject, teacher, room details');
console.log('5. Save and observe if cells merge visually');
