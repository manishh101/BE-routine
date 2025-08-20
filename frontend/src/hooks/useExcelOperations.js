/**
 * Custom Hook for Excel Operations
 * This is a placeholder that provides stub functions to maintain UI functionality
 * while removing Excel dependencies
 */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useRoutineSync from './useRoutineSync';
import ExcelService from '../services/excelService';

const useExcelOperations = (programCode, semester, section) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();
  const { syncRoutineData } = useRoutineSync();
  const excelService = new ExcelService();

  // Export Handler - now just a stub
  const exportToExcel = useCallback(async (options = {}) => {
    if (!programCode || !semester || !section) {
      throw new Error('Program code, semester, and section are required');
    }

    // Notify that Excel export is disabled
    options.onError?.({ message: 'Excel export functionality has been disabled.' });
    return false;
  }, [programCode, semester, section]);

  // File Validation - now just returns false
  const validateFile = useCallback((file) => {
    return false;
  }, []);

  // Check if file is valid Excel - now just returns false
  const isValidExcelFile = useCallback((file) => {
    return false;
  }, []);

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
