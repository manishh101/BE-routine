# Smart Class Routine Management System

> **✨ Latest Update**: Enhanced with elective scheduling for 7th/8th semester students and streamlined admin interface

A comprehensive web application for managing university class schedules with Excel integration, conflict detection, and automated teacher schedule generation. Now featuring cross-section elective management for advanced semester students.

## 🚀 Features

### Advanced Elective Management (NEW)
- **Cross-Section Elective Scheduling**: 7th and 8th semester students can take electives across sections (AB/CD)
- **Unified Routine Display**: Electives appear in both section routines simultaneously
- **Student Composition Tracking**: Tracks students from different sections in same elective
- **Smart Conflict Detection**: Advanced validation prevents scheduling conflicts between core and elective subjects
- **Flexible Elective Configuration**: Support for technical, management, and open electives

### Core Routine Management
- **Single Source of Truth**: RoutineSlot model as the central data store
- **Denormalized Caching**: TeacherSchedule for optimized read operations
- **Smart Collision Detection**: Real-time conflict checking for teachers, rooms, and time slots
- **Flexible Scheduling**: Support for lectures, practicals, and tutorials
- **Teacher Schedule Synchronization**: Automatic teacher schedule updates with real-time sync

### Professional Teacher Management
- **Dynamic Schedule Generation**: Teacher schedules automatically generated from routine data
- **Real-time Synchronization**: Instant updates when routine assignments change
- **Professional Schedule Display**: Clean, comprehensive weekly schedule view
- **Advanced Cache Management**: Intelligent React Query cache invalidation
- **Excel Export**: Professional teacher schedule export functionality

### Professional Data Operations
- **Excel Import/Export**: Professional workflow with template download and validation
- **Bulk Operations**: Efficient handling of large routine imports
- **Data Integrity**: Comprehensive validation against master data
- **Transaction Safety**: Dry-run validation with commit workflow

### User Management
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access**: Admin and Teacher roles with appropriate permissions
- **Profile Management**: User profiles with academic credentials

### Advanced Architecture
- **Async Processing**: RabbitMQ queue for teacher schedule regeneration
- **Worker Services**: Background processing for intensive operations
- **Health Monitoring**: API and queue health check endpoints
- **Database Optimization**: Compound indexes for performance

### Modern UI/UX
- **Responsive Design**: Works on all devices and screen sizes
- **Excel-like Grid**: Intuitive spreadsheet-style routine display
- **Real-time Updates**: Live data synchronization
- **Professional Styling**: Clean interface with Tailwind CSS and Ant Design
- **Streamlined Admin Interface**: Focused navigation with 10 core features (37.5% reduction from original 16)

## 🛠 Tech Stack

### Frontend
- **React 18+** - Modern React with hooks
- **Vite 5+** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Ant Design** - Professional UI components
- **React Router DOM v6+** - Client-side routing
- **TanStack Query** - Data fetching and caching
- **Zustand** - Lightweight state management
- **Axios** - HTTP client

### Backend
- **Node.js** - JavaScript runtime environment
- **Express.js** - Fast, unopinionated web framework
- **MongoDB** - NoSQL database with GridFS support
- **Mongoose** - MongoDB object modeling
- **JWT** - JSON Web Token authentication
- **ExcelJS** - Excel file generation and parsing
- **RabbitMQ** - Message queue for async processing
- **Multer** - File upload middleware
- **bcrypt** - Password hashing

### Development & Architecture
- **Professional Workflows**: Template download → validation → commit
- **Message Queues**: Async teacher schedule regeneration
- **Worker Services**: Background task processing
- **Health Monitoring**: API and queue status endpoints
- **Database Optimization**: Compound indexes and efficient queries
- **Error Handling**: Comprehensive validation and error reporting

## 📁 Project Structure

