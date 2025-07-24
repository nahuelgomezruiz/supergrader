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
export declare class StatusDisplay {
    private statusContainer;
    private statusText;
    private statusIndicator;
    private currentStatus;
    /**
     * Initialize status component with DOM elements
     */
    initialize(statusContainer: HTMLElement): void;
    /**
     * Update status display with authentication info
     */
    updateAuthStatus(authStatus: AuthStatus): void;
    /**
     * Update status with custom info
     */
    updateStatus(statusInfo: StatusInfo): void;
    /**
     * Show checking/loading state
     */
    showChecking(message?: string): void;
    /**
     * Show connected state
     */
    showConnected(message?: string): void;
    /**
     * Show error state
     */
    showError(message?: string, details?: string): void;
    /**
     * Show warning state
     */
    showWarning(message?: string, details?: string): void;
    /**
     * Add debug authentication info to display
     */
    addAuthDebugInfo(authStatus: AuthStatus): void;
    /**
     * Animate status indicator (pulse effect for checking state)
     */
    private animateIndicator;
    /**
     * Start periodic status checking
     */
    startPeriodicCheck(checkCallback: () => Promise<AuthStatus>, intervalMs?: number): () => void;
    /**
     * Get current status info
     */
    getCurrentStatus(): StatusInfo | null;
    /**
     * Check if status is in error state
     */
    hasError(): boolean;
    /**
     * Check if status is connected
     */
    isConnected(): boolean;
    /**
     * Reset to initial state
     */
    reset(): void;
}
//# sourceMappingURL=status.d.ts.map