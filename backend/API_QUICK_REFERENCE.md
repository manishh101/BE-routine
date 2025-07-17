# 🚀 IOE Routine Management API - Quick Reference Guide

## Base URL: `http://localhost:7102/api`

## 🔐 Authentication
All requests (except public endpoints) require JWT token in header:
```
Authorization: Bearer <your-jwt-token>
```

### Get Token
```bash
POST /auth/login
{
  "email": "admin@ioe.edu.np",
  "password": "admin123"
}
```

---

## 📋 Quick API Reference

### 🏛️ **Departments**
| Method | Endpoint | Access | Description |
|--------|----------|---------|-------------|
| GET | `/departments` | Private | List all departments |
| POST | `/departments` | Admin | Create department |
| GET | `/departments/:id` | Private | Get department |
| PUT | `/departments/:id` | Admin | Update department |
| DELETE | `/departments/:id` | Admin | Delete department |
| GET | `/departments/:id/teachers` | Private | Get department teachers |

### 👥 **Teachers**
| Method | Endpoint | Access | Description |
|--------|----------|---------|-------------|
| GET | `/teachers` | Private | List all teachers |
| POST | `/teachers` | Admin | Create teacher |
| GET | `/teachers/:id` | Private | Get teacher |
| PUT | `/teachers/:id` | Admin | Update teacher |
| DELETE | `/teachers/bulk` | Admin | Delete multiple teachers |
| DELETE | `/teachers/department/:departmentId` | Admin | Delete teachers by department |
| DELETE | `/teachers/:id` | Admin | Delete teacher |
| GET | `/teachers/:id/schedule` | Private | Get teacher schedule |
| GET | `/teachers/:id/workload` | Private | Get workload analysis |

### 📚 **Programs**
| Method | Endpoint | Access | Description |
|--------|----------|---------|-------------|
| GET | `/programs` | Private | List all programs |
| POST | `/programs` | Admin | Create program |
| GET | `/programs/:id` | Private | Get program |
| PUT | `/programs/:id` | Admin | Update program |
| DELETE | `/programs/:id` | Admin | Delete program |

### 📖 **Subjects**
| Method | Endpoint | Access | Description |
|--------|----------|---------|-------------|
| GET | `/subjects` | Private | List all subjects |
| POST | `/subjects` | Admin | Create subject |
| POST | `/subjects/bulk` | Admin | Create multiple subjects |
| GET | `/subjects/:id` | Private | Get subject |
| GET | `/subjects/program/:programId` | Private | Get subjects by program |
| GET | `/subjects/semester/:semester` | Private | Get subjects by semester |
| GET | `/subjects/shared` | Private | Get shared subjects |
| POST | `/subjects/by-programs` | Private | Get subjects by multiple programs |
| PUT | `/subjects/:id` | Admin | Update subject |
| DELETE | `/subjects/bulk` | Admin | Delete multiple subjects |
| DELETE | `/subjects/program/:programId` | Admin | Delete subjects by program |
| DELETE | `/subjects/:id` | Admin | Delete subject |

### 🏢 **Rooms**
| Method | Endpoint | Access | Description |
|--------|----------|---------|-------------|
| GET | `/rooms` | Public | List all rooms |
| POST | `/rooms` | Admin | Create room |
| GET | `/rooms/:id` | Public | Get room |
| PUT | `/rooms/:id` | Admin | Update room |
| DELETE | `/rooms/:id` | Admin | Delete room |

### ⏰ **Time Slots**
| Method | Endpoint | Access | Description |
|--------|----------|---------|-------------|
| GET | `/time-slots` | Private | List all time slots |
| POST | `/time-slots` | Admin | Create time slot |
| GET | `/time-slots/:id` | Private | Get time slot |
| PUT | `/time-slots/:id` | Admin | Update time slot |
| DELETE | `/time-slots/bulk` | Admin | Bulk delete time slots |
| DELETE | `/time-slots/:id` | Admin | Delete time slot |

### 📅 **Routine Management**
| Method | Endpoint | Access | Description |
|--------|----------|---------|-------------|
| GET | `/routines/:programCode` | Public | Get program routines |
| POST | `/routines/:programCode/:semester/:section/assign` | Admin | Assign class |
| DELETE | `/routines/:programCode/:semester/:section/clear` | Admin | Clear class |
| POST | `/routines/assign-class-spanned` | Admin | Assign multi-period class |
| GET | `/routines/teachers/:teacherId/availability` | Public | Check teacher availability |
| GET | `/routines/rooms/:roomId/availability` | Public | Check room availability |

