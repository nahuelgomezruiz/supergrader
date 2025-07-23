// Grading service module for backend API integration

import { GradescopeAPI } from '../api/gradescope-api';
import { RubricResult, RubricItem, DownloadResult } from '../../types/index';
import { getInnerDoc } from '../../utils/dom';
import { delay } from '../../utils/async';

interface BackendRubricItem {
  id: string;
  description: string;
  points: number;
  type: 'CHECKBOX' | 'RADIO';
  options?: Record<string, string>; // For radio buttons: option text -> points
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
    decision?: 'check' | 'uncheck'; // For checkbox
    selected_option?: string; // For radio
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

export class GradingService {
  private api: GradescopeAPI;
  private backendUrl: string;

  constructor(api: GradescopeAPI, backendUrl: string = 'http://localhost:8000') {
    this.api = api;
    this.backendUrl = backendUrl;
  }

  /**
   * Extract assignment context from the current page
   */
  private extractAssignmentContext(): { course_id: string; assignment_id: string; submission_id: string; assignment_name: string } | null {
    const urlMatch = window.location.pathname.match(/\/courses\/(\d+)\/(assignments|questions)\/(\d+)\/submissions\/(\d+)\/grade/);
    if (!urlMatch) return null;

    const [, courseId, , assignmentId, submissionId] = urlMatch;
    
    // Try to get assignment name from page
    const root = getInnerDoc();
    const assignmentName = root.querySelector('.assignment-name, h1, .breadcrumb-item:last-child')?.textContent?.trim() || 
                          `Assignment ${assignmentId}`;

    return {
      course_id: courseId,
      assignment_id: assignmentId,
      submission_id: submissionId,
      assignment_name: assignmentName
    };
  }

  /**
   * Extract all radio button options by expanding accordions
   */
  private async extractRadioOptions(groupElement: HTMLElement): Promise<Record<string, string>> {
    const options: Record<string, string> = {};
    const root = getInnerDoc();
    
    // Expand the accordion if needed
    const expandBtn = groupElement.querySelector('button[aria-expanded="false"]');
    if (expandBtn) {
      (expandBtn as HTMLElement).click();
      await delay(350); // Wait for DOM update
    }

    // Find radio options
    const headerId = groupElement.querySelector('.rubricItemGroup--key')?.getAttribute('id');
    let radioOptions: Element[] = [];
    
    if (headerId) {
      const container = root.querySelector(`[aria-describedby="${headerId}"]`);
      if (container) {
        radioOptions = Array.from(container.querySelectorAll('.rubricItem'));
      }
    }
    
    // Fallback methods
    if (radioOptions.length === 0) {
      radioOptions = Array.from(groupElement.querySelectorAll('.rubricItemGroup--rubricItems .rubricItem'));
    }

    // Extract each option
    radioOptions.forEach((optionElement) => {
      const descEl = optionElement.querySelector('.rubricField-description');
      let optionDesc = descEl?.textContent?.trim() || '';
      
      // Clean up the description
      optionDesc = optionDesc.replace(/^Grading comment:\s*/, '').trim();
      
      const ptsEl = optionElement.querySelector('.rubricField-points');
      const ptsText = ptsEl?.textContent?.trim() || '0 pts';
      
      if (optionDesc) {
        options[optionDesc] = ptsText;
      }
    });

    // Collapse the accordion back
    const collapseBtn = groupElement.querySelector('button[aria-expanded="true"]');
    if (collapseBtn) {
      (collapseBtn as HTMLElement).click();
      await delay(150);
    }

    return options;
  }

  /**
   * Convert rubric items to backend format
   */
  private async convertRubricToBackendFormat(rubricResult: RubricResult): Promise<BackendRubricItem[]> {
    if (!rubricResult || rubricResult.type !== 'structured') {
      return [];
    }

    const backendItems: BackendRubricItem[] = [];

    for (const item of rubricResult.items) {
      const backendItem: BackendRubricItem = {
        id: item.id,
        description: item.description,
        points: item.points,
        type: item.itemType || 'CHECKBOX'
      };

      // For radio items, extract all options
      if (item.itemType === 'RADIO' && item.element) {
        console.log(`📻 Extracting options for radio group: ${item.id}`);
        const options = await this.extractRadioOptions(item.element);
        if (Object.keys(options).length > 0) {
          backendItem.options = options;
          console.log(`  Found ${Object.keys(options).length} options:`, options);
        }
      }

      backendItems.push(backendItem);
    }

    return backendItems;
  }

