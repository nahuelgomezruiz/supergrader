"use strict";
// Background service worker for supergrader
// Handles extension lifecycle, storage, and cross-tab communication
console.log('supergrader: Background service worker loaded');
/**
 * Extension installation handler
 */
chrome.runtime.onInstalled.addListener((details) => {
    console.log('supergrader: Extension installed/updated', details.reason);
    // Set default settings
    const defaultSettings = {
        confidenceThreshold: 0.8,
        autoApplyHighConfidence: false,
        backendUrl: 'http://localhost:3000',
        enabledForAssignment: true
    };
    chrome.storage.sync.set(defaultSettings, () => {
        console.log('supergrader: Default settings saved');
    });
});
/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('Background: Received message', request);
    switch (request.action) {
        case 'getSettings':
            handleGetSettings(sendResponse);
            return true; // Keep channel open for async response
        case 'updateSettings':
            if (request.settings) {
                handleUpdateSettings(request.settings, sendResponse);
            }
            else {
                sendResponse({ success: false, error: 'Settings required for updateSettings action' });
            }
            return true;
        case 'logEvent':
            handleLogEvent(request.event || 'unknown', request.data);
            sendResponse({ success: true });
            return false;
        default:
            console.warn('Background: Unknown message action', request.action);
            sendResponse({ success: false, error: 'Unknown action' });
            return false;
    }
});
/**
 * Get extension settings from storage
 */
function handleGetSettings(sendResponse) {
    const settingKeys = [
        'confidenceThreshold',
        'autoApplyHighConfidence',
        'backendUrl',
        'enabledForAssignment'
    ];
    chrome.storage.sync.get(settingKeys, (items) => {
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
        }
        else {
            sendResponse({ success: true });
        }
    });
}
/**
 * Log events for analytics and debugging
 */
function handleLogEvent(event, data) {
    const logEntry = {
        event,
        data,
        timestamp: Date.now(),
        tabId: data?.tabId,
        url: data?.url
    };
    console.log('Background: Event logged', logEntry);
    // TODO: Implement proper event logging/analytics
    // For now, just log to console
    // Could also store in local storage for debugging
    if (chrome.storage.local) {
        chrome.storage.local.get(['eventLogs'], (result) => {
            const logs = result.eventLogs || [];
            logs.push(logEntry);
            // Keep only last 100 events
            const trimmedLogs = logs.slice(-100);
            chrome.storage.local.set({ eventLogs: trimmedLogs });
        });
    }
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
        // Log the navigation event
        handleLogEvent('gradescope_page_detected', {
            tabId,
            url: tab.url,
            title: tab.title
        });
        // TODO: Could send notification to content script here if needed
        // chrome.tabs.sendMessage(tabId, { action: 'pageDetected' });
    }
});
/**
 * Handle extension startup
 */
chrome.runtime.onStartup.addListener(() => {
    console.log('supergrader: Extension started');
    handleLogEvent('extension_startup');
});
/**
 * Handle when extension is suspended (Chrome puts it to sleep)
 */
chrome.runtime.onSuspend.addListener(() => {
    console.log('supergrader: Extension suspending');
    handleLogEvent('extension_suspend');
});
/**
 * Error handler for unhandled promise rejections
 */
self.addEventListener('unhandledrejection', (event) => {
    console.error('Background: Unhandled promise rejection', event.reason);
    handleLogEvent('unhandled_promise_rejection', {
        reason: event.reason?.message || event.reason,
        stack: event.reason?.stack
    });
});
/**
 * Error handler for uncaught exceptions
 */
self.addEventListener('error', (event) => {
    console.error('Background: Uncaught error', event.error);
    handleLogEvent('uncaught_error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
    });
});
//# sourceMappingURL=background.js.map