/**
 * Wage Session Storage Manager
 * Handles persistence of wage creation form data across page navigation
 * Uses browser sessionStorage for temporary, tab-scoped persistence
 */

const SESSION_KEY = 'wages_create_session';
const SESSION_VERSION = 1;
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Session object structure
 * @typedef {Object} WageSession
 * @property {string} selectedMonth - Selected month (YYYY-MM)
 * @property {Array} employees - Full employee list
 * @property {Object} wageData - Wage records by employee ID
 * @property {Array} selectedEmployeeIds - Selected employee IDs
 * @property {Object} commonPaymentData - Bulk payment fields
 * @property {Object} createFilters - Filter state
 * @property {Object} createSort - Sort state
 * @property {number} timestamp - Session creation timestamp
 * @property {number} version - Session version for compatibility
 */

/**
 * Check if sessionStorage is available
 * @returns {boolean}
 */
function isSessionStorageAvailable() {
  try {
    const test = '__test__';
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch (e) {
    console.warn('sessionStorage not available:', e.message);
    return false;
  }
}

/**
 * Validate session data structure
 * @param {Object} session - Session object to validate
 * @returns {boolean}
 */
function validateSession(session) {
  if (!session || typeof session !== 'object') {
    return false;
  }

  // Check required fields
  if (typeof session.selectedMonth !== 'string') {
    return false;
  }

  if (!Array.isArray(session.employees) || session.employees.length === 0) {
    return false;
  }

  if (typeof session.wageData !== 'object' || session.wageData === null) {
    return false;
  }

  if (!Array.isArray(session.selectedEmployeeIds)) {
    return false;
  }

  if (typeof session.commonPaymentData !== 'object' || session.commonPaymentData === null) {
    return false;
  }

  if (typeof session.createFilters !== 'object' || session.createFilters === null) {
    return false;
  }

  if (typeof session.createSort !== 'object' || session.createSort === null) {
    return false;
  }

  if (typeof session.timestamp !== 'number' || session.timestamp <= 0) {
    return false;
  }

  if (session.version !== SESSION_VERSION) {
    return false;
  }

  return true;
}

/**
 * Check if session is stale (older than 24 hours)
 * @param {number} timestamp - Session timestamp
 * @returns {boolean}
 */
function isSessionStale(timestamp) {
  const now = Date.now();
  const age = now - timestamp;
  return age > SESSION_MAX_AGE_MS;
}

/**
 * Save session to sessionStorage
 * @param {Object} state - State object containing all wage form data
 * @returns {boolean} - True if saved successfully
 */
export function saveWageSession(state) {
  if (!isSessionStorageAvailable()) {
    console.warn('sessionStorage not available, skipping session save');
    return false;
  }

  try {
    const session = {
      selectedMonth: state.selectedMonth || '',
      employees: state.employees || [],
      wageData: state.wageData || {},
      selectedEmployeeIds: Array.from(state.selectedEmployeeIds || []),
      commonPaymentData: state.commonPaymentData || {},
      createFilters: state.createFilters || {},
      createSort: state.createSort || {},
      timestamp: Date.now(),
      version: SESSION_VERSION
    };

    // Validate before saving
    if (!validateSession(session)) {
      console.warn('Session validation failed, not saving');
      return false;
    }

    // Check storage size before saving
    const sessionStr = JSON.stringify(session);
    if (sessionStr.length > 1024 * 1024) { // 1MB limit
      console.warn('Session data too large, not saving');
      return false;
    }

    sessionStorage.setItem(SESSION_KEY, sessionStr);
    return true;
  } catch (error) {
    console.error('Error saving wage session:', error);
    return false;
  }
}

/**
 * Load session from sessionStorage
 * @returns {Object|null} - Session object or null if not available/invalid
 */
export function loadWageSession() {
  if (!isSessionStorageAvailable()) {
    console.warn('sessionStorage not available, cannot load session');
    return null;
  }

  try {
    const sessionStr = sessionStorage.getItem(SESSION_KEY);
    
    if (!sessionStr) {
      return null;
    }

    const session = JSON.parse(sessionStr);

    // Validate session structure
    if (!validateSession(session)) {
      console.warn('Session validation failed, discarding');
      clearWageSession();
      return null;
    }

    // Check if session is stale
    if (isSessionStale(session.timestamp)) {
      console.warn('Session is stale (> 24 hours), discarding');
      clearWageSession();
      return null;
    }

    return session;
  } catch (error) {
    console.error('Error loading wage session:', error);
    clearWageSession();
    return null;
  }
}

/**
 * Clear session from sessionStorage
 * @returns {boolean} - True if cleared successfully
 */
export function clearWageSession() {
  if (!isSessionStorageAvailable()) {
    return false;
  }

  try {
    sessionStorage.removeItem(SESSION_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing wage session:', error);
    return false;
  }
}

/**
 * Check if a valid session exists
 * @returns {boolean}
 */
export function hasValidWageSession() {
  const session = loadWageSession();
  return session !== null;
}

/**
 * Get session metadata for UI display
 * @returns {Object|null} - Metadata object or null
 */
export function getWageSessionMetadata() {
  if (!isSessionStorageAvailable()) {
    return null;
  }

  try {
    const sessionStr = sessionStorage.getItem(SESSION_KEY);
    if (!sessionStr) {
      return null;
    }

    const session = JSON.parse(sessionStr);

    // Don't validate fully, just check basic structure for metadata
    if (!session.selectedMonth || !Array.isArray(session.selectedEmployeeIds)) {
      return null;
    }

    const ageMs = Date.now() - session.timestamp;
    const ageMinutes = Math.floor(ageMs / 60000);
    const ageHours = Math.floor(ageMs / 3600000);

    let ageDisplay = '';
    if (ageMinutes < 1) {
      ageDisplay = 'just now';
    } else if (ageMinutes < 60) {
      ageDisplay = `${ageMinutes}m ago`;
    } else if (ageHours < 24) {
      ageDisplay = `${ageHours}h ago`;
    } else {
      ageDisplay = 'stale';
    }

    return {
      month: session.selectedMonth,
      employeeCount: session.employees.length,
      selectedCount: session.selectedEmployeeIds.length,
      editCount: Object.keys(session.wageData).length,
      ageDisplay,
      timestamp: session.timestamp,
      isStale: isSessionStale(session.timestamp)
    };
  } catch (error) {
    console.error('Error getting session metadata:', error);
    return null;
  }
}

/**
 * Restore state from session
 * @param {Object} session - Session object from loadWageSession()
 * @returns {Object} - State object to restore
 */
export function restoreStateFromSession(session) {
  if (!session) {
    return null;
  }

  try {
    return {
      selectedMonth: session.selectedMonth || '',
      employees: session.employees || [],
      wageData: session.wageData || {},
      selectedEmployeeIds: new Set(session.selectedEmployeeIds || []),
      commonPaymentData: session.commonPaymentData || {},
      createFilters: session.createFilters || {},
      createSort: session.createSort || {}
    };
  } catch (error) {
    console.error('Error restoring state from session:', error);
    return null;
  }
}

/**
 * Get human-readable session summary
 * @returns {string|null} - Summary string or null
 */
export function getWageSessionSummary() {
  const metadata = getWageSessionMetadata();
  if (!metadata) {
    return null;
  }

  if (metadata.isStale) {
    return `Session expired (${metadata.ageDisplay})`;
  }

  return `${metadata.selectedCount}/${metadata.employeeCount} employees, ${metadata.editCount} edits (${metadata.ageDisplay})`;
}
