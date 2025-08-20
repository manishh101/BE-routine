/**
 * Custom Hook for PDF Operations
 * Clean interface for PDF export functionality
 * Replaces useExcelOperations
 */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PDFService from '../services/pdfService';
import { routinesAPI } from '../services/api';

const usePDFOperations = (programCode, semester, section) => {
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();

  // Initialize PDF service
  const pdfService = new PDFService(routinesAPI);

  // Export Handler
  const exportToPDF = useCallback(async (options = {}) => {
    if (!programCode || !semester || !section) {
      throw new Error('Program code, semester, and section are required');
    }

    setIsExporting(true);
    
    try {
      await pdfService.exportRoutine(programCode, semester, section, {
        onStart: () => options.onStart?.(),
        onSuccess: (filename) => options.onSuccess?.(filename),
        onError: (error) => options.onError?.(error),
        startDate: options.startDate,
        endDate: options.endDate
      });
    } finally {
      setIsExporting(false);
    }
  }, [programCode, semester, section, pdfService]);

  // All Semester Export Handler
  const exportAllSemesterToPDF = useCallback(async (options = {}) => {
    if (!programCode || !semester) {
      throw new Error('Program code and semester are required');
    }

    setIsExporting(true);
    
    try {
      await pdfService.exportAllSemesterRoutines(programCode, semester, {
        onStart: () => options.onStart?.(),
        onSuccess: (filename) => options.onSuccess?.(filename),
        onError: (error) => options.onError?.(error)
      });
    } finally {
      setIsExporting(false);
    }
  }, [programCode, semester, pdfService]);

  // File Validation (keeping for consistency)
  const validateFile = useCallback((file) => {
    return pdfService.validateFile(file);
  }, [pdfService]);

  // Check if file is valid PDF
  const isValidPDFFile = useCallback((file) => {
    return pdfService.isValidPDFFile(file);
  }, [pdfService]);

  return {
    // State
    isExporting,
    isLoading: isExporting,
    
    // Operations
    exportToPDF,
    exportAllSemesterToPDF,
    
    // Validation
    validateFile,
    isValidPDFFile,
    
    // Service instance (for advanced usage)
    pdfService
  };
};

export default usePDFOperations;
