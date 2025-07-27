interface FeedbackUIConfig {
    rubricItemId: string;
    comment: string;
    decision: 'check' | 'uncheck' | string;
    confidence: number;
    element: HTMLElement;
}
interface FeedbackData {
    rubricItemId: string;
    rubricQuestion: string;
    studentAssignment: string;
    originalDecision: string;
    userFeedback: string;
}
declare class SimpleFeedbackUI {
    private feedbackBoxes;
    private onFeedbackSubmit?;
    constructor();
    onFeedback(cb: (data: FeedbackData) => void): void;
    clearAllSuggestions(): void;
    displaySuggestion(cfg: FeedbackUIConfig): void;
    private removeSuggestion;
    private createBox;
    private extractRubricQuestion;
    private extractStudentAnswer;
    private formatDecision;
    private escape;
    private injectStyles;
    showLoadingOverlay(message?: string, subtext?: string): void;
    hideLoadingOverlay(): void;
    updateLoadingOverlay(message: string, subtext?: string): void;
}
interface BackendRubricItem {
    id: string;
    description: string;
    points: number;
    type: 'CHECKBOX' | 'RADIO';
    options?: Record<string, string>;
}
interface GradingRequest {
    assignment_context: {
        course_id: string;
        assignment_id: string;
        submission_id: string;
        assignment_name: string;
    };
    source_files: Record<string, string>;
    rubric_items: BackendRubricItem[];
}
interface GradingDecision {
    rubric_item_id: string;
    type: 'CHECKBOX' | 'RADIO';
    confidence: number;
    verdict: {
        decision?: 'check' | 'uncheck';
        selected_option?: string;
        comment: string;
        evidence: string;
    };
}
interface GradingEvent {
    type: 'partial_result' | 'job_complete' | 'error';
    rubric_item_id?: string;
    decision?: GradingDecision;
    progress?: number;
    message?: string;
    error?: string;
}
declare function getGradingDoc(): Document;
declare function waitDelay(ms: number): Promise<void>;
declare class ChromeGradingService {
    private backendUrl;
    private api;
    private feedbackUI;
    private cachedDecisions;
    private cachedFiles;
    private cachedNestedElements;
    private cachedNestedData;
    private cachedRadioOptions;
    private isProcessingSuggestions;
    private suggestionProcessingTimer;
    constructor();
    /**
     * Generate cache key for submission files based on course and base submission identifier
     * For multi-question assignments, both question_id and submission_id increment together,
     * so we normalize them to a base range to cache across all questions of the same student
     */
    private generateFileCacheKey;
    /**
     * Clear cached files (useful when navigating to different submissions)
     */
    clearFileCache(): void;
    /**
     * Extract assignment context from the current page
     */
    private extractAssignmentContext;
    /**
     * Extract rubric directly from DOM with elements preserved
     */
    private extractRubricFromDOM;
    /**
   * Extract text content with proper spacing and bullet point preservation
   * Improved version that handles complex HTML structures more reliably
   */
    private extractTextWithSpacing;
    /**
     * Enhanced extraction that properly handles list structures **in order** and preserves newlines
     */
    private extractTextFromLists;
    /**
     * Get direct text content of an element, excluding nested lists
     */
    private getDirectTextContent;
    /**
     * Simple fallback extraction method
     */
    private extractTextSimple;
    /**
     * Debug helper: Log the extracted text for a rubric item
     */
    private logTextExtractionDebug;
    /**
     * Find a specific nested checkbox element within a group by its child ID
     */
    private findNestedCheckboxElement;
    /**
     * Extract nested checkboxes from a group (like Program Design)
     */
    private extractNestedCheckboxes;
    /**
     * Extract all radio button options by expanding accordions
     */
    private extractRadioOptions;
    /**
     * Convert rubric items to backend format
     */
    private convertRubricToBackendFormat;
    /**
     * Scroll to the top of the grading panel after scraping toggle options
     */
    private scrollToTopOfGradingPanel;
    private isTestFile;
    /**
     * Grade submission using the backend API
     */
    gradeSubmission(onProgress?: (event: GradingEvent) => void): Promise<void>;
    /**
     * Display grading suggestion in the UI
     */
    private displayGradingSuggestion;
    /**
     * Apply a grading decision to the Gradescope UI
     */
    private applyGradingDecision;
    /**
     * Submit feedback to the backend
     */
    private submitFeedback;
    /**
     * Get extension settings
     */
    private getSettings;
    /**
     * Re-display suggestions for nested checkboxes in currently expanded groups
     */
    private reDisplayNestedSuggestions;
    /**
     * Display a single suggestion without caching (used for re-display)
     */
    private displaySingleSuggestion;
    /**
     * Clear all cached data (useful when navigating to a new submission)
     */
    private clearCache;
    /**
     * Start suggestion processing phase with loading overlay
     */
    private startSuggestionProcessing;
    /**
     * Finish suggestion processing phase
     */
    private finishSuggestionProcessing;
    /**
     * Refresh cached elements that may have become stale due to DOM changes
     */
    private refreshCachedElements;
    /**
     * Set up listener to detect when groups are expanded/collapsed
     * Note: With caching, this is mainly for edge cases where cache misses occur
     */
    private setupToggleListener;
}
//# sourceMappingURL=grading-service.d.ts.map