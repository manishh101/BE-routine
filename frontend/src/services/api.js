import axios from 'axios';

const API_URL = '/api';

// Request queue for handling rate limiting
class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.delay = 100; // Start with 100ms delay between requests
    this.maxDelay = 5000; // Maximum delay of 5 seconds
  }

  async add(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const { requestFn, resolve, reject } = this.queue.shift();
      
      try {
        const result = await requestFn();
        resolve(result);
        // Reset delay on success
        this.delay = Math.max(100, this.delay * 0.8);
      } catch (error) {
        if (error.response?.status === 429) {
          // Rate limited - increase delay and retry
          this.delay = Math.min(this.maxDelay, this.delay * 1.5);
          console.warn(`Rate limited, increasing delay to ${this.delay}ms`);
          
          // Put the request back at the front of the queue
          this.queue.unshift({ requestFn, resolve, reject });
          
          // Wait before processing next request
          await new Promise(resolve => setTimeout(resolve, this.delay));
          continue;
        }
        reject(error);
      }
      
      // Small delay between requests to prevent overwhelming the server
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.delay));
      }
    }
    
    this.processing = false;
  }
}

const requestQueue = new RequestQueue();

// Create axios instance with base URL
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 seconds timeout (increased from 10s)
});

// Flag to prevent multiple simultaneous token refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Add a request interceptor to include the authorization token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    console.log(`API Success: ${response.config.url}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    console.error(`API Error: ${error.config?.url || 'unknown endpoint'}`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Handle rate limiting (429 errors)
    if (error.response?.status === 429) {
      console.warn('Rate limit exceeded, implementing retry with backoff');
      
      // Show user-friendly message for rate limiting
      if (typeof window !== 'undefined' && window.antd?.message) {
        window.antd.message.warning({
          content: 'Server is busy, please wait a moment...',
          duration: 3,
          key: 'rate-limit-warning'
        });
      }
      
      if (!originalRequest._retryCount) {
        originalRequest._retryCount = 0;
      }
      
      if (originalRequest._retryCount < 3) {
        originalRequest._retryCount++;
        const retryDelay = Math.min(1000 * Math.pow(2, originalRequest._retryCount), 10000);
        
        console.log(`Retrying request in ${retryDelay}ms (attempt ${originalRequest._retryCount}/3)`);
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return api(originalRequest);
      } else {
        // If all retries failed, show a more specific error
        if (typeof window !== 'undefined' && window.antd?.message) {
          window.antd.message.error({
            content: 'Server is temporarily overloaded. Please try again in a few minutes.',
            duration: 5,
            key: 'rate-limit-error'
          });
        }
      }
    }
    
    // Handle authentication errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Skip token refresh for login endpoint
      if (originalRequest.url === '/auth/login') {
        return Promise.reject(error);
      }
      
      // Check if we're on an auth page to prevent redirect loops
      if (typeof window !== 'undefined') {
        const authRelatedPages = ['/admin/login', '/login', '/register'];
        const isOnAuthPage = authRelatedPages.some(path => 
          window.location.pathname.includes(path)
        );
        
        if (isOnAuthPage) {
          return Promise.reject(error);
        }
      }
      
      if (isRefreshing) {
        // If we're already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      console.warn('401 Unauthorized detected - clearing auth and redirecting to login');
      originalRequest._retry = true;
      isRefreshing = true;

      // Since we don't have refresh token functionality, just clear auth and redirect
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      
      // Process queued requests with error
      processQueue(error, null);
      isRefreshing = false;
      
      // Redirect to login
      if (typeof window !== 'undefined') {
        // Use the correct admin login path
        window.location.href = '/admin/login';
      }
      
      return Promise.reject(error);
    }
    
    // Special handling for network errors
    if (error.message === 'Network Error') {
      console.error('Network error - Backend server might be down');
    }
    
    return Promise.reject(error);
  }
);

// Helper function to queue API requests to prevent rate limiting
const queuedRequest = (requestFn, description = 'API request') => {
  return requestQueue.add(async () => {
    const startTime = performance.now();
    console.log(`Starting ${description}`);
    
    try {
      const response = await requestFn();
      const endTime = performance.now();
      console.log(`Successfully completed ${description} in ${endTime - startTime}ms`);
      return response;
    } catch (error) {
      const endTime = performance.now();
      console.error(`Error in ${description} after ${endTime - startTime}ms:`, {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        timeout: error.code === 'ECONNABORTED'
      });
      throw error;
    }
  });
};

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/users', userData),
  getProfile: () => api.get('/auth/me'),
  refreshToken: () => api.post('/auth/refresh-token'),
  logout: () => {
    // Clear tokens on logout
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
    return api.post('/auth/logout');
  }
};

