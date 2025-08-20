/**
 * Utility functions to help prevent Table component errors
 */

/**
 * Safely render table data with null checks
 * @param {any} data - The data to render
 * @param {string} fallback - Fallback text if data is null/undefined
 * @returns {string} - Safe rendered data
 */
export const safeRender = (data, fallback = 'N/A') => {
  if (data === null || data === undefined || data === '') {
    return fallback;
  }
  if (typeof data === 'object') {
    try {
      return JSON.stringify(data);
    } catch (e) {
      return fallback;
    }
  }
  return String(data);
};

/**
 * Safely extract nested object properties
 * @param {object} obj - The object to extract from
 * @param {string} path - Dot notation path (e.g., 'user.name')
 * @param {any} fallback - Fallback value
 * @returns {any} - Extracted value or fallback
 */
export const safeGet = (obj, path, fallback = null) => {
  try {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
      if (result === null || result === undefined) {
        return fallback;
      }
      result = result[key];
    }
    return result !== undefined ? result : fallback;
  } catch (error) {
    console.warn(`Error accessing path ${path}:`, error);
    return fallback;
  }
};

/**
 * Prepare table data with safe fallbacks
 * @param {array} data - Raw table data
 * @param {string} keyField - Field to use as row key
 * @returns {array} - Processed table data
 */
export const prepareTableData = (data, keyField = '_id') => {
  if (!Array.isArray(data)) {
    console.warn('Table data is not an array:', data);
    return [];
  }
  
  return data.map((item, index) => {
    if (!item || typeof item !== 'object') {
      console.warn('Invalid table row data:', item);
      return {
        key: `invalid-${index}`,
        error: 'Invalid data'
      };
    }
    
    return {
      ...item,
      key: item[keyField] || `row-${index}`
    };
  });
};

/**
 * Create a column with error-safe rendering
 * @param {object} config - Column configuration
 * @returns {object} - Safe column configuration
 */
export const createSafeColumn = (config) => {
  const { render, ...otherConfig } = config;
  
  return {
    ...otherConfig,
    render: (value, record, index) => {
      try {
        if (render) {
          return render(value, record, index);
        }
        return safeRender(value);
      } catch (error) {
        console.error('Error rendering column:', error);
        return <span style={{ color: '#ff4d4f' }}>Error</span>;
      }
    }
  };
};
