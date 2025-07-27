interface EnhancedState {
    courseId: string | null;
    assignmentId: string | null;
    submissionId: string | null;
    assignmentType: 'assignments' | 'questions' | null;
    isInitialized: boolean;
    retryCount: number;
    domReady: boolean;
    injectionPoint?: Element | null;
    rubricData?: any;
    sourceCode?: Record<string, string>;
    pageMetadata?: PageMetadata;
}
interface PageMetadata {
    assignmentName?: string;
    courseName?: string;
    studentId?: string;
    submissionTime?: string;
}
interface ProgressStage {
    progress: number;
    text: string;
}
interface AuthStatus {
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
interface WindowWithUIExtensions extends Window {
    UIController: UIController;
    GradescopeAPI?: {
        isAuthenticated(): boolean;
        getAuthStatus(): AuthStatus;
        initialize(): Promise<boolean>;
        authState?: any;
    };
}
/**
 * UI Controller class with enhanced injection and error handling
 */
declare class UIController {
    private isInitialized;
    private aiPanel;
    private injectionPoint;
    private state;
    private currentUrl;
    private urlChangeObserver;
    /**
     * Initialize the UI components with enhanced state and injection point
     */
    initialize(enhancedState: EnhancedState): void;
    /**
     * Set up URL change detection to handle section navigation
     */
    private setupUrlChangeDetection;
    /**
     * Handle URL changes - clear previous suggestions and re-grade
     */
    private handleUrlChange;
    /**
     * Clear all previous grading suggestions from the DOM
     */
    private clearPreviousSuggestions;
    /**
     * Cleanup URL change detection
     */
    private cleanupUrlDetection;
    /**
     * Find fallback injection point if provided one fails
     */
    private findFallbackInjectionPoint;
    /**
     * Create the main AI grading panel with enhanced features
     * NOTE: Disabled for automatic grading mode
     */
    private createAIPanel;
    /**
     * Safely insert panel into DOM with multiple strategies
     */
    private insertPanelSafely;
    /**
     * Set up enhanced event listeners for the AI panel
     * NOTE: Disabled for automatic grading mode
     */
    private setupEnhancedEventListeners;
    /**
     * Enhanced grading process with backend integration
     */
    private startEnhancedGrading;
    /**
     * Wait for ChromeGradingService to be available with retry mechanism
     */
    private waitForGradingService;
    /**
     * Complete the grading process and reset UI
     */
    private completeGrading;
    /**
     * Update connection status indicator with authentication status
     */
    private updateConnectionStatus;
    /**
     * Toggle panel visibility with animation
     */
    private togglePanel;
    /**
     * Show error or success message to user
     */
    showError(message: string, type?: 'error' | 'success' | 'info'): void;
    /**
     * Hide error messages
     */
    private hideError;
    /**
     * Handle initialization errors
     */
    private handleInitializationError;
    /**
     * Show uncertainty warning for specific rubric items
     */
    showUncertaintyWarning(uncertainItems: string[]): void;
    /**
     * Update progress indicator with specific values
     */
    updateProgress(step: number, total: number, message: string): void;
    /**
     * Show progress indicator with message and percentage
     */
    showProgress(message: string, percentage?: number): void;
    /**
     * Hide progress indicator
     */
    hideProgress(): void;
    /**
     * Add authentication debug information to the panel
     */
    private addAuthDebugInfo;
    /**
     * Retry authentication when user clicks retry button
     */
    retryAuthentication(): void;
    /**
     * Test file download functionality (CSP-compliant)
     */
    private testFileDownload;
    /**
     * Test rubric parsing functionality (Week 2 Day 3-4: Rubric Parsing)
     */
    private testRubric;
    /**
     * Comprehensive rubric test - tests all rubric parsing systems
     */
    private testRubricComprehensive;
    /**
     * Display comprehensive test results
     */
    private showComprehensiveResults;
    /**
     * Test API functionality - Week 2 Day 5: API Testing
     */
    private testAPI;
    /**
     * Log usage examples for developers
     */
    private logUsageExamples;
    /**
     * Show actual rubric data from the page
     */
    private showRubricData;
    /**
     * Simple delay helper for test pacing
     */
    private delay;
}
//# sourceMappingURL=ui-controller.d.ts.map