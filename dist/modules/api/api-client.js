// API client module for authenticated requests
import { withTimeout } from '../../utils/async';
export class APIClient {
    constructor(authManager) {
        this.authManager = authManager;
    }
    /**
     * Make authenticated request
     */
    async makeRequest(url, options = {}) {
        if (!this.authManager.isAuthenticated()) {
            throw new Error('Not authenticated');
        }
        const csrfToken = this.authManager.getCSRFToken();
        if (!csrfToken) {
            throw new Error('No CSRF token available');
        }
        const requestOptions = {
            ...options,
            headers: {
                'X-CSRF-Token': csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json',
                ...options.headers
            }
        };
        try {
            const response = await withTimeout(fetch(url, requestOptions), 10000);
            if (response.status === 401 || response.status === 403) {
                // Try to re-authenticate
                const reAuthSuccess = await this.authManager.initialize();
                if (reAuthSuccess) {
                    // Retry with new token
                    const newToken = this.authManager.getCSRFToken();
                    if (newToken) {
                        requestOptions.headers = {
                            ...requestOptions.headers,
                            'X-CSRF-Token': newToken
                        };
                        return await withTimeout(fetch(url, requestOptions), 10000);
                    }
                }
                throw new Error(`Authentication failed: ${response.status}`);
            }
            return response;
        }
        catch (error) {
            console.error('APIClient: Request failed:', error);
            throw error;
        }
    }
    /**
     * Make GET request
     */
    async get(url) {
        return this.makeRequest(url, { method: 'GET' });
    }
    /**
     * Make POST request
     */
    async post(url, data) {
        return this.makeRequest(url, {
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined
        });
    }
    /**
     * Make PUT request
     */
    async put(url, data) {
        return this.makeRequest(url, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined
        });
    }
    /**
     * Make DELETE request
     */
    async delete(url) {
        return this.makeRequest(url, { method: 'DELETE' });
    }
}
//# sourceMappingURL=api-client.js.map