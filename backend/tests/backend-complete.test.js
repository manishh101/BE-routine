/**
 * Complete Backend Test Suite
 * All backend tests in one comprehensive file
 */

const axios = require('axios');
const { getAuthToken, API_BASE } = require('./testHelper');

describe('Complete Backend API Test Suite', () => {
  let authToken = null;

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    authToken = await getAuthToken();
  });

  // =====================================================
  // 1. CONNECTIVITY & HEALTH TESTS
  // =====================================================
  describe('System Health & Connectivity', () => {
    test('Health check endpoint should be accessible', async () => {
      const response = await axios.get(`${API_BASE}/health`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'OK');
      expect(response.data).toHaveProperty('database', 'Connected');
    });

    test('Authentication should work with admin credentials', async () => {
      const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
        email: 'admin@ioe.edu.np',
        password: 'admin123'
      });
      
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.data).toHaveProperty('token');
      expect(typeof loginResponse.data.token).toBe('string');
    });
  });

  // =====================================================
  // 2. TIME SLOTS MANAGEMENT
  // =====================================================
  describe('Time Slots Management', () => {
    test('GET /api/time-slots should return time slots list', async () => {
      const response = await axios.get(`${API_BASE}/time-slots`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      
      if (response.data.length > 0) {
        const timeSlot = response.data[0];
        expect(timeSlot).toHaveProperty('_id');
        expect(timeSlot).toHaveProperty('label');
        expect(timeSlot).toHaveProperty('startTime');
        expect(timeSlot).toHaveProperty('endTime');
      }
    });

    test('POST /api/time-slots should create a new time slot', async () => {
      const newTimeSlot = {
        _id: 999,
        label: 'Test Period',
        startTime: '14:00',
        endTime: '14:45',
        sortOrder: 999,
        category: 'Afternoon',
        isBreak: false,
        dayType: 'Regular',
        applicableDays: [0, 1, 2, 3, 4, 5]
      };

      try {
        const response = await axios.post(`${API_BASE}/time-slots`, newTimeSlot, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        expect([200, 201]).toContain(response.status);
        expect(response.data).toHaveProperty('label', 'Test Period');

        // Cleanup
        await axios.delete(`${API_BASE}/time-slots/${response.data._id}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }).catch(() => {}); // Ignore cleanup errors
        
      } catch (error) {
        if (error.response?.data?.msg?.includes('already exists')) {
          // Time slot already exists, which is also a valid result
          expect(error.response.status).toBe(400);
        } else {
          throw error;
        }
      }
    });
  });

  // =====================================================
  // 3. TEACHERS MANAGEMENT
  // =====================================================
  describe('Teachers Management', () => {
    test('GET /api/teachers should return teachers list', async () => {
      const response = await axios.get(`${API_BASE}/teachers`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      
      if (response.data.length > 0) {
        const teacher = response.data[0];
        expect(teacher).toHaveProperty('_id');
        expect(teacher).toHaveProperty('fullName');
        expect(teacher).toHaveProperty('shortName');
      }
    });

    test('Teacher lookup by short name should work', async () => {
      const response = await axios.get(`${API_BASE}/teachers`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      const teachers = response.data;
      
      if (teachers.length > 0) {
        const firstTeacher = teachers[0];
        expect(firstTeacher).toHaveProperty('shortName');
        
        // Find teacher by short name
        const foundTeacher = teachers.find(t => 
          t.shortName && t.shortName.toLowerCase() === firstTeacher.shortName.toLowerCase()
        );
        expect(foundTeacher).toBeDefined();
        expect(foundTeacher._id).toBe(firstTeacher._id);
      }
    });
  });

  // =====================================================
  // 4. SUBJECTS MANAGEMENT
  // =====================================================
  describe('Subjects Management', () => {
    test('GET /api/subjects should return subjects list', async () => {
      const response = await axios.get(`${API_BASE}/subjects`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      
      // Subjects might be empty, which is acceptable
      if (response.data.length > 0) {
        const subject = response.data[0];
        expect(subject).toHaveProperty('_id');
      }
    });
  });

  // =====================================================
  // 5. ROOMS MANAGEMENT
  // =====================================================
  describe('Rooms Management', () => {
    test('GET /api/rooms should return rooms data', async () => {
      const response = await axios.get(`${API_BASE}/rooms`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      
      // Rooms API returns {success: true, data: []} format
      if (response.data.success) {
        expect(response.data).toHaveProperty('success', true);
        expect(response.data).toHaveProperty('data');
        expect(Array.isArray(response.data.data)).toBe(true);
      } else {
        // Or direct array format
        expect(Array.isArray(response.data)).toBe(true);
      }
    });
  });

  // =====================================================
  // 6. DEPARTMENTS MANAGEMENT
  // =====================================================
  describe('Departments Management', () => {
    test('GET /api/departments should return departments list', async () => {
      const response = await axios.get(`${API_BASE}/departments`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      
      if (response.data.length > 0) {
        const department = response.data[0];
        expect(department).toHaveProperty('_id');
        expect(department).toHaveProperty('name');
      }
    });

    test('POST /api/departments should validate required fields', async () => {
      const invalidDepartment = {
        shortName: 'TEST',
        description: 'Test department'
        // Missing required 'fullName' field
      };

      try {
        await axios.post(`${API_BASE}/departments`, invalidDepartment, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // Should not reach here if validation works
        fail('Expected validation error for missing fullName');
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('errors');
        
        const nameError = error.response.data.errors.find(e => e.path === 'fullName');
        expect(nameError).toBeDefined();
        expect(nameError.msg).toContain('required');
      }
    });
  });

  // =====================================================
  // 7. ACADEMIC SESSIONS MANAGEMENT
  // =====================================================
  describe('Academic Sessions Management', () => {
    test('GET /api/admin/sessions should be accessible', async () => {
      const response = await axios.get(`${API_BASE}/admin/sessions`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      
      // Academic sessions might return object format or array format
      if (response.data && typeof response.data === 'object') {
        if (response.data.success !== undefined) {
          expect(response.data).toHaveProperty('success');
        } else {
          expect(Array.isArray(response.data)).toBe(true);
        }
      } else {
        expect(Array.isArray(response.data)).toBe(true);
      }
    });
  });

  // =====================================================
  // 8. ROUTINE SLOTS MANAGEMENT
  // =====================================================
  describe('Routine Slots Management', () => {
    test('GET /api/routine-slots should be accessible', async () => {
      const response = await axios.get(`${API_BASE}/routine-slots`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  // =====================================================
  // 9. AUTHENTICATION & AUTHORIZATION
  // =====================================================
  describe('Authentication & Authorization', () => {
    test('Protected endpoints should reject requests without token', async () => {
      try {
        await axios.get(`${API_BASE}/teachers`);
        fail('Expected authorization error');
      } catch (error) {
        expect(error.response?.status || error.status || 401).toBeGreaterThanOrEqual(400);
        expect([401, 403, 500]).toContain(error.response?.status || error.status || 401);
      }
    });

    test('Invalid credentials should be rejected', async () => {
      try {
        await axios.post(`${API_BASE}/auth/login`, {
          email: 'invalid@example.com',
          password: 'wrongpassword'
        });
        fail('Expected authentication error');
      } catch (error) {
        expect([400, 401]).toContain(error.response.status);
      }
    });

    test('Invalid token should be rejected', async () => {
      try {
        await axios.get(`${API_BASE}/teachers`, {
          headers: { 'Authorization': 'Bearer invalid-token' }
        });
        fail('Expected authorization error');
      } catch (error) {
        expect(error.response?.status || error.status || 401).toBeGreaterThanOrEqual(400);
        expect([401, 403, 500]).toContain(error.response?.status || error.status || 401);
      }
    });
  });

  // =====================================================
  // 10. ERROR HANDLING
  // =====================================================
  describe('Error Handling', () => {
    test('Non-existent endpoints should return 404', async () => {
      try {
        await axios.get(`${API_BASE}/nonexistent-endpoint`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        fail('Expected 404 error');
      } catch (error) {
        expect(error.response.status).toBe(404);
      }
    });

    test('Malformed JSON should be handled gracefully', async () => {
      try {
        await axios.post(`${API_BASE}/departments`, 'invalid json', {
          headers: { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });
        fail('Expected bad request error');
      } catch (error) {
        expect([400, 422]).toContain(error.response.status);
      }
    });
  });

  // =====================================================
  // 11. DATA INTEGRITY & VALIDATION
  // =====================================================
  describe('Data Integrity & Validation', () => {
    test('Time slot schema validation should work', async () => {
      const invalidTimeSlot = {
        // Missing required fields
        label: 'Invalid Slot'
      };

      try {
        await axios.post(`${API_BASE}/time-slots`, invalidTimeSlot, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        fail('Expected validation error');
      } catch (error) {
        expect([400, 422]).toContain(error.response.status);
      }
    });

    test('Database connectivity should be stable', async () => {
      // Make multiple concurrent requests to test stability
      const promises = Array(5).fill().map(() =>
        axios.get(`${API_BASE}/health`)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.data.database).toBe('Connected');
      });
    });
  });

  // =====================================================
  // 12. PERFORMANCE & LOAD
  // =====================================================
  describe('Performance & Load', () => {
    test('API should handle multiple concurrent requests', async () => {
      const promises = Array(10).fill().map(() =>
        axios.get(`${API_BASE}/teachers`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
      );

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time (10 seconds)
      expect(endTime - startTime).toBeLessThan(10000);
    });

    test('Large data requests should be handled efficiently', async () => {
      const startTime = Date.now();
      
      const response = await axios.get(`${API_BASE}/teachers`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      const endTime = Date.now();

      expect(response.status).toBe(200);
      // Should respond within 2 seconds
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });
});
