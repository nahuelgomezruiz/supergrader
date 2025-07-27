// Grading service module for backend API integration
import { getInnerDoc } from '../../utils/dom';
import { delay } from '../../utils/async';
export class GradingService {
    constructor(api, backendUrl = 'http://localhost:8000') {
        this.api = api;
        this.backendUrl = backendUrl;
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
    async extractRadioOptions(groupElement) {
        const options = {};
        const root = getInnerDoc();
        // Expand the accordion if needed
        const expandBtn = groupElement.querySelector('button[aria-expanded="false"]');
        if (expandBtn) {
            expandBtn.click();
            await delay(350); // Wait for DOM update
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
            await delay(150);
        }
        return options;
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
    isTestFile(filePath) {
        const lower = filePath.toLowerCase();
        if (lower.endsWith('.cpp') || lower.endsWith('.h'))
            return false;
        const baseName = lower.split('/').pop() || lower;
        if (baseName === 'makefile' || baseName.startsWith('readme'))
            return false;
        return true;
    }
    /**
     * Grade submission using the backend API
     */
    async gradeSubmission(onProgress) {
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
        let downloadResult;
        try {
            // Use the global GradescopeAPI instance which has the download method
            const globalApi = window.GradescopeAPI;
            if (!globalApi || !globalApi.downloadSubmissionFiles) {
                throw new Error('GradescopeAPI download method not available');
            }
            downloadResult = await globalApi.downloadSubmissionFiles(context.submission_id);
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
            console.log('✅ Grading completed successfully');
        }
        catch (error) {
            console.error('❌ Error during grading:', error);
            throw error;
        }
    }
    /**
     * Apply grading decisions to the UI
     */
    async applyGradingDecision(decision) {
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
                const keyButton = targetItem.element.querySelector('.rubricItem--key');
                if (keyButton) {
                    keyButton.click();
                    await delay(200); // Wait for UI update
                    console.log(`${shouldBeSelected ? '✅' : '⬜'} Toggled ${decision.rubric_item_id}`);
                }
            }
        }
        else if (decision.type === 'RADIO' && decision.verdict.selected_option) {
            // For radio items - need to expand accordion and select option
            console.log(`📻 Applying radio selection for ${decision.rubric_item_id}: "${decision.verdict.selected_option}"`);
            // Expand accordion
            const expandBtn = targetItem.element.querySelector('button[aria-expanded="false"]');
            if (expandBtn) {
                expandBtn.click();
                await delay(350);
            }
            // Find and click the matching option
            const root = getInnerDoc();
            const headerId = targetItem.element.querySelector('.rubricItemGroup--key')?.getAttribute('id');
            let radioOptions = [];
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
                    const keyBtn = optionElement.querySelector('.rubricItem--key');
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
                collapseBtn.click();
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
//# sourceMappingURL=grading-service.js.map