### 🎯 **Routine Slots**
| Method | Endpoint | Access | Description |
|--------|----------|---------|-------------|
| GET | `/routine-slots` | Private | List routine slots |
| POST | `/routine-slots` | Admin | Create routine slot |
| GET | `/routine-slots/schedule/weekly` | Private | Get weekly schedule |
| POST | `/routine-slots/check-conflicts` | Admin | Check conflicts |
| POST | `/routine-slots/bulk` | Admin | Bulk create slots |

### 👥 **Users**
| Method | Endpoint | Access | Description |
|--------|----------|---------|-------------|
| GET | `/users` | Admin | List all users |
| POST | `/users` | Admin | Create user |
| GET | `/users/:id` | Private | Get user |
| DELETE | `/users/:id` | Admin | Delete user |

### 🔍 **System**
| Method | Endpoint | Access | Description |
|--------|----------|---------|-------------|
| GET | `/health` | Public | System health check |
| GET | `/auth/me` | Private | Get current user |

---

## � **Advanced Subject Operations**

### Bulk Creation Examples
```bash
# Bulk create with direct array
curl -X POST http://localhost:7102/api/subjects/bulk \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"name":"Subject 1","code":"S001","programId":["6866b1dcc39639d7a7c76cb8"],"semester":1,"credits":{"theory":3,"practical":0,"tutorial":0},"weeklyHours":{"theory":3,"practical":0,"tutorial":0}}]'

# Bulk create with wrapped format
curl -X POST http://localhost:7102/api/subjects/bulk \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subjects":[{"name":"Subject 1","code":"S001","programId":["6866b1dcc39639d7a7c76cb8"],"semester":1,"credits":{"theory":3,"practical":0,"tutorial":0},"weeklyHours":{"theory":3,"practical":0,"tutorial":0}}]}'
```

### Bulk Deletion Examples
```bash
# Delete specific subjects by IDs
curl -X DELETE http://localhost:7102/api/subjects/bulk \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '["subject_id_1","subject_id_2"]'

# Delete all subjects of a program
curl -X DELETE http://localhost:7102/api/subjects/program/6866b1dcc39639d7a7c76cb8 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Subject Filtering Examples
```bash
# Get subjects by program
curl http://localhost:7102/api/subjects/program/6866b1dcc39639d7a7c76cb8 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get subjects by semester
curl http://localhost:7102/api/subjects/semester/4 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get shared subjects (subjects belonging to multiple programs)
curl http://localhost:7102/api/subjects/shared \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔥 **Advanced Teacher Operations**

### Teacher Bulk Deletion Examples
```bash
# Delete specific teachers by IDs
curl -X DELETE http://localhost:7102/api/teachers/bulk \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '["teacher_id_1","teacher_id_2"]'

# Delete all teachers of a department
curl -X DELETE http://localhost:7102/api/teachers/department/department_id_here \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Teacher Filtering Examples
```bash
# Get teachers by department
curl http://localhost:7102/api/departments/department_id/teachers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get teacher schedule
curl http://localhost:7102/api/teachers/teacher_id/schedule \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get teacher workload analysis
curl http://localhost:7102/api/teachers/teacher_id/workload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## ⏰ **Advanced Time Slots Operations**

### Time Slots Bulk Deletion Examples
```bash
# Delete specific time slots by IDs
curl -X DELETE http://localhost:7102/api/time-slots/bulk \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[1,2,3]'

# Delete time slots with wrapped format
curl -X DELETE http://localhost:7102/api/time-slots/bulk \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"timeSlotIds":[1,2,3]}'
```

