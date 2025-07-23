interface Config {
    BACKEND_URL: string;
    CONFIDENCE_THRESHOLD: number;
    MAX_RETRIES: number;
    RETRY_DELAY: number;
}
interface AppState {
    courseId: string | null;
    assignmentId: string | null;
    submissionId: string | null;
    assignmentType: 'assignments' | 'questions' | null;
    isInitialized: boolean;
    retryCount: number;
    domReady: boolean;
}
interface EnhancedState extends AppState {
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
declare const CONFIG: Config;
declare let appState: AppState;
/**
 * Enhanced URL pattern matching and ID extraction
 */
declare function extractPageInfo(): boolean;
/**
 * Enhanced DOM readiness detection with multiple strategies
 */
declare function waitForDOM(): Promise<void>;
/**
 * Enhanced UI injection point detection with multiple strategies
 */
declare function findInjectionPoint(): Element | null;
/**
 * Enhanced initialization with comprehensive error handling and retry logic
 */
declare function initializeExtension(): Promise<void>;
/**
 * Extract page metadata with enhanced selectors
 */
declare function extractPageMetadata(): Promise<PageMetadata | undefined>;
/**
 * Set up global state management for cross-component communication
 */
declare function setupGlobalState(state: EnhancedState, api: any, ui: any): void;
/**
 * Perform periodic health checks
 */
declare function performHealthCheck(): void;
/**
 * Handle grading request from popup
 */
declare function handleGradingRequest(backendUrl: string): Promise<void>;
/**
 * Handle page navigation and dynamic content changes
 */
declare function setupNavigationHandler(): void;
//# sourceMappingURL=content.d.ts.map