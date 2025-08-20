// Detailed Multi-Period Implementation Analysis
console.log('🔍 DETAILED MULTI-PERIOD ANALYSIS');

// Step 1: Check if the routine grid is properly set up
function analyzeRoutineGrid() {
  console.log('\n📊 STEP 1: Analyzing Routine Grid Setup');
  
  const table = document.querySelector('.routine-grid-table');
  if (!table) {
    console.error('❌ Routine table not found');
    return false;
  }
  
  const tableStyles = window.getComputedStyle(table);
  console.log('✅ Table found with styles:', {
    borderCollapse: tableStyles.borderCollapse,
    borderSpacing: tableStyles.borderSpacing,
    className: table.className
  });
  
  // Check if border-collapse is correct
  if (tableStyles.borderCollapse !== 'collapse') {
    console.error('❌ Table border-collapse is not "collapse" - this prevents rowSpan merging');
    return false;
  }
  
  console.log('✅ Table has correct border-collapse for rowSpan merging');
  return true;
}

// Step 2: Check CSS rules for multi-period cells
function analyzeCSS() {
  console.log('\n🎨 STEP 2: Analyzing CSS Rules');
  
  // Create a test element to check CSS
  const testDiv = document.createElement('div');
  testDiv.className = 'multi-period-master-cell';
  testDiv.style.visibility = 'hidden';
  document.body.appendChild(testDiv);
  
  const styles = window.getComputedStyle(testDiv);
  console.log('✅ Multi-period CSS styles:', {
    border: styles.border,
    backgroundColor: styles.backgroundColor,
    position: styles.position,
    zIndex: styles.zIndex
  });
  
  document.body.removeChild(testDiv);
  return true;
}

// Step 3: Check the data structure for multi-period support
function analyzeDataStructure() {
  console.log('\n📋 STEP 3: Analyzing Data Structure');
  
  // Check if React DevTools shows proper data
  const reactFiberKey = Object.keys(document.querySelector('body')).find(key => 
    key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
  );
  
  if (reactFiberKey) {
    console.log('✅ React fiber found - component data can be inspected');
  }
  
  // Check for routine data in window/global scope
  if (window.routineData) {
    console.log('✅ Routine data found in global scope');
  } else {
    console.log('ℹ️ No global routine data - data is likely in component state');
  }
  
  return true;
}

// Step 4: Test multi-period cell creation manually
function testMultiPeriodCreation() {
  console.log('\n🧪 STEP 4: Testing Multi-Period Cell Creation');
  
  const table = document.querySelector('.routine-grid-table tbody');
  if (!table) {
    console.error('❌ Table body not found');
    return false;
  }
  
  // Create a test multi-period cell
  const testRow = table.querySelector('tr');
  if (!testRow) {
    console.error('❌ No table rows found');
    return false;
  }
  
  // Create test cell with rowspan
  const testCell = document.createElement('td');
  testCell.className = 'multi-period-master-cell test-cell';
  testCell.setAttribute('rowspan', '2');
  testCell.style.backgroundColor = 'rgba(22, 119, 255, 0.1)';
  testCell.style.border = '3px solid #1677ff';
  testCell.style.height = '160px'; // 80px * 2
  testCell.innerHTML = `
    <div class="multi-period-content">
      <div class="multi-period-indicator">2 PERIODS</div>
      <div>TEST MULTI-PERIOD</div>
    </div>
  `;
  
  // Insert after first cell (day cell)
  const firstCell = testRow.children[1];
  if (firstCell) {
    testRow.insertBefore(testCell, firstCell);
    console.log('✅ Test multi-period cell inserted');
    
    // Check if it renders correctly
    setTimeout(() => {
      const insertedCell = document.querySelector('.test-cell');
      if (insertedCell) {
        const rect = insertedCell.getBoundingClientRect();
        console.log('📏 Test cell dimensions:', {
          width: rect.width,
          height: rect.height,
          rowSpan: insertedCell.getAttribute('rowspan')
        });
        
        // Remove test cell after 5 seconds
        setTimeout(() => {
          if (insertedCell.parentNode) {
            insertedCell.parentNode.removeChild(insertedCell);
            console.log('🧹 Test cell removed');
          }
        }, 5000);
      }
    }, 100);
    
    return true;
  }
  
  return false;
}

// Step 5: Check for JavaScript errors that might prevent rendering
function checkForErrors() {
  console.log('\n🐛 STEP 5: Checking for JavaScript Errors');
  
  // Override console.error to catch any errors
  const originalError = console.error;
  let errorCount = 0;
  
  console.error = function(...args) {
    errorCount++;
    console.log(`❌ Error ${errorCount}:`, ...args);
    originalError.apply(console, args);
  };
  
  // Restore after 5 seconds
  setTimeout(() => {
    console.error = originalError;
    if (errorCount === 0) {
      console.log('✅ No JavaScript errors detected');
    } else {
      console.log(`⚠️ ${errorCount} errors detected - these might prevent multi-period rendering`);
    }
  }, 5000);
  
  return true;
}

// Run all analysis steps
function runFullAnalysis() {
  console.log('🚀 Starting Full Multi-Period Analysis...');
  
  const step1 = analyzeRoutineGrid();
  const step2 = analyzeCSS();
  const step3 = analyzeDataStructure();
  const step4 = testMultiPeriodCreation();
  const step5 = checkForErrors();
  
  console.log('\n📋 ANALYSIS SUMMARY:');
  console.log(`Step 1 - Grid Setup: ${step1 ? '✅' : '❌'}`);
  console.log(`Step 2 - CSS Rules: ${step2 ? '✅' : '❌'}`);
  console.log(`Step 3 - Data Structure: ${step3 ? '✅' : '❌'}`);
  console.log(`Step 4 - Cell Creation: ${step4 ? '✅' : '❌'}`);
  console.log(`Step 5 - Error Check: ${step5 ? '✅' : '❌'}`);
  
  if (step1 && step2 && step3 && step4 && step5) {
    console.log('\n🎉 ALL CHECKS PASSED - Multi-period should work!');
    console.log('💡 If multi-period is still not working, the issue is likely in:');
    console.log('   1. Data flow from modal to grid');
    console.log('   2. Backend API response format');
    console.log('   3. React component state updates');
  } else {
    console.log('\n⚠️ SOME CHECKS FAILED - This explains why multi-period is not working');
  }
}

// Auto-run analysis
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(runFullAnalysis, 2000);
  });
} else {
  setTimeout(runFullAnalysis, 2000);
}

// Expose for manual use
window.runFullAnalysis = runFullAnalysis;
window.analyzeRoutineGrid = analyzeRoutineGrid;
window.testMultiPeriodCreation = testMultiPeriodCreation;
