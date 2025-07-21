// Popup script for supergrader

console.log('supergrader: Popup loaded');

// DOM elements
let statusDiv, autoApplyToggle, thresholdInput, enabledToggle;
let settingsBtn, helpBtn;

/**
 * Initialize popup when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup: DOM loaded, initializing...');
  
  // Get DOM elements
  statusDiv = document.getElementById('status');
  autoApplyToggle = document.getElementById('autoApplyToggle');
  thresholdInput = document.getElementById('thresholdInput');
  enabledToggle = document.getElementById('enabledToggle');
  settingsBtn = document.getElementById('settingsBtn');
  helpBtn = document.getElementById('helpBtn');

  // Initialize popup
  initializePopup();
});

/**
 * Initialize popup functionality
 */
async function initializePopup() {
  // Check current tab
  await checkCurrentTab();
  
  // Load settings
  await loadSettings();
  
  // Setup event listeners
  setupEventListeners();
}

/**
 * Check if current tab is a Gradescope grading page
 */
async function checkCurrentTab() {
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
      } else if (tab.url.includes('gradescope.com')) {
        statusDiv.textContent = 'Navigate to a grading page to use supergrader';
        statusDiv.className = 'status not-ready';
      } else {
        statusDiv.textContent = 'Not on a Gradescope page';
        statusDiv.className = 'status not-ready';
      }
    }
  } catch (error) {
    console.error('Popup: Error checking current tab', error);
    statusDiv.textContent = 'Error checking page status';
    statusDiv.className = 'status not-ready';
  }
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get([
      'autoApplyHighConfidence',
      'confidenceThreshold',
      'enabledForAssignment'
    ]);

    // Update UI with loaded settings
    if (result.autoApplyHighConfidence) {
      autoApplyToggle.classList.add('active');
    }

    if (result.confidenceThreshold !== undefined) {
      thresholdInput.value = result.confidenceThreshold;
    }

    if (result.enabledForAssignment !== false) {
      enabledToggle.classList.add('active');
    }

    console.log('Popup: Settings loaded', result);
  } catch (error) {
    console.error('Popup: Error loading settings', error);
  }
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  try {
    const settings = {
      autoApplyHighConfidence: autoApplyToggle.classList.contains('active'),
      confidenceThreshold: parseFloat(thresholdInput.value),
      enabledForAssignment: enabledToggle.classList.contains('active')
    };

    await chrome.storage.sync.set(settings);
    console.log('Popup: Settings saved', settings);

    // Notify content script of setting changes
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'settingsUpdated',
          settings: settings
        });
      }
    } catch (error) {
      // Content script might not be loaded, that's ok
      console.log('Popup: Could not notify content script (probably not on grading page)');
    }
  } catch (error) {
    console.error('Popup: Error saving settings', error);
  }
}

/**
 * Setup event listeners for UI interactions
 */
function setupEventListeners() {
  // Toggle switches
  autoApplyToggle.addEventListener('click', () => {
    autoApplyToggle.classList.toggle('active');
    saveSettings();
  });

  enabledToggle.addEventListener('click', () => {
    enabledToggle.classList.toggle('active');
    saveSettings();
  });

  // Threshold input
  thresholdInput.addEventListener('change', () => {
    let value = parseFloat(thresholdInput.value);
    
    // Validate range
    if (value < 0) value = 0;
    if (value > 1) value = 1;
    
    thresholdInput.value = value;
    saveSettings();
  });

  // Action buttons
  settingsBtn.addEventListener('click', () => {
    // TODO: Open settings page or expand settings
    console.log('Popup: Settings button clicked');
  });

  helpBtn.addEventListener('click', () => {
    // Open help/documentation
    chrome.tabs.create({
      url: 'https://github.com/your-repo/supergrader/wiki'
    });
  });
}

/**
 * Handle messages from background or content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Popup: Received message', request);
  
  switch (request.action) {
    case 'updateStatus':
      if (request.status && statusDiv) {
        statusDiv.textContent = request.status;
        statusDiv.className = `status ${request.type || 'not-ready'}`;
      }
      break;
      
    default:
      console.warn('Popup: Unknown message action', request.action);
  }
}); 