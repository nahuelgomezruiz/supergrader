import type { GradescopeAPI } from '../api/gradescope-api';
export interface BackendRubricItem {
    id: string;
    description: string;
    points: number;
    type: 'CHECKBOX' | 'RADIO';
    options?: Record<string, string>;
}
export interface GradingRequest {
    assignment_context: {
        course_id: string;
        assignment_id: string;
        submission_id: string;
        assignment_name: string;
    };
    source_files: Record<string, string>;
    rubric_items: BackendRubricItem[];
}
export interface GradingDecision {
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
export interface GradingEvent {
    type: 'partial_result' | 'job_complete' | 'error';
    rubric_item_id?: string;
    decision?: GradingDecision;
    progress?: number;
    message?: string;
    error?: string;
}
/**
 * Unified grading service that works in both modular and Chrome extension contexts
 */
export declare class UnifiedGradingService {
    private backendUrl;
    private api?;
    constructor(backendUrl?: string, api?: GradescopeAPI);
    /**
     * Extract assignment context from the current page
     */
    private extractAssignmentContext;
    /**
     * Extract all radio button options by expanding accordions
     */
    private extractRadioOptions;
    /**
     * Extract rubric from DOM with elements preserved
     */
    private extractRubricFromDOM;
    /**
     * Helper methods for DOM extraction
     */
    private extractItemId;
    private extractItemDescription;
    private extractItemPoints;
    private extractGroupId;
    private extractGroupDescription;
    /**
     * Convert rubric items to backend format
     */
    private convertRubricToBackendFormat;
    /**
     * Check if a file is a test file
     */
    private isTestFile;
    /**
     * Sort rubric items using consistent ordering
     */
    private sortRubricItems;
    /**
     * Main grading method - works with both modular and Chrome extension contexts
     */
    gradeSubmission(onProgress?: (event: GradingEvent) => void): Promise<void>;
    /**
     * Apply grading decision to the UI
     */
    applyGradingDecision(decision: GradingDecision): Promise<void>;
    /**
     * Get service configuration
     */
    getConfig(): {
        backendUrl: string;
        hasModularAPI: boolean;
    };
    /**
     * Update backend URL
     */
    setBackendUrl(url: string): void;
}
//# sourceMappingURL=unified-grading-service.d.ts.map