// DOM utility functions
/**
 * Get the inner document, handling iframe contexts
 */
export function getInnerDoc() {
    const iframe = document.querySelector('iframe[src*="/submissions/"]');
    if (iframe?.contentDocument) {
        return iframe.contentDocument;
    }
    return document;
}
/**
 * Get the iframe document if available
 */
export function getIframeDoc() {
    const iframe = document.querySelector('iframe[src*="/submissions/"]');
    return iframe?.contentDocument || null;
}
/**
 * Wait for element to appear in DOM
 */
export function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of Array.from(mutation.addedNodes)) {
                    if (node instanceof Element) {
                        const found = node.matches(selector) ? node : node.querySelector(selector);
                        if (found) {
                            observer.disconnect();
                            resolve(found);
                            return;
                        }
                    }
                }
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}
/**
 * Check if element is visible
 */
export function isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 &&
        window.getComputedStyle(element).visibility !== 'hidden';
}
//# sourceMappingURL=dom.js.map