import { RubricResult } from '../../types/index';
export declare class RubricExtractor {
    /**
     * Main rubric extraction method
     */
    extractRubric(): RubricResult;
    /**
     * Extract rubric from DOM elements
     */
    private extractFromDOM;
    /**
     * Extract radio group with accordion support
     */
    private extractRadioGroup;
    /**
     * Extract checkbox item
     */
    private extractCheckboxItem;
    /**
     * Check if rubric item is selected
     */
    isRubricItemSelected(element?: HTMLElement): boolean;
    /**
     * Accordion-based radio diagnostic
     */
    diagnoseRadioGroups(): Promise<void>;
    /**
     * Expand group if collapsed
     */
    private expandGroupIfNeeded;
    /**
     * Collapse group
     */
    private collapseGroup;
}
//# sourceMappingURL=rubric-extractor.d.ts.map