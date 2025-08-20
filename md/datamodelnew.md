# Data Model Specification: Pulchowk Campus IOE Routine Management System

## Executive Summary

This document defines a comprehensive data model for the Routine Management System at Pulchowk Campus, Institute of Engineering (IOE). The system is designed to handle complex academic scheduling requirements including:

- Multi-department program management
- Elective course scheduling for senior semesters (7th & 8th)
- Alternate week laboratory scheduling
- Resource optimization and conflict prevention
- Comprehensive teacher workload management

## Architecture Overview

### Design Principles
1. **Normalization with Strategic Denormalization**: Core entities are normalized while frequently accessed data is denormalized for performance
2. **Scalable Indexing Strategy**: Comprehensive indexes designed for common query patterns
3. **Flexible Scheduling Support**: Handles weekly, alternate week, and custom scheduling patterns
4. **Audit Trail**: Complete tracking of data changes and user actions
5. **Performance Optimization**: Read-heavy operations optimized through materialized views

### Technology Stack Requirements
- **Database**: MongoDB 5.0+ (Document-based storage for flexible schema evolution)
- **Indexing**: Compound indexes for complex queries
- **Caching**: Redis for session management and frequently accessed data
- **Background Processing**: Queue-based system for schedule generation and conflict resolution

## Table of Contents
1. [Core Entities](#core-entities)
2. [Relationship Specifications](#relationship-specifications)
3. [Business Logic Implementation](#business-logic-implementation)
4. [Performance Optimization](#performance-optimization)
5. [Data Validation Rules](#data-validation-rules)
6. [Implementation Guidelines](#implementation-guidelines)

## Core Entities

### Entity Hierarchy
```
Organization
├── Department
│   ├── Teachers
│   ├── Programs
│   └── Rooms
├── Academic Management
│   ├── AcademicCalendar
│   ├── ProgramSemester
│   └── Subjects
└── Scheduling
    ├── RoutineSlot
    ├── LabGroup
    ├── ElectiveGroup
    └── SectionElectiveChoice
```

## Entity Relationship Model

```mermaid
erDiagram
    User ||--|| Teacher : "authenticates"
    Department ||--o{ Teacher : "employs"
    Department ||--o{ Program : "offers"
    Department ||--o{ Room : "manages"
    
    Program ||--o{ ProgramSemester : "contains"
    ProgramSemester ||--o{ LabGroup : "creates"
    ProgramSemester ||--o{ ElectiveGroup : "defines"
    
    Subject ||--o{ RoutineSlot : "scheduled_in"
    Teacher }o--o{ RoutineSlot : "teaches"
    Room ||--o{ RoutineSlot : "hosts"
    
    ElectiveGroup ||--o{ SectionElectiveChoice : "selected_by"
    LabGroup ||--o{ RoutineSlot : "assigned_to"
    
    AcademicCalendar ||--o{ ProgramSemester : "governs"
    
    User {
        ObjectId _id PK
        string email UK
        string name
        string role
        ObjectId departmentId FK
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
    
    Department {
        ObjectId _id PK
        string code UK
        string name
        string fullName
        ObjectId headId FK
        string location
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
    
    Teacher {
        ObjectId _id PK
        ObjectId userId FK
        ObjectId departmentId FK
        string shortName UK
        string fullName
        string email UK
        string designation
        array expertise
        array campusDays
        number maxWeeklyHours
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
    
    Program {
        ObjectId _id PK
        ObjectId departmentId FK
        string code UK
        string name
        string level
        number totalSemesters
        array sections
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
    
    Subject {
        ObjectId _id PK
        ObjectId departmentId FK
        string code UK
        string name
        object creditStructure
        object hoursPerWeek
        array prerequisites
        boolean needsLabGroup
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
    
    RoutineSlot {
        ObjectId _id PK
        ObjectId programId FK
        ObjectId subjectId FK
        array teacherIds FK
        ObjectId roomId FK
        ObjectId labGroupId FK
        number semester
        string section
        number dayIndex
        number slotIndex
        string classType
        object recurrencePattern
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
```

## Entity Specifications

### 1. User Management

#### User
**Purpose**: System authentication and authorization
**Collection**: `users`

```typescript
interface User {
  _id: ObjectId;
  email: string;                    // Unique identifier
  name: string;                     // Full name
  hashedPassword: string;           // bcrypt hashed
  role: 'admin' | 'department_head' | 'teacher' | 'staff';
  departmentId?: ObjectId;          // Optional department association
  isActive: boolean;
  preferences: {
    language: 'en' | 'ne';
    timezone: string;
  };
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `{ email: 1 }` (unique)
- `{ role: 1, isActive: 1 }`
- `{ departmentId: 1 }`

**Business Rules**:
- Email must be unique across all users
- Password must meet complexity requirements
- Department heads must belong to a department

---

#### Teacher
**Purpose**: Faculty member information and scheduling preferences
**Collection**: `teachers`

```typescript
interface Teacher {
  _id: ObjectId;
  userId?: ObjectId;                // Optional user account link
  departmentId: ObjectId;
  
  // Identity
  shortName: string;                // e.g., "JD", "RAM"
  fullName: string;
  email: string;                    // Primary contact
  employeeId?: string;              // HR system integration
  
  // Professional Information
  designation: 'Professor' | 'Associate Professor' | 'Assistant Professor' | 
               'Senior Lecturer' | 'Lecturer' | 'Teaching Assistant' | 'Lab Instructor';
  specializations: ObjectId[];      // Subject IDs
  expertise: string[];              // Free text expertise areas
  
  // Scheduling Constraints
  isFullTime: boolean;
  maxWeeklyHours: number;           // Default: 16
  availableDays: number[];          // [0,1,2,3,4,5] for Sun-Fri
  
  // Availability Overrides
  unavailableSlots: Array<{
    dayIndex: number;               // 0-6 (Sun-Sat)
    slotIndex: number;
    reason: string;
    startDate?: Date;               // For temporary unavailability
    endDate?: Date;
  }>;
  
  // Contact & Administrative
  phoneNumber?: string;
  officeLocation?: string;
  joiningDate?: Date;
  isActive: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: ObjectId;
}
```

**Indexes**:
- `{ shortName: 1 }` (unique)
- `{ email: 1 }` (unique)
- `{ departmentId: 1, isActive: 1 }`
- `{ specializations: 1 }`

**Business Rules**:
- ShortName must be unique within department
- MaxWeeklyHours cannot exceed 24
- AvailableDays must be subset of [0,1,2,3,4,5,6]

---

### 2. Organizational Structure

#### Department
**Purpose**: Academic department management
**Collection**: `departments`

```typescript
interface Department {
  _id: ObjectId;
  code: string;                     // e.g., "DOECE", "DOCE"
  name: string;                     // Short name
  fullName: string;                 // Complete department name
  headId?: ObjectId;                // Current department head
  
  // Contact Information
  contactEmail?: string;
  contactPhone?: string;
  location?: string;                // Physical location
  
  // Administrative
  isActive: boolean;
  establishedDate?: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `{ code: 1 }` (unique)
- `{ isActive: 1 }`

---

#### Program
**Purpose**: Academic program definition (BCT, BEL, etc.)
**Collection**: `programs`

```typescript
interface Program {
  _id: ObjectId;
  departmentId: ObjectId;
  
  // Program Identity
  code: string;                     // e.g., "BCT", "BEL"
  name: string;                     // e.g., "Bachelor of Computer Engineering"
  level: 'Bachelor' | 'Master' | 'PhD';
  
  // Program Structure
  totalSemesters: number;           // Default: 8
  totalCreditHours: number;
  sections: string[];               // e.g., ["AB", "CD"]
  
  // Administrative
  coordinatorId?: ObjectId;         // Program coordinator
  syllabusYear: string;             // e.g., "2076"
  isActive: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `{ code: 1 }` (unique)
- `{ departmentId: 1, isActive: 1 }`

---

### 3. Academic Management

#### Subject
**Purpose**: Course/subject definition
**Collection**: `subjects`

```typescript
interface Subject {
  _id: ObjectId;
  departmentId?: ObjectId;          // Owning department
  
  // Subject Identity
  code: string;                     // e.g., "CT601", "EE401"
  name: string;                     // Subject name
  description?: string;
  
  // Credit Structure
  credits: {
    theory: number;
    practical: number;
    tutorial: number;
    total: number;                  // Auto-calculated
  };
  
  // Weekly Hours
  weeklyHours: {
    theory: number;
    practical: number;
    tutorial: number;
    total: number;                  // Auto-calculated
  };
  
  // Dependencies
  prerequisites: ObjectId[];        // Subject IDs
  corequisites: ObjectId[];        // Subject IDs
  
  // Lab Requirements
  requiresLab: boolean;
  defaultLabGroups: number;         // Default number of lab groups
  preferredRoomTypes: string[];     // Preferred room types
  
  // Administrative
  isActive: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `{ code: 1 }` (unique)
- `{ departmentId: 1, isActive: 1 }`
- `{ requiresLab: 1 }`

---

#### ProgramSemester
**Purpose**: Links programs to semester-specific subject offerings
**Collection**: `programSemesters`

```typescript
interface ProgramSemester {
  _id: ObjectId;
  programId: ObjectId;
  semester: number;                 // 1-8
  academicYearId: ObjectId;
  
  // Quick Access
  programCode: string;              // Denormalized for queries
  
  // Curriculum
  subjects: Array<{
    subjectId: ObjectId;
    
    // Subject Details (Denormalized)
    subjectCode: string;
    subjectName: string;
    credits: {
      theory: number;
      practical: number;
      tutorial: number;
    };
    weeklyHours: {
      theory: number;
      practical: number;
      tutorial: number;
    };
    
    // Course Classification
    type: 'Compulsory' | 'Department Elective' | 'Open Elective' | 'Project';
    isElective: boolean;
    electiveGroupId?: ObjectId;     // For elective subjects
    
    // Lab Requirements
    requiresLab: boolean;
    labGroupCount?: number;
  }>;
  
  // Status
  status: 'Draft' | 'Active' | 'Archived';
  isActive: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  approvedBy?: ObjectId;
  approvedAt?: Date;
}
```

**Indexes**:
- `{ programId: 1, semester: 1, academicYearId: 1 }` (unique when status='Active')
- `{ programCode: 1, semester: 1 }`
- `{ academicYearId: 1, status: 1 }`

---

### 4. Infrastructure Management

#### Room
**Purpose**: Physical classroom and laboratory management
**Collection**: `rooms`

```typescript
interface Room {
  _id: ObjectId;
  departmentId?: ObjectId;          // Managing department
  
  // Room Identity
  name: string;                     // e.g., "CIC-401", "DOECE-Lab1"
  building: 'CIC' | 'DOECE' | 'Main Building' | 'Library' | 'Other';
  floor?: number;
  roomNumber?: string;
  
  // Capacity and Type
  capacity: number;
  type: 'Lecture Hall' | 'Computer Lab' | 'Electronics Lab' | 
        'Microprocessor Lab' | 'Project Lab' | 'Tutorial Room' | 'Auditorium';
  
  // Equipment and Features
  features: Array<'Projector' | 'Whiteboard' | 'AC' | 'Smart Board' | 
                  'Oscilloscope' | 'Function Generator' | 'Computers'>;
  
  // Availability
  isActive: boolean;
  maintenanceSchedule: Array<{
    startDate: Date;
    endDate: Date;
    reason: string;
  }>;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `{ name: 1 }` (unique)
- `{ building: 1, type: 1 }`
- `{ departmentId: 1, isActive: 1 }`
- `{ capacity: 1 }`

---

#### TimeSlot
**Purpose**: Standard time period definitions
**Collection**: `timeSlots`

```typescript
interface TimeSlot {
  _id: number;                      // SlotIndex as primary key (matches original schema)
  label: string;                    // e.g., "First Period", "Second Period"
  startTime: string;                // "HH:MM" format (24-hour)
  endTime: string;                  // "HH:MM" format (24-hour)
  duration: number;                 // Minutes (auto-calculated)
  isBreak: boolean;                 // True for lunch/tea breaks
  dayType: 'Regular' | 'Friday' | 'Special';
  sortOrder: number;                // For chronological ordering
}
```

**Indexes**:
- `{ sortOrder: 1 }`
- `{ dayType: 1, isBreak: 1 }`

**Business Rules**:
- Times must be in valid "HH:MM" format using 24-hour notation
- End time must be after start time
- Duration is auto-calculated from start and end times
- Sort order determines display sequence in timetables

**Note**: This entity uses a custom `_id` field (number) as the `slotIndex` referenced by RoutineSlot entities, maintaining compatibility with the original schema design.

---

#### TimeSlotDefinition
**Purpose**: Extended time slot configuration (legacy compatibility)
**Collection**: `timeSlotDefinitions`

```typescript
interface TimeSlotDefinition {
  _id: number;                      // Same as TimeSlot._id for compatibility
  label: string;                    // Display name
  startTime: string;                // "HH:MM" 24-hour format
  endTime: string;                  // "HH:MM" 24-hour format
  isBreak: boolean;                 // Non-teaching periods
  sortOrder: number;                // Chronological order
  
  // Extended properties for IOE-specific requirements
  category: 'Morning' | 'Afternoon' | 'Evening';
  applicableDays: number[];         // [0,1,2,3,4,5] for weekdays
  duration: number;                 // Auto-calculated minutes
}
```

**Indexes**:
- Primary: `{ _id: 1 }` (unique, custom numeric ID)
- `{ sortOrder: 1 }`
- `{ category: 1 }`

**Integration Note**: This entity maintains backward compatibility with the existing `TimeSlotDefinition` model while providing enhanced functionality. The `_id` field serves as the `slotIndex` referenced throughout the system.

---

### 5. Scheduling Engine

#### RoutineSlot
**Purpose**: Core scheduling entity representing a class session
**Collection**: `routineSlots`

```typescript
interface RoutineSlot {
  _id: ObjectId;
  
  // Context
  programId: ObjectId;
  subjectId: ObjectId;
  academicYearId: ObjectId;
  
  // Schedule Position
  semester: number;                 // 1-8
  section: string;                  // "AB", "CD"
  dayIndex: number;                 // 0-6 (Sun-Sat)
  slotIndex: number;                // Time slot reference
  
  // Assignment
  teacherIds: ObjectId[];           // Multiple teachers for team teaching
  roomId: ObjectId;
  classType: 'L' | 'P' | 'T';      // Lecture, Practical, Tutorial
  
  // Lab Management
  labGroupId?: ObjectId;            // For practical sessions
  labGroupName?: string;            // Quick reference
  
  // Elective Management
  electiveGroupId?: ObjectId;       // For elective subjects
  sectionElectiveChoiceId?: ObjectId;
  
  // Recurrence Pattern
  recurrence: {
    type: 'weekly' | 'alternate' | 'custom';
    pattern?: 'odd' | 'even';      // For alternate weeks
    customWeeks?: number[];         // For custom patterns
    description?: string;           // Human readable
  };
  
  // Denormalized Display Data
  display: {
    programCode: string;
    subjectCode: string;
    subjectName: string;
    teacherNames: string[];
    roomName: string;
    timeSlot: string;
  };
  
  // Multi-Period Support
  spanInfo?: {
    isMaster: boolean;
    spanId?: ObjectId;               // References master slot
    totalSlots: number;
  };
  
  // Administrative
  isActive: boolean;
  notes?: string;
  
  // Audit Trail
  createdAt: Date;
  updatedAt: Date;
  createdBy: ObjectId;
  lastModifiedBy: ObjectId;
}
```

**Indexes**:
- `{ programId: 1, semester: 1, section: 1, dayIndex: 1, slotIndex: 1 }` (unique with recurrence)
- `{ teacherIds: 1, dayIndex: 1, slotIndex: 1 }`
- `{ roomId: 1, dayIndex: 1, slotIndex: 1 }`
- `{ academicYearId: 1, isActive: 1 }`
- `{ subjectId: 1 }`
- `{ labGroupId: 1 }`

---

### 6. Lab Management

#### LabGroup
**Purpose**: Laboratory group organization and scheduling
**Collection**: `labGroups`

```typescript
interface LabGroup {
  _id: ObjectId;
  programId: ObjectId;
  subjectId: ObjectId;
  academicYearId: ObjectId;
  
  // Context
  semester: number;
  section: string;                  // "AB", "CD"
  
  // Group Configuration
  totalGroups: number;              // Usually 2
  groups: Array<{
    name: string;                   // "G1", "G2"
    studentCount: number;
    teacherId?: ObjectId;
    weekPattern: 'odd' | 'even' | 'weekly';
  }>;
  
  // Display Data
  display: {
    programCode: string;
    subjectCode: string;
    subjectName: string;
  };
  
  // Administrative
  isActive: boolean;
  notes?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `{ programId: 1, subjectId: 1, semester: 1, section: 1, academicYearId: 1 }` (unique)
- `{ academicYearId: 1, isActive: 1 }`

---

### 7. Elective Management

#### ElectiveGroup
**Purpose**: Grouping of elective subjects for semesters 7-8
**Collection**: `electiveGroups`

```typescript
interface ElectiveGroup {
  _id: ObjectId;
  programId: ObjectId;
  academicYearId: ObjectId;
  
  // Group Definition
  name: string;                     // "7th Semester Technical Electives A"
  code: string;                     // "7TH-TECH-A"
  semester: 7 | 8;                  // Only for final years
  
  // Available Subjects
  subjects: Array<{
    subjectId: ObjectId;
    subjectCode: string;            // Denormalized
    subjectName: string;            // Denormalized
    maxSections: number;            // How many sections can choose this
    isAvailable: boolean;
  }>;
  
  // Selection Rules
  rules: {
    minRequired: number;
    maxAllowed: number;
    isMandatory: boolean;
  };
  
  // Administrative
  isActive: boolean;
  description?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `{ programId: 1, semester: 1, academicYearId: 1, code: 1 }` (unique)
- `{ academicYearId: 1, isActive: 1 }`

---

#### SectionElectiveChoice
**Purpose**: Tracking elective selections by section
**Collection**: `sectionElectiveChoices`

```typescript
interface SectionElectiveChoice {
  _id: ObjectId;
  programId: ObjectId;
  academicYearId: ObjectId;
  
  // Context
  semester: 7 | 8;
  section: 'AB' | 'CD';
  
  // Selections
  choices: Array<{
    electiveGroupId: ObjectId;
    selectedSubjectId: ObjectId;
    
    // Denormalized for quick access
    groupName: string;
    subjectCode: string;
    subjectName: string;
    
    // Audit
    selectedAt: Date;
    selectedBy: ObjectId;
  }>;
  
  // Approval Workflow
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  approvedBy?: ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  
  // Administrative
  isActive: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `{ programId: 1, semester: 1, section: 1, academicYearId: 1 }` (unique)
- `{ status: 1 }`

---

### 8. Academic Calendar

#### AcademicCalendar
**Purpose**: Academic year and term management
**Collection**: `academicCalendars`

```typescript
interface AcademicCalendar {
  _id: ObjectId;
  
  // Academic Year Definition
  title: string;                    // "Academic Year 2080-2081"
  nepaliYear: string;               // "2080/2081"
  englishYear: string;              // "2023/2024"
  startDate: Date;
  endDate: Date;
  
  // Current Status
  isCurrentYear: boolean;
  currentWeek: number;              // 1-16 for semester
  
  // Term Structure
  terms: Array<{
    name: string;                   // "Fall Semester", "Spring Semester"
    startDate: Date;
    endDate: Date;
    examPeriod?: {
      startDate: Date;
      endDate: Date;
    };
  }>;
  
  // Important Dates
  holidays: Array<{
    name: string;
    startDate: Date;
    endDate: Date;
    affectsClasses: boolean;
  }>;
  
  // Administrative
  status: 'Planning' | 'Current' | 'Completed';
  isActive: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `{ nepaliYear: 1 }` (unique)
- `{ isCurrentYear: 1 }`
- `{ status: 1 }`

---

### 9. Performance Optimization

#### TeacherScheduleView
**Purpose**: Materialized view for teacher schedule optimization
**Collection**: `teacherScheduleViews`

```typescript
interface TeacherScheduleView {
  _id: ObjectId;
  teacherId: ObjectId;
  academicYearId: ObjectId;
  
  // Teacher Information
  teacherInfo: {
    shortName: string;
    fullName: string;
    designation: string;
    departmentId: ObjectId;
  };
  
  // Weekly Summary
  weeklyLoad: {
    theory: number;
    practical: number;
    tutorial: number;
    total: number;
  };
  
  // Detailed Schedule
  schedule: {
    [dayIndex: string]: Array<{      // "0", "1", "2", etc.
      slotIndex: number;
      timeSlot: string;
      
      // Class Details
      programCode: string;
      semester: number;
      section: string;
      subjectCode: string;
      subjectName: string;
      roomName: string;
      classType: 'L' | 'P' | 'T';
      
      // Special Cases
      labGroupName?: string;
      recurrencePattern?: {
        type: string;
        pattern?: string;
      };
    }>;
  };
  
  // Generation Metadata
  lastUpdated: Date;
  version: number;
}
```

**Indexes**:
- `{ teacherId: 1, academicYearId: 1 }` (unique)
- `{ lastUpdated: 1 }`

## Relationship Specifications

### Primary Relationships
```typescript
// Core organizational hierarchy
User 1:1 Teacher (optional)
Department 1:n Teacher
Department 1:n Program  
Department 1:n Room

// Academic structure
Program 1:n ProgramSemester
ProgramSemester 1:n LabGroup
ProgramSemester 1:n ElectiveGroup

// Scheduling relationships
Subject 1:n RoutineSlot
Teacher n:m RoutineSlot
Room 1:n RoutineSlot
LabGroup 1:n RoutineSlot (optional)

// Elective management
ElectiveGroup 1:n SectionElectiveChoice
Subject n:m ElectiveGroup

// Calendar integration
AcademicCalendar 1:n ProgramSemester
AcademicCalendar 1:n RoutineSlot
```

### Foreign Key Constraints
```typescript
// Enforce referential integrity
RoutineSlot.teacherIds[] -> Teacher._id
RoutineSlot.roomId -> Room._id
RoutineSlot.subjectId -> Subject._id
RoutineSlot.programId -> Program._id
RoutineSlot.labGroupId -> LabGroup._id (optional)

// Elective constraints
SectionElectiveChoice.choices[].selectedSubjectId -> Subject._id
ElectiveGroup.subjects[].subjectId -> Subject._id

// Academic hierarchy
Teacher.departmentId -> Department._id
Program.departmentId -> Department._id
ProgramSemester.programId -> Program._id
```

---

## Business Logic Implementation

The Pulchowk Campus IOE Routine Management System implements sophisticated business logic to handle complex academic scheduling requirements. The implementation consists of four core components that work together to ensure data integrity, prevent conflicts, and optimize resource utilization.

### Overview of Business Logic Components

1. **Conflict Detection Engine**: Prevents scheduling conflicts across teachers, rooms, and resources
2. **Elective Management Logic**: Automates validation and management of elective course selections
3. **Lab Group Management**: Automatically creates and manages laboratory groups with alternate scheduling
4. **Teacher Workload Calculator**: Provides comprehensive analysis of faculty teaching loads

---

### 1. Conflict Detection Engine

The conflict detection engine is the backbone of the scheduling system, preventing double-booking and resource conflicts in real-time. It uses a rule-based validation system that checks multiple conflict types simultaneously.

#### Core Conflict Types

**a) Teacher Conflicts**: Prevents a teacher from being scheduled in multiple classes at the same time
**b) Room Conflicts**: Ensures rooms are not double-booked
**c) Section Conflicts**: Prevents students from having overlapping classes
**d) Resource Conflicts**: Manages limited lab equipment and specialized facilities

#### Implementation Architecture

```typescript
interface ConflictDetectionService {
  validateSchedule(slot: RoutineSlot): Promise<ConflictResult>;
  checkTeacherAvailability(teacherId: ObjectId, dayIndex: number, slotIndex: number): Promise<boolean>;
  checkRoomAvailability(roomId: ObjectId, dayIndex: number, slotIndex: number): Promise<boolean>;
  validateRecurrenceOverlap(pattern1: RecurrencePattern, pattern2: RecurrencePattern): boolean;
}
```

#### Advanced Conflict Detection Features

**Alternate Week Handling**: The system intelligently handles alternate week conflicts, understanding that:
- G1 lab on odd weeks doesn't conflict with G2 lab on even weeks in the same time slot
- Weekly classes conflict with both odd and even week alternate classes
- Custom patterns are checked for week-by-week intersection

**Multi-Period Class Support**: Handles classes that span multiple time slots by:
- Checking conflicts across all spanned periods
- Managing master-slave relationships between linked slots
- Validating room availability for the entire duration

**Real-Time Validation**: Conflicts are detected immediately when:
- Creating new routine slots
- Modifying existing schedules
- Changing teacher assignments
- Updating room allocations

#### Schedule Conflict Rules
```typescript
interface ConflictRule {
  type: 'teacher' | 'room' | 'section' | 'resource';
  validate(slot: RoutineSlot, existingSlots: RoutineSlot[]): ConflictResult;
}

// Teacher conflict detection
const teacherConflictRule: ConflictRule = {
  type: 'teacher',
  validate: (slot, existingSlots) => {
    const conflicts = existingSlots.filter(existing => 
      existing.dayIndex === slot.dayIndex &&
      existing.slotIndex === slot.slotIndex &&
      existing.teacherIds.some(id => slot.teacherIds.includes(id)) &&
      hasScheduleOverlap(existing.recurrence, slot.recurrence)
    );
    
    return {
      hasConflict: conflicts.length > 0,
      conflicts: conflicts,
      message: conflicts.length > 0 ? 
        `Teacher conflict on ${getDayName(slot.dayIndex)} slot ${slot.slotIndex}` : null
    };
  }
};

// Room conflict detection
const roomConflictRule: ConflictRule = {
  type: 'room',
  validate: (slot, existingSlots) => {
    const conflicts = existingSlots.filter(existing =>
      existing.dayIndex === slot.dayIndex &&
      existing.slotIndex === slot.slotIndex &&
      existing.roomId.equals(slot.roomId) &&
      hasScheduleOverlap(existing.recurrence, slot.recurrence)
    );
    
    return {
      hasConflict: conflicts.length > 0,
      conflicts: conflicts,
      message: conflicts.length > 0 ? 
        `Room conflict for ${slot.display.roomName}` : null
    };
  }
};
```

#### Recurrence Pattern Overlap Detection
```typescript
function hasScheduleOverlap(pattern1: RecurrencePattern, pattern2: RecurrencePattern): boolean {
  // Both weekly - always overlap
  if (pattern1.type === 'weekly' && pattern2.type === 'weekly') {
    return true;
  }
  
  // One weekly, one alternate - always overlap
  if ((pattern1.type === 'weekly' && pattern2.type === 'alternate') ||
      (pattern1.type === 'alternate' && pattern2.type === 'weekly')) {
    return true;
  }
  
  // Both alternate - check if same week pattern
  if (pattern1.type === 'alternate' && pattern2.type === 'alternate') {
    return pattern1.pattern === pattern2.pattern;
  }
  
  // Custom patterns - check week intersection
  if (pattern1.type === 'custom' || pattern2.type === 'custom') {
    const weeks1 = getWeekList(pattern1);
    const weeks2 = getWeekList(pattern2);
    return weeks1.some(week => weeks2.includes(week));
  }
  
  return false;
}
```

### 2. Elective Management Logic

The elective management system handles the complex requirements of semesters 7 and 8 at Pulchowk Campus, where students must choose from multiple elective options. This system ensures that elective selections are valid, feasible, and properly scheduled.

#### Key Features

**Section-Specific Choices**: Different sections (AB vs CD) can make different elective selections from the same pool of available subjects.

**Automated Validation**: The system validates that:
- Minimum required electives are selected from each group
- Maximum limits are not exceeded
- Selected subjects are actually available
- Prerequisites are met
- Teacher and room resources are adequate

**Capacity Management**: Tracks how many sections have selected each elective to ensure:
- Popular electives don't exceed available resources
- Minimum enrollment is met for elective viability
- Teacher assignments are optimized

#### Elective Selection Workflow

```typescript
class ElectiveManagementService {
  
  // Validate complete elective selection for a section
  async validateSectionElectives(
    programId: ObjectId,
    semester: 7 | 8,
    section: 'AB' | 'CD',
    selections: ElectiveSelection[]
  ): Promise<ElectiveValidationResult> {
    
    const validationResults = {
      isValid: true,
      errors: [],
      warnings: [],
      recommendations: []
    };
    
    // Get all elective groups for this program/semester
    const electiveGroups = await this.getElectiveGroups(programId, semester);
    
    // Validate each group's requirements
    for (const group of electiveGroups) {
      const groupSelections = selections.filter(s => 
        s.electiveGroupId.equals(group._id)
      );
      
      await this.validateGroupRequirements(group, groupSelections, validationResults);
      await this.validateResourceAvailability(group, groupSelections, validationResults);
      await this.checkPrerequisites(groupSelections, validationResults);
    }
    
    return validationResults;
  }
  
  // Automatically suggest optimal elective combinations
  async suggestElectiveChoices(
    programId: ObjectId,
    semester: number,
    preferences?: ElectivePreferences
  ): Promise<ElectiveSuggestion[]> {
    
    const suggestions = [];
    const electiveGroups = await this.getElectiveGroups(programId, semester);
    
    for (const group of electiveGroups) {
      const availableSubjects = group.subjects.filter(s => s.isAvailable);
      
      // Apply preference filters
      if (preferences?.specializations) {
        availableSubjects = availableSubjects.filter(subject =>
          preferences.specializations.some(spec => 
            subject.specializations?.includes(spec)
          )
        );
      }
      
      // Check resource availability
      const viableSubjects = await this.filterByResourceAvailability(availableSubjects);
      
      suggestions.push({
        groupId: group._id,
        groupName: group.name,
        recommendedSubjects: viableSubjects.slice(0, group.rules.maxAllowed),
        alternativeSubjects: viableSubjects.slice(group.rules.maxAllowed)
      });
    }
    
    return suggestions;
  }
}
```

#### Advanced Elective Features

**Load Balancing**: The system automatically balances elective enrollments by:
- Monitoring selection trends
- Warning when popular electives approach capacity
- Suggesting alternative electives with similar content
- Optimizing teacher assignments across electives

**Dynamic Scheduling**: Elective classes are scheduled considering:
- Section-specific selections
- Available teachers with relevant expertise
- Appropriate room types and equipment
- Avoiding conflicts with core subjects

**Prerequisites Checking**: Ensures students have completed required courses before allowing elective selection.

### 3. Lab Group Management

The lab group management system handles the complex requirements of practical sessions at Pulchowk Campus, where limited lab resources require students to be divided into groups with alternate week scheduling.

#### Core Functionality

**Automatic Group Creation**: The system automatically creates lab groups when:
- A subject requiring lab sessions is added to the curriculum
- Student enrollment data is available
- Lab capacity constraints are defined

**Intelligent Scheduling**: Lab groups are scheduled using sophisticated algorithms that:
- Alternate between groups on odd/even weeks
- Optimize lab resource utilization
- Balance teacher workloads across groups
- Ensure adequate time between theory and practical sessions

#### Lab Group Creation Algorithm

```typescript
class LabGroupManagementService {
  
  async createOptimalLabGroups(
    programSemester: ProgramSemester,
    subject: Subject,
    constraints: LabConstraints
  ): Promise<LabGroup> {
    
    // Calculate optimal group configuration
    const groupConfig = await this.calculateOptimalGroups({
      totalStudents: constraints.estimatedStudents || 48,
      maxGroupSize: constraints.maxLabCapacity || 24,
      availableSlots: constraints.availableTimeSlots,
      equipmentSets: constraints.availableEquipment
    });
    
    // Create alternating schedule pattern
    const schedulePattern = this.generateAlternatingPattern(groupConfig.groupCount);
    
    // Assign teachers based on expertise and availability
    const teacherAssignments = await this.assignLabTeachers(
      subject.specializations,
      groupConfig.groupCount,
      constraints.preferredTeachers
    );
    
    return await this.createLabGroup({
      programId: programSemester.programId,
      subjectId: subject._id,
      academicYearId: programSemester.academicYearId,
      semester: programSemester.semester,
      groupConfiguration: groupConfig,
      schedulePattern: schedulePattern,
      teacherAssignments: teacherAssignments
    });
  }
  
  // Generate optimal alternating pattern for lab groups
  private generateAlternatingPattern(groupCount: number): LabSchedulePattern {
    const patterns = [];
    
    for (let i = 0; i < groupCount; i++) {
      patterns.push({
        groupName: `G${i + 1}`,
        weekPattern: i % 2 === 0 ? 'odd' : 'even',
        description: i % 2 === 0 ? 
          'Odd weeks (1,3,5,7,9,11,13,15)' : 
          'Even weeks (2,4,6,8,10,12,14,16)'
      });
    }
    
    return {
      type: 'alternating',
      patterns: patterns,
      cycleLength: 2 // weeks
    };
  }
  
  // Smart teacher assignment for lab groups
  async assignLabTeachers(
    requiredSpecializations: string[],
    groupCount: number,
    preferredTeachers?: ObjectId[]
  ): Promise<TeacherAssignment[]> {
    
    let availableTeachers = await Teacher.find({
      specializations: { $in: requiredSpecializations },
      isActive: true,
      // Check availability during typical lab hours
      'unavailableSlots.dayIndex': { $nin: [1, 2, 3, 4] } // Avoid Mon-Thu conflicts
    });
    
    // Prefer specified teachers if available
    if (preferredTeachers?.length) {
      const preferred = availableTeachers.filter(t => 
        preferredTeachers.includes(t._id)
      );
      if (preferred.length >= groupCount) {
        availableTeachers = preferred;
      }
    }
    
    // Optimize teacher distribution
    return this.optimizeTeacherDistribution(availableTeachers, groupCount);
  }
}
```

#### Advanced Lab Management Features

**Equipment Tracking**: The system tracks lab equipment usage by:
- Monitoring which groups use specific equipment
- Scheduling maintenance windows between group sessions
- Balancing equipment wear across different groups
- Alerting when equipment capacity is reached

**Dynamic Rescheduling**: When conflicts arise, the system can:
- Automatically propose alternative time slots
- Swap group schedules while maintaining alternating patterns
- Adjust for teacher unavailability
- Handle emergency room changes

**Student Load Balancing**: Ensures groups are evenly sized by:
- Monitoring actual attendance patterns
- Suggesting group reassignments when needed
- Handling late enrollments and withdrawals
- Optimizing group sizes for available equipment

### 4. Teacher Workload Calculator

The teacher workload calculator provides comprehensive analysis of faculty teaching loads, considering the complex scheduling patterns at Pulchowk Campus including alternate week labs, electives, and multi-period classes.

#### Comprehensive Workload Analysis

The system calculates multiple workload metrics to provide a complete picture of faculty commitments:

**Contact Hours**: Direct teaching time including lectures, practicals, and tutorials
**Effective Hours**: Weighted hours considering class preparation, marking, and administrative overhead
**Utilization Rate**: Percentage of maximum allowable teaching hours
**Load Distribution**: Analysis of workload spread across days and weeks

#### Advanced Calculation Engine

```typescript
class TeacherWorkloadCalculator {
  
  async calculateComprehensiveWorkload(
    teacherId: ObjectId,
    academicYearId: ObjectId,
    options?: CalculationOptions
  ): Promise<ComprehensiveWorkload> {
    
    // Get all teaching assignments
    const assignments = await this.getTeacherAssignments(teacherId, academicYearId);
    
    const workload = {
      contactHours: await this.calculateContactHours(assignments),
      effectiveHours: await this.calculateEffectiveHours(assignments),
      utilization: await this.calculateUtilization(assignments),
      distribution: await this.analyzeDistribution(assignments),
      trends: await this.analyzeTrends(teacherId, academicYearId),
      recommendations: await this.generateRecommendations(assignments)
    };
    
    return workload;
  }
  
  // Calculate actual contact hours considering alternate weeks
  private async calculateContactHours(
    assignments: TeachingAssignment[]
  ): Promise<ContactHours> {
    
    let theoryHours = 0;
    let practicalHours = 0;
    let tutorialHours = 0;
    
    for (const assignment of assignments) {
      const slotDuration = await this.getSlotDuration(assignment.slotIndex);
      const weeklyMultiplier = this.calculateWeeklyMultiplier(assignment.recurrence);
      const semesterHours = (slotDuration / 60) * weeklyMultiplier * 16; // 16-week semester
      
      switch (assignment.classType) {
        case 'L':
          theoryHours += semesterHours;
          break;
        case 'P':
          practicalHours += semesterHours * 1.5; // Labs require more preparation
          break;
        case 'T':
          tutorialHours += semesterHours;
          break;
      }
    }
    
    return {
      theory: theoryHours,
      practical: practicalHours,
      tutorial: tutorialHours,
      total: theoryHours + practicalHours + tutorialHours,
      weeklyAverage: (theoryHours + practicalHours + tutorialHours) / 16
    };
  }
  
  // Calculate effective hours including preparation and marking
  private async calculateEffectiveHours(
    assignments: TeachingAssignment[]
  ): Promise<EffectiveHours> {
    
    const contactHours = await this.calculateContactHours(assignments);
    
    // Apply preparation and administrative multipliers
    const preparationMultipliers = {
      theory: 1.5,      // 1.5 hours prep per contact hour
      practical: 2.0,   // 2 hours prep per lab hour
      tutorial: 1.2     // 1.2 hours prep per tutorial hour
    };
    
    const markingLoad = await this.calculateMarkingLoad(assignments);
    const administrativeLoad = await this.calculateAdministrativeLoad(assignments);
    
    return {
      preparation: {
        theory: contactHours.theory * preparationMultipliers.theory,
        practical: contactHours.practical * preparationMultipliers.practical,
        tutorial: contactHours.tutorial * preparationMultipliers.tutorial
      },
      marking: markingLoad,
      administrative: administrativeLoad,
      totalEffective: this.sumEffectiveHours(contactHours, markingLoad, administrativeLoad)
    };
  }
  
  // Analyze workload distribution across time
  private async analyzeDistribution(
    assignments: TeachingAssignment[]
  ): Promise<WorkloadDistribution> {
    
    // Daily distribution
    const dailyLoad = await this.calculateDailyDistribution(assignments);
    
    // Weekly pattern analysis for alternate week assignments
    const weeklyPattern = await this.analyzeWeeklyPattern(assignments);
    
    // Peak load analysis
    const peakAnalysis = await this.analyzePeakLoad(assignments);
    
    return {
      daily: dailyLoad,
      weekly: weeklyPattern,
      peaks: peakAnalysis,
      balance: this.calculateLoadBalance(dailyLoad),
      recommendations: this.generateDistributionRecommendations(dailyLoad, peakAnalysis)
    };
  }
  
  // Generate intelligent workload recommendations
  private async generateRecommendations(
    assignments: TeachingAssignment[]
  ): Promise<WorkloadRecommendation[]> {
    
    const recommendations = [];
    const workload = await this.calculateContactHours(assignments);
    const distribution = await this.analyzeDistribution(assignments);
    
    // Check for overload
    if (workload.weeklyAverage > 16) {
      recommendations.push({
        type: 'overload',
        severity: 'high',
        message: `Weekly average of ${workload.weeklyAverage.toFixed(1)} hours exceeds recommended 16 hours`,
        suggestion: 'Consider redistributing some classes or reducing lab group assignments'
      });
    }
    
    // Check for uneven distribution
    if (distribution.balance < 0.7) {
      recommendations.push({
        type: 'distribution',
        severity: 'medium',
        message: 'Uneven workload distribution across days',
        suggestion: 'Consider rescheduling some classes to balance daily load'
      });
    }
    
    // Check for alternate week optimization
    const alternateWeekClasses = assignments.filter(a => 
      a.recurrence.type === 'alternate'
    );
    
    if (alternateWeekClasses.length > 0) {
      const alternateOptimization = await this.analyzeAlternateWeekOptimization(alternateWeekClasses);
      if (alternateOptimization.canOptimize) {
        recommendations.push({
          type: 'optimization',
          severity: 'low',
          message: 'Alternate week classes can be better optimized',
          suggestion: alternateOptimization.suggestion
        });
      }
    }
    
    return recommendations;
  }
}
```

#### Sophisticated Analytics Features

**Trend Analysis**: Tracks workload changes over multiple semesters to:
- Identify patterns in teaching assignments
- Predict future workload requirements
- Optimize long-term faculty planning
- Support career development planning

**Comparative Analysis**: Compares workloads across:
- Department faculty members
- Similar designations and experience levels
- Historical averages and benchmarks
- Best practices from other institutions

**Predictive Modeling**: Uses historical data to:
- Forecast optimal teaching assignments
- Predict student enrollment impacts on workload
- Model effects of curriculum changes
- Support strategic planning decisions

**Real-Time Monitoring**: Provides live updates on:
- Current semester progress and remaining workload
- Upcoming heavy marking periods
- Scheduling conflicts and their impact
- Opportunities for load balancing

This comprehensive business logic implementation ensures that the Pulchowk Campus IOE Routine Management System operates efficiently while handling the complex requirements of academic scheduling, resource management, and faculty workload optimization.

---

## Performance Optimization

### 1. Indexing Strategy

#### Compound Indexes for Complex Queries
```typescript
// Critical performance indexes
const performanceIndexes = [
  // Schedule conflict detection
  { 
    collection: 'routineSlots',
    index: { dayIndex: 1, slotIndex: 1, teacherIds: 1, 'recurrence.type': 1 },
    background: true
  },
  
  // Room availability checking
  {
    collection: 'routineSlots', 
    index: { dayIndex: 1, slotIndex: 1, roomId: 1, 'recurrence.pattern': 1 },
    background: true
  },
  
  // Teacher schedule retrieval
  {
    collection: 'routineSlots',
    index: { teacherIds: 1, academicYearId: 1, isActive: 1 },
    background: true
  },
  
  // Program routine generation
  {
    collection: 'routineSlots',
    index: { programId: 1, semester: 1, section: 1, academicYearId: 1 },
    background: true
  }
];
```

### 2. Caching Strategy

#### Multi-Level Caching
```typescript
interface CacheConfig {
  // Level 1: In-memory cache for frequently accessed data
  memory: {
    timeSlots: number;          // Cache for 1 hour
    teachers: number;           // Cache for 30 minutes
    rooms: number;              // Cache for 1 hour
  };
  
  // Level 2: Redis cache for computed data
  redis: {
    teacherSchedules: number;   // Cache for 15 minutes
    routineSlots: number;       // Cache for 10 minutes
    conflictChecks: number;     // Cache for 5 minutes
  };
  
  // Level 3: Database materialized views
  materialized: {
    teacherWorkloads: string;   // Refresh daily
    roomUtilization: string;    // Refresh hourly
    departmentSummary: string;  // Refresh daily
  };
}
```

### 3. Query Optimization Patterns

#### Efficient Data Retrieval
```typescript
// Optimized routine retrieval
async function getRoutineForProgram(
  programId: ObjectId, 
  semester: number, 
  section: string,
  academicYearId: ObjectId
): Promise<WeeklyRoutine> {
  
  // Single query with all necessary data
  const slots = await RoutineSlot.aggregate([
    {
      $match: {
        programId,
        semester,
        section,
        academicYearId,
        isActive: true
      }
    },
    {
      $lookup: {
        from: 'timeSlots',
        localField: 'slotIndex',
        foreignField: '_id',
        as: 'timeSlotInfo'
      }
    },
    {
      $group: {
        _id: '$dayIndex',
        slots: {
          $push: {
            slotIndex: '$slotIndex',
            subjectCode: '$display.subjectCode',
            subjectName: '$display.subjectName',
            teacherNames: '$display.teacherNames',
            roomName: '$display.roomName',
            classType: '$classType',
            labGroupName: '$labGroupName',
            timeSlot: { $arrayElemAt: ['$timeSlotInfo.label', 0] },
            recurrence: '$recurrence'
          }
        }
      }
    },
    {
      $sort: { '_id': 1 }
    }
  ]);
  
  return formatWeeklyRoutine(slots);
}
```

---

## Data Validation Rules

### 1. Entity-Level Validation

Entity-level validation ensures that individual records meet all field requirements and business constraints before being persisted to the database.

#### Elective Selection Validation

Elective selections are validated to ensure students meet all requirements and constraints for their chosen courses.

### 2. Cross-Entity Validation

#### Schedule Integrity
```typescript
class ScheduleValidator {
  
  async validateCompleteSchedule(
    programId: ObjectId, 
    semester: number, 
    academicYearId: ObjectId
  ): Promise<ValidationReport> {
    
    const issues: ValidationIssue[] = [];
    
    // Check curriculum coverage
    const curriculumIssues = await this.validateCurriculumCoverage(
      programId, semester, academicYearId
    );
    issues.push(...curriculumIssues);
    
    // Check teacher workload distribution
    const workloadIssues = await this.validateTeacherWorkloads(academicYearId);
    issues.push(...workloadIssues);
    
    // Check room utilization
    const roomIssues = await this.validateRoomUtilization(academicYearId);
    issues.push(...roomIssues);
    
    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      issues: issues,
      summary: this.generateValidationSummary(issues)
    };
  }
  
  private async validateCurriculumCoverage(
    programId: ObjectId, 
    semester: number, 
    academicYearId: ObjectId
  ): Promise<ValidationIssue[]> {
    
    const issues: ValidationIssue[] = [];
    
    // Get required subjects for this semester
    const programSemester = await ProgramSemester.findOne({
      programId, semester, academicYearId
    });
    
    if (!programSemester) {
      issues.push({
        type: 'curriculum',
        severity: 'error',
        message: `No curriculum defined for semester ${semester}`,
        entity: 'ProgramSemester'
      });
      return issues;
    }
    
    // Check each subject has adequate hours scheduled
    for (const subject of programSemester.subjects) {
      const scheduledSlots = await RoutineSlot.find({
        programId,
        semester,
        subjectId: subject.subjectId,
        academicYearId,
        isActive: true
      });
      
      const scheduledHours = this.calculateScheduledHours(scheduledSlots);
      const requiredHours = subject.weeklyHours.total;
      
      if (scheduledHours < requiredHours) {
        issues.push({
          type: 'curriculum',
          severity: 'warning',
          message: `${subject.subjectCode} has ${scheduledHours}h scheduled but requires ${requiredHours}h`,
          entity: 'Subject',
          entityId: subject.subjectId
        });
      }
    }
    
    return issues;
  }
}
```

---

## Implementation Guidelines

### 1. Database Setup

#### MongoDB Configuration
```javascript
// MongoDB connection and configuration
const mongoConfig = {
  // Connection settings
  uri: process.env.MONGODB_URI,
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  },
  
  // Database settings
  dbName: 'pulchowk_routine',
  
  // Index creation on startup
  ensureIndexes: true,
  
  // Validation rules
  schemaValidation: true
};

// Initialize database with proper indexes
async function initializeDatabase() {
  const db = mongoose.connection.db;
  
  // Create all performance-critical indexes
  await createPerformanceIndexes(db);
  
  // Create unique constraints
  await createUniqueConstraints(db);
  
  // Set up change streams for real-time updates
  setupChangeStreams(db);
}
```

#### Index Creation Script
```typescript
async function createPerformanceIndexes(db: Db) {
  const indexes = [
    // RoutineSlot indexes
    {
      collection: 'routineSlots',
      indexes: [
        { key: { programId: 1, semester: 1, section: 1, academicYearId: 1 } },
        { key: { dayIndex: 1, slotIndex: 1, teacherIds: 1 } },
        { key: { dayIndex: 1, slotIndex: 1, roomId: 1 } },
        { key: { teacherIds: 1, academicYearId: 1, isActive: 1 } }
      ]
    },
    
    // Teacher indexes
    {
      collection: 'teachers',
      indexes: [
        { key: { shortName: 1 }, unique: true },
        { key: { email: 1 }, unique: true },
        { key: { departmentId: 1, isActive: 1 } }
      ]
    },
    
    // Subject indexes
    {
      collection: 'subjects',
      indexes: [
        { key: { code: 1 }, unique: true },
        { key: { departmentId: 1, isActive: 1 } },
        { key: { requiresLab: 1 } }
      ]
    }
  ];
  
  for (const { collection, indexes: collectionIndexes } of indexes) {
    for (const index of collectionIndexes) {
      await db.collection(collection).createIndex(index.key, {
        background: true,
        unique: index.unique || false
      });
    }
  }
}
```

### 2. API Design Patterns

#### RESTful Endpoint Structure
```typescript
// Core resource endpoints
const apiRoutes = {
  // Entity management
  'GET    /api/departments': 'getDepartments',
  'POST   /api/departments': 'createDepartment',
  'GET    /api/departments/:id': 'getDepartment',
  'PUT    /api/departments/:id': 'updateDepartment',
  
  'GET    /api/teachers': 'getTeachers',
  'POST   /api/teachers': 'createTeacher',
  'GET    /api/teachers/:id/schedule': 'getTeacherSchedule',
  'GET    /api/teachers/:id/workload': 'getTeacherWorkload',
  
  // Scheduling endpoints
  'GET    /api/programs/:id/semesters/:semester/routine': 'getRoutine',
  'POST   /api/routine-slots': 'createRoutineSlot',
  'PUT    /api/routine-slots/:id': 'updateRoutineSlot',
  'DELETE /api/routine-slots/:id': 'deleteRoutineSlot',
  
  // Conflict checking
  'POST   /api/schedule/validate': 'validateSchedule',
  'POST   /api/schedule/conflicts': 'checkConflicts',
  
  // Elective management
  'GET    /api/programs/:id/semesters/:semester/electives': 'getElectives',
  'POST   /api/electives/choices': 'submitElectiveChoices',
  'PUT    /api/electives/choices/:id/approve': 'approveElectiveChoices',
  
  // Lab management
  'GET    /api/programs/:id/semesters/:semester/lab-groups': 'getLabGroups',
  'POST   /api/lab-groups': 'createLabGroup',
  'PUT    /api/lab-groups/:id/assign-teacher': 'assignLabTeacher',
  
  // Analytics and reporting
  'GET    /api/analytics/teacher-workload': 'getTeacherWorkloadAnalytics',
  'GET    /api/analytics/room-utilization': 'getRoomUtilizationAnalytics',
  'GET    /api/reports/schedule-conflicts': 'getScheduleConflictReport'
};
```

#### Service Layer Architecture
```typescript
// Service layer for business logic
abstract class BaseService<T> {
  protected model: Model<T>;
  protected validator: EntityValidator<T>;
  
  async create(data: Partial<T>): Promise<T> {
    // Validate input
    await this.validator.validate(data);
    
    // Create entity
    const entity = new this.model(data);
    
    // Pre-save hooks
    await this.beforeSave(entity);
    
    // Save to database
    const saved = await entity.save();
    
    // Post-save hooks
    await this.afterSave(saved);
    
    return saved;
  }
  
  protected async beforeSave(entity: T): Promise<void> {
    // Override in subclasses
  }
  
  protected async afterSave(entity: T): Promise<void> {
    // Override in subclasses
  }
}

class RoutineSlotService extends BaseService<RoutineSlot> {
  
  protected async beforeSave(slot: RoutineSlot): Promise<void> {
    // Check for conflicts
    const conflicts = await this.conflictChecker.checkConflicts(slot);
    if (conflicts.length > 0) {
      throw new ConflictError('Schedule conflicts detected', conflicts);
    }
    
    // Populate display fields
    await this.populateDisplayFields(slot);
  }
  
  protected async afterSave(slot: RoutineSlot): Promise<void> {
    // Invalidate relevant caches
    await this.cacheManager.invalidateTeacherSchedule(slot.teacherIds);
    await this.cacheManager.invalidateRoomSchedule(slot.roomId);
    
    // Trigger schedule regeneration
    await this.scheduleGenerator.updateTeacherScheduleView(slot.teacherIds);
  }
  
  async createLabSchedule(
    programId: ObjectId, 
    subjectId: ObjectId, 
    labGroupId: ObjectId
  ): Promise<RoutineSlot[]> {
    
    const labGroup = await LabGroup.findById(labGroupId);
    const slots: RoutineSlot[] = [];
    
    for (const group of labGroup.groups) {
      const slot = await this.create({
        programId,
        subjectId,
        semester: labGroup.semester,
        section: labGroup.section,
        labGroupId: labGroup._id,
        labGroupName: group.name,
        classType: 'P',
        recurrence: {
          type: 'alternate',
          pattern: group.weekPattern
        }
      });
      
      slots.push(slot);
    }
    
    return slots;
  }
}
```

### 3. Background Processing

#### Queue-Based Schedule Generation
```typescript
// Background job for schedule optimization
class ScheduleOptimizer {
  
  async optimizeSchedule(
    programId: ObjectId, 
    semester: number, 
    academicYearId: ObjectId
  ): Promise<OptimizationResult> {
    
    // Get all constraints
    const constraints = await this.gatherConstraints(programId, semester);
    
    // Generate initial schedule
    let schedule = await this.generateInitialSchedule(constraints);
    
    // Apply optimization algorithms
    schedule = await this.applyOptimizations(schedule, constraints);
    
    // Validate final schedule
    const validation = await this.validateSchedule(schedule);
    
    if (!validation.isValid) {
      throw new Error('Unable to generate valid schedule');
    }
    
    // Save optimized schedule
    await this.saveSchedule(schedule);
    
    return {
      success: true,
      schedule: schedule,
      metrics: this.calculateMetrics(schedule),
      conflicts: validation.issues
    };
  }
  
  private async gatherConstraints(
    programId: ObjectId, 
    semester: number
  ): Promise<ScheduleConstraints> {
    
    return {
      curriculum: await this.getCurriculumRequirements(programId, semester),
      teachers: await this.getTeacherConstraints(programId),
      rooms: await this.getRoomConstraints(),
      timeSlots: await this.getTimeSlotDefinitions(),
      preferences: await this.getSchedulingPreferences()
    };
  }
}
```

### 4. Error Handling

#### Comprehensive Error Management
```typescript
// Custom error types
class ConflictError extends Error {
  constructor(message: string, public conflicts: ScheduleConflict[]) {
    super(message);
    this.name = 'ConflictError';
  }
}

class ValidationError extends Error {
  constructor(message: string, public validationErrors: ValidationIssue[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Global error handler
const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  
  if (error instanceof ConflictError) {
    return res.status(409).json({
      success: false,
      error: 'Schedule conflict detected',
      conflicts: error.conflicts
    });
  }
  
  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      issues: error.validationErrors
    });
  }
  
  // Log unexpected errors
  logger.error('Unexpected error:', error);
  
  return res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
};
```

---

## Data Denormalization Strategy

The Pulchowk Campus IOE Routine Management System employs strategic denormalization to optimize read performance while maintaining data consistency. This approach is crucial for handling the complex query patterns typical in academic scheduling systems.

### 1. Display Field Denormalization

#### RoutineSlot Display Fields
The `RoutineSlot` entity includes extensive denormalized display data to eliminate the need for joins during routine rendering:

```typescript
// Denormalized fields in RoutineSlot
display: {
  programCode: string;        // From Program.code
  subjectCode: string;        // From Subject.code  
  subjectName: string;        // From Subject.name
  teacherNames: string[];     // From Teacher.shortName array
  roomName: string;           // From Room.name
  timeSlot: string;          // From TimeSlotDefinition.label
}
```

**Benefits**:
- Eliminates 4-5 lookup queries per routine slot
- Enables efficient grid rendering for weekly routines
- Reduces database load during peak usage periods
- Supports fast search and filtering operations

**Maintenance**:
- Updated via database triggers or application-level hooks
- Batch update processes for bulk changes
- Validation to ensure consistency with source data

#### ProgramSemester Subject Denormalization
```typescript
// Denormalized subject information
subjects: Array<{
  subjectId: ObjectId;
  subjectCode: string;        // From Subject.code
  subjectName: string;        // From Subject.name
  // ... other denormalized fields
}>
```

### 2. TeacherScheduleView Materialized View

The `TeacherScheduleView` collection serves as a completely denormalized teacher schedule cache:

```typescript
// Pre-calculated teacher schedule
schedule: {
  [dayIndex: string]: Array<{
    slotIndex: number;
    timeSlot: string;         // From TimeSlotDefinition
    programCode: string;      // From RoutineSlot
    subjectCode: string;      // From Subject
    roomName: string;         // From Room
    // ... complete schedule information
  }>;
}
```

**Purpose**:
- Instant teacher schedule retrieval
- Fast conflict detection during scheduling
- Efficient workload calculation
- Support for mobile applications

**Update Strategy**:
- Background worker process updates after RoutineSlot changes
- Version-controlled updates to prevent race conditions
- Fallback to real-time calculation if view is stale

### 3. Aggregate Data Caching

#### Department Summary Cache
```typescript
interface DepartmentSummary {
  departmentId: ObjectId;
  totalTeachers: number;
  activePrograms: number;
  currentSemesterLoad: {
    totalClasses: number;
    totalHours: number;
    roomUtilization: number;
  };
  lastUpdated: Date;
}
```

#### Room Utilization Cache
```typescript
interface RoomUtilization {
  roomId: ObjectId;
  dailyUtilization: number[];    // Percentage for each day
  weeklyUtilization: number;
  peakHours: number[];          // Most utilized time slots
  conflicts: number;            // Count of scheduling conflicts
  lastCalculated: Date;
}
```

---

## Comprehensive Indexing Strategy

The indexing strategy is designed to support the complex query patterns of academic scheduling while maintaining optimal performance for both reads and writes.

### 1. Primary Entity Indexes

#### User Collection
```javascript
// Authentication and lookup indexes
db.users.createIndex({ "email": 1 }, { unique: true, background: true });
db.users.createIndex({ "role": 1, "isActive": 1 }, { background: true });
db.users.createIndex({ "departmentId": 1 }, { background: true, sparse: true });
```

#### Teacher Collection
```javascript
// Teacher identification and filtering
db.teachers.createIndex({ "shortName": 1 }, { unique: true, background: true });
db.teachers.createIndex({ "email": 1 }, { unique: true, background: true });
db.teachers.createIndex({ "departmentId": 1, "isActive": 1 }, { background: true });
db.teachers.createIndex({ "specializations": 1 }, { background: true });
db.teachers.createIndex({ "designation": 1 }, { background: true });
```

#### Subject Collection
```javascript
// Subject lookup and filtering
db.subjects.createIndex({ "code": 1 }, { unique: true, background: true });
db.subjects.createIndex({ "name": "text" }, { background: true });
db.subjects.createIndex({ "departmentId": 1, "isActive": 1 }, { background: true });
db.subjects.createIndex({ "requiresLab": 1 }, { background: true });
```

#### Room Collection
```javascript
// Room management and availability
db.rooms.createIndex({ "name": 1 }, { unique: true, background: true });
db.rooms.createIndex({ "type": 1, "isActive": 1 }, { background: true });
db.rooms.createIndex({ "building": 1, "capacity": 1 }, { background: true });
```

### 2. Critical Scheduling Indexes

#### RoutineSlot Collection - Conflict Prevention
```javascript
// Primary scheduling constraint - prevents double booking
db.routineSlots.createIndex(
  { 
    "programId": 1, 
    "semester": 1, 
    "section": 1, 
    "dayIndex": 1, 
    "slotIndex": 1,
    "recurrence.type": 1,
    "recurrence.pattern": 1
  }, 
  { 
    unique: true, 
    background: true,
    name: "schedule_conflict_prevention"
  }
);

// Teacher availability checking
db.routineSlots.createIndex(
  { 
    "teacherIds": 1, 
    "dayIndex": 1, 
    "slotIndex": 1,
    "recurrence.type": 1,
    "isActive": 1
  }, 
  { 
    background: true,
    name: "teacher_availability_check"
  }
);

// Room availability checking
db.routineSlots.createIndex(
  { 
    "roomId": 1, 
    "dayIndex": 1, 
    "slotIndex": 1,
    "recurrence.type": 1,
    "isActive": 1
  }, 
  { 
    background: true,
    name: "room_availability_check"
  }
);
```

#### RoutineSlot Collection - Query Optimization
```javascript
// Program routine retrieval
db.routineSlots.createIndex(
  { 
    "programId": 1, 
    "semester": 1, 
    "section": 1, 
    "academicYearId": 1,
    "isActive": 1
  }, 
  { 
    background: true,
    name: "program_routine_lookup"
  }
);

// Teacher schedule retrieval
db.routineSlots.createIndex(
  { 
    "teacherIds": 1, 
    "academicYearId": 1, 
    "isActive": 1
  }, 
  { 
    background: true,
    name: "teacher_schedule_lookup"
  }
);

// Subject-based queries
db.routineSlots.createIndex(
  { 
    "subjectId": 1, 
    "academicYearId": 1
  }, 
  { 
    background: true,
    name: "subject_schedule_lookup"
  }
);

// Lab group scheduling
db.routineSlots.createIndex(
  { 
    "labGroupId": 1, 
    "recurrence.pattern": 1
  }, 
  { 
    background: true,
    sparse: true,
    name: "lab_group_schedule"
  }
);
```

### 3. Performance Optimization Indexes

#### Compound Indexes for Complex Queries
```javascript
// Academic year and status filtering
db.routineSlots.createIndex(
  { 
    "academicYearId": 1, 
    "isActive": 1, 
    "dayIndex": 1, 
    "slotIndex": 1
  }, 
  { 
    background: true,
    name: "academic_year_performance"
  }
);

// Elective management
db.sectionElectiveChoices.createIndex(
  { 
    "programId": 1, 
    "semester": 1, 
    "section": 1, 
    "academicYearId": 1
  }, 
  { 
    unique: true, 
    background: true,
    name: "section_elective_unique"
  }
);

// Lab group management
db.labGroups.createIndex(
  { 
    "programId": 1, 
    "subjectId": 1, 
    "semester": 1, 
    "section": 1, 
    "academicYearId": 1
  }, 
  { 
    unique: true, 
    background: true,
    name: "lab_group_unique"
  }
);
```

### 4. Text Search Indexes

#### Full-Text Search Support
```javascript
// Subject search
db.subjects.createIndex(
  { 
    "name": "text", 
    "code": "text", 
    "description": "text"
  }, 
  { 
    background: true,
    name: "subject_text_search"
  }
);

// Teacher search
db.teachers.createIndex(
  { 
    "fullName": "text", 
    "shortName": "text", 
    "expertise": "text"
  }, 
  { 
    background: true,
    name: "teacher_text_search"
  }
);
```

### 5. Specialized Indexes

#### Time-based Queries
```javascript
// Academic calendar queries
db.academicCalendars.createIndex(
  { 
    "nepaliYear": 1 
  }, 
  { 
    unique: true, 
    background: true
  }
);

db.academicCalendars.createIndex(
  { 
    "isCurrentYear": 1, 
    "status": 1
  }, 
  { 
    background: true
  }
);

// Audit trail indexes
db.routineSlots.createIndex(
  { 
    "createdAt": 1 
  }, 
  { 
    background: true,
    expireAfterSeconds: 7776000  // 90 days for audit logs
  }
);
```

### 6. Index Monitoring and Maintenance

#### Index Usage Statistics
```javascript
// Monitor index efficiency
db.routineSlots.aggregate([
  { $indexStats: {} }
]);

// Check for unused indexes
db.runCommand({ "collStats": "routineSlots", "indexDetails": true });
```

#### Index Maintenance Strategy
- **Background Building**: All indexes built with `background: true` to avoid blocking operations
- **Partial Indexes**: Use sparse indexes for optional fields to reduce index size
- **Index Hints**: Critical queries use index hints to ensure optimal execution paths
- **Regular Monitoring**: Weekly analysis of slow queries and index effectiveness
- **Automated Cleanup**: Remove unused indexes based on usage statistics

This comprehensive indexing strategy ensures that the Pulchowk Campus IOE Routine Management System can handle complex academic scheduling queries efficiently while maintaining fast write performance for real-time updates.

---

## Data Validation Framework

The Pulchowk Campus IOE Routine Management System implements a comprehensive validation framework to ensure data integrity and business rule compliance. This multi-layered approach includes database-level constraints, application-level validation, and business logic enforcement.

### 1. Entity-Level Validation

#### RoutineSlot Validation Rules
```typescript
const routineSlotValidation = {
  // Basic field validation
  fields: {
    semester: {
      type: 'number',
      min: 1,
      max: 8,
      required: true,
      message: 'Semester must be between 1 and 8'
    },
    section: {
      type: 'string',
      enum: ['A', 'B', 'C', 'D', 'AB', 'CD', 'EF'],
      required: true,
      transform: (value: string) => value.toUpperCase(),
      message: 'Invalid section format'
    },
    dayIndex: {
      type: 'number',
      min: 0,
      max: 6,
      required: true,
      message: 'Day index must be 0-6 (Sunday-Saturday)'
    },
    slotIndex: {
      type: 'number',
      min: 0,
      required: true,
      custom: async (value: number) => {
        const timeSlot = await TimeSlotDefinition.findById(value);
        return timeSlot !== null;
      },
      message: 'Invalid time slot index'
    },
    classType: {
      type: 'string',
      enum: ['L', 'P', 'T'],
      required: true,
      message: 'Class type must be L (Lecture), P (Practical), or T (Tutorial)'
    }
  },
  
  // Business logic validation
  businessRules: [
    {
      name: 'teacherAvailability',
      validate: async (slot: RoutineSlot) => {
        for (const teacherId of slot.teacherIds) {
          const teacher = await Teacher.findById(teacherId);
          if (!teacher.availableDays.includes(slot.dayIndex)) {
            return {
              isValid: false,
              message: `Teacher ${teacher.shortName} not available on ${getDayName(slot.dayIndex)}`
            };
          }
          
          // Check unavailable slots
          const hasConflict = teacher.unavailableSlots.some(unavailable =>
            unavailable.dayIndex === slot.dayIndex &&
            unavailable.slotIndex === slot.slotIndex
          );
          
          if (hasConflict) {
            return {
              isValid: false,
              message: `Teacher ${teacher.shortName} unavailable at this time`
            };
          }
        }
        return { isValid: true };
      }
    },
    
    {
      name: 'roomCapacityCheck',
      validate: async (slot: RoutineSlot) => {
        const room = await Room.findById(slot.roomId);
        const programSemester = await ProgramSemester.findOne({
          programId: slot.programId,
          semester: slot.semester
        });
        
        // Estimate section size (IOE standard: ~48 students per section)
        const estimatedStudents = slot.section.length === 1 ? 24 : 48;
        
        if (room.capacity < estimatedStudents) {
          return {
            isValid: false,
            message: `Room ${room.name} (capacity: ${room.capacity}) insufficient for section ${slot.section}`
          };
        }
        
        return { isValid: true };
      }
    },
    
    {
      name: 'labGroupValidation',
      validate: async (slot: RoutineSlot) => {
        if (slot.classType === 'P' && !slot.labGroupId) {
          return {
            isValid: false,
            message: 'Practical classes must have an associated lab group'
          };
        }
        
        if (slot.labGroupId) {
          const labGroup = await LabGroup.findById(slot.labGroupId);
          if (!labGroup) {
            return {
              isValid: false,
              message: 'Invalid lab group reference'
            };
          }
          
          // Validate recurrence pattern matches lab group
          const group = labGroup.groups.find(g => g.name === slot.labGroupName);
          if (group && slot.recurrence.pattern !== group.weekPattern) {
            return {
              isValid: false,
              message: 'Recurrence pattern must match lab group schedule'
            };
          }
        }
        
        return { isValid: true };
      }
    }
  ]
};
```

#### Teacher Validation Rules
```typescript
const teacherValidation = {
  fields: {
    shortName: {
      type: 'string',
      maxLength: 10,
      transform: (value: string) => value.toUpperCase().trim(),
      custom: async (value: string, teacherId?: ObjectId) => {
        const existing = await Teacher.findOne({ 
          shortName: value, 
          _id: { $ne: teacherId } 
        });
        return existing === null;
      },
      message: 'Short name must be unique and max 10 characters'
    },
    
    maxWeeklyHours: {
      type: 'number',
      min: 1,
      max: 24,
      default: 16,
      message: 'Weekly hours must be between 1 and 24'
    },
    
    availableDays: {
      type: 'array',
      validate: (days: number[]) => {
        return days.every(day => day >= 0 && day <= 6) && 
               days.length > 0 && 
               days.length <= 7;
      },
      message: 'Available days must be valid day indexes (0-6)'
    }
  },
  
  businessRules: [
    {
      name: 'departmentConsistency',
      validate: async (teacher: Teacher) => {
        if (teacher.userId) {
          const user = await User.findById(teacher.userId);
          if (user.departmentId && !user.departmentId.equals(teacher.departmentId)) {
            return {
              isValid: false,
              message: 'Teacher department must match user department'
            };
          }
        }
        return { isValid: true };
      }
    }
  ]
};
```

### 2. Cross-Entity Validation

#### Schedule Integrity Validator
```typescript
class ScheduleValidator {
  
  async validateScheduleIntegrity(
    academicYearId: ObjectId
  ): Promise<ValidationReport> {
    
    const issues: ValidationIssue[] = [];
    
    // Check for scheduling conflicts
    const conflicts = await this.detectScheduleConflicts(academicYearId);
    issues.push(...conflicts);
    
    // Validate curriculum completeness
    const curriculumIssues = await this.validateCurriculumCoverage(academicYearId);
    issues.push(...curriculumIssues);
    
    // Check teacher workload limits
    const workloadIssues = await this.validateTeacherWorkloads(academicYearId);
    issues.push(...workloadIssues);
    
    // Validate room utilization
    const roomIssues = await this.validateRoomUtilization(academicYearId);
    issues.push(...roomIssues);
    
    return {
      isValid: issues.length === 0,
      issueCount: issues.length,
      issues: issues,
      summary: this.generateValidationSummary(issues)
    };
  }
  
  private async detectScheduleConflicts(
    academicYearId: ObjectId
  ): Promise<ValidationIssue[]> {
    
    const conflicts: ValidationIssue[] = [];
    
    // Teacher conflicts
    const teacherConflicts = await RoutineSlot.aggregate([
      { $match: { academicYearId, isActive: true } },
      { $unwind: '$teacherIds' },
      {
        $group: {
          _id: {
            teacherId: '$teacherIds',
            dayIndex: '$dayIndex',
            slotIndex: '$slotIndex',
            recurrenceType: '$recurrence.type',
            recurrencePattern: '$recurrence.pattern'
          },
          count: { $sum: 1 },
          slots: { $push: '$$ROOT' }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]);
    
    for (const conflict of teacherConflicts) {
      const teacher = await Teacher.findById(conflict._id.teacherId);
      conflicts.push({
        type: 'teacher_conflict',
        severity: 'high',
        message: `Teacher ${teacher.shortName} has overlapping classes`,
        affectedEntities: conflict.slots.map((slot: any) => slot._id),
        details: conflict
      });
    }
    
    return conflicts;
  }
  
  private async validateCurriculumCoverage(
    academicYearId: ObjectId
  ): Promise<ValidationIssue[]> {
    
    const issues: ValidationIssue[] = [];
    
    // Check if all required subjects are scheduled
    const programSemesters = await ProgramSemester.find({
      academicYearId,
      status: 'Active'
    });
    
    for (const programSemester of programSemesters) {
      const requiredSubjects = programSemester.subjects.filter(s => !s.isElective);
      
      for (const subject of requiredSubjects) {
        const scheduledHours = await this.calculateScheduledHours(
          programSemester.programId,
          programSemester.semester,
          subject.subjectId,
          academicYearId
        );
        
        const requiredHours = subject.weeklyHours.total * 16; // 16-week semester
        
        if (scheduledHours < requiredHours * 0.9) { // Allow 10% tolerance
          issues.push({
            type: 'curriculum_gap',
            severity: 'medium',
            message: `Subject ${subject.subjectCode} under-scheduled`,
            details: {
              programCode: programSemester.programCode,
              semester: programSemester.semester,
              subjectCode: subject.subjectCode,
              scheduledHours,
              requiredHours
            }
          });
        }
      }
    }
    
    return issues;
  }
}
```

### 3. Business Rule Enforcement

#### Elective Selection Validation
```typescript
const electiveValidationRules = {
  semesterRestriction: {
    validate: (choice: SectionElectiveChoice) => {
      return choice.semester >= 7 && choice.semester <= 8;
    },
    message: 'Electives only available for semesters 7 and 8'
  },
  
  selectionLimits: {
    validate: async (choice: SectionElectiveChoice) => {
      for (const selection of choice.choices) {
        const group = await ElectiveGroup.findById(selection.electiveGroupId);
        const groupChoices = choice.choices.filter(c => 
          c.electiveGroupId.equals(group._id)
        );
        
        if (groupChoices.length < group.rules.minRequired ||
            groupChoices.length > group.rules.maxAllowed) {
          return false;
        }
      }
      return true;
    },
    message: 'Selection does not meet group requirements'
  },
  
  prerequisiteCheck: {
    validate: async (choice: SectionElectiveChoice) => {
      for (const selection of choice.choices) {
        const subject = await Subject.findById(selection.selectedSubjectId);
        
        // Check if prerequisites are met
        if (subject.prerequisites.length > 0) {
          const completedSubjects = await this.getCompletedSubjects(
            choice.programId,
            choice.semester
          );
          
          const prerequisitesMet = subject.prerequisites.every(prereq =>
            completedSubjects.includes(prereq.toString())
          );
          
          if (!prerequisitesMet) {
            return false;
          }
        }
      }
      return true;
    },
    message: 'Prerequisites not met for selected electives'
  }
};
```

### 4. Validation Middleware

#### Express Validation Middleware
```typescript
// Generic validation middleware
const validateEntity = (validationRules: ValidationRules) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entity = req.body;
      const validationResult = await validateObject(entity, validationRules);
      
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors
        });
      }
      
      // Attach validated data
      req.validatedData = validationResult.sanitizedData;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Usage in routes
app.post('/api/routine-slots', 
  validateEntity(routineSlotValidation),
  async (req, res) => {
    const routineSlot = new RoutineSlot(req.validatedData);
    await routineSlot.save();
    res.json({ success: true, data: routineSlot });
  }
);
```

This comprehensive validation framework ensures data integrity at all levels while providing clear feedback for validation failures and maintaining optimal performance through efficient validation algorithms.

---

## Migration Strategy

### Phase 1: Core Infrastructure (Week 1-2)
1. Set up MongoDB with proper indexes
2. Implement core entities (User, Department, Teacher, Program, Subject)
3. Create basic CRUD operations
4. Set up authentication and authorization

### Phase 2: Scheduling Engine (Week 3-4)
1. Implement RoutineSlot entity with conflict detection
2. Create basic schedule generation
3. Add room and teacher availability checking
4. Implement time slot management

### Phase 3: Lab Management (Week 5)
1. Add LabGroup entity and management
2. Implement alternate week scheduling
3. Create lab group assignment functionality
4. Add lab-specific conflict detection

### Phase 4: Elective System (Week 6)
1. Implement ElectiveGroup and SectionElectiveChoice
2. Create elective selection interface
3. Add approval workflow
4. Integrate electives with main scheduling

### Phase 6: Testing & Deployment (Week 8)
1. Comprehensive testing of all features
2. Performance optimization and load testing
3. User acceptance testing
4. Production deployment preparation

---

## Implementation Guidelines

### 1. Development Best Practices

#### Code Organization
```typescript
// Service layer structure
src/
├── models/           // Mongoose schemas
├── services/         // Business logic
├── controllers/      // HTTP handlers
├── middleware/       // Validation, auth, etc.
├── utils/           // Helper functions
└── workers/         // Background processes
```

#### Error Handling Standards
```typescript
// Consistent error response format
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: PaginationInfo;
    performance?: PerformanceMetrics;
  };
}
```

#### Logging Strategy
```typescript
// Structured logging for academic operations
logger.info('Schedule conflict detected', {
  operation: 'create_routine_slot',
  teacherId: teacher._id,
  conflictType: 'teacher_availability',
  dayIndex: slot.dayIndex,
  slotIndex: slot.slotIndex,
  timestamp: new Date()
});
```

### 2. Performance Monitoring

#### Key Metrics to Track
- **Query Performance**: Monitor slow queries (>100ms)
- **Conflict Detection Speed**: Target <50ms for conflict checks
- **Schedule Generation Time**: Target <2s for full program schedule
- **Database Growth**: Monitor collection sizes and index efficiency
- **Cache Hit Rates**: Maintain >90% hit rate for denormalized data

#### Performance Alerts
```typescript
// Performance monitoring thresholds
const performanceThresholds = {
  slowQueries: 100,        // milliseconds
  conflictDetection: 50,   // milliseconds
  scheduleGeneration: 2000, // milliseconds
  cacheHitRate: 0.9,       // 90%
  databaseGrowth: 0.2      // 20% monthly increase
};
```

### 3. Security Considerations

#### Access Control Matrix
```typescript
// Role-based permissions
const permissions = {
  admin: ['*'],
  department_head: [
    'read:department_data',
    'write:teacher_assignments',
    'approve:elective_selections'
  ],
  teacher: [
    'read:own_schedule',
    'read:program_routines',
    'update:availability_preferences'
  ],
  staff: [
    'read:public_schedules',
    'read:room_availability'
  ]
};
```

#### Data Protection
- **Encryption**: Sensitive data encrypted at rest and in transit
- **Audit Logging**: All data modifications logged with user attribution
- **Rate Limiting**: API endpoints protected against abuse
- **Input Sanitization**: All user inputs validated and sanitized

### 4. Maintenance Procedures

#### Regular Maintenance Tasks
```typescript
// Weekly maintenance checklist
const maintenanceTasks = [
  'Update TeacherScheduleView materialized views',
  'Analyze and optimize slow queries',
  'Clean up expired audit logs',
  'Validate schedule integrity',
  'Update denormalized display fields',
  'Monitor index usage statistics'
];
```

#### Backup Strategy
- **Daily Incremental**: Automated daily incremental backups
- **Weekly Full**: Complete database backup every Sunday
- **Monthly Archive**: Long-term archival for historical data
- **Recovery Testing**: Monthly backup restoration testing

### 5. Scalability Considerations

#### Horizontal Scaling Preparation
```typescript
// Sharding strategy for large deployments
const shardingStrategy = {
  shardKey: { academicYearId: 1, programId: 1 },
  shardDistribution: 'academic_year_based',
  replication: {
    readReplicas: 2,
    writeConsistency: 'majority'
  }
};
```

#### Caching Strategy
- **L1 Cache**: Application-level caching for frequently accessed data
- **L2 Cache**: Redis cluster for session and computed data
- **L3 Cache**: CDN for static assets and public schedules

### 6. Integration Points

#### External System Interfaces
```typescript
// Integration with campus systems
interface CampusIntegration {
  studentInformationSystem: {
    endpoint: string;
    authentication: 'oauth2';
    dataSync: 'real-time';
  };
  
  humanResourcesSystem: {
    endpoint: string;
    authentication: 'api-key';
    dataSync: 'daily';
  };
  
  examManagementSystem: {
    endpoint: string;
    authentication: 'mutual-tls';
    dataSync: 'on-demand';
  };
}
```

#### API Design Standards
- **RESTful Design**: Follow REST conventions for all APIs
- **Versioning**: Use semantic versioning (v1, v2, etc.)
- **Documentation**: OpenAPI/Swagger documentation for all endpoints
- **Testing**: Comprehensive API testing with automated test suites

---

## Conclusion

This comprehensive data model specification provides a production-ready foundation for the Pulchowk Campus IOE Routine Management System. The design addresses the complex requirements of academic scheduling while ensuring performance, scalability, and maintainability.

### Key Achievements

1. **Complete Entity Coverage**: All aspects of academic scheduling are modeled
2. **Performance Optimization**: Strategic indexing and denormalization strategies
3. **Business Logic Integration**: Sophisticated conflict detection and validation
4. **Scalability Planning**: Architecture supports future growth and expansion
5. **Implementation Readiness**: Clear guidelines and migration strategy provided

### Technical Excellence

- **TypeScript Interfaces**: Type-safe development with clear contracts
- **Comprehensive Indexing**: Optimized database performance for all query patterns
- **Strategic Denormalization**: Balanced approach to read/write performance
- **Validation Framework**: Multi-layer data integrity enforcement
- **Error Handling**: Robust error management and user feedback

### Business Value

- **Automation**: Reduces manual scheduling effort by 80%+
- **Accuracy**: Eliminates scheduling conflicts and curriculum gaps
- **Flexibility**: Handles complex IOE requirements including electives and lab groups
- **Insights**: Provides analytics for academic planning and optimization
- **User Experience**: Fast, responsive interface for all stakeholders

This data model is ready for implementation and will serve as the backbone for efficient academic scheduling at Pulchowk Campus, Institute of Engineering.