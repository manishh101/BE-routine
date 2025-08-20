/**
 * Test Helper Utilities
 * Common functions and configurations for all tests
 */

const axios = require('axios');
const mongoose = require('mongoose');

const API_BASE = 'http://localhost:7102/api';

// Admin credentials for testing
const adminCredentials = {
  email: 'admin@ioe.edu.np',
  password: 'admin123'
};

// Test database helper functions
async function connectTestDB() {
  try {
    if (mongoose.connection.readyState === 0) {
      // Use test database or existing connection
      console.log('Test DB: Using existing connection');
    }
    return true;
  } catch (error) {
    console.error('Test DB connection failed:', error.message);
    return false;
  }
}

async function clearTestDB() {
  try {
    // For testing, we'll just log instead of actually clearing
    console.log('Test DB: Cleanup simulated');
    return true;
  } catch (error) {
    console.error('Test DB cleanup failed:', error.message);
    return false;
  }
}

async function closeTestDB() {
  try {
    // For testing, we'll just log instead of actually closing
    console.log('Test DB: Connection close simulated');
    return true;
  } catch (error) {
    console.error('Test DB close failed:', error.message);
    return false;
  }
}

// Authentication helper
async function getAuthToken() {
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, adminCredentials);
    return response.data.token;
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    throw new Error('Failed to get auth token');
  }
}

// Test data templates
const testData = {
  teacher: {
    name: 'Test Teacher',
    shortName: 'TT',
    email: 'test@ioe.edu.np',
    department: 'Computer Engineering',
    position: 'Lecturer',
    isActive: true
  },
  subject: {
    code: 'TEST101',
    name: 'Test Subject',
    creditHours: 3,
    type: 'Theory',
    year: 4,
    semester: 7,
    isActive: true
  },
  room: {
    number: 'TEST-101',
    name: 'Test Room',
    capacity: 60,
    type: 'Classroom',
    isActive: true
  },
  timeSlot: {
    startTime: '10:15',
    endTime: '11:00',
    slotIndex: 0,
    displayName: '10:15-11:00 AM',
    category: 'CLASS',
    isActive: true
  }
};

/**
 * Login as admin and return auth token
 */
async function loginAsAdmin() {
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, adminCredentials);
    return response.data.token;
  } catch (error) {
    console.error('Login failed:', error.message);
    throw error;
  }
}

/**
 * Make authenticated API request
 */
async function makeAuthenticatedRequest(method, endpoint, data = null, token = null) {
  if (!token) {
    token = await loginAsAdmin();
  }

  const config = {
    method,
    url: `${API_BASE}${endpoint}`,
    headers: { 'Authorization': `Bearer ${token}` }
  };

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return {
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Test API endpoint availability
 */
async function testEndpointAvailability(endpoint) {
  try {
    const response = await axios.get(`${API_BASE}${endpoint}`);
    return {
      available: true,
      status: response.status
    };
  } catch (error) {
    return {
      available: false,
      status: error.response?.status,
      error: error.message
    };
  }
}

/**
 * Clean up test data
 */
async function cleanupTestData(token, resourceType, createdItems = []) {
  console.log(`Cleaning up ${resourceType} test data...`);
  
  for (const item of createdItems) {
    try {
      await makeAuthenticatedRequest('DELETE', `/${resourceType}/${item._id}`, null, token);
      console.log(`✅ Deleted ${resourceType}: ${item._id}`);
    } catch (error) {
      console.log(`⚠️ Failed to delete ${resourceType}: ${item._id}`);
    }
  }
}

/**
 * Wait for a specified amount of time
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate random test data
 */
function generateRandomString(length = 8) {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Validate response structure
 */
function validateResponse(response, expectedFields = []) {
  const errors = [];
  
  if (!response.success && response.status >= 400) {
    errors.push(`Request failed with status ${response.status}`);
  }
  
  if (response.success && response.data) {
    for (const field of expectedFields) {
      if (!(field in response.data)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  API_BASE,
  adminCredentials,
  testData,
  connectTestDB,
  clearTestDB,
  closeTestDB,
  getAuthToken,
  loginAsAdmin,
  makeAuthenticatedRequest,
  testEndpointAvailability,
  cleanupTestData,
  wait,
  generateRandomString,
  validateResponse
};
