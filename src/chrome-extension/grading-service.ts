// Standalone grading service for Chrome extension
// This version doesn't use ES6 imports to avoid module issues

console.log('supergrader: Grading service loaded');

// Simple feedback UI implementation to avoid import issues
interface FeedbackUIConfig {
  rubricItemId: string;
  comment: string;
  decision: 'check' | 'uncheck' | string;
  confidence: number;
  element: HTMLElement;
}

interface FeedbackData {
  rubricItemId: string;
  rubricQuestion: string;
  studentAssignment: string;
  originalDecision: string;
  userFeedback: string;
}

class SimpleFeedbackUI {
  private feedbackBoxes: Map<string, HTMLElement> = new Map();
  private onFeedbackSubmit?: (data: FeedbackData) => void;

  constructor() {
    this.injectStyles();
  }

  onFeedback(cb: (data: FeedbackData) => void) {
    this.onFeedbackSubmit = cb;
  }

  clearAllSuggestions() {
    this.feedbackBoxes.forEach((el) => el.remove());
    this.feedbackBoxes.clear();
  }

  displaySuggestion(cfg: FeedbackUIConfig) {
    this.removeSuggestion(cfg.rubricItemId);
    const box = this.createBox(cfg);
    
    // Find the rubric editor container (right panel)
    const doc = cfg.element.ownerDocument || document;
    const rubricEditor = doc.querySelector('.rubricEditor');
    if (!rubricEditor) {
      console.error('SimpleFeedbackUI: Could not find .rubricEditor container');
      return;
    }

    // Find the specific rubric entry container for this item
    // It could be a .rubricEntry or within a .rubricEntryGroupBundle
    let insertTarget = cfg.element.closest('.rubricEntry');
    if (!insertTarget) {
      // Try finding the parent group bundle
      insertTarget = cfg.element.closest('.rubricEntryGroupBundle');
    }
    
    if (!insertTarget) {
      console.error('SimpleFeedbackUI: Could not find insertion target for item', cfg.rubricItemId);
      return;
    }

    // For group bundles, we want to insert after the entire bundle
    const targetContainer = insertTarget.closest('.rubricEntryGroupBundle') || insertTarget.closest('.rubricEntryDragContainer');
    if (!targetContainer) {
      console.error('SimpleFeedbackUI: Could not find container for item', cfg.rubricItemId);
      return;
    }

    // Insert the box right after the container
    targetContainer.insertAdjacentElement('afterend', box);
    
    // Style the box to match the rubric editor width and spacing
    box.style.margin = '8px 0';
    box.style.width = 'calc(100% - 16px)';
    box.style.marginLeft = '8px';
    box.style.marginRight = '8px';
    
    this.feedbackBoxes.set(cfg.rubricItemId, box);
  }

  private removeSuggestion(id: string) {
    const el = this.feedbackBoxes.get(id);
    if (el) {
      el.remove();
      this.feedbackBoxes.delete(id);
    }
  }

  private createBox(cfg: FeedbackUIConfig): HTMLElement {
    const div = document.createElement('div');
    div.className = 'supergrader-feedback-box';

    // Combine decision and comment into single text
    const combinedText = `${this.formatDecision(cfg.decision)}. ${cfg.comment}`;

    div.innerHTML = `
      <div class="sg-feedback-content">
        <div class="sg-combined-text">${this.escape(combinedText)}</div>
      </div>
      <div class="sg-feedback-actions"><button class="sg-nope-btn">NOPE</button></div>
      <div class="sg-feedback-form" style="display:none;">
        <textarea class="sg-feedback-input" rows="3" placeholder="I disagree because..."></textarea>
        <button class="sg-send-btn" disabled>Send</button>
      </div>`;

    // events (remove close button event listener)
    const nopeBtn = div.querySelector('.sg-nope-btn') as HTMLElement;
    const form = div.querySelector('.sg-feedback-form') as HTMLElement;
    const input = div.querySelector('.sg-feedback-input') as HTMLTextAreaElement;
    const sendBtn = div.querySelector('.sg-send-btn') as HTMLButtonElement;

    nopeBtn?.addEventListener('click', () => {
      form.style.display = 'block';
      nopeBtn.style.display = 'none';
      input.focus();
    });

    input.addEventListener('input', () => {
      sendBtn.disabled = input.value.trim().length === 0;
      
      // Auto-resize textarea based on content
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 170) + 'px'; // Max height of 150px
    });

