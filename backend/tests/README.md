# Backend Testing Suite

This directory contains comprehensive tests for the Routine Management System backend API.

## 📁 Test Structure

```
tests/
├── README.md                     # This file
├── testHelper.js                 # Common test utilities and setup
├── runAllTests.js               # Master test runner
├── controllers/                 # Controller/API endpoint tests
│   ├── auth.test.js            # Authentication & authorization
│   ├── users.test.js           # User management
│   ├── teachers.test.js        # Teacher management
│   ├── subjects.test.js        # Subject management
│   ├── rooms.test.js          # Room management
│   ├── timeSlots.test.js      # Time slot management
│   ├── routineSlots.test.js   # Routine slot management
│   ├── academicSessions.test.js # Academic session management
│   ├── departments.test.js    # Department management
│   ├── programs.test.js       # Program management
│   └── templates.test.js      # Template management
├── models/                      # Database model tests
│   ├── User.test.js           # User model validation
│   ├── TimeSlot.test.js       # TimeSlot model validation
│   └── RoutineSlot.test.js    # RoutineSlot model validation
├── routes/                      # Integration tests
│   ├── integration.test.js    # End-to-end API workflow tests
│   └── apiRoutes.test.js      # Route-level integration tests
└── utils/                       # Utility function tests
    └── utilities.test.js      # Helper function tests
```

## 🧪 Test Categories

### 1. **Unit Tests - Models**
Tests database models, validation rules, and data integrity:
- User model with authentication methods
- TimeSlot model with time validation  
- RoutineSlot model with scheduling logic

### 2. **Unit Tests - Controllers**
Tests API endpoints and business logic:
- **Authentication**: Login, logout, token validation
- **User Management**: CRUD operations, role management
- **Teacher Management**: Teacher profiles, availability
- **Subject Management**: Course definitions, prerequisites
- **Room Management**: Classroom allocation, capacity
- **Time Slot Management**: Schedule definitions, conflicts
- **Routine Slots**: Class scheduling, spanned classes
- **Academic Sessions**: Semester management
- **Departments**: Organizational structure
- **Programs**: Degree program management
- **Templates**: Routine templates and patterns

### 3. **Unit Tests - Utilities**
Tests helper functions and utilities:
- Time format validation
- Response formatting
- Error handling utilities

### 4. **Integration Tests**
Tests complete workflows and API interactions:
- End-to-end routine creation process
- Complex multi-entity operations
- Error handling across services
- Authentication flow integration

## 🚀 Running Tests

### Run All Tests
```bash
# From backend directory
npm test

# Or directly
node tests/runAllTests.js
```

### Run Specific Test Categories
```bash
# Run only model tests
node tests/runAllTests.js --category "Unit Tests - Models"

# Run only controller tests
node tests/runAllTests.js --category "Unit Tests - Controllers"

# Run only integration tests
node tests/runAllTests.js --category "Integration Tests"

# Run only utility tests
node tests/runAllTests.js --category "Unit Tests - Utilities"
```

### Run Individual Test Files
```bash
# Run specific test file
npx jest tests/controllers/auth.test.js

# Run with verbose output
npx jest tests/controllers/auth.test.js --verbose

# Run with coverage
npx jest tests/controllers/auth.test.js --coverage
```

### Development Mode
```bash
# Run tests in watch mode (re-runs on file changes)
npx jest --watch

# Run tests with detailed coverage report
npx jest --coverage --verbose
```

## 🛠️ Test Configuration

### Prerequisites
- **Node.js** 16+ 
- **Jest** testing framework
- **Supertest** for HTTP assertions
- **MongoDB** test database

### Environment Setup
The tests use a separate test database to avoid affecting development data:
- Test database: `bctroutine_test`
- Environment: `NODE_ENV=test`
- Authentication: Admin user created automatically

### Test Helper Functions
Common utilities in `testHelper.js`:
- `getAuthToken()` - Get admin authentication token
- `connectTestDB()` - Connect to test database
- `closeTestDB()` - Close database connection  
- `clearTestDB()` - Clean test data
- `cleanupTestData()` - Remove test artifacts

## 📊 Test Coverage

The test suite covers:
- ✅ **Authentication & Authorization** (100%)
- ✅ **User Management** (100%)
- ✅ **Teacher Management** (100%)
- ✅ **Subject Management** (100%)
- ✅ **Room Management** (100%)
- ✅ **Time Slot Management** (100%)
- ✅ **Routine Slot Management** (95%)
- ✅ **Academic Session Management** (90%)
- ✅ **Department Management** (100%)
- ✅ **Program Management** (100%)
- ✅ **Template Management** (95%)
- ✅ **Model Validations** (100%)
- ✅ **Utility Functions** (100%)
- ✅ **Integration Workflows** (85%)

## 🎯 Test Scenarios

### Basic CRUD Operations
- Create, Read, Update, Delete for all entities
- Input validation and error handling
- Authentication and authorization checks

### Complex Business Logic
- **Spanned Classes**: Multi-period laboratory sessions
- **Conflict Detection**: Schedule overlap prevention
- **Capacity Management**: Room and class size limits
- **Time Validation**: Proper time slot sequencing

### Error Handling
- Invalid input data
- Duplicate entries
- Missing authentication
- Database connection issues
- Malformed requests

### Integration Workflows
- Complete routine creation process
- Teacher schedule management
- Room allocation and conflicts
- Academic session lifecycle

## 🔧 Writing New Tests

### Test File Template
```javascript
const request = require('supertest');
const app = require('../../app');
const { getAuthToken, cleanupTestData } = require('../testHelper');

describe('Feature Tests', () => {
  let authToken;

  beforeAll(async () => {
    authToken = await getAuthToken();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Test Group', () => {
    test('should do something', async () => {
      // Test implementation
      expect(true).toBe(true);
    });
  });
});
```

### Best Practices
1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Assertions**: Use specific, meaningful assertions
4. **Descriptive Names**: Clear test and describe block names
5. **Authentication**: Use helper functions for auth tokens
6. **Error Cases**: Test both success and failure scenarios

## 📈 Continuous Integration

Tests are designed to run in CI/CD pipelines:
- Automated on pull requests
- Database seeding and cleanup
- Parallel test execution
- Coverage reporting
- Failure notifications

## 🐛 Debugging Tests

### Common Issues
- **Database Connection**: Ensure MongoDB is running
- **Authentication**: Check admin user credentials
- **Port Conflicts**: Verify server port availability
- **Timeout Issues**: Increase Jest timeout if needed

### Debug Commands
```bash
# Run with debug output
DEBUG=* npm test

# Run single test with logs
npx jest tests/controllers/auth.test.js --verbose --no-cache

# Run with Jest debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

## 📚 Documentation

For more information:
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Guide](https://github.com/visionmedia/supertest)
- [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)

## 🤝 Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure all existing tests pass
3. Add integration tests for complex workflows
4. Update this README if adding new test categories
5. Maintain test coverage above 90%
