import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:7102/api';

// Queue service for frontend communication with backend queue operations
class QueueService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Check queue health status
  async checkQueueHealth() {
    try {
      const response = await axios.get(`${this.baseURL}/health/queue`);
      return response.data;
    } catch (error) {
      console.error('Queue health check failed:', error);
      return { 
        success: false, 
        message: 'Queue health check failed',
        error: error.message 
      };
    }
  }

  // Get general API health
  async checkAPIHealth() {
    try {
      const response = await axios.get(`${this.baseURL}/health`);
      return response.data;
    } catch (error) {
      console.error('API health check failed:', error);
      return { 
        success: false, 
        message: 'API health check failed',
        error: error.message 
      };
    }
  }

  // Monitor queue status (could be used for dashboard)
  async getQueueStats() {
    try {
      const health = await this.checkQueueHealth();
      const api = await this.checkAPIHealth();
      
      return {
        queue: health,
        api: api,
        overall: health.success && api.success ? 'healthy' : 'degraded'
      };
    } catch (error) {
      return {
        queue: { success: false },
        api: { success: false },
        overall: 'unhealthy',
        error: error.message
      };
    }
  }

  // Trigger manual teacher schedule regeneration (if needed)
  async triggerTeacherScheduleUpdate(teacherId) {
    try {
      // This would typically be handled automatically by the queue
      // but could be useful for manual triggers or debugging
      const response = await axios.post(`${this.baseURL}/routines/regenerate-teacher-schedule`, {
        teacherId
      });
      return response.data;
    } catch (error) {
      console.error('Manual teacher schedule update failed:', error);
      throw error;
    }
  }

  // Get queue processing status (for UI feedback)
  async getProcessingStatus() {
    try {
      const response = await axios.get(`${this.baseURL}/queue/status`);
      return response.data;
    } catch (error) {
      console.error('Failed to get processing status:', error);
      return { 
        success: false, 
        processing: false,
        error: error.message 
      };
    }
  }
}

// Create singleton instance
const queueService = new QueueService();

export default queueService;

// Named exports for individual functions
export const checkQueueHealth = () => queueService.checkQueueHealth();
export const checkAPIHealth = () => queueService.checkAPIHealth();
export const getQueueStats = () => queueService.getQueueStats();
export const triggerTeacherScheduleUpdate = (teacherId) => queueService.triggerTeacherScheduleUpdate(teacherId);
export const getProcessingStatus = () => queueService.getProcessingStatus();
