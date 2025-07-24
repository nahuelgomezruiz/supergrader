// Status UI component for SuperGrader
// Handles connection and authentication status display

export interface AuthStatus {
  isAuthenticated: boolean;
  csrfTokenValid: boolean;
  sessionValid: boolean;
  lastValidated: number | null;
  retryCount: number;
  maxRetries: number;
  csrfToken: string | null;
  rateLimiter: {
    currentRequests: number;
    recentRequests: number;
  };
}

export type StatusType = 'connected' | 'warning' | 'error' | 'checking';

export interface StatusInfo {
  type: StatusType;
  text: string;
  details?: string;
}

export class StatusDisplay {
  private statusContainer: HTMLElement | null = null;
  private statusText: HTMLElement | null = null;
  private statusIndicator: HTMLElement | null = null;
  private currentStatus: StatusInfo | null = null;

  /**
   * Initialize status component with DOM elements
   */
  initialize(statusContainer: HTMLElement): void {
    this.statusContainer = statusContainer;
    this.statusText = statusContainer.querySelector('.status-text') as HTMLElement;
    this.statusIndicator = statusContainer.querySelector('.status-indicator') as HTMLElement;
    
    if (!this.statusText) {
      console.error('StatusDisplay: Status text element not found');
    }
    
    console.log('StatusDisplay: Initialized');
  }

  /**
   * Update status display with authentication info
   */
  updateAuthStatus(authStatus: AuthStatus): void {
    let statusInfo: StatusInfo;

    if (authStatus.isAuthenticated && authStatus.csrfTokenValid) {
      statusInfo = {
        type: 'connected',
        text: 'Authenticated',
        details: `Last validated: ${authStatus.lastValidated ? new Date(authStatus.lastValidated).toLocaleTimeString() : 'Never'}`
      };
    } else if (authStatus.csrfTokenValid) {
      statusInfo = {
        type: 'warning',
        text: 'Partial Auth',
        details: 'CSRF token valid but session may be expired'
      };
    } else {
      statusInfo = {
        type: 'error',
        text: 'Auth Failed',
        details: `Retry count: ${authStatus.retryCount}/${authStatus.maxRetries}`
      };
    }

    this.updateStatus(statusInfo);
    console.log('StatusDisplay: Auth status updated', statusInfo);
  }

  /**
   * Update status with custom info
   */
  updateStatus(statusInfo: StatusInfo): void {
    if (!this.statusContainer || !this.statusText) {
      console.error('StatusDisplay: Not initialized');
      return;
    }

    this.currentStatus = statusInfo;

    // Update CSS class
    this.statusContainer.className = `ai-connection-status ${statusInfo.type}`;

    // Update text
    this.statusText.textContent = statusInfo.text;

    // Update title with details if available
    if (statusInfo.details) {
      this.statusContainer.title = statusInfo.details;
    }

    console.log(`StatusDisplay: Status updated to ${statusInfo.type} - ${statusInfo.text}`);
  }

  /**
   * Show checking/loading state
   */
  showChecking(message: string = 'Checking connection...'): void {
    this.updateStatus({
      type: 'checking',
      text: message
    });
  }

  /**
   * Show connected state
   */
  showConnected(message: string = 'Connected'): void {
    this.updateStatus({
      type: 'connected',
      text: message
    });
  }

  /**
   * Show error state
   */
  showError(message: string = 'Error', details?: string): void {
    this.updateStatus({
      type: 'error',
      text: message,
      details
    });
  }

  /**
   * Show warning state
   */
  showWarning(message: string = 'Warning', details?: string): void {
    this.updateStatus({
      type: 'warning',
      text: message,
      details
    });
  }

  /**
   * Add debug authentication info to display
   */
  addAuthDebugInfo(authStatus: AuthStatus): void {
    if (!this.statusContainer) return;

    // Create or update debug info element
    let debugInfo = this.statusContainer.querySelector('.auth-debug-info') as HTMLElement;
    if (!debugInfo) {
      debugInfo = document.createElement('div');
      debugInfo.className = 'auth-debug-info';
      debugInfo.style.cssText = `
        font-size: 10px;
        color: #666;
        margin-top: 2px;
        display: none;
      `;
      this.statusContainer.appendChild(debugInfo);
    }

    // Update debug content
    debugInfo.innerHTML = `
      <div>CSRF: ${authStatus.csrfTokenValid ? '✓' : '✗'}</div>
      <div>Session: ${authStatus.sessionValid ? '✓' : '✗'}</div>
      <div>Requests: ${authStatus.rateLimiter.currentRequests}/${authStatus.rateLimiter.recentRequests}</div>
    `;

    // Show debug info on hover
    this.statusContainer.addEventListener('mouseenter', () => {
      debugInfo!.style.display = 'block';
    });

    this.statusContainer.addEventListener('mouseleave', () => {
      debugInfo!.style.display = 'none';
    });
  }

  /**
   * Animate status indicator (pulse effect for checking state)
   */
  private animateIndicator(animate: boolean = true): void {
    if (!this.statusIndicator) return;

    if (animate) {
      this.statusIndicator.style.animation = 'pulse 1.5s infinite';
    } else {
      this.statusIndicator.style.animation = '';
    }
  }

  /**
   * Start periodic status checking
   */
  startPeriodicCheck(checkCallback: () => Promise<AuthStatus>, intervalMs: number = 30000): () => void {
    const checkStatus = async () => {
      try {
        this.showChecking();
        const authStatus = await checkCallback();
        this.updateAuthStatus(authStatus);
      } catch (error) {
        this.showError('Check Failed', (error as Error).message);
      }
    };

    // Initial check
    checkStatus();

    // Set up interval
    const intervalId = setInterval(checkStatus, intervalMs);

    // Return cleanup function
    return () => {
      clearInterval(intervalId);
      console.log('StatusDisplay: Periodic checking stopped');
    };
  }

  /**
   * Get current status info
   */
  getCurrentStatus(): StatusInfo | null {
    return this.currentStatus;
  }

  /**
   * Check if status is in error state
   */
  hasError(): boolean {
    return this.currentStatus?.type === 'error';
  }

  /**
   * Check if status is connected
   */
  isConnected(): boolean {
    return this.currentStatus?.type === 'connected';
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.showChecking('Initializing...');
    
    // Remove any debug info
    const debugInfo = this.statusContainer?.querySelector('.auth-debug-info');
    if (debugInfo) {
      debugInfo.remove();
    }
  }
} 