    // Handle Enter key to send feedback
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !sendBtn.disabled) {
        e.preventDefault(); // Prevent new line
        sendBtn.click();
      }
    });

    sendBtn.addEventListener('click', () => {
      if (!this.onFeedbackSubmit || !input.value.trim()) return;
      const rubricQuestion = this.extractRubricQuestion(cfg.element);
      const studentAssignment = this.extractStudentAnswer(cfg.element.ownerDocument || document);
      this.onFeedbackSubmit({
        rubricItemId: cfg.rubricItemId,
        rubricQuestion,
        studentAssignment,
        originalDecision: `${cfg.decision} - ${cfg.comment}`,
        userFeedback: input.value.trim()
      });
      form.innerHTML = '<div class="sg-feedback-sent">✓ Feedback sent!</div>';
      setTimeout(() => this.removeSuggestion(cfg.rubricItemId), 2000);
    });

    return div;
  }

  private extractRubricQuestion(el: HTMLElement): string {
    const desc = el.querySelector('.rubricField-description');
    return desc?.textContent?.trim() || el.textContent?.trim() || '';
  }

  private extractStudentAnswer(doc: Document): string {
    const codeEls = doc.querySelectorAll('.submission-file-content, .hljs, pre code');
    if (codeEls.length) return Array.from(codeEls).map(e=>e.textContent?.trim()||'').join('\n\n');
    const textEls = doc.querySelectorAll('.submission-text, .answer-text');
    if (textEls.length) return Array.from(textEls).map(e=>e.textContent?.trim()||'').join('\n\n');
    const cont = doc.querySelector('.submission-container, .student-submission');
    return cont?.textContent?.trim() || 'Unable to extract student submission';
  }

  private formatDecision(decision: string) {
    if (decision === 'check') return 'Check';
    if (decision === 'uncheck') return 'Uncheck';
    return decision;
  }

  private escape(txt: string) {
    const d = document.createElement('div');
    d.textContent = txt;
    return d.innerHTML;
  }

  private injectStyles() {
    if (document.getElementById('supergrader-feedback-styles')) return;
    const style = document.createElement('style');
    style.id = 'supergrader-feedback-styles';
    style.textContent = `
      .supergrader-feedback-box{background:#20545c;border:2px solid #1a464d;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;overflow:hidden;position:relative;color:white}
      .sg-feedback-content{padding:12px}
      .sg-combined-text{color:white;line-height:1.4;margin-bottom:0;font-weight:495}
      .sg-feedback-actions{padding:0 12px 12px;display:flex;justify-content:flex-end}
      .sg-nope-btn{background:#dc3545;color:white;border:none;padding:8px 16px;border-radius:4px;font-weight:600;cursor:pointer;transition:background .2s;margin-right:12px}
      .sg-nope-btn:hover{background:#c82333}
      .sg-feedback-form{padding:12px;border-top:1px solid #1a464d;background:#20545c}
      .sg-feedback-input{width:100%;padding:8px;border:1px solid #1a464d;border-radius:4px;font-family:inherit;font-size:14px;resize:none;margin-bottom:8px;background:white;color:#333;min-height:80px;overflow:hidden}
      .sg-feedback-input:focus{outline:none;border-color:#0f3338;box-shadow:0 0 0 2px rgba(15,51,56,.3)}
      .sg-send-btn{background:#4a7c87;color:white;border:none;padding:6px 16px;border-radius:4px;font-weight:600;cursor:pointer;transition:background .2s;float:right;margin-bottom:8px}
      .sg-send-btn:hover:not(:disabled){background:#3d6b75}
      .sg-send-btn:disabled{background:#6c757d;cursor:not-allowed;opacity:.6}
      .sg-feedback-sent{text-align:center;color:white;font-weight:600;padding:20px}
    `;
    document.head.appendChild(style);
  }
}

// Types (duplicated to avoid imports)
interface BackendRubricItem {
  id: string;
  description: string;
  points: number;
  type: 'CHECKBOX' | 'RADIO';
  options?: Record<string, string>;
}

interface GradingRequest {
  assignment_context: {
    course_id: string;
    assignment_id: string;
    submission_id: string;
    assignment_name: string;
  };
  source_files: Record<string, string>;
  rubric_items: BackendRubricItem[];
}

interface GradingDecision {
  rubric_item_id: string;
  type: 'CHECKBOX' | 'RADIO';
  confidence: number;
  verdict: {
    decision?: 'check' | 'uncheck';
    selected_option?: string;
    comment: string;
    evidence: string;
  };
}

interface GradingEvent {
  type: 'partial_result' | 'job_complete' | 'error';
  rubric_item_id?: string;
  decision?: GradingDecision;
  progress?: number;
  message?: string;
  error?: string;
}

// Utility functions (using different names to avoid conflicts)
function getGradingDoc(): Document {
  const iframe = document.querySelector('iframe[src*="grade"]') as HTMLIFrameElement;
  return iframe?.contentDocument || document;
}

function waitDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main grading service class
class ChromeGradingService {
  private backendUrl: string;
  private api: any;
  private feedbackUI: SimpleFeedbackUI;

  constructor() {
    this.backendUrl = 'http://localhost:8000';
    this.api = (window as any).GradescopeAPI;
    this.feedbackUI = new SimpleFeedbackUI();
    
    // Set up feedback handler
    this.feedbackUI.onFeedback(async (feedback) => {
      await this.submitFeedback(feedback);
    });
  }

  /**
   * Extract assignment context from the current page
   */
  private extractAssignmentContext(): { course_id: string; assignment_id: string; submission_id: string; assignment_name: string } | null {
    const urlMatch = window.location.pathname.match(/\/courses\/(\d+)\/(assignments|questions)\/(\d+)\/submissions\/(\d+)\/grade/);
    if (!urlMatch) return null;

    const [, courseId, , assignmentId, submissionId] = urlMatch;
    
    // Try to get assignment name from page
    const root = getGradingDoc();
    let assignmentName = root.querySelector('.assignment-name, h1, .breadcrumb-item:last-child')?.textContent?.trim() || 
                          `Assignment ${assignmentId}`;
    
    // Clean up assignment name - remove "Select to navigate..." text
    assignmentName = assignmentName.replace(/\.\s*Select to navigate.*$/i, '').trim();

    return {
      course_id: courseId,
      assignment_id: assignmentId,
      submission_id: submissionId,
      assignment_name: assignmentName
    };
  }

  /**
   * Extract rubric directly from DOM with elements preserved
   */
  private async extractRubricFromDOM(): Promise<{ type: 'structured'; items: any[] }> {
    const root = getGradingDoc();
    const items: any[] = [];
    
    // Find all rubric groups and individual items
    const rubricGroups = Array.from(root.querySelectorAll('.rubricItemGroup'));
    const individualItems = Array.from(root.querySelectorAll('.rubricItem')).filter(item => 
      !item.closest('.rubricItemGroup')
    );
    
    console.log(`🔍 Found ${rubricGroups.length} groups and ${individualItems.length} individual items`);
    
    // Process groups first
    for (const group of rubricGroups) {
      const keyBtn = group.querySelector('.rubricItemGroup--key');
      const descEl = group.querySelector('.rubricField-description');
      const pointsEl = group.querySelector('.rubricField-points');
      
      if (keyBtn && descEl) {
        const id = keyBtn.textContent?.trim() || `group_${items.length}`;
        const description = this.extractTextWithSpacing(descEl);
        this.logTextExtractionDebug(id, descEl, description);
        const pointsText = pointsEl?.textContent?.trim() || '0';
        const points = parseFloat(pointsText.replace(/[^\d.-]/g, '')) || 0;
        
        // Check if it's "Select one" (radio) or "Select many" (checkbox group)
        const settingsBtn = group.querySelector('[aria-label*="Select one" i]');
        const isRadio = !!settingsBtn;
        
        items.push({
          id,
          description,
          points,
          element: group,
          itemType: isRadio ? 'RADIO' : 'CHECKBOX_GROUP'
        });
      }
    }
    
    // Process individual items
    for (const item of individualItems) {
      const keyBtn = item.querySelector('.rubricItem--key');
      const descEl = item.querySelector('.rubricField-description');
      const pointsEl = item.querySelector('.rubricField-points');
      
      if (keyBtn && descEl) {
        const id = keyBtn.textContent?.trim() || `item_${items.length}`;
        const description = this.extractTextWithSpacing(descEl);
        this.logTextExtractionDebug(id, descEl, description);
        const pointsText = pointsEl?.textContent?.trim() || '0';
        const points = parseFloat(pointsText.replace(/[^\d.-]/g, '')) || 0;
        
        items.push({
          id,
          description,
          points,
          element: item,
          itemType: 'CHECKBOX'
        });
      }
    }
    
    return { type: 'structured', items };
  }

    /**
   * Extract text content with proper spacing and bullet point preservation
   * Improved version that handles complex HTML structures more reliably
   */  
  private extractTextWithSpacing(element: Element): string {
    // Debug: Log the HTML structure for troubleshooting
    console.log('🔍 Extracting text from element:', {
      tagName: element.tagName,
      className: element.className,
      innerHTML: element.innerHTML.substring(0, 200) + (element.innerHTML.length > 200 ? '...' : '')
    });

    // Try multiple extraction approaches and pick the best one
    const approaches = [
      () => this.extractTextFromLists(element),
      () => this.extractTextSimple(element),
      () => element.textContent?.trim() || ''
    ];

    for (const approach of approaches) {
      try {
        const result = approach();
        if (result && result.length > 10) { // Prefer non-empty results
          console.log('✅ Using extraction result:', result.substring(0, 100) + '...');
          return result;
        }
      } catch (error) {
        console.warn('⚠️ Text extraction approach failed:', error);
      }
    }

    // Fallback to basic text content
    const fallback = element.textContent?.trim() || '';
    console.log('🔄 Using fallback extraction:', fallback.substring(0, 100) + '...');
    return fallback;
  }

