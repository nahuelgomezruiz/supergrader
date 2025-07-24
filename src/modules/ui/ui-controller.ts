// Modular UI Controller for SuperGrader
// Uses modular UI components for better maintainability

import { Panel, Progress, ErrorDisplay, StatusDisplay } from './index';
import type { 
  PanelElements, 
  EnhancedState, 
  AuthStatus,
  ErrorType
} from './index';

export class ModularUIController {
  private isInitialized: boolean = false;
  private state: EnhancedState | null = null;
  private injectionPoint: Element | null = null;

  // UI Components
  private panel: Panel;
  private progress: Progress;
  private errorDisplay: ErrorDisplay;
  private statusDisplay: StatusDisplay;
  
  // Panel elements reference
  private panelElements: PanelElements | null = null;

  constructor() {
    this.panel = new Panel();
    this.progress = new Progress();
    this.errorDisplay = new ErrorDisplay();
    this.statusDisplay = new StatusDisplay();
  }

  /**
   * Initialize the modular UI with enhanced state
   */
  initialize(enhancedState: EnhancedState): void {
    console.log('ModularUIController: Initializing with enhanced state...', enhancedState);
    
    if (this.isInitialized) {
      console.log('ModularUIController: Already initialized, updating state');
      this.state = enhancedState;
      return;
    }

    try {
      // Store state and injection point
      this.state = enhancedState;
      this.injectionPoint = enhancedState.injectionPoint || null;
      
      // Validate injection point
      if (!this.injectionPoint || !this.injectionPoint.parentNode) {
        console.error('ModularUIController: Invalid injection point provided');
        this.findFallbackInjectionPoint();
      }

      // Create and setup the UI
      this.createUI();
      this.setupEventListeners();
      this.initializeComponents();
      
      this.isInitialized = true;
      console.log('ModularUIController: Enhanced UI initialized successfully');
    } catch (error) {
      console.error('ModularUIController: Failed to initialize enhanced UI', error);
      this.handleInitializationError(error as Error);
    }
  }

  /**
   * Create the main UI using modular components
   */
  private createUI(): void {
    console.log('ModularUIController: Creating modular UI...');
    
    if (!this.injectionPoint) {
      throw new Error('No injection point available');
    }

    // Create panel with configuration
    const panelConfig = {
      assignmentType: this.state?.assignmentType ?? null,
      assignmentId: this.state?.assignmentId ?? null,
      submissionId: this.state?.submissionId ?? null
    };

    this.panelElements = this.panel.create(panelConfig);
    
    // Insert panel into DOM
    this.panel.insertSafely(this.injectionPoint);
  }

  /**
   * Initialize all UI components with their DOM elements
   */
  private initializeComponents(): void {
    if (!this.panelElements) {
      throw new Error('Panel elements not available');
    }

    // Initialize progress component
    this.progress.initialize(this.panelElements.progress);

    // Initialize error display component
    this.errorDisplay.initialize(this.panelElements.errors);

    // Initialize status display component
    const statusContainer = this.panelElements.panel.querySelector('#ai-connection-status') as HTMLElement;
    if (statusContainer) {
      this.statusDisplay.initialize(statusContainer);
      this.updateConnectionStatus();
    }

    console.log('ModularUIController: All components initialized');
  }

  /**
   * Setup event listeners for UI interactions
   */
  private setupEventListeners(): void {
    console.log('ModularUIController: Setting up event listeners...');
    
    if (!this.panelElements) return;

    try {
      // Grade button
      const gradeButton = this.panelElements.panel.querySelector('#ai-grade-button') as HTMLButtonElement;
      if (gradeButton) {
        gradeButton.addEventListener('click', async () => {
          try {
            await this.startEnhancedGrading();
          } catch (error) {
            console.error('ModularUIController: Error starting grading', error);
            this.errorDisplay.showError('Failed to start grading process');
          }
        });
      }

      // Show rubric data button
      const showDataBtn = this.panelElements.panel.querySelector('#ai-show-data-button') as HTMLButtonElement;
      if (showDataBtn) {
        showDataBtn.addEventListener('click', () => {
          try {
            console.log('🔍 ModularUIController: Show rubric data button clicked');
            this.showRubricData();
          } catch (error) {
            console.error('ModularUIController: Error showing rubric data', error);
            this.errorDisplay.showError('Failed to show rubric data');
          }
        });
      }

      // Radio diagnostics button
      const radioDiagBtn = this.panelElements.panel.querySelector('#ai-radio-diag-button') as HTMLButtonElement;
      if (radioDiagBtn) {
        radioDiagBtn.addEventListener('click', () => {
          try {
            console.log('🎛 ModularUIController: Radio diagnostics button clicked');
            this.showRadioDiagnostics();
          } catch (error) {
            console.error('ModularUIController: Error showing radio diagnostics', error);
            this.errorDisplay.showError('Failed to show radio diagnostics');
          }
        });
      }
    } catch (error) {
      console.error('ModularUIController: Error setting up event listeners', error);
    }
  }

