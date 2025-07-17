Of course. Here is the complete, final architecture document. It integrates all our discussions: your original MD files, the Excel-like grid as the central UI paradigm, the automated teacher routine generation, and the professional Excel import feature.

This document is designed to serve as a comprehensive blueprint for the development team.

System Architecture & Technical Design: Smart Class Routine Management
1. Vision & Core Principles

This document outlines the technical architecture for the Smart Class Routine Management System. The design is based on a modern, decoupled web application stack, prioritizing a responsive user experience, robust data integrity, and powerful administrative tools.

The architecture is built on four core principles:

User Experience First: The interface for both program and teacher routines will be a fast, responsive, and familiar "Excel-like" grid. Data display and interaction will be highly intuitive.

Automation & Data Integrity: Teacher schedules are not managed manually. They are automatically generated as a direct reflection of the master program routines. A single source of truth (routineSlots collection) prevents data conflicts.

Bulk Operations: Administrators can create and update entire routines efficiently through a robust Excel Import/Export feature, respecting and enhancing their existing workflows.

Scalability & Responsiveness: The backend is decoupled into synchronous (API) and asynchronous (Worker) processes. This ensures the UI remains fast, even during complex, data-heavy operations like bulk imports.

2. Architectural Diagram
Generated mermaid
graph TD
    subgraph Browser (Client - React)
        A[AppShell] --> B[Program Routine View];
        A --> C[Teacher Routine View];
        A --> D[Excel Import Interface];

        B --> E{Excel-like Grid (AG-Grid)};
        C --> E;

        E -- Displays data from --> F{State Management (TanStack Query)};
        E -- Allows for --> G[Client-Side Excel Export];
    end

    subgraph Backend Services (Node.js)
        H[API Server (Express/NestJS)] -- Publishes "Update Task" --> I[Message Queue (RabbitMQ/SQS)];
        H -- Handles REST API calls --> J[Business Logic Layer];
        K[Worker Service] -- Consumes "Update Task" from --> I;
        J --> L{Collision Detection};
        J --> M{Bulk Import/Export Logic};
    end

    subgraph Persistence (MongoDB Atlas)
        N[routineSlots Collection (Source of Truth)];
        O[teacherSchedules Collection (Denormalized Cache)];
        P[Master Data (subjects, teachers, rooms, programSemesters)];
    end

    %% Data Flow
    F -- API Calls --> H;
    D -- Uploads Excel File --> H;
    H -- Writes/Validates against --> N;
    H -- Reads master data from --> P;
    K -- Generates/Updates --> O;
    K -- Reads from --> N;
    K -- Reads from --> P;

3. Database Architecture

The database schema is adopted from database_design.md and is foundational to this architecture.

routineSlots (Single Source of Truth): The most critical collection. Every single scheduled class across all programs is a document here. It is the authority for all collision checks and routine generation.

teacherSchedules (Denormalized Read Cache): This collection exists purely for performance. It stores the complete, pre-calculated weekly schedule for each teacher, enabling instant loading of their routine. This collection is maintained exclusively by the Worker Service.

programSemesters, subjects, teachers, rooms (Master Data): These collections store the core entities of the academic structure and resources.

4. Backend Architecture

The backend is split into two distinct services to optimize for responsiveness and robust processing:

* **Main API Server:** Handles HTTP requests, performs database operations, and manages the classroom scheduling logic. After successful routine changes, it publishes messages to RabbitMQ for asynchronous processing.

* **Worker Service:** 
   * Listens to the 'teacher_routine_updates' queue in RabbitMQ
   * Consumes messages containing arrays of affected teacher IDs
   * For each teacher ID, queries all their assigned routine slots
   * Rebuilds the teacher's complete weekly schedule
   * Stores the denormalized schedule in the teacherSchedules collection
   * Acknowledges the message upon successful processing

* **Message Flow:**
   1. User updates a routine via the API
   2. API server identifies affected teachers
   3. API server publishes message to queue: `{ affectedTeacherIds: [...] }`
   4. Worker consumes message and processes each teacher
   5. Background Process: The Worker recalculates the teacher's schedule and updates the teacherSchedules collection
   6. The teacher's personal routine view is now instantly available and correct

4.1. API Server (Synchronous)

This service handles all immediate, interactive user requests.