// Teachers API
export const teachersAPI = {
  getAllTeachers: () => {
    return queuedRequest(
      () => api.get('/teachers'),
      'fetching all teachers'
    );
  },
  
  getTeachers: () => {
    return queuedRequest(
      () => api.get('/teachers'),
      'fetching teachers'
    );
  },
  
  getTeacher: (id) => {
    return queuedRequest(
      () => api.get(`/teachers/${id}`),
      `fetching teacher ${id}`
    );
  },

  createTeacher: (data) => {
    return queuedRequest(
      () => api.post('/teachers', data),
      'creating new teacher'
    );
  },

  updateTeacher: (id, data) => {
    return queuedRequest(
      () => api.put(`/teachers/${id}`, data),
      `updating teacher ${id}`
    );
  },

  deleteTeacher: (id) => {
    return queuedRequest(
      () => api.delete(`/teachers/${id}`),
      `deleting teacher ${id}`
    );
  },
  
  getTeacherSchedule: (id) => {
    return queuedRequest(
      () => api.get(`/teachers/${id}/schedule`).then(response => {
        if (response.data) {
          console.log('Teacher schedule response structure:', {
            hasSuccessProperty: 'success' in response.data,
            hasDataProperty: 'data' in response.data,
            success: response.data.success,
            dataType: typeof response.data.data,
            topLevelKeys: Object.keys(response.data)
          });
          
          // Check nested routine location - backend now returns routine directly
          if (response.data.data?.routine) {
            const routine = response.data.data.routine;
            console.log('Found routine in response.data.data', {
              dayCount: Object.keys(routine).length,
              firstDay: Object.keys(routine)[0],
              sampleSlots: Object.keys(routine)[0] ? Object.keys(routine[Object.keys(routine)[0]]).length : 0
            });
          } else if (response.data.routine) {
            const routine = response.data.routine;
            console.log('Found routine directly in response.data', {
              dayCount: Object.keys(routine).length,
              firstDay: Object.keys(routine)[0],
              sampleSlots: Object.keys(routine)[0] ? Object.keys(routine[Object.keys(routine)[0]]).length : 0
            });
          } else {
            console.warn('Could not find routine object in response - teacher may have no classes');
          }
        }
        
        // Backend now returns { success: true, data: { routine: {}, ... } }
        return response.data;
      }),
      `fetching schedule for teacher ${id}`
    );
  },
  
  exportTeacherSchedule: (id) => {
    return queuedRequest(
      () => api.get(`/teachers/${id}/schedule/excel`, { responseType: 'blob' }),
      `exporting schedule for teacher ${id}`
    );
  },
  
  exportTeacherScheduleToExcel: (id) => {
    return queuedRequest(
      () => api.get(`/teachers/${id}/schedule/excel`, { responseType: 'blob' }),
      `exporting schedule to Excel for teacher ${id}`
    );
  },

  // PDF Export Methods (New)
  exportTeacherScheduleToPDF: (id, semesterGroup = 'all', options = {}) => {
    const params = new URLSearchParams();
    if (semesterGroup && semesterGroup !== 'all') params.append('semesterGroup', semesterGroup);
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);
    if (options.authorityName) params.append('authorityName', options.authorityName);
    if (options.designation) params.append('designation', options.designation);
    
    const queryString = params.toString();
    const url = `/routines/teacher/${id}/export-pdf${queryString ? '?' + queryString : ''}`;
    
    return queuedRequest(
      () => api.get(url, { responseType: 'blob' }),
      `exporting schedule to PDF for teacher ${id}`
    );
  },

  exportAllTeachersSchedulesToPDF: (semesterGroup = 'all') => {
    const params = semesterGroup && semesterGroup !== 'all' ? `?semesterGroup=${semesterGroup}` : '';
    return queuedRequest(
      () => api.get(`/routines/teachers/export-pdf${params}`, { responseType: 'blob' }),
      'exporting all teachers schedules to PDF'
    );
  },

  findMeetingSlots: (requestData) => {
    return queuedRequest(
      () => api.post('/teachers/meeting-scheduler', requestData),
      'finding common meeting slots for teachers'
    );
  }
};

