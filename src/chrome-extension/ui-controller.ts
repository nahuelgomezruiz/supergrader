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
      
      // Create the AI panel
      this.createAIPanel();
      
      this.isInitialized = true;
      console.log('UIController: Enhanced UI initialized successfully');
    } catch (error) {
      console.error('UIController: Failed to initialize enhanced UI', error);
      this.handleInitializationError(error as Error);
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
   */
  private createAIPanel(): void {
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
    
    // Enhanced panel content with state information
    const assignmentTypeLabel = this.state?.assignmentType === 'questions' ? 'Question' : 'Assignment';
    
    this.aiPanel.innerHTML = `
      <div class="ai-panel-header">
        🤖 supergrader
        <div class="ai-panel-info">
          ${assignmentTypeLabel} ${this.state?.assignmentId} | Submission ${this.state?.submissionId}
        </div>
        <button class="ai-panel-toggle" title="Toggle panel">−</button>
      </div>
      <div class="ai-panel-content">
        <div class="ai-status-container">
          <div class="ai-status">Ready to assist with grading</div>
          <div class="ai-connection-status" id="ai-connection-status">
            <span class="status-indicator"></span>
            <span class="status-text">Checking connection...</span>
          </div>
        </div>
        <div class="ai-controls">
          <button class="ai-grade-button" id="ai-grade-button">Start AI Grading</button>
          <div class="test-buttons" style="margin-left: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="ai-test-button" id="ai-test-button" style="background: #17a2b8;">🔧 Test File Download</button>
            <button class="ai-rubric-button" id="ai-rubric-button" style="background: #28a745;">📝 Test Rubric</button>
            <button class="ai-comprehensive-test-button" id="ai-comprehensive-test-button" style="background: #6f42c1; margin-top: 5px;">🚀 Comprehensive Rubric Test</button>
          </div>
          <div class="ai-options">
            <label class="ai-checkbox">
              <input type="checkbox" id="ai-preview-mode"> Preview mode
            </label>
          </div>
        </div>
        <div class="ai-progress" id="ai-progress" style="display: none;">
          <div class="progress-bar">
            <div class="progress-fill" id="progress-fill"></div>
          </div>
          <div class="progress-text" id="progress-text">Initializing...</div>
        </div>
        <div class="ai-errors" id="ai-errors" style="display: none;"></div>
      </div>
    `;

    // Determine best insertion strategy
    this.insertPanelSafely();
    
    // Add event listeners
    this.setupEnhancedEventListeners();
    
    // Initialize connection status check
    this.updateConnectionStatus();
    
    console.log('UIController: Enhanced panel created successfully');
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
   * Set up enhanced event listeners with better error handling
   */
  private setupEnhancedEventListeners(): void {
    console.log('UIController: Setting up enhanced event listeners...');
    
    if (!this.aiPanel) return;

    try {
      // Panel toggle with error handling
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
        gradeButton.addEventListener('click', () => {
          try {
            this.startEnhancedGrading();
          } catch (error) {
            console.error('UIController: Error starting grading', error);
            this.showError('Failed to start grading process');
          }
        });
      }

      // Test button for file download testing
      const testButton = this.aiPanel.querySelector('#ai-test-button') as HTMLButtonElement;
      if (testButton) {
        testButton.addEventListener('click', () => {
          try {
            console.log('🔧 UIController: Test button clicked');
            this.testFileDownload();
          } catch (error) {
            console.error('UIController: Error testing file download', error);
            this.showError('Failed to test file download');
          }
        });
      }

      // Rubric test button for Week 2 Day 3-4: Rubric Parsing
      const rubricButton = this.aiPanel.querySelector('#ai-rubric-button') as HTMLButtonElement;
      if (rubricButton) {
        rubricButton.addEventListener('click', () => {
          try {
            console.log('📝 UIController: Rubric test button clicked');
            this.testRubric();
          } catch (error) {
            console.error('UIController: Error testing rubric', error);
            this.showError('Failed to test rubric parsing');
          }
        });
      }

      // Comprehensive rubric test button
      const comprehensiveTestButton = this.aiPanel.querySelector('#ai-comprehensive-test-button') as HTMLButtonElement;
      if (comprehensiveTestButton) {
        comprehensiveTestButton.addEventListener('click', () => {
          try {
            console.log('🚀 UIController: Comprehensive rubric test button clicked');
            this.testRubricComprehensive();
          } catch (error) {
            console.error('UIController: Error running comprehensive rubric test', error);
            this.showError('Failed to run comprehensive rubric test');
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
  }

  /**
   * Enhanced grading process with better feedback
   */
  private startEnhancedGrading(): void {
    console.log('UIController: Starting enhanced grading process...');
    
    if (!this.aiPanel) return;

    const button = this.aiPanel.querySelector('#ai-grade-button') as HTMLButtonElement;
    const progress = this.aiPanel.querySelector('#ai-progress') as HTMLElement;
    const progressFill = this.aiPanel.querySelector('#progress-fill') as HTMLElement;
    const progressText = this.aiPanel.querySelector('#progress-text') as HTMLElement;
    
    if (!button || !progress) {
      console.error('UIController: Required UI elements not found for grading');
      return;
    }
    
    // Update UI state
    button.disabled = true;
    button.textContent = 'Processing...';
    progress.style.display = 'block';
    this.hideError();
    
    // Enhanced progress simulation with multiple stages
    const stages: ProgressStage[] = [
      { progress: 10, text: 'Extracting source files...' },
      { progress: 25, text: 'Parsing rubric structure...' },
      { progress: 50, text: 'Analyzing code with AI...' },
      { progress: 75, text: 'Generating feedback...' },
      { progress: 90, text: 'Applying decisions...' },
      { progress: 100, text: 'Complete!' }
    ];
    
    let currentStage = 0;
    
    const updateProgress = (): void => {
      if (currentStage < stages.length) {
        const stage = stages[currentStage];
        progressFill.style.width = `${stage.progress}%`;
        progressText.textContent = stage.text;
        
        console.log(`UIController: ${stage.text} (${stage.progress}%)`);
        
        currentStage++;
        setTimeout(updateProgress, 800 + Math.random() * 400); // Variable timing
      } else {
        // Complete
        setTimeout(() => {
          this.completeGrading(button, progress);
        }, 1000);
      }
    };
    
    // Start progress
    updateProgress();
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
          results.push({
            test: 'GradescopeAPI.extractRubricStructure',
            status: 'success',
            message: `✅ Found ${apiResults.length} rubric items`,
            timing
          });
        } else if (Array.isArray(apiResults) && apiResults.length === 0) {
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
      
      // Test 2: Unified rubric system (getRubric)
      this.updateProgress(2, 7, 'Testing unified rubric system...');
      await this.delay(500);
      
      try {
        const startTime = performance.now();
        const getRubric = (window as any).getRubric;
        if (typeof getRubric === 'function') {
          const unifiedResult = getRubric();
          const timing = Math.round(performance.now() - startTime);
          
          if (unifiedResult?.type === 'structured') {
            results.push({
              test: 'Unified getRubric (Structured)',
              status: 'success',
              message: `✅ Found ${unifiedResult.items.length} items (${unifiedResult.rubricStyle})`,
              timing
            });
          } else if (unifiedResult?.type === 'manual') {
            results.push({
              test: 'Unified getRubric (Manual)',
              status: 'info',
              message: 'ℹ️ Manual scoring interface detected',
              timing
            });
          } else {
            results.push({
              test: 'Unified getRubric',
              status: 'info',
              message: 'ℹ️ No rubric structure found',
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
      
      // Test 3: API-based system (fetchRubricMap) - only for assignments
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
              results.push({
                test: 'API fetchRubricMap',
                status: 'success',
                message: `✅ Found ${questionCount} questions, ${itemCount} items`,
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
    console.log('await supergrader.getRubricItem(123);  // Get specific item\n');
    
    console.log('// Apply grading (toggle items):');
    console.log('const success = applyGrade(rubric, "12345", true);  // select');
    console.log('const success = applyGrade(rubric, "12346", false); // deselect\n');
    
    console.log('// Manual scoring:');
    console.log('const success = applyGrade(rubric, undefined, undefined, 85.5);');
    console.log('-'.repeat(40));
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