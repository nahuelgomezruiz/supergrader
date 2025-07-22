"use strict";
// Popup script for supergrader
console.log('supergrader: Popup loaded');
// DOM elements with proper types
let statusDiv;
let autoApplyToggle;
let thresholdInput;
let enabledToggle;
let settingsBtn;
let helpBtn;
/**
 * Initialize popup when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Popup: DOM loaded, initializing...');
    // Get DOM elements with proper type checking
    statusDiv = document.getElementById('status');
    autoApplyToggle = document.getElementById('autoApplyToggle');
    thresholdInput = document.getElementById('thresholdInput');
    enabledToggle = document.getElementById('enabledToggle');
    settingsBtn = document.getElementById('settingsBtn');
    helpBtn = document.getElementById('helpBtn');
    // Validate required elements exist
    if (!statusDiv || !autoApplyToggle || !thresholdInput || !enabledToggle) {
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
        const settingKeys = [
            'autoApplyHighConfidence',
            'confidenceThreshold',
            'enabledForAssignment'
        ];
        const result = await chrome.storage.sync.get(settingKeys);
        console.log('Popup: Raw storage result', result);
        // Update UI with loaded settings with proper type checking
        if (autoApplyToggle && result.autoApplyHighConfidence === true) {
            autoApplyToggle.classList.add('active');
        }
        if (thresholdInput && typeof result.confidenceThreshold === 'number') {
            thresholdInput.value = result.confidenceThreshold.toString();
        }
        else if (thresholdInput) {
            // Set default value if not found
            thresholdInput.value = '0.8';
        }
        if (enabledToggle && result.enabledForAssignment !== false) {
            enabledToggle.classList.add('active');
        }
        console.log('Popup: Settings loaded and UI updated', result);
    }
    catch (error) {
        console.error('Popup: Error loading settings', error);
    }
}
/**
 * Save settings to storage
 */
async function saveSettings() {
    if (!autoApplyToggle || !thresholdInput || !enabledToggle) {
        console.error('Popup: Cannot save settings - UI elements not available');
        return;
    }
    try {
        const settings = {
            autoApplyHighConfidence: autoApplyToggle.classList.contains('active'),
            confidenceThreshold: parseFloat(thresholdInput.value),
            enabledForAssignment: enabledToggle.classList.contains('active')
        };
        // Validate settings
        if (isNaN(settings.confidenceThreshold) || settings.confidenceThreshold < 0 || settings.confidenceThreshold > 1) {
            console.warn('Popup: Invalid confidence threshold, setting to 0.8');
            settings.confidenceThreshold = 0.8;
            thresholdInput.value = '0.8';
        }
        await chrome.storage.sync.set(settings);
        console.log('Popup: Settings saved', settings);
        // Notify content script of setting changes
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'settingsUpdated',
                    settings: settings
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
    // Toggle switches with null checks
    if (autoApplyToggle) {
        autoApplyToggle.addEventListener('click', () => {
            autoApplyToggle?.classList.toggle('active');
            saveSettings().catch(error => {
                console.error('Popup: Error saving settings from auto-apply toggle', error);
            });
        });
    }
    if (enabledToggle) {
        enabledToggle.addEventListener('click', () => {
            enabledToggle?.classList.toggle('active');
            saveSettings().catch(error => {
                console.error('Popup: Error saving settings from enabled toggle', error);
            });
        });
    }
    // Threshold input with validation
    if (thresholdInput) {
        thresholdInput.addEventListener('change', () => {
            if (!thresholdInput)
                return;
            let value = parseFloat(thresholdInput.value);
            // Validate range
            if (isNaN(value) || value < 0) {
                value = 0;
            }
            if (value > 1) {
                value = 1;
            }
            thresholdInput.value = value.toString();
            saveSettings().catch(error => {
                console.error('Popup: Error saving settings from threshold input', error);
            });
        });
        // Real-time validation as user types
        thresholdInput.addEventListener('input', () => {
            if (!thresholdInput)
                return;
            const value = parseFloat(thresholdInput.value);
            // Visual feedback for invalid values
            if (isNaN(value) || value < 0 || value > 1) {
                thresholdInput.style.borderColor = '#ff6b6b';
                thresholdInput.title = 'Value must be between 0 and 1';
            }
            else {
                thresholdInput.style.borderColor = '';
                thresholdInput.title = '';
            }
        });
    }
    // Action buttons
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            console.log('Popup: Settings button clicked');
            // TODO: Open settings page or expand settings
            // For now, just log the current settings
            chrome.storage.sync.get(null, (items) => {
                console.log('Popup: Current settings:', items);
            });
        });
    }
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            console.log('Popup: Help button clicked');
            // Open help/documentation
            chrome.tabs.create({
                url: 'https://github.com/your-repo/supergrader/wiki'
            }).catch(error => {
                console.error('Popup: Error opening help page', error);
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