/**
 * Settings Registry
 * Defines all available app settings organized by category
 */

export const SETTINGS_CATEGORIES = {
  TYPOGRAPHY: 'typography',
  THEME: 'theme',
  LAYOUT: 'layout',
  BEHAVIOR: 'behavior'
};

export const DEFAULT_SETTINGS = {
  // Typography
  'font_size': 14,           // 12-18px
  'font_family': 'system',   // system, serif, mono
  'line_height': 1.5,        // 1.4-1.8
  
  // Theme
  'theme_mode': 'light',     // light, dark, auto
  'accent_color': 'indigo',  // indigo, blue, purple, emerald
  
  // Layout
  'sidebar_width': 'normal', // compact, normal, wide
  'table_density': 'normal', // compact, normal, spacious
  'card_radius': 'medium',   // small, medium, large
  
  // Behavior
  'auto_save_enabled': true,
  'notifications_enabled': true,
  'animations_enabled': true,
  'keyboard_shortcuts_enabled': true
};

export const SETTINGS_DEFINITIONS = [
  // Typography Category
  {
    key: 'font_size',
    category: SETTINGS_CATEGORIES.TYPOGRAPHY,
    label: 'Font Size',
    type: 'slider',
    min: 12,
    max: 18,
    step: 1,
    unit: 'px',
    description: 'Base font size for the entire application'
  },
  {
    key: 'font_family',
    category: SETTINGS_CATEGORIES.TYPOGRAPHY,
    label: 'Font Family',
    type: 'select',
    options: [
      { value: 'system', label: 'System Font' },
      { value: 'serif', label: 'Serif' },
      { value: 'mono', label: 'Monospace' }
    ],
    description: 'Choose your preferred font style'
  },
  {
    key: 'line_height',
    category: SETTINGS_CATEGORIES.TYPOGRAPHY,
    label: 'Line Height',
    type: 'slider',
    min: 1.4,
    max: 1.8,
    step: 0.1,
    description: 'Spacing between lines of text'
  },

  // Theme Category
  {
    key: 'theme_mode',
    category: SETTINGS_CATEGORIES.THEME,
    label: 'Theme Mode',
    type: 'select',
    options: [
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
      { value: 'auto', label: 'Auto (System)' }
    ],
    description: 'Choose light or dark theme'
  },
  {
    key: 'accent_color',
    category: SETTINGS_CATEGORIES.THEME,
    label: 'Accent Color',
    type: 'select',
    options: [
      { value: 'indigo', label: 'Indigo' },
      { value: 'blue', label: 'Blue' },
      { value: 'purple', label: 'Purple' },
      { value: 'emerald', label: 'Emerald' }
    ],
    description: 'Primary accent color for UI elements'
  },

  // Layout Category
  {
    key: 'sidebar_width',
    category: SETTINGS_CATEGORIES.LAYOUT,
    label: 'Sidebar Width',
    type: 'select',
    options: [
      { value: 'compact', label: 'Compact' },
      { value: 'normal', label: 'Normal' },
      { value: 'wide', label: 'Wide' }
    ],
    description: 'Adjust sidebar width for better visibility'
  },
  {
    key: 'table_density',
    category: SETTINGS_CATEGORIES.LAYOUT,
    label: 'Table Density',
    type: 'select',
    options: [
      { value: 'compact', label: 'Compact' },
      { value: 'normal', label: 'Normal' },
      { value: 'spacious', label: 'Spacious' }
    ],
    description: 'Control spacing in data tables'
  },
  {
    key: 'card_radius',
    category: SETTINGS_CATEGORIES.LAYOUT,
    label: 'Card Border Radius',
    type: 'select',
    options: [
      { value: 'small', label: 'Small' },
      { value: 'medium', label: 'Medium' },
      { value: 'large', label: 'Large' }
    ],
    description: 'Roundness of card corners'
  },

  // Behavior Category
  {
    key: 'auto_save_enabled',
    category: SETTINGS_CATEGORIES.BEHAVIOR,
    label: 'Auto-Save',
    type: 'toggle',
    description: 'Automatically save work in progress'
  },
  {
    key: 'notifications_enabled',
    category: SETTINGS_CATEGORIES.BEHAVIOR,
    label: 'Notifications',
    type: 'toggle',
    description: 'Show toast notifications for actions'
  },
  {
    key: 'animations_enabled',
    category: SETTINGS_CATEGORIES.BEHAVIOR,
    label: 'Animations',
    type: 'toggle',
    description: 'Enable UI animations and transitions'
  },
  {
    key: 'keyboard_shortcuts_enabled',
    category: SETTINGS_CATEGORIES.BEHAVIOR,
    label: 'Keyboard Shortcuts',
    type: 'toggle',
    description: 'Enable keyboard shortcuts (Ctrl+.)'
  }
];

/**
 * Get settings by category
 * @param {string} category - Category name
 * @returns {Array}
 */
export function getSettingsByCategory(category) {
  return SETTINGS_DEFINITIONS.filter(s => s.category === category);
}

/**
 * Get setting definition by key
 * @param {string} key - Setting key
 * @returns {Object|null}
 */
export function getSettingDefinition(key) {
  return SETTINGS_DEFINITIONS.find(s => s.key === key) || null;
}

/**
 * Get all categories
 * @returns {Array}
 */
export function getAllCategories() {
  return Object.values(SETTINGS_CATEGORIES);
}

/**
 * Get category label
 * @param {string} category - Category name
 * @returns {string}
 */
export function getCategoryLabel(category) {
  const labels = {
    [SETTINGS_CATEGORIES.TYPOGRAPHY]: '🔤 Typography',
    [SETTINGS_CATEGORIES.THEME]: '🎨 Theme',
    [SETTINGS_CATEGORIES.LAYOUT]: '📐 Layout',
    [SETTINGS_CATEGORIES.BEHAVIOR]: '⚙️ Behavior'
  };
  return labels[category] || category;
}
