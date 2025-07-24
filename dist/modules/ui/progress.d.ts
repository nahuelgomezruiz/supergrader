export interface ProgressStage {
    progress: number;
    text: string;
}
export type ProgressMessageType = 'success' | 'error' | 'info' | 'warning';
export declare class Progress {
    private progressElement;
    private progressFill;
    private progressText;
    private currentProgress;
    /**
     * Initialize progress component with DOM elements
     */
    initialize(progressElement: HTMLElement): void;
    /**
     * Show progress with initial message
     */
    show(message?: string, progress?: number): void;
    /**
     * Hide progress display
     */
    hide(): void;
    /**
     * Update progress value and text
     */
    update(progress: number, text?: string): void;
    /**
     * Update progress for multi-stage operations
     */
    updateStage(currentStage: number, totalStages: number, stageText: string): void;
    /**
     * Animate progress to completion
     */
    complete(finalMessage?: string): Promise<void>;
    /**
     * Show error state in progress
     */
    showError(errorMessage: string): void;
    /**
     * Reset progress to initial state
     */
    reset(): void;
    /**
     * Get current progress value
     */
    getCurrentProgress(): number;
    /**
     * Check if progress is currently visible
     */
    isVisible(): boolean;
    /**
     * Set progress bar color theme
     */
    setTheme(color: string): void;
    /**
     * Create a progress stage tracker for complex operations
     */
    createStageTracker(stages: string[]): {
        nextStage: (customText?: string) => void;
        setStage: (stage: number, customText?: string) => void;
        complete: () => Promise<void>;
    };
}
//# sourceMappingURL=progress.d.ts.map