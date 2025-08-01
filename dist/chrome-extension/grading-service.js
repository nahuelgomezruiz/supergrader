"use strict";
// Standalone grading service for Chrome extension
// This version doesn't use ES6 imports to avoid module issues
console.log('supergrader: Grading service loaded');
class SimpleFeedbackUI {
    constructor() {
        this.feedbackBoxes = new Map();
        this.injectStyles();
    }
    onFeedback(cb) {
        this.onFeedbackSubmit = cb;
    }
    clearAllSuggestions() {
        this.feedbackBoxes.forEach((el) => el.remove());
        this.feedbackBoxes.clear();
    }
    displaySuggestion(cfg) {
        this.removeSuggestion(cfg.rubricItemId);
        const box = this.createBox(cfg);
        // Find the rubric editor container (right panel)
        const doc = cfg.element.ownerDocument || document;
        const rubricEditor = doc.querySelector('.rubricEditor');
        if (!rubricEditor) {
            console.error('SimpleFeedbackUI: Could not find .rubricEditor container');
            return;
        }
        // Verify the element is still in the DOM and visible
        if (!doc.contains(cfg.element)) {
            console.warn(`Element for ${cfg.rubricItemId} is no longer in DOM - suggestion may be misplaced`);
        }
        // Determine insertion strategy based on item type
        let insertTarget = null;
        // Check if this is a nested checkbox (ID format: "parentId-childId")
        if (cfg.rubricItemId.includes('-')) {
            // For nested checkboxes, find the most specific container
            insertTarget = cfg.element.closest('.rubricEntryDragContainer');
            // If not found, try to find the parent group and look for the specific item
            if (!insertTarget) {
                const [parentId] = cfg.rubricItemId.split('-');
                const parentGroup = Array.from(doc.querySelectorAll('.rubricItemGroup')).find(group => {
                    const keyBtn = group.querySelector('.rubricItemGroup--key');
                    return keyBtn?.textContent?.trim() === parentId;
                });
                if (parentGroup) {
                    // Look for the specific nested item within the expanded group
                    const nestedContainer = parentGroup.parentElement?.querySelector('.rubricItemGroup--rubricItems');
                    if (nestedContainer) {
                        const nestedItems = Array.from(nestedContainer.querySelectorAll('.rubricItem'));
                        const targetNested = nestedItems.find(item => item.contains(cfg.element));
                        if (targetNested) {
                            insertTarget = targetNested.closest('.rubricEntryDragContainer') || targetNested;
                        }
                    }
                }
            }
            console.log(`📍 Inserting nested checkbox suggestion for ${cfg.rubricItemId} after:`, insertTarget?.className || 'NOT_FOUND');
        }
        else {
            // For top-level items, use the existing logic with better fallbacks
            let rubricEntry = cfg.element.closest('.rubricEntry');
            if (!rubricEntry) {
                rubricEntry = cfg.element.closest('.rubricEntryGroupBundle');
            }
            if (rubricEntry) {
                insertTarget = rubricEntry.closest('.rubricEntryGroupBundle') || rubricEntry.closest('.rubricEntryDragContainer') || rubricEntry;
            }
            console.log(`📍 Inserting top-level suggestion for ${cfg.rubricItemId} after:`, insertTarget?.className || 'NOT_FOUND');
        }
        // If we couldn't find a good insertion point, fall back to appending to the end of the rubric editor
        if (!insertTarget) {
            console.warn(`⚠️ Could not find proper insertion target for ${cfg.rubricItemId}, appending to rubric editor`);
            rubricEditor.appendChild(box);
        }
        else {
            // Insert the box right after the target
            insertTarget.insertAdjacentElement('afterend', box);
        }
        // Style the box to match the rubric editor width and spacing
        box.style.margin = '8px 0';
        box.style.width = 'calc(100% - 16px)';
        box.style.marginLeft = '8px';
        box.style.marginRight = '8px';
        this.feedbackBoxes.set(cfg.rubricItemId, box);
    }
    removeSuggestion(id) {
        const el = this.feedbackBoxes.get(id);
        if (el) {
            el.remove();
            this.feedbackBoxes.delete(id);
        }
    }
    createBox(cfg) {
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
        const nopeBtn = div.querySelector('.sg-nope-btn');
        const form = div.querySelector('.sg-feedback-form');
        const input = div.querySelector('.sg-feedback-input');
        const sendBtn = div.querySelector('.sg-send-btn');
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
            if (!this.onFeedbackSubmit || !input.value.trim())
                return;
            const rubricQuestion = this.extractRubricQuestion(cfg.element);
            const studentAssignment = this.extractStudentAnswer(cfg.element.ownerDocument || document);
            this.onFeedbackSubmit({
                rubricItemId: cfg.rubricItemId,
                rubricQuestion,
                studentAssignment,
                originalDecision: `${cfg.decision} - ${cfg.comment}`,
                userFeedback: input.value.trim()
            });
            form.innerHTML = '<div class="sg-feedback-sent">Feedback sent!</div>';
            setTimeout(() => this.removeSuggestion(cfg.rubricItemId), 2000);
        });
        return div;
    }
    extractRubricQuestion(el) {
        const desc = el.querySelector('.rubricField-description');
        return desc?.textContent?.trim() || el.textContent?.trim() || '';
    }
    extractStudentAnswer(doc) {
        const codeEls = doc.querySelectorAll('.submission-file-content, .hljs, pre code');
        if (codeEls.length)
            return Array.from(codeEls).map(e => e.textContent?.trim() || '').join('\n\n');
        const textEls = doc.querySelectorAll('.submission-text, .answer-text');
        if (textEls.length)
            return Array.from(textEls).map(e => e.textContent?.trim() || '').join('\n\n');
        const cont = doc.querySelector('.submission-container, .student-submission');
        return cont?.textContent?.trim() || 'Unable to extract student submission';
    }
    formatDecision(decision) {
        if (decision === 'check')
            return 'Check';
        if (decision === 'uncheck')
            return 'Uncheck';
        return decision;
    }
    escape(txt) {
        const d = document.createElement('div');
        d.textContent = txt;
        return d.innerHTML;
    }
    injectStyles() {
        if (document.getElementById('supergrader-feedback-styles'))
            return;
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
      
      /* Loading Overlay Styles */
      .supergrader-loading-overlay {
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        pointer-events: auto;
      }
      
      .sg-loading-content {
        text-align: center;
        color: #495057;
        background: rgba(255, 255, 255, 0.95);
        padding: 24px 32px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        border: 1px solid rgba(0, 0, 0, 0.08);
      }
      
      .sg-loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #e9ecef;
        border-top: 3px solid #20545c;
        border-radius: 50%;
        animation: sg-spin 1s linear infinite;
        margin: 0 auto 16px;
      }
      
      .sg-loading-text {
        font-size: 14px;
        font-weight: 500;
        color: #495057;
        margin: 0;
      }
      
      .sg-loading-subtext {
        font-size: 12px;
        color: #6c757d;
        margin: 4px 0 0 0;
        font-weight: 400;
      }
      
      @keyframes sg-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
        document.head.appendChild(style);
    }
    showLoadingOverlay(message = 'Collecting assignment data...', subtext = 'Please wait while we analyze the rubric and files') {
        this.hideLoadingOverlay(); // Remove any existing overlay
        const doc = getGradingDoc();
        const rubricEditor = doc.querySelector('.rubricEditor');
        if (!rubricEditor) {
            console.warn('Could not find .rubricEditor to show loading overlay');
            return;
        }
        // Get the rubricEditor's position and dimensions for fixed positioning
        const rect = rubricEditor.getBoundingClientRect();
        const scrollTop = doc.documentElement.scrollTop || doc.body.scrollTop;
        const scrollLeft = doc.documentElement.scrollLeft || doc.body.scrollLeft;
        const overlay = doc.createElement('div');
        overlay.className = 'supergrader-loading-overlay';
        overlay.id = 'supergrader-loading-overlay';
        // Use fixed positioning to prevent movement during scrolling
        overlay.style.position = 'fixed';
        overlay.style.top = `${rect.top}px`;
        overlay.style.left = `${rect.left}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
        overlay.style.zIndex = '10000';
        overlay.innerHTML = `
      <div class="sg-loading-content">
        <div class="sg-loading-spinner"></div>
        <div class="sg-loading-text">${this.escape(message)}</div>
        <div class="sg-loading-subtext">${this.escape(subtext)}</div>
      </div>
    `;
        // Prevent all interaction with the rubric editor
        overlay.addEventListener('click', (e) => e.stopPropagation());
        overlay.addEventListener('mousedown', (e) => e.stopPropagation());
        overlay.addEventListener('keydown', (e) => e.stopPropagation());
        overlay.addEventListener('touchstart', (e) => e.stopPropagation());
        // Append to document body instead of rubricEditor to avoid scroll issues
        doc.body.appendChild(overlay);
        console.log('🔒 Loading overlay shown - rubric interaction blocked');
    }
    hideLoadingOverlay() {
        const doc = getGradingDoc();
        const existingOverlay = doc.getElementById('supergrader-loading-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
            console.log('🔓 Loading overlay hidden - rubric interaction restored');
        }
    }
    updateLoadingOverlay(message, subtext) {
        const doc = getGradingDoc();
        const overlay = doc.getElementById('supergrader-loading-overlay');
        if (overlay) {
            const textEl = overlay.querySelector('.sg-loading-text');
            const subtextEl = overlay.querySelector('.sg-loading-subtext');
            if (textEl)
                textEl.textContent = message;
            if (subtextEl && subtext)
                subtextEl.textContent = subtext;
        }
    }
}
// Utility functions (using different names to avoid conflicts)
function getGradingDoc() {
    const iframe = document.querySelector('iframe[src*="grade"]');
    return iframe?.contentDocument || document;
}
function waitDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Main grading service class
class ChromeGradingService {
    constructor() {
        this.cachedDecisions = new Map();
        this.cachedFiles = new Map(); // Cache for downloaded files
        // Enhanced caching system for nested data
        this.cachedNestedElements = new Map(); // Cache DOM elements for nested items
        this.cachedNestedData = new Map(); // Cache extracted nested checkbox data
        this.cachedRadioOptions = new Map(); // Cache radio options
        // Suggestion processing state
        this.isProcessingSuggestions = false;
        this.suggestionProcessingTimer = null;
        this.backendUrl = 'http://localhost:8000';
        this.api = window.GradescopeAPI;
        this.feedbackUI = new SimpleFeedbackUI();
        // Set up feedback handler
        this.feedbackUI.onFeedback(async (feedback) => {
            await this.submitFeedback(feedback);
        });
        // Set up listener to re-display suggestions when groups are expanded
        this.setupToggleListener();
    }
    /**
     * Generate cache key for submission files based on course and base submission identifier
     * For multi-question assignments, both question_id and submission_id increment together,
     * so we normalize them to a base range to cache across all questions of the same student
     */
    generateFileCacheKey(context) {
        // For multi-question assignments, normalize the submission_id to a base range
        // Since consecutive questions have submission IDs that differ by ~1-4, we can group them
        // by rounding down to the nearest multiple of 10 to create a stable cache key
        const submissionIdInt = parseInt(context.submission_id);
        const baseSubmissionId = Math.floor(submissionIdInt / 10) * 10;
        // Use course_id + normalized_submission_id as cache key
        // This way, all questions for the same student submission use the same cache
        return `${context.course_id}-${baseSubmissionId}`;
    }
    /**
     * Clear cached files (useful when navigating to different submissions)
     */
    clearFileCache() {
        this.cachedFiles.clear();
        console.log('🗑️ Cleared file cache');
    }
    /**
     * Extract assignment context from the current page
     */
    extractAssignmentContext() {
        const urlMatch = window.location.pathname.match(/\/courses\/(\d+)\/(assignments|questions)\/(\d+)\/submissions\/(\d+)\/grade/);
        if (!urlMatch)
            return null;
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
    async extractRubricFromDOM() {
        const root = getGradingDoc();
        const items = [];
        // Find all rubric groups and individual items
        const rubricGroups = Array.from(root.querySelectorAll('.rubricItemGroup'));
        const individualItems = Array.from(root.querySelectorAll('.rubricItem')).filter(item => !item.closest('.rubricItemGroup'));
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
    extractTextWithSpacing(element) {
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
            }
            catch (error) {
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
    extractTextFromLists(element) {
        let result = '';
        const processNode = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const txt = node.textContent?.trim();
                if (txt) {
                    // Append text with a space if previous char isn't whitespace or newline
                    if (result && !result.match(/[\s\n]$/)) {
                        result += ' ';
                    }
                    result += txt;
                }
            }
            else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node;
                const tag = el.tagName.toLowerCase();
                if (tag === 'br') {
                    result += '\n';
                }
                else if (tag === 'ul' || tag === 'ol') {
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
                }
                else {
                    // Recurse through children to keep order
                    Array.from(el.childNodes).forEach(child => processNode(child));
                }
            }
        };
        Array.from(element.childNodes).forEach(child => processNode(child));
        // Post-processing: collapse extra spaces but keep newlines
        return result
            .replace(/[ \t]+\n/g, '\n') // remove trailing spaces before newline
            .replace(/\n{2,}/g, '\n') // collapse multiple blank lines
            .replace(/\s+$/g, '') // trim trailing whitespace
            .trim();
    }
    /**
     * Get direct text content of an element, excluding nested lists
     */
    getDirectTextContent(element) {
        const clone = element.cloneNode(true);
        // Remove list elements to get main text
        const lists = clone.querySelectorAll('ul, ol');
        lists.forEach(list => list.remove());
        return clone.textContent?.trim() || '';
    }
    /**
     * Simple fallback extraction method
     */
    extractTextSimple(element) {
        // Use innerText which respects display formatting better than textContent
        const text = element.innerText || element.textContent || '';
        return text
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/\n\s*/g, ' ') // Convert newlines to spaces
            .trim();
    }
    /**
     * Debug helper: Log the extracted text for a rubric item
     */
    logTextExtractionDebug(itemId, element, extractedText) {
        console.log(`📝 Text extraction for item ${itemId}:`, {
            originalHTML: element.innerHTML.substring(0, 300) + '...',
            extractedText: extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : ''),
            hasListItems: element.querySelectorAll('li').length > 0,
            listItemCount: element.querySelectorAll('li').length
        });
    }
    /**
     * Find a specific nested checkbox element within a group by its child ID
     */
    async findNestedCheckboxElement(groupElement, childId) {
        // Expand the group if needed - be specific to avoid clicking settings button
        const expandBtn = groupElement.querySelector('.rubricItemGroup--key[aria-expanded="false"]');
        let wasExpanded = true;
        if (expandBtn) {
            // During suggestion processing, expand more quietly to reduce visual disruption
            if (this.isProcessingSuggestions) {
                console.log(`🔓 Quietly expanding group to find ${childId}...`);
            }
            else {
                console.log(`🔓 Expanding group to find ${childId}...`);
            }
            expandBtn.click();
            await waitDelay(this.isProcessingSuggestions ? 200 : 350); // Faster during processing
            wasExpanded = false;
        }
        // Find the container with nested items
        let container = groupElement.parentElement?.querySelector('.rubricItemGroup--rubricItems') ||
            groupElement.querySelector('.rubricItemGroup--rubricItems');
        if (!container) {
            const expandBtn = groupElement.querySelector('button[aria-controls]');
            const controlsId = expandBtn?.getAttribute('aria-controls');
            if (controlsId) {
                container = getGradingDoc().getElementById(controlsId);
            }
        }
        let foundElement = null;
        if (container) {
            const nestedElements = Array.from(container.querySelectorAll('.rubricItem'));
            for (const elem of nestedElements) {
                const keyEl = elem.querySelector('.rubricItem--key');
                if (keyEl && keyEl.textContent?.trim() === childId) {
                    foundElement = elem;
                    break;
                }
            }
        }
        // NOTE: We intentionally keep the group expanded so the suggestion box is visible.
        // If necessary, the grader can manually collapse it later.
        return foundElement;
    }
    /**
     * Extract nested checkboxes from a group (like Program Design)
     */
    async extractNestedCheckboxes(groupElement, parentId, parentDescription) {
        const items = [];
        // Expand the group if needed - be specific to avoid clicking settings button
        const expandBtn = groupElement.querySelector('.rubricItemGroup--key[aria-expanded="false"]');
        if (expandBtn) {
            console.log(`🔓 Expanding group ${parentId} for extraction...`);
            expandBtn.click();
            await waitDelay(350);
        }
        // The container might be a sibling or referenced by aria-controls
        let container = groupElement.parentElement?.querySelector('.rubricItemGroup--rubricItems') ||
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
                // Cache the DOM element for future use
                this.cachedNestedElements.set(itemId, elem);
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
        // Collapse the group back - be specific to avoid clicking settings button
        const collapseBtn = groupElement.querySelector('.rubricItemGroup--key[aria-expanded="true"]');
        if (collapseBtn) {
            console.log(`🔒 Collapsing group after extraction...`);
            collapseBtn.click();
            await waitDelay(150);
        }
        return items;
    }
    /**
     * Extract all radio button options by expanding accordions
     */
    async extractRadioOptions(groupElement) {
        const options = {};
        // Expand the accordion if needed - be specific to avoid clicking settings button
        const expandBtn = groupElement.querySelector('.rubricItemGroup--key[aria-expanded="false"]');
        if (expandBtn) {
            console.log(`🔓 Expanding radio group for options extraction...`);
            expandBtn.click();
            await waitDelay(350);
        }
        // The options live in a sibling container with class rubricItemGroup--rubricItems
        let container = groupElement.parentElement?.querySelector('.rubricItemGroup--rubricItems') ||
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
        const radioOptions = container ? Array.from(container.querySelectorAll('.rubricItem')) : [];
        // QWERTY order for option letters
        const QWERTY_LETTERS = "QWERTYUIOPASDFGHJKLZXCVBNM";
        // First pass: extract all options with their points to determine max points
        const optionData = [];
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
            }
            else if (option.points > 0 && option.points < maxPoints) {
                creditLabel = ' (Partial credit)';
            }
            else if (option.points === 0) {
                creditLabel = ' (No credit)';
            }
            options[option.letter] = option.description + creditLabel;
        });
        console.log(`📊 Radio options with credit labels:`, options);
        // Collapse the accordion back - be specific to avoid clicking settings button
        const collapseBtn = groupElement.querySelector('.rubricItemGroup--key[aria-expanded="true"]');
        if (collapseBtn) {
            console.log(`🔒 Collapsing radio group after extraction...`);
            collapseBtn.click();
            await waitDelay(150);
        }
        return options;
    }
    /**
     * Convert rubric items to backend format
     */
    async convertRubricToBackendFormat(rubricResult) {
        if (!rubricResult || !rubricResult.items || !Array.isArray(rubricResult.items)) {
            return [];
        }
        const backendItems = [];
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
                // This is a nested checkbox group - use cached data or extract if needed
                console.log(`📦 Processing nested checkbox group: ${item.id} - ${cleanDescription}`);
                let nestedItems = this.cachedNestedData.get(item.id);
                if (!nestedItems) {
                    // Cache miss - extract and cache the data
                    console.log(`🔄 Cache miss for ${item.id}, extracting and caching...`);
                    nestedItems = await this.extractNestedCheckboxes(item.element, item.id, cleanDescription);
                    // Cache the extracted data for future use
                    this.cachedNestedData.set(item.id, nestedItems);
                }
                else {
                    console.log(`✅ Using cached data for ${item.id} (${nestedItems.length} items)`);
                }
                if (nestedItems) {
                    backendItems.push(...nestedItems);
                }
            }
            else if (isRadio && item.element) {
                // This is a radio button group
                const radioTitle = cleanDescription.split('(')[0].trim();
                console.log(`📻 Extracting options for radio group: ${item.id} - ${radioTitle}`);
                const backendItem = {
                    id: item.id,
                    description: radioTitle,
                    points: item.points,
                    type: 'RADIO'
                };
                // Use cached radio options or extract if needed
                let options = this.cachedRadioOptions.get(item.id);
                if (!options) {
                    console.log(`🔄 Cache miss for radio options ${item.id}, extracting...`);
                    options = await this.extractRadioOptions(item.element);
                    this.cachedRadioOptions.set(item.id, options);
                }
                else {
                    console.log(`✅ Using cached radio options for ${item.id}`);
                }
                if (Object.keys(options).length > 0) {
                    backendItem.options = options;
                    console.log(`  Found ${Object.keys(options).length} options:`, options);
                }
                else {
                    console.log(`  ⚠️ No options found, will retry with expansion`);
                }
                backendItems.push(backendItem);
            }
            else {
                // Regular checkbox item
                const backendItem = {
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
    scrollToTopOfGradingPanel() {
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
            }
            else {
                console.warn('⚠️ Could not find grading panel to scroll');
                // Fallback: just scroll the document to top
                doc.documentElement.scrollTop = 0;
                doc.body.scrollTop = 0;
            }
        }
        catch (error) {
            console.error('❌ Error scrolling to top:', error);
        }
    }
    isTestFile(filePath) {
        const lower = filePath.toLowerCase();
        // Core source files we do NOT treat as tests
        if (lower.endsWith('.cpp') || lower.endsWith('.h'))
            return false;
        const baseName = lower.split('/').pop() || lower;
        if (baseName === 'makefile' || baseName.startsWith('readme'))
            return false;
        // Everything else is considered a test/auxiliary file
        return true;
    }
    /**
     * Grade submission using the backend API
     */
    async gradeSubmission(onProgress) {
        console.log('🚀 Starting grading process...');
        // Show loading overlay immediately to prevent user interaction
        this.feedbackUI.showLoadingOverlay('Initializing...', 'Preparing to analyze assignment');
        // Clear any existing feedback boxes and cached rubric data
        this.feedbackUI.clearAllSuggestions();
        this.clearCache();
        try {
            // Extract assignment context
            const context = this.extractAssignmentContext();
            if (!context) {
                throw new Error('Could not extract assignment context from page');
            }
            console.log('📋 Assignment context:', context);
            // Get the GradescopeAPI instance
            const api = window.GradescopeAPI;
            if (!api) {
                throw new Error('GradescopeAPI not initialized');
            }
            // Extract rubric structure directly from DOM since the API doesn't preserve elements
            console.log('🔍 Extracting rubric directly from DOM...');
            this.feedbackUI.updateLoadingOverlay('Analyzing rubric structure...', 'Extracting questions and options from the grading interface');
            const rubricResult = await this.extractRubricFromDOM();
            console.log(`📊 Found ${rubricResult.items.length} rubric items`);
            // Check cache first, then download submission files if needed
            const cacheKey = this.generateFileCacheKey(context);
            console.log(`🔑 Generated cache key: ${cacheKey} (from submission_id: ${context.submission_id})`);
            let downloadResult;
            if (this.cachedFiles.has(cacheKey)) {
                console.log('📋 Using cached submission files...');
                downloadResult = this.cachedFiles.get(cacheKey);
                console.log(`✅ Using ${Object.keys(downloadResult.files).length} cached files`);
            }
            else {
                console.log('📥 Downloading submission files...');
                this.feedbackUI.updateLoadingOverlay('Downloading student files...', 'Retrieving code and documents for analysis');
                try {
                    if (!api.downloadSubmissionFiles) {
                        throw new Error('GradescopeAPI download method not available');
                    }
                    downloadResult = await api.downloadSubmissionFiles(context.submission_id);
                    // Cache the downloaded files
                    this.cachedFiles.set(cacheKey, downloadResult);
                    console.log(`✅ Downloaded and cached ${Object.keys(downloadResult.files).length} files`);
                }
                catch (error) {
                    console.error('❌ Error downloading files:', error);
                    throw new Error(`Failed to download submission files: ${error.message}`);
                }
            }
            // Convert rubric to backend format
            console.log('🔄 Converting rubric to backend format...');
            this.feedbackUI.updateLoadingOverlay('Processing rubric data...', 'Preparing questions and options for AI analysis');
            console.log('🔍 Input rubric structure:', rubricResult);
            const backendRubricItems = await this.convertRubricToBackendFormat(rubricResult);
            // Prepare request
            const request = {
                assignment_context: context,
                source_files: Object.fromEntries(Object.entries(downloadResult.files).map(([path, file]) => {
                    let content = file.content;
                    if (this.isTestFile(path) && typeof content === 'string') {
                        if (content.length > 100) {
                            content = content.slice(0, 100) + '[TRIMMED]';
                        }
                    }
                    return [path, content];
                })),
                rubric_items: backendRubricItems.sort((a, b) => {
                    // QWERTY keyboard order for letter suffixes (matches Gradescope UI)
                    const qwertyOrder = 'QWERTYUIOPASDFGHJKLZXCVBNM';
                    // Custom sort to put ID "0" after ID "9" 
                    if (a.id === "0" && b.id === "9")
                        return 1; // 0 comes after 9
                    if (a.id === "9" && b.id === "0")
                        return -1; // 9 comes before 0
                    // Check if IDs are hierarchical (e.g., "6-Q", "6-W")
                    const aMatch = a.id.match(/^(\d+)-([A-Z])$/);
                    const bMatch = b.id.match(/^(\d+)-([A-Z])$/);
                    if (aMatch && bMatch) {
                        const [, aNum, aLetter] = aMatch;
                        const [, bNum, bLetter] = bMatch;
                        // First compare the numeric part
                        const numDiff = parseInt(aNum) - parseInt(bNum);
                        if (numDiff !== 0)
                            return numDiff;
                        // If numeric parts are equal, compare letters by QWERTY order
                        const aLetterIndex = qwertyOrder.indexOf(aLetter);
                        const bLetterIndex = qwertyOrder.indexOf(bLetter);
                        return aLetterIndex - bLetterIndex;
                    }
                    // For single digit IDs, treat "0" as if it were "9.5" 
                    const getNumericValue = (id) => {
                        if (id === "0")
                            return 9.5;
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
            // Hide loading overlay - data collection is complete, now streaming results
            this.feedbackUI.hideLoadingOverlay();
            // Send request to backend with SSE streaming
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
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event = JSON.parse(line.slice(6));
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
                                // Start suggestion processing phase (shows loading overlay)
                                this.startSuggestionProcessing();
                                // Display the suggestion in the UI
                                await this.displayGradingSuggestion(event.decision);
                            }
                            else if (event.type === 'error') {
                                console.error('❌ Backend error:', event.error);
                            }
                        }
                        catch (e) {
                            console.error('Error parsing SSE event:', e, 'Line:', line);
                        }
                    }
                }
            }
            console.log('✅ Grading completed successfully');
            // If we were processing suggestions, finish up
            if (this.isProcessingSuggestions) {
                this.finishSuggestionProcessing();
            }
        }
        catch (dataCollectionError) {
            // Hide loading overlay on data collection error
            this.feedbackUI.hideLoadingOverlay();
            // Clean up suggestion processing state
            if (this.isProcessingSuggestions) {
                this.isProcessingSuggestions = false;
                if (this.suggestionProcessingTimer) {
                    clearTimeout(this.suggestionProcessingTimer);
                    this.suggestionProcessingTimer = null;
                }
            }
            console.error('❌ Error during data collection or grading:', dataCollectionError);
            throw dataCollectionError;
        }
    }
    /**
     * Display grading suggestion in the UI
     */
    async displayGradingSuggestion(decision) {
        // Cache decision so we can re-display it when groups are expanded
        this.cachedDecisions.set(decision.rubric_item_id, decision);
        // If we're processing suggestions, suppress scroll events temporarily
        const wasProcessing = this.isProcessingSuggestions;
        try {
            // Get the current rubric structure
            const rubricResult = await this.extractRubricFromDOM();
            if (!rubricResult || rubricResult.type !== 'structured') {
                console.error('No structured rubric found for displaying suggestion');
                return;
            }
            let targetItem = rubricResult.items.find((item) => item.id === decision.rubric_item_id);
            // If not found directly, check if it's a nested checkbox (format: "parentId-childId")
            if (!targetItem && decision.rubric_item_id.includes('-')) {
                // First check if we have the element cached
                const cachedElement = this.cachedNestedElements.get(decision.rubric_item_id);
                if (cachedElement) {
                    console.log(`✅ Using cached element for nested checkbox ${decision.rubric_item_id}`);
                    targetItem = {
                        id: decision.rubric_item_id,
                        element: cachedElement,
                        itemType: 'NESTED_CHECKBOX'
                    };
                }
                else {
                    // Fallback to dynamic lookup (for backward compatibility)
                    const [parentId, childId] = decision.rubric_item_id.split('-');
                    const parentItem = rubricResult.items.find((item) => item.id === parentId);
                    if (parentItem && parentItem.itemType === 'CHECKBOX_GROUP') {
                        console.log(`🔍 Looking for nested checkbox ${childId} in parent group ${parentId}`);
                        const nestedElement = await this.findNestedCheckboxElement(parentItem.element, childId);
                        if (nestedElement) {
                            // Cache the found element for future use
                            this.cachedNestedElements.set(decision.rubric_item_id, nestedElement);
                            targetItem = {
                                id: decision.rubric_item_id,
                                element: nestedElement,
                                itemType: 'NESTED_CHECKBOX'
                            };
                            console.log(`✅ Found and cached nested checkbox element for ${decision.rubric_item_id}`);
                        }
                    }
                }
            }
            if (!targetItem || !targetItem.element) {
                console.error(`Rubric item ${decision.rubric_item_id} not found for displaying suggestion`);
                return;
            }
            // Determine the decision format
            let formattedDecision;
            if (decision.type === 'CHECKBOX') {
                formattedDecision = decision.verdict.decision || 'uncheck';
            }
            else if (decision.type === 'RADIO' && decision.verdict.selected_option) {
                formattedDecision = decision.verdict.selected_option;
            }
            else {
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
        }
        catch (error) {
            console.error('Error displaying grading suggestion:', error);
        }
    }
    /**
     * Apply a grading decision to the Gradescope UI
     */
    async applyGradingDecision(decision) {
        try {
            const api = window.GradescopeAPI;
            if (!api) {
                throw new Error('GradescopeAPI not available');
            }
            if (decision.type === 'CHECKBOX') {
                const shouldCheck = decision.verdict.decision === 'check';
                if (shouldCheck) {
                    await api.checkRubricItem(decision.rubric_item_id);
                }
                else {
                    await api.uncheckRubricItem(decision.rubric_item_id);
                }
            }
            else if (decision.type === 'RADIO' && decision.verdict.selected_option) {
                await api.selectRubricOption(decision.rubric_item_id, decision.verdict.selected_option);
            }
            console.log(`✅ Applied grading decision for ${decision.rubric_item_id}`);
        }
        catch (error) {
            console.error('Error applying grading decision:', error);
            throw error;
        }
    }
    /**
     * Submit feedback to the backend
     */
    async submitFeedback(feedback) {
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
        }
        catch (error) {
            console.error('❌ Error submitting feedback:', error);
            // TODO: Show error to user
        }
    }
    /**
     * Get extension settings
     */
    async getSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['autoApplyHighConfidence', 'confidenceThreshold'], (settings) => {
                resolve(settings);
            });
        });
    }
    /**
     * Re-display suggestions for nested checkboxes in currently expanded groups
     */
    async reDisplayNestedSuggestions() {
        console.log('🔄 Re-displaying nested checkbox suggestions...');
        // Find all currently expanded groups
        const doc = getGradingDoc();
        const expandedGroups = Array.from(doc.querySelectorAll('.rubricItemGroup[aria-expanded="true"], .rubricItemGroup-is-expanded'));
        for (const group of expandedGroups) {
            const keyBtn = group.querySelector('.rubricItemGroup--key');
            if (!keyBtn)
                continue;
            const parentId = keyBtn.textContent?.trim();
            if (!parentId)
                continue;
            // Find all cached decisions for nested items in this group
            for (const [itemId, decision] of this.cachedDecisions.entries()) {
                if (itemId.startsWith(`${parentId}-`)) {
                    console.log(`🔄 Re-displaying suggestion for ${itemId}`);
                    try {
                        // Re-display this nested checkbox suggestion
                        await this.displaySingleSuggestion(decision);
                    }
                    catch (error) {
                        console.warn(`⚠️ Failed to re-display suggestion for ${itemId}:`, error);
                    }
                }
            }
        }
    }
    /**
     * Display a single suggestion without caching (used for re-display)
     */
    async displaySingleSuggestion(decision) {
        try {
            // Get the current rubric structure
            const rubricResult = await this.extractRubricFromDOM();
            if (!rubricResult || rubricResult.type !== 'structured') {
                console.error('No structured rubric found for displaying suggestion');
                return;
            }
            let targetItem = rubricResult.items.find((item) => item.id === decision.rubric_item_id);
            // If not found directly, check if it's a nested checkbox (format: "parentId-childId")
            if (!targetItem && decision.rubric_item_id.includes('-')) {
                const [parentId, childId] = decision.rubric_item_id.split('-');
                const parentItem = rubricResult.items.find((item) => item.id === parentId);
                if (parentItem && parentItem.itemType === 'CHECKBOX_GROUP') {
                    console.log(`🔍 Looking for nested checkbox ${childId} in parent group ${parentId}`);
                    const nestedElement = await this.findNestedCheckboxElement(parentItem.element, childId);
                    if (nestedElement) {
                        targetItem = {
                            id: decision.rubric_item_id,
                            element: nestedElement,
                            itemType: 'NESTED_CHECKBOX'
                        };
                        console.log(`✅ Found nested checkbox element for ${decision.rubric_item_id}`);
                    }
                }
            }
            if (!targetItem || !targetItem.element) {
                console.error(`Rubric item ${decision.rubric_item_id} not found for displaying suggestion`);
                return;
            }
            // Determine the decision format
            let formattedDecision;
            if (decision.type === 'CHECKBOX') {
                formattedDecision = decision.verdict.decision || 'uncheck';
            }
            else if (decision.type === 'RADIO' && decision.verdict.selected_option) {
                formattedDecision = decision.verdict.selected_option;
            }
            else {
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
        }
        catch (error) {
            console.error('Error displaying single suggestion:', error);
        }
    }
    /**
     * Clear all cached data (useful when navigating to a new submission)
     */
    clearCache() {
        console.log('🧹 Clearing cached rubric data...');
        this.cachedNestedElements.clear();
        this.cachedNestedData.clear();
        this.cachedRadioOptions.clear();
        this.cachedDecisions.clear();
    }
    /**
     * Start suggestion processing phase with loading overlay
     */
    startSuggestionProcessing() {
        if (!this.isProcessingSuggestions) {
            console.log('🔄 Starting suggestion processing phase...');
            this.isProcessingSuggestions = true;
            this.feedbackUI.showLoadingOverlay('Processing AI suggestions...', 'Displaying grading recommendations in the rubric');
        }
        // Reset the completion timer - we'll wait for a brief pause after the last suggestion
        if (this.suggestionProcessingTimer) {
            clearTimeout(this.suggestionProcessingTimer);
        }
        this.suggestionProcessingTimer = window.setTimeout(() => {
            this.finishSuggestionProcessing();
        }, 1000); // Wait 1 second after the last suggestion before finishing
    }
    /**
     * Finish suggestion processing phase
     */
    finishSuggestionProcessing() {
        if (this.isProcessingSuggestions) {
            console.log('✅ Finishing suggestion processing phase...');
            this.isProcessingSuggestions = false;
            if (this.suggestionProcessingTimer) {
                clearTimeout(this.suggestionProcessingTimer);
                this.suggestionProcessingTimer = null;
            }
            // Hide the loading overlay
            this.feedbackUI.hideLoadingOverlay();
            // Scroll back to the top of the grading panel
            this.scrollToTopOfGradingPanel();
            console.log('🎯 Suggestion processing complete - scrolled to top');
        }
    }
    /**
     * Refresh cached elements that may have become stale due to DOM changes
     */
    refreshCachedElements() {
        console.log('🔄 Refreshing cached DOM elements...');
        // Clear stale element cache but keep data and decisions
        const staleKeys = [];
        for (const [itemId, element] of this.cachedNestedElements.entries()) {
            // Check if the element is still in the DOM
            if (!document.contains(element)) {
                staleKeys.push(itemId);
            }
        }
        // Remove stale elements
        staleKeys.forEach(key => {
            console.log(`🗑️ Removing stale cached element: ${key}`);
            this.cachedNestedElements.delete(key);
        });
        console.log(`✅ Refreshed cache - removed ${staleKeys.length} stale elements`);
    }
    /**
     * Set up listener to detect when groups are expanded/collapsed
     * Note: With caching, this is mainly for edge cases where cache misses occur
     */
    setupToggleListener() {
        const doc = getGradingDoc();
        // Avoid multiple listeners if multiple instances are created
        if (window._supergraderToggleListenerSet)
            return;
        window._supergraderToggleListenerSet = true;
        console.log('🎯 Setting up optimized toggle listener...');
        // Listen for clicks on group toggle buttons
        doc.addEventListener('click', (e) => {
            const target = e.target;
            // Check if it's a group toggle button
            if (target && (target.classList.contains('rubricItemGroup--key') || target.closest('.rubricItemGroup--key'))) {
                console.log('🔄 Group toggle detected...');
                // Refresh cached elements to remove stale references
                this.refreshCachedElements();
                // Only re-display if we have cached decisions that need to be shown
                if (this.cachedDecisions.size > 0) {
                    setTimeout(() => {
                        this.reDisplayNestedSuggestions().catch(error => {
                            console.error('❌ Error re-displaying nested suggestions:', error);
                        });
                    }, 350); // Slightly longer delay to ensure DOM is updated
                }
                else {
                    console.log('📋 No cached decisions to re-display');
                }
            }
        }, true);
    }
}
// Make the service available globally
console.log('supergrader: Making ChromeGradingService available globally');
window.ChromeGradingService = ChromeGradingService;
// Also store a global instance for easy access to methods like clearAllSuggestions
window.chromeGradingServiceInstance = null;
console.log('supergrader: ChromeGradingService is now available at window.ChromeGradingService');
//# sourceMappingURL=grading-service.js.map