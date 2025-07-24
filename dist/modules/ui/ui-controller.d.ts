import type { EnhancedState, ErrorType } from './index';
export declare class ModularUIController {
    private isInitialized;
    private state;
    private injectionPoint;
    private panel;
    private progress;
    private errorDisplay;
    private statusDisplay;
    private panelElements;
    constructor();
    /**
     * Initialize the modular UI with enhanced state
     */
    initialize(enhancedState: EnhancedState): void;
    /**
     * Create the main UI using modular components
     */
    private createUI;
    /**
     * Initialize all UI components with their DOM elements
     */
    private initializeComponents;
    /**
     * Setup event listeners for UI interactions
     */
    private setupEventListeners;
    /**
     * Enhanced grading process with modular UI components
     */
    private startEnhancedGrading;
    /**
     * Show rubric data using existing functionality
     */
    private showRubricData;
    /**
     * Show radio button diagnostics
     */
    private showRadioDiagnostics;
    /**
     * Update connection status display
     */
    private updateConnectionStatus;
    /**
     * Find fallback injection point if provided one fails
     */
    private findFallbackInjectionPoint;
    /**
     * Handle initialization errors
     */
    private handleInitializationError;
    /**
     * Public API methods for external access
     */
    showError(message: string, type?: ErrorType): void;
    showSuccess(message: string): void;
    showProgress(message: string, progress?: number): void;
    hideProgress(): void;
    updateProgress(progress: number, message?: string): void;
    getInitializationStatus(): boolean;
    getState(): EnhancedState | null;
}
//# sourceMappingURL=ui-controller.d.ts.map