```
/project-root
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   │   ├── RoutineGrid.jsx          # Excel-like routine display
│   │   │   ├── TeacherRoutine.jsx       # Teacher schedule view
│   │   │   ├── AssignClassModal.jsx     # Enhanced with elective support
│   │   │   ├── Layout.jsx               # Streamlined navigation (10 core features)
│   │   │   └── ...
│   │   ├── contexts/        # Global state management
│   │   ├── pages/          # Page components
│   │   │   ├── admin/      # Admin management pages
│   │   │   │   ├── ElectiveManagement.jsx       # NEW: Elective group management
│   │   │   │   ├── ConflictDetection.jsx        # Enhanced conflict detection
│   │   │   │   ├── ProgramRoutineManager.jsx    # Core routine management
│   │   │   │   ├── AnalyticsDashboard.jsx       # Hidden from navigation
│   │   │   │   ├── UserManagement.jsx           # Hidden from navigation
│   │   │   │   ├── SessionManagement.jsx        # Hidden from navigation
│   │   │   │   ├── TemplateManagement.jsx       # Hidden from navigation
│   │   │   │   ├── RoomVacancyAnalysis.jsx      # Hidden from navigation
│   │   │   │   └── ...
│   │   │   └── ...
│   │   ├── services/       # API integration
│   │   └── utils/          # Utility functions
│   └── package.json        # Frontend dependencies
├── backend/                 # Node.js backend API
│   ├── config/             # Database and authentication config
│   ├── controllers/        # Route handlers with business logic
│   │   ├── routineController.js         # Enhanced with elective functions
│   │   ├── electiveGroupController.js   # NEW: Elective management
│   │   ├── sectionElectiveChoiceController.js # NEW: Section choices
│   │   └── ...
│   ├── models/            # Mongoose schemas
│   │   ├── RoutineSlot.js              # Enhanced with elective fields
│   │   ├── ElectiveGroup.js            # NEW: Elective group model
│   │   ├── SectionElectiveChoice.js    # NEW: Section choice tracking
│   │   ├── TeacherSchedule.js          # Denormalized cache
│   │   └── ...
│   ├── routes/            # API endpoints
│   │   ├── routine.js                  # Enhanced with elective routes
│   │   ├── electiveGroups.js           # NEW: Elective API endpoints
│   │   ├── sectionElectiveChoices.js   # NEW: Section choice API
│   │   └── ...
│   ├── services/          # External service integrations
│   │   ├── queue.service.js            # RabbitMQ messaging
│   │   ├── conflictDetection.js        # Enhanced elective validation
│   │   └── ...
│   ├── utils/             # Utility functions
│   │   ├── excelGeneration.js          # Excel export logic
│   │   ├── scheduleGeneration.js       # Teacher schedule calc
│   │   └── conflictDetection.js        # Enhanced collision detection
│   ├── scripts/           # Database management scripts
│   ├── worker.js          # Background worker process
│   └── server.js          # Server entry point
├── md/                     # Architecture documentation
│   ├── architecture.md                 # System architecture spec
│   ├── database_design.md              # Database schema design
│   ├── ELECTIVE_MANAGEMENT_SYSTEM_COMPLETE.md # NEW: Elective implementation report
│   └── ...
└── README.md              # Project documentation
```
- **Mongoose** - MongoDB ODM
- **JWT** - Authentication tokens
- **Passport.js** - Authentication middleware
- **bcrypt** - Password hashing
- **Swagger/OpenAPI** - API documentation

## 📁 Project Structure

```
/project-root
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── contexts/        # Global state management
│   │   ├── pages/          # Page components
│   │   ├── services/       # API integration
│   │   └── App.jsx         # Main application component
│   ├── public/             # Static assets
│   └── package.json        # Frontend dependencies
├── backend/                 # Node.js backend API
│   ├── config/             # Configuration files
│   ├── controllers/        # Route handlers
│   ├── models/            # Database schemas
│   ├── routes/            # API routes
│   ├── middleware/        # Custom middleware
│   └── server.js          # Server entry point
└── README.md              # Project documentation
```

