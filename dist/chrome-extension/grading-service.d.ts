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
    constructor(backendUrl?: string);
    /**
     * Extract assignment context from the current page
     */
    private extractAssignmentContext;
    /**
     * Extract rubric directly from DOM with elements preserved
     */
    private extractRubricFromDOM;
    /**
     * Extract text content with proper spacing between elements
     */
    private extractTextWithSpacing;
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
     * Grade submission using the backend API
     */
    gradeSubmission(onProgress?: (event: GradingEvent) => void): Promise<void>;
}
//# sourceMappingURL=grading-service.d.ts.map