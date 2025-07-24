// Error UI component for SuperGrader
// Handles error display and management

export type ErrorType = 'error' | 'warning' | 'info' | 'success';

export interface ErrorMessage {
  type: ErrorType;
  message: string;
  timestamp: number;
  dismissible?: boolean;
}

export class ErrorDisplay {
  private errorElement: HTMLElement | null = null;
  private currentErrors: ErrorMessage[] = [];
  private autoHideTimeout: number | null = null;

  /**
   * Initialize error component with DOM element
   */
  initialize(errorElement: HTMLElement): void {
    this.errorElement = errorElement;
    console.log('ErrorDisplay: Initialized');
  }

  /**
   * Show error message
   */
  showError(message: string, type: ErrorType = 'error', autoHide: boolean = false): void {
    this.show(message, type, autoHide);
  }

  /**
   * Show success message
   */
  showSuccess(message: string, autoHide: boolean = true): void {
    this.show(message, 'success', autoHide);
  }

  /**
   * Show warning message
   */
  showWarning(message: string, autoHide: boolean = false): void {
    this.show(message, 'warning', autoHide);
  }

  /**
   * Show info message
   */
  showInfo(message: string, autoHide: boolean = true): void {
    this.show(message, 'info', autoHide);
  }

  /**
   * Generic show message method
   */
  private show(message: string, type: ErrorType = 'error', autoHide: boolean = false): void {
    if (!this.errorElement) {
      console.error('ErrorDisplay: Not initialized');
      return;
    }

    // Clear any existing auto-hide timeout
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
      this.autoHideTimeout = null;
    }

    // Create error message object
    const errorMessage: ErrorMessage = {
      type,
      message,
      timestamp: Date.now(),
      dismissible: true
    };

    this.currentErrors.push(errorMessage);

    // Update DOM
    this.render();

    console.log(`ErrorDisplay: ${type} shown - ${message}`);

    // Auto-hide if requested
    if (autoHide) {
      const hideDelay = type === 'success' ? 3000 : type === 'info' ? 5000 : 8000;
      this.autoHideTimeout = window.setTimeout(() => {
        this.hide();
      }, hideDelay);
    }
  }

  /**
   * Hide error display
   */
  hide(): void {
    if (!this.errorElement) return;

    this.errorElement.style.display = 'none';
    this.currentErrors = [];
    
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
      this.autoHideTimeout = null;
    }

    console.log('ErrorDisplay: Hidden');
  }

  /**
   * Clear specific error by timestamp
   */
  dismiss(timestamp: number): void {
    this.currentErrors = this.currentErrors.filter(error => error.timestamp !== timestamp);
    
    if (this.currentErrors.length === 0) {
      this.hide();
    } else {
      this.render();
    }
  }

  /**
   * Clear all errors
   */
  clear(): void {
    this.currentErrors = [];
    this.hide();
  }

  /**
   * Render error messages to DOM
   */
  private render(): void {
    if (!this.errorElement) return;

    if (this.currentErrors.length === 0) {
      this.hide();
      return;
    }

    // Show the container
    this.errorElement.style.display = 'block';

    // Get the most recent error for primary display
    const primaryError = this.currentErrors[this.currentErrors.length - 1];
    
    // Set appropriate CSS class based on error type
    this.errorElement.className = `ai-errors ${primaryError.type}`;

    // Generate HTML for all errors
    const errorsHtml = this.currentErrors.map(error => `
      <div class="error-item ${error.type}" data-timestamp="${error.timestamp}">
        <span class="error-icon">${this.getIconForType(error.type)}</span>
        <span class="error-message">${this.escapeHtml(error.message)}</span>
        ${error.dismissible ? `
          <button class="error-dismiss" onclick="this.parentElement.remove()" title="Dismiss">×</button>
        ` : ''}
      </div>
    `).join('');

    this.errorElement.innerHTML = errorsHtml;

    // Add dismiss listeners
    this.setupDismissListeners();
  }

  /**
   * Get appropriate icon for error type
   */
  private getIconForType(type: ErrorType): string {
    switch (type) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'success': return '✅';
      default: return '•';
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Setup dismiss button listeners
   */
  private setupDismissListeners(): void {
    if (!this.errorElement) return;

    const dismissButtons = this.errorElement.querySelectorAll('.error-dismiss');
    dismissButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const errorItem = (e.target as HTMLElement).closest('.error-item');
        if (errorItem) {
          const timestamp = parseInt(errorItem.getAttribute('data-timestamp') || '0');
          this.dismiss(timestamp);
        }
      });
    });
  }

  /**
   * Check if errors are currently displayed
   */
  hasErrors(): boolean {
    return this.currentErrors.length > 0;
  }

  /**
   * Get count of current errors
   */
  getErrorCount(): number {
    return this.currentErrors.length;
  }

  /**
   * Get current errors
   */
  getCurrentErrors(): ErrorMessage[] {
    return [...this.currentErrors];
  }

  /**
   * Show validation errors for forms
   */
  showValidationErrors(errors: Record<string, string>): void {
    const errorMessages = Object.entries(errors).map(([field, message]) => 
      `${field}: ${message}`
    );
    
    this.showError(`Validation failed:\n${errorMessages.join('\n')}`);
  }

  /**
   * Show network error with retry option
   */
  showNetworkError(message: string, retryCallback?: () => void): void {
    let errorMsg = `Network Error: ${message}`;
    if (retryCallback) {
      errorMsg += ' Click here to retry.';
      // Note: In a full implementation, you'd want to make the message clickable
      // and call retryCallback when clicked
    }
    
    this.showError(errorMsg);
  }
} 