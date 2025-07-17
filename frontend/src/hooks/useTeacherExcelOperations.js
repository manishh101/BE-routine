/**
 * Custom Hook for Teacher Excel Operations
 * Shows how teacher functionality could use the new clean architecture
 */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import TeacherExcelService from '../services/teacherExcelService';
import { teachersAPI } from '../services/api';

const useTeacherExcelOperations = (teacherId) => {
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();

  // Initialize Teacher Excel service
  const teacherExcelService = new TeacherExcelService(teachersAPI);

  // Export Handler for Individual Teacher
  const exportTeacherSchedule = useCallback(async (options = {}) => {
    if (!teacherId) {
      throw new Error('Teacher ID is required');
    }

    setIsExporting(true);
    
    try {
      await teacherExcelService.exportTeacherSchedule(teacherId, {
        teacherName: options.teacherName,
        onStart: () => options.onStart?.(),
        onSuccess: (filename) => options.onSuccess?.(filename),
        onError: (error) => options.onError?.(error)
      });
    } finally {
      setIsExporting(false);
    }
  }, [teacherId, teacherExcelService]);

  // Export Handler for All Teachers
  const exportAllTeachersSchedules = useCallback(async (options = {}) => {
    setIsExporting(true);
    
    try {
      await teacherExcelService.exportAllTeachersSchedules({
        onStart: () => options.onStart?.(),
        onSuccess: (filename) => options.onSuccess?.(filename),
        onError: (error) => options.onError?.(error),
        onProgress: (progress) => options.onProgress?.(progress)
      });
    } finally {
      setIsExporting(false);
    }
  }, [teacherExcelService]);

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
