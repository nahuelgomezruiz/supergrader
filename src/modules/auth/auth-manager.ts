// Authentication management module

import { AuthState } from '../../types/index';

export class AuthManager {
  private authState: AuthState = {
    isAuthenticated: false,
    sessionValid: false,
    csrfTokenValid: false,
    lastValidated: null,
    retryCount: 0,
    maxRetries: 3,
    csrfToken: null,
    rateLimiter: {
      currentRequests: 0,
      recentRequests: 0
    }
  };

  private csrfToken: string | null = null;

  /**
   * Initialize authentication
   */
  async initialize(): Promise<boolean> {
    try {
      // Extract and validate CSRF token
      if (!await this.extractAndValidateCSRF()) {
        return false;
      }

      // Validate session
      if (!await this.validateSession()) {
        return false;
      }

      // Test authentication
      if (!await this.testAuthentication()) {
        return false;
      }

      this.authState.isAuthenticated = true;
      this.authState.lastValidated = Date.now();
      return true;

    } catch (error) {
      console.error('AuthManager: Authentication failed:', error);
      return this.handleAuthFailure(`Initialization error: ${(error as Error).message}`);
    }
  }

  /**
   * Extract and validate CSRF token
   */
  private async extractAndValidateCSRF(): Promise<boolean> {
    const metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
    
    if (metaTag?.content) {
      this.csrfToken = metaTag.content;
      
      if (this.csrfToken && this.csrfToken.length > 10) {
        this.authState.csrfTokenValid = true;
        return true;
      }
    }

    console.error('AuthManager: No CSRF token found');
    return false;
  }

  /**
   * Validate session cookies
   */
  private async validateSession(): Promise<boolean> {
    const cookies = document.cookie;
    const cookieNames = cookies.split(';').map(c => c.trim().split('=')[0]);
    
    const sessionCookieNames = ['_gradescope_session', 'remember_me', 'apt.uid', 'apt.sid'];
    const foundSessionCookie = sessionCookieNames.some(name => cookieNames.includes(name));
    
    if (foundSessionCookie) {
      this.authState.sessionValid = true;
    } else {
      // Check for UI indicators of logged-in state
      const userLoggedIn = !!(
        document.querySelector('.navbar .dropdown-toggle') ||
        document.querySelector('[data-react-class*="Navbar"]') ||
        document.querySelector('.user-menu')
      );
      
      if (userLoggedIn) {
        this.authState.sessionValid = true;
      }
    }

    return this.authState.sessionValid;
  }

  /**
   * Test authentication with a safe API call
   */
  private async testAuthentication(): Promise<boolean> {
    if (!this.csrfToken) {
      return false;
    }

    try {
      const response = await fetch(window.location.href, {
        method: 'HEAD',
        headers: {
          'X-CSRF-Token': this.csrfToken,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (response.ok) {
        return true;
      } else if (response.status === 401 || response.status === 403) {
        return false;
      }
      
      return response.ok;
    } catch (error) {
      console.error('AuthManager: Authentication test failed:', error);
      return false;
    }
  }

  /**
   * Handle authentication failure
   */
  private handleAuthFailure(message: string): boolean {
    this.authState.retryCount++;
    
    if (this.authState.retryCount < this.authState.maxRetries) {
      const retryDelay = Math.pow(2, this.authState.retryCount) * 1000;
      setTimeout(() => {
        this.initialize();
      }, retryDelay);
      
      return false;
    }
    
    this.authState.isAuthenticated = false;
    console.error(`AuthManager: ${message}`);
    return false;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    if (!this.authState.isAuthenticated) {
      return false;
    }

    // Check if authentication is stale
    const oneHour = 60 * 60 * 1000;
    if (this.authState.lastValidated && (Date.now() - this.authState.lastValidated) > oneHour) {
      this.initialize(); // Re-validate in background
      return true; // Assume still valid for now
    }

    return true;
  }

  /**
   * Get auth state
   */
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * Get CSRF token
   */
  getCSRFToken(): string | null {
    return this.csrfToken;
  }
} 