// Main Gradescope API orchestrator

import { AuthManager } from '../auth/auth-manager';
import { APIClient } from './api-client';
import { RubricExtractor } from '../rubric/rubric-extractor';
import { RubricResult, RubricItem } from '../../types/index';

export class GradescopeAPI {
  private authManager: AuthManager;
  private apiClient: APIClient;
  private rubricExtractor: RubricExtractor;

  constructor() {
    this.authManager = new AuthManager();
    this.apiClient = new APIClient(this.authManager);
    this.rubricExtractor = new RubricExtractor();
  }

  /**
   * Initialize the API
   */
  async initialize(): Promise<boolean> {
    return await this.authManager.initialize();
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.authManager.isAuthenticated();
  }

  /**
   * Get auth state
   */
  getAuthState() {
    return this.authManager.getAuthState();
  }

  /**
   * Extract rubric structure
   */
  extractRubricStructure(): RubricResult {
    return this.rubricExtractor.extractRubric();
  }

  /**
   * Check if rubric item is selected
   */
  isRubricItemSelected(element?: HTMLElement): boolean {
    return this.rubricExtractor.isRubricItemSelected(element);
  }

  /**
   * Diagnose radio groups
   */
  async diagnoseRadioGroups(): Promise<void> {
    return await this.rubricExtractor.diagnoseRadioGroups();
  }

  /**
   * Make authenticated request
   */
  async makeAuthenticatedRequest(url: string, options?: RequestInit): Promise<Response> {
    return await this.apiClient.makeRequest(url, options);
  }

  /**
   * Toggle rubric item
   */
  async toggleRubricItem(_questionId: string, rubricItemId: string, _points: number, _description: string): Promise<{success: boolean; message: string}> {
    const rubricResult = this.extractRubricStructure();
    
    if (!rubricResult) {
      return { success: false, message: 'No rubric structure found on page' };
    }

    if (rubricResult.type === 'manual') {
      return { success: false, message: 'Manual scoring interface - use applyGrade instead' };
    }

    const targetItem = rubricResult.items.find((item: RubricItem) => item.id === rubricItemId);
    if (!targetItem || !targetItem.element) {
      return { success: false, message: `Rubric item ${rubricItemId} not found or not interactive` };
    }

    try {
      const keyButton = targetItem.element.querySelector('.rubricItem--key, .rubricItemGroup--key') as HTMLElement;
      if (keyButton) {
        keyButton.click();
        return { success: true, message: `Toggled rubric item ${rubricItemId}` };
      }
      
      return { success: false, message: 'No clickable element found' };
    } catch (error) {
      return { success: false, message: `Failed to toggle: ${(error as Error).message}` };
    }
  }

  /**
   * Apply grade for manual scoring
   */
  async applyGrade(score: number): Promise<{success: boolean; message: string}> {
    const rubricResult = this.extractRubricStructure();
    
    if (!rubricResult || rubricResult.type !== 'manual') {
      return { success: false, message: 'No manual scoring interface found' };
    }

    try {
      rubricResult.box.value = score.toString();
      rubricResult.box.dispatchEvent(new Event('input', { bubbles: true }));
      rubricResult.box.dispatchEvent(new Event('change', { bubbles: true }));
      
      return { success: true, message: `Set manual score to ${score}` };
    } catch (error) {
      return { success: false, message: `Failed to set score: ${(error as Error).message}` };
    }
  }
} 