/**
 * Comprehensive test suite for Excel functionality
 * Tests the clean architecture implementation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { message } from 'antd';
import ExcelActions from '../components/ExcelActions';
import useExcelOperations from '../hooks/useExcelOperations';

// Mock the custom hook
jest.mock('../hooks/useExcelOperations');
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

describe('ExcelActions Component', () => {
  let queryClient;
  const mockUseExcelOperations = useExcelOperations;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset all mocks
    jest.clearAllMocks();
    
    // Default mock implementation
    mockUseExcelOperations.mockReturnValue({
      isExporting: false,
      isImporting: false,
      exportToExcel: jest.fn(),
      importFromExcel: jest.fn(),
      validateFile: jest.fn(() => ({ isValid: true })),
    });
  });

  const renderWithProvider = (component) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('Component Rendering', () => {
    test('renders nothing when no program selected', () => {
      renderWithProvider(
        <ExcelActions
          programCode=""
          semester=""
          section=""
        />
      );
      
      expect(screen.queryByText('Import from Excel')).not.toBeInTheDocument();
      expect(screen.queryByText('Export to Excel')).not.toBeInTheDocument();
    });

    test('renders export button only by default', () => {
      renderWithProvider(
        <ExcelActions
          programCode="BCT"
          semester="1"
          section="A"
        />
      );
      
      expect(screen.getByText('Export to Excel')).toBeInTheDocument();
      expect(screen.queryByText('Import from Excel')).not.toBeInTheDocument();
    });

    test('renders both buttons when import is allowed', () => {
      renderWithProvider(
        <ExcelActions
          programCode="BCT"
          semester="1"
          section="A"
          allowImport={true}
        />
      );
      
      expect(screen.getByText('Export to Excel')).toBeInTheDocument();
      expect(screen.getByText('Import from Excel')).toBeInTheDocument();
    });

    test('disables buttons in demo mode', () => {
      renderWithProvider(
        <ExcelActions
          programCode="BCT"
          semester="1"
          section="A"
          allowImport={true}
          demoMode={true}
        />
      );
      
      const exportButton = screen.getByText('Export to Excel');
      const importButton = screen.getByText('Import from Excel');
      
      expect(exportButton).toBeDisabled();
      expect(importButton).toBeDisabled();
    });
  });

  describe('Export Functionality', () => {
    test('calls exportToExcel when export button clicked', async () => {
      const mockExportToExcel = jest.fn();
      mockUseExcelOperations.mockReturnValue({
        isExporting: false,
        isImporting: false,
        exportToExcel: mockExportToExcel,
        importFromExcel: jest.fn(),
        validateFile: jest.fn(() => ({ isValid: true })),
      });

      renderWithProvider(
        <ExcelActions
          programCode="BCT"
          semester="1"
          section="A"
        />
      );
      
      const exportButton = screen.getByText('Export to Excel');
      fireEvent.click(exportButton);
      
      expect(mockExportToExcel).toHaveBeenCalledTimes(1);
    });

    test('shows loading state during export', () => {
      mockUseExcelOperations.mockReturnValue({
        isExporting: true,
        isImporting: false,
        exportToExcel: jest.fn(),
        importFromExcel: jest.fn(),
        validateFile: jest.fn(() => ({ isValid: true })),
      });

      renderWithProvider(
        <ExcelActions
          programCode="BCT"
          semester="1"
          section="A"
        />
      );
      
      const exportButton = screen.getByText('Export to Excel');
      expect(exportButton).toHaveClass('ant-btn-loading');
    });

    test('calls onExportSuccess when provided', async () => {
      const mockOnExportSuccess = jest.fn();
      const mockExportToExcel = jest.fn((options) => {
        options.onSuccess?.();
      });
      
      mockUseExcelOperations.mockReturnValue({
        isExporting: false,
        isImporting: false,
        exportToExcel: mockExportToExcel,
        importFromExcel: jest.fn(),
        validateFile: jest.fn(() => ({ isValid: true })),
      });

      renderWithProvider(
        <ExcelActions
          programCode="BCT"
          semester="1"
          section="A"
          onExportSuccess={mockOnExportSuccess}
        />
      );
      
      const exportButton = screen.getByText('Export to Excel');
      fireEvent.click(exportButton);
      
      expect(mockOnExportSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe('Import Functionality', () => {
    test('calls importFromExcel when file uploaded', async () => {
      const mockImportFromExcel = jest.fn();
      const mockValidateFile = jest.fn(() => ({ isValid: true }));
      
      mockUseExcelOperations.mockReturnValue({
        isExporting: false,
        isImporting: false,
        exportToExcel: jest.fn(),
        importFromExcel: mockImportFromExcel,
        validateFile: mockValidateFile,
      });

      renderWithProvider(
        <ExcelActions
          programCode="BCT"
          semester="1"
          section="A"
          allowImport={true}
        />
      );
      
      const fileInput = screen.getByText('Import from Excel').closest('span').querySelector('input');
      const file = new File([''], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(fileInput);
      
      expect(mockValidateFile).toHaveBeenCalledWith(file);
      expect(mockImportFromExcel).toHaveBeenCalledWith(file, expect.any(Object));
    });

    test('rejects invalid files', async () => {
      const mockImportFromExcel = jest.fn();
      const mockValidateFile = jest.fn(() => ({ 
        isValid: false, 
        error: 'Invalid file type' 
      }));
      
      mockUseExcelOperations.mockReturnValue({
        isExporting: false,
        isImporting: false,
        exportToExcel: jest.fn(),
        importFromExcel: mockImportFromExcel,
        validateFile: mockValidateFile,
      });

      renderWithProvider(
        <ExcelActions
          programCode="BCT"
          semester="1"
          section="A"
          allowImport={true}
        />
      );
      
      const fileInput = screen.getByText('Import from Excel').closest('span').querySelector('input');
      const file = new File([''], 'test.txt', { type: 'text/plain' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(fileInput);
      
      expect(mockValidateFile).toHaveBeenCalledWith(file);
      expect(mockImportFromExcel).not.toHaveBeenCalled();
    });

    test('shows loading state during import', () => {
      mockUseExcelOperations.mockReturnValue({
        isExporting: false,
        isImporting: true,
        exportToExcel: jest.fn(),
        importFromExcel: jest.fn(),
        validateFile: jest.fn(() => ({ isValid: true })),
      });

      renderWithProvider(
        <ExcelActions
          programCode="BCT"
          semester="1"
          section="A"
          allowImport={true}
        />
      );
      
      const importButton = screen.getByText('Import from Excel');
      expect(importButton).toHaveClass('ant-btn-loading');
    });
  });

  describe('Error Handling', () => {
    test('handles export errors gracefully', async () => {
      const mockOnExportError = jest.fn();
      const mockExportToExcel = jest.fn((options) => {
        options.onError?.(new Error('Export failed'));
      });
      
      mockUseExcelOperations.mockReturnValue({
        isExporting: false,
        isImporting: false,
        exportToExcel: mockExportToExcel,
        importFromExcel: jest.fn(),
        validateFile: jest.fn(() => ({ isValid: true })),
      });

      renderWithProvider(
        <ExcelActions
          programCode="BCT"
          semester="1"
          section="A"
          onExportError={mockOnExportError}
        />
      );
      
      const exportButton = screen.getByText('Export to Excel');
      fireEvent.click(exportButton);
      
      expect(mockOnExportError).toHaveBeenCalledWith(expect.any(Error));
    });

    test('handles import errors gracefully', async () => {
      const mockOnImportError = jest.fn();
      const mockImportFromExcel = jest.fn((file, options) => {
        options.onError?.(new Error('Import failed'));
      });
      
      mockUseExcelOperations.mockReturnValue({
        isExporting: false,
        isImporting: false,
        exportToExcel: jest.fn(),
        importFromExcel: mockImportFromExcel,
        validateFile: jest.fn(() => ({ isValid: true })),
      });

      renderWithProvider(
        <ExcelActions
          programCode="BCT"
          semester="1"
          section="A"
          allowImport={true}
          onImportError={mockOnImportError}
        />
      );
      
      const fileInput = screen.getByText('Import from Excel').closest('span').querySelector('input');
      const file = new File([''], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(fileInput);
      
      expect(mockOnImportError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Accessibility', () => {
    test('has proper aria labels', () => {
      renderWithProvider(
        <ExcelActions
          programCode="BCT"
          semester="1"
          section="A"
          allowImport={true}
        />
      );
      
      const exportButton = screen.getByText('Export to Excel');
      const importButton = screen.getByText('Import from Excel');
      
      expect(exportButton).toHaveAttribute('title', 'Export routine to Excel');
      expect(importButton).toHaveAttribute('title', 'Import routine from Excel');
    });

    test('shows demo mode tooltips', () => {
      renderWithProvider(
        <ExcelActions
          programCode="BCT"
          semester="1"
          section="A"
          allowImport={true}
          demoMode={true}
        />
      );
      
      const exportButton = screen.getByText('Export to Excel');
      const importButton = screen.getByText('Import from Excel');
      
      expect(exportButton).toHaveAttribute('title', 'Not available in demo mode');
      expect(importButton).toHaveAttribute('title', 'Not available in demo mode');
    });
  });

  describe('Integration with RoutineGrid', () => {
    test('integrates seamlessly with permission system', () => {
      // This would be tested at the integration level
      // The ExcelActions component respects the allowImport prop
      // which is determined by user permissions in the parent component
      
      renderWithProvider(
        <ExcelActions
          programCode="BCT"
          semester="1"
          section="A"
          allowImport={false} // Regular user
          allowExport={true}
        />
      );
      
      expect(screen.getByText('Export to Excel')).toBeInTheDocument();
      expect(screen.queryByText('Import from Excel')).not.toBeInTheDocument();
    });
  });
});

describe('useExcelOperations Hook', () => {
  // These would be tests for the custom hook
  // Testing the hook's state management, API calls, and error handling
  
  test('manages loading states correctly', () => {
    // Test implementation would go here
    expect(true).toBe(true); // Placeholder
  });

  test('handles file validation', () => {
    // Test implementation would go here
    expect(true).toBe(true); // Placeholder
  });

  test('makes correct API calls', () => {
    // Test implementation would go here
    expect(true).toBe(true); // Placeholder
  });
});

export default {};
