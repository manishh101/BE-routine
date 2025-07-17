import { useState, useCallback, useMemo } from 'react';
import { debounce } from 'lodash';

/**
 * Custom hook for managing filters with debounced search
 * @param {Object} initialFilters - Initial filter values
 * @param {Function} onFilterChange - Optional callback when filters change
 * @returns {Object} Filter state and handlers
 */
export const useFilters = (initialFilters = {}, onFilterChange = null) => {
  const [filters, setFilters] = useState(initialFilters);
  const [searchText, setSearchText] = useState('');

  // Debounced search handler
  const debouncedSearch = useMemo(
    () => debounce((value) => {
      setFilters(prev => {
        const newFilters = { ...prev, search: value };
        onFilterChange?.(newFilters);
        return newFilters;
      });
    }, 300),
    [onFilterChange]
  );

  // Update individual filter with dependency handling
  const updateFilter = useCallback((key, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      
      // Handle filter dependencies
      if (key === 'program' && !value) {
        // Clear semester when program is cleared
        newFilters.semester = null;
      }
      
      onFilterChange?.(newFilters);
      return newFilters;
    });
  }, [onFilterChange]);

  // Handle search input change
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearchText(value);
    debouncedSearch(value);
  }, [debouncedSearch]);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
    setSearchText('');
    onFilterChange?.(initialFilters);
  }, [initialFilters, onFilterChange]);

  return {
    filters,
    searchText,
    updateFilter,
    handleSearchChange,
    resetFilters
  };
};

/**
 * Hook for applying filters to data with enhanced subject filtering
 * @param {Array} data - Data array to filter
 * @param {Object} filters - Filter criteria
 * @param {Object} filterConfig - Configuration for filter behavior
 * @returns {Array} Filtered data
 */
export const useFilteredData = (data = [], filters = {}, filterConfig = {}) => {
  return useMemo(() => {
    if (!Array.isArray(data)) {
      console.warn('Data is not an array:', data);
      return [];
    }

    return data.filter(item => {
      try {
        // Basic validation
        if (!item) return false;

        // Search text filter
        if (filters.search && filters.search.trim()) {
          const searchFields = filterConfig.searchFields || ['name', 'code', 'description'];
          const searchValue = filters.search.toLowerCase();
          const matchesSearch = searchFields.some(field => {
            const value = item[field];
            return value && String(value).toLowerCase().includes(searchValue);
          });
          if (!matchesSearch) return false;
        }

        // Program filter - handle both populated and non-populated program data
        if (filters.program) {
          let programMatch = false;
          
          if (Array.isArray(item.programId)) {
            // Handle array of program IDs or objects
            programMatch = item.programId.some(program => {
              if (typeof program === 'string') {
                return program === filters.program;
              } else if (program && program._id) {
                return program._id === filters.program;
              }
              return false;
            });
          } else if (item.programId) {
            // Handle single program ID or object
            if (typeof item.programId === 'string') {
              programMatch = item.programId === filters.program;
            } else if (item.programId._id) {
              programMatch = item.programId._id === filters.program;
            }
          }
          
          if (!programMatch) {
            return false;
          }
        }

        // Semester filter
        if (filters.semester !== null && filters.semester !== undefined) {
          const itemSemester = Number(item.semester);
          const filterSemester = Number(filters.semester);
          if (isNaN(itemSemester) || itemSemester !== filterSemester) {
            return false;
          }
        }

        // Status filter
        if (filters.status !== null && filters.status !== undefined) {
          const isActive = item.isActive !== false; // Default to true if not specified
          if (isActive !== (filters.status === 'active')) {
            return false;
          }
        }

        return true;
      } catch (error) {
        console.error('Error filtering item:', error, item);
        return false;
      }
    });
  }, [data, filters, filterConfig]);
};