// Programs API
export const programsAPI = {
  getPrograms: () => queuedRequest(
    () => api.get('/programs'),
    'fetching programs'
  )
};

// Program Semesters API
export const programSemestersAPI = {
  getCurriculum: (programCode) => api.get(`/program-semesters/${programCode}`)
};

// Routines API
export const routinesAPI = {
  getRoutine: (programCode, semester, section) => 
    api.get(`/routines/${programCode}/${semester}/${section}`),
  assignClass: (programCode, semester, section, data) => 
    api.post(`/routines/${programCode}/${semester}/${section}/assign`, data),
  assignClassSpanned: (data) => 
    api.post('/routines/assign-class-spanned', data),
  clearClass: (programCode, semester, section, data) => 
    api.delete(`/routines/${programCode}/${semester}/${section}/clear`, { data }),
  clearSpanGroup: (spanId) => 
    api.delete(`/routines/clear-span-group/${spanId}`),
  clearEntireRoutine: (programCode, semester, section) => 
    api.delete(`/routines/${programCode}/${semester}/${section}/clear-all`),
  exportRoutineToExcel: (programCode, semester, section) => 
    api.get(`/routines/${programCode}/${semester}/${section}/export`, { responseType: 'blob' }),
  // PDF Export Methods (New)
  exportRoutineToPDF: (programCode, semester, section, options = {}) => {
    const params = new URLSearchParams();
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);
    
    const url = `/routines/${programCode}/${semester}/${section}/export-pdf${params.toString() ? '?' + params.toString() : ''}`;
    return api.get(url, { responseType: 'blob' });
  },
  exportAllSemesterRoutinesToPDF: (programCode, semester) => 
    api.get(`/routines/${programCode}/semester/${semester}/export-pdf-all`, { responseType: 'blob' }),
  importRoutineFromExcel: (programCode, semester, section, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/routines/${programCode}/${semester}/${section}/import/excel`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  checkTeacherAvailability: (teacherId, dayIndex, slotIndex, semester = null) => {
    const params = new URLSearchParams({
      dayIndex: dayIndex.toString(),
      slotIndex: slotIndex.toString()
    });
    if (semester !== null) {
      params.append('semester', semester.toString());
    }
    return api.get(`/routines/teachers/${teacherId}/availability?${params.toString()}`);
  },
  checkRoomAvailability: (roomId, dayIndex, slotIndex, semester = null) => {
    const params = new URLSearchParams({
      dayIndex: dayIndex.toString(),
      slotIndex: slotIndex.toString()
    });
    if (semester !== null) {
      params.append('semester', semester.toString());
    }
    return api.get(`/routines/rooms/${roomId}/availability?${params.toString()}`);
  },
  getVacantRooms: (dayIndex, slotIndex) => 
    api.get(`/routines/rooms/vacant?dayIndex=${dayIndex}&slotIndex=${slotIndex}`),
  getVacantTeachers: (dayIndex, slotIndex) => 
    api.get(`/routines/teachers/vacant?dayIndex=${dayIndex}&slotIndex=${slotIndex}`),
  
  // Elective management endpoints for 7th and 8th semester
  scheduleElectiveClass: (data) => 
    api.post('/routines/electives/schedule', data),
  scheduleElectiveClassSpanned: (data) => 
    api.post('/routines/electives/schedule-spanned', data),
  createMultipleElectiveClass: (data) =>
    api.post('/routine-slots/elective', data),
  getUnifiedSectionRoutine: (programCode, semester, section) => 
    api.get(`/routines/section/${programCode}/${semester}/${section}`),
  checkElectiveConflicts: (data) => 
    api.post('/routines/electives/conflicts', data),
  analyzeScheduleConflicts: (data) => 
    api.post('/routines/enhanced/conflicts/analyze', data)
};

// Subjects API
export const subjectsAPI = {
  getSubjects: () => queuedRequest(
    () => api.get('/subjects'),
    'fetching subjects'
  ),
  getSubjectsByProgramAndSemester: async (programCode, semester) => {
    console.log('Making subjects API call for program:', programCode, 'semester:', semester);
    
    // Use queued requests for both API calls
    const programsResponse = await queuedRequest(
      () => api.get('/programs'),
      `fetching programs for subject lookup (${programCode})`
    );
    
    const programs = programsResponse.data;
    const program = programs.find(p => p.code === programCode);
    
    if (!program) {
      throw new Error(`Program with code ${programCode} not found`);
    }
    
    // Get subjects by program ID using queued request
    const subjectsResponse = await queuedRequest(
      () => api.get(`/subjects/program/${program._id}`),
      `fetching subjects for program ${program._id}`
    );
    
    const allSubjects = subjectsResponse.data;
    
    // Filter by semester
    const filteredSubjects = allSubjects.filter(subject => subject.semester === parseInt(semester));
    
    // Transform the data to match frontend expectations
    const transformedSubjects = filteredSubjects.map(subject => ({
      ...subject,
      subjectId: subject._id,
      subjectCode_display: subject.code,
      subjectName_display: subject.name,
      courseType: subject.defaultClassType || 'Theory',
      defaultHoursTheory: subject.weeklyHours?.theory || subject.credits?.theory || 0,
      defaultHoursPractical: subject.weeklyHours?.practical || subject.credits?.practical || 0,
      defaultHoursTutorial: subject.weeklyHours?.tutorial || subject.credits?.tutorial || 0
    }));
    
    console.log(`Found ${transformedSubjects.length} subjects for ${programCode} semester ${semester}`);
    
    return { data: transformedSubjects };
  },
  getSubjectsByProgram: (programId) => queuedRequest(
    () => api.get(`/subjects/program/${programId}`),
    `fetching subjects for program ${programId}`
  ),
  getSubjectsBySemester: (semester) => api.get(`/subjects/semester/${semester}`)
};

// Rooms API
export const roomsAPI = {
  getRooms: () => api.get('/rooms'),
  getRoom: (id) => api.get(`/rooms/${id}`),
  createRoom: (data) => api.post('/rooms', data),
  updateRoom: (id, data) => api.put(`/rooms/${id}`, data),
  deleteRoom: (id) => api.delete(`/rooms/${id}`),
  exportRoomSchedule: (roomId) => api.get(`/rooms/${roomId}/export`, {
    responseType: 'blob'
  }),
  exportAllRoomSchedules: () => api.get('/rooms/export/all', {
    responseType: 'blob'
  }),
  
  // PDF Export Methods (New)
  exportRoomScheduleToPDF: (roomId, semesterGroup = 'all', options = {}) => {
    const params = new URLSearchParams();
    if (semesterGroup && semesterGroup !== 'all') params.append('semesterGroup', semesterGroup);
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);
    
    const queryString = params.toString();
    const url = `/routines/room/${roomId}/export-pdf${queryString ? '?' + queryString : ''}`;
    
    return api.get(url, {
      responseType: 'blob'
    });
  },
  exportAllRoomSchedulesToPDF: (semesterGroup = 'all') => {
    const params = semesterGroup && semesterGroup !== 'all' ? `?semesterGroup=${semesterGroup}` : '';
    return api.get(`/routines/rooms/export-pdf${params}`, {
      responseType: 'blob'
    });
  }
};

// TimeSlots API
export const timeSlotsAPI = {
  getTimeSlots: (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/time-slots${queryParams ? '?' + queryParams : ''}`);
  },
  createTimeSlot: (data) => api.post('/time-slots', data),
  createContextTimeSlot: (programCode, semester, section, data) => 
    api.post(`/time-slots/context/${programCode}/${semester}/${section}`, data),
  updateTimeSlot: (id, data) => api.put(`/time-slots/${id}`, data),
  deleteTimeSlot: (id, force = false) => api.delete(`/time-slots/${id}${force ? '?force=true' : ''}`),
  initializeTimeSlots: () => api.post('/time-slots/initialize'),
  reorderTimeSlots: () => api.post('/time-slots/reorder')
};

