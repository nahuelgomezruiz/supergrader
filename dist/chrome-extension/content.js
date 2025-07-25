"use strict";
// Main orchestrator for supergrader
// This script detects when user is on grading page and manages the overall workflow
console.log('supergrader: Content script loaded');
// Configuration
const CONFIG = {
    BACKEND_URL: 'http://localhost:8000', // Will be configurable later
    CONFIDENCE_THRESHOLD: 0.8,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000 // 1 second
};
// Main application state
let appState = {
    courseId: null,
    assignmentId: null,
    submissionId: null,
    assignmentType: null,
    isInitialized: false,
    retryCount: 0,
    domReady: false
};
/**
 * Enhanced URL pattern matching and ID extraction
 */
function extractPageInfo() {
    console.log('supergrader: Extracting page information...');
    // Extract IDs from URL - support both assignments and questions URLs
    const urlMatch = window.location.pathname.match(/\/courses\/(\d+)\/(assignments|questions)\/(\d+)\/submissions\/(\d+)\/grade/);
    if (urlMatch) {
        const [, courseId, assignmentType, assignmentId, submissionId] = urlMatch;
        // Validate extracted IDs
        if (!courseId || !assignmentId || !submissionId) {
            console.error('supergrader: Invalid IDs extracted from URL');
            return false;
        }
        // Validate IDs are numeric
        if (!/^\d+$/.test(courseId) || !/^\d+$/.test(assignmentId) || !/^\d+$/.test(submissionId)) {
            console.error('supergrader: Non-numeric IDs detected');
            return false;
        }
        // Update state with validated IDs
        appState.courseId = courseId;
        appState.assignmentId = assignmentId;
        appState.submissionId = submissionId;
        appState.assignmentType = assignmentType;
        console.log('supergrader: Extracted page info:', {
            courseId,
            assignmentType,
            assignmentId,
            submissionId
        });
        return true;
    }
    console.log('supergrader: Not a grading page, skipping initialization');
    return false;
}
/**
 * Enhanced DOM readiness detection with multiple strategies
 */
function waitForDOM() {
    return new Promise((resolve) => {
        // Strategy 1: Check if already loaded
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            console.log('supergrader: DOM already ready');
            appState.domReady = true;
            resolve();
            return;
        }
        // Strategy 2: Listen for DOMContentLoaded
        const domContentHandler = () => {
            console.log('supergrader: DOM content loaded');
            appState.domReady = true;
            document.removeEventListener('DOMContentLoaded', domContentHandler);
            resolve();
        };
        document.addEventListener('DOMContentLoaded', domContentHandler);
        // Strategy 3: Fallback - check periodically for critical elements
        const checkInterval = setInterval(() => {
            const rubricContainer = document.querySelector('.rubric-container, .question-container, #rubric-controls');
            if (rubricContainer) {
                console.log('supergrader: Critical elements found, DOM ready');
                clearInterval(checkInterval);
                document.removeEventListener('DOMContentLoaded', domContentHandler);
                appState.domReady = true;
                resolve();
            }
        }, 100);
        // Timeout fallback
        setTimeout(() => {
            clearInterval(checkInterval);
            document.removeEventListener('DOMContentLoaded', domContentHandler);
            console.warn('supergrader: DOM readiness timeout, proceeding anyway');
            appState.domReady = true;
            resolve();
        }, 10000); // 10 second timeout
    });
}
/**
 * Enhanced UI injection point detection with multiple strategies
 */
function findInjectionPoint() {
    console.log('supergrader: Finding UI injection point...');
    // Strategy 1: Primary container selectors (most specific to least)
    const primarySelectors = [
        '.rubric-container',
        '.question-container',
        '#rubric-controls',
        '.grade-container',
        '.submission-header',
        '.instructor-controls'
    ];
    for (const selector of primarySelectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log(`supergrader: Found primary injection point: ${selector}`);
            return element;
        }
    }
    // Strategy 2: Find by content/text patterns
    const contentSelectors = [
        'div[data-react-class*="Grade"]',
        'div[data-react-class*="Rubric"]',
        'div[data-react-class*="Question"]'
    ];
    for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log(`supergrader: Found content-based injection point: ${selector}`);
            return element;
        }
    }
    // Strategy 3: Fallback selectors (broader)
    const fallbackSelectors = [
        '.main-content',
        '#main',
        '.container',
        'body'
    ];
    for (const selector of fallbackSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log(`supergrader: Found fallback injection point: ${selector}`);
            return element;
        }
    }
    console.error('supergrader: No suitable injection point found');
    return null;
}
/**
 * Enhanced initialization with comprehensive error handling and retry logic
 */
