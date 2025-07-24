// Progress UI component for SuperGrader
// Handles progress tracking and display during grading operations

export interface ProgressStage {
  progress: number;
  text: string;
}

export type ProgressMessageType = 'success' | 'error' | 'info' | 'warning';

export class Progress {
  private progressElement: HTMLElement | null = null;
  private progressFill: HTMLElement | null = null;
  private progressText: HTMLElement | null = null;
  private currentProgress: number = 0;

  /**
   * Initialize progress component with DOM elements
   */
  initialize(progressElement: HTMLElement): void {
    this.progressElement = progressElement;
    this.progressFill = progressElement.querySelector('#progress-fill') as HTMLElement;
    this.progressText = progressElement.querySelector('#progress-text') as HTMLElement;
    
    if (!this.progressFill || !this.progressText) {
      console.error('Progress: Required progress elements not found');
    }
  }

  /**
   * Show progress with initial message
   */
  show(message: string = 'Initializing...', progress: number = 0): void {
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
  hide(): void {
    if (!this.progressElement) return;

    this.progressElement.style.display = 'none';
    this.currentProgress = 0;
    console.log('Progress: Hidden');
  }

  /**
   * Update progress value and text
   */
  update(progress: number, text?: string): void {
    if (!this.progressFill || !this.progressText) return;

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
  updateStage(currentStage: number, totalStages: number, stageText: string): void {
    const stageProgress = (currentStage / totalStages) * 100;
    this.update(stageProgress, stageText);
  }

  /**
   * Animate progress to completion
   */
  complete(finalMessage: string = 'Completed!'): Promise<void> {
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
  showError(errorMessage: string): void {
    if (!this.progressText || !this.progressFill) return;

    this.progressText.textContent = `❌ ${errorMessage}`;
    this.progressFill.style.backgroundColor = '#dc3545';
    console.log('Progress: Error state shown');
  }

  /**
   * Reset progress to initial state
   */
  reset(): void {
    if (!this.progressFill || !this.progressText) return;

    this.currentProgress = 0;
    this.progressFill.style.width = '0%';
    this.progressFill.style.backgroundColor = ''; // Reset to default color
    this.progressText.textContent = 'Initializing...';
    console.log('Progress: Reset to initial state');
  }

  /**
   * Get current progress value
   */
  getCurrentProgress(): number {
    return this.currentProgress;
  }

  /**
   * Check if progress is currently visible
   */
  isVisible(): boolean {
    return this.progressElement?.style.display !== 'none';
  }

  /**
   * Set progress bar color theme
   */
  setTheme(color: string): void {
    if (!this.progressFill) return;

    this.progressFill.style.backgroundColor = color;
  }

  /**
   * Create a progress stage tracker for complex operations
   */
  createStageTracker(stages: string[]): {
    nextStage: (customText?: string) => void;
    setStage: (stage: number, customText?: string) => void;
    complete: () => Promise<void>;
  } {
    let currentStage = 0;

    return {
      nextStage: (customText?: string) => {
        if (currentStage < stages.length) {
          const stageText = customText || stages[currentStage];
          this.updateStage(currentStage + 1, stages.length, stageText);
          currentStage++;
        }
      },
      
      setStage: (stage: number, customText?: string) => {
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