// Users API
export const usersAPI = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (userData) => api.put('/users/me', userData),
  getAllUsers: () => api.get('/users'),
  createUser: (userData) => api.post('/users', userData),
  getUser: (id) => api.get(`/users/${id}`),
  updateUser: (id, userData) => api.put(`/users/${id}`, userData),
  deleteUser: (id) => api.delete(`/users/${id}`),
  getUsersByRole: (role) => api.get(`/users/role/${role}`),
  changeUserPassword: (id, data) => api.put(`/users/${id}/password`, data),
  deactivateUser: (id) => api.put(`/users/${id}/deactivate`),
  activateUser: (id) => api.put(`/users/${id}/activate`)
};

// Departments API
export const departmentsAPI = {
  getDepartments: () => api.get('/departments'),
  createDepartment: (data) => api.post('/departments', data),
  getDepartment: (id) => api.get(`/departments/${id}`),
  updateDepartment: (id, data) => api.put(`/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/departments/${id}`),
  getDepartmentTeachers: (id) => api.get(`/departments/${id}/teachers`)
};

// Academic Calendars API
export const academicCalendarsAPI = {
  getCalendars: () => api.get('/academic-calendars'),
  createCalendar: (data) => api.post('/academic-calendars', data),
  getCalendar: (id) => api.get(`/academic-calendars/${id}`),
  updateCalendar: (id, data) => api.put(`/academic-calendars/${id}`, data),
  deleteCalendar: (id) => api.delete(`/academic-calendars/${id}`)
};

