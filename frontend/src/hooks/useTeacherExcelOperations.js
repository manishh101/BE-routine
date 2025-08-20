/**
 * Custom Hook for Teacher Excel Operations
 * This is a placeholder that provides stub functions to maintain UI functionality
 * while removing Excel dependencies
 */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import TeacherExcelService from '../services/teacherExcelService';

const useTeacherExcelOperations = (teacherId) => {
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();
  const teacherExcelService = new TeacherExcelService();

  // Export Handler for Individual Teacher - now just a stub
  const exportTeacherSchedule = useCallback(async (options = {}) => {
    if (!teacherId) {
      throw new Error('Teacher ID is required');
    }

    // Notify that Excel export is disabled
    options.onError?.({ message: 'Excel export functionality has been disabled.' });
    return false;
  }, [teacherId]);

  // Export Handler for All Teachers - now just a stub
  const exportAllTeachersSchedules = useCallback(async (options = {}) => {
    // Notify that Excel export is disabled
    options.onError?.({ message: 'Excel export functionality has been disabled.' });
    return false;
  }, []);

  return {
    // State
    isExporting,
    isLoading: isExporting,
    
    // Operations
    exportTeacherSchedule,
    exportAllTeachersSchedules,
    
    // Service instance (for advanced usage)
    teacherExcelService
  };
};

export default useTeacherExcelOperations;
