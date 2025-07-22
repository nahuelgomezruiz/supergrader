// Gradescope API integration module
// Handles authentication, data extraction, and grading actions

console.log('supergrader: Gradescope API module loaded');

/**
 * Enhanced Gradescope API wrapper class with robust authentication
 */
class GradescopeAPI {
  constructor() {
    this.csrfToken = null;
    this.sessionCookie = null;
    this.rateLimitQueue = [];
    this.requestCount = 0;
    this.requestWindow = 60000; // 1 minute window
    
    // Authentication state
    this.authState = {
      isAuthenticated: false,
      csrfTokenValid: false,
      sessionValid: false,
      lastValidated: null,
      retryCount: 0,
      maxRetries: 3
    };
    
    // Rate limiting
    this.rateLimiter = {
      requests: [],
      maxPerMinute: 100,
      maxConcurrent: 10,
      currentRequests: 0
    };
  }

  /**
   * Enhanced authentication initialization with validation and testing
   */
  async initialize() {
    console.log('GradescopeAPI: Starting enhanced authentication...');
    
    try {
      // Step 1: Extract and validate CSRF token
      const csrfSuccess = await this.extractAndValidateCSRF();
      if (!csrfSuccess) {
        return this.handleAuthFailure('CSRF token extraction failed');
      }

      // Step 2: Validate session state
      const sessionSuccess = await this.validateSession();
      if (!sessionSuccess) {
        console.warn('GradescopeAPI: Session validation failed, but may still work');
      }

      // Step 3: Test authentication with a safe API call
      const authTest = await this.testAuthentication();
      if (!authTest) {
        return this.handleAuthFailure('Authentication test failed');
      }

      // Step 4: Mark as authenticated
      this.authState.isAuthenticated = true;
      this.authState.lastValidated = Date.now();
      
      console.log('GradescopeAPI: Enhanced authentication successful', {
        csrfToken: this.csrfToken ? 'present' : 'missing',
        sessionValid: this.authState.sessionValid,
        timestamp: new Date().toISOString()
      });

      return true;

    } catch (error) {
      console.error('GradescopeAPI: Authentication initialization error:', error);
      return this.handleAuthFailure(`Initialization error: ${error.message}`);
    }
  }

  /**
   * Extract and validate CSRF token
   */
  async extractAndValidateCSRF() {
    console.log('GradescopeAPI: Extracting CSRF token...');

    // Primary method: meta tag
    let csrfMeta = document.querySelector('meta[name="csrf-token"]');
    
    // Fallback methods for different CSRF token locations
    if (!csrfMeta) {
      csrfMeta = document.querySelector('meta[name="csrf_token"]') || 
                 document.querySelector('input[name="authenticity_token"]') ||
                 document.querySelector('input[name="_token"]');
    }

    if (csrfMeta) {
      this.csrfToken = csrfMeta.getAttribute('content') || csrfMeta.value;
      
      if (this.csrfToken && this.csrfToken.length > 10) {
        this.authState.csrfTokenValid = true;
        console.log('GradescopeAPI: CSRF token extracted and validated');
        return true;
      } else {
        console.error('GradescopeAPI: CSRF token found but appears invalid:', this.csrfToken?.substring(0, 10) + '...');
        return false;
      }
    } else {
      console.error('GradescopeAPI: No CSRF token meta tag found in DOM');
      console.log('GradescopeAPI: Available meta tags:', Array.from(document.querySelectorAll('meta')).map(m => m.name || m.property).filter(Boolean));
      return false;
    }
  }

