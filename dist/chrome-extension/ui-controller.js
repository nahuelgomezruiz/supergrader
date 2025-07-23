"use strict";
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
        }
        catch (error) {
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
          <div class="essential-buttons" style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
            <button class="ai-show-data-button" id="ai-show-data-button" style="background: #fd7e14; margin-top: 5px;">🔍 Show Rubric Data</button>
            <button class="ai-radio-diag-button" id="ai-radio-diag-button" style="background: #20c997; margin-top: 5px;">🎛 Radio Options</button>
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
    insertPanelSafely() {
        if (!this.aiPanel || !this.injectionPoint)
            return;
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
        }
        catch (error) {
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
        if (!this.aiPanel)
            return;
        try {
            // Panel toggle with error handling
            const toggleButton = this.aiPanel.querySelector('.ai-panel-toggle');
            if (toggleButton) {
                toggleButton.addEventListener('click', () => {
                    try {
                        this.togglePanel();
                    }
                    catch (error) {
                        console.error('UIController: Error toggling panel', error);
                    }
                });
            }
            // Grade button with enhanced functionality
            const gradeButton = this.aiPanel.querySelector('#ai-grade-button');
            if (gradeButton) {
                gradeButton.addEventListener('click', async () => {
                    try {
                        await this.startEnhancedGrading();
                    }
                    catch (error) {
                        console.error('UIController: Error starting grading', error);
                        this.showError('Failed to start grading process');
                    }
                });
            }
            // Show rubric data button
            const showDataBtn = this.aiPanel.querySelector('#ai-show-data-button');
            if (showDataBtn) {
                showDataBtn.addEventListener('click', () => {
                    try {
                        console.log('🔍 UIController: Show rubric data button clicked');
                        this.showRubricData();
                    }
                    catch (error) {
                        console.error('UIController: Error showing rubric data', error);
                        this.showError('Failed to show rubric data');
                    }
                });
            }
            const radioDiagBtn = this.aiPanel.querySelector('#ai-radio-diag-button');
            if (radioDiagBtn) {
                radioDiagBtn.addEventListener('click', () => {
                    if (typeof window.showRadioDiag === 'function') {
                        window.showRadioDiag();
                    }
                    else {
                        this.showError('Radio diagnostic unavailable', 'info');
                    }
                });
            }
            // Preview mode checkbox
            const previewCheckbox = this.aiPanel.querySelector('#ai-preview-mode');
            if (previewCheckbox) {
                previewCheckbox.addEventListener('change', (e) => {
                    const target = e.target;
                    console.log('UIController: Preview mode toggled', target.checked);
                    // Store preference
                    if (chrome.storage) {
                        chrome.storage.sync.set({ previewMode: target.checked });
                    }
                });
            }
            console.log('UIController: Enhanced event listeners set up successfully');
        }
        catch (error) {
            console.error('UIController: Failed to set up event listeners', error);
        }
    }
    /**
     * Enhanced grading process with backend integration
     */
    async startEnhancedGrading() {
        console.log('UIController: Starting enhanced grading process...');
        if (!this.aiPanel)
            return;
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
        button.textContent = 'Initializing...';
        progress.style.display = 'block';
        this.hideError();
        try {
            // Get backend URL from storage or use default
            const settings = await chrome.storage.sync.get(['backendUrl']);
            const backendUrl = settings.backendUrl || 'http://localhost:8000';
            console.log('UIController: Using backend URL:', backendUrl);
            // Use the standalone grading service
            const ChromeGradingService = window.ChromeGradingService;
            if (!ChromeGradingService) {
                throw new Error('ChromeGradingService not loaded');
            }
            // Create grading service
            const gradingService = new ChromeGradingService(backendUrl);
            // Update progress text
            progressFill.style.width = '5%';
            progressText.textContent = 'Extracting rubric structure...';
            // Start grading with progress callback
            await gradingService.gradeSubmission((event) => {
                console.log('UIController: Grading event', event);
                if (event.type === 'partial_result' && event.progress !== undefined) {
                    // Update progress bar
                    const percent = Math.round(event.progress * 100);
                    progressFill.style.width = `${percent}%`;
                    progressText.textContent = `Grading rubric items... ${percent}%`;
                    // Log the decision
                    if (event.decision) {
                        console.log(`✅ Graded ${event.rubric_item_id}:`, {
                            confidence: `${(event.decision.confidence * 100).toFixed(1)}%`,
                            verdict: event.decision.verdict
                        });
                        // Apply decision if auto-apply is enabled and confidence is high
                        chrome.storage.sync.get(['autoApplyHighConfidence', 'confidenceThreshold'], async (settings) => {
                            if (settings.autoApplyHighConfidence &&
                                event.decision &&
                                event.decision.confidence >= (settings.confidenceThreshold || 0.8)) {
                                try {
                                    await gradingService.applyGradingDecision(event.decision);
                                    console.log(`✅ Auto-applied decision for ${event.rubric_item_id}`);
                                }
                                catch (error) {
                                    console.error(`❌ Failed to auto-apply decision for ${event.rubric_item_id}:`, error);
                                }
                            }
                        });
                    }
                }
                else if (event.type === 'job_complete') {
                    // Complete
                    progressFill.style.width = '100%';
                    progressText.textContent = 'Grading completed!';
                    setTimeout(() => {
                        this.completeGrading(button, progress);
                    }, 1500);
                }
                else if (event.type === 'error') {
                    throw new Error(event.error || 'Unknown grading error');
                }
            });
        }
        catch (error) {
            console.error('UIController: Grading error', error);
            this.showError(`Grading failed: ${error.message}`);
            // Reset UI
            button.disabled = false;
            button.textContent = 'Start AI Grading';
            progress.style.display = 'none';
        }
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
        const progressFill = this.aiPanel?.querySelector('#progress-fill');
        if (progressFill) {
            progressFill.style.width = '0%';
        }
        // Could trigger notification or other completion actions here
    }
    /**
     * Update connection status indicator with authentication status
     */
    updateConnectionStatus() {
        if (!this.aiPanel)
            return;
        const statusContainer = this.aiPanel.querySelector('#ai-connection-status');
        const statusText = statusContainer?.querySelector('.status-text');
        if (!statusContainer)
            return;
        // Check authentication status
        setTimeout(() => {
            if (window.GradescopeAPI && typeof window.GradescopeAPI.isAuthenticated === 'function') {
                const isAuth = window.GradescopeAPI.isAuthenticated();
                const authStatus = window.GradescopeAPI.getAuthStatus();
                if (isAuth && authStatus.csrfTokenValid) {
                    statusContainer.className = 'ai-connection-status connected';
                    statusText.textContent = 'Authenticated';
                    console.log('UIController: Authentication status - connected');
                }
                else if (authStatus.csrfTokenValid) {
                    statusContainer.className = 'ai-connection-status warning';
                    statusText.textContent = 'Partial Auth';
                    console.log('UIController: Authentication status - partial');
                }
                else {
                    statusContainer.className = 'ai-connection-status error';
                    statusText.textContent = 'Auth Failed';
                    console.log('UIController: Authentication status - failed');
                }
                // Add debug info to panel if needed
                this.addAuthDebugInfo(authStatus);
            }
            else {
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
        if (!this.aiPanel)
            return;
        const content = this.aiPanel.querySelector('.ai-panel-content');
        const toggle = this.aiPanel.querySelector('.ai-panel-toggle');
        if (!content || !toggle)
            return;
        if (content.style.display === 'none') {
            content.style.display = 'block';
            toggle.textContent = '−';
            toggle.setAttribute('title', 'Collapse panel');
            console.log('UIController: Panel expanded');
        }
        else {
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
        if (!this.aiPanel)
            return;
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
        if (!this.aiPanel)
            return;
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
        }
        catch (e) {
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
        if (!this.aiPanel)
            return;
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
                .then((success) => {
                if (success) {
                    this.hideError();
                    this.updateConnectionStatus();
                    console.log('UIController: Authentication retry successful');
                }
                else {
                    this.showError('Authentication retry failed. Please refresh the page.');
                }
            })
                .catch((error) => {
                console.error('UIController: Authentication retry error:', error);
                this.showError('Authentication retry error: ' + error.message);
            });
        }
        else {
            this.showError('Cannot retry - API not available');
        }
    }
    /**
     * Test file download functionality (CSP-compliant)
     */
    testFileDownload() {
        console.log('🔧 UIController: Starting file download test...');
        if (!this.state?.submissionId) {
            console.error('UIController: No submission ID available for testing');
            this.showError('No submission ID found for testing');
            return;
        }
        // Show progress
        this.showProgress('Testing file download...', 0);
        // Update test button state
        const testButton = this.aiPanel?.querySelector('#ai-test-button');
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
                        }
                        else {
                            // Handle non-programming submissions
                            const message = result.metadata?.message || 'No files found';
                            this.showError(`ℹ️ ${message}`, 'info');
                            console.log('📋 Submission analysis:', result.metadata);
                        }
                        setTimeout(() => this.hideError(), 5000);
                    }
                    else {
                        this.hideProgress();
                        this.showError(`❌ Test failed: ${result.error}`);
                    }
                    // Clear the result
                    resultElement.content = '';
                }
                catch (e) {
                    console.error('UIController: Error parsing test result:', e);
                }
            }
            else {
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
    testRubric() {
        console.log('📝 UIController: Starting rubric test...');
        // Show progress
        this.showProgress('Testing rubric parsing...', 0);
        // Update rubric button state
        const rubricButton = this.aiPanel?.querySelector('#ai-rubric-button');
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
        const checkResult = () => {
            const resultElement = document.getElementById('supergrader-rubric-result');
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
                            }
                            else {
                                // Traditional assignment rubric
                                message = `✅ Assignment rubric test successful! Found ${result.questionCount} questions with ${result.totalItems} rubric items. ` +
                                    `${result.parentChildRelationships || 0} parent-child relationships detected. Check console for details.`;
                            }
                            this.showError(message, 'success');
                        }
                        else if (result.interfaceType) {
                            // Question-based or outline interface without rubric
                            this.showError(`ℹ️ ${result.interfaceType} interface detected. ${result.message}`, 'info');
                        }
                        else {
                            this.showError(`ℹ️ No rubric structure found on this page`, 'info');
                        }
                        setTimeout(() => this.hideError(), 10000); // Longer timeout for info messages
                    }
                    else {
                        this.hideProgress();
                        this.showError(`❌ Rubric test failed: ${result.error}`);
                    }
                    // Clear the result
                    resultElement.content = '';
                }
                catch (e) {
                    console.error('UIController: Error parsing rubric test result:', e);
                }
            }
            else {
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
    async testRubricComprehensive() {
        console.log('🚀 UIController: Starting comprehensive rubric test...');
        // Show progress
        this.showProgress('Running comprehensive rubric tests...', 0);
        // Update button state
        const testButton = this.aiPanel?.querySelector('#ai-comprehensive-test-button');
        if (testButton) {
            testButton.disabled = true;
            testButton.textContent = '🔄 Testing All Systems...';
        }
        const results = [];
        try {
            // Test 1: GradescopeAPI extractRubricStructure (newly implemented)
            this.updateProgress(1, 7, 'Testing GradescopeAPI.extractRubricStructure...');
            await this.delay(500);
            try {
                const startTime = performance.now();
                const api = window.GradescopeAPI; // Use existing instance, not constructor
                if (!api || typeof api.extractRubricStructure !== 'function') {
                    throw new Error('GradescopeAPI instance not available or missing extractRubricStructure method');
                }
                const apiResults = api.extractRubricStructure();
                const timing = Math.round(performance.now() - startTime);
                if (Array.isArray(apiResults) && apiResults.length > 0) {
                    // Log the actual rubric data for verification
                    console.log('📋 ACTUAL RUBRIC DATA from GradescopeAPI:');
                    console.log('='.repeat(50));
                    apiResults.forEach((item, index) => {
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
                }
                else if (Array.isArray(apiResults) && apiResults.length === 0) {
                    console.log('📋 GradescopeAPI found no rubric items - checking page type...');
                    results.push({
                        test: 'GradescopeAPI.extractRubricStructure',
                        status: 'info',
                        message: 'ℹ️ No rubric items found (manual scoring or no rubric)',
                        timing
                    });
                }
                else {
                    results.push({
                        test: 'GradescopeAPI.extractRubricStructure',
                        status: 'error',
                        message: '❌ Invalid response format',
                        timing
                    });
                }
            }
            catch (error) {
                console.log('Debug: window.GradescopeAPI:', window.GradescopeAPI);
                console.log('Debug: typeof window.GradescopeAPI:', typeof window.GradescopeAPI);
                if (window.GradescopeAPI) {
                    console.log('Debug: GradescopeAPI methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(window.GradescopeAPI)));
                }
                results.push({
                    test: 'GradescopeAPI.extractRubricStructure',
                    status: 'error',
                    message: `❌ Error: ${error.message}`
                });
            }
            // Test 2: Unified rubric system (getRubric) with detailed data logging
            this.updateProgress(2, 7, 'Testing unified rubric system...');
            await this.delay(500);
            try {
                const startTime = performance.now();
                const getRubric = window.getRubric;
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
                        unifiedResult.items.forEach((item, index) => {
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
                    }
                    else if (unifiedResult?.type === 'manual') {
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
                    }
                    else {
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
                }
                else {
                    results.push({
                        test: 'Unified getRubric',
                        status: 'error',
                        message: '❌ getRubric function not available'
                    });
                }
            }
            catch (error) {
                results.push({
                    test: 'Unified getRubric',
                    status: 'error',
                    message: `❌ Error: ${error.message}`
                });
            }
            // Test 3: API-based system (fetchRubricMap) - only for assignments with detailed logging
            this.updateProgress(3, 7, 'Testing API-based rubric system...');
            await this.delay(500);
            if (this.state?.assignmentType === 'assignments' && this.state?.courseId && this.state?.assignmentId) {
                try {
                    const startTime = performance.now();
                    const supergrader = window.supergrader;
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
                            Object.entries(rubricMap.questions).forEach(([qId, qData]) => {
                                console.log(`QUESTION ${qId}: "${qData.name}"`);
                                console.log(`  Style: ${qData.rubricStyle} | Parent: ${qData.parentId || 'none'}`);
                                console.log(`  Items (${qData.items.length}):`);
                                qData.items.forEach((item, index) => {
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
                        }
                        else {
                            results.push({
                                test: 'API fetchRubricMap',
                                status: 'error',
                                message: '❌ Invalid rubric map response',
                                timing
                            });
                        }
                    }
                    else {
                        results.push({
                            test: 'API fetchRubricMap',
                            status: 'error',
                            message: '❌ supergrader.testRubric not available'
                        });
                    }
                }
                catch (error) {
                    results.push({
                        test: 'API fetchRubricMap',
                        status: 'error',
                        message: `❌ Error: ${error.message}`
                    });
                }
            }
            else {
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
            const supergrader = window.supergrader;
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
                const getRubric = window.getRubric;
                const applyGrade = window.applyGrade;
                if (typeof getRubric === 'function' && typeof applyGrade === 'function') {
                    const rubricResult = getRubric();
                    if (rubricResult?.type === 'structured' && rubricResult.items.length > 0) {
                        const startTime = performance.now();
                        const firstItem = rubricResult.items[0];
                        // Test toggle (just get current state, don't actually change it)
                        const api = window.GradescopeAPI;
                        const isSelectedMethod = (api?.isRubricItemSelected) || ((element) => {
                            if (!element)
                                return false;
                            const input = element.querySelector('input[type="checkbox"], input[type="radio"]');
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
                    }
                    else if (rubricResult?.type === 'manual') {
                        results.push({
                            test: 'Toggle Functionality Check',
                            status: 'info',
                            message: 'ℹ️ Manual scoring - no items to toggle'
                        });
                    }
                    else {
                        results.push({
                            test: 'Toggle Functionality Check',
                            status: 'info',
                            message: 'ℹ️ No structured rubric items found'
                        });
                    }
                }
                else {
                    results.push({
                        test: 'Toggle Functionality Check',
                        status: 'error',
                        message: '❌ Toggle functions not available'
                    });
                }
            }
            catch (error) {
                results.push({
                    test: 'Toggle Functionality Check',
                    status: 'error',
                    message: `❌ Error: ${error.message}`
                });
            }
            // Test 6: Performance benchmark
            this.updateProgress(6, 7, 'Running performance benchmark...');
            await this.delay(500);
            try {
                const benchmarkResults = [];
                const getRubric = window.getRubric;
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
                }
                else {
                    results.push({
                        test: 'Performance Benchmark',
                        status: 'error',
                        message: '❌ Cannot benchmark - getRubric not available'
                    });
                }
            }
            catch (error) {
                results.push({
                    test: 'Performance Benchmark',
                    status: 'error',
                    message: `❌ Error: ${error.message}`
                });
            }
            // Test 7: Documentation and usage examples
            this.updateProgress(7, 7, 'Generating usage examples...');
            await this.delay(300);
            const hasRubricStructure = results.some(r => (r.test.includes('extractRubricStructure') || r.test.includes('getRubric')) &&
                r.status === 'success');
            results.push({
                test: 'Usage Examples',
                status: 'info',
                message: hasRubricStructure ?
                    'ℹ️ Check console for detailed usage examples' :
                    'ℹ️ Limited examples available (no structured rubric found)'
            });
        }
        catch (error) {
            results.push({
                test: 'Comprehensive Test',
                status: 'error',
                message: `❌ Unexpected error: ${error.message}`
            });
        }
        finally {
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
    showComprehensiveResults(results) {
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
        let messageType = 'success';
        if (errorCount === 0 && successCount > 0) {
            summaryMessage = `🎉 All tests passed! ${successCount} systems working correctly. Check console for details.`;
            messageType = 'success';
        }
        else if (errorCount > 0 && successCount > 0) {
            summaryMessage = `⚠️ Partial success: ${successCount} passed, ${errorCount} failed. Check console for details.`;
            messageType = 'info';
        }
        else if (errorCount > 0) {
            summaryMessage = `❌ Tests failed: ${errorCount} errors found. Check console for details.`;
            messageType = 'error';
        }
        else {
            summaryMessage = `ℹ️ Tests completed: No structured rubrics found on this page. Check console for details.`;
            messageType = 'info';
        }
        this.showError(summaryMessage, messageType);
        setTimeout(() => this.hideError(), 8000);
    }
    /**
     * Test API functionality - Week 2 Day 5: API Testing
     */
    async testAPI() {
        console.log('🧪 UIController: Starting comprehensive API testing (Day 5)...');
        // Show progress
        this.showProgress('Running API tests...', 0);
        // Update button state
        const testButton = this.aiPanel?.querySelector('#ai-api-test-button');
        if (testButton) {
            testButton.disabled = true;
            testButton.textContent = '🔄 Testing API...';
        }
        try {
            // Check if API testing function is available
            const supergrader = window.supergrader;
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
                const summary = results.reduce((acc, result) => {
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
                let messageType = 'success';
                if (failureCount === 0 && successCount > 0) {
                    message = `🎉 All API tests passed! ${successCount} tests successful. Check console for detailed results.`;
                    messageType = 'success';
                }
                else if (failureCount > 0 && successCount > 0) {
                    message = `⚠️ API tests completed: ${successCount} passed, ${failureCount} failed. Check console for details.`;
                    messageType = 'info';
                }
                else if (failureCount > 0) {
                    message = `❌ API tests failed: ${failureCount} errors found. Check console for troubleshooting.`;
                    messageType = 'error';
                }
                else {
                    message = `ℹ️ API tests completed: ${results.length} tests run. Check console for details.`;
                    messageType = 'info';
                }
                this.hideProgress();
                this.showError(message, messageType);
                setTimeout(() => this.hideError(), 10000);
            }
            else {
                throw new Error('No test results returned from API test suite');
            }
        }
        catch (error) {
            console.error('UIController: API testing failed:', error);
            this.hideProgress();
            this.showError(`❌ API testing failed: ${error.message}`);
        }
        finally {
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
    logUsageExamples() {
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
    showRubricData() {
        console.log('🔍 UIController: Showing rubric data...');
        const supergrader = window.supergrader;
        if (supergrader?.showRubricData) {
            supergrader.showRubricData();
            this.showError('✅ Rubric data shown in console - check F12 Developer Console', 'info');
            setTimeout(() => this.hideError(), 4000);
        }
        else {
            this.showError('❌ Rubric data function not available - try refreshing the page', 'error');
        }
    }
    /**
     * Simple delay helper for test pacing
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
// Create global instance
window.UIController = new UIController();
// Update console helper if it exists
if (window.supergrader) {
    window.supergrader.ui = window.UIController;
}
//# sourceMappingURL=ui-controller.js.map