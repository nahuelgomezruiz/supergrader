// UI Controller module
// Manages the user interface elements and interactions

console.log('supergrader: UI Controller loaded');

// Type definitions for UI Controller
interface EnhancedState {
  courseId: string | null;
  assignmentId: string | null;
  submissionId: string | null;
  assignmentType: 'assignments' | 'questions' | null;
  isInitialized: boolean;
  retryCount: number;
  domReady: boolean;
  injectionPoint?: Element | null;
  rubricData?: any;
  sourceCode?: Record<string, string>;
  pageMetadata?: PageMetadata;
}

interface PageMetadata {
  assignmentName?: string;
  courseName?: string;
  studentId?: string;
  submissionTime?: string;
}

interface ProgressStage {
  progress: number;
  text: string;
}

interface AuthStatus {
  isAuthenticated: boolean;
  csrfTokenValid: boolean;
  sessionValid: boolean;
  lastValidated: number | null;
  retryCount: number;
  maxRetries: number;
  csrfToken: string | null;
  rateLimiter: {
    currentRequests: number;
    recentRequests: number;
  };
}

// Window interface extensions
interface WindowWithUIExtensions extends Window {
  UIController: UIController;
  GradescopeAPI?: {
    isAuthenticated(): boolean;
    getAuthStatus(): AuthStatus;
    initialize(): Promise<boolean>;
    authState?: any;
  };
}

/**
 * UI Controller class with enhanced injection and error handling
 */
class UIController {
  private isInitialized: boolean = false;
  private aiPanel: HTMLElement | null = null;
  private injectionPoint: Element | null = null;
  private state: EnhancedState | null = null;
  private currentUrl: string = '';
  private urlChangeObserver: MutationObserver | null = null;

  /**
   * Initialize the UI components with enhanced state and injection point
   */
  initialize(enhancedState: EnhancedState): void {
    console.log('UIController: Initializing with enhanced state...', enhancedState);
    
    if (this.isInitialized) {
      console.log('UIController: Already initialized, updating state');
      this.state = enhancedState;
      return;
    }

    try {
      // Store state and injection point
      this.state = enhancedState;
      this.injectionPoint = enhancedState.injectionPoint || null;
      
      // Validate injection point
      if (!this.injectionPoint || !this.injectionPoint.parentNode) {
        console.error('UIController: Invalid injection point provided');
        this.findFallbackInjectionPoint();
      }
      
      this.isInitialized = true;
      console.log('UIController: Enhanced UI initialized successfully');
      
      // Set up URL change monitoring
      this.setupUrlChangeDetection();
      
      // Automatically start grading instead of showing the popup
      console.log('UIController: Starting automatic grading...');
      setTimeout(() => {
        this.startEnhancedGrading().catch(error => {
          console.error('UIController: Auto-grading failed:', error);
        });
      }, 1000); // Small delay to ensure everything is ready
      
    } catch (error) {
      console.error('UIController: Failed to initialize enhanced UI', error);
      this.handleInitializationError(error as Error);
    }
  }

