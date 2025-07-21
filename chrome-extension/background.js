// Background service worker for supergrader
// Handles extension lifecycle, storage, and cross-tab communication

console.log('supergrader: Background service worker loaded');

/**
 * Extension installation handler
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('supergrader: Extension installed/updated', details.reason);
  
  // Set default settings
  chrome.storage.sync.set({
    confidenceThreshold: 0.8,
    autoApplyHighConfidence: false,
    backendUrl: 'http://localhost:3000',
    enabledForAssignment: true
  }, () => {
    console.log('supergrader: Default settings saved');
  });
});

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background: Received message', request);
  
  switch (request.action) {
    case 'getSettings':
      handleGetSettings(sendResponse);
      return true; // Keep channel open for async response
      
    case 'updateSettings':
      handleUpdateSettings(request.settings, sendResponse);
      return true;
      
    case 'logEvent':
      handleLogEvent(request.event, request.data);
      sendResponse({ success: true });
      return false;
      
    default:
      console.warn('Background: Unknown message action', request.action);
      sendResponse({ error: 'Unknown action' });
      return false;
  }
});

/**
 * Get extension settings from storage
 */
function handleGetSettings(sendResponse) {
  chrome.storage.sync.get([
    'confidenceThreshold',
    'autoApplyHighConfidence',
    'backendUrl',
    'enabledForAssignment'
  ], (items) => {
    sendResponse({
      success: true,
      settings: items
    });
  });
}

/**
 * Update extension settings in storage
 */
function handleUpdateSettings(settings, sendResponse) {
  chrome.storage.sync.set(settings, () => {
    if (chrome.runtime.lastError) {
      sendResponse({
        success: false,
        error: chrome.runtime.lastError.message
      });
    } else {
      sendResponse({ success: true });
    }
  });
}

/**
 * Log events for analytics and debugging
 */
function handleLogEvent(event, data) {
  console.log('Background: Event logged', { event, data, timestamp: Date.now() });
  
  // TODO: Implement proper event logging/analytics
  // For now, just log to console
}

/**
 * Handle tab updates to detect navigation to Gradescope
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && 
      tab.url && 
      tab.url.includes('gradescope.com') && 
      tab.url.includes('/grade')) {
    
    console.log('Background: Gradescope grading page detected', tab.url);
    
    // TODO: Could send notification to content script here if needed
  }
}); 