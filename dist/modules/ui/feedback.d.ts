/**
 * Feedback UI module for displaying model suggestions and collecting user feedback
 */
export interface FeedbackUIConfig {
    rubricItemId: string;
    comment: string;
    decision: 'check' | 'uncheck' | string;
    confidence: number;
    element: HTMLElement;
}
export interface FeedbackData {
    rubricItemId: string;
    rubricQuestion: string;
    studentAssignment: string;
    originalDecision: string;
    userFeedback: string;
}
export declare class FeedbackUI {
    private feedbackBoxes;
    private onFeedbackSubmit?;
    constructor();
    /**
     * Set the callback for when feedback is submitted
     */
    onFeedback(callback: (feedback: FeedbackData) => void): void;
    /**
     * Display a suggestion box for a rubric item
     */
    displaySuggestion(config: FeedbackUIConfig): void;
    /**
     * Remove a suggestion box
     */
    removeSuggestion(rubricItemId: string): void;
    /**
     * Remove all suggestion boxes
     */
    clearAllSuggestions(): void;
    private createFeedbackBox;
    private attachEventListeners;
    private positionFeedbackBox;
    private extractRubricQuestion;
    private extractStudentAssignment;
    private formatDecision;
    private escapeHtml;
    private injectStyles;
}
//# sourceMappingURL=feedback.d.ts.map