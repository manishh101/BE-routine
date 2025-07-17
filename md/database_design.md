Okay, here is the complete DATABASE_DESIGN.md file incorporating the programSemesters collection (with subjects as an array within each program-semester document) as the chosen method for managing curricula.

I'll include the option of denormalizing subjectCode_display and subjectName_display within the subjectsOffered array in programSemesters and note the trade-offs.

Generated markdown
# MongoDB Atlas Database Design for Smart Class Routine System

## 1. Overview

This document proposes a MongoDB schema designed to support a smart class routine management system. The system accommodates distinct sets of subjects for each Program and Semester combination, where each Program-Semester's curriculum (list of subjects) is stored as a single document. The design prioritizes efficient querying for collision detection, flexible routine management, and clear representation of academic structures.

**Assumed Academic Structure:**
*   **Programs:** Multiple academic programs (e.g., BCT, BCE, BEE), each with a unique `programCode`.
*   **Semesters:** Each program has a defined number of semesters (e.g., 8).
*   **Subjects:** A master list of all possible subjects exists. The specific subjects offered are defined per Program and per Semester.
*   **Sections:** Each Program-Semester combination can have multiple sections (e.g., "AB", "CD").
*   **Teachers & Rooms:** Resources potentially shared across programs.

## 2. Collections

### 2.1. `programs`

