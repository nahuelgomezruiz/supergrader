// Modular Gradescope API Entry Point
// This file maintains backward compatibility while using the new modular architecture
import { GradescopeAPI } from '../modules/api/gradescope-api';
import { RubricExtractor } from '../modules/rubric/rubric-extractor';
import { getInnerDoc } from '../utils/dom';
// Create global instances
const gradescopeAPI = new GradescopeAPI();
const rubricExtractor = new RubricExtractor();
// Global getRubric function (maintains compatibility)
function getRubric() {
    return rubricExtractor.extractRubric();
}
// Global diagnostic function
async function showRadioDiag() {
    await rubricExtractor.diagnoseRadioGroups();
}
// Initialize and expose to global scope
async function initializeModularAPI() {
    try {
        const initialized = await gradescopeAPI.initialize();
        // Expose to global scope for backward compatibility
        const windowExt = window;
        windowExt.GradescopeAPI = gradescopeAPI;
        windowExt.getRubric = getRubric;
        windowExt.getInnerDoc = getInnerDoc;
        windowExt.showRadioDiag = showRadioDiag;
        // Store auth status in DOM for console access
        const authStatus = gradescopeAPI.getAuthState();
        const statusElement = document.createElement('div');
        statusElement.id = 'supergrader-auth-status';
        statusElement.style.display = 'none';
        statusElement.textContent = JSON.stringify(authStatus);
        document.body.appendChild(statusElement);
        return initialized;
    }
    catch (error) {
        console.error('Failed to initialize modular API:', error);
        return false;
    }
}
// Enhanced rubric display function
function showEnhancedRubricData() {
    console.log('🔍 ENHANCED RUBRIC DATA DISPLAY:');
    console.log('═'.repeat(50));
    const rubricResult = getRubric();
    if (!rubricResult) {
        console.log('❌ No rubric found on this page');
        console.log('💡 This might be a non-grading page or unsupported interface');
        console.log('═'.repeat(50));
        return;
    }
    if (rubricResult.type === 'structured') {
        const styleEmoji = rubricResult.rubricStyle === 'RADIO' ? '📻' :
            rubricResult.rubricStyle === 'CHECKBOX' ? '☑️' :
                rubricResult.rubricStyle === 'MIXED' ? '🔄' : '📝';
        console.log(`${styleEmoji} Found ${rubricResult.items.length} rubric items (${rubricResult.rubricStyle} style)`);
        console.log('');
        let radioCount = 0;
        let checkboxCount = 0;
        rubricResult.items.forEach((item, index) => {
            const itemTypeEmoji = item.itemType === 'RADIO' ? '📻' : '☑️';
            if (item.description && item.description.includes('Available options:')) {
                radioCount++;
                const lines = item.description.split('\n');
                const title = lines[0];
                const optionLines = lines.filter((l) => l.includes('◦ '));
                const selectedLine = lines.find((l) => l.includes('⭐ Currently selected:'));
                console.log(`${itemTypeEmoji} ${index + 1}. ${title} (${item.points} pts)`);
                if (optionLines.length > 0) {
                    console.log(`    📋 Available Options:`);
                    optionLines.forEach((option) => {
                        const cleanOption = option.replace(/^\s*◦\s*/, '');
                        console.log(`       • ${cleanOption}`);
                    });
                }
                if (selectedLine) {
                    const selected = selectedLine.replace(/^\s*⭐ Currently selected:\s*/, '');
                    console.log(`    ⭐ ${selected}`);
                }
                else {
                    console.log(`    ⚪ No option currently selected`);
                }
            }
            else {
                checkboxCount++;
                const desc = item.description && item.description.length > 100 ?
                    item.description.substring(0, 100) + '...' : item.description || 'No description';
                const selected = item.element ?
                    gradescopeAPI.isRubricItemSelected(item.element) : false;
                const selectionEmoji = selected ? '✅' : '⬜';
                console.log(`${itemTypeEmoji} ${index + 1}. ${desc} (${item.points} pts) ${selectionEmoji}`);
            }
            console.log('');
        });
        console.log('📊 RUBRIC SUMMARY:');
        console.log(`    📻 Radio Groups: ${radioCount}`);
        console.log(`    ☑️ Checkbox Items: ${checkboxCount}`);
        console.log(`    🎯 Total Items: ${rubricResult.items.length}`);
    }
    else if (rubricResult.type === 'manual') {
        console.log('✍️ Manual scoring interface detected');
        console.log(`📝 Current score: ${rubricResult.box?.value || '(empty)'}`);
        console.log(`🎯 Score box placeholder: "${rubricResult.box?.placeholder || 'none'}"`);
    }
    console.log('═'.repeat(50));
}
// Initialize when loaded
initializeModularAPI().then(success => {
    if (success) {
        console.log('✅ Modular Gradescope API initialized successfully');
        // Expose enhanced functions globally
        window.showEnhancedRubricData = showEnhancedRubricData;
        window.showRadioDiag = showRadioDiag;
    }
    else {
        console.error('❌ Failed to initialize modular Gradescope API');
    }
});
// Export for use in other modules
export { gradescopeAPI, rubricExtractor, getRubric, showRadioDiag };
//# sourceMappingURL=gradescope-api-modular.js.map