  /**
   * Enhanced grading process with modular UI components
   */
  private async startEnhancedGrading(): Promise<void> {
    console.log('ModularUIController: Starting enhanced grading process...');
    
    if (!this.panelElements) return;

    const button = this.panelElements.panel.querySelector('#ai-grade-button') as HTMLButtonElement;
    
    if (!button) {
      console.error('ModularUIController: Grade button not found');
      return;
    }
    
    // Update UI state
    button.disabled = true;
    button.textContent = 'Initializing...';
    this.progress.show('Initializing...', 0);
    this.errorDisplay.hide();
    
    try {
      // Get backend URL from storage or use default
      const settings = await chrome.storage.sync.get(['backendUrl']);
      const backendUrl = settings.backendUrl || 'http://localhost:8000';
      
      console.log('ModularUIController: Using backend URL:', backendUrl);
      
      // Use the standalone grading service
      const ChromeGradingService = (window as any).ChromeGradingService;
      if (!ChromeGradingService) {
        throw new Error('ChromeGradingService not loaded');
      }
      
      // Create grading service
      const gradingService = new ChromeGradingService(backendUrl);
      
      // Update progress
      this.progress.update(5, 'Extracting rubric structure...');
      
      // Start grading with progress callback
      await gradingService.gradeSubmission((event: any) => {
        console.log('ModularUIController: Grading event', event);
        
        if (event.type === 'partial_result') {
          const progressPercent = (event.progress || 0) * 100;
          this.progress.update(progressPercent, `Processing ${event.rubric_item_id || 'item'}...`);
          
          if (event.decision) {
            const confidence = `${(event.decision.confidence * 100).toFixed(1)}%`;
            this.errorDisplay.showInfo(
              `✅ ${event.rubric_item_id}: ${confidence} confidence`, 
              true
            );
          }
        } else if (event.type === 'job_complete') {
          this.progress.complete('Grading completed successfully!');
          this.errorDisplay.showSuccess('🎉 AI grading completed successfully!', true);
        } else if (event.type === 'error') {
          this.progress.showError('Grading failed');
          this.errorDisplay.showError(`❌ ${event.error || 'Unknown error occurred'}`);
        }
      });
      
      console.log('ModularUIController: Grading process completed');
      
    } catch (error) {
      console.error('ModularUIController: Error during grading:', error);
      this.progress.showError('Grading failed');
      this.errorDisplay.showError(`Failed to complete grading: ${(error as Error).message}`);
    } finally {
      // Reset button state
      button.disabled = false;
      button.textContent = 'Start AI Grading';
    }
  }

  /**
   * Show rubric data using existing functionality
   */
  private showRubricData(): void {
    // Use existing global function if available
    const showRubricData = (window as any).supergrader?.showRubricData;
    if (showRubricData) {
      showRubricData();
      this.errorDisplay.showInfo('📊 Rubric data displayed in console', true);
    } else {
      this.errorDisplay.showError('Rubric data function not available');
    }
  }

  /**
   * Show radio button diagnostics
   */
  private showRadioDiagnostics(): void {
    // Use existing global function if available
    const showRadioDiag = (window as any).showRadioDiag;
    if (showRadioDiag) {
      showRadioDiag();
      this.errorDisplay.showInfo('🎛 Radio diagnostics displayed in console', true);
    } else {
      this.errorDisplay.showError('Radio diagnostics function not available');
    }
  }

  /**
   * Update connection status display
   */
  private updateConnectionStatus(): void {
    // Check authentication status after a brief delay to allow API initialization
    setTimeout(() => {
      try {
        const gradescopeAPI = (window as any).GradescopeAPI;
        if (gradescopeAPI && typeof gradescopeAPI.isAuthenticated === 'function') {
          const isAuth = gradescopeAPI.isAuthenticated();
          const authStatus = gradescopeAPI.getAuthStatus();
          
          this.statusDisplay.updateAuthStatus(authStatus);
          
          // Add debug info if available
          if (authStatus) {
            this.statusDisplay.addAuthDebugInfo(authStatus);
          }
        } else {
          this.statusDisplay.showError('API Error', 'GradescopeAPI not available');
        }
      } catch (error) {
        this.statusDisplay.showError('Status Error', (error as Error).message);
      }
    }, 1500);
  }

  /**
   * Find fallback injection point if provided one fails
   */
  private findFallbackInjectionPoint(): void {
    console.log('ModularUIController: Finding fallback injection point...');
    
    const fallbackSelectors = [
      '.rubric-container',
      '.question-content', 
      '.grading-interface',
      'main',
      'body'
    ];
    
    for (const selector of fallbackSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`ModularUIController: Using fallback injection point: ${selector}`);
        this.injectionPoint = element;
        return;
      }
    }
    
    console.error('ModularUIController: No fallback injection point found');
    this.injectionPoint = document.body;
  }

  /**
   * Handle initialization errors
   */
  private handleInitializationError(error: Error): void {
    console.error('ModularUIController: Initialization error handler called', error);
    
    // Create a minimal error panel
    const errorPanel = document.createElement('div');
    errorPanel.className = 'ai-error-panel';
    errorPanel.innerHTML = `
      <div class="error-content">
        🚨 supergrader initialization failed: ${error.message}
        <button onclick="location.reload()">Reload Page</button>
      </div>
    `;
    
    try {
      document.body.appendChild(errorPanel);
    } catch (e) {
      console.error('ModularUIController: Could not even create error panel', e);
    }
  }

  /**
   * Public API methods for external access
   */
  
  public showError(message: string, type: ErrorType = 'error'): void {
    this.errorDisplay.showError(message, type);
  }

  public showSuccess(message: string): void {
    this.errorDisplay.showSuccess(message);
  }

  public showProgress(message: string, progress: number = 0): void {
    this.progress.show(message, progress);
  }

  public hideProgress(): void {
    this.progress.hide();
  }

  public updateProgress(progress: number, message?: string): void {
    this.progress.update(progress, message);
  }

  public getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  public getState(): EnhancedState | null {
    return this.state;
  }
} 