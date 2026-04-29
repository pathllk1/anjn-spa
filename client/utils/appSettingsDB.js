/**
 * App Settings Database Manager
 * Manages application-wide settings using IndexedDB
 * Persists: font size, font family, theme, colors, spacing, etc.
 */

const DB_NAME = 'app_settings_db';
const DB_VERSION = 1;
const STORE_NAME = 'settings';

// CSS variable for font size (applied to body, not root)
const FONT_SIZE_CSS_VAR = '--app-font-size';

/**
 * Initialize IndexedDB
 * @returns {Promise<IDBDatabase>}
 */
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Get all settings from IndexedDB
 * @returns {Promise<Object>}
 */
export async function getAllSettings() {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const settings = {};
        request.result.forEach(item => {
          settings[item.key] = item.value;
        });
        resolve(settings);
      };
    });
  } catch (error) {
    console.error('Error getting all settings:', error);
    return {};
  }
}

/**
 * Get single setting from IndexedDB
 * @param {string} key - Setting key
 * @param {*} defaultValue - Default value if not found
 * @returns {Promise<*>}
 */
export async function getSetting(key, defaultValue = null) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result ? request.result.value : defaultValue);
      };
    });
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return defaultValue;
  }
}

/**
 * Save single setting to IndexedDB
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 * @returns {Promise<boolean>}
 */
export async function saveSetting(key, value) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ key, value, timestamp: Date.now() });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(true);
    });
  } catch (error) {
    console.error(`Error saving setting ${key}:`, error);
    return false;
  }
}

/**
 * Save multiple settings to IndexedDB
 * @param {Object} settings - Settings object
 * @returns {Promise<boolean>}
 */
export async function saveSettings(settings) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      Object.entries(settings).forEach(([key, value]) => {
        store.put({ key, value, timestamp: Date.now() });
      });

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve(true);
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

/**
 * Delete setting from IndexedDB
 * @param {string} key - Setting key
 * @returns {Promise<boolean>}
 */
export async function deleteSetting(key) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(true);
    });
  } catch (error) {
    console.error(`Error deleting setting ${key}:`, error);
    return false;
  }
}

/**
 * Clear all settings from IndexedDB
 * @returns {Promise<boolean>}
 */
export async function clearAllSettings() {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(true);
    });
  } catch (error) {
    console.error('Error clearing settings:', error);
    return false;
  }
}

/**
 * Export settings as JSON
 * @returns {Promise<string>}
 */
export async function exportSettings() {
  try {
    const settings = await getAllSettings();
    return JSON.stringify(settings, null, 2);
  } catch (error) {
    console.error('Error exporting settings:', error);
    return null;
  }
}

/**
 * Import settings from JSON
 * @param {string} jsonString - JSON string of settings
 * @returns {Promise<boolean>}
 */
export async function importSettings(jsonString) {
  try {
    const settings = JSON.parse(jsonString);
    if (typeof settings !== 'object' || settings === null) {
      throw new Error('Invalid settings format');
    }
    return await saveSettings(settings);
  } catch (error) {
    console.error('Error importing settings:', error);
    return false;
  }
}

/**
 * Check if IndexedDB is available
 * @returns {boolean}
 */
export function isIndexedDBAvailable() {
  try {
    return !!window.indexedDB;
  } catch (e) {
    return false;
  }
}
