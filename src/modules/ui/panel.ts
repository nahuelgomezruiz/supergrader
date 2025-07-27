// Panel UI component for SuperGrader
// Handles main AI grading panel creation and management

export interface PanelConfig {
  assignmentType: 'assignments' | 'questions' | null;
  assignmentId: string | null;
  submissionId: string | null;
}

export interface PanelElements {
  panel: HTMLElement;
  content: HTMLElement;
  header: HTMLElement;
  controls: HTMLElement;
  progress: HTMLElement;
  errors: HTMLElement;
}

export class Panel {
  private elements: PanelElements | null = null;
  private isVisible: boolean = true;

  /**
   * Create the main AI grading panel
   */
  create(config: PanelConfig): PanelElements {
    console.log('Panel: Creating AI grading panel...');

    // Remove any existing panel
    const existingPanel = document.getElementById('ai-gradescope-panel');
    if (existingPanel) {
      existingPanel.remove();
      console.log('Panel: Removed existing panel');
    }

    const assignmentTypeLabel = config.assignmentType === 'questions' ? 'Question' : 'Assignment';

    // Create main panel container
    const panel = document.createElement('div');
    panel.id = 'ai-gradescope-panel';
    panel.className = 'ai-grading-panel';

    // Create panel structure
    panel.innerHTML = `
      <div class="ai-panel-header">
         supergrader
        <div class="ai-panel-info">
          ${assignmentTypeLabel} ${config.assignmentId} | Submission ${config.submissionId}
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

    // Extract key elements for external access
    const elements: PanelElements = {
      panel,
      content: panel.querySelector('.ai-panel-content') as HTMLElement,
      header: panel.querySelector('.ai-panel-header') as HTMLElement,
      controls: panel.querySelector('.ai-controls') as HTMLElement,
      progress: panel.querySelector('.ai-progress') as HTMLElement,
      errors: panel.querySelector('.ai-errors') as HTMLElement
    };

    this.elements = elements;
    this.setupToggleListener();

    return elements;
  }

  /**
   * Insert panel into DOM safely with multiple strategies
   */
  insertSafely(injectionPoint: Element): void {
    if (!this.elements?.panel) {
      throw new Error('Panel not created yet');
    }

    try {
      // Strategy 1: Insert before injection point
      if (injectionPoint.parentNode) {
        injectionPoint.parentNode.insertBefore(this.elements.panel, injectionPoint);
        console.log('Panel: Inserted before injection point');
        return;
      }
      
      // Strategy 2: Insert as first child of injection point
      if (injectionPoint.children.length > 0) {
        injectionPoint.insertBefore(this.elements.panel, injectionPoint.firstChild);
        console.log('Panel: Inserted as first child');
        return;
      }
      
      // Strategy 3: Append to injection point
      injectionPoint.appendChild(this.elements.panel);
      console.log('Panel: Appended to injection point');
      
    } catch (error) {
      console.error('Panel: Failed to insert panel safely', error);
      // Final fallback - append to body
      document.body.appendChild(this.elements.panel);
      console.log('Panel: Appended to body as fallback');
    }
  }

  /**
   * Toggle panel visibility
   */
  toggle(): void {
    if (!this.elements) return;

    const { content } = this.elements;
    const toggle = this.elements.header.querySelector('.ai-panel-toggle') as HTMLButtonElement;
    
    if (!content || !toggle) return;
    
    this.isVisible = !this.isVisible;
    
    if (this.isVisible) {
      content.style.display = 'block';
      toggle.textContent = '−';
      toggle.setAttribute('title', 'Collapse panel');
      console.log('Panel: Expanded');
    } else {
      content.style.display = 'none';
      toggle.textContent = '+';
      toggle.setAttribute('title', 'Expand panel');
      console.log('Panel: Collapsed');
    }
  }

  /**
   * Setup toggle button listener
   */
  private setupToggleListener(): void {
    if (!this.elements) return;

    const toggleButton = this.elements.header.querySelector('.ai-panel-toggle') as HTMLButtonElement;
    if (toggleButton) {
      toggleButton.addEventListener('click', () => this.toggle());
    }
  }

  /**
   * Get panel elements for external access
   */
  getElements(): PanelElements | null {
    return this.elements;
  }

  /**
   * Check if panel is visible
   */
  isExpanded(): boolean {
    return this.isVisible;
  }
} 