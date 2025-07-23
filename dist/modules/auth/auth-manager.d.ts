import { AuthState } from '../../types/index';
export declare class AuthManager {
    private authState;
    private csrfToken;
    /**
     * Initialize authentication
     */
    initialize(): Promise<boolean>;
    /**
     * Extract and validate CSRF token
     */
    private extractAndValidateCSRF;
    /**
     * Validate session cookies
     */
    private validateSession;
    /**
     * Test authentication with a safe API call
     */
    private testAuthentication;
    /**
     * Handle authentication failure
     */
    private handleAuthFailure;
    /**
     * Check if authenticated
     */
    isAuthenticated(): boolean;
    /**
     * Get auth state
     */
    getAuthState(): AuthState;
    /**
     * Get CSRF token
     */
    getCSRFToken(): string | null;
}
//# sourceMappingURL=auth-manager.d.ts.map