## 🚀 Getting Started

### Prerequisites
- Node.js (LTS version recommended)
- MongoDB (local installation or MongoDB Atlas)
- RabbitMQ (for async processing)
- npm or yarn package manager

### Quick Start with VS Code Tasks

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd routine
   ```

2. **Use VS Code Tasks (Recommended)**
   - Open project in VS Code
   - Use `Ctrl+Shift+P` → "Tasks: Run Task"
   - Run "Start Backend" (installs dependencies and starts server)
   - Run "Start Frontend" (installs dependencies and starts dev server)

3. **Manual Setup**

   **Backend Setup**
   ```bash
   cd backend
   npm install
   
   # Create .env file with your configuration
   cp .env.example .env
   # Edit .env with your MongoDB URI and JWT secret
   
   npm run dev
   ```
   The backend will start on `http://localhost:7102`

   **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The frontend will start on `http://localhost:7101`

4. **Start Background Services**
   ```bash
   # Start RabbitMQ (if using Docker)
   docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
   
   # Start worker service for async processing
   cd backend
   npm run worker
   ```

## 🔐 Authentication

### Initial Admin Setup
After setting up the backend, create an admin user:
```bash
cd backend
node scripts/createAdmin.js
```

### Default Admin Credentials
- **Email**: admin@routine.com
- **Password**: admin123
- **Role**: Admin

### Access Information
- **Public Access**: No login required for viewing routines, teachers, programs, and subjects
- **Admin Access**: Login through the "Admin Login" button in the top-right corner
- **Teacher Accounts**: Created by admins; for record-keeping only (no direct login)

### Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=7102
MONGODB_URI=mongodb://localhost:27017/be-routine-management
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=30d
RABBITMQ_URL=amqp://localhost:5672
NODE_ENV=development
```

## 📖 API Documentation

### Core Endpoints

#### Authentication
- `POST /api/auth/login` - Admin login with JWT token
- `GET /api/auth/me` - Get current user profile
- `POST /api/auth/logout` - Logout (clear token)

#### Health Monitoring
- `GET /api/health` - API health status
- `GET /api/health/queue` - RabbitMQ health status

#### Enhanced Routine Management
- `GET /api/routines/:program/:semester/:section` - Get class routine with electives
- `POST /api/routines/assign` - Assign class to slot (Admin only)
- `POST /api/routines/electives/schedule` - **NEW**: Schedule cross-section electives (Admin only)
- `POST /api/routines/electives/conflicts` - **NEW**: Check elective-specific conflicts (Admin only)
- `DELETE /api/routines/clear` - Clear slot assignment (Admin only)
- `GET /api/routines/teacher/:teacherId` - Get teacher schedule

#### Elective Management (NEW)
- `GET /api/elective-groups` - Get all elective groups
- `POST /api/elective-groups` - Create elective group (Admin only)
- `PUT /api/elective-groups/:id` - Update elective group (Admin only)
- `DELETE /api/elective-groups/:id` - Delete elective group (Admin only)
- `GET /api/section-elective-choices` - Get section elective choices
- `POST /api/section-elective-choices` - Create section choice (Admin only)
- `PUT /api/section-elective-choices/:id` - Update section choice (Admin only)

#### Excel Operations
- `GET /api/routines/export/class/:program/:semester/:section` - Export class routine to Excel
- `GET /api/routines/export/teacher/:teacherId` - Export teacher schedule to Excel
- `GET /api/routines/import/template` - Download Excel import template
- `POST /api/routines/import/validate` - Validate Excel file for import (Admin only)

#### Master Data
- **Teachers**
  - `GET /api/teachers` - Get all teachers
  - `POST /api/teachers` - Create teacher (Admin only)
  - `PUT /api/teachers/:id` - Update teacher (Admin only)
  - `DELETE /api/teachers/:id` - Delete teacher (Admin only)

- **Programs**
  - `GET /api/programs` - Get all programs
  - `POST /api/programs` - Create program (Admin only)
  - `PUT /api/programs/:id` - Update program (Admin only)
  - `DELETE /api/programs/:id` - Delete program (Admin only)

- **Subjects**
  - `GET /api/subjects` - Get all subjects
  - `GET /api/subjects/program/:programId` - Get subjects by program
  - `POST /api/subjects` - Create subject (Admin only)
  - `PUT /api/subjects/:id` - Update subject (Admin only)
  - `DELETE /api/subjects/:id` - Delete subject (Admin only)

- **Rooms**
  - `GET /api/rooms` - Get all rooms
  - `POST /api/rooms` - Create room (Admin only)
  - `PUT /api/rooms/:id` - Update room (Admin only)
  - `DELETE /api/rooms/:id` - Delete room (Admin only)

- **Time Slots**
  - `GET /api/timeslots` - Get all time slot definitions
  - `POST /api/timeslots` - Create time slot (Admin only)
  - `PUT /api/timeslots/:id` - Update time slot (Admin only)
  - `DELETE /api/timeslots/:id` - Delete time slot (Admin only)

### Architecture Features

#### Single Source of Truth
- **RoutineSlot**: Central model for all routine data with enhanced elective support
- **Denormalized Cache**: TeacherSchedule for optimized queries
- **Async Updates**: Worker service regenerates teacher schedules

#### Enhanced Elective System
1. **Cross-Section Scheduling**: Electives appear in both AB and CD section routines
2. **Student Composition Tracking**: Records students from each section per elective
3. **Advanced Conflict Detection**: Prevents core vs elective and elective overlap conflicts
4. **Unified Display**: Seamless integration with existing routine views

#### Professional Excel Workflow
1. **Template Download**: Get properly formatted Excel template
2. **Data Entry**: Fill template with routine data
3. **Validation**: Upload for comprehensive validation
4. **Commit**: Import validated data (transaction-safe)

#### Advanced Collision Detection
- **In-file Conflicts**: Duplicate assignments within upload
- **Database Conflicts**: Existing schedule conflicts
- **Multi-level Validation**: Teacher, room, and slot availability

#### Background Processing
- **Message Queue**: RabbitMQ for async operations
- **Worker Service**: Background teacher schedule regeneration
- **Fallback Mode**: Direct processing if queue unavailable

## 👨‍🏫 Teacher Schedule System

The system features a comprehensive teacher schedule management module with real-time synchronization and professional UI.

### Key Features

#### Automatic Schedule Generation
- **Dynamic Creation**: Teacher schedules are automatically generated from routine assignments
- **Single Source of Truth**: RoutineSlot collection serves as the authoritative data source
- **Real-time Updates**: Schedules update instantly when routine changes occur
- **Queue-based Processing**: Background workers handle schedule regeneration

#### Professional Interface
- **Modern UI**: Clean, responsive design matching the routine manager
- **Comprehensive Display**: Shows subjects, programs, rooms, timings, and class types
- **Schedule Statistics**: Real-time summary of classes, hours, subjects, and programs
- **Excel Export**: Professional schedule export with proper formatting

#### Real-time Synchronization
- **Cache Management**: Intelligent React Query cache invalidation
- **Automatic Updates**: Teacher schedules refresh when routine data changes
- **Performance Optimized**: Minimal API calls with smart caching strategies
- **Error Handling**: Robust error recovery and retry mechanisms

### Usage

#### Teacher Schedule Manager
```jsx
// Simple integration in any React component
import TeacherScheduleManager from '../components/TeacherScheduleManager';

const TeacherPage = () => (
  <TeacherScheduleManager />
);
```

#### Cache Integration
```javascript
// Automatic teacher schedule sync in routine mutations
import { handleRoutineChangeCache } from '../utils/teacherScheduleCache';

