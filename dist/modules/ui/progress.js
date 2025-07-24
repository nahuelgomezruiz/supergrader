// Progress UI component for SuperGrader
// Handles progress tracking and display during grading operations
export class Progress {
    constructor() {
        this.progressElement = null;
        this.progressFill = null;
        this.progressText = null;
        this.currentProgress = 0;
    }
    /**
     * Initialize progress component with DOM elements
     */
    initialize(progressElement) {
        this.progressElement = progressElement;
        this.progressFill = progressElement.querySelector('#progress-fill');
        this.progressText = progressElement.querySelector('#progress-text');
        if (!this.progressFill || !this.progressText) {
            console.error('Progress: Required progress elements not found');
        }
    }
    /**
     * Show progress with initial message
     */
    show(message = 'Initializing...', progress = 0) {
        if (!this.progressElement) {
            console.error('Progress: Not initialized');
            return;
        }
        this.progressElement.style.display = 'block';
        this.update(progress, message);
        console.log('Progress: Shown');
    }
    /**
     * Hide progress display
     */
    hide() {
        if (!this.progressElement)
            return;
        this.progressElement.style.display = 'none';
        this.currentProgress = 0;
        console.log('Progress: Hidden');
    }
    /**
     * Update progress value and text
     */
    update(progress, text) {
        if (!this.progressFill || !this.progressText)
            return;
        // Clamp progress between 0 and 100
        this.currentProgress = Math.max(0, Math.min(100, progress));
        this.progressFill.style.width = `${this.currentProgress}%`;
        if (text) {
            this.progressText.textContent = text;
        }
        console.log(`Progress: Updated to ${this.currentProgress}%`, text || '');
    }
    /**
     * Update progress for multi-stage operations
     */
    updateStage(currentStage, totalStages, stageText) {
        const stageProgress = (currentStage / totalStages) * 100;
        this.update(stageProgress, stageText);
    }
    /**
     * Animate progress to completion
     */
    complete(finalMessage = 'Completed!') {
        return new Promise((resolve) => {
            if (!this.progressFill || !this.progressText) {
                resolve();
                return;
            }
            // Animate to 100%
            this.update(100, finalMessage);
            // Wait a moment then hide
            setTimeout(() => {
                this.hide();
                resolve();
            }, 1500);
        });
    }
    /**
     * Show error state in progress
     */
    showError(errorMessage) {
        if (!this.progressText || !this.progressFill)
            return;
        this.progressText.textContent = `❌ ${errorMessage}`;
        this.progressFill.style.backgroundColor = '#dc3545';
        console.log('Progress: Error state shown');
    }
    /**
     * Reset progress to initial state
     */
    reset() {
        if (!this.progressFill || !this.progressText)
            return;
        this.currentProgress = 0;
        this.progressFill.style.width = '0%';
        this.progressFill.style.backgroundColor = ''; // Reset to default color
        this.progressText.textContent = 'Initializing...';
        console.log('Progress: Reset to initial state');
    }
    /**
     * Get current progress value
     */
    getCurrentProgress() {
        return this.currentProgress;
    }
    /**
     * Check if progress is currently visible
     */
    isVisible() {
        return this.progressElement?.style.display !== 'none';
    }
    /**
     * Set progress bar color theme
     */
    setTheme(color) {
        if (!this.progressFill)
            return;
        this.progressFill.style.backgroundColor = color;
    }
    /**
     * Create a progress stage tracker for complex operations
     */
    createStageTracker(stages) {
        let currentStage = 0;
        return {
            nextStage: (customText) => {
                if (currentStage < stages.length) {
                    const stageText = customText || stages[currentStage];
                    this.updateStage(currentStage + 1, stages.length, stageText);
                    currentStage++;
                }
            },
            setStage: (stage, customText) => {
                if (stage >= 0 && stage < stages.length) {
                    const stageText = customText || stages[stage];
                    this.updateStage(stage + 1, stages.length, stageText);
                    currentStage = stage;
                }
            },
            complete: () => this.complete('All stages completed!')
        };
    }
}
//# sourceMappingURL=progress.js.map