### Time Slots Filtering Examples
```bash
# Get regular (non-break) time slots
curl http://localhost:7102/api/time-slots?isBreak=false \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get break time slots
curl http://localhost:7102/api/time-slots?isBreak=true \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get time slots by category
curl http://localhost:7102/api/time-slots?category=Morning \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## �📊 Common Query Parameters

### Pagination
```
?page=1&limit=10
```

### Filtering
```
?department=ObjectId
?semester=4
?section=A
?programId=ObjectId
```

### Sorting
```
?sort=name
?sort=-createdAt
```

---

## 💾 Sample Request Bodies

### Create Department
```json
{
  "code": "DOE",
  "name": "Electronics & Computer",
  "fullName": "Department of Electronics & Computer Engineering",
  "contactEmail": "doe@ioe.edu.np"
}
```

### Create Teacher
```json
{
  "fullName": "Dr. John Smith",
  "shortName": "JS",
  "email": "john.smith@ioe.edu.np",
  "departmentId": "ObjectId",
  "designation": "Professor"
}
```

### Bulk Delete Teachers by IDs
```json
[
  "teacher_id_1",
  "teacher_id_2"
]
```

### Bulk Delete Teachers (Wrapped Format)
```json
{
  "teacherIds": [
    "teacher_id_1",
    "teacher_id_2"
  ]
}
```

### Create Subject
```json
{
  "name": "Data Structures and Algorithms",
  "code": "CT461",
  "programId": ["6866b1dcc39639d7a7c76cb8"],
  "semester": 4,
  "credits": {
    "theory": 3,
    "practical": 1,
    "tutorial": 0
  },
  "weeklyHours": {
    "theory": 3,
    "practical": 3,
    "tutorial": 0
  }
}
```

### Bulk Create Subjects (Direct Array)
```json
[
  {
    "name": "Subject 1",
    "code": "SUB001",
    "programId": ["6866b1dcc39639d7a7c76cb8"],
    "semester": 1,
    "credits": {
      "theory": 3,
      "practical": 0,
      "tutorial": 0
    },
    "weeklyHours": {
      "theory": 3,
      "practical": 0,
      "tutorial": 0
    }
  },
  {
    "name": "Subject 2",
    "code": "SUB002",
    "programId": ["6866b1dcc39639d7a7c76cb8"],
    "semester": 1,
    "credits": {
      "theory": 2,
      "practical": 1,
      "tutorial": 0
    },
    "weeklyHours": {
      "theory": 2,
      "practical": 2,
      "tutorial": 0
    }
  }
]
```

### Bulk Create Subjects (Wrapped Format)
```json
{
  "subjects": [
    {
      "name": "Subject 1",
      "code": "SUB001",
      "programId": ["6866b1dcc39639d7a7c76cb8"],
      "semester": 1,
      "credits": {
        "theory": 3,
        "practical": 0,
        "tutorial": 0
      },
      "weeklyHours": {
        "theory": 3,
        "practical": 0,
        "tutorial": 0
      }
    }
  ]
}
```

### Bulk Delete Subjects by IDs
```json
[
  "subject_id_1",
  "subject_id_2"
]
```

### Bulk Delete Subjects (Wrapped Format)
```json
{
  "subjectIds": [
    "subject_id_1",
    "subject_id_2"
  ]
}
```

### Get Subjects by Multiple Programs
```json
{
  "programIds": [
    "6866b1dcc39639d7a7c76cb8",
    "another_program_id"
  ]
}
```

### Assign Class
```json
{
  "dayIndex": 1,
  "slotIndex": 3,
  "subjectId": "ObjectId",
  "teacherIds": ["ObjectId"],
  "roomId": "ObjectId",
  "classType": "L"
}
```

### Create Time Slot
```json
{
  "_id": 1,
  "label": "1st Period",
  "startTime": "07:10",
  "endTime": "08:05",
  "sortOrder": 1,
  "dayType": "Regular",
  "isBreak": false,
  "category": "Morning"
}
```

### Bulk Delete Time Slots by IDs
```json
[
  1,
  2,
  3
]
```

### Bulk Delete Time Slots (Wrapped Format)
```json
{
  "timeSlotIds": [
    1,
    2,
    3
  ]
}
```

---

## 🎯 Response Formats

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ }
}
```

### Bulk Creation Success Response
```json
{
  "success": true,
  "message": "Successfully created 5 subjects",
  "insertedCount": 5,
  "subjects": [
    {
      "_id": "subject_id",
      "name": "Subject Name",
      "code": "SUB001",
      "programId": ["6866b1dcc39639d7a7c76cb8"],
      "semester": 1,
      "credits": {
        "theory": 3,
        "practical": 0,
        "tutorial": 0
      },
      "weeklyHours": {
        "theory": 3,
        "practical": 0,
        "tutorial": 0
      }
    }
  ]
}
```

### Bulk Deletion Success Response
```json
{
  "success": true,
  "message": "Successfully deleted 3 subjects",
  "deletedCount": 3,
  "deletedSubjects": [
    {
      "id": "subject_id_1",
      "name": "Subject 1",
      "code": "SUB001"
    }
  ],
  "notFoundIds": [],
  "notFoundCount": 0
}
```

### Program Deletion Success Response
```json
{
  "success": true,
  "message": "Program cleanup completed: 50 subjects deleted, 5 subjects updated",
  "programId": "6866b1dcc39639d7a7c76cb8",
  "deletedCount": 50,
  "updatedCount": 5,
  "totalProcessed": 55,
  "deletedSubjects": [
    {
      "id": "subject_id",
      "name": "Subject Name",
      "code": "SUB001",
      "action": "deleted"
    }
  ],
  "updatedSubjects": [
    {
      "id": "subject_id",
      "name": "Shared Subject",
      "code": "SHARED001",
      "action": "updated",
      "remainingPrograms": 2
    }
  ]
}
```

