// Rubric extraction module with radio button accordion support
import { getInnerDoc } from '../../utils/dom';
import { delay } from '../../utils/async';
export class RubricExtractor {
    /**
     * Main rubric extraction method
     */
    extractRubric() {
        const root = getInnerDoc();
        // Try React props first
        const propsEl = root.querySelector('[data-react-props]');
        if (propsEl) {
            try {
                const propsAttr = propsEl.getAttribute('data-react-props');
                if (propsAttr) {
                    const data = JSON.parse(atob(propsAttr));
                    if (data?.rubricItems?.length) {
                        const items = data.rubricItems.map((item) => ({
                            id: item.id || item.rubric_item_id,
                            description: item.description || item.text,
                            points: item.points || 0
                        }));
                        const rubricStyle = data.rubricStyle || 'CHECKBOX';
                        return { type: 'structured', items, rubricStyle };
                    }
                }
            }
            catch (error) {
                // Fall through to DOM parsing
            }
        }
        // DOM-based extraction
        let domItems = Array.from(root.querySelectorAll('.rubric-item[data-rubric-item-id]'));
        if (domItems.length === 0) {
            domItems = Array.from(root.querySelectorAll('.rubricItem'));
            const groupItems = Array.from(root.querySelectorAll('.rubricItemGroup'));
            domItems = domItems.concat(groupItems);
        }
        if (domItems.length) {
            return this.extractFromDOM(domItems);
        }
        // Check for manual scoring
        const scoreBox = root.querySelector('input[name="score"], input[type="number"][placeholder*="score" i], input[type="number"][id*="score" i]');
        if (scoreBox) {
            return { type: 'manual', box: scoreBox };
        }
        return null;
    }
    /**
     * Extract rubric from DOM elements
     */
    extractFromDOM(domItems) {
        const items = [];
        let hasRadio = false;
        let hasCheckbox = false;
        domItems.forEach((element, index) => {
            let itemId = element.dataset.rubricItemId;
            if (!itemId) {
                if (element.classList.contains('rubricItemGroup')) {
                    // Handle radio groups with accordion expansion
                    const result = this.extractRadioGroup(element, index);
                    if (result) {
                        items.push(result);
                        hasRadio = true;
                    }
                }
                else {
                    // Regular checkbox item
                    const result = this.extractCheckboxItem(element, index);
                    if (result) {
                        items.push(result);
                        hasCheckbox = true;
                    }
                }
            }
        });
        const rubricStyle = hasRadio && hasCheckbox ? 'MIXED' : hasRadio ? 'RADIO' : 'CHECKBOX';
        return { type: 'structured', items, rubricStyle };
    }
    /**
     * Extract radio group with accordion support
     */
    extractRadioGroup(element, index) {
        const groupKeyButton = element.querySelector('.rubricItemGroup--key');
        const itemId = groupKeyButton?.textContent?.trim() || `group_${index}`;
        const groupDescElement = element.querySelector('.rubricField-description');
        const groupDesc = groupDescElement?.textContent?.trim();
        // Extract radio options using accordion approach
        const allOptions = [];
        let selectedOption = '';
        let selectedPoints = 0;
        const headerId = groupKeyButton?.getAttribute('id');
        const root = getInnerDoc();
        let radioOptions = [];
        if (headerId) {
            const container = root.querySelector(`[aria-describedby="${headerId}"]`);
            if (container) {
                radioOptions = Array.from(container.querySelectorAll('.rubricItem'));
            }
        }
        // Fallbacks
        if (radioOptions.length === 0) {
            const possible = element.parentElement?.querySelectorAll('.rubricItemGroup--rubricItems .rubricItem');
            if (possible && possible.length) {
                radioOptions = Array.from(possible);
            }
        }
        if (radioOptions.length === 0) {
            radioOptions = Array.from(root.querySelectorAll('.rubricItemGroup--rubricItems .rubricItem'));
        }
        // Parse each option
        if (radioOptions.length > 0) {
            radioOptions.forEach((optionElement) => {
                const keyBtn = optionElement.querySelector('.rubricItem--key');
                const ptsEl = optionElement.querySelector('.rubricField-points');
                const ptsText = ptsEl?.textContent?.trim() || '';
                const optionPointValue = parseFloat(ptsText.replace(/[^\d.-]/g, '')) || 0;
                const descEl = optionElement.querySelector('.rubricField-description');
                let optionDesc = descEl?.textContent?.trim() || '';
                optionDesc = optionDesc.replace(/^Grading comment:\s*/, '');
                const optionText = optionDesc ? `"${optionDesc}" (${optionPointValue} pts)` :
                    `${keyBtn?.textContent || '?'} (${optionPointValue} pts)`;
                allOptions.push(optionText);
                const keyApplied = keyBtn?.classList.contains('rubricItem--key-applied');
                const ariaPressed = keyBtn?.getAttribute('aria-pressed') === 'true';
                if (keyApplied || ariaPressed) {
                    selectedOption = optionDesc;
                    selectedPoints = optionPointValue;
                }
            });
        }
        else {
            // Group is collapsed
            const summaryEl = element.querySelector('.rubricField-description');
            if (summaryEl) {
                const cleanSummary = summaryEl.textContent?.trim().replace(/^Grading comment:\s*/, '') || '';
                allOptions.push(`"${cleanSummary}" (collapsed - expand to see all options)`);
                selectedOption = cleanSummary;
                const groupPts = element.querySelector('.rubricField-points')?.textContent?.trim() || '0';
                selectedPoints = parseFloat(groupPts.replace(/[^\d.-]/g, '')) || 0;
            }
        }
        // Build description
        let description = `📻 ${groupDesc || 'Radio Group'} (Select one option)`;
        if (allOptions.length > 0) {
            description += `\n  📋 Available options (${allOptions.length}):\n  ◦ ${allOptions.join('\n  ◦ ')}`;
        }
        if (selectedOption) {
            description += `\n  ⭐ Currently selected: "${selectedOption}" (${selectedPoints} pts)`;
        }
        else {
            description += `\n  ⚪ No option currently selected`;
        }
        return {
            id: itemId,
            description,
            points: selectedPoints,
            element,
            itemType: 'RADIO'
        };
    }
    /**
     * Extract checkbox item
     */
    extractCheckboxItem(element, index) {
        const keyButton = element.querySelector('.rubricItem--key');
        const itemId = keyButton?.textContent?.trim() || `item_${index}`;
        const descElement = element.querySelector('.rubricField-description, .rubricField.rubricField-description');
        const description = descElement?.textContent?.trim();
        const pointsElement = element.querySelector('.rubricField-points, .rubricField.rubricField-points');
        const pointsText = pointsElement?.textContent?.trim();
        const points = pointsText ? parseFloat(pointsText.replace(/[^\d.-]/g, '')) || 0 : 0;
        if (itemId && description) {
            return {
                id: itemId,
                description,
                points,
                element,
                itemType: 'CHECKBOX'
            };
        }
        return null;
    }
    /**
     * Check if rubric item is selected
     */
    isRubricItemSelected(element) {
        if (!element)
            return false;
        // Check for input elements
        const input = element.querySelector('input[type="checkbox"], input[type="radio"]');
        if (input) {
            return input.checked;
        }
        // Check for applied classes
        const keyButton = element.querySelector('.rubricItem--key');
        if (keyButton && keyButton.classList.contains('rubricItem--key-applied')) {
            return true;
        }
        const groupKeyButton = element.querySelector('.rubricItemGroup--key');
        if (groupKeyButton && (groupKeyButton.classList.contains('rubricItemGroup--key-is-applied') ||
            groupKeyButton.classList.contains('rubricItemGroup--key-applied'))) {
            return true;
        }
        return false;
    }
    /**
     * Accordion-based radio diagnostic
     */
    async diagnoseRadioGroups() {
        const root = getInnerDoc();
        const groups = Array.from(root.querySelectorAll('.rubricItemGroup'));
        if (groups.length === 0) {
            console.log('⚪ No radio groups detected');
            return;
        }
        console.log(`📻 Inspecting ${groups.length} radio groups...`);
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            await this.expandGroupIfNeeded(group);
            // Get options from expanded group
            const headerId = group.querySelector('.rubricItemGroup--key')?.getAttribute('id');
            let options = [];
            if (headerId) {
                const container = root.querySelector(`[aria-describedby="${headerId}"]`);
                if (container)
                    options = Array.from(container.querySelectorAll('.rubricItem'));
            }
            if (options.length === 0) {
                options = Array.from(group.querySelectorAll('.rubricItemGroup--rubricItems .rubricItem'));
            }
            const title = group.querySelector('.rubricField-description')?.textContent?.trim() || `Group ${i + 1}`;
            console.log(`${i + 1}. ${title} — ${options.length} options`);
            options.forEach((opt, idx) => {
                const desc = opt.querySelector('.rubricField-description')?.textContent?.trim() || 'No desc';
                const pts = opt.querySelector('.rubricField-points')?.textContent?.trim() || '';
                const key = opt.querySelector('.rubricItem--key')?.textContent?.trim() || String.fromCharCode(65 + idx);
                const isSel = opt.querySelector('.rubricItem--key-applied');
                const selMark = isSel ? '⭐' : '•';
                console.log(`   ${selMark} ${key}: ${desc.substring(0, 80)} ${pts}`);
            });
            await this.collapseGroup(group);
        }
        console.log('✅ Radio diagnostic complete');
    }
    /**
     * Expand group if collapsed
     */
    async expandGroupIfNeeded(group) {
        const btn = group.querySelector('button[aria-expanded="false"]');
        if (btn) {
            btn.click();
            await delay(350); // Wait for DOM render
        }
    }
    /**
     * Collapse group
     */
    async collapseGroup(group) {
        const btnCollapse = group.querySelector('button[aria-expanded="true"]');
        if (btnCollapse) {
            btnCollapse.click();
            await delay(150);
        }
    }
}
//# sourceMappingURL=rubric-extractor.js.map