Stores master information about academic programs.
```json
{
  "_id": ObjectId(),         // Unique identifier for the program
  "name": "Computer Engineering", // Full name of the program
  "code": "BCT",             // Unique short code for the program (e.g., BCT, BCE, BEE)
  "totalSemesters": 8,       // Total number of semesters in this program
  "description": "...",      // Optional description
  "createdAt": ISODate(),
  "updatedAt": ISODate()
}


Indexes: {"code": 1} (unique)

2.2. subjects (Master List of All Possible Subjects)

Stores a global, master list of all subjects that can be taught across the institution.

Generated json
{
  "_id": ObjectId(),         // Unique identifier for the subject
  "name": "Data Structures and Algorithms", // Global, official subject name
  "code": "COMP201",         // Globally unique subject code
  "description": "Detailed description of the subject content...",
  "credits": 3,              // Credit hours for the subject
  // Other general subject details (e.g., default lab requirement)
  "createdAt": ISODate(),
  "updatedAt": ISODate()
}


Indexes: {"code": 1} (unique), {"name": 1}

2.3. programSemesters (Curriculum: Subjects Offered per Program-Semester)

This collection stores the curriculum for each specific semester of each program. Each document defines all the subjects offered in that particular program-semester.

Generated json
{
  "_id": ObjectId(),         // Unique identifier for this program-semester offering

  "programCode": "BCT",      // String - Foreign Key referencing `programs.code`
  "semester": 1,             // Integer - The semester number (e.g., 1 through 8)

  "subjectsOffered": [       // Array of objects, each representing a subject in this curriculum
    {
      "subjectId": ObjectId(), // ObjectId - Foreign Key referencing `subjects._id`
      // Option 1: Store only ID, lookup name/code from `subjects` collection when needed
      // Option 2 (Denormalized for Read Performance):
      "subjectCode_display": "COMP201", // Denormalized from `subjects.code`
      "subjectName_display": "Data Structures and Algorithms", // Denormalized from `subjects.name`

      "courseType": "Core",    // String - e.g., "Core", "Elective Group A", "Audit"
      "isElective": false,     // Boolean
      "defaultHoursTheory": 3, // Integer - Suggested lecture hours per week
      "defaultHoursPractical": 2,// Integer - Suggested practical/lab hours per week
      // Any other context-specific attributes for this subject in this program-semester
    }
    // ... more subjects for this specific program-semester
  ],

  "academicYear": "2023-2024", // Optional: If curriculum versioning by academic year is needed.
                                // If used, compound indexes should include this.
  "status": "Active",          // Optional: "Active", "Archived" for curriculum versions

  "createdAt": ISODate(),
  "updatedAt": ISODate()
}


Indexes:

Primary Functional Index (for fetching a specific program-semester's curriculum):

Generated javascript
{ "programCode": 1, "semester": 1 /*, "academicYear": 1 (if used and active status considered) */ }
// Ensure this index has the `unique: true` option set (if academicYear is not used or if only one active curriculum per program-semester).

Querying for a specific subject within the array (if needed frequently):

Generated javascript
{ "subjectsOffered.subjectId": 1 } // Creates a multikey index
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
JavaScript
IGNORE_WHEN_COPYING_END

Note on Denormalization (subjectCode_display, subjectName_display):

Pro: Improves read performance when fetching a programSemesters document, as subject names/codes are immediately available for UI display without extra lookups to the subjects collection.

Con: Adds write-side complexity. If a subject's name or code changes in the master subjects collection, this change must be propagated to all programSemesters documents where that subjectId appears.

2.4. teachers

Stores information about teachers.

Generated json
{
  "_id": ObjectId(),
  "fullName": "Dr. Grace Hopper",
  "shortName": "GH", // Unique or contextually unique short name/initials
  "email": "grace.hopper@example.com", // Unique
  "department": "Computer Science",
  "specializations": [ObjectId("subjectId1"), ObjectId("subjectId2")], // Optional: References to `subjects._id`
  "availabilityOverrides": [ // Optional: To mark specific non-available times
    // { dayIndex: 1, slotIndex: 3, reason: "Department Meeting" }
  ],
  "createdAt": ISODate(),
  "updatedAt": ISODate()
}

Indexes: {"email": 1} (unique), {"shortName": 1}

2.5. rooms

Stores information about available rooms/labs.

Generated json
{
  "_id": ObjectId(),
  "name": "Room A-101 (Lecture Hall)", // Descriptive name, possibly including type
  "building": "Block A",
  "capacity": 120,
  "type": "Lecture Hall", // "Lab-Computer", "Lab-Electronics", "Tutorial Room"
  "features": ["Projector", "Whiteboard", "Microphone System"], // Array of strings
  "availabilityOverrides": [ // Optional: To mark room as unusable at certain times
    // { dayIndex: 2, slotIndex: 4, reason: "Maintenance" }
  ],
  "createdAt": ISODate(),
  "updatedAt": ISODate()
}

Indexes: {"name": 1} (unique)

2.6. routineSlots (Core Collection for Scheduled Classes)

Represents individual scheduled class slots in any routine.

Generated json
// Document represents ONE scheduled class in a specific slot for a specific program/sem/sec
{
  "_id": ObjectId(),
  "programCode": "BCT",    // Reference to programs.code
  "semester": 1,           // Integer 1-8
  "section": "AB",         // "AB" or "CD"

  "dayIndex": 0,           // Integer: 0 (Sunday) - 5 (Friday) or 0-6
  "slotIndex": 0,          // Integer: Index corresponding to a predefined time slot

  "subjectId": ObjectId(), // Reference to subjects._id (from the master list)
  "teacherIds": [ObjectId()],// Array of references to teachers._id
  "roomId": ObjectId(),       // Reference to rooms._id

  "classType": "L",        // "L" (Lecture), "P" (Practical), "T" (Tutorial)
  "notes": "e.g., Combined with Section CD for this lecture",

  // Denormalized fields for optimized display (populated from referenced collections)
  "subjectName_display": "Data Structures and Algorithms",
  "subjectCode_display": "COMP201",
  "teacherShortNames_display": ["GH"],
  "roomName_display": "Room A-101",
  "timeSlot_display": "10:15 - 11:05", // From timeSlotDefinitions

  "createdAt": ISODate(),
  "updatedAt": ISODate()
}

Indexes (Crucial for Collision Detection & Fetching):

{"dayIndex": 1, "slotIndex": 1, "teacherIds": 1} (Teacher collision check)

{"dayIndex": 1, "slotIndex": 1, "roomId": 1} (Room collision check)

{"programCode": 1, "semester": 1, "section": 1, "dayIndex": 1, "slotIndex": 1} (Unique index for a slot within a specific program-semester-section routine; also for fetching)

{"teacherIds": 1, "dayIndex": 1, "slotIndex": 1} (Alternate for fetching teacher schedules if not using denormalized teacherSchedules collection)

2.7. teacherSchedules (Denormalized for Teacher Routine View)

Stores the compiled weekly schedule for each teacher. Updated when routineSlots change.

Generated json
{
  "_id": ObjectId(), // Corresponds to teachers._id
  "teacherId": ObjectId(),
  "teacherShortName": "GH",
  "teacherFullName_display": "Dr. Grace Hopper",
  "schedule": { // Object keys are dayIndex (e.g., "0" for Sunday)
    "0": [ // Array of classes for this day
      {
        "slotIndex": 0,
        "timeSlot_display": "10:15 - 11:05",
        "programCode": "BCT",
        "semester": 1,
        "section": "AB",
        "subjectName_display": "Data Structures",
        "subjectCode_display": "COMP201",
        "roomName_display": "Room A-101",
        "classType": "L",
        "notes": "..."
      }
      // ... other classes for this teacher on this day
    ]
    // ... other days "1", "2", etc.
  },
  "lastGeneratedAt": ISODate() // Timestamp of when this schedule was last compiled
}


Indexes: {"teacherId": 1} (unique), {"teacherShortName": 1}

2.8. timeSlotDefinitions (Defines period timings and breaks)

Defines the standard time slots for the institution.

Generated json
{
  "_id": 0, // slotIndex (used in routineSlots.slotIndex)
  "label": "Period 1",    // e.g., "Period 1", "Lunch Break"
  "startTime": "10:15",   // HH:MM (24-hour format)
  "endTime": "11:05",     // HH:MM
  "isBreak": false,       // Boolean, true if this slot is a break
  "sortOrder": 0          // For ensuring correct display order
}
// Example Break Slot:
{
  "_id": 3,
  "label": "BREAK",
  "startTime": "11:55",
  "endTime": "12:45",
  "isBreak": true,
  "sortOrder": 3
}
NORE_WHEN_COPYING_END

Indexes: {"_id": 1} (unique), {"sortOrder": 1}

3. Relationships & Data Integrity

Curriculum Definition: programSemesters.subjectsOffered.subjectId links to subjects._id. When creating/editing routineSlots, the selected subjectId must be one that is listed in the subjectsOffered array for the target programCode and semester in the programSemesters collection.

Scheduling Core: routineSlots links to programs (via programCode), subjects, teachers, and rooms using their respective IDs.

Denormalization: _display fields in routineSlots and teacherSchedules, and potentially in programSemesters.subjectsOffered, are denormalized for read performance. Application logic must ensure these are updated if the source data in master collections changes (e.g., a subject name is corrected).

Teacher Schedule Generation: When a routine slot is updated, a message containing affected teacher IDs is published to a RabbitMQ queue. A separate worker service processes these messages to update the denormalized teacherSchedules collection, ensuring data consistency.

Application-level validation is crucial for maintaining data consistency.

4. Query Examples (Illustrative)

Fetch Subjects for BCT, Semester 1 (for admin's subject dropdown):

Generated javascript
// 1. Get the program-semester document
const programSemesterDoc = await db.programSemesters.findOne({ programCode: "BCT", semester: 1 });
// 2. If subject names/codes are NOT denormalized in subjectsOffered:
if (programSemesterDoc) {
    const subjectIds = programSemesterDoc.subjectsOffered.map(s => s.subjectId);
    const subjectsForDropdown = await db.subjects.find({ _id: { $in: subjectIds } }).toArray();
    // Combine with courseType, etc., from programSemesterDoc.subjectsOffered
}
// If subject names/codes ARE denormalized, they are already in programSemesterDoc.subjectsOffered.

Collision Detection and Routine Fetching Queries: (Remain similar to previous examples, operating primarily on routineSlots).

This comprehensive database design using the programSemesters collection with an array of subjects provides a robust and fairly intuitive way to manage complex academic curricula and support smart scheduling features.

