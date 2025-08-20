import axios from 'axios';

const API_URL = '/api';

// Create axios instance with same configuration as main API
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Add request interceptor for authentication
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

const SUBJECTS_URL = '/subjects';

export const subjectsAPI = {
  // Get all subjects
  getAllSubjects: async () => {
    const response = await api.get(`${SUBJECTS_URL}`);
    return response.data;
  },

  // Get subjects by program ID
  getSubjectsByProgram: async (programId) => {
    const response = await api.get(`${SUBJECTS_URL}/program/${programId}`);
    return response.data;
  },

  // Get subjects by semester
  getSubjectsBySemester: async (semester) => {
    const response = await api.get(`${SUBJECTS_URL}/semester/${semester}`);
    return response.data;
  },

  // Get subjects by program and semester (combined filter)
  getSubjectsByProgramAndSemester: async (programId, semester) => {
    const response = await api.get(`${SUBJECTS_URL}/program/${programId}/semester/${semester}`);
    return response.data;
  },

  // Get shared subjects (subjects that belong to multiple programs)
  getSharedSubjects: async () => {
    const response = await api.get(`${SUBJECTS_URL}/shared`);
    return response.data;
  },

  // Get subject by ID
  getSubjectById: async (id) => {
    const response = await api.get(`${SUBJECTS_URL}/${id}`);
    return response.data;
  },

  // Create a new subject
  createSubject: async (data) => {
    const response = await api.post(`${SUBJECTS_URL}`, data);
    return response.data;
  },

  // Create multiple subjects at once
  createSubjectsBulk: async (subjects) => {
    const response = await api.post(`${SUBJECTS_URL}/bulk`, subjects);
    return response.data;
  },

  // Update an existing subject
  updateSubject: async (id, data) => {
    const response = await api.put(`${SUBJECTS_URL}/${id}`, data);
    return response.data;
  },

  // Delete a subject
  deleteSubject: async (id) => {
    const response = await api.delete(`${SUBJECTS_URL}/${id}`);
    return response.data;
  },

  // Get subject by ID
  getSubjectById: async (id) => {
    const response = await axios.get(`${API_URL}/${id}`);
    return response.data;
  }
};
