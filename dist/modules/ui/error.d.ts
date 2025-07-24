export type ErrorType = 'error' | 'warning' | 'info' | 'success';
export interface ErrorMessage {
    type: ErrorType;
    message: string;
    timestamp: number;
    dismissible?: boolean;
}
export declare class ErrorDisplay {
    private errorElement;
    private currentErrors;
    private autoHideTimeout;
    /**
     * Initialize error component with DOM element
     */
    initialize(errorElement: HTMLElement): void;
    /**
     * Show error message
     */
    showError(message: string, type?: ErrorType, autoHide?: boolean): void;
    /**
     * Show success message
     */
    showSuccess(message: string, autoHide?: boolean): void;
    /**
     * Show warning message
     */
    showWarning(message: string, autoHide?: boolean): void;
    /**
     * Show info message
     */
    showInfo(message: string, autoHide?: boolean): void;
    /**
     * Generic show message method
     */
    private show;
    /**
     * Hide error display
     */
    hide(): void;
    /**
     * Clear specific error by timestamp
     */
    dismiss(timestamp: number): void;
    /**
     * Clear all errors
     */
    clear(): void;
    /**
     * Render error messages to DOM
     */
    private render;
    /**
     * Get appropriate icon for error type
     */
    private getIconForType;
    /**
     * Escape HTML to prevent XSS
     */
    private escapeHtml;
    /**
     * Setup dismiss button listeners
     */
    private setupDismissListeners;
    /**
     * Check if errors are currently displayed
     */
    hasErrors(): boolean;
    /**
     * Get count of current errors
     */
    getErrorCount(): number;
    /**
     * Get current errors
     */
    getCurrentErrors(): ErrorMessage[];
    /**
     * Show validation errors for forms
     */
    showValidationErrors(errors: Record<string, string>): void;
    /**
     * Show network error with retry option
     */
    showNetworkError(message: string, retryCallback?: () => void): void;
}
//# sourceMappingURL=error.d.ts.map