  /**
   * Grade submission using the backend API
   */
  async gradeSubmission(onProgress?: (event: GradingEvent) => void): Promise<void> {
    console.log('🚀 Starting grading process...');

    // Extract assignment context
    const context = this.extractAssignmentContext();
    if (!context) {
      throw new Error('Could not extract assignment context from page');
    }
    console.log('📋 Assignment context:', context);

    // Extract rubric structure
    const rubricResult = this.api.extractRubricStructure();
    if (!rubricResult || rubricResult.type !== 'structured') {
      throw new Error('No structured rubric found on page');
    }
    console.log(`📊 Found ${rubricResult.items.length} rubric items`);

    // Download submission files
    console.log('📥 Downloading submission files...');
    let downloadResult: DownloadResult;
    try {
      // Use the global GradescopeAPI instance which has the download method
      const globalApi = (window as any).GradescopeAPI;
      if (!globalApi || !globalApi.downloadSubmissionFiles) {
        throw new Error('GradescopeAPI download method not available');
      }
      downloadResult = await globalApi.downloadSubmissionFiles(context.submission_id);
      console.log(`✅ Downloaded ${Object.keys(downloadResult.files).length} files`);
    } catch (error) {
      console.error('❌ Error downloading files:', error);
      throw new Error(`Failed to download submission files: ${(error as Error).message}`);
    }

    // Convert rubric to backend format
    console.log('🔄 Converting rubric to backend format...');
    const backendRubricItems = await this.convertRubricToBackendFormat(rubricResult);

    // Prepare request
    const request: GradingRequest = {
      assignment_context: context,
      source_files: Object.fromEntries(
        Object.entries(downloadResult.files).map(([path, file]) => [path, file.content])
      ),
      rubric_items: backendRubricItems
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
   * Apply grading decisions to the UI
   */
  async applyGradingDecision(decision: GradingDecision): Promise<void> {
    const rubricResult = this.api.extractRubricStructure();
    if (!rubricResult || rubricResult.type !== 'structured') {
      throw new Error('No structured rubric found');
    }

    const targetItem = rubricResult.items.find(item => item.id === decision.rubric_item_id);
    if (!targetItem || !targetItem.element) {
      throw new Error(`Rubric item ${decision.rubric_item_id} not found`);
    }

    if (decision.type === 'CHECKBOX') {
      // For checkbox items
      const isCurrentlySelected = this.api.isRubricItemSelected(targetItem.element);
      const shouldBeSelected = decision.verdict.decision === 'check';

      if (isCurrentlySelected !== shouldBeSelected) {
        const keyButton = targetItem.element.querySelector('.rubricItem--key') as HTMLElement;
        if (keyButton) {
          keyButton.click();
          await delay(200); // Wait for UI update
          console.log(`${shouldBeSelected ? '✅' : '⬜'} Toggled ${decision.rubric_item_id}`);
        }
      }
    } else if (decision.type === 'RADIO' && decision.verdict.selected_option) {
      // For radio items - need to expand accordion and select option
      console.log(`📻 Applying radio selection for ${decision.rubric_item_id}: "${decision.verdict.selected_option}"`);
      
      // Expand accordion
      const expandBtn = targetItem.element.querySelector('button[aria-expanded="false"]');
      if (expandBtn) {
        (expandBtn as HTMLElement).click();
        await delay(350);
      }

      // Find and click the matching option
      const root = getInnerDoc();
      const headerId = targetItem.element.querySelector('.rubricItemGroup--key')?.getAttribute('id');
      let radioOptions: Element[] = [];
      
      if (headerId) {
        const container = root.querySelector(`[aria-describedby="${headerId}"]`);
        if (container) {
          radioOptions = Array.from(container.querySelectorAll('.rubricItem'));
        }
      }

      for (const optionElement of radioOptions) {
        const descEl = optionElement.querySelector('.rubricField-description');
        const optionDesc = descEl?.textContent?.trim().replace(/^Grading comment:\s*/, '');
        
        if (optionDesc === decision.verdict.selected_option) {
          const keyBtn = optionElement.querySelector('.rubricItem--key') as HTMLElement;
          if (keyBtn && !keyBtn.classList.contains('rubricItem--key-applied')) {
            keyBtn.click();
            await delay(200);
            console.log(`✅ Selected radio option: "${optionDesc}"`);
            break;
          }
        }
      }

      // Collapse accordion
      const collapseBtn = targetItem.element.querySelector('button[aria-expanded="true"]');
      if (collapseBtn) {
        (collapseBtn as HTMLElement).click();
        await delay(150);
      }
    }

    // TODO: Add comment if provided
    if (decision.verdict.comment) {
      console.log(`💬 Comment for ${decision.rubric_item_id}: ${decision.verdict.comment}`);
      // Comment functionality to be implemented
    }
  }
} 