import { GradescopeAPI } from '../api/gradescope-api';
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
export declare class GradingService {
    private api;
    private backendUrl;
    constructor(api: GradescopeAPI, backendUrl?: string);
    /**
     * Extract assignment context from the current page
     */
    private extractAssignmentContext;
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
    /**
     * Apply grading decisions to the UI
     */
    applyGradingDecision(decision: GradingDecision): Promise<void>;
}
export {};
//# sourceMappingURL=grading-service.d.ts.map