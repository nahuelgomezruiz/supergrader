// Main orchestrator for supergrader
// This script detects when user is on grading page and manages the overall workflow

console.log('supergrader: Content script loaded');

// Configuration
const CONFIG = {
  BACKEND_URL: 'http://localhost:3000', // Will be configurable later
  CONFIDENCE_THRESHOLD: 0.8
};

// Main application state
let appState = {
  courseId: null,
  assignmentId: null,
  submissionId: null,
  isInitialized: false
};

/**
 * Initialize the extension on Gradescope grading pages
 */
function initializeExtension() {
  console.log('supergrader: Initializing...');
  
  // Extract IDs from URL - support both assignments and questions URLs
  const urlMatch = window.location.pathname.match(
    /\/courses\/(\d+)\/(?:assignments|questions)\/(\d+)\/submissions\/(\d+)\/grade/
  );
  
  if (urlMatch) {
    appState.courseId = urlMatch[1];
    appState.assignmentId = urlMatch[2];
    appState.submissionId = urlMatch[3];
    appState.isInitialized = true;
    
    console.log('supergrader: Detected grading page', {
      courseId: appState.courseId,
      assignmentId: appState.assignmentId,
      submissionId: appState.submissionId
    });
    
    // Initialize UI after page is fully loaded
    setTimeout(() => {
      initializeUI();
    }, 1000);
  } else {
    console.log('supergrader: Not on a grading page');
  }
}

/**
 * Initialize the user interface
 */
function initializeUI() {
  console.log('supergrader: Initializing UI...');
  // UI initialization will be handled by ui-controller.js
  if (typeof window.UIController !== 'undefined') {
    window.UIController.initialize(appState);
  }
}

/**
 * Main entry point
 */
function main() {
  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
  } else {
    initializeExtension();
  }
}

// Start the extension
main();

// Export for use by other scripts
window.AppState = appState;
window.CONFIG = CONFIG; 