  /**
   * Validate session cookies and authentication state
   */
  async validateSession() {
    console.log('GradescopeAPI: Validating session...');

    const cookies = document.cookie;
    const cookieNames = cookies.split(';').map(c => c.trim().split('=')[0]);
    
    console.log('GradescopeAPI: Available cookies:', cookieNames);

    // Check for Gradescope session cookies (multiple possible names)
    const sessionCookiePatterns = [
      '__Host-gradescope_session',
      'gradescope_session', 
      '_gradescope_session',
      'session',
      '_session'
    ];

    const foundSessionCookie = sessionCookiePatterns.find(pattern => 
      cookieNames.some(name => name.includes(pattern.replace('__Host-', '')))
    );

    if (foundSessionCookie) {
      this.authState.sessionValid = true;
      console.log('GradescopeAPI: Session cookie found:', foundSessionCookie);
    } else {
      this.authState.sessionValid = false;
      console.warn('GradescopeAPI: No recognizable session cookie found');
    }

    // Additional validation: check if we're actually logged in
    const userIndicators = [
      'nav .user-menu',
      '.user-dropdown',
      '[data-user-id]',
      '.logout-link',
      'a[href*="logout"]'
    ];

    const userLoggedIn = userIndicators.some(selector => document.querySelector(selector));
    
    if (userLoggedIn) {
      console.log('GradescopeAPI: User appears to be logged in (found UI indicators)');
      this.authState.sessionValid = true;
    } else {
      console.warn('GradescopeAPI: No user login indicators found in UI');
    }

    return this.authState.sessionValid;
  }

