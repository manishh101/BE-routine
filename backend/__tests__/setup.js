// Jest test setup file
const mongoose = require('mongoose');

// Set test timeout
jest.setTimeout(30000);

// Setup test environment
beforeAll(async () => {
  // Any global setup for tests
});

afterAll(async () => {
  // Close database connections after all tests
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

// Global test utilities
global.expectValidObjectId = (id) => {
  expect(id).toBeDefined();
  expect(typeof id).toBe('string');
  expect(id).toMatch(/^[0-9a-fA-F]{24}$/);
};

global.expectValidDate = (date) => {
  expect(date).toBeDefined();
  expect(new Date(date)).toBeInstanceOf(Date);
  expect(new Date(date).toString()).not.toBe('Invalid Date');
};