  /**
   * Set up URL change detection to handle section navigation
   */
  private setupUrlChangeDetection(): void {
    console.log('UIController: Setting up URL change detection...');
    
    // Store current URL
    this.currentUrl = window.location.href;
    console.log('UIController: Initial URL:', this.currentUrl);
    
    // Method 1: Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', () => {
      this.handleUrlChange();
    });
    
    // Method 2: Monitor URL changes via MutationObserver on document
    this.urlChangeObserver = new MutationObserver(() => {
      if (window.location.href !== this.currentUrl) {
        this.handleUrlChange();
      }
    });
    
    this.urlChangeObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Method 3: Periodic URL check as fallback
    setInterval(() => {
      if (window.location.href !== this.currentUrl) {
        this.handleUrlChange();
      }
    }, 1000);
    
    console.log('UIController: URL change detection set up successfully');
  }

  /**
   * Handle URL changes - clear previous suggestions and re-grade
   */
  private handleUrlChange(): void {
    const newUrl = window.location.href;
    console.log('UIController: URL changed from', this.currentUrl, 'to', newUrl);
    
    // Check if we're navigating to a different submission (need to clear file cache)
    const oldSubmissionMatch = this.currentUrl.match(/\/courses\/(\d+)\/(assignments|questions)\/(\d+)\/submissions\/(\d+)\/grade/);
    const newSubmissionMatch = newUrl.match(/\/courses\/(\d+)\/(assignments|questions)\/(\d+)\/submissions\/(\d+)\/grade/);
    
    // Calculate differences in question and submission IDs (if both URLs match the pattern)
    let questionIdDiff = 0;
    let submissionIdDiff = 0;
    
    if (oldSubmissionMatch && newSubmissionMatch) {
      questionIdDiff = Math.abs(parseInt(oldSubmissionMatch[3]) - parseInt(newSubmissionMatch[3]));
      submissionIdDiff = Math.abs(parseInt(oldSubmissionMatch[4]) - parseInt(newSubmissionMatch[4]));
    }
    
    const isDifferentSubmission = !oldSubmissionMatch || !newSubmissionMatch || 
      oldSubmissionMatch[1] !== newSubmissionMatch[1] || // different course
      questionIdDiff > 4 ||                              // question IDs too far apart
      submissionIdDiff > 4;                              // submission IDs too far apart
      // Note: Both question and submission IDs increment together for same assignment
    
    if (isDifferentSubmission) {
      console.log('🔄 Different submission detected - will clear file cache');
      console.log(`   Question ID diff: ${questionIdDiff}, Submission ID diff: ${submissionIdDiff}`);
      // Clear file cache when navigating to different submission
      const gradingServiceInstance = (window as any).chromeGradingServiceInstance;
      if (gradingServiceInstance && gradingServiceInstance.clearFileCache) {
        gradingServiceInstance.clearFileCache();
      }
    } else {
      console.log('📄 Same submission, different question section - using cached files');
      console.log(`   Question ID diff: ${questionIdDiff}, Submission ID diff: ${submissionIdDiff}`);
    }
    
    // Update stored URL
    this.currentUrl = newUrl;
    
    // Clear any existing feedback suggestions
    this.clearPreviousSuggestions();
    
    // Wait for the new DOM content to be ready, then re-grade
    setTimeout(async () => {
      console.log('UIController: Re-starting grading for new section...');
      
      // Wait for DOM to be ready with rubric elements
      await this.waitForRubricDOM();
      
      this.startEnhancedGrading().catch(error => {
        console.error('UIController: Re-grading failed after URL change:', error);
      });
    }, 1500); // Initial delay for page transition
  }

  /**
   * Clear all previous grading suggestions from the DOM
   */
  private clearPreviousSuggestions(): void {
    console.log('UIController: Clearing previous suggestions...');
    
    try {
      // Use the global instance if available
      const gradingServiceInstance = (window as any).chromeGradingServiceInstance;
      if (gradingServiceInstance && gradingServiceInstance.feedbackUI) {
        console.log('UIController: Clearing via global instance feedbackUI.clearAllSuggestions()');
        gradingServiceInstance.feedbackUI.clearAllSuggestions();
      }
      
      // Fallback: manually remove all feedback boxes
      const feedbackBoxes = document.querySelectorAll('.supergrader-feedback-box');
      console.log(`UIController: Found ${feedbackBoxes.length} feedback boxes to remove`);
      feedbackBoxes.forEach(box => box.remove());
      
    } catch (error) {
      console.error('UIController: Error clearing previous suggestions:', error);
    }
  }

  /**
   * Cleanup URL change detection
   */
  private cleanupUrlDetection(): void {
    if (this.urlChangeObserver) {
      this.urlChangeObserver.disconnect();
      this.urlChangeObserver = null;
    }
  }

  /**
   * Find fallback injection point if provided one fails
   */
  private findFallbackInjectionPoint(): void {
    console.log('UIController: Finding fallback injection point...');
    
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
        console.log(`UIController: Using fallback injection point: ${selector}`);
        this.injectionPoint = element;
        return;
      }
    }
    
    console.error('UIController: No fallback injection point found');
    this.injectionPoint = document.body;
  }

  /**
   * Create the main AI grading panel with enhanced features
   * NOTE: Disabled for automatic grading mode
   */
  private createAIPanel(): void {
    /*
    console.log('UIController: Creating enhanced AI grading panel...');
    
    if (!this.injectionPoint) {
      console.error('UIController: No injection point available');
      return;
    }

    // Remove any existing panel
    const existingPanel = document.getElementById('ai-gradescope-panel');
    if (existingPanel) {
      existingPanel.remove();
      console.log('UIController: Removed existing panel');
    }

    // Create the AI panel with enhanced content
    this.aiPanel = document.createElement('div');
    this.aiPanel.id = 'ai-gradescope-panel';
    this.aiPanel.className = 'ai-grading-panel';
    */
    
    console.log('UIController: Panel creation disabled - using automatic grading mode');
  }

  /**
   * Safely insert panel into DOM with multiple strategies
   */
  private insertPanelSafely(): void {
    if (!this.aiPanel || !this.injectionPoint) return;

    try {
      // Strategy 1: Insert before injection point
      if (this.injectionPoint.parentNode) {
        this.injectionPoint.parentNode.insertBefore(this.aiPanel, this.injectionPoint);
        console.log('UIController: Panel inserted before injection point');
        return;
      }
      
      // Strategy 2: Insert as first child of injection point
      if (this.injectionPoint.children.length > 0) {
        this.injectionPoint.insertBefore(this.aiPanel, this.injectionPoint.firstChild);
        console.log('UIController: Panel inserted as first child');
        return;
      }
      
      // Strategy 3: Append to injection point
      this.injectionPoint.appendChild(this.aiPanel);
      console.log('UIController: Panel appended to injection point');
      
    } catch (error) {
      console.error('UIController: Failed to insert panel safely', error);
      // Final fallback - append to body
      document.body.appendChild(this.aiPanel);
      console.log('UIController: Panel appended to body as fallback');
    }
  }

  /**
   * Set up enhanced event listeners for the AI panel
   * NOTE: Disabled for automatic grading mode
   */
  private setupEnhancedEventListeners(): void {
    /*
    console.log('UIController: Setting up enhanced event listeners...');
    
    if (!this.aiPanel) {
      console.error('UIController: Cannot set up event listeners - panel not found');
      return;
    }

    try {
      // Panel toggle functionality
      const toggleButton = this.aiPanel.querySelector('.ai-panel-toggle') as HTMLButtonElement;
      if (toggleButton) {
        toggleButton.addEventListener('click', () => {
          try {
            this.togglePanel();
          } catch (error) {
            console.error('UIController: Error toggling panel', error);
          }
        });
      }

      // Grade button with enhanced functionality
      const gradeButton = this.aiPanel.querySelector('#ai-grade-button') as HTMLButtonElement;
      if (gradeButton) {
        gradeButton.addEventListener('click', async () => {
          try {
            await this.startEnhancedGrading();
          } catch (error) {
            console.error('UIController: Error starting grading', error);
            this.showError('Failed to start grading process');
          }
        });
      }

      // Show rubric data button
      const showDataBtn = this.aiPanel.querySelector('#ai-show-data-button') as HTMLButtonElement;
      if (showDataBtn) {
        showDataBtn.addEventListener('click', () => {
          try {
            console.log('🔍 UIController: Show rubric data button clicked');
            this.showRubricData();
          } catch (error) {
            console.error('UIController: Error showing rubric data', error);
            this.showError('Failed to show rubric data');
          }
        });
      }

      const radioDiagBtn = this.aiPanel.querySelector('#ai-radio-diag-button') as HTMLButtonElement;
      if (radioDiagBtn) {
        radioDiagBtn.addEventListener('click', () => {
          if (typeof (window as any).showRadioDiag === 'function') {
            (window as any).showRadioDiag();
          } else {
            this.showError('Radio diagnostic unavailable', 'info');
          }
        });
      }

      // Preview mode checkbox
      const previewCheckbox = this.aiPanel.querySelector('#ai-preview-mode') as HTMLInputElement;
      if (previewCheckbox) {
        previewCheckbox.addEventListener('change', (e: Event) => {
          const target = e.target as HTMLInputElement;
          console.log('UIController: Preview mode toggled', target.checked);
          // Store preference
          if (chrome.storage) {
            chrome.storage.sync.set({ previewMode: target.checked });
          }
        });
      }
      
      console.log('UIController: Enhanced event listeners set up successfully');
    } catch (error) {
      console.error('UIController: Failed to set up event listeners', error);
    }
    */
    
    console.log('UIController: Event listeners disabled - using automatic grading mode');
  }

  /**
   * Wait for the rubric DOM elements to be ready
   */
  private async waitForRubricDOM(): Promise<void> {
    console.log('UIController: Waiting for rubric DOM to be ready...');
    
    const maxRetries = 20; // 10 seconds max
    const delay = 500; // 500ms between checks
    
    for (let i = 0; i < maxRetries; i++) {
      // Check if rubric elements are present
      const rubricItems = document.querySelectorAll('.rubricItem, .rubricItemGroup');
      const gradingPanel = document.querySelector('[data-react-class*="Grade"]');
      
      if (rubricItems.length > 0 && gradingPanel) {
        console.log(`UIController: Rubric DOM ready (${rubricItems.length} items found)`);
        return;
      }
      
      console.log(`UIController: Waiting for rubric DOM... (attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    console.warn('UIController: Rubric DOM not ready after maximum wait time');
  }

  /**
   * Enhanced grading process with backend integration
   */
  private async startEnhancedGrading(): Promise<void> {
    console.log('UIController: Starting automatic grading process...');

    try {
      // Wait for ChromeGradingService to be available with retry mechanism
      const ChromeGradingService = await this.waitForGradingService();
      if (!ChromeGradingService) {
        throw new Error('ChromeGradingService failed to load after retries');
      }

      // Reuse existing instance to preserve cache, or create new one
      let gradingService = (window as any).chromeGradingServiceInstance;
      if (!gradingService) {
        console.log('UIController: Creating new ChromeGradingService instance');
        gradingService = new ChromeGradingService();
        (window as any).chromeGradingServiceInstance = gradingService;
      } else {
        console.log('UIController: Reusing existing ChromeGradingService instance (preserves cache)');
      }

      console.log('UIController: Starting automatic grading...');

      // Start grading with progress tracking
      await gradingService.gradeSubmission((event: any) => {
        console.log('UIController: Grading event:', event);
        
        if (event.type === 'partial_result') {
          console.log(`UIController: Graded item ${event.rubric_item_id} with ${(event.decision?.confidence * 100).toFixed(1)}% confidence`);
        } else if (event.type === 'job_complete') {
          console.log('UIController: Automatic grading completed successfully!');
        } else if (event.type === 'error') {
          throw new Error(event.error || 'Unknown grading error');
        }
      });

    } catch (error) {
      console.error('UIController: Automatic grading error', error);
      // Could show a minimal error notification here if needed
    }
  }

  /**
   * Wait for ChromeGradingService to be available with retry mechanism
   */
  private async waitForGradingService(maxRetries: number = 10, delayMs: number = 500): Promise<any> {
    console.log('UIController: Starting to wait for ChromeGradingService...');
    console.log('UIController: Current window object keys:', Object.keys(window).filter(k => k.includes('Chrome') || k.includes('Grading')));
    
    for (let i = 0; i < maxRetries; i++) {
      const ChromeGradingService = (window as any).ChromeGradingService;
      console.log(`UIController: Retry ${i + 1}/${maxRetries} - ChromeGradingService:`, typeof ChromeGradingService);
      
      if (ChromeGradingService) {
        console.log(`UIController: ChromeGradingService found after ${i} retries`);
        console.log('UIController: ChromeGradingService type:', typeof ChromeGradingService);
        console.log('UIController: ChromeGradingService constructor:', ChromeGradingService.constructor?.name);
        return ChromeGradingService;
      }
      
      console.log(`UIController: ChromeGradingService not found, retry ${i + 1}/${maxRetries}`);
      console.log('UIController: Available window properties:', Object.keys(window).filter(k => k.toLowerCase().includes('grading')));
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    console.error('UIController: ChromeGradingService failed to load after all retries');
    console.error('UIController: Final window object keys:', Object.keys(window).filter(k => k.includes('Chrome') || k.includes('Grading')));
    return null;
  }

  /**
   * Complete the grading process and reset UI
   */
  private completeGrading(button: HTMLButtonElement, progress: HTMLElement): void {
    console.log('UIController: Grading process completed');
    
    button.disabled = false;
    button.textContent = 'Start AI Grading';
    progress.style.display = 'none';
    
    // Reset progress bar
    const progressFill = this.aiPanel?.querySelector('#progress-fill') as HTMLElement;
    if (progressFill) {
      progressFill.style.width = '0%';
    }
    
    // Could trigger notification or other completion actions here
  }

  /**
   * Update connection status indicator with authentication status
   */
  private updateConnectionStatus(): void {
    if (!this.aiPanel) return;

    const statusContainer = this.aiPanel.querySelector('#ai-connection-status') as HTMLElement;
    const statusText = statusContainer?.querySelector('.status-text') as HTMLElement;
    
    if (!statusContainer) return;
    
    // Check authentication status
    setTimeout(() => {
      if ((window as any).GradescopeAPI && typeof (window as any).GradescopeAPI.isAuthenticated === 'function') {
        const isAuth = (window as any).GradescopeAPI.isAuthenticated();
        const authStatus = (window as any).GradescopeAPI.getAuthStatus();
        
        if (isAuth && authStatus.csrfTokenValid) {
          statusContainer.className = 'ai-connection-status connected';
          statusText.textContent = 'Authenticated';
          console.log('UIController: Authentication status - connected');
        } else if (authStatus.csrfTokenValid) {
          statusContainer.className = 'ai-connection-status warning';
          statusText.textContent = 'Partial Auth';
          console.log('UIController: Authentication status - partial');
        } else {
          statusContainer.className = 'ai-connection-status error';
          statusText.textContent = 'Auth Failed';
          console.log('UIController: Authentication status - failed');
        }
        
        // Add debug info to panel if needed
        this.addAuthDebugInfo(authStatus);
        
      } else {
        statusContainer.className = 'ai-connection-status error';
        statusText.textContent = 'API Error';
        console.log('UIController: GradescopeAPI not available');
      }
    }, 1500);
  }

  /**
   * Toggle panel visibility with animation
   */
  private togglePanel(): void {
    if (!this.aiPanel) return;

    const content = this.aiPanel.querySelector('.ai-panel-content') as HTMLElement;
    const toggle = this.aiPanel.querySelector('.ai-panel-toggle') as HTMLButtonElement;
    
    if (!content || !toggle) return;
    
    if (content.style.display === 'none') {
      content.style.display = 'block';
      toggle.textContent = '−';
      toggle.setAttribute('title', 'Collapse panel');
      console.log('UIController: Panel expanded');
    } else {
      content.style.display = 'none';
      toggle.textContent = '+';
      toggle.setAttribute('title', 'Expand panel');
      console.log('UIController: Panel collapsed');
    }
  }

  /**
   * Show error or success message to user
   */
  showError(message: string, type: 'error' | 'success' | 'info' = 'error'): void {
    if (!this.aiPanel) return;

    const errorContainer = this.aiPanel.querySelector('#ai-errors') as HTMLElement;
    if (errorContainer) {
      let icon: string, className: string;
      
      switch (type) {
        case 'success':
          icon = '✅';
          className = 'success-message';
          break;
        case 'info':
          icon = 'ℹ️';
          className = 'info-message';
          break;
        default:
          icon = '⚠️';
          className = 'error-message';
      }
      
      errorContainer.innerHTML = `<div class="${className}">${icon} ${message}</div>`;
      errorContainer.style.display = 'block';
      console.log(`UIController: ${type} message shown to user:`, message);
    }
  }

  /**
   * Hide error messages
   */
  private hideError(): void {
    if (!this.aiPanel) return;

    const errorContainer = this.aiPanel.querySelector('#ai-errors') as HTMLElement;
    if (errorContainer) {
      errorContainer.style.display = 'none';
    }
  }

  /**
   * Handle initialization errors
   */
  private handleInitializationError(error: Error): void {
    console.error('UIController: Initialization error handler called', error);
    
    // Could create a minimal error panel
    const errorPanel = document.createElement('div');
    errorPanel.className = 'ai-error-panel';
    errorPanel.innerHTML = `
      <div class="error-content">
        🚨 supergrader initialization failed
        <button onclick="location.reload()">Reload Page</button>
      </div>
    `;
    
    try {
      document.body.appendChild(errorPanel);
    } catch (e) {
      console.error('UIController: Could not even create error panel', e);
    }
  }

  /**
   * Show uncertainty warning for specific rubric items
   */
  showUncertaintyWarning(uncertainItems: string[]): void {
    console.log('UIController: Showing uncertainty warning for items:', uncertainItems);
    // TODO: Implement uncertainty UI (Week 2+ feature)
  }

  /**
   * Update progress indicator with specific values
   */
  updateProgress(step: number, total: number, message: string): void {
    const progressFill = this.aiPanel?.querySelector('#progress-fill') as HTMLElement;
    const progressText = this.aiPanel?.querySelector('#progress-text') as HTMLElement;
    
    if (progressFill && progressText) {
      const percentage = Math.round((step / total) * 100);
      progressFill.style.width = `${percentage}%`;
      progressText.textContent = message;
      console.log(`UIController: Progress ${step}/${total} (${percentage}%) - ${message}`);
    }
  }

  /**
   * Show progress indicator with message and percentage
   */
  showProgress(message: string, percentage: number = 0): void {
    const progressContainer = this.aiPanel?.querySelector('#ai-progress') as HTMLElement;
    const progressFill = this.aiPanel?.querySelector('#progress-fill') as HTMLElement;
    const progressText = this.aiPanel?.querySelector('#progress-text') as HTMLElement;
    
    if (progressContainer && progressFill && progressText) {
      progressContainer.style.display = 'block';
      progressFill.style.width = `${percentage}%`;
      progressText.textContent = message;
      console.log(`UIController: Progress shown - ${message} (${percentage}%)`);
    }
  }

  /**
   * Hide progress indicator
   */
  hideProgress(): void {
    const progressContainer = this.aiPanel?.querySelector('#ai-progress') as HTMLElement;
    const progressFill = this.aiPanel?.querySelector('#progress-fill') as HTMLElement;
    
    if (progressContainer && progressFill) {
      progressContainer.style.display = 'none';
      progressFill.style.width = '0%';
      console.log('UIController: Progress hidden');
    }
  }

  /**
   * Add authentication debug information to the panel
   */
  private addAuthDebugInfo(authStatus: AuthStatus): void {
    // Only add debug info if there are issues or in development
    if (authStatus.isAuthenticated && authStatus.csrfTokenValid) {
      return; // All good, no debug needed
    }

    if (!this.aiPanel) return;

    let debugContainer = this.aiPanel.querySelector('#auth-debug-info') as HTMLElement;
    
    if (!debugContainer) {
      debugContainer = document.createElement('div');
      debugContainer.id = 'auth-debug-info';
      debugContainer.className = 'auth-debug-info';
      
      const content = this.aiPanel.querySelector('.ai-panel-content');
      if (content) {
        content.appendChild(debugContainer);
      }
    }

    debugContainer.innerHTML = `
      <div class="debug-header">🔧 Authentication Debug</div>
      <div class="debug-details">
        <div>CSRF Token: ${authStatus.csrfTokenValid ? '✅' : '❌'} ${authStatus.csrfToken || 'Missing'}</div>
        <div>Session Valid: ${authStatus.sessionValid ? '✅' : '❌'}</div>
        <div>Authenticated: ${authStatus.isAuthenticated ? '✅' : '❌'}</div>
        <div>Retry Count: ${authStatus.retryCount}/${authStatus.maxRetries}</div>
        ${authStatus.lastValidated ? `<div>Last Check: ${new Date(authStatus.lastValidated).toLocaleTimeString()}</div>` : ''}
      </div>
      <button class="auth-retry-btn" onclick="window.UIController.retryAuthentication()">Retry Authentication</button>
    `;

    console.log('UIController: Added authentication debug info', authStatus);
  }

  /**
   * Retry authentication when user clicks retry button
   */
  retryAuthentication(): void {
    console.log('UIController: User initiated authentication retry');
    
    if ((window as any).GradescopeAPI && typeof (window as any).GradescopeAPI.initialize === 'function') {
      // Reset retry count to allow new attempts
      if ((window as any).GradescopeAPI.authState) {
        (window as any).GradescopeAPI.authState.retryCount = 0;
      }
      
      // Show progress
      this.showError('Retrying authentication...');
      
      // Attempt re-authentication
      (window as any).GradescopeAPI.initialize()
        .then((success: boolean) => {
          if (success) {
            this.hideError();
            this.updateConnectionStatus();
            console.log('UIController: Authentication retry successful');
          } else {
            this.showError('Authentication retry failed. Please refresh the page.');
          }
        })
        .catch((error: Error) => {
          console.error('UIController: Authentication retry error:', error);
          this.showError('Authentication retry error: ' + error.message);
        });
    } else {
      this.showError('Cannot retry - API not available');
    }
  }

  /**
   * Test file download functionality (CSP-compliant)
   */
  private testFileDownload(): void {
    console.log('🔧 UIController: Starting file download test...');
    
    if (!this.state?.submissionId) {
      console.error('UIController: No submission ID available for testing');
      this.showError('No submission ID found for testing');
      return;
    }
    
    // Show progress
    this.showProgress('Testing file download...', 0);
    
    // Update test button state
    const testButton = this.aiPanel?.querySelector('#ai-test-button') as HTMLButtonElement;
    if (testButton) {
      testButton.disabled = true;
      testButton.textContent = '🔄 Testing...';
    }
    
    // Trigger the test via custom event (CSP-compliant)
    console.log('🔧 UIController: Dispatching test event for submission:', this.state.submissionId);
    window.dispatchEvent(new CustomEvent('SUPERGRADER_TEST_DOWNLOAD', {
      detail: { submissionId: this.state.submissionId }
    }));
    
    // Monitor for completion (check DOM for result)
    const checkResult = (): void => {
      const resultElement = document.getElementById('supergrader-test-result') as HTMLMetaElement;
      if (resultElement && resultElement.content) {
        try {
          const result = JSON.parse(resultElement.content);
          
          // Reset test button
          if (testButton) {
            testButton.disabled = false;
            testButton.textContent = '🔧 Test File Download';
          }
          
          if (result.success) {
            this.hideProgress();
            
            if (result.fileCount > 0) {
              const downloadMethod = result.metadata?.downloadMethod || 'ZIP';
              this.showError(`✅ Test successful! Found ${result.fileCount} files via ${downloadMethod} download. Check console for details.`, 'success');
            } else {
              // Handle non-programming submissions
              const message = result.metadata?.message || 'No files found';
              this.showError(`ℹ️ ${message}`, 'info');
              console.log('📋 Submission analysis:', result.metadata);
            }
            
            setTimeout(() => this.hideError(), 5000);
          } else {
            this.hideProgress();
            this.showError(`❌ Test failed: ${result.error}`);
          }
          
          // Clear the result
          resultElement.content = '';
          
        } catch (e) {
          console.error('UIController: Error parsing test result:', e);
        }
      } else {
        // Check again after a short delay
        setTimeout(checkResult, 1000);
      }
    };
    
    // Start monitoring after a brief delay
    setTimeout(checkResult, 2000);
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (testButton && testButton.disabled) {
        testButton.disabled = false;
        testButton.textContent = '🔧 Test File Download';
        this.hideProgress();
        this.showError('Test timeout - check console for details');
      }
    }, 30000);
  }

  /**
   * Test rubric parsing functionality (Week 2 Day 3-4: Rubric Parsing)
   */
  private testRubric(): void {
    console.log('📝 UIController: Starting rubric test...');
    
    // Show progress
    this.showProgress('Testing rubric parsing...', 0);
    
    // Update rubric button state
    const rubricButton = this.aiPanel?.querySelector('#ai-rubric-button') as HTMLButtonElement;
    if (rubricButton) {
      rubricButton.disabled = true;
      rubricButton.textContent = '🔄 Testing...';
    }
    
    // Trigger the test via custom event (CSP-compliant)
    console.log('📝 UIController: Dispatching rubric test event');
    window.dispatchEvent(new CustomEvent('SUPERGRADER_TEST_RUBRIC', {
      detail: { timestamp: Date.now() }
    }));
    
    // Monitor for completion (check DOM for result)
    const checkResult = (): void => {
      const resultElement = document.getElementById('supergrader-rubric-result') as HTMLMetaElement;
      if (resultElement && resultElement.content) {
        try {
          const result = JSON.parse(resultElement.content);
          
          // Reset rubric button
          if (rubricButton) {
            rubricButton.disabled = false;
            rubricButton.textContent = '📝 Test Rubric';
          }
          
          if (result.success) {
            this.hideProgress();
            
            if (result.questionCount > 0) {
              let message = '';
              
              if (result.extractionMethod === 'iframe-dom') {
                // Question page with iframe rubric
                message = `✅ Question rubric test successful! Found ${result.totalItems} rubric items (${result.rubricStyle}). ` +
                         `Points: ${result.pointsDistribution?.positive || 0}+ ${result.pointsDistribution?.negative || 0}- ${result.pointsDistribution?.zero || 0}=0. Check console for details.`;
              } else {
                // Traditional assignment rubric
                message = `✅ Assignment rubric test successful! Found ${result.questionCount} questions with ${result.totalItems} rubric items. ` +
                         `${result.parentChildRelationships || 0} parent-child relationships detected. Check console for details.`;
              }
              
              this.showError(message, 'success');
            } else if (result.interfaceType) {
              // Question-based or outline interface without rubric
              this.showError(`ℹ️ ${result.interfaceType} interface detected. ${result.message}`, 'info');
            } else {
              this.showError(`ℹ️ No rubric structure found on this page`, 'info');
            }
            
            setTimeout(() => this.hideError(), 10000); // Longer timeout for info messages
          } else {
            this.hideProgress();
            this.showError(`❌ Rubric test failed: ${result.error}`);
          }
          
          // Clear the result
          resultElement.content = '';
          
        } catch (e) {
          console.error('UIController: Error parsing rubric test result:', e);
        }
      } else {
        // Check again after a short delay
        setTimeout(checkResult, 1000);
      }
    };
    
    // Start monitoring after a brief delay
    setTimeout(checkResult, 2000);
    
    // Timeout after 15 seconds (rubric parsing should be faster than file downloads)
    setTimeout(() => {
      if (rubricButton && rubricButton.disabled) {
        rubricButton.disabled = false;
        rubricButton.textContent = '📝 Test Rubric';
        this.hideProgress();
        this.showError('Rubric test timeout - check console for details');
      }
    }, 15000);
  }

  /**
   * Comprehensive rubric test - tests all rubric parsing systems
   */
  private async testRubricComprehensive(): Promise<void> {
    console.log('🚀 UIController: Starting comprehensive rubric test...');
    
    // Show progress
    this.showProgress('Running comprehensive rubric tests...', 0);
    
    // Update button state
    const testButton = this.aiPanel?.querySelector('#ai-comprehensive-test-button') as HTMLButtonElement;
    if (testButton) {
      testButton.disabled = true;
      testButton.textContent = '🔄 Testing All Systems...';
    }
    
    const results: Array<{ test: string; status: 'success' | 'error' | 'info'; message: string; timing?: number }> = [];
    
    try {
      // Test 1: GradescopeAPI extractRubricStructure (newly implemented)
      this.updateProgress(1, 7, 'Testing GradescopeAPI.extractRubricStructure...');
      await this.delay(500);
      
      try {
        const startTime = performance.now();
        const api = (window as any).GradescopeAPI; // Use existing instance, not constructor
        if (!api || typeof api.extractRubricStructure !== 'function') {
          throw new Error('GradescopeAPI instance not available or missing extractRubricStructure method');
        }
        const apiResults = api.extractRubricStructure();
        const timing = Math.round(performance.now() - startTime);
        
        if (Array.isArray(apiResults) && apiResults.length > 0) {
          // Log the actual rubric data for verification
          console.log('📋 ACTUAL RUBRIC DATA from GradescopeAPI:');
          console.log('='.repeat(50));
          apiResults.forEach((item: any, index: number) => {
            console.log(`${index + 1}. ID: "${item.id}" | Points: ${item.points} | Selected: ${item.currentlySelected}`);
            console.log(`   Description: "${item.description}"`);
            console.log(`   Category: "${item.category}" | Style: "${item.rubricStyle}"`);
            if (item.element) {
              console.log(`   DOM Element: ${item.element.tagName} with class "${item.element.className}"`);
            }
            console.log('');
          });
          console.log('='.repeat(50));
          
          results.push({
            test: 'GradescopeAPI.extractRubricStructure',
            status: 'success',
            message: `✅ Found ${apiResults.length} rubric items (see console for details)`,
            timing
          });
        } else if (Array.isArray(apiResults) && apiResults.length === 0) {
          console.log('📋 GradescopeAPI found no rubric items - checking page type...');
          results.push({
            test: 'GradescopeAPI.extractRubricStructure',
            status: 'info',
            message: 'ℹ️ No rubric items found (manual scoring or no rubric)',
            timing
          });
        } else {
          results.push({
            test: 'GradescopeAPI.extractRubricStructure',
            status: 'error',
            message: '❌ Invalid response format',
            timing
          });
        }
      } catch (error) {
        console.log('Debug: window.GradescopeAPI:', (window as any).GradescopeAPI);
        console.log('Debug: typeof window.GradescopeAPI:', typeof (window as any).GradescopeAPI);
        if ((window as any).GradescopeAPI) {
          console.log('Debug: GradescopeAPI methods:', Object.getOwnPropertyNames(Object.getPrototypeOf((window as any).GradescopeAPI)));
        }
        results.push({
          test: 'GradescopeAPI.extractRubricStructure',
          status: 'error',
          message: `❌ Error: ${(error as Error).message}`
        });
      }
      
      // Test 2: Unified rubric system (getRubric) with detailed data logging
      this.updateProgress(2, 7, 'Testing unified rubric system...');
      await this.delay(500);
      
      try {
        const startTime = performance.now();
        const getRubric = (window as any).getRubric;
        if (typeof getRubric === 'function') {
          const unifiedResult = getRubric();
          const timing = Math.round(performance.now() - startTime);
          
          if (unifiedResult?.type === 'structured') {
            // Log the actual unified rubric data
            console.log('📝 ACTUAL UNIFIED RUBRIC DATA:');
            console.log('='.repeat(50));
            console.log(`Rubric Type: ${unifiedResult.type}`);
            console.log(`Rubric Style: ${unifiedResult.rubricStyle}`);
            console.log(`Total Items: ${unifiedResult.items.length}`);
            console.log('');
            
            unifiedResult.items.forEach((item: any, index: number) => {
              console.log(`${index + 1}. ID: "${item.id}" | Points: ${item.points}`);
              console.log(`   Description: "${item.description}"`);
              if (item.element) {
                const input = item.element.querySelector('input[type="checkbox"], input[type="radio"]');
                const isChecked = input ? input.checked : false;
                console.log(`   Currently selected: ${isChecked}`);
                console.log(`   Element: ${item.element.tagName}.${item.element.className}`);
              }
              console.log('');
            });
            console.log('='.repeat(50));
            
            results.push({
              test: 'Unified getRubric (Structured)',
              status: 'success',
              message: `✅ Found ${unifiedResult.items.length} items (${unifiedResult.rubricStyle}) - see console`,
              timing
            });
          } else if (unifiedResult?.type === 'manual') {
            console.log('📝 MANUAL SCORING INTERFACE DETECTED:');
            console.log('='.repeat(50));
            console.log(`Rubric Type: ${unifiedResult.type}`);
            if (unifiedResult.box) {
              console.log(`Score Box: ${unifiedResult.box.tagName}`);
              console.log(`Current Value: "${unifiedResult.box.value}"`);
              console.log(`Placeholder: "${unifiedResult.box.placeholder}"`);
              console.log(`Name: "${unifiedResult.box.name}"`);
            }
            console.log('='.repeat(50));
            
            results.push({
              test: 'Unified getRubric (Manual)',
              status: 'info',
              message: 'ℹ️ Manual scoring interface detected - see console',
              timing
            });
          } else {
            console.log('📝 NO RUBRIC STRUCTURE FOUND:');
            console.log('='.repeat(50));
            console.log('getRubric() returned:', unifiedResult);
            console.log('Page URL:', window.location.href);
            console.log('Page title:', document.title);
            console.log('='.repeat(50));
            
            results.push({
              test: 'Unified getRubric',
              status: 'info',
              message: 'ℹ️ No rubric structure found - see console',
              timing
            });
          }
        } else {
          results.push({
            test: 'Unified getRubric',
            status: 'error',
            message: '❌ getRubric function not available'
          });
        }
      } catch (error) {
        results.push({
          test: 'Unified getRubric',
          status: 'error',
          message: `❌ Error: ${(error as Error).message}`
        });
      }
      
      // Test 3: API-based system (fetchRubricMap) - only for assignments with detailed logging
      this.updateProgress(3, 7, 'Testing API-based rubric system...');
      await this.delay(500);
      
      if (this.state?.assignmentType === 'assignments' && this.state?.courseId && this.state?.assignmentId) {
        try {
          const startTime = performance.now();
          const supergrader = (window as any).supergrader;
          if (supergrader?.testRubric) {
            const rubricMap = await supergrader.testRubric();
            const timing = Math.round(performance.now() - startTime);
            
            if (rubricMap?.questions) {
              const questionCount = Object.keys(rubricMap.questions).length;
              const itemCount = Object.keys(rubricMap.itemToQuestion).length;
              
              // Log the actual API rubric data
              console.log('🌐 ACTUAL API RUBRIC DATA (fetchRubricMap):');
              console.log('='.repeat(60));
              console.log(`Total Questions: ${questionCount}`);
              console.log(`Total Items: ${itemCount}`);
              console.log('');
              
              Object.entries(rubricMap.questions).forEach(([qId, qData]: [string, any]) => {
                console.log(`QUESTION ${qId}: "${qData.name}"`);
                console.log(`  Style: ${qData.rubricStyle} | Parent: ${qData.parentId || 'none'}`);
                console.log(`  Items (${qData.items.length}):`);
                qData.items.forEach((item: any, index: number) => {
                  console.log(`    ${index + 1}. ID: ${item.id} | Points: ${item.points}`);
                  console.log(`       Text: "${item.text}"`);
                });
                console.log('');
              });
              console.log('='.repeat(60));
              
              results.push({
                test: 'API fetchRubricMap',
                status: 'success',
                message: `✅ Found ${questionCount} questions, ${itemCount} items - see console`,
                timing
              });
            } else {
              results.push({
                test: 'API fetchRubricMap',
                status: 'error',
                message: '❌ Invalid rubric map response',
                timing
              });
            }
          } else {
            results.push({
              test: 'API fetchRubricMap',
              status: 'error',
              message: '❌ supergrader.testRubric not available'
            });
          }
        } catch (error) {
          results.push({
            test: 'API fetchRubricMap',
            status: 'error',
            message: `❌ Error: ${(error as Error).message}`
          });
        }
      } else {
        results.push({
          test: 'API fetchRubricMap',
          status: 'info',
          message: 'ℹ️ Skipped (question page or missing IDs)'
        });
      }

             // Test 4: Console API availability
       this.updateProgress(4, 7, 'Testing console API availability...');
       await this.delay(300);
       
       const consoleFunctions = ['testRubric', 'testUnifiedRubric', 'testIframeRubric', 'analyzeRubric', 'getRubricItem'];
       const supergrader = (window as any).supergrader;
       
       console.log('Debug: supergrader object:', supergrader);
       console.log('Debug: available properties:', supergrader ? Object.keys(supergrader) : 'none');
       
       const availableFunctions = consoleFunctions.filter(fn => typeof supergrader?.[fn] === 'function');
       
       results.push({
         test: 'Console API Functions',
         status: availableFunctions.length === 5 ? 'success' : availableFunctions.length > 0 ? 'info' : 'error',
         message: `${availableFunctions.length === 5 ? '✅' : availableFunctions.length > 0 ? 'ℹ️' : '❌'} ${availableFunctions.length}/${consoleFunctions.length} functions available${availableFunctions.length > 0 ? ` (${availableFunctions.join(', ')})` : ''}`
       });
      
      // Test 5: Toggle functionality test (if structured rubric exists)
      this.updateProgress(5, 7, 'Testing toggle functionality...');
      await this.delay(500);
      
      try {
        const getRubric = (window as any).getRubric;
        const applyGrade = (window as any).applyGrade;
        
        if (typeof getRubric === 'function' && typeof applyGrade === 'function') {
          const rubricResult = getRubric();
          
          if (rubricResult?.type === 'structured' && rubricResult.items.length > 0) {
            const startTime = performance.now();
            const firstItem = rubricResult.items[0];
            
                         // Test toggle (just get current state, don't actually change it)
             const api = (window as any).GradescopeAPI;
             const isSelectedMethod = (api?.isRubricItemSelected) || ((element?: HTMLElement) => {
               if (!element) return false;
               const input = element.querySelector('input[type="checkbox"], input[type="radio"]') as HTMLInputElement;
               return input ? input.checked : false;
             });
            const currentlySelected = isSelectedMethod(firstItem.element) || false;
            const timing = Math.round(performance.now() - startTime);
            
            results.push({
              test: 'Toggle Functionality Check',
              status: 'success',
              message: `✅ Ready to toggle (item ${firstItem.id} currently ${currentlySelected ? 'selected' : 'unselected'})`,
              timing
            });
          } else if (rubricResult?.type === 'manual') {
            results.push({
              test: 'Toggle Functionality Check',
              status: 'info',
              message: 'ℹ️ Manual scoring - no items to toggle'
            });
          } else {
            results.push({
              test: 'Toggle Functionality Check',
              status: 'info',
              message: 'ℹ️ No structured rubric items found'
            });
          }
        } else {
          results.push({
            test: 'Toggle Functionality Check',
            status: 'error',
            message: '❌ Toggle functions not available'
          });
        }
      } catch (error) {
        results.push({
          test: 'Toggle Functionality Check',
          status: 'error',
          message: `❌ Error: ${(error as Error).message}`
        });
      }
      
      // Test 6: Performance benchmark
      this.updateProgress(6, 7, 'Running performance benchmark...');
      await this.delay(500);
      
      try {
        const benchmarkResults: number[] = [];
        const getRubric = (window as any).getRubric;
        
        if (typeof getRubric === 'function') {
          // Run 5 iterations to get average performance
          for (let i = 0; i < 5; i++) {
            const start = performance.now();
            getRubric();
            benchmarkResults.push(performance.now() - start);
          }
          
          const avgTime = benchmarkResults.reduce((a, b) => a + b, 0) / benchmarkResults.length;
          const maxTime = Math.max(...benchmarkResults);
          
          results.push({
            test: 'Performance Benchmark',
            status: avgTime < 50 ? 'success' : avgTime < 200 ? 'info' : 'error',
            message: `${avgTime < 50 ? '✅' : avgTime < 200 ? 'ℹ️' : '❌'} Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`,
            timing: Math.round(avgTime)
          });
        } else {
          results.push({
            test: 'Performance Benchmark',
            status: 'error',
            message: '❌ Cannot benchmark - getRubric not available'
          });
        }
      } catch (error) {
        results.push({
          test: 'Performance Benchmark',
          status: 'error',
          message: `❌ Error: ${(error as Error).message}`
        });
      }
      
      // Test 7: Documentation and usage examples
      this.updateProgress(7, 7, 'Generating usage examples...');
      await this.delay(300);
      
      const hasRubricStructure = results.some(r => 
        (r.test.includes('extractRubricStructure') || r.test.includes('getRubric')) && 
        r.status === 'success'
      );
      
      results.push({
        test: 'Usage Examples',
        status: 'info',
        message: hasRubricStructure ? 
          'ℹ️ Check console for detailed usage examples' :
          'ℹ️ Limited examples available (no structured rubric found)'
      });
      
    } catch (error) {
      results.push({
        test: 'Comprehensive Test',
        status: 'error',
        message: `❌ Unexpected error: ${(error as Error).message}`
      });
    } finally {
      // Reset button state
      if (testButton) {
        testButton.disabled = false;
        testButton.textContent = '🚀 Comprehensive Rubric Test';
      }
      
      this.hideProgress();
      this.showComprehensiveResults(results);
      this.logUsageExamples();
    }
  }

  /**
   * Display comprehensive test results
   */
  private showComprehensiveResults(results: Array<{ test: string; status: 'success' | 'error' | 'info'; message: string; timing?: number }>): void {
    console.log('🚀 UIController: Comprehensive Rubric Test Results:');
    console.log('='.repeat(60));
    
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const infoCount = results.filter(r => r.status === 'info').length;
    
    results.forEach(result => {
      const timing = result.timing ? ` (${result.timing}ms)` : '';
      console.log(`${result.message}${timing} - ${result.test}`);
    });
    
    console.log('='.repeat(60));
    console.log(`Summary: ${successCount} passed, ${errorCount} failed, ${infoCount} info`);
    
    // Show summary in UI
    let summaryMessage = '';
    let messageType: 'success' | 'error' | 'info' = 'success';
    
    if (errorCount === 0 && successCount > 0) {
      summaryMessage = `🎉 All tests passed! ${successCount} systems working correctly. Check console for details.`;
      messageType = 'success';
    } else if (errorCount > 0 && successCount > 0) {
      summaryMessage = `⚠️ Partial success: ${successCount} passed, ${errorCount} failed. Check console for details.`;
      messageType = 'info';
    } else if (errorCount > 0) {
      summaryMessage = `❌ Tests failed: ${errorCount} errors found. Check console for details.`;
      messageType = 'error';
    } else {
      summaryMessage = `ℹ️ Tests completed: No structured rubrics found on this page. Check console for details.`;
      messageType = 'info';
    }
    
    this.showError(summaryMessage, messageType);
    setTimeout(() => this.hideError(), 8000);
  }

  /**
   * Test API functionality - Week 2 Day 5: API Testing
   */
  private async testAPI(): Promise<void> {
    console.log('🧪 UIController: Starting comprehensive API testing (Day 5)...');
    
    // Show progress
    this.showProgress('Running API tests...', 0);
    
    // Update button state
    const testButton = this.aiPanel?.querySelector('#ai-api-test-button') as HTMLButtonElement;
    if (testButton) {
      testButton.disabled = true;
      testButton.textContent = '🔄 Testing API...';
    }
    
    try {
      // Check if API testing function is available
      const supergrader = (window as any).supergrader;
      if (!supergrader?.testAPI) {
        throw new Error('API testing function not available');
      }
      
             // Run comprehensive API tests
       this.updateProgress(50, 100, 'Executing API test suite...');
       
       // First show what rubric data we can actually see
       console.log('🔍 SHOWING ACTUAL RUBRIC DATA BEFORE API TESTS:');
       if (supergrader.showRubricData) {
         supergrader.showRubricData();
       }
       
       const results = await supergrader.testAPI();
      
      if (results && results.length > 0) {
        // Count results by status
        const summary = results.reduce((acc: any, result: any) => {
          acc[result.status] = (acc[result.status] || 0) + 1;
          return acc;
        }, {});
        
        const successCount = summary.success || 0;
        const failureCount = summary.failure || 0;
        const warningCount = summary.warning || 0;
        const infoCount = summary.info || 0;
        
        console.log('🧪 UIController: API Test Results Summary:');
        console.log(`✅ Passed: ${successCount}`);
        console.log(`❌ Failed: ${failureCount}`);
        console.log(`⚠️ Warnings: ${warningCount}`);
        console.log(`ℹ️ Info: ${infoCount}`);
        
        // Show appropriate message based on results
        let message = '';
        let messageType: 'success' | 'error' | 'info' = 'success';
        
        if (failureCount === 0 && successCount > 0) {
          message = `🎉 All API tests passed! ${successCount} tests successful. Check console for detailed results.`;
          messageType = 'success';
        } else if (failureCount > 0 && successCount > 0) {
          message = `⚠️ API tests completed: ${successCount} passed, ${failureCount} failed. Check console for details.`;
          messageType = 'info';
        } else if (failureCount > 0) {
          message = `❌ API tests failed: ${failureCount} errors found. Check console for troubleshooting.`;
          messageType = 'error';
        } else {
          message = `ℹ️ API tests completed: ${results.length} tests run. Check console for details.`;
          messageType = 'info';
        }
        
        this.hideProgress();
        this.showError(message, messageType);
        setTimeout(() => this.hideError(), 10000);
        
      } else {
        throw new Error('No test results returned from API test suite');
      }
      
    } catch (error) {
      console.error('UIController: API testing failed:', error);
      this.hideProgress();
      this.showError(`❌ API testing failed: ${(error as Error).message}`);
    } finally {
      // Reset button state
      if (testButton) {
        testButton.disabled = false;
        testButton.textContent = '🧪 Test API (Day 5)';
      }
    }
  }

  /**
   * Log usage examples for developers
   */
  private logUsageExamples(): void {
    console.log('\n📚 Rubric System Usage Examples:');
    console.log('-'.repeat(40));
    console.log('// Basic rubric detection:');
    console.log('const rubric = getRubric();');
    console.log('if (rubric?.type === "structured") {');
    console.log('  console.log(`Found ${rubric.items.length} items`);');
    console.log('}\n');
    
    console.log('// GradescopeAPI usage:');
    console.log('const api = new GradescopeAPI();');
    console.log('const items = api.extractRubricStructure();');
    console.log('const result = await api.toggleRubricItem("1", "12345", -2, "Error");\n');
    
    console.log('// Console helper functions:');
    console.log('await supergrader.testRubric();        // API-based test');
    console.log('supergrader.testUnifiedRubric();       // DOM-based test'); 
    console.log('await supergrader.analyzeRubric();     // Detailed analysis');
    console.log('await supergrader.getRubricItem(123);  // Get specific item');
    console.log('supergrader.showRubricData();          // 🔍 Enhanced display with emojis');
    console.log('supergrader.showRadioButtons();        // 📻 Radio buttons detailed view\n');
    
    console.log('// Apply grading (toggle items):');
    console.log('const success = applyGrade(rubric, "12345", true);  // select');
    console.log('const success = applyGrade(rubric, "12346", false); // deselect\n');
    
    console.log('// Manual scoring:');
    console.log('const success = applyGrade(rubric, undefined, undefined, 85.5);');
    console.log('-'.repeat(40));
    
    // Add API testing usage examples
    console.log('\n🧪 API Testing Usage Examples (Week 2 Day 5):');
    console.log('-'.repeat(40));
    console.log('// Full API test suite:');
    console.log('await supergrader.testAPI();           // Comprehensive API testing\n');
    
    console.log('// Individual API tests:');
    console.log('await supergrader.testCSRF();          // CSRF token validation only');
    console.log('await supergrader.testRetries();       // Error handling & retries only\n');
    
    console.log('// Access test data fixtures:');
    console.log('console.log(supergrader.API_TEST_FIXTURES); // Test data and mock scenarios');
    console.log('-'.repeat(40));
  }

  /**
   * Show actual rubric data from the page
   */
  private showRubricData(): void {
    console.log('🔍 UIController: Showing rubric data...');
    
    const supergrader = (window as any).supergrader;
    if (supergrader?.showRubricData) {
      supergrader.showRubricData();
      this.showError('✅ Rubric data shown in console - check F12 Developer Console', 'info');
      setTimeout(() => this.hideError(), 4000);
    } else {
      this.showError('❌ Rubric data function not available - try refreshing the page', 'error');
    }
  }

  /**
   * Simple delay helper for test pacing
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create global instance
(window as any).UIController = new UIController();
// Update console helper if it exists
if ((window as any).supergrader) {
  (window as any).supergrader.ui = (window as any).UIController;
} 