// Sessions API
export const sessionsAPI = {
  getAllSessions: () => api.get('/sessions'),
  getSessionDashboard: () => api.get('/sessions/dashboard'),
  createSession: (data) => api.post('/sessions/create', data),
  getSession: (id) => api.get(`/sessions/${id}`),
  updateSession: (id, data) => api.put(`/sessions/${id}`, data),
  deleteSession: (id) => api.delete(`/sessions/${id}`),
  activateSession: (id) => api.put(`/sessions/${id}/activate`),
  completeSession: (id) => api.put(`/sessions/${id}/complete`),
  archiveSession: (id) => api.put(`/sessions/${id}/archive`),
  approveSession: (id) => api.put(`/sessions/${id}/approve`),
  getSessionAnalytics: (id) => api.get(`/sessions/${id}/analytics`),
  copyRoutineFromSession: (id, sourceId) => api.post(`/sessions/${id}/routine/copy-from/${sourceId}`),
  createRoutineVersion: (id, data) => api.put(`/sessions/${id}/routine/version`, data),
  getRoutineVersions: (id) => api.get(`/sessions/${id}/routine/versions`),
  rollbackToVersion: (id, version) => api.put(`/sessions/${id}/routine/rollback/${version}`),
  applyTemplateToSession: (id, templateId, data) => api.post(`/sessions/${id}/routine/apply-template/${templateId}`, data),
  saveSessionAsTemplate: (id, data) => api.post(`/sessions/${id}/routine/save-as-template`, data),
  compareSessionAnalytics: (id, compareSessionId) => api.get(`/sessions/${id}/analytics/comparison/${compareSessionId}`),
  getCrossSessionAnalytics: () => api.get('/sessions/analytics/cross-session'),
  optimizeSessionRoutine: (id, data) => api.post(`/sessions/${id}/routine/optimize`, data),
  validateSessionRoutine: (id, data) => api.post(`/sessions/${id}/routine/validate`, data),
  getSessionConflicts: (id, data) => api.post(`/sessions/${id}/routine/conflicts`, data)
};

// Elective Groups API
export const electiveGroupsAPI = {
  getElectiveGroups: () => api.get('/elective-groups'),
  createElectiveGroup: (data) => api.post('/elective-groups', data),
  getElectiveGroup: (id) => api.get(`/elective-groups/${id}`),
  updateElectiveGroup: (id, data) => api.put(`/elective-groups/${id}`, data),
  deleteElectiveGroup: (id) => api.delete(`/elective-groups/${id}`),
  assignElectiveToSection: (data) => api.post('/elective-groups/assign', data),
  getElectivesByProgram: (programCode, semester) => {
    // First get programs to find the programId, then get elective groups
    return api.get('/programs').then(response => {
      const programs = response.data;
      const program = programs.find(p => p.code === programCode);
      if (!program) {
        throw new Error(`Program with code ${programCode} not found`);
      }
      return api.get(`/elective-groups?programId=${program._id}&semester=${semester}`);
    });
  },
  getElectiveAnalytics: (id) => api.get(`/elective-groups/${id}/analytics`)
};

