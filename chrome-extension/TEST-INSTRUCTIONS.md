# supergrader Authentication Testing Guide

## 🔧 Testing the Enhanced Authentication System

### Step 1: Extension Reload
1. Go to `chrome://extensions/`
2. Find "supergrader" and click the 🔄 Reload button
3. Verify no error badge appears

### Step 2: Navigate to Gradescope
1. Go to any Gradescope grading page
2. URL pattern: `/courses/*/questions/*/submissions/*/grade`
3. Wait for page to fully load

### Step 3: Check UI Status
Look for the **supergrader panel** on the page:
- **Panel Header**: Should show question/submission IDs
- **Status Indicator**: Look for connection status
- **Debug Panel**: May appear if there are auth issues

### Step 4: Open Browser Console
Press `F12` → **Console tab** and look for these logs:

#### ✅ **Expected SUCCESS Logs:**
```
supergrader: Content script loaded
supergrader: Starting enhanced content script...
GradescopeAPI: Starting enhanced authentication...
GradescopeAPI: CSRF token extracted and validated
GradescopeAPI: Validating session...
GradescopeAPI: User appears to be logged in (found UI indicators)
GradescopeAPI: Authentication test passed
GradescopeAPI: Enhanced authentication successful
supergrader: Auth status updated in DOM for console access
UIController: Authentication status - connected
```

### Step 5: Check Authentication Details (CSP-Safe Method)
In console, run this command to get auth status from DOM:
```javascript
// Get auth status from DOM (CSP-safe method)
(() => {
  const authElement = document.getElementById('supergrader-auth-status');
  if (authElement) {
    const authStatus = JSON.parse(authElement.content);
    const updated = new Date(parseInt(authElement.getAttribute('data-updated')));
    
    console.log('=== Supergrader Auth Status ===');
    console.log('Status:', authStatus);
    console.log('Last Updated:', updated.toLocaleString());
    return authStatus;
  } else {
    console.log('Auth status not available - extension may not be loaded');
    return null;
  }
})();
```

#### **Expected Output (Success):**
```javascript
=== Supergrader Auth Status ===
Status: {
  isAuthenticated: true,
  csrfTokenValid: true,
  sessionValid: true,
  lastValidated: 1703123456789,
  retryCount: 0,
  maxRetries: 3,
  csrfToken: "abc123def4...",
  rateLimiter: {
    currentRequests: 0,
    recentRequests: 1
  }
}
Last Updated: 12/21/2024, 3:45:56 PM
```

### Step 6: Quick Auth Status Check
For a simple check, just run:
```javascript
// Quick auth check
JSON.parse(document.getElementById('supergrader-auth-status')?.content || '{"error": "not found"}');
```

### Step 7: Test UI Interactions
1. **Click "Start AI Grading"** → Should show progress simulation
2. **Check "Preview mode"** → Should update button behavior
3. **If debug panel appears** → Click "Retry Authentication"

## 🐛 Troubleshooting

### If Panel Doesn't Appear:
1. Check console for "Page not ready" messages
2. Verify URL matches pattern: `/questions/` or `/assignments/`
3. Wait 5-10 seconds and refresh page

### If Authentication Fails:
1. Look for red "Auth Failed" status
2. Check if debug panel appears with details
3. Click "Retry Authentication" button
4. If still failing, refresh the entire page

### Common Issues:
- **No CSRF Token**: Gradescope page may not be fully loaded
- **No Session Cookie**: May need to log out/in to Gradescope
- **API Test Failed**: Network issues or Gradescope maintenance
- **CSP Errors**: Normal - extension uses DOM-based communication to avoid CSP issues

## 🎯 Success Criteria
- ✅ Panel appears with correct IDs
- ✅ Green "Authenticated" status
- ✅ Console shows "Auth status updated in DOM"
- ✅ "Start AI Grading" button works
- ✅ No debug panel (means everything is working)

## 🔍 Debug Commands (CSP-Safe)
Run these in console for detailed information:

### Complete Auth Status Check:
```javascript
// Comprehensive auth status check
(() => {
  console.log('=== Supergrader Debug Info ===');
  
  // Check if auth status is in DOM
  const authElement = document.getElementById('supergrader-auth-status');
  console.log('Auth element exists:', !!authElement);
  
  if (authElement) {
    try {
      const status = JSON.parse(authElement.content);
      const updated = new Date(parseInt(authElement.getAttribute('data-updated')));
      
      console.log('✅ Authentication Status:', status.isAuthenticated);
      console.log('✅ CSRF Valid:', status.csrfTokenValid);
      console.log('✅ Session Valid:', status.sessionValid);
      console.log('📊 Rate Limiter:', status.rateLimiter);
      console.log('🕐 Last Updated:', updated.toLocaleString());
      
      if (!status.isAuthenticated) {
        console.warn('⚠️ Not authenticated - retry count:', status.retryCount);
      }
      
      return status;
    } catch (e) {
      console.error('❌ Failed to parse auth status:', e);
    }
  } else {
    console.log('❌ Extension not loaded or auth not initialized');
  }
})();
```

### Check Panel Status:
```javascript
// Check if supergrader panel exists
document.querySelector('.ai-grading-panel') ? 
  console.log('✅ Panel loaded') : 
  console.log('❌ Panel not found');
```

### Check Extension Files:
```javascript
// Verify extension files are loaded
console.log('Content script logs:', performance.getEntriesByName('resource').filter(r => r.name.includes('supergrader')));
``` 