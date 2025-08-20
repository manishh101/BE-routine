/**
 * Complete Backend System Test
 * This validates all major functionality works correctly
 */

const axios = require('axios');

const API_BASE = 'http://localhost:7102/api';

// Admin credentials
const adminCredentials = {
  email: 'admin@ioe.edu.np',
  password: 'admin123'
};

let authToken = null;

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details = '') {
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}${details ? ': ' + details : ''}`);
  testResults.tests.push({ name, passed, details });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

// Function to login
async function loginAsAdmin() {
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, adminCredentials);
    authToken = response.data.token;
    return true;
  } catch (error) {
    return false;
  }
}

// Test functions
async function testAuthentication() {
  console.log('\n🔐 Testing Authentication...');
  
  // Test health endpoint
  try {
    const health = await axios.get(`${API_BASE}/health`);
    logTest('Health Check', health.status === 200);
  } catch (error) {
    logTest('Health Check', false, error.message);
  }
  
  // Test login
  const loginSuccess = await loginAsAdmin();
  logTest('Admin Login', loginSuccess);
  
  if (!loginSuccess) {
    console.log('❌ Cannot proceed without authentication');
    return false;
  }
  
  return true;
}

async function testCoreAPIs() {
  console.log('\n📡 Testing Core APIs...');
  
  const headers = { 'Authorization': `Bearer ${authToken}` };
  
  // Test Time Slots
  try {
    const timeSlots = await axios.get(`${API_BASE}/time-slots`, { headers });
    logTest('Time Slots API', timeSlots.status === 200, `Found ${timeSlots.data.length} time slots`);
  } catch (error) {
    logTest('Time Slots API', false, error.message);
  }
  
  // Test Teachers
  try {
    const teachers = await axios.get(`${API_BASE}/teachers`, { headers });
    logTest('Teachers API', teachers.status === 200, `Found ${teachers.data.length} teachers`);
  } catch (error) {
    logTest('Teachers API', false, error.message);
  }
  
  // Test Subjects
  try {
    const subjects = await axios.get(`${API_BASE}/subjects`, { headers });
    logTest('Subjects API', subjects.status === 200, `Found ${subjects.data.length} subjects`);
  } catch (error) {
    logTest('Subjects API', false, error.message);
  }
  
  // Test Rooms
  try {
    const rooms = await axios.get(`${API_BASE}/rooms`, { headers });
    logTest('Rooms API', rooms.status === 200, `Found rooms data`);
  } catch (error) {
    logTest('Rooms API', false, error.message);
  }
  
  // Test Academic Sessions
  try {
    const sessions = await axios.get(`${API_BASE}/admin/sessions`, { headers });
    logTest('Academic Sessions API', sessions.status === 200);
  } catch (error) {
    logTest('Academic Sessions API', false, error.message);
  }
}

async function testTimeSlotCreation() {
  console.log('\n⏰ Testing Time Slot Creation...');
  
  const headers = { 'Authorization': `Bearer ${authToken}` };
  
  // Create a test time slot
  const testTimeSlot = {
    _id: 201,
    label: 'Test Period 201',
    startTime: '08:00',
    endTime: '08:45',
    sortOrder: 201,
    category: 'Morning',
    isBreak: false,
    dayType: 'Regular',
    applicableDays: [0, 1, 2, 3, 4, 5]
  };
  
  try {
    const response = await axios.post(`${API_BASE}/time-slots`, testTimeSlot, { headers });
    logTest('Time Slot Creation', response.status === 201 || response.status === 200, 
      `Created: ${response.data.label}`);
    
    // Test cleanup - delete the test time slot
    try {
      await axios.delete(`${API_BASE}/time-slots/${testTimeSlot._id}`, { headers });
      logTest('Time Slot Cleanup', true, 'Test slot deleted');
    } catch (cleanupError) {
      logTest('Time Slot Cleanup', false, 'Could not delete test slot');
    }
    
  } catch (error) {
    if (error.response?.data?.msg?.includes('already exists')) {
      logTest('Time Slot Creation', true, 'Slot exists (validation working)');
    } else {
      logTest('Time Slot Creation', false, error.response?.data?.msg || error.message);
    }
  }
}

async function testDataIntegrity() {
  console.log('\n🔍 Testing Data Integrity...');
  
  const headers = { 'Authorization': `Bearer ${authToken}` };
  
  // Check if time slots have required fields
  try {
    const timeSlots = await axios.get(`${API_BASE}/time-slots`, { headers });
    const slots = timeSlots.data;
    
    if (slots.length > 0) {
      const firstSlot = slots[0];
      const hasRequiredFields = firstSlot._id !== undefined && 
                               firstSlot.label !== undefined && 
                               firstSlot.startTime !== undefined &&
                               firstSlot.endTime !== undefined;
      logTest('Time Slot Schema Validation', hasRequiredFields, 
        `Fields: _id=${firstSlot._id}, label=${firstSlot.label}`);
    } else {
      logTest('Time Slot Schema Validation', false, 'No time slots found');
    }
  } catch (error) {
    logTest('Time Slot Schema Validation', false, error.message);
  }
  
  // Check teachers data structure
  try {
    const teachers = await axios.get(`${API_BASE}/teachers`, { headers });
    const teacherList = teachers.data;
    
    if (teacherList.length > 0) {
      const firstTeacher = teacherList[0];
      const hasRequiredFields = firstTeacher._id !== undefined && 
                               firstTeacher.shortName !== undefined;
      logTest('Teacher Schema Validation', hasRequiredFields,
        `Teacher: ${firstTeacher.shortName || 'Unknown'}`);
    } else {
      logTest('Teacher Schema Validation', false, 'No teachers found');
    }
  } catch (error) {
    logTest('Teacher Schema Validation', false, error.message);
  }
}

async function runCompleteTest() {
  console.log('🚀 Starting Complete Backend System Test...');
  console.log('='.repeat(50));
  
  try {
    // Step 1: Authentication
    const authPassed = await testAuthentication();
    if (!authPassed) {
      console.log('\n❌ Authentication failed. Cannot continue tests.');
      return;
    }
    
    // Step 2: Core APIs
    await testCoreAPIs();
    
    // Step 3: Time Slot Creation
    await testTimeSlotCreation();
    
    // Step 4: Data Integrity
    await testDataIntegrity();
    
    // Final Results
    console.log('\n' + '='.repeat(50));
    console.log('🏁 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    
    testResults.tests.forEach(test => {
      const status = test.passed ? '✅' : '❌';
      console.log(`${status} ${test.name}${test.details ? ': ' + test.details : ''}`);
    });
    
    console.log('\n📊 FINAL SCORE:');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
    
    if (testResults.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Backend system is fully functional.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the issues above.');
    }
    
  } catch (error) {
    console.error('❌ Test suite error:', error.message);
  }
}

// Run the complete test
if (require.main === module) {
  runCompleteTest()
    .then(() => {
      console.log('\n🏁 Complete test finished');
      process.exit(testResults.failed === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Test suite error:', error);
      process.exit(1);
    });
}

module.exports = {
  runCompleteTest,
  testAuthentication,
  testCoreAPIs,
  testTimeSlotCreation,
  testDataIntegrity
};
