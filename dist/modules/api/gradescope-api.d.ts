import { RubricResult } from '../../types/index';
export declare class GradescopeAPI {
    private authManager;
    private apiClient;
    private rubricExtractor;
    constructor();
    /**
     * Initialize the API
     */
    initialize(): Promise<boolean>;
    /**
     * Check if authenticated
     */
    isAuthenticated(): boolean;
    /**
     * Get auth state
     */
    getAuthState(): import("../../types/index").AuthState;
    /**
     * Extract rubric structure
     */
    extractRubricStructure(): RubricResult;
    /**
     * Check if rubric item is selected
     */
    isRubricItemSelected(element?: HTMLElement): boolean;
    /**
     * Diagnose radio groups
     */
    diagnoseRadioGroups(): Promise<void>;
    /**
     * Make authenticated request
     */
    makeAuthenticatedRequest(url: string, options?: RequestInit): Promise<Response>;
    /**
     * Toggle rubric item
     */
    toggleRubricItem(_questionId: string, rubricItemId: string, _points: number, _description: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Apply grade for manual scoring
     */
    applyGrade(score: number): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=gradescope-api.d.ts.map