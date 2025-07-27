"use strict";
// Simplified popup script for supergrader
console.log('supergrader: Popup loaded');
// DOM elements with proper types
let statusDiv;
let enabledToggle;
let toggleText;
/**
 * Initialize popup when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Popup: DOM loaded, initializing...');
    // Get DOM elements with proper type checking
    statusDiv = document.getElementById('status');
    enabledToggle = document.getElementById('enabledToggle');
    toggleText = document.getElementById('toggleText');
    // Validate required elements exist
    if (!statusDiv || !enabledToggle || !toggleText) {
        console.error('Popup: Required DOM elements not found');
        return;
    }
    // Initialize popup
    initializePopup().catch(error => {
        console.error('Popup: Initialization failed', error);
    });
});
/**
 * Initialize popup functionality
 */
async function initializePopup() {
    try {
        // Check current tab
        await checkCurrentTab();
        // Load settings
        await loadSettings();
        // Setup event listeners
        setupEventListeners();
        console.log('Popup: Initialization completed successfully');
    }
    catch (error) {
        console.error('Popup: Error during initialization', error);
        if (statusDiv) {
            statusDiv.textContent = 'Initialization failed';
            statusDiv.className = 'status error';
        }
    }
}
/**
 * Check if current tab is a Gradescope grading page
 */
async function checkCurrentTab() {
    if (!statusDiv)
        return;
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url) {
            const isGradingPage = tab.url.includes('gradescope.com') &&
                tab.url.includes('/grade') &&
                (tab.url.match(/\/courses\/\d+\/assignments\/\d+\/submissions\/\d+\/grade/) ||
                    tab.url.match(/\/courses\/\d+\/questions\/\d+\/submissions\/\d+\/grade/));
            if (isGradingPage) {
                statusDiv.textContent = 'Ready to assist with grading';
                statusDiv.className = 'status ready';
                console.log('Popup: On grading page', tab.url);
            }
            else if (tab.url.includes('gradescope.com')) {
                statusDiv.textContent = 'Navigate to a grading page to use supergrader';
                statusDiv.className = 'status not-ready';
                console.log('Popup: On Gradescope but not grading page', tab.url);
            }
            else {
                statusDiv.textContent = 'Not on a Gradescope page';
                statusDiv.className = 'status not-ready';
                console.log('Popup: Not on Gradescope', tab.url);
            }
        }
        else {
            statusDiv.textContent = 'Unable to access current tab';
            statusDiv.className = 'status error';
        }
    }
    catch (error) {
        console.error('Popup: Error checking current tab', error);
        statusDiv.textContent = 'Error checking page status';
        statusDiv.className = 'status error';
    }
}
/**
 * Load settings from storage
 */
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['enabledForAssignment']);
        console.log('Popup: Raw storage result', result);
        // Update UI with loaded settings
        const isEnabled = result.enabledForAssignment !== false; // Default to enabled
        if (enabledToggle && toggleText) {
            if (isEnabled) {
                enabledToggle.classList.add('active');
                toggleText.textContent = 'Enabled';
            }
            else {
                enabledToggle.classList.remove('active');
                toggleText.textContent = 'Disabled';
            }
        }
        console.log('Popup: Settings loaded and UI updated', { enabledForAssignment: isEnabled });
    }
    catch (error) {
        console.error('Popup: Error loading settings', error);
    }
}
/**
 * Save settings to storage
 */
async function saveSettings() {
    if (!enabledToggle || !toggleText) {
        console.error('Popup: Cannot save settings - UI elements not available');
        return;
    }
    try {
        const isEnabled = enabledToggle.classList.contains('active');
        // Only update the enabledForAssignment property, preserve others
        await chrome.storage.sync.set({ enabledForAssignment: isEnabled });
        console.log('Popup: Settings saved', { enabledForAssignment: isEnabled });
        // Update toggle text
        toggleText.textContent = isEnabled ? 'Enabled' : 'Disabled';
        // Notify content script of setting changes
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'settingsUpdated',
                    settings: { enabledForAssignment: isEnabled }
                });
                console.log('Popup: Notified content script of settings update');
            }
        }
        catch (error) {
            // Content script might not be loaded, that's ok
            console.log('Popup: Could not notify content script (probably not on grading page)');
        }
    }
    catch (error) {
        console.error('Popup: Error saving settings', error);
    }
}
/**
 * Setup event listeners for UI interactions
 */
function setupEventListeners() {
    // Extension enable/disable toggle
    if (enabledToggle) {
        enabledToggle.addEventListener('click', () => {
            enabledToggle?.classList.toggle('active');
            saveSettings().catch(error => {
                console.error('Popup: Error saving settings from enabled toggle', error);
            });
        });
    }
}
/**
 * Utility function to update status display
 */
function updateStatus(message, type = 'not-ready') {
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        console.log(`Popup: Status updated - ${type}: ${message}`);
    }
}
/**
 * Handle messages from background or content scripts
 */
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('Popup: Received message', request);
    switch (request.action) {
        case 'updateStatus':
            if (request.status) {
                updateStatus(request.status, request.type);
            }
            sendResponse({ success: true });
            break;
        case 'settingsChanged':
            // Reload settings when they change
            loadSettings().catch(error => {
                console.error('Popup: Error reloading settings', error);
            });
            sendResponse({ success: true });
            break;
        default:
            console.warn('Popup: Unknown message action', request.action);
            sendResponse({ success: false, error: 'Unknown action' });
    }
});
/**
 * Handle storage changes to keep UI in sync
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        console.log('Popup: Storage changed, reloading settings', changes);
        loadSettings().catch(error => {
            console.error('Popup: Error reloading settings after storage change', error);
        });
    }
});
/**
 * Handle popup visibility changes
 */
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        console.log('Popup: Became visible, refreshing status');
        // Refresh tab status when popup becomes visible
        checkCurrentTab().catch(error => {
            console.error('Popup: Error refreshing tab status', error);
        });
    }
});
console.log('Popup: Script loaded successfully');
//# sourceMappingURL=popup.js.map