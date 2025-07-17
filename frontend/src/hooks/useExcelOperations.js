/**
 * Custom Hook for Excel Operations
 * Clean interface for import/export functionality
 */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ExcelService from '../services/excelService';
import { routinesAPI } from '../services/api';
import useRoutineSync from './useRoutineSync';

const useExcelOperations = (programCode, semester, section) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();
  const { syncRoutineData } = useRoutineSync();

  // Initialize Excel service
  const excelService = new ExcelService(routinesAPI);

  // Export Handler
  const exportToExcel = useCallback(async (options = {}) => {
    if (!programCode || !semester || !section) {
      throw new Error('Program code, semester, and section are required');
    }

    setIsExporting(true);
    
    try {
      await excelService.export(programCode, semester, section, {
        onStart: () => options.onStart?.(),
        onSuccess: (filename) => options.onSuccess?.(filename),
        onError: (error) => options.onError?.(error)
      });
    } finally {
      setIsExporting(false);
    }
  }, [programCode, semester, section, excelService]);

  // File Validation (keeping for export validation)
  const validateFile = useCallback((file) => {
    return excelService.validateFile(file);
  }, [excelService]);

  // Check if file is valid Excel (keeping for export validation)
  const isValidExcelFile = useCallback((file) => {
    return excelService.isValidExcelFile(file);
  }, [excelService]);

  return {
    // State
    isExporting,
    isImporting: false, // Always false since import is disabled
    isLoading: isExporting,
    
    // Operations
    exportToExcel,
    importFromExcel: () => Promise.reject(new Error('Import functionality has been disabled')),
    
    // Validation
    validateFile,
    isValidExcelFile,
    
    // Service instance (for advanced usage)
    excelService
  };
};

export default useExcelOperations;
