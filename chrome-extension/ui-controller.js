// UI Controller module
// Manages the user interface elements and interactions

console.log('supergrader: UI Controller loaded');

/**
 * UI Controller class
 */
class UIController {
  constructor() {
    this.isInitialized = false;
    this.aiPanel = null;
    this.progressBar = null;
  }

  /**
   * Initialize the UI components
   */
  initialize(appState) {
    console.log('UIController: Initializing UI components...');
    
    if (this.isInitialized) {
      console.log('UIController: Already initialized');
      return;
    }

    try {
      this.createAIPanel();
      this.isInitialized = true;
      console.log('UIController: UI initialized successfully');
    } catch (error) {
      console.error('UIController: Failed to initialize UI', error);
    }
  }

  /**
   * Create the main AI grading panel
   */
  createAIPanel() {
    console.log('UIController: Creating AI grading panel...');
    
    // Find a good injection point in Gradescope UI
    const rubricContainer = document.querySelector('.rubric-container') || 
                           document.querySelector('.question-content') ||
                           document.querySelector('body');
    
    if (!rubricContainer) {
      console.error('UIController: Could not find injection point');
      return;
    }

    // Create the AI panel
    this.aiPanel = document.createElement('div');
    this.aiPanel.id = 'ai-gradescope-panel';
    this.aiPanel.className = 'ai-grading-panel';
    this.aiPanel.innerHTML = `
      <div class="ai-panel-header">
        🤖 supergrader
        <button class="ai-panel-toggle">−</button>
      </div>
      <div class="ai-panel-content">
        <div class="ai-status">Ready to assist with grading</div>
        <button class="ai-grade-button" disabled>Start AI Grading</button>
        <div class="ai-progress" style="display: none;">
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <div class="progress-text">Initializing...</div>
        </div>
      </div>
    `;

    // Insert the panel
    rubricContainer.parentNode.insertBefore(this.aiPanel, rubricContainer);
    
    // Add event listeners
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for UI interactions
   */
  setupEventListeners() {
    console.log('UIController: Setting up event listeners...');
    
    // Panel toggle
    const toggleButton = this.aiPanel.querySelector('.ai-panel-toggle');
    toggleButton.addEventListener('click', () => {
      this.togglePanel();
    });

    // Grade button (placeholder)
    const gradeButton = this.aiPanel.querySelector('.ai-grade-button');
    gradeButton.addEventListener('click', () => {
      this.startGrading();
    });
  }

  /**
   * Toggle panel visibility
   */
  togglePanel() {
    const content = this.aiPanel.querySelector('.ai-panel-content');
    const toggle = this.aiPanel.querySelector('.ai-panel-toggle');
    
    if (content.style.display === 'none') {
      content.style.display = 'block';
      toggle.textContent = '−';
    } else {
      content.style.display = 'none';
      toggle.textContent = '+';
    }
  }

  /**
   * Start the AI grading process (placeholder)
   */
  startGrading() {
    console.log('UIController: Starting AI grading process...');
    
    const button = this.aiPanel.querySelector('.ai-grade-button');
    const progress = this.aiPanel.querySelector('.ai-progress');
    
    button.disabled = true;
    button.textContent = 'Grading...';
    progress.style.display = 'block';
    
    // TODO: Implement actual grading workflow
    setTimeout(() => {
      button.disabled = false;
      button.textContent = 'Start AI Grading';
      progress.style.display = 'none';
      console.log('UIController: Grading simulation complete');
    }, 3000);
  }

  /**
   * Show uncertainty warning for specific rubric items
   */
  showUncertaintyWarning(uncertainItems) {
    console.log('UIController: Showing uncertainty warning for items:', uncertainItems);
    // TODO: Implement uncertainty UI
  }

  /**
   * Update progress indicator
   */
  updateProgress(step, total, message) {
    console.log(`UIController: Progress ${step}/${total} - ${message}`);
    // TODO: Implement progress updates
  }
}

// Create global instance
window.UIController = new UIController(); 