  /**
   * Enhanced extraction that properly handles list structures **in order** and preserves newlines
   */
  private extractTextFromLists(element: Element): string {
    let result = '';

    const processNode = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        const txt = node.textContent?.trim();
        if (txt) {
          // Append text with a space if previous char isn't whitespace or newline
          if (result && !result.match(/[\s\n]$/)) {
            result += ' ';
          }
          result += txt;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        if (tag === 'br') {
          result += '\n';
        } else if (tag === 'ul' || tag === 'ol') {
          // Iterate over direct li children in order
          const lis = Array.from(el.querySelectorAll(':scope > li'));
          lis.forEach((li, idx) => {
            // Start each bullet on a new line except maybe first if newline already exists
            if (result && !result.endsWith('\n')) {
              result += '\n';
            }
            result += `• ${li.textContent?.trim()}`;
            if (idx < lis.length - 1) {
              result += '\n';
            }
          });
          // Add newline after list end
          result += '\n';
        } else {
          // Recurse through children to keep order
          Array.from(el.childNodes).forEach(child => processNode(child));
        }
      }
    };

    Array.from(element.childNodes).forEach(child => processNode(child));

    // Post-processing: collapse extra spaces but keep newlines
    return result
      .replace(/[ \t]+\n/g, '\n')   // remove trailing spaces before newline
      .replace(/\n{2,}/g, '\n')      // collapse multiple blank lines
      .replace(/\s+$/g, '')           // trim trailing whitespace
      .trim();
  }

  /**
   * Get direct text content of an element, excluding nested lists
   */
  private getDirectTextContent(element: Element): string {
    const clone = element.cloneNode(true) as Element;
    
    // Remove list elements to get main text
    const lists = clone.querySelectorAll('ul, ol');
    lists.forEach(list => list.remove());
    
    return clone.textContent?.trim() || '';
  }

  /**
   * Simple fallback extraction method
   */
  private extractTextSimple(element: Element): string {
    // Use innerText which respects display formatting better than textContent
    const text = (element as HTMLElement).innerText || element.textContent || '';
    
    return text
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/\n\s*/g, ' ')         // Convert newlines to spaces
      .trim();
  }

  /**
   * Debug helper: Log the extracted text for a rubric item  
   */
  private logTextExtractionDebug(itemId: string, element: Element, extractedText: string): void {
    console.log(`📝 Text extraction for item ${itemId}:`, {
      originalHTML: element.innerHTML.substring(0, 300) + '...',
      extractedText: extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : ''),
      hasListItems: element.querySelectorAll('li').length > 0,
      listItemCount: element.querySelectorAll('li').length
    });
  }

  /**
   * Extract nested checkboxes from a group (like Program Design)
   */
  private async extractNestedCheckboxes(groupElement: HTMLElement, parentId: string, parentDescription: string): Promise<BackendRubricItem[]> {
    const items: BackendRubricItem[] = [];
    
    // Expand the group if needed
    const expandBtn = groupElement.querySelector('button[aria-expanded="false"]');
    if (expandBtn) {
      (expandBtn as HTMLElement).click();
      await waitDelay(350);
    }

    // The container might be a sibling or referenced by aria-controls
    let container: HTMLElement | null = groupElement.parentElement?.querySelector('.rubricItemGroup--rubricItems') || 
                                       groupElement.querySelector('.rubricItemGroup--rubricItems');
    
    // If not found, try using aria-controls from the expand button
    if (!container) {
      const expandBtn = groupElement.querySelector('button[aria-controls]');
      const controlsId = expandBtn?.getAttribute('aria-controls');
      if (controlsId) {
        container = getGradingDoc().getElementById(controlsId);
      }
    }
    
    console.log(`🔍 Looking for nested items in group ${parentId} (${parentDescription}):`, {
      foundContainer: !!container,
      containerClass: container?.className,
      directChildren: groupElement.querySelectorAll('.rubricItem').length
    });
    
    const nestedElements = container ? container.querySelectorAll('.rubricItem') : [];
    
    nestedElements.forEach((elem, index) => {
      const keyEl = elem.querySelector('.rubricItem--key');
      const descEl = elem.querySelector('.rubricField-description');
      const pointsEl = elem.querySelector('.rubricField-points');
      
      if (keyEl && descEl) {
        const childId = keyEl.textContent?.trim() || `${index}`;
        const itemId = `${parentId}-${childId}`; // Create hierarchical ID like "1-Q"
        
        // Extract text with proper spacing for list items
        let description = this.extractTextWithSpacing(descEl);
        description = description.replace(/^Grading comment:\s*/i, '').trim();
        
        const pointsText = pointsEl?.textContent?.trim() || '0';
        const points = parseFloat(pointsText.replace(/[^\d.-]/g, '')) || 0;
        
        items.push({
          id: itemId,
          description: `${parentDescription}. ${description}`,
          points: points,
          type: 'CHECKBOX'
        });
      }
    });

    // Collapse the group back
    const collapseBtn = groupElement.querySelector('button[aria-expanded="true"]');
    if (collapseBtn) {
      (collapseBtn as HTMLElement).click();
      await waitDelay(150);
    }

    return items;
  }

  /**
   * Extract all radio button options by expanding accordions
   */
  private async extractRadioOptions(groupElement: HTMLElement): Promise<Record<string, string>> {
    const options: Record<string, string> = {};

    // Expand the accordion if needed
    const expandBtn = groupElement.querySelector('button[aria-expanded="false"]');
    if (expandBtn) {
      (expandBtn as HTMLElement).click();
      await waitDelay(350);
    }

    // The options live in a sibling container with class rubricItemGroup--rubricItems
    let container: HTMLElement | null = groupElement.parentElement?.querySelector('.rubricItemGroup--rubricItems') || 
                                       groupElement.querySelector('.rubricItemGroup--rubricItems');
    
    // If not found, try using aria-controls from the expand button
    if (!container) {
      const expandBtn = groupElement.querySelector('button[aria-controls]');
      const controlsId = expandBtn?.getAttribute('aria-controls');
      if (controlsId) {
        container = getGradingDoc().getElementById(controlsId);
      }
    }
    
    console.log(`🔍 Looking for radio options:`, {
      foundContainer: !!container,
      containerClass: container?.className,
      optionsFound: container ? container.querySelectorAll('.rubricItem').length : 0
    });
    
    const radioOptions: Element[] = container ? Array.from(container.querySelectorAll('.rubricItem')) : [];
    
    // QWERTY order for option letters
    const QWERTY_LETTERS = "QWERTYUIOPASDFGHJKLZXCVBNM";
    
    // First pass: extract all options with their points to determine max points
    const optionData: Array<{letter: string, description: string, points: number}> = [];
    let maxPoints = 0;
    
    radioOptions.forEach((optionElement, index) => {
      const descEl = optionElement.querySelector('.rubricField-description');
      const pointsEl = optionElement.querySelector('.rubricField-points');
      
      let optionDesc = '';
      let points = 0;
      
      if (descEl) {
        // Extract text with proper spacing for list items
        optionDesc = this.extractTextWithSpacing(descEl);
        // Clean up the description
        optionDesc = optionDesc.replace(/^Grading comment:\s*/, '').trim();
      }
      
      if (pointsEl) {
        const pointsText = pointsEl.textContent?.trim() || '0';
        points = parseFloat(pointsText.replace(/[^\d.-]/g, '')) || 0;
        maxPoints = Math.max(maxPoints, points);
      }
      
      if (optionDesc && index < QWERTY_LETTERS.length) {
        const optionLetter = QWERTY_LETTERS[index];
        optionData.push({
          letter: optionLetter,
          description: optionDesc,
          points: points
        });
      }
    });
    
    // Second pass: add credit labels based on points
    optionData.forEach(option => {
      let creditLabel = '';
      if (option.points === maxPoints && maxPoints > 0) {
        creditLabel = ' (Full credit)';
      } else if (option.points > 0 && option.points < maxPoints) {
        creditLabel = ' (Partial credit)';
      } else if (option.points === 0) {
        creditLabel = ' (No credit)';
      }
      
      options[option.letter] = option.description + creditLabel;
    });

    console.log(`📊 Radio options with credit labels:`, options);

    // Collapse the accordion back
    const collapseBtn = groupElement.querySelector('button[aria-expanded="true"]');
    if (collapseBtn) {
      (collapseBtn as HTMLElement).click();
      await waitDelay(150);
    }

    return options;
  }

  /**
   * Convert rubric items to backend format
   */
  private async convertRubricToBackendFormat(rubricResult: any): Promise<BackendRubricItem[]> {
    if (!rubricResult || !rubricResult.items || !Array.isArray(rubricResult.items)) {
      return [];
    }

    const backendItems: BackendRubricItem[] = [];

    console.log(`🔍 Processing ${rubricResult.items.length} rubric items...`);
    
    for (const item of rubricResult.items) {
      console.log(`🔍 Raw item ${item.id}:`, {
        description: item.description?.substring(0, 100),
        itemType: item.itemType,
        points: item.points,
        hasElement: !!item.element
      });
      
      // Clean up description - remove "Grading comment:" prefix and emoji prefixes
      let cleanDescription = item.description
        .replace(/^Grading comment:\s*/i, '')
        .replace(/^📻\s*/i, '')
        .replace(/^☑️\s*/i, '')
        .replace(/^✅\s*/i, '')
        .trim();
      
      // Use the itemType we determined during DOM extraction
      const isRadio = item.itemType === 'RADIO';
      const isNestedGroup = item.itemType === 'CHECKBOX_GROUP';
      
      console.log(`🔍 Item ${item.id} debug:`, {
        cleanDescription: cleanDescription.substring(0, 50),
        itemType: item.itemType,
        isRadio,
        isNestedGroup,
        elementClasses: item.element?.className
      });
      
      if (isNestedGroup && !isRadio) {
        // This is a nested checkbox group - expand it and extract individual items
        console.log(`📦 Expanding nested checkbox group: ${item.id} - ${cleanDescription}`);
        const nestedItems = await this.extractNestedCheckboxes(item.element, item.id, cleanDescription);
        console.log(`  ✅ Extracted ${nestedItems.length} nested items`);
        backendItems.push(...nestedItems);
      } else if (isRadio && item.element) {
        // This is a radio button group
        const radioTitle = cleanDescription.split('(')[0].trim();
        console.log(`📻 Extracting options for radio group: ${item.id} - ${radioTitle}`);
        
        const backendItem: BackendRubricItem = {
          id: item.id,
          description: radioTitle,
          points: item.points,
          type: 'RADIO'
        };
        
        const options = await this.extractRadioOptions(item.element);
        if (Object.keys(options).length > 0) {
          backendItem.options = options;
          console.log(`  Found ${Object.keys(options).length} options:`, options);
        } else {
          console.log(`  ⚠️ No options found, will retry with expansion`);
        }
        
        backendItems.push(backendItem);
      } else {
        // Regular checkbox item
        const backendItem: BackendRubricItem = {
          id: item.id,
          description: cleanDescription,
          points: item.points,
          type: 'CHECKBOX'
        };
        backendItems.push(backendItem);
      }
    }

    // Filter out zero-point checkbox items and bonus point questions (they don't contribute to grade and are often just for human graders)
    const filteredItems = backendItems.filter(item => {
      if (item.type === 'CHECKBOX' && item.points === 0) {
        console.log(`🚫 Filtering out zero-point checkbox: ${item.id} - "${item.description}"`);
        return false;
      }
      if (item.description && item.description.toLowerCase().includes('(bonus point)')) {
        console.log(`🚫 Filtering out bonus point question: ${item.id} - "${item.description}"`);
        return false;
      }
      return true;
    });

    const filteredCount = backendItems.length - filteredItems.length;
    if (filteredCount > 0) {
      console.log(`✅ Filtered out ${filteredCount} zero-point checkbox items. Sending ${filteredItems.length} items to backend.`);
    }

    // Scroll back to top of grading panel after processing all toggles
    this.scrollToTopOfGradingPanel();

    return filteredItems;
  }

  /**
   * Scroll to the top of the grading panel after scraping toggle options
   */
  private scrollToTopOfGradingPanel(): void {
    try {
      const doc = getGradingDoc();
      
      // Find the main grading container/panel
      const gradingPanel = doc.querySelector('.rubricEditor') || 
                          doc.querySelector('.grading-panel') ||
                          doc.querySelector('[class*="grading"]') ||
                          doc.querySelector('[class*="rubric"]');
      
      if (gradingPanel) {
        console.log('📜 Scrolling grading panel to top...');
        gradingPanel.scrollTop = 0;
        
        // Also try scrolling the parent container if it's scrollable
        let parent = gradingPanel.parentElement;
        while (parent && parent !== doc.body) {
          const style = getComputedStyle(parent);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            parent.scrollTop = 0;
            console.log('📜 Also scrolled parent container to top');
            break;
          }
          parent = parent.parentElement;
        }
        
        // Fallback: scroll the entire document/iframe to top
        doc.documentElement.scrollTop = 0;
        doc.body.scrollTop = 0;
        
        console.log('✅ Scrolled to top of grading panel');
      } else {
        console.warn('⚠️ Could not find grading panel to scroll');
        // Fallback: just scroll the document to top
        doc.documentElement.scrollTop = 0;
        doc.body.scrollTop = 0;
      }
    } catch (error) {
      console.error('❌ Error scrolling to top:', error);
    }
  }

  private isTestFile(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    // Core source files we do NOT treat as tests
    if (lower.endsWith('.cpp') || lower.endsWith('.h')) return false;

    const baseName = lower.split('/').pop() || lower;
    if (baseName === 'makefile' || baseName.startsWith('readme')) return false;

    // Everything else is considered a test/auxiliary file
    return true;
  }

  /**
   * Grade submission using the backend API
   */
  async gradeSubmission(onProgress?: (event: GradingEvent) => void): Promise<void> {
    console.log('🚀 Starting grading process...');

    // Clear any existing feedback boxes
    this.feedbackUI.clearAllSuggestions();

    // Extract assignment context
    const context = this.extractAssignmentContext();
    if (!context) {
      throw new Error('Could not extract assignment context from page');
    }
    console.log('📋 Assignment context:', context);

    // Get the GradescopeAPI instance
    const api = (window as any).GradescopeAPI;
    if (!api) {
      throw new Error('GradescopeAPI not initialized');
    }

    // Extract rubric structure directly from DOM since the API doesn't preserve elements
    console.log('🔍 Extracting rubric directly from DOM...');
    const rubricResult = await this.extractRubricFromDOM();

    console.log(`📊 Found ${rubricResult.items.length} rubric items`);

    // Download submission files
    console.log('📥 Downloading submission files...');
    let downloadResult: any;
    try {
      if (!api.downloadSubmissionFiles) {
        throw new Error('GradescopeAPI download method not available');
      }
      downloadResult = await api.downloadSubmissionFiles(context.submission_id);
      console.log(`✅ Downloaded ${Object.keys(downloadResult.files).length} files`);
    } catch (error) {
      console.error('❌ Error downloading files:', error);
      throw new Error(`Failed to download submission files: ${(error as Error).message}`);
    }

    // Convert rubric to backend format
    console.log('🔄 Converting rubric to backend format...');
    console.log('🔍 Input rubric structure:', rubricResult);
    const backendRubricItems = await this.convertRubricToBackendFormat(rubricResult);

    // Prepare request
    const request: GradingRequest = {
      assignment_context: context,
      source_files: Object.fromEntries(
        Object.entries(downloadResult.files).map(([path, file]: [string, any]) => {
          let content: string = file.content;
          if (this.isTestFile(path) && typeof content === 'string') {
            if (content.length > 100) {
              content = content.slice(0, 100) + '[TRIMMED]';
            }
          }
          return [path, content];
        })
      ),
      rubric_items: backendRubricItems.sort((a, b) => {
        // QWERTY keyboard order for letter suffixes (matches Gradescope UI)
        const qwertyOrder = 'QWERTYUIOPASDFGHJKLZXCVBNM';
        
        // Custom sort to put ID "0" after ID "9" 
        if (a.id === "0" && b.id === "9") return 1;  // 0 comes after 9
        if (a.id === "9" && b.id === "0") return -1; // 9 comes before 0
        
        // Check if IDs are hierarchical (e.g., "6-Q", "6-W")
        const aMatch = a.id.match(/^(\d+)-([A-Z])$/);
        const bMatch = b.id.match(/^(\d+)-([A-Z])$/);
        
        if (aMatch && bMatch) {
          const [, aNum, aLetter] = aMatch;
          const [, bNum, bLetter] = bMatch;
          
          // First compare the numeric part
          const numDiff = parseInt(aNum) - parseInt(bNum);
          if (numDiff !== 0) return numDiff;
          
          // If numeric parts are equal, compare letters by QWERTY order
          const aLetterIndex = qwertyOrder.indexOf(aLetter);
          const bLetterIndex = qwertyOrder.indexOf(bLetter);
          return aLetterIndex - bLetterIndex;
        }
        
        // For single digit IDs, treat "0" as if it were "9.5" 
        const getNumericValue = (id: string) => {
          if (id === "0") return 9.5;
          const num = parseInt(id);
          return isNaN(num) ? Infinity : num;
        };
        
        const aNum = getNumericValue(a.id);
        const bNum = getNumericValue(b.id);
        
        // If both are numeric (including our special "0" case)
        if (aNum !== Infinity && bNum !== Infinity) {
          return aNum - bNum;
        }
        
        // Otherwise use normal string comparison
        return a.id.localeCompare(b.id);
      })
    };

    console.log('📤 Sending grading request to backend...');
    console.log('Request JSON:', JSON.stringify(request, null, 2));

    // Send request to backend with SSE streaming
    try {
      const response = await fetch(`${this.backendUrl}/api/v1/grade-submission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend error (${response.status}): ${errorText}`);
      }

      // Process SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: GradingEvent = JSON.parse(line.slice(6));
              console.log('📨 Received event:', event);

              if (onProgress) {
                onProgress(event);
              }

              // Log specific event types
              if (event.type === 'partial_result' && event.decision) {
                console.log(`✅ Graded ${event.rubric_item_id}:`, {
                  confidence: `${(event.decision.confidence * 100).toFixed(1)}%`,
                  verdict: event.decision.verdict
                });

                // Display the suggestion in the UI
                await this.displayGradingSuggestion(event.decision);
              } else if (event.type === 'error') {
                console.error('❌ Backend error:', event.error);
              }
            } catch (e) {
              console.error('Error parsing SSE event:', e, 'Line:', line);
            }
          }
        }
      }

      console.log('✅ Grading completed successfully');
    } catch (error) {
      console.error('❌ Error during grading:', error);
      throw error;
    }
  }

  /**
   * Display grading suggestion in the UI
   */
  private async displayGradingSuggestion(decision: any): Promise<void> {
    try {
      // Get the current rubric structure
      const rubricResult = await this.extractRubricFromDOM();
      if (!rubricResult || rubricResult.type !== 'structured') {
        console.error('No structured rubric found for displaying suggestion');
        return;
      }

      const targetItem = rubricResult.items.find((item: any) => item.id === decision.rubric_item_id);
      if (!targetItem || !targetItem.element) {
        console.error(`Rubric item ${decision.rubric_item_id} not found for displaying suggestion`);
        return;
      }

      // Determine the decision format
      let formattedDecision: string;
      if (decision.type === 'CHECKBOX') {
        formattedDecision = decision.verdict.decision || 'uncheck';
      } else if (decision.type === 'RADIO' && decision.verdict.selected_option) {
        formattedDecision = decision.verdict.selected_option;
      } else {
        formattedDecision = 'Unknown';
      }

      // Display the suggestion
      this.feedbackUI.displaySuggestion({
        rubricItemId: decision.rubric_item_id,
        comment: decision.verdict.comment,
        decision: formattedDecision,
        confidence: decision.confidence,
        element: targetItem.element
      });

      // Auto-apply the decision if enabled
      const settings = await this.getSettings();
      if (settings.autoApplyHighConfidence && 
          decision.confidence >= (settings.confidenceThreshold || 0.8)) {
        await this.applyGradingDecision(decision);
        console.log(`✅ Auto-applied decision for ${decision.rubric_item_id}`);
      }
    } catch (error) {
      console.error('Error displaying grading suggestion:', error);
    }
  }

  /**
   * Apply a grading decision to the Gradescope UI
   */
  private async applyGradingDecision(decision: any): Promise<void> {
    try {
      const api = (window as any).GradescopeAPI;
      if (!api) {
        throw new Error('GradescopeAPI not available');
      }

      if (decision.type === 'CHECKBOX') {
        const shouldCheck = decision.verdict.decision === 'check';
        if (shouldCheck) {
          await api.checkRubricItem(decision.rubric_item_id);
        } else {
          await api.uncheckRubricItem(decision.rubric_item_id);
        }
      } else if (decision.type === 'RADIO' && decision.verdict.selected_option) {
        await api.selectRubricOption(decision.rubric_item_id, decision.verdict.selected_option);
      }

      console.log(`✅ Applied grading decision for ${decision.rubric_item_id}`);
    } catch (error) {
      console.error('Error applying grading decision:', error);
      throw error;
    }
  }

  /**
   * Submit feedback to the backend
   */
  private async submitFeedback(feedback: FeedbackData): Promise<void> {
    try {
      const response = await fetch(`${this.backendUrl}/api/v1/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(feedback)
      });

      if (!response.ok) {
        throw new Error(`Failed to submit feedback: ${response.statusText}`);
      }

      console.log('✅ Feedback submitted successfully');
    } catch (error) {
      console.error('❌ Error submitting feedback:', error);
      // TODO: Show error to user
    }
  }

  /**
   * Get extension settings
   */
  private async getSettings(): Promise<any> {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['autoApplyHighConfidence', 'confidenceThreshold'], (settings) => {
        resolve(settings);
      });
    });
  }

}

// Make the service available globally
console.log('supergrader: Making ChromeGradingService available globally');
(window as any).ChromeGradingService = ChromeGradingService;
console.log('supergrader: ChromeGradingService is now available at window.ChromeGradingService'); 