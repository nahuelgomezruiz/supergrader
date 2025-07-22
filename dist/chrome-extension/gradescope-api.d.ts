interface AuthState {
    isAuthenticated: boolean;
    csrfTokenValid: boolean;
    sessionValid: boolean;
    lastValidated: number | null;
    retryCount: number;
    maxRetries: number;
}
interface RateLimiter {
    requests: number[];
    maxPerMinute: number;
    maxConcurrent: number;
    currentRequests: number;
}
interface FileInfo {
    element?: Element;
    fileName?: string;
    downloadLink?: string;
    fileId?: string;
    type: 'download-button' | 'expandable-file';
    downloadButton?: Element;
}
interface FileContent {
    content: string;
    size: number;
    encoding: string;
    extension: string;
}
interface FileInspectionResult {
    hasFiles: boolean;
    fileCount: number;
    type: 'programming' | 'text' | 'image' | 'pdf' | 'unknown';
    files?: FileInfo[];
    imageCount?: number;
}
interface DownloadMetadata {
    totalFiles: number;
    supportedFiles: number;
    skippedFiles: number;
    errors: string[];
    fileTypes: Record<string, number>;
    largestFile: {
        name: string;
        size: number;
    };
    totalSize: number;
    downloadMethod: string;
    submissionType?: string;
    message?: string;
    hasDownloadableFiles?: boolean;
}
interface DownloadResult {
    files: Record<string, FileContent>;
    metadata: DownloadMetadata;
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
type WindowWithExtensions = Window & {
    JSZip: any;
    GradescopeAPI: GradescopeAPI;
    UIController?: any;
    supergraderState?: any;
    supergraderAPI?: any;
    supergraderUI?: any;
};
/**
 * Enhanced Gradescope API wrapper class with robust authentication
 */
declare class GradescopeAPI {
    private csrfToken;
    private authState;
    private rateLimiter;
    /**
     * Enhanced authentication initialization with validation and testing
     */
    initialize(): Promise<boolean>;
    /**
     * Extract and validate CSRF token
     */
    private extractAndValidateCSRF;
    /**
     * Validate session cookies and authentication state
     */
    private validateSession;
    /**
     * Test authentication by making a safe API call
     */
    private testAuthentication;
    /**
     * Handle authentication failures with recovery attempts
     */
    private handleAuthFailure;
    /**
     * Notify UI of persistent authentication failure
     */
    private notifyAuthenticationFailure;
    /**
     * Check if authentication is still valid
     */
    isAuthenticated(): boolean;
    /**
     * Make authenticated API request with rate limiting and error handling
     */
    makeAuthenticatedRequest(url: string, options?: RequestInit): Promise<Response>;
    /**
     * Get current authentication status for debugging
     */
    getAuthStatus(): AuthStatus;
    /**
     * Download and extract source files from submission ZIP
     * Implements Week 2, Day 1-2: Source code extraction
     */
    downloadSubmissionFiles(submissionId: string): Promise<DownloadResult>;
    /**
     * Simplified file detection - finds files and their download links
     */
    private inspectAvailableFiles;
    /**
     * Find download buttons and extract file info
     */
    private findDownloadButtons;
    /**
     * Find expandable file sections (like details/summary elements)
     */
    private findExpandableFiles;
    /**
     * Find download button associated with an element
     */
    private findDownloadButton;
    /**
     * Find filename associated with a download button
     */
    private findAssociatedFileName;
    /**
     * Check if text looks like a valid filename
     */
    private isValidFileName;
    /**
     * Detect non-programming submission types
     */
    private detectNonProgrammingType;
    /**
     * Create empty result for non-programming submissions
     */
    private createEmptyResult;
    /**
     * Download individual files (simplified version)
     */
    private downloadIndividualFiles;
    /**
     * Download individual file and return processed content
     */
    private downloadFile;
    /**
     * Get download URL for a file
     */
    private getDownloadUrl;
    /**
     * Utility methods for metadata management
     */
    private createMetadata;
    private cleanFileName;
    private shouldProcessFile;
    private updateMetadata;
    private recordError;
    /**
     * Fallback ZIP download method (simplified)
     */
    private downloadZipFile;
    private getZipUrls;
    private processZipFile;
    /**
     * Helper method to detect binary data in text content
     */
    private containsBinaryData;
    /**
     * Extract rubric structure from DOM - Week 2 Day 3-4 Implementation
     */
    extractRubricStructure(): any[];
    /**
     * Check if a rubric item is currently selected
     */
    private isRubricItemSelected;
    /**
     * Toggle a rubric item - Week 2 Day 3-4 Implementation
     */
    toggleRubricItem(_questionId: string, rubricItemId: string, _points: number, _description: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Add inline comment to code (placeholder - Week 2)
     */
    addComment(_questionId: string, submissionId: string, _fileId: string, _lineStart: number, _lineEnd: number, _text: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
/**
 * Get document for rubric extraction - handles both iframe and frameless layouts
 */
declare function getInnerDoc(): Document;
/**
 * Legacy function for backwards compatibility
 */
declare function getIframeDocument(): Document | null;
interface RubricItem {
    id: string | number;
    description?: string;
    points?: number;
    element?: HTMLElement;
}
interface StructuredRubric {
    type: 'structured';
    items: RubricItem[];
    rubricStyle: 'CHECKBOX' | 'RADIO';
}
interface ManualRubric {
    type: 'manual';
    box: HTMLInputElement;
}
type RubricResult = StructuredRubric | ManualRubric | null;
/**
 * Unified rubric detection - handles all Gradescope layouts
 */
declare function getRubric(): RubricResult;
/**
 * Apply grading action - handles both structured rubrics and manual scoring
 */
declare function applyGrade(target: RubricResult, rubricId?: string, checked?: boolean, score?: number): boolean;
/**
 * Extract rubric items using unified detection (legacy wrapper)
 */
declare function getRubricFromIframe(): Promise<{
    items: Array<{
        id: number;
        text: string;
        points: number;
    }>;
    rubricStyle: "RADIO" | "CHECKBOX";
    pointsDistribution: {
        positive: number;
        negative: number;
        zero: number;
    };
}>;
/**
 * Apply rubric selection (legacy wrapper for applyGrade)
 */
declare function applyRubricItem(itemId: number, selected: boolean): boolean;
declare function updateAuthStatusInDOM(): void;
declare const originalInitialize: any;
//# sourceMappingURL=gradescope-api.d.ts.map