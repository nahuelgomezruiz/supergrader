// Unified Grading Service for SuperGrader
// Consolidates duplicate grading service implementations
import { getConfigManager } from '../config/index';
import { getInnerDoc } from '../../utils/dom';
import { delay } from '../../utils/async';
/**
 * Unified grading service that works in both modular and Chrome extension contexts
 */
export class UnifiedGradingService {
    constructor(backendUrl, api) {
        this.backendUrl = backendUrl || getConfigManager().getBackendConfig().defaultUrl;
        this.api = api;
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
        const root = getInnerDoc();
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
     * Extract all radio button options by expanding accordions
     */
    async extractRadioOptions(groupElement) {
        const options = {};
        const root = getInnerDoc();
        const rubricConfig = getConfigManager().getRubricConfig();
        // Expand the accordion if needed
        const expandBtn = groupElement.querySelector('button[aria-expanded="false"]');
        if (expandBtn) {
            expandBtn.click();
            await delay(rubricConfig.accordionWaitTime);
        }
        // Find radio options
        const headerId = groupElement.querySelector('.rubricItemGroup--key')?.getAttribute('id');
        let radioOptions = [];
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
        // QWERTY order for option letters
        const QWERTY_LETTERS = "QWERTYUIOPASDFGHJKLZXCVBNM";
        // Extract each option and assign QWERTY letters
        radioOptions.forEach((optionElement, index) => {
            const descEl = optionElement.querySelector('.rubricField-description');
            let optionDesc = descEl?.textContent?.trim() || '';
            // Clean up the description
            optionDesc = optionDesc.replace(/^Grading comment:\s*/, '').trim();
            if (optionDesc && index < QWERTY_LETTERS.length) {
                const optionLetter = QWERTY_LETTERS[index];
                options[optionLetter] = optionDesc;
            }
        });
        // Collapse the accordion back
        const collapseBtn = groupElement.querySelector('button[aria-expanded="true"]');
        if (collapseBtn) {
            collapseBtn.click();
            await delay(rubricConfig.collapseWaitTime);
        }
        return options;
    }
    /**
     * Extract rubric from DOM with elements preserved
     */
    async extractRubricFromDOM() {
        const root = getInnerDoc();
        const items = [];
        // Find all rubric groups and individual items
        const rubricGroups = Array.from(root.querySelectorAll('.rubricItemGroup'));
        const individualItems = Array.from(root.querySelectorAll('.rubricItem')).filter(item => !item.closest('.rubricItemGroup'));
        // Process individual checkbox items
        for (const item of individualItems) {
            const element = item;
            const itemId = this.extractItemId(element);
            const description = this.extractItemDescription(element);
            const points = this.extractItemPoints(element);
            if (itemId && description !== null) {
                items.push({
                    id: itemId,
                    description,
                    points,
                    itemType: 'CHECKBOX',
                    element
                });
            }
        }
        // Process radio button groups
        for (const group of rubricGroups) {
            const groupElement = group;
            const groupId = this.extractGroupId(groupElement);
            const groupDesc = this.extractGroupDescription(groupElement);
            if (groupId && groupDesc !== null) {
                items.push({
                    id: groupId,
                    description: groupDesc,
                    points: 0, // Radio groups typically don't have points themselves
                    itemType: 'RADIO',
                    element: groupElement
                });
            }
        }
        return { type: 'structured', items };
    }
    /**
     * Helper methods for DOM extraction
     */
    extractItemId(element) {
        // Try multiple methods to extract ID
        const dataId = element.dataset.rubricItemId;
        if (dataId)
            return dataId;
        // Try to extract from classes or other attributes
        const classList = Array.from(element.classList);
        for (const className of classList) {
            const match = className.match(/rubric-item-(\w+)/);
            if (match)
                return match[1];
        }
        // Generate ID from position if all else fails
        const allItems = Array.from(element.closest('body')?.querySelectorAll('.rubricItem, .rubricItemGroup') || []);
        const index = allItems.indexOf(element);
        return index >= 0 ? `item-${index}` : null;
    }
    extractItemDescription(element) {
        const descriptionSelectors = [
            '.rubricField-description',
            '.rubric-description',
            '.rubric-text',
            '.description'
        ];
        for (const selector of descriptionSelectors) {
            const descEl = element.querySelector(selector);
            if (descEl) {
                let desc = descEl.textContent?.trim() || '';
                // Clean up common prefixes
                desc = desc.replace(/^Grading comment:\s*/, '').trim();
                if (desc)
                    return desc;
            }
        }
        return null;
    }
    extractItemPoints(element) {
        const pointsSelectors = [
            '.rubricField-points',
            '.rubric-points',
            '.points'
        ];
        for (const selector of pointsSelectors) {
            const ptsEl = element.querySelector(selector);
            if (ptsEl) {
                const ptsText = ptsEl.textContent?.trim() || '';
                const match = ptsText.match(/-?\d+(\.\d+)?/);
                if (match) {
                    return parseFloat(match[0]);
                }
            }
        }
        return 0;
    }
    extractGroupId(element) {
        return this.extractItemId(element);
    }
    extractGroupDescription(element) {
        const keyElement = element.querySelector('.rubricItemGroup--key');
        if (keyElement) {
            return keyElement.textContent?.trim() || null;
        }
        return this.extractItemDescription(element);
    }
    /**
     * Convert rubric items to backend format
     */
    async convertRubricToBackendFormat(rubricResult) {
        if (!rubricResult || rubricResult.type !== 'structured') {
            return [];
        }
        const backendItems = [];
        for (const item of rubricResult.items) {
            const backendItem = {
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
        return filteredItems;
    }
    /**
     * Check if a file is a test file
     */
    isTestFile(filePath) {
        const filesConfig = getConfigManager().getFilesConfig();
        const lower = filePath.toLowerCase();
        // Check if it's a supported extension
        const hasValidExtension = filesConfig.supportedExtensions.some(ext => lower.endsWith(ext));
        if (!hasValidExtension)
            return true; // Non-source files are considered test files
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
     * Sort rubric items using consistent ordering
     */
    sortRubricItems(items) {
        return items.sort((a, b) => {
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
        });
    }
    /**
     * Main grading method - works with both modular and Chrome extension contexts
     */
    async gradeSubmission(onProgress) {
        console.log('🚀 UnifiedGradingService: Starting grading process...');
        // Extract assignment context
        const context = this.extractAssignmentContext();
        if (!context) {
            throw new Error('Could not extract assignment context from page');
        }
        console.log('📋 Assignment context:', context);
        // Extract rubric structure
        let rubricResult;
        // Try to use modular API if available
        if (this.api && typeof this.api.extractRubricStructure === 'function') {
            rubricResult = this.api.extractRubricStructure();
        }
        else {
            // Fallback to DOM extraction
            rubricResult = await this.extractRubricFromDOM();
        }
        if (!rubricResult || rubricResult.type !== 'structured') {
            throw new Error('No structured rubric found on page');
        }
        console.log(`📊 Found ${rubricResult.items.length} rubric items`);
        // Download submission files
        console.log('📥 Downloading submission files...');
        let downloadResult;
        try {
            // Try to use the provided API or fall back to global
            const api = this.api || window.GradescopeAPI;
            if (!api || !api.downloadSubmissionFiles) {
                throw new Error('GradescopeAPI download method not available');
            }
            downloadResult = await api.downloadSubmissionFiles(context.submission_id);
            console.log(`✅ Downloaded ${Object.keys(downloadResult.files).length} files`);
        }
        catch (error) {
            console.error('❌ Error downloading files:', error);
            throw new Error(`Failed to download submission files: ${error.message}`);
        }
        // Convert rubric to backend format
        console.log('🔄 Converting rubric to backend format...');
        const backendRubricItems = await this.convertRubricToBackendFormat(rubricResult);
        // Prepare request
        const filesConfig = getConfigManager().getFilesConfig();
        const request = {
            assignment_context: context,
            source_files: Object.fromEntries(Object.entries(downloadResult.files).map(([path, file]) => {
                let content = file.content;
                if (this.isTestFile(path) && typeof content === 'string') {
                    if (content.length > filesConfig.testFileMaxContent) {
                        content = content.slice(0, filesConfig.testFileMaxContent) + '[TRIMMED]';
                    }
                }
                return [path, content];
            })),
            rubric_items: this.sortRubricItems(backendRubricItems)
        };
        console.log('📤 Sending grading request to backend...');
        console.log('Request preview:', {
            assignment_context: request.assignment_context,
            file_count: Object.keys(request.source_files).length,
            rubric_item_count: request.rubric_items.length
        });
        // Send request to backend with SSE streaming
        try {
            const backendConfig = getConfigManager().getBackendConfig();
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
            console.log('✅ UnifiedGradingService: Grading completed successfully');
        }
        catch (error) {
            console.error('❌ UnifiedGradingService: Error during grading:', error);
            throw error;
        }
    }
    /**
     * Apply grading decision to the UI
     */
    async applyGradingDecision(decision) {
        // This method would apply grading decisions to the UI
        // Implementation would depend on the specific UI framework being used
        console.log('UnifiedGradingService: Applying grading decision', decision);
        // TODO: Implement UI application logic
        // This could be delegated to a UI service or handled directly
    }
    /**
     * Get service configuration
     */
    getConfig() {
        return {
            backendUrl: this.backendUrl,
            hasModularAPI: !!this.api
        };
    }
    /**
     * Update backend URL
     */
    setBackendUrl(url) {
        this.backendUrl = url;
        console.log('UnifiedGradingService: Backend URL updated to', url);
    }
}
//# sourceMappingURL=unified-grading-service.js.map