// Lab Groups API
export const labGroupsAPI = {
  getLabGroups: () => api.get('/lab-groups'),
  createLabGroup: (data) => api.post('/lab-groups', data),
  getLabGroup: (id) => api.get(`/lab-groups/${id}`),
  updateLabGroup: (id, data) => api.put(`/lab-groups/${id}`, data),
  deleteLabGroup: (id) => api.delete(`/lab-groups/${id}`),
  autoCreateLabGroups: (data) => api.post('/lab-groups/auto-create', data),
  getLabGroupsByProgram: (programId, semester) => api.get(`/lab-groups/program/${programId}/semester/${semester}`),
  assignStudentsToLabGroup: (id, data) => api.post(`/lab-groups/${id}/assign-students`, data)
};

// Conflicts API
export const conflictsAPI = {
  detectConflicts: () => api.get('/conflicts/detect'),
  resolveConflict: (id, data) => api.post(`/conflicts/${id}/resolve`, data),
  getConflictReport: () => api.get('/conflicts/report'),
  getActiveConflicts: () => api.get('/conflicts/active'),
  markConflictResolved: (id) => api.put(`/conflicts/${id}/resolve`)
};

// Analytics API
export const analyticsAPI = {
  getTeacherWorkload: (id) => api.get(`/teachers/${id}/workload`),
  getRoomUtilization: () => api.get('/rooms/utilization'),
  getScheduleAnalytics: () => api.get('/analytics/schedule'),
  getSystemMetrics: () => api.get('/analytics/system'),
  getDashboardMetrics: () => api.get('/analytics/dashboard'),
  getTeacherWorkloadReport: () => api.get('/analytics/teacher-workload'),
  getRoomUtilizationReport: () => api.get('/analytics/room-utilization'),
  getConflictAnalytics: () => api.get('/analytics/conflicts')
};

// Templates API
export const templatesAPI = {
  getTemplates: () => api.get('/templates'),
  createTemplate: (data) => api.post('/templates', data),
  getTemplate: (id) => api.get(`/templates/${id}`),
  updateTemplate: (id, data) => api.put(`/templates/${id}`, data),
  deleteTemplate: (id) => api.delete(`/templates/${id}`),
  applyTemplate: (id, data) => api.post(`/templates/${id}/apply`, data),
  cloneTemplate: (id) => api.post(`/templates/${id}/clone`)
};

// Room Vacancy API
export const roomVacancyAPI = {
  getVacantRooms: (dayIndex, slotIndex) => 
    api.get(`/routines/rooms/vacant?dayIndex=${dayIndex}&slotIndex=${slotIndex}`),
  getRoomVacancyAnalytics: () => api.get('/routines/rooms/vacant/analytics'),
  getRoomSchedule: (roomId) => api.get(`/routines/rooms/${roomId}/schedule`),
  getRoomVacancyForDay: (roomId, dayIndex) => 
    api.get(`/routines/rooms/vacant/day?dayIndex=${dayIndex}`),
  getAllRoomVacancies: () => api.get('/routines/rooms/vacant/all')
};

// Academic Calendar API
export const academicCalendarAPI = {
  getAcademicCalendars: () => api.get('/academic-calendars'),
  getCurrentAcademicCalendar: () => api.get('/academic-calendars/current'),
  createAcademicCalendar: (data) => api.post('/academic-calendars', data),
  getAcademicCalendar: (id) => api.get(`/academic-calendars/${id}`),
  updateAcademicCalendar: (id, data) => api.put(`/academic-calendars/${id}`, data),
  deleteAcademicCalendar: (id) => api.delete(`/academic-calendars/${id}`),
  updateCurrentWeek: (data) => api.put('/academic-calendars/current/week', data)
};

// Routine Slots API
export const routineSlotsAPI = {
  getRoutineSlots: () => api.get('/routine-slots'),
  createRoutineSlot: (data) => api.post('/routine-slots', data),
  updateRoutineSlot: (id, data) => api.put(`/routine-slots/${id}`, data),
  deleteRoutineSlot: (id) => api.delete(`/routine-slots/${id}`),
  getWeeklySchedule: () => api.get('/routine-slots/schedule/weekly'),
  checkConflicts: (data) => api.post('/routine-slots/check-conflicts', data),
  bulkCreateSlots: (data) => api.post('/routine-slots/bulk', data)
};

export default api;