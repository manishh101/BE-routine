import { create } from 'zustand';
import api from '../services/api';

// API base URL
const API_URL = '/api';

const useAuthStore = create((set, get) => {
  // Safe localStorage access
  const getFromLocalStorage = (key) => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      return null;
    }
  };

  const setToLocalStorage = (key, value) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('Error setting localStorage:', error);
    }
  };

  const removeFromLocalStorage = (key) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  };

  // Initialize state with safe defaults
  const initialToken = getFromLocalStorage('token');
  const initialUser = (() => {
    const userStr = getFromLocalStorage('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.error('Error parsing user from localStorage:', error);
      // Clear corrupted user data
      removeFromLocalStorage('user');
      return null;
    }
  })();

  return {
    token: initialToken,
    user: initialUser,
    isLoading: false,
    error: null,
    isInitialized: true, // Add flag to track initialization

    login: async (email, password) => {
      set({ isLoading: true, error: null });
      try {
        console.log('Attempting login with:', { email });
        const res = await api.post(`/auth/login`, { email, password });
        
        if (!res.data.token) {
          console.error('Login failed: No token received');
          set({ isLoading: false, error: 'Authentication failed: No token received' });
          return false;
        }
        
        console.log('Login successful, token received');
        setToLocalStorage('token', res.data.token);
        
        try {
          // Get user details using the API service
          const userRes = await api.get(`/auth/me`);
          console.log('User profile fetched successfully:', userRes.data);
          setToLocalStorage('user', JSON.stringify(userRes.data));
          set({ token: res.data.token, user: userRes.data, isLoading: false });
          return true;
        } catch (profileError) {
          console.error('Error fetching user profile:', profileError);
          // Even if profile fetch fails, we've successfully logged in
          set({ token: res.data.token, isLoading: false });
          return true;
        }
      } catch (error) {
        console.error('Login error:', error);
        
        let errorMessage;
        if (error.response?.data?.errors && error.response.data.errors.length > 0) {
          errorMessage = error.response.data.errors[0].msg;
        } else if (error.response?.data?.msg) {
          errorMessage = error.response.data.msg;
        } else if (error.message === 'Network Error') {
          errorMessage = 'Cannot connect to the server. Please check your connection.';
        } else {
          errorMessage = 'Login failed. Please check your credentials.';
        }
        
        set({ isLoading: false, error: errorMessage });
        return false;
      }
    },

    // Admin-only function to register new users
    register: async (userData) => {
      set({ isLoading: true, error: null });
      try {
        const res = await api.post(`/users`, userData);
        set({ isLoading: false });
        return true;
      } catch (error) {
        console.error('Register error:', error.response?.data || error.message);
        set({ 
          isLoading: false, 
          error: error.response?.data?.msg || (error.response?.data?.errors && error.response?.data?.errors[0]?.msg) || 'Failed to register user' 
        });
        return false;
      }
    },

    logout: () => {
      removeFromLocalStorage('token');
      removeFromLocalStorage('user');
      set({ token: null, user: null, error: null });
    },

    clearError: () => set({ error: null }),
    setUser: (user) => set({ user }),
  };
});

export default useAuthStore;
