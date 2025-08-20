/**
 * Section Utilities - Dynamic section handling
 * Replaces hardcoded AB/CD logic with configurable section management
 */

/**
 * Section configuration - can be easily extended for new sections
 */
const SECTION_CONFIG = {
  'AB': {
    code: 'AB',
    name: 'Section AB', 
    groups: ['A', 'B'],
    displayName: 'AB',
    sortOrder: 1
  },
  'CD': {
    code: 'CD',
    name: 'Section CD',
    groups: ['C', 'D'], 
    displayName: 'CD',
    sortOrder: 2
  }
  // Can easily add new sections like:
  // 'EF': { code: 'EF', name: 'Section EF', groups: ['E', 'F'], displayName: 'EF', sortOrder: 3 }
};

/**
 * Get all available sections
 * @returns {Array} Array of section configurations
 */
const getAllSections = () => {
  return Object.values(SECTION_CONFIG).sort((a, b) => a.sortOrder - b.sortOrder);
};

/**
 * Get section configuration by code
 * @param {string} sectionCode - Section code (e.g., 'AB', 'CD')
 * @returns {Object|null} Section configuration or null if not found
 */
const getSectionConfig = (sectionCode) => {
  if (!sectionCode) return null;
  const normalizedCode = sectionCode.toString().toUpperCase();
  return SECTION_CONFIG[normalizedCode] || null;
};

/**
 * Get lab groups for a specific section
 * @param {string} sectionCode - Section code (e.g., 'AB', 'CD')
 * @returns {Array} Array of group labels for the section
 */
const getLabGroupsForSection = (sectionCode) => {
  const config = getSectionConfig(sectionCode);
  return config ? config.groups : ['A', 'B']; // Default fallback
};

/**
 * Get section-appropriate lab group label with formatting
 * @param {string} labGroup - Lab group identifier
 * @param {string} sectionCode - Section code
 * @param {Object} options - Formatting options
 * @returns {string} Formatted lab group label
 */
const getSectionLabGroupLabel = (labGroup, sectionCode, options = {}) => {
  const { 
    includeParentheses = true, 
    prefix = 'Group',
    altWeekSuffix = '',
    showAllGroups = false 
  } = options;
  
  if (!labGroup) return '';
  
  const sectionGroups = getLabGroupsForSection(sectionCode);
  
  let label = '';
  
  if (labGroup === 'ALL' || showAllGroups) {
    label = `${prefix}s ${sectionGroups.join(' & ')}`;
  } else {
    label = `${prefix} ${labGroup}`;
  }
  
  if (altWeekSuffix) {
    label += ` - ${altWeekSuffix}`;
  }
  
  return includeParentheses ? `(${label})` : label;
};

/**
 * Validate if a lab group is valid for a section
 * @param {string} labGroup - Lab group to validate
 * @param {string} sectionCode - Section code
 * @returns {boolean} True if valid, false otherwise
 */
const isValidLabGroupForSection = (labGroup, sectionCode) => {
  if (!labGroup || labGroup === 'ALL') return true;
  
  const validGroups = getLabGroupsForSection(sectionCode);
  return validGroups.includes(labGroup);
};

/**
 * Get section from lab group (reverse lookup)
 * @param {string} labGroup - Lab group identifier
 * @returns {string|null} Section code or null if not found
 */
const getSectionFromLabGroup = (labGroup) => {
  if (!labGroup || labGroup === 'ALL') return null;
  
  for (const [sectionCode, config] of Object.entries(SECTION_CONFIG)) {
    if (config.groups.includes(labGroup)) {
      return sectionCode;
    }
  }
  return null;
};

/**
 * Get all possible lab groups across all sections
 * @returns {Array} Array of all lab group identifiers
 */
const getAllLabGroups = () => {
  const allGroups = new Set();
  Object.values(SECTION_CONFIG).forEach(config => {
    config.groups.forEach(group => allGroups.add(group));
  });
  return Array.from(allGroups).sort();
};

/**
 * Format section display name with optional customization
 * @param {string} sectionCode - Section code
 * @param {Object} options - Display options
 * @returns {string} Formatted section name
 */
const formatSectionDisplay = (sectionCode, options = {}) => {
  const { 
    useFullName = false, 
    includeGroups = false, 
    separator = ' - ' 
  } = options;
  
  const config = getSectionConfig(sectionCode);
  if (!config) return sectionCode;
  
  let display = useFullName ? config.name : config.displayName;
  
  if (includeGroups) {
    display += `${separator}Groups ${config.groups.join(', ')}`;
  }
  
  return display;
};

/**
 * Check if two sections can share the same time slot (for conflict detection)
 * @param {string} section1 - First section code
 * @param {string} section2 - Second section code
 * @returns {boolean} True if sections can coexist, false if they conflict
 */
const canSectionsCoexist = (section1, section2) => {
  // Same section cannot coexist in same time slot
  if (section1 === section2) return false;
  
  // Different sections can typically coexist (e.g., AB and CD can have classes at same time)
  return true;
};

module.exports = {
  // Configuration
  SECTION_CONFIG,
  
  // Core functions
  getAllSections,
  getSectionConfig,
  getLabGroupsForSection,
  getSectionLabGroupLabel,
  
  // Validation
  isValidLabGroupForSection,
  getSectionFromLabGroup,
  
  // Utilities
  getAllLabGroups,
  formatSectionDisplay,
  canSectionsCoexist
};