const mutation = useMutation({
  mutationFn: assignClass,
  onSuccess: async (result) => {
    await handleRoutineChangeCache(queryClient, result);
  }
});
```

### API Endpoints

#### Teacher Schedules
- `GET /api/teachers/:id/schedule` - Get teacher's weekly schedule
- `GET /api/teachers/:id/schedule/excel` - Export teacher schedule to Excel
- `GET /api/teachers` - List all teachers for selection

### Technical Implementation

#### Backend Infrastructure
- **Dynamic Generation**: Schedules computed in real-time from RoutineSlot data
- **Queue Service**: RabbitMQ handles teacher schedule invalidation messages
- **Performance**: Optimized queries with proper indexing
- **Excel Export**: Server-side Excel generation with professional formatting

#### Frontend Architecture
- **Component Structure**: Modular, reusable components
- **State Management**: React Query for data fetching and caching
- **Real-time Updates**: Automatic cache invalidation and refresh
- **Responsive Design**: Works on all devices and screen sizes

For detailed information, see [TEACHER_SCHEDULE_SYSTEM.md](./TEACHER_SCHEDULE_SYSTEM.md).

## 🔧 Key Features Explained

### Advanced Elective Scheduling (NEW)
The system now supports complex elective management for 7th and 8th semester students:
- **Cross-Section Enrollment**: Students from sections A & B can enroll in same elective class
- **Unified Routine Display**: Same elective appears in both section routines at identical time slots
- **Student Composition**: Tracks exact number of students from each section (e.g., 30 from AB, 30 from CD)
- **Smart Validation**: Prevents scheduling conflicts between core subjects and electives
- **Multiple Electives**: 8th semester supports multiple electives (Elective I, Elective II)

### Smart Collision Detection
Enhanced conflict detection now includes:
- Teacher availability (same teacher, same time slot)
- Room availability (same room, same time slot)
- Slot conflicts (same program/semester/section, same time)
- **NEW**: Core vs Elective conflicts (prevents electives from conflicting with core subjects)
- **NEW**: Elective overlap prevention (multiple electives at same time)
- Cross-validation during bulk imports

### Excel Import/Export
- **Template-based Import**: Professional workflow with validation
- **Bulk Operations**: Efficient handling of large datasets
- **Error Reporting**: Row-by-row validation feedback
- **Transaction Safety**: Dry-run validation before commit

### Async Processing
- **Queue-based Updates**: Teacher schedules updated asynchronously
- **Worker Services**: Background processing for intensive operations
- **Health Monitoring**: Queue and API status endpoints

### Role-Based Access
- **Admin**: Full CRUD access to all entities, bulk operations, and elective management
- **Teacher**: View access to schedules and profiles
- **Public**: Read-only access to basic routine information

### Database Architecture
- **Single Source of Truth**: RoutineSlot as central data store with elective extensions
- **Denormalized Caching**: TeacherSchedule for read optimization
- **Compound Indexes**: Optimized queries for common operations
- **Data Integrity**: Comprehensive validation and referential integrity
- **Elective Support**: Enhanced schema for cross-section elective tracking

### Admin Interface Optimization
The admin interface has been streamlined for better usability:
- **Focused Navigation**: Reduced from 16 to 10 core features (37.5% reduction)
- **Hidden Advanced Features**: Analytics, user management, templates, session management, room vacancy analysis, and department management are preserved but hidden from main navigation
- **Quick Access**: Core daily-use features prominently displayed
- **Preserved Functionality**: All backend APIs remain active for hidden features

## 📚 Documentation

### Core Documentation
- [Documentation Index](md/INDEX.md) - Complete documentation overview
- [Architecture Overview](md/architecture.md) - System design and data flow
- [Database Design](md/database_design.md) - Schema and relationships
- [Routine Management](md/routine.md) - Routine management documentation

### New Feature Documentation
- [Elective Management System](md/ELECTIVE_MANAGEMENT_SYSTEM_COMPLETE.md) - **NEW**: Complete implementation report for cross-section elective scheduling
- [Advanced Conflict Detection](md/ADVANCED_CONFLICT_DETECTION_COMPLETE.md) - Enhanced conflict detection documentation

### Implementation Reports
- [Feature Completion Reports](md/) - Detailed implementation and validation reports
- [System Cleanup Reports](md/) - Code optimization and maintenance reports
- [Excel Integration Reports](md/) - Excel import/export implementation reports

### Setup Guides
- [Quick Backend Setup](md/QUICK_BACKEND_SETUP.md) - Backend setup guide
- [Queue Setup Guide](backend/QUEUE_SETUP.md) - RabbitMQ configuration
- [File Upload Documentation](backend/FILE_UPLOAD_DOCS.md) - Excel import/export workflow

## 🛠 Development Scripts

```bash
# Backend scripts
npm run dev          # Start development server
npm run worker       # Start background worker
npm run test         # Run test suite

