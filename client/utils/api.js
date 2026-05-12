/**
 * Get CSRF token from cookie
 * @returns {string|null} CSRF token or null
 */
function getCSRFToken() {
  const name = 'csrfToken=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookieArray = decodedCookie.split(';');
  
  for (let cookie of cookieArray) {
    cookie = cookie.trim();
    if (cookie.indexOf(name) === 0) {
      return cookie.substring(name.length);
    }
  }
  
  return null;
}

/**
 * Fetch wrapper that automatically includes CSRF tokens for state-changing requests
 * Drop-in replacement for fetch() that handles CSRF protection
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function fetchWithCSRF(url, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers
  };

  if (isFormData) {
    delete headers['Content-Type'];
  }
  
  // Add CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
  const statefulMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (statefulMethods.includes(options.method?.toUpperCase())) {
    const csrfToken = getCSRFToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin'
  });
}

export const api = {
  async request(url, options = {}) {
    try {
      const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
      const headers = {
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      };

      if (isFormData) {
        delete headers['Content-Type'];
      }
      
      // Add CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
      const statefulMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
      if (statefulMethods.includes(options.method?.toUpperCase())) {
        const csrfToken = getCSRFToken();
        if (csrfToken) {
          headers['X-CSRF-Token'] = csrfToken;
        }
      }
      
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'same-origin' // Include cookies
      });

      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Expected JSON but received:', text.substring(0, 100));
        throw new Error(`Server returned non-JSON response (${response.status}). Please check if the API route exists and the server is running.`);
      }

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  async get(url) {
    return this.request(url, {
      method: 'GET'
    });
  },

  async post(url, body) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  async put(url, body) {
    return this.request(url, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  async delete(url) {
    return this.request(url, {
      method: 'DELETE'
    });
  }
};