### Teacher Bulk Deletion Success Response
```json
{
  "success": true,
  "message": "Successfully deactivated 3 teachers, 1 skipped due to constraints",
  "deactivatedCount": 3,
  "deactivatedTeachers": [
    {
      "id": "teacher_id_1",
      "name": "Dr. John Smith",
      "email": "john.smith@ioe.edu.np"
    }
  ],
  "skippedTeachers": [
    {
      "id": "teacher_id_2",
      "name": "Dr. Jane Doe",
      "reason": "Assigned to 5 active routine slots"
    }
  ],
  "notFoundIds": [],
  "notFoundCount": 0
}
```

### Time Slots Bulk Deletion Success Response
```json
{
  "success": true,
  "message": "Successfully deleted 2 time slots, 1 skipped due to constraints",
  "deletedCount": 2,
  "deletedTimeSlots": [
    {
      "id": 1,
      "label": "1st Period",
      "startTime": "07:10",
      "endTime": "08:05"
    },
    {
      "id": 2,
      "label": "2nd Period",
      "startTime": "08:05",
      "endTime": "09:00"
    }
  ],
  "skippedTimeSlots": [
    {
      "id": 3,
      "label": "3rd Period",
      "startTime": "09:15",
      "endTime": "10:10",
      "reason": "Used in 5 active routine slots"
    }
  ],
  "skippedCount": 1,
  "notFoundIds": [],
  "notFoundCount": 0,
  "totalProcessed": 3
}
```

### Teacher Department Deletion Success Response
```json
{
  "success": true,
  "message": "Department cleanup completed: 5 teachers deactivated, 2 skipped due to constraints",
  "departmentId": "department_id",
  "departmentName": "Electronics & Computer",
  "deactivatedCount": 5,
  "skippedCount": 2,
  "totalProcessed": 7,
  "deactivatedTeachers": [
    {
      "id": "teacher_id",
      "name": "Dr. John Smith",
      "email": "john.smith@ioe.edu.np",
      "action": "deactivated"
    }
  ],
  "skippedTeachers": [
    {
      "id": "teacher_id_2",
      "name": "Dr. Jane Doe",
      "reason": "Is a department head"
    }
  ]
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "details": []
  }
}
```

### Validation Error Response
```json
{
  "success": false,
  "msg": "Validation errors",
  "errors": [
    "Subject 1: name is required",
    "Subject 2: programId must be an array"
  ]
}
```

---

## ⚡ Quick Testing Commands

### Health Check
```bash
curl http://localhost:7102/api/health
```

### Login
```bash
curl -X POST http://localhost:7102/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ioe.edu.np","password":"admin123"}'
```

### Get Departments (with token)
```bash
curl http://localhost:7102/api/departments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🚀 Production URLs

- **API Base:** `https://your-domain.com/api`
- **Documentation:** `https://your-domain.com/api-docs`
- **Health Check:** `https://your-domain.com/api/health`

---

## 📞 Support

- **Local Development:** `http://localhost:7102`
- **API Documentation:** `http://localhost:7102/api-docs`
- **System Status:** Check `/api/health` endpoint

---

## 🚀 **Current System Status (v2.0.0)**

### ✅ **Fully Implemented Features:**
- **Authentication & Authorization:** JWT-based with admin/user roles
- **Subject Management:** Complete CRUD with bulk operations
- **Teacher Management:** Complete CRUD with bulk operations
- **Bulk Creation:** Supports both direct array and wrapped formats
- **Bulk Deletion:** Delete by IDs or by program/department
- **Advanced Filtering:** By program, semester, shared subjects, department
- **Conflict Detection:** Prevents duplicate subject codes, handles constraints
- **Error Handling:** Comprehensive validation and error responses
- **Database:** MongoDB with 76+ BCT subjects loaded

### 🔧 **Available Bulk Operations:**
- **POST** `/subjects/bulk` - Create multiple subjects at once
- **DELETE** `/subjects/bulk` - Delete multiple subjects by IDs  
- **DELETE** `/subjects/program/:id` - Delete all subjects of a program
- **POST** `/subjects/by-programs` - Get subjects by multiple programs
- **DELETE** `/teachers/bulk` - Delete multiple teachers by IDs
- **DELETE** `/teachers/department/:id` - Delete all teachers of a department
- **DELETE** `/time-slots/bulk` - Delete multiple time slots by IDs

### 📊 **Database Statistics:**
- **Total Subjects:** 76 (BCT Program complete dataset)
- **Semester Coverage:** 1-8 (including electives)
- **Programs Supported:** BCT (Bachelor of Computer Engineering)
- **Data Integrity:** Enforced unique subject codes

### 🔍 **Testing Status:**
- ✅ Authentication flow verified
- ✅ Single subject CRUD operations
- ✅ Bulk creation (both formats)
- ✅ Bulk deletion operations  
- ✅ Program-based operations
- ✅ Error handling and validation
- ✅ Duplicate prevention

**🎓 IOE Pulchowk Campus Routine Management System API**
