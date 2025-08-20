import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme, App as AntdApp } from 'antd';
import useAuthStore from './contexts/authStore';

// Pages
import HomePage from './pages/Dashboard';
import LoginPage from './pages/Login';
import ProgramRoutineView from './pages/ProgramRoutineView';
import TeacherRoutinePage from './pages/TeacherRoutinePage';
import ProgramRoutineManager from './pages/admin/ProgramRoutineManager';
import Layout from './components/Layout';
import SubjectsManager from './pages/admin/Subjects';
import TeachersManager from './pages/admin/Teachers';
import RoomsManager from './pages/admin/RoomManagement';
import Programs from './pages/admin/Programs';
import TimeSlotManagement from './pages/admin/TimeSlotManagement';
import ExcelDemo from './pages/ExcelDemo';
import TeacherExcelDemo from './pages/TeacherExcelDemo';
import TeacherAPITest from './pages/TeacherAPITest';
import RoomRoutinePage from './pages/RoomRoutinePage';
import PublicSubjects from './pages/PublicSubjects';
import TeacherMeetingScheduler from './pages/TeacherMeetingScheduler';

// New Admin Pages - Phase 1
import DepartmentManagement from './pages/admin/DepartmentManagement';
import AcademicCalendarManagement from './pages/admin/AcademicCalendarManagement';
import SessionManagement from './pages/admin/SessionManagement';
import ElectiveManagement from './pages/admin/ElectiveManagement';
import ConflictDetection from './pages/admin/ConflictDetection';

// New Admin Pages - Phase 2
import AnalyticsDashboard from './pages/admin/AnalyticsDashboard';
import LabGroupManagement from './pages/admin/LabGroupManagement';
import UserManagement from './pages/admin/UserManagement';
import TemplateManagement from './pages/admin/TemplateManagement';
import RoomVacancyAnalysis from './pages/admin/RoomVacancyAnalysis';

// Protected route component
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { token, user, isInitialized } = useAuthStore();
  
  // Wait for auth store to initialize to prevent redirect loops
  if (!isInitialized) {
    return <div>Loading...</div>;
  }
  
  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }
  
  if (requireAdmin && (!user || user.role !== 'admin')) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

