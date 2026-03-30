export const API_BASE_URL = '/api';

/**
 * Get CSRF token from cookie
 */
function getCSRFToken(): string | null {
  if (typeof document === 'undefined') return null;
  const name = 'csrfToken=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookieArray = decodedCookie.split(';');

  for (const cookie of cookieArray) {
    const trimmedCookie = cookie.trim();
    if (trimmedCookie.startsWith(name)) {
      return trimmedCookie.substring(name.length);
    }
  }

  return null;
}

export const api = {
  async request(endpoint: string, options: RequestInit = {}) {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${API_BASE_URL}/${endpoint.replace(/^\//, '')}`;

    console.log(`[API REQUEST] ${options.method || 'GET'} ${url}`);

    try {
      const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
      const headers: Record<string, string> = {
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers as Record<string, string>),
      };

      if (isFormData) {
        delete headers['Content-Type'];
      }

      // Add CSRF token for state-changing requests
      const statefulMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
      if (statefulMethods.includes(options.method?.toUpperCase() || '')) {
        const csrfToken = getCSRFToken();
        console.log(`[API] CSRF Token for ${options.method}:`, csrfToken ? 'Found' : 'Missing');
        if (csrfToken) {
          headers['X-CSRF-Token'] = csrfToken;
        }
      }

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      console.log(`[API RESPONSE] ${response.status} ${url}`);

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
      }

      if (!response.ok) {
        console.error(`[API ERROR] ${response.status} ${url}`, data);
        throw new Error(data.message || data.error || `Request failed: ${response.status}`);
      }

      return data;
    } catch (error: any) {
      console.error('[API FATAL ERROR]', error);
      throw error;
    }
  },

  async get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' });
  },

  async post(endpoint: string, body: unknown) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async put(endpoint: string, body: unknown) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  async delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  },
};
