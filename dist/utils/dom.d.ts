/**
 * Get the inner document, handling iframe contexts
 */
export declare function getInnerDoc(): Document;
/**
 * Get the iframe document if available
 */
export declare function getIframeDoc(): Document | null;
/**
 * Wait for element to appear in DOM
 */
export declare function waitForElement(selector: string, timeout?: number): Promise<Element | null>;
/**
 * Check if element is visible
 */
export declare function isElementVisible(element: Element): boolean;
//# sourceMappingURL=dom.d.ts.map