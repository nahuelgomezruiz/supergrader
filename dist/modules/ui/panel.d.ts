export interface PanelConfig {
    assignmentType: 'assignments' | 'questions' | null;
    assignmentId: string | null;
    submissionId: string | null;
}
export interface PanelElements {
    panel: HTMLElement;
    content: HTMLElement;
    header: HTMLElement;
    controls: HTMLElement;
    progress: HTMLElement;
    errors: HTMLElement;
}
export declare class Panel {
    private elements;
    private isVisible;
    /**
     * Create the main AI grading panel
     */
    create(config: PanelConfig): PanelElements;
    /**
     * Insert panel into DOM safely with multiple strategies
     */
    insertSafely(injectionPoint: Element): void;
    /**
     * Toggle panel visibility
     */
    toggle(): void;
    /**
     * Setup toggle button listener
     */
    private setupToggleListener;
    /**
     * Get panel elements for external access
     */
    getElements(): PanelElements | null;
    /**
     * Check if panel is visible
     */
    isExpanded(): boolean;
}
//# sourceMappingURL=panel.d.ts.map