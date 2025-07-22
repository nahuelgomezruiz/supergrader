// Main orchestrator for supergrader
// This script detects when user is on grading page and manages the overall workflow

console.log('supergrader: Content script loaded');

// Configuration
const CONFIG = {
  BACKEND_URL: 'http://localhost:3000', // Will be configurable later
  CONFIDENCE_THRESHOLD: 0.8,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000 // 1 second
};

// Main application state
let appState = {
  courseId: null,
  assignmentId: null,
  submissionId: null,
  assignmentType: null, // 'assignments' or 'questions'
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
  const urlMatch = window.location.pathname.match(
    /\/courses\/(\d+)\/(assignments|questions)\/(\d+)\/submissions\/(\d+)\/grade/
  );
  
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
    
    appState.courseId = courseId;
    appState.assignmentId = assignmentId;
    appState.submissionId = submissionId;
    appState.assignmentType = assignmentType;
    
    console.log('supergrader: Page info extracted successfully', {
      courseId: appState.courseId,
      assignmentId: appState.assignmentId,
      submissionId: appState.submissionId,
      assignmentType: appState.assignmentType
    });
    
    return true;
  } else {
    console.log('supergrader: URL does not match grading page pattern');
    return false;
  }
}

/**
 * Enhanced DOM injection point detection
 */
function findInjectionPoint() {
  console.log('supergrader: Searching for DOM injection point...');
  
  // Priority order of injection points based on actual Gradescope DOM
  const injectionSelectors = [
    '.submissionFiles',            // File sidebar (known from docs)
    '.rubric-item[data-rubric-item-id]', // Rubric items area
    'main',                        // HTML5 main element
    '[role="main"]',              // Semantic main content
    '.main-content',               // Generic main content
    '#content',                    // Content div
    '.container',                  // Bootstrap container
    'body'                         // Ultimate fallback
  ];
  
  for (const selector of injectionSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      console.log(`supergrader: Found injection point: ${selector}`);
      return element;
    }
  }
  
  console.warn('supergrader: No suitable injection point found, using body');
  return document.body;
}

/**
 * Check if page is fully loaded and ready for injection
 */
function isPageReady() {
  // Check if essential Gradescope elements are loaded based on actual DOM structure
  const essentialSelectors = [
    'body',                           // Basic page structure
    '.submissionFiles',              // File sidebar (from docs)
    '.rubric-item[data-rubric-item-id]', // Rubric items (from docs)
    'main'                           // Main content area
  ];
  
  // At least body and one other element should be present
  if (!document.querySelector('body')) {
    console.log('supergrader: Page not ready - missing body');
    return false;
  }
  
  // Check for at least one Gradescope-specific element
  const gradescopeSelectors = essentialSelectors.slice(1);
  const foundElements = gradescopeSelectors.filter(selector => document.querySelector(selector));
  
  if (foundElements.length === 0) {
    console.log('supergrader: Page not ready - no Gradescope elements found');
    console.log('supergrader: Checked selectors:', gradescopeSelectors);
    console.log('supergrader: Available elements:', Array.from(document.querySelectorAll('*')).slice(0, 10).map(el => el.tagName + (el.className ? '.' + el.className.split(' ')[0] : '')));
    return false;
  }
  
  appState.domReady = true;
  console.log('supergrader: Page ready for injection, found:', foundElements);
  return true;
}

/**
 * Initialize the extension with enhanced error handling and retries
 */