async function initializeExtension() {
    console.log('supergrader: Starting enhanced initialization...');
    try {
        // Reset retry count if we're starting fresh
        if (!appState.isInitialized) {
            appState.retryCount = 0;
        }
        // Step 1: Extract page information with validation
        if (!extractPageInfo()) {
            console.log('supergrader: Not a supported grading page, aborting');
            return;
        }
        // Step 2: Wait for DOM with enhanced readiness detection
        await waitForDOM();
        // Step 3: Find injection point with fallbacks
        const injectionPoint = findInjectionPoint();
        if (!injectionPoint) {
            throw new Error('No suitable injection point found after DOM ready');
        }
        // Step 4: Gather page metadata with error handling
        let pageMetadata;
        try {
            pageMetadata = await extractPageMetadata();
        }
        catch (error) {
            console.warn('supergrader: Failed to extract page metadata:', error);
            pageMetadata = undefined; // Continue without metadata
        }
        // Step 5: Initialize Gradescope API with authentication
        console.log('supergrader: Initializing Gradescope API...');
        const gradescopeAPI = window.GradescopeAPI;
        if (!gradescopeAPI) {
            throw new Error('GradescopeAPI not loaded - scripts may be loading out of order');
        }
        const authSuccess = await gradescopeAPI.initialize();
        if (!authSuccess) {
            throw new Error('Gradescope API authentication failed');
        }
        // Step 6: Create enhanced state object
        const enhancedState = {
            ...appState,
            injectionPoint,
            pageMetadata,
            rubricData: null,
            sourceCode: undefined
        };
        // Step 7: Initialize UI Controller with enhanced state
        console.log('supergrader: Initializing UI Controller...');
        const uiController = window.UIController;
        if (!uiController) {
            throw new Error('UIController not loaded - scripts may be loading out of order');
        }
        uiController.initialize(enhancedState);
        // Step 8: Set up cross-component communication
        setupGlobalState(enhancedState, gradescopeAPI, uiController);
        // Step 9: Mark as initialized
        appState.isInitialized = true;
        console.log('supergrader: Enhanced initialization completed successfully');
    }
    catch (error) {
        console.error('supergrader: Enhanced initialization failed:', error);
        // Retry logic with exponential backoff
        if (appState.retryCount < CONFIG.MAX_RETRIES) {
            appState.retryCount++;
            const delay = CONFIG.RETRY_DELAY * Math.pow(2, appState.retryCount - 1);
            console.log(`supergrader: Retrying initialization in ${delay}ms (attempt ${appState.retryCount}/${CONFIG.MAX_RETRIES})`);
            setTimeout(() => {
                initializeExtension().catch(console.error);
            }, delay);
        }
        else {
            console.error('supergrader: Max retries exceeded, giving up');
            // Could show user-facing error message here
        }
    }
}
/**
 * Extract page metadata with enhanced selectors
 */
async function extractPageMetadata() {
    console.log('supergrader: Extracting page metadata...');
    const metadata = {};
    try {
        // Assignment name extraction
        const assignmentSelectors = [
            'h1.assignment-title',
            '.assignment-name',
            '.page-header h1',
            'h1[class*="assignment"]',
            'title'
        ];
        for (const selector of assignmentSelectors) {
            const element = document.querySelector(selector);
            if (element?.textContent?.trim()) {
                metadata.assignmentName = element.textContent.trim();
                break;
            }
        }
        // Course name extraction
        const courseSelectors = [
            '.breadcrumb .course-name',
            '.navbar .course-title',
            'nav a[href*="/courses/"]'
        ];
        for (const selector of courseSelectors) {
            const element = document.querySelector(selector);
            if (element?.textContent?.trim()) {
                metadata.courseName = element.textContent.trim();
                break;
            }
        }
        // Student ID extraction (if available and not anonymized)
        const studentSelectors = [
            '.submission-info .student-id',
            '.grading-header .student-name',
            '.submission-header [data-student-id]'
        ];
        for (const selector of studentSelectors) {
            const element = document.querySelector(selector);
            if (element?.textContent?.trim() && !element.textContent.includes('Anonymous')) {
                metadata.studentId = element.textContent.trim();
                break;
            }
        }
        // Submission time extraction
        const timeSelectors = [
            '.submission-info .submission-time',
            '.submission-header time',
            '[data-submission-time]'
        ];
        for (const selector of timeSelectors) {
            const element = document.querySelector(selector);
            if (element?.textContent?.trim()) {
                metadata.submissionTime = element.textContent.trim();
                break;
            }
        }
        console.log('supergrader: Extracted metadata:', metadata);
        return metadata;
    }
    catch (error) {
        console.warn('supergrader: Error extracting metadata:', error);
        return undefined;
    }
}
/**
 * Set up global state management for cross-component communication
 */