# Database management
node scripts/createAdmin.js      # Create admin user
node scripts/clearDatabase.js   # Clear all data
node scripts/seedFaculty.js     # Seed with sample data

# VS Code tasks (recommended)
# Use Ctrl+Shift+P → "Tasks: Run Task"
# - Start Backend          # Installs dependencies and starts server on port 7102
# - Start Frontend         # Installs dependencies and starts dev server on port 7101
# - Restart Project        # Restarts both backend and frontend
```

## 🆕 Recent Updates & Changes

### Elective Management System (Latest)
- ✅ **Cross-Section Elective Scheduling**: 7th and 8th semester electives work across AB/CD sections
- ✅ **Enhanced Backend API**: New endpoints for elective scheduling and conflict detection
- ✅ **Frontend Integration**: AssignClassModal enhanced with elective configuration options
- ✅ **Advanced Conflict Detection**: Prevents core vs elective and elective overlap conflicts
- ✅ **Unified Routine Display**: Electives appear in both section routines simultaneously

### Admin Interface Streamlining
- ✅ **Navigation Optimization**: Reduced admin navigation from 16 to 10 core features
- ✅ **Hidden Advanced Features**: Analytics, user management, templates, session management, room vacancy analysis, and department management moved to background
- ✅ **Preserved Functionality**: All backend APIs remain active for advanced features
- ✅ **Improved User Experience**: Focus on daily-use routine management features

### Current Status
- **Backend Server**: Running on port 7102 with full elective support
- **Frontend Application**: Running on port 7101 with streamlined interface
- **Database**: Enhanced with elective-specific models and fields
- **Documentation**: Complete implementation reports available in `/md` folder

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- React team for the amazing framework
- Ant Design team for the beautiful UI components
- MongoDB team for the flexible database
- All open-source contributors who made this project possible

## 📞 Support & Information

### System Information
- **Current Version**: Enhanced with Elective Management System
- **Backend Port**: 7102
- **Frontend Port**: 7101
- **Database**: MongoDB with enhanced elective support
- **Queue System**: RabbitMQ for background processing

### Admin Navigation Features
**Visible Core Features (10):**
1. Dashboard
2. Class Routine 
3. Teacher Schedule
4. Routine Manager
5. Teachers Management
6. Programs Management
7. Subjects Management
8. Rooms Management
9. Time Slots Management
10. Academic Calendar
11. Elective Management
12. Conflict Detection
13. Lab Groups

**Hidden Advanced Features (6):**
- Analytics Dashboard (accessible via direct URL: `/analytics-dashboard`)
- User Management (accessible via direct URL: `/user-manager`)
- Session Management (accessible via direct URL: `/session-manager`)
- Template Management (accessible via direct URL: `/template-manager`)
- Room Vacancy Analysis (accessible via direct URL: `/room-vacancy-analysis`)
- Department Management (accessible via direct URL: `/departments-manager`)

For support, create an issue in the repository or contact the development team.

---

**Latest Update**: December 2024 - Enhanced with comprehensive elective management system for 7th and 8th semester students, featuring cross-section scheduling and streamlined admin interface. 🎉
