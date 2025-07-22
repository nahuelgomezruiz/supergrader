// UI Controller module
// Manages the user interface elements and interactions

console.log('supergrader: UI Controller loaded');

/**
 * UI Controller class with enhanced injection and error handling
 */
class UIController {
  constructor() {
    this.isInitialized = false;
    this.aiPanel = null;
    this.progressBar = null;
    this.injectionPoint = null;
    this.state = null;
  }

  /**
   * Initialize the UI components with enhanced state and injection point
   */
  initialize(enhancedState) {
    console.log('UIController: Initializing with enhanced state...', enhancedState);
    
    if (this.isInitialized) {
      console.log('UIController: Already initialized, updating state');
      this.state = enhancedState;
      return;
    }

    try {
      // Store state and injection point
      this.state = enhancedState;
      this.injectionPoint = enhancedState.injectionPoint;
      
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
      this.handleInitializationError(error);
    }
  }

  /**
   * Find fallback injection point if provided one fails
   */
  findFallbackInjectionPoint() {
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
  createAIPanel() {
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
    const assignmentTypeLabel = this.state.assignmentType === 'questions' ? 'Question' : 'Assignment';
    
    this.aiPanel.innerHTML = `
      <div class="ai-panel-header">
        🤖 supergrader
        <div class="ai-panel-info">
          ${assignmentTypeLabel} ${this.state.assignmentId} | Submission ${this.state.submissionId}
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
          <button class="ai-test-button" id="ai-test-button" style="background: #17a2b8; margin-left: 10px;">🔧 Test File Download</button>
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
  insertPanelSafely() {
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
  setupEnhancedEventListeners() {
    console.log('UIController: Setting up enhanced event listeners...');
    
    try {
      // Panel toggle with error handling
      const toggleButton = this.aiPanel.querySelector('.ai-panel-toggle');
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
      const gradeButton = this.aiPanel.querySelector('#ai-grade-button');
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
      const testButton = this.aiPanel.querySelector('#ai-test-button');
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

      // Preview mode checkbox
      const previewCheckbox = this.aiPanel.querySelector('#ai-preview-mode');
      if (previewCheckbox) {
        previewCheckbox.addEventListener('change', (e) => {
          console.log('UIController: Preview mode toggled', e.target.checked);
          // Store preference
          if (chrome.storage) {
            chrome.storage.sync.set({ previewMode: e.target.checked });
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
  startEnhancedGrading() {
    console.log('UIController: Starting enhanced grading process...');
    
    const button = this.aiPanel.querySelector('#ai-grade-button');
    const progress = this.aiPanel.querySelector('#ai-progress');
    const progressFill = this.aiPanel.querySelector('#progress-fill');
    const progressText = this.aiPanel.querySelector('#progress-text');
    
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
    const stages = [
      { progress: 10, text: 'Extracting source files...' },
      { progress: 25, text: 'Parsing rubric structure...' },
      { progress: 50, text: 'Analyzing code with AI...' },
      { progress: 75, text: 'Generating feedback...' },
      { progress: 90, text: 'Applying decisions...' },
      { progress: 100, text: 'Complete!' }
    ];
    
    let currentStage = 0;
    
    const updateProgress = () => {
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
  completeGrading(button, progress) {
    console.log('UIController: Grading process completed');
    
    button.disabled = false;
    button.textContent = 'Start AI Grading';
    progress.style.display = 'none';
    
    // Reset progress bar
    const progressFill = this.aiPanel.querySelector('#progress-fill');
    if (progressFill) {
      progressFill.style.width = '0%';
    }
    
    // Could trigger notification or other completion actions here
  }

  /**
   * Update connection status indicator with authentication status
   */
  updateConnectionStatus() {
    const statusContainer = this.aiPanel.querySelector('#ai-connection-status');
    const statusIndicator = statusContainer?.querySelector('.status-indicator');
    const statusText = statusContainer?.querySelector('.status-text');
    
    if (!statusContainer) return;
    
    // Check authentication status
    setTimeout(() => {
      if (window.GradescopeAPI && typeof window.GradescopeAPI.isAuthenticated === 'function') {
        const isAuth = window.GradescopeAPI.isAuthenticated();
        const authStatus = window.GradescopeAPI.getAuthStatus();
        
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
  togglePanel() {
    const content = this.aiPanel.querySelector('.ai-panel-content');
    const toggle = this.aiPanel.querySelector('.ai-panel-toggle');
    
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
  showError(message, type = 'error') {
    const errorContainer = this.aiPanel.querySelector('#ai-errors');
    if (errorContainer) {
      let icon, className;
      
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
  hideError() {
    const errorContainer = this.aiPanel.querySelector('#ai-errors');
    if (errorContainer) {
      errorContainer.style.display = 'none';
    }
  }

  /**
   * Handle initialization errors
   */
  handleInitializationError(error) {
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
  showUncertaintyWarning(uncertainItems) {
    console.log('UIController: Showing uncertainty warning for items:', uncertainItems);
    // TODO: Implement uncertainty UI (Week 2+ feature)
  }

  /**
   * Update progress indicator with specific values
   */
  updateProgress(step, total, message) {
    const progressFill = this.aiPanel?.querySelector('#progress-fill');
    const progressText = this.aiPanel?.querySelector('#progress-text');
    
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
  showProgress(message, percentage = 0) {
    const progressContainer = this.aiPanel?.querySelector('#ai-progress');
    const progressFill = this.aiPanel?.querySelector('#progress-fill');
    const progressText = this.aiPanel?.querySelector('#progress-text');
    
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
  hideProgress() {
    const progressContainer = this.aiPanel?.querySelector('#ai-progress');
    const progressFill = this.aiPanel?.querySelector('#progress-fill');
    
    if (progressContainer && progressFill) {
      progressContainer.style.display = 'none';
      progressFill.style.width = '0%';
      console.log('UIController: Progress hidden');
    }
  }

  /**
   * Add authentication debug information to the panel
   */
  addAuthDebugInfo(authStatus) {
    // Only add debug info if there are issues or in development
    if (authStatus.isAuthenticated && authStatus.csrfTokenValid) {
      return; // All good, no debug needed
    }

    let debugContainer = this.aiPanel.querySelector('#auth-debug-info');
    
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
  retryAuthentication() {
    console.log('UIController: User initiated authentication retry');
    
    if (window.GradescopeAPI && typeof window.GradescopeAPI.initialize === 'function') {
      // Reset retry count to allow new attempts
      if (window.GradescopeAPI.authState) {
        window.GradescopeAPI.authState.retryCount = 0;
      }
      
      // Show progress
      this.showError('Retrying authentication...');
      
      // Attempt re-authentication
      window.GradescopeAPI.initialize()
        .then(success => {
          if (success) {
            this.hideError();
            this.updateConnectionStatus();
            console.log('UIController: Authentication retry successful');
          } else {
            this.showError('Authentication retry failed. Please refresh the page.');
          }
        })
        .catch(error => {
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
  testFileDownload() {
    console.log('🔧 UIController: Starting file download test...');
    
    if (!this.state.submissionId) {
      console.error('UIController: No submission ID available for testing');
      this.showError('No submission ID found for testing');
      return;
    }
    
    // Show progress
    this.showProgress('Testing file download...', 0);
    
    // Update test button state
    const testButton = this.aiPanel.querySelector('#ai-test-button');
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
    const checkResult = () => {
      const resultElement = document.getElementById('supergrader-test-result');
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
                 const submissionType = result.metadata?.submissionType || 'unknown';
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
}

// Create global instance
window.UIController = new UIController(); 