// Create a client outside of the component to prevent recreation on re-renders
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors) except for 429
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          // Retry on 429 (Too Many Requests) with exponential backoff
          if (error?.response?.status === 429) {
            return failureCount < 3;
          }
          return false;
        }
        // Only retry up to 2 times for other errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex, error) => {
        // For 429 errors, use longer delays
        if (error?.response?.status === 429) {
          return Math.min(2000 * 2 ** attemptIndex, 15000); // 2s, 4s, 8s, max 15s
        }
        return Math.min(1000 * 2 ** attemptIndex, 30000);
      },
      staleTime: 10 * 60 * 1000, // 10 minutes - longer cache to reduce requests
      gcTime: 15 * 60 * 1000, // 15 minutes (was cacheTime)
      // Add error boundary
      useErrorBoundary: false,
    },
    mutations: {
      retry: (failureCount, error) => {
        // Retry mutations on 429 errors
        if (error?.response?.status === 429) {
          return failureCount < 2;
        }
        return false;
      },
      retryDelay: (attemptIndex, error) => {
        if (error?.response?.status === 429) {
          return Math.min(3000 * 2 ** attemptIndex, 10000); // 3s, 6s, max 10s
        }
        return 1000;
      },
    },
  },
});
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#667eea',
            colorSuccess: '#00d4aa',
            colorWarning: '#ffb74d',
            colorError: '#ff6b6b',
            colorInfo: '#4facfe',
            borderRadius: 8,
            wireframe: false,
            fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
            fontSize: 14,
            colorBgContainer: '#ffffff',
            colorBgElevated: '#ffffff',
            colorBgLayout: '#fafafa',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            boxShadowSecondary: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          },
          components: {
            Layout: {
              bodyBg: '#fafafa',
              headerBg: 'rgba(255, 255, 255, 0.8)',
              siderBg: 'rgba(255, 255, 255, 0.95)',
            },
            Menu: {
              itemBg: 'transparent',
              itemSelectedBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              itemHoverBg: '#f5f5f5',
            },
            Card: {
              borderRadiusLG: 12,
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              boxShadowHover: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            },
            Button: {
              borderRadius: 8,
              fontWeight: 500,
            },
            Input: {
              borderRadius: 8,
            },
            Table: {
              borderRadiusLG: 12,
              headerBg: '#fafafa',
            }
          }
        }}
      >
        <AntdApp>
          <Router>
            <Routes>
            {/* Login route - outside of Layout */}
            <Route path="/admin/login" element={<LoginPage />} />
            
            {/* Routes with Layout */}
            <Route path="/" element={<Layout />}>
              {/* Public Routes */}
              <Route index element={<HomePage />} />
              <Route path="program-routine" element={<ProgramRoutineView />} />
              <Route path="teacher-routine" element={<TeacherRoutinePage />} />
              <Route path="excel-demo" element={<ExcelDemo />} />
              <Route path="teacher-excel-demo" element={<TeacherExcelDemo />} />
              <Route path="api-test" element={<TeacherAPITest />} />
              <Route path="room-routine" element={<RoomRoutinePage />} />
              <Route path="subjects" element={<PublicSubjects />} />
              
              {/* Admin Routes - Protected */}
              <Route 
                path="admin" 
                element={
                  <ProtectedRoute requireAdmin>
                    <HomePage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="program-routine-manager" 
                element={
                  <ProtectedRoute requireAdmin>
                    <ProgramRoutineManager />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="subjects-manager" 
                element={
                  <ProtectedRoute requireAdmin>
                    <SubjectsManager />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="teachers-manager" 
                element={
                  <ProtectedRoute requireAdmin>
                    <TeachersManager />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="rooms-manager" 
                element={
                  <ProtectedRoute requireAdmin>
                    <RoomsManager />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="programs-manager" 
                element={
                  <ProtectedRoute requireAdmin>
                    <Programs />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="timeslots-manager" 
                element={
                  <ProtectedRoute requireAdmin>
                    <TimeSlotManagement />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="department-manager" 
                element={
                  <ProtectedRoute requireAdmin>
                    <DepartmentManagement />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="academic-calendar-manager" 
                element={
                  <ProtectedRoute requireAdmin>
                    <AcademicCalendarManagement />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="admin/meeting-scheduler" 
                element={
                  <ProtectedRoute requireAdmin>
                    <TeacherMeetingScheduler />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="session-manager" 
                element={
                  <ProtectedRoute requireAdmin>
                    <SessionManagement />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="elective-manager" 
                element={
                  <ProtectedRoute requireAdmin>
                    <ElectiveManagement />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="conflict-detection" 
                element={
                  <ProtectedRoute requireAdmin>
                    <ConflictDetection />
                  </ProtectedRoute>
                } 
              />
              
              {/* Phase 2 - Core Features */}
              <Route 
                path="analytics-dashboard" 
                element={
                  <ProtectedRoute requireAdmin>
                    <AnalyticsDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="lab-group-manager" 
                element={
                  <ProtectedRoute requireAdmin>
                    <LabGroupManagement />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="user-manager" 
                element={
                  <ProtectedRoute requireAdmin>
                    <UserManagement />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="template-manager" 
                element={
                  <ProtectedRoute requireAdmin>
                    <TemplateManagement />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="room-vacancy-analysis" 
                element={
                  <ProtectedRoute requireAdmin>
                    <RoomVacancyAnalysis />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="excel-demo-admin" 
                element={
                  <ProtectedRoute requireAdmin>
                    <ExcelDemo />
                  </ProtectedRoute>
                } 
              />
            </Route>
            
            {/* Catch-all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;