Technology: Node.js with Express.js (or NestJS), Zod for validation.

Key Responsibilities:

Live Collision Detection: For manual, single-class assignments via the UI, it performs instant collision checks against routineSlots before saving.

Data Serving: Provides all data needed to populate the UI grids and dropdowns.

Triggering Asynchronous Tasks: After a successful data modification (single or bulk), it publishes a task to the message queue for the Worker to handle.

Managing Bulk Imports: Orchestrates the multi-step Excel import process (validation, feedback, and commit).

4.2. Worker Service (Asynchronous)

This background service handles computationally intensive tasks without blocking the user.

Technology: Node.js, RabbitMQ/AWS SQS client.

Primary Responsibility: Teacher Routine Generation

Listens for messages from the API server (e.g., { "teacherIds": ["id1", "id2", ...] }).

Receives Task: When a message arrives, it gets the list of teachers whose schedules have changed.

Recalculates: For each teacherId, it performs a full recalculation by querying routineSlots for all classes assigned to that teacher.

Updates Cache: It saves the newly generated schedule into the teacherSchedules collection using an updateOne with upsert: true operation.

5. Frontend Architecture: The "Excel-like" Experience

The frontend is designed to deliver a fluid, spreadsheet-centric user experience.

Technology: React, Ant Design, AG-Grid, TanStack Query.

Core Component (RoutineGrid.jsx): A highly-configured AG-Grid component used for both program and teacher routines.

Layout: Rows represent Time Slots, Columns represent Days of the Week.

Custom Cell Renderers: Each grid cell is a custom React component (ClassCell.jsx) that displays rich, multi-line information (Subject Name, Program/Section, Teacher/Room) in a structured and readable format.

Interactivity: Supports single-click to open an "Assign Class" modal for empty cells and an "Edit Class" modal for filled cells.

6. Feature Implementation: Excel Import/Export
6.1. Exporting Routines

Method 1: Quick Export (Client-Side): An "Export View" button in the UI uses AG-Grid's built-in gridApi.exportDataAsExcel() to instantly download a spreadsheet of the user's current view.

Method 2: Formatted Export (Server-Side): A "Download Official" button calls a dedicated API endpoint (e.g., GET /api/export/routine/...). The backend uses a library like ExcelJS to generate a perfectly formatted, multi-sheet workbook with proper titles, merged cells, and styling, then streams it to the user.

6.2. Importing Routines (A Professional Workflow)

This feature is designed to be robust, user-friendly, and safe.

Template Download: The UI provides a button to download a blank, pre-formatted Excel template with the exact required columns and data formats. This minimizes user error.

Upload & Dry Run (POST /api/routines/import/validate):

The user uploads their filled-out template.

The backend does not write to the database. It parses the file in memory and performs a comprehensive validation pass on every row:

Integrity Check: Does the TeacherShortName, SubjectCode, etc., exist in the master data?

Collision Check (In-File): Does row 10 conflict with row 35 of the same file?

Collision Check (Database): Does row 15 conflict with a class already in the routineSlots collection?

Feedback Loop:

On Success: The API returns a 200 OK with a success summary and a unique transactionId.

On Failure: The API returns a 400 Bad Request. The response body contains a JSON object detailing every error and its corresponding row number. The UI then prompts the user to download an annotated version of their spreadsheet with the errors highlighted.

Commit (POST /api/routines/import/commit):

After a successful validation, the UI enables a "Confirm Import" button.

This sends the transactionId to the commit endpoint.

The backend retrieves the validated data and performs a bulk insert into routineSlots, wrapped in a MongoDB Transaction to ensure atomicity (all or nothing).

Upon successful commit, it publishes a single message to the queue containing all unique teacherIds from the import, triggering the Worker Service to update all affected teacher routines.

7. End-to-End User Flow: Manual Class Assignment

Action: Admin clicks an empty cell in the grid for BCT/Sem1.

API Call: The "Assign Class" modal sends a POST request.

Backend: The API server performs collision checks. If clear, it saves to routineSlots and publishes the affected teacher's ID to the message queue.

UI Feedback: The API returns success, and TanStack Query refreshes the grid, showing the new class.

Background Process: The Worker recalculates the teacher's schedule and updates the teacherSchedules collection. The teacher's personal routine view is now instantly available and correct.