  /**
   * Test authentication by making a safe API call
   */
  async testAuthentication() {
    console.log('GradescopeAPI: Testing authentication with safe API call...');

    if (!this.csrfToken) {
      console.warn('GradescopeAPI: Cannot test authentication without CSRF token');
      return false;
    }

    try {
      // Test with a safe HEAD request to current page
      const testUrl = window.location.href;
      const response = await fetch(testUrl, {
        method: 'HEAD',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': this.csrfToken,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        console.log('GradescopeAPI: Authentication test passed');
        return true;
      } else if (response.status === 401 || response.status === 403) {
        console.error('GradescopeAPI: Authentication test failed - unauthorized');
        return false;
      } else {
        console.warn('GradescopeAPI: Authentication test inconclusive, status:', response.status);
        return true; // Assume OK for non-auth errors
      }

    } catch (error) {
      console.warn('GradescopeAPI: Authentication test error (may be normal):', error.message);
      // Network errors don't necessarily mean auth failure
      return true;
    }
  }

  /**
   * Handle authentication failures with recovery attempts
   */
  handleAuthFailure(reason) {
    console.error('GradescopeAPI: Authentication failure:', reason);
    
    this.authState.isAuthenticated = false;
    this.authState.retryCount++;

    if (this.authState.retryCount < this.authState.maxRetries) {
      console.log(`GradescopeAPI: Will attempt authentication recovery (attempt ${this.authState.retryCount}/${this.authState.maxRetries})`);
      
      // Schedule retry with exponential backoff
      const retryDelay = Math.pow(2, this.authState.retryCount) * 1000;
      setTimeout(() => {
        console.log('GradescopeAPI: Retrying authentication...');
        this.initialize();
      }, retryDelay);
    } else {
      console.error('GradescopeAPI: Max authentication retries exceeded');
      this.notifyAuthenticationFailure(reason);
    }

    return false;
  }

  /**
   * Notify UI of persistent authentication failure
   */
  notifyAuthenticationFailure(reason) {
    console.error('GradescopeAPI: Persistent authentication failure:', reason);
    
    // Notify UI controller if available
    if (window.UIController && typeof window.UIController.showError === 'function') {
      window.UIController.showError(`Authentication failed: ${reason}. Please refresh the page.`);
    }

    // Could also send message to background script for logging
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'logEvent',
        event: 'authentication_failure',
        data: { reason, timestamp: Date.now() }
      }).catch(() => {
        // Ignore if background script not available
      });
    }
  }

  /**
   * Check if authentication is still valid
   */
  isAuthenticated() {
    if (!this.authState.isAuthenticated) {
      return false;
    }

    // Check if authentication is stale (older than 1 hour)
    const oneHour = 60 * 60 * 1000;
    if (this.authState.lastValidated && (Date.now() - this.authState.lastValidated) > oneHour) {
      console.log('GradescopeAPI: Authentication may be stale, re-validating...');
      this.initialize(); // Re-validate in background
      return true; // Assume still valid for now
    }

    return true;
  }

  /**
   * Make authenticated API request with rate limiting and error handling
   */
  async makeAuthenticatedRequest(url, options = {}) {
    console.log(`GradescopeAPI: Making authenticated request to ${url}`);

    // Check authentication first
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    // Apply rate limiting
    if (this.rateLimiter.currentRequests >= this.rateLimiter.maxConcurrent) {
      throw new Error('Too many concurrent requests');
    }

    // Clean up old requests from rate limit tracking
    const oneMinuteAgo = Date.now() - 60000;
    this.rateLimiter.requests = this.rateLimiter.requests.filter(time => time > oneMinuteAgo);

    if (this.rateLimiter.requests.length >= this.rateLimiter.maxPerMinute) {
      throw new Error('Rate limit exceeded');
    }

    // Prepare headers
    const headers = {
      'X-CSRF-Token': this.csrfToken,
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Make request
    this.rateLimiter.currentRequests++;
    this.rateLimiter.requests.push(Date.now());

    try {
      const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers
      });

      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        console.error('GradescopeAPI: Request authentication failed');
        this.authState.isAuthenticated = false;
        throw new Error('Authentication failed during request');
      }

      // Handle CSRF errors
      if (response.status === 422) {
        console.error('GradescopeAPI: CSRF token invalid, re-initializing...');
        this.initialize(); // Re-get CSRF token
        throw new Error('CSRF token invalid');
      }

      console.log(`GradescopeAPI: Request successful, status: ${response.status}`);
      return response;

    } finally {
      this.rateLimiter.currentRequests--;
    }
  }

  /**
   * Get current authentication status for debugging
   */
  getAuthStatus() {
    return {
      ...this.authState,
      csrfToken: this.csrfToken ? `${this.csrfToken.substring(0, 10)}...` : null,
      rateLimiter: {
        currentRequests: this.rateLimiter.currentRequests,
        recentRequests: this.rateLimiter.requests.length
      }
    };
  }

  // ============ PLACEHOLDER METHODS (for future weeks) ============

  /**
   * Download and extract source files from submission ZIP
   * Implements Week 2, Day 1-2: Source code extraction
   */
  async downloadSubmissionFiles(submissionId) {
    console.log(`GradescopeAPI: Downloading files for submission ${submissionId}`);

    if (!submissionId || !this.isAuthenticated()) {
      throw new Error(!submissionId ? 'Submission ID required' : 'Not authenticated');
    }

    // Inspect DOM for available files
    const fileInfo = this.inspectAvailableFiles();
    
    if (!fileInfo.hasFiles) {
      return this.createEmptyResult(fileInfo);
    }

    console.log(`GradescopeAPI: Found ${fileInfo.fileCount} files, attempting downloads...`);

    // Try individual downloads first (more reliable than ZIP for this interface)
    if (fileInfo.files?.length > 0) {
      return await this.downloadIndividualFiles(submissionId, fileInfo.files);
    }

    // Fallback to ZIP download if individual files not found
    return await this.downloadZipFile(submissionId);
  }

  /**
   * Simplified file detection - finds files and their download links
   */
  inspectAvailableFiles() {
    console.log('🔍 GradescopeAPI: Analyzing page for files...');
    
    const files = [];
    
    // Find all download buttons and their associated files
    this.findDownloadButtons().forEach(btn => files.push(btn));
    this.findExpandableFiles().forEach(file => files.push(file));
    
    if (files.length > 0) {
      console.log(`✅ Found ${files.length} files:`, files.map(f => f.fileName).filter(Boolean));
      return { hasFiles: true, fileCount: files.length, type: 'programming', files };
    }

    // Check for non-programming content
    const nonProgrammingType = this.detectNonProgrammingType();
    console.log(`ℹ️ No downloadable files found (type: ${nonProgrammingType})`);
    
    return { hasFiles: false, type: nonProgrammingType, fileCount: 0 };
  }

  /**
   * Find download buttons and extract file info
   */
  findDownloadButtons() {
    const buttons = Array.from(document.querySelectorAll('a[href*="download"], button, .download'));
    return buttons
      .filter(btn => {
        const text = btn.textContent?.trim().toLowerCase() || '';
        const href = btn.href || btn.getAttribute('href') || '';
        return text.includes('download') || href.includes('download');
      })
      .map(btn => {
        const href = btn.href || btn.getAttribute('href') || '';
        const fileId = href.match(/files\/(\d+)/)?.[1];
        const fileName = this.findAssociatedFileName(btn);
        
        return {
          element: btn,
          fileName,
          downloadLink: href,
          fileId,
          type: 'download-button'
        };
      });
  }

  /**
   * Find expandable file sections (like details/summary elements)
   */
  findExpandableFiles() {
    const expandables = document.querySelectorAll('details, .collapsible, [aria-expanded]');
    const files = [];

    expandables.forEach(elem => {
      const text = (elem.querySelector('summary') || elem).textContent?.trim();
      if (text && this.isValidFileName(text)) {
        const downloadBtn = this.findDownloadButton(elem);
        files.push({
          element: elem,
          fileName: text.replace(/^[▼▶\s]*/, '').trim(),
          downloadLink: downloadBtn?.href || downloadBtn?.getAttribute('href'),
          downloadButton: downloadBtn,
          type: 'expandable-file'
        });
      }
    });

    return files;
  }

  /**
   * Find download button associated with an element
   */
  findDownloadButton(elem) {
    // Search in element and nearby siblings
    const searchAreas = [elem, elem.nextElementSibling, elem.parentElement];
    
    for (const area of searchAreas.filter(Boolean)) {
      const btn = area.querySelector('a[href*="download"], button[data-download]') ||
                  Array.from(area.querySelectorAll('button, a'))
                    .find(b => b.textContent?.toLowerCase().includes('download'));
      if (btn) return btn;
    }
    return null;
  }

  /**
   * Find filename associated with a download button
   */
  findAssociatedFileName(btn) {
    const parent = btn.closest('details, .file-container, div, section');
    if (!parent) return null;

    const candidates = [
      parent.querySelector('summary')?.textContent,
      parent.querySelector('h1, h2, h3, h4, h5, h6')?.textContent,
      parent.querySelector('[title]')?.getAttribute('title')
    ];

    return candidates.find(text => text && this.isValidFileName(text))
                    ?.replace(/^[▼▶\s]*/, '').trim();
  }

  /**
   * Check if text looks like a valid filename
   */
  isValidFileName(text) {
    return text && text.length < 100 && 
           /\.(cpp|h|py|java|js|ts|txt|c|cs|rb|php|go|rs|swift|kt|scala|pl|sh|r|m|sql|html|css|xml|json|yaml|yml|md|rst|makefile)$/i.test(text);
  }

  /**
   * Detect non-programming submission types
   */
  detectNonProgrammingType() {
    if (document.querySelector('.submission-content, .student-answer')) return 'text';
    if (document.querySelectorAll('img[src*="submission"]').length > 0) return 'image';
    if (document.querySelector('.pdf-viewer, iframe[src*="pdf"]')) return 'pdf';
    return 'unknown';
  }

  /**
   * Create empty result for non-programming submissions
   */
  createEmptyResult(fileInfo) {
    const messages = {
      text: 'This appears to be a text-based submission.',
      image: `This appears to be an image submission (${fileInfo.imageCount || 'unknown'} images).`,
      pdf: 'This appears to be a PDF submission.',
      unknown: 'This may not be a programming assignment.'
    };

    return {
      files: {},
      metadata: {
        totalFiles: 0,
        supportedFiles: 0,
        skippedFiles: 0,
        errors: [],
        submissionType: fileInfo.type,
        message: `No downloadable files found. ${messages[fileInfo.type] || messages.unknown}`,
        hasDownloadableFiles: false
      }
    };
  }

  /**
   * Download individual files (simplified version)
   */
  async downloadIndividualFiles(submissionId, detectedFiles) {
    console.log(`GradescopeAPI: Downloading ${detectedFiles.length} files individually...`);
    
    const result = { files: {}, metadata: this.createMetadata(detectedFiles.length, 'individual') };
    
    for (const fileInfo of detectedFiles) {
      const fileName = this.cleanFileName(fileInfo.fileName || fileInfo.text);
      if (!this.shouldProcessFile(fileName, result.metadata)) continue;

      try {
        const downloadUrl = this.getDownloadUrl(fileInfo, submissionId);
        if (!downloadUrl) {
          this.recordError(result.metadata, `No download URL for: ${fileName}`);
          continue;
        }

        const content = await this.downloadFile(downloadUrl, fileName);
        if (content) {
          result.files[fileName] = content;
          this.updateMetadata(result.metadata, fileName, content);
          console.log(`✅ Downloaded: ${fileName} (${content.size} chars)`);
        }

      } catch (error) {
        console.error(`❌ Failed to download ${fileName}:`, error.message);
        this.recordError(result.metadata, `Error downloading ${fileName}: ${error.message}`);
      }
    }

    console.log(`📊 Download complete: ${result.metadata.supportedFiles}/${result.metadata.totalFiles} files`);
    return result;
  }

  /**
   * Download individual file and return processed content
   */
  async downloadFile(url, fileName) {
    const response = await this.makeAuthenticatedRequest(url, {
      method: 'GET',
      headers: { 'Accept': 'text/plain, application/octet-stream, */*' }
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    let content = await response.text();
    
    if (this.containsBinaryData(content)) {
      console.log(`⚠️ Skipping binary file: ${fileName}`);
      return null;
    }

    // Clean and limit content
    content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const maxSize = 1024 * 1024; // 1MB
    if (content.length > maxSize) {
      content = content.substring(0, maxSize) + '\n\n// [FILE TRUNCATED - TOO LARGE]';
    }

    return {
      content,
      size: content.length,
      encoding: 'utf8',
      extension: fileName.match(/(\.[^.]+)$/)?.[1]?.toLowerCase() || ''
    };
  }

  /**
   * Get download URL for a file
   */
  getDownloadUrl(fileInfo, submissionId) {
    if (fileInfo.downloadLink) return fileInfo.downloadLink;
    if (fileInfo.fileId) return `/files/${fileInfo.fileId}/download?submission_id=${submissionId}`;
    
    // Try to find URL in element
    const linkEl = fileInfo.element?.querySelector('a[href*="download"], a[href*="files"]') ||
                   (fileInfo.element?.tagName === 'A' ? fileInfo.element : null);
    
    return linkEl?.href || null;
  }

  /**
   * Utility methods for metadata management
   */
  createMetadata(totalFiles, method) {
    return {
      totalFiles,
      supportedFiles: 0,
      skippedFiles: 0,
      errors: [],
      fileTypes: {},
      largestFile: { name: '', size: 0 },
      totalSize: 0,
      downloadMethod: method
    };
  }

  cleanFileName(name) {
    if (!name || name === 'unknown') return null;
    return name.replace(/^\s*[▼▶]\s*/, '').replace(/\s*Download\s*$/, '').trim();
  }

  shouldProcessFile(fileName, metadata) {
    if (!fileName || fileName.length > 100 || fileName.includes('Download')) {
      metadata.skippedFiles++;
      return false;
    }

    const extension = fileName.match(/(\.[^.]+)$/)?.[1]?.toLowerCase();
    const supportedExts = ['.cpp', '.h', '.py', '.java', '.js', '.ts', '.c', '.cs', '.rb', '.php', '.txt', '.md'];
    const isSupported = supportedExts.includes(extension) || fileName.toLowerCase().includes('makefile');
    
    if (extension) metadata.fileTypes[extension] = (metadata.fileTypes[extension] || 0) + 1;
    
    if (!isSupported) {
      console.log(`⚠️ Skipping unsupported: ${fileName}`);
      metadata.skippedFiles++;
      return false;
    }

    return true;
  }

  updateMetadata(metadata, fileName, content) {
    metadata.supportedFiles++;
    metadata.totalSize += content.size;
    if (content.size > metadata.largestFile.size) {
      metadata.largestFile = { name: fileName, size: content.size };
    }
  }

  recordError(metadata, errorMsg) {
    metadata.errors.push(errorMsg);
    metadata.skippedFiles++;
  }

  /**
   * Fallback ZIP download method (simplified)
   */
  async downloadZipFile(submissionId) {
    console.log('GradescopeAPI: Attempting ZIP download fallback...');
    
    const urls = this.getZipUrls(submissionId);
    
    for (const url of urls) {
      try {
        const response = await this.makeAuthenticatedRequest(url, {
          method: 'GET',
          headers: { 'Accept': 'application/zip, application/octet-stream, */*' }
        });

        if (response.ok) {
          console.log(`✅ ZIP download successful from: ${url}`);
          return await this.processZipFile(await response.blob());
        }
      } catch (error) {
        console.log(`❌ ZIP URL failed: ${url} (${error.message})`);
      }
    }

    throw new Error('All download methods failed');
  }

  getZipUrls(submissionId) {
    const urlMatch = window.location.pathname.match(/\/courses\/(\d+)\/(assignments|questions)\/(\d+)/);
    if (!urlMatch) return [`/submissions/${submissionId}/zip_download`];
    
    const [, courseId, assignmentType, assignmentId] = urlMatch;
    
    return [
      `/${courseId}/${assignmentType}/${assignmentId}/submissions/${submissionId}/zip_download`,
      `/submissions/${submissionId}/zip_download`,
      `/${courseId}/assignments/${assignmentId}/submissions/${submissionId}/zip_download`
    ].map(path => path.startsWith('/') ? path : `/${path}`);
  }

  async processZipFile(zipBlob) {
    if (zipBlob.size === 0) {
      throw new Error('ZIP file is empty');
    }

    const zip = await JSZip.loadAsync(zipBlob);
    const result = { files: {}, metadata: this.createMetadata(Object.keys(zip.files).length, 'ZIP') };

    for (const [path, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;

      const fileName = path.replace(/\\/g, '/');
      if (!this.shouldProcessFile(fileName, result.metadata)) continue;

      try {
        const content = await this.downloadFile(null, fileName, async () => {
          const text = await zipEntry.async('text');
          return this.containsBinaryData(text) ? null : text;
        });

        if (content) {
          result.files[fileName] = content;
          this.updateMetadata(result.metadata, fileName, content);
        }
      } catch (error) {
        this.recordError(result.metadata, `Error processing ${fileName}: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Helper method to detect binary data in text content
   */
  containsBinaryData(content) {
    if (typeof content !== 'string') return true;
    
    // Check for null bytes (common in binary files)
    if (content.includes('\0')) return true;
    
    // Check for high percentage of non-printable characters
    const nonPrintableCount = (content.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g) || []).length;
    const nonPrintableRatio = nonPrintableCount / content.length;
    
    // If more than 10% non-printable characters, likely binary
    return nonPrintableRatio > 0.1;
  }

  /**
   * Extract rubric structure from DOM (placeholder - Week 2)
   */
  extractRubricStructure() {
    console.log('GradescopeAPI: Extracting rubric structure...');
    // TODO: Implement rubric parsing (Week 2)
    return [];
  }

  /**
   * Toggle a rubric item (placeholder - Week 2)
   */
  async toggleRubricItem(questionId, rubricItemId, points, description) {
    console.log(`GradescopeAPI: Toggling rubric item ${rubricItemId}`);
    // TODO: Implement rubric item toggle (Week 2)
    return { success: false, message: 'Not implemented yet' };
  }

  /**
   * Add inline comment to code (placeholder - Week 2)
   */
  async addComment(questionId, submissionId, fileId, lineStart, lineEnd, text) {
    console.log(`GradescopeAPI: Adding comment to submission ${submissionId}`);
    // TODO: Implement comment addition (Week 2)
    return { success: false, message: 'Not implemented yet' };
  }
}

// Create global instance
window.GradescopeAPI = new GradescopeAPI();

// TESTING: Add test functionality to the existing UI
// This avoids CSP violations while providing testing capability
window.addEventListener('SUPERGRADER_TEST_DOWNLOAD', async (event) => {
  console.log('🔧 Testing file download for submission:', event.detail.submissionId);
  
  try {
    const result = await window.GradescopeAPI.downloadSubmissionFiles(event.detail.submissionId);
    
    console.log('✅ Download successful!');
    console.log('📁 Files found:', Object.keys(result.files).length);
    console.log('📊 Metadata:', result.metadata);
    
    // Log file details
    Object.entries(result.files).forEach(([path, file]) => {
      console.log(`📄 ${path}: ${file.size} chars, ${file.extension} (${file.encoding})`);
    });
    
    // Show sample content
    const firstFile = Object.keys(result.files)[0];
    if (firstFile) {
      console.log(`\n📖 Sample from ${firstFile}:`);
      console.log(result.files[firstFile].content.substring(0, 300) + '...');
    }
    
    // Store result in DOM for access
    const resultElement = document.getElementById('supergrader-test-result') || document.createElement('meta');
    resultElement.id = 'supergrader-test-result';
    resultElement.name = 'supergrader-test-result';
    resultElement.content = JSON.stringify({
      success: true,
      fileCount: Object.keys(result.files).length,
      metadata: result.metadata,
      timestamp: Date.now()
    });
    if (!resultElement.parentNode) {
      document.head.appendChild(resultElement);
    }
    
  } catch (error) {
    console.error('❌ Download failed:', error);
    
    // Store error in DOM
    const resultElement = document.getElementById('supergrader-test-result') || document.createElement('meta');
    resultElement.id = 'supergrader-test-result';
    resultElement.name = 'supergrader-test-result';
    resultElement.content = JSON.stringify({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
    if (!resultElement.parentNode) {
      document.head.appendChild(resultElement);
    }
  }
});

// CSP-safe: Store auth status in DOM data attribute for console access
function updateAuthStatusInDOM() {
  const authStatus = window.GradescopeAPI?.getAuthStatus?.();
  if (authStatus && document.body) {
    // Store in a hidden meta element that console can access
    let statusElement = document.getElementById('supergrader-auth-status');
    if (!statusElement) {
      statusElement = document.createElement('meta');
      statusElement.id = 'supergrader-auth-status';
      statusElement.name = 'supergrader-auth-status';
      document.head.appendChild(statusElement);
    }
    
    // Store as JSON in content attribute
    statusElement.content = JSON.stringify(authStatus);
    
    // Also store timestamp
    statusElement.setAttribute('data-updated', Date.now().toString());
    
    console.log('supergrader: Auth status updated in DOM for console access');
  }
}

// Update auth status in DOM whenever it changes
const originalInitialize = window.GradescopeAPI.initialize;
window.GradescopeAPI.initialize = async function() {
  const result = await originalInitialize.call(this);
  updateAuthStatusInDOM();
  return result;
}; 