function setupGlobalState(state, api, ui) {
    // Store references globally for cross-component access
    window.supergraderState = state;
    window.supergraderAPI = api;
    window.supergraderUI = ui;
    // Create/extend console debugging helper using IIFE with Object.assign
    (() => {
        const contentHelpers = {
            api: api,
            ui: ui,
            getStatus: () => api?.getAuthStatus?.(),
            getState: () => state,
            downloadTest: (submissionId) => {
                const event = new CustomEvent('SUPERGRADER_TEST_DOWNLOAD', {
                    detail: { submissionId }
                });
                window.dispatchEvent(event);
            }
        };
        // Merge with any existing supergrader object
        window.supergrader = Object.assign(window.supergrader || {}, contentHelpers);
        const keys = Object.keys(window.supergrader);
        console.log('supergrader: Content script helpers merged:', keys);
    })();
    // Also ensure the objects are available at the global level for debugging
    window.supergraderDebug = {
        state,
        api,
        ui,
        version: '1.0.1'
    };
    // Set up event listeners for state updates
    document.addEventListener('supergrader:stateUpdate', ((event) => {
        Object.assign(state, event.detail);
        console.log('supergrader: State updated via event', event.detail);
    }));
    // Set up periodic health checks
    setInterval(() => {
        if (state.isInitialized) {
            performHealthCheck();
        }
    }, 30000); // Every 30 seconds
}
/**
 * Perform periodic health checks
 */
function performHealthCheck() {
    // Check if critical elements still exist
    const injectionPoint = window.supergraderState?.injectionPoint;
    if (injectionPoint && !document.contains(injectionPoint)) {
        console.warn('supergrader: Injection point no longer in DOM, reinitializing...');
        appState.isInitialized = false;
        initializeExtension().catch(console.error);
    }
}
/**
 * Handle grading request from popup
 */
async function handleGradingRequest(backendUrl) {
    console.log('Content: Starting grading with backend:', backendUrl);
    try {
        // Use the standalone grading service
        const ChromeGradingService = window.ChromeGradingService;
        if (!ChromeGradingService) {
            throw new Error('ChromeGradingService not loaded');
        }
        // Create grading service
        const gradingService = new ChromeGradingService(backendUrl);
        // Start grading with progress callback
        await gradingService.gradeSubmission((event) => {
            console.log('Content: Grading event', event);
            // Send progress updates to popup
            if (event.type === 'partial_result') {
                chrome.runtime.sendMessage({
                    action: 'gradingProgress',
                    progress: event.progress || 0,
                    rubricItemId: event.rubric_item_id,
                    decision: event.decision
                });
            }
            else if (event.type === 'job_complete') {
                chrome.runtime.sendMessage({
                    action: 'gradingComplete',
                    message: event.message
                });
            }
            else if (event.type === 'error') {
                chrome.runtime.sendMessage({
                    action: 'gradingError',
                    error: event.error
                });
            }
        });
    }
    catch (error) {
        console.error('Content: Error in grading process', error);
        chrome.runtime.sendMessage({
            action: 'gradingError',
            error: error.message
        });
        throw error;
    }
}
// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content: Received message', request);
    switch (request.action) {
        case 'getState':
            sendResponse({ state: appState });
            break;
        case 'settingsUpdated':
            console.log('Content: Settings updated', request.settings);
            // Apply new settings if needed
            if (request.settings?.confidenceThreshold) {
                CONFIG.CONFIDENCE_THRESHOLD = request.settings.confidenceThreshold;
            }
            sendResponse({ success: true });
            break;
        case 'startGrading':
            console.log('Content: Starting grading process...');
            handleGradingRequest(request.backendUrl || CONFIG.BACKEND_URL)
                .then(() => {
                sendResponse({ success: true });
            })
                .catch(error => {
                console.error('Content: Grading error', error);
                sendResponse({ success: false, error: error.message });
            });
            // Return true to indicate async response
            return true;
        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }
    // Return false for synchronous responses
    return false;
});
/**
 * Handle page navigation and dynamic content changes
 */
function setupNavigationHandler() {
    // Listen for URL changes (for SPA navigation)
    let currentUrl = window.location.href;
    setInterval(() => {
        if (window.location.href !== currentUrl) {
            currentUrl = window.location.href;
            console.log('supergrader: URL changed, checking if reinitialization needed');
            // Reset state and check if we should reinitialize
            appState.isInitialized = false;
            setTimeout(() => {
                initializeExtension().catch(console.error);
            }, 1000); // Give page time to settle
        }
    }, 1000);
}
// Enhanced initialization sequence
console.log('supergrader: Starting enhanced content script initialization...');
// Set up navigation handler first
setupNavigationHandler();
// Initial load - wait for basic DOM then start initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            initializeExtension().catch(console.error);
        }, 500); // Small delay for React apps
    });
}
else {
    // DOM already loaded
    setTimeout(() => {
        initializeExtension().catch(console.error);
    }, 500);
}
console.log('supergrader: Enhanced content script setup completed');
//# sourceMappingURL=content.js.map