function initializeExtension() {
  console.log('supergrader: Initializing...', { attempt: appState.retryCount + 1 });
  
  try {
    // Step 1: Extract and validate page information
    if (!extractPageInfo()) {
      console.log('supergrader: Not on a valid grading page');
      return;
    }
    
    // Step 2: Check if page is ready
    if (!isPageReady()) {
      if (appState.retryCount < CONFIG.MAX_RETRIES) {
        appState.retryCount++;
        console.log(`supergrader: Page not ready, retrying in ${CONFIG.RETRY_DELAY}ms... (attempt ${appState.retryCount})`);
        setTimeout(initializeExtension, CONFIG.RETRY_DELAY);
        return;
      } else {
        console.warn('supergrader: Max retries reached, proceeding anyway');
      }
    }
    
    // Step 3: Initialize authentication
    initializeAuthentication();
    
    // Step 4: Initialize UI after short delay to ensure DOM is stable
    setTimeout(() => {
      initializeUI();
    }, 500);
    
    appState.isInitialized = true;
    console.log('supergrader: Initialization complete');
    
  } catch (error) {
    console.error('supergrader: Initialization failed', error);
    
    // Retry logic for failed initialization
    if (appState.retryCount < CONFIG.MAX_RETRIES) {
      appState.retryCount++;
      console.log(`supergrader: Retrying initialization... (attempt ${appState.retryCount})`);
      setTimeout(initializeExtension, CONFIG.RETRY_DELAY * appState.retryCount);
    } else {
      console.error('supergrader: Failed to initialize after maximum retries');
      // Could show user notification here
    }
  }
}

/**
 * Initialize authentication with enhanced error handling
 */
function initializeAuthentication() {
  console.log('supergrader: Initializing authentication...');
  
  try {
    if (typeof window.GradescopeAPI !== 'undefined') {
      window.GradescopeAPI.initialize()
        .then(success => {
          if (success) {
            console.log('supergrader: Authentication initialized successfully');
          } else {
            console.warn('supergrader: Authentication initialization failed');
          }
        })
        .catch(error => {
          console.error('supergrader: Authentication error:', error);
        });
    } else {
      console.warn('supergrader: GradescopeAPI not available');
    }
  } catch (error) {
    console.error('supergrader: Authentication initialization error:', error);
  }
}

/**
 * Initialize the user interface with enhanced error handling
 */
function initializeUI() {
  console.log('supergrader: Initializing UI...');
  
  try {
    if (typeof window.UIController !== 'undefined') {
      // Find the best injection point
      const injectionPoint = findInjectionPoint();
      
      // Pass enhanced state and injection point to UI controller
      window.UIController.initialize({
        ...appState,
        injectionPoint: injectionPoint,
        pageUrl: window.location.href
      });
      
      console.log('supergrader: UI initialization complete');
    } else {
      console.error('supergrader: UIController not available');
    }
  } catch (error) {
    console.error('supergrader: UI initialization failed:', error);
  }
}

/**
 * Handle page navigation and dynamic content changes
 */
function handlePageChanges() {
  console.log('supergrader: Setting up page change detection...');
  
  // Listen for URL changes (for single-page app behavior)
  let lastUrl = location.href;
  let changeCount = 0;
  
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('supergrader: URL changed, reinitializing...');
      appState.isInitialized = false;
      appState.retryCount = 0;
      setTimeout(initializeExtension, 500);
    }
    
    // Throttle excessive change detection
    changeCount++;
    if (changeCount > 100) {
      console.log('supergrader: Too many DOM changes, throttling...');
      changeCount = 0;
    }
  }).observe(document, { 
    subtree: true, 
    childList: true,
    // Less aggressive observation to reduce noise
    attributes: false,
    characterData: false
  });
}

/**
 * Enhanced main entry point
 */
function main() {
  console.log('supergrader: Starting enhanced content script...');
  
  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('supergrader: DOM content loaded');
      setTimeout(initializeExtension, 100);
    });
  } else if (document.readyState === 'interactive' || document.readyState === 'complete') {
    console.log('supergrader: DOM already ready');
    setTimeout(initializeExtension, 100);
  }
  
  // Set up page change detection
  handlePageChanges();
  
  // Additional safety net - try initialization after a delay regardless
  setTimeout(() => {
    if (!appState.isInitialized) {
      console.log('supergrader: Safety net initialization attempt');
      initializeExtension();
    }
  }, 2000);
}

// Start the extension
main();

// Export enhanced state for other scripts
window.AppState = appState;
window.CONFIG = CONFIG; 