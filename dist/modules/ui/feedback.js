/**
 * Feedback UI module for displaying model suggestions and collecting user feedback
 */
export class FeedbackUI {
    constructor() {
        this.feedbackBoxes = new Map();
        this.injectStyles();
    }
    /**
     * Set the callback for when feedback is submitted
     */
    onFeedback(callback) {
        this.onFeedbackSubmit = callback;
    }
    /**
     * Display a suggestion box for a rubric item
     */
    displaySuggestion(config) {
        // Remove any existing feedback box for this item
        this.removeSuggestion(config.rubricItemId);
        // Create the feedback box
        const feedbackBox = this.createFeedbackBox(config);
        // Position it relative to the rubric item
        this.positionFeedbackBox(feedbackBox, config.element);
        // Add to DOM and track it
        document.body.appendChild(feedbackBox);
        this.feedbackBoxes.set(config.rubricItemId, feedbackBox);
    }
    /**
     * Remove a suggestion box
     */
    removeSuggestion(rubricItemId) {
        const box = this.feedbackBoxes.get(rubricItemId);
        if (box) {
            box.remove();
            this.feedbackBoxes.delete(rubricItemId);
        }
    }
    /**
     * Remove all suggestion boxes
     */
    clearAllSuggestions() {
        this.feedbackBoxes.forEach(box => box.remove());
        this.feedbackBoxes.clear();
    }
    createFeedbackBox(config) {
        const box = document.createElement('div');
        box.className = 'supergrader-feedback-box';
        box.dataset.rubricItemId = config.rubricItemId;
        // Create confidence indicator
        const confidenceClass = config.confidence >= 0.8 ? 'high' :
            config.confidence >= 0.6 ? 'medium' : 'low';
        box.innerHTML = `
      <div class="sg-feedback-header">
        <span class="sg-confidence ${confidenceClass}">
          ${(config.confidence * 100).toFixed(0)}% confidence
        </span>
        <button class="sg-close-btn" aria-label="Close">×</button>
      </div>
      <div class="sg-feedback-content">
        <div class="sg-decision">
          <strong>Decision:</strong> ${this.formatDecision(config.decision)}
        </div>
        <div class="sg-comment">
          <strong>Comment:</strong>
          <p>${this.escapeHtml(config.comment)}</p>
        </div>
      </div>
      <div class="sg-feedback-actions">
        <button class="sg-nope-btn">NOPE</button>
      </div>
      <div class="sg-feedback-form" style="display: none;">
        <textarea 
          class="sg-feedback-input" 
          placeholder="I disagree because..."
          rows="3"
        ></textarea>
        <button class="sg-send-btn" disabled>Send</button>
      </div>
    `;
        // Add event listeners
        this.attachEventListeners(box, config);
        return box;
    }
    attachEventListeners(box, config) {
        // Close button
        const closeBtn = box.querySelector('.sg-close-btn');
        closeBtn?.addEventListener('click', () => {
            this.removeSuggestion(config.rubricItemId);
        });
        // NOPE button
        const nopeBtn = box.querySelector('.sg-nope-btn');
        const feedbackForm = box.querySelector('.sg-feedback-form');
        const feedbackInput = box.querySelector('.sg-feedback-input');
        const sendBtn = box.querySelector('.sg-send-btn');
        nopeBtn?.addEventListener('click', () => {
            feedbackForm.style.display = 'block';
            nopeBtn.style.display = 'none';
            feedbackInput.focus();
        });
        // Enable/disable send button based on input
        feedbackInput?.addEventListener('input', () => {
            sendBtn.disabled = feedbackInput.value.trim().length === 0;
        });
        // Send feedback
        sendBtn?.addEventListener('click', () => {
            if (this.onFeedbackSubmit && feedbackInput.value.trim()) {
                // Get rubric question text
                const rubricQuestion = this.extractRubricQuestion(config.element);
                // Get student assignment (we'll need to extract this from the page)
                const studentAssignment = this.extractStudentAssignment();
                this.onFeedbackSubmit({
                    rubricItemId: config.rubricItemId,
                    rubricQuestion,
                    studentAssignment,
                    originalDecision: `${config.decision} - ${config.comment}`,
                    userFeedback: feedbackInput.value.trim()
                });
                // Show confirmation and remove box
                feedbackForm.innerHTML = '<div class="sg-feedback-sent">✓ Feedback sent!</div>';
                setTimeout(() => {
                    this.removeSuggestion(config.rubricItemId);
                }, 2000);
            }
        });
        // Handle Enter key in textarea (Ctrl+Enter to send)
        feedbackInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey && !sendBtn.disabled) {
                sendBtn.click();
            }
        });
    }
    positionFeedbackBox(box, rubricElement) {
        // Get the position of the rubric element
        const rect = rubricElement.getBoundingClientRect();
        // Position the feedback box to overlay the rubric item
        box.style.position = 'absolute';
        box.style.top = `${rect.top + window.scrollY}px`;
        box.style.left = `${rect.left + window.scrollX}px`;
        box.style.width = `${rect.width}px`;
        box.style.minHeight = `${rect.height}px`;
        box.style.zIndex = '10000';
    }
    extractRubricQuestion(element) {
        // Try to find the description element
        const descEl = element.querySelector('.rubricField-description');
        if (descEl) {
            return descEl.textContent?.trim() || '';
        }
        // Fallback to any text content
        return element.textContent?.trim() || '';
    }
    extractStudentAssignment() {
        // Try to find the student's submission content
        // This might be in different places depending on the assignment type
        // Look for code submission
        const codeElements = document.querySelectorAll('.submission-file-content, .hljs, pre code');
        if (codeElements.length > 0) {
            return Array.from(codeElements)
                .map(el => el.textContent?.trim() || '')
                .join('\n\n');
        }
        // Look for text submission
        const textElements = document.querySelectorAll('.submission-text, .answer-text');
        if (textElements.length > 0) {
            return Array.from(textElements)
                .map(el => el.textContent?.trim() || '')
                .join('\n\n');
        }
        // Fallback - try to get any submission content
        const submissionContainer = document.querySelector('.submission-container, .student-submission');
        return submissionContainer?.textContent?.trim() || 'Unable to extract student submission';
    }
    formatDecision(decision) {
        if (decision === 'check')
            return '✓ Check';
        if (decision === 'uncheck')
            return '✗ Uncheck';
        return decision; // For radio options
    }
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    injectStyles() {
        if (document.getElementById('supergrader-feedback-styles'))
            return;
        const style = document.createElement('style');
        style.id = 'supergrader-feedback-styles';
        style.textContent = `
      .supergrader-feedback-box {
        background: white;
        border: 2px solid #0066cc;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        overflow: hidden;
      }

      .sg-feedback-header {
        background: #f0f7ff;
        padding: 8px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e0e0e0;
      }

      .sg-confidence {
        font-size: 12px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 4px;
      }

      .sg-confidence.high {
        background: #d4edda;
        color: #155724;
      }

      .sg-confidence.medium {
        background: #fff3cd;
        color: #856404;
      }

      .sg-confidence.low {
        background: #f8d7da;
        color: #721c24;
      }

      .sg-close-btn {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .sg-close-btn:hover {
        color: #333;
      }

      .sg-feedback-content {
        padding: 12px;
      }

      .sg-decision {
        margin-bottom: 8px;
        color: #333;
      }

      .sg-comment {
        color: #555;
      }

      .sg-comment p {
        margin: 4px 0 0 0;
      }

      .sg-feedback-actions {
        padding: 0 12px 12px;
        display: flex;
        justify-content: flex-end;
      }

      .sg-nope-btn {
        background: #dc3545;
        color: white;
        border: none;
        padding: 6px 16px;
        border-radius: 4px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
      }

      .sg-nope-btn:hover {
        background: #c82333;
      }

      .sg-feedback-form {
        padding: 12px;
        border-top: 1px solid #e0e0e0;
        background: #f8f9fa;
      }

      .sg-feedback-input {
        width: 100%;
        padding: 8px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        font-family: inherit;
        font-size: 14px;
        resize: vertical;
        margin-bottom: 8px;
      }

      .sg-feedback-input:focus {
        outline: none;
        border-color: #0066cc;
        box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
      }

      .sg-send-btn {
        background: #0066cc;
        color: white;
        border: none;
        padding: 6px 16px;
        border-radius: 4px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
        float: right;
      }

      .sg-send-btn:hover:not(:disabled) {
        background: #0052a3;
      }

      .sg-send-btn:disabled {
        background: #6c757d;
        cursor: not-allowed;
        opacity: 0.6;
      }

      .sg-feedback-sent {
        text-align: center;
        color: #28a745;
        font-weight: 600;
        padding: 20px;
      }
    `;
        document.head.appendChild(style);
    }
}
//# sourceMappingURL=feedback.js.map