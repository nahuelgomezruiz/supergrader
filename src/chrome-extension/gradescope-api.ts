// Gradescope API integration module
// Handles authentication, data extraction, and grading actions

console.log('supergrader: Gradescope API module loaded');

// Type definitions for the API
interface AuthState {
  isAuthenticated: boolean;
  csrfTokenValid: boolean;
  sessionValid: boolean;
  lastValidated: number | null;
  retryCount: number;
  maxRetries: number;
}

interface RateLimiter {
  requests: number[];
  maxPerMinute: number;
  maxConcurrent: number;
  currentRequests: number;
}

interface FileInfo {
  element?: Element;
  fileName?: string;
  downloadLink?: string;
  fileId?: string;
  type: 'download-button' | 'expandable-file';
  downloadButton?: Element;
}

interface FileContent {
  content: string;
  size: number;
  encoding: string;
  extension: string;
}

interface FileInspectionResult {
  hasFiles: boolean;
  fileCount: number;
  type: 'programming' | 'text' | 'image' | 'pdf' | 'unknown';
  files?: FileInfo[];
  imageCount?: number;
}

interface DownloadMetadata {
  totalFiles: number;
  supportedFiles: number;
  skippedFiles: number;
  errors: string[];
  fileTypes: Record<string, number>;
  largestFile: { name: string; size: number };
  totalSize: number;
  downloadMethod: string;
  submissionType?: string;
  message?: string;
  hasDownloadableFiles?: boolean;
}

interface DownloadResult {
  files: Record<string, FileContent>;
  metadata: DownloadMetadata;
}

interface AuthStatus {
  isAuthenticated: boolean;
  csrfTokenValid: boolean;
  sessionValid: boolean;
  lastValidated: number | null;
  retryCount: number;
  maxRetries: number;
  csrfToken: string | null;
  rateLimiter: {
    currentRequests: number;
    recentRequests: number;
  };
}

// Window interface extensions - using any for simplicity
type WindowWithExtensions = Window & {
  JSZip: any;
  GradescopeAPI: GradescopeAPI;
  UIController?: any;
  supergraderState?: any;
  supergraderAPI?: any;
  supergraderUI?: any;
};

/**
 * Enhanced Gradescope API wrapper class with robust authentication
 */
class GradescopeAPI {
  private csrfToken: string | null = null;
  
  // Authentication state
  private authState: AuthState = {
    isAuthenticated: false,
    csrfTokenValid: false,
    sessionValid: false,
    lastValidated: null,
    retryCount: 0,
    maxRetries: 3
  };
  
  // Rate limiting
  private rateLimiter: RateLimiter = {
    requests: [],
    maxPerMinute: 100,
    maxConcurrent: 10,
    currentRequests: 0
  };

  /**
   * Enhanced authentication initialization with validation and testing
   */
  async initialize(): Promise<boolean> {
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
      return this.handleAuthFailure(`Initialization error: ${(error as Error).message}`);
    }
  }

  /**
   * Extract and validate CSRF token
   */
  private async extractAndValidateCSRF(): Promise<boolean> {
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
      this.csrfToken = (csrfMeta as HTMLMetaElement).getAttribute('content') || 
                       (csrfMeta as HTMLInputElement).value;
      
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
      console.log('GradescopeAPI: Available meta tags:', Array.from(document.querySelectorAll('meta')).map(m => (m as HTMLMetaElement).name || (m as any).property).filter(Boolean));
      return false;
    }
  }

  /**
   * Validate session cookies and authentication state
   */
  private async validateSession(): Promise<boolean> {
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
  private async testAuthentication(): Promise<boolean> {
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
      console.warn('GradescopeAPI: Authentication test error (may be normal):', (error as Error).message);
      // Network errors don't necessarily mean auth failure
      return true;
    }
  }

  /**
   * Handle authentication failures with recovery attempts
   */
  private handleAuthFailure(reason: string): boolean {
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
  private notifyAuthenticationFailure(reason: string): void {
    console.error('GradescopeAPI: Persistent authentication failure:', reason);
    
    // Notify UI controller if available
    if ((window as any).UIController && typeof (window as any).UIController.showError === 'function') {
      (window as any).UIController.showError(`Authentication failed: ${reason}. Please refresh the page.`);
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
  isAuthenticated(): boolean {
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
  async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
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
      'X-CSRF-Token': this.csrfToken!,
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
  getAuthStatus(): AuthStatus {
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
  async downloadSubmissionFiles(submissionId: string): Promise<DownloadResult> {
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
    if (fileInfo.files?.length && fileInfo.files.length > 0) {
      return await this.downloadIndividualFiles(submissionId, fileInfo.files);
    }

    // Fallback to ZIP download if individual files not found
    return await this.downloadZipFile(submissionId);
  }

  /**
   * Simplified file detection - finds files and their download links
   */
  private inspectAvailableFiles(): FileInspectionResult {
    console.log('🔍 GradescopeAPI: Analyzing page for files...');
    
    const files: FileInfo[] = [];
    
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
  private findDownloadButtons(): FileInfo[] {
    const buttons = Array.from(document.querySelectorAll('a[href*="download"], button, .download'));
    return buttons
      .filter(btn => {
        const text = btn.textContent?.trim().toLowerCase() || '';
        const href = (btn as HTMLAnchorElement).href || btn.getAttribute('href') || '';
        return text.includes('download') || href.includes('download');
      })
      .map(btn => {
        const href = (btn as HTMLAnchorElement).href || btn.getAttribute('href') || '';
        const fileId = href.match(/files\/(\d+)/)?.[1];
        const fileName = this.findAssociatedFileName(btn);
        
        return {
          element: btn,
          fileName,
          downloadLink: href,
          fileId,
          type: 'download-button' as const
        };
      });
  }

  /**
   * Find expandable file sections (like details/summary elements)
   */
  private findExpandableFiles(): FileInfo[] {
    const expandables = document.querySelectorAll('details, .collapsible, [aria-expanded]');
    const files: FileInfo[] = [];

    expandables.forEach(elem => {
      const text = (elem.querySelector('summary') || elem).textContent?.trim();
      if (text && this.isValidFileName(text)) {
        const downloadBtn = this.findDownloadButton(elem);
        files.push({
          element: elem,
          fileName: text.replace(/^[▼▶\s]*/, '').trim(),
          downloadLink: (downloadBtn as HTMLAnchorElement)?.href || downloadBtn?.getAttribute('href') || undefined,
          downloadButton: downloadBtn || undefined,
          type: 'expandable-file'
        });
      }
    });

    return files;
  }

  /**
   * Find download button associated with an element
   */
  private findDownloadButton(elem: Element): Element | null {
    // Search in element and nearby siblings
    const searchAreas = [elem, elem.nextElementSibling, elem.parentElement].filter(Boolean);
    
    for (const area of searchAreas) {
      if (!area) continue;
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
  private findAssociatedFileName(btn: Element): string | undefined {
    const parent = btn.closest('details, .file-container, div, section');
    if (!parent) return undefined;

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
  private isValidFileName(text: string): boolean {
    return Boolean(text && text.length < 100 && 
           /\.(cpp|h|py|java|js|ts|txt|c|cs|rb|php|go|rs|swift|kt|scala|pl|sh|r|m|sql|html|css|xml|json|yaml|yml|md|rst|makefile)$/i.test(text));
  }

  /**
   * Detect non-programming submission types
   */
  private detectNonProgrammingType(): 'text' | 'image' | 'pdf' | 'unknown' {
    if (document.querySelector('.submission-content, .student-answer')) return 'text';
    if (document.querySelectorAll('img[src*="submission"]').length > 0) return 'image';
    if (document.querySelector('.pdf-viewer, iframe[src*="pdf"]')) return 'pdf';
    return 'unknown';
  }

  /**
   * Create empty result for non-programming submissions
   */
  private createEmptyResult(fileInfo: FileInspectionResult): DownloadResult {
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
        fileTypes: {},
        largestFile: { name: '', size: 0 },
        totalSize: 0,
        downloadMethod: 'none',
        submissionType: fileInfo.type,
        message: `No downloadable files found. ${messages[fileInfo.type as keyof typeof messages] || messages.unknown}`,
        hasDownloadableFiles: false
      }
    };
  }

  /**
   * Download individual files (simplified version)
   */
  private async downloadIndividualFiles(submissionId: string, detectedFiles: FileInfo[]): Promise<DownloadResult> {
    console.log(`GradescopeAPI: Downloading ${detectedFiles.length} files individually...`);
    
    const result: DownloadResult = { 
      files: {}, 
      metadata: this.createMetadata(detectedFiles.length, 'individual') 
    };
    
    for (const fileInfo of detectedFiles) {
      const fileName = this.cleanFileName(fileInfo.fileName || 'unknown');
      if (!fileName || !this.shouldProcessFile(fileName, result.metadata)) continue;

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
        console.error(`❌ Failed to download ${fileName}:`, (error as Error).message);
        this.recordError(result.metadata, `Error downloading ${fileName}: ${(error as Error).message}`);
      }
    }

    console.log(`📊 Download complete: ${result.metadata.supportedFiles}/${result.metadata.totalFiles} files`);
    return result;
  }

  /**
   * Download individual file and return processed content
   */
  private async downloadFile(url: string, fileName: string): Promise<FileContent | null> {
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
  private getDownloadUrl(fileInfo: FileInfo, submissionId: string): string | null {
    if (fileInfo.downloadLink) return fileInfo.downloadLink;
    if (fileInfo.fileId) return `/files/${fileInfo.fileId}/download?submission_id=${submissionId}`;
    
    // Try to find URL in element
    const linkEl = fileInfo.element?.querySelector('a[href*="download"], a[href*="files"]') ||
                   (fileInfo.element?.tagName === 'A' ? fileInfo.element : null);
    
    return (linkEl as HTMLAnchorElement)?.href || null;
  }

  /**
   * Utility methods for metadata management
   */
  private createMetadata(totalFiles: number, method: string): DownloadMetadata {
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

  private cleanFileName(name: string | undefined): string | null {
    if (!name || name === 'unknown') return null;
    return name.replace(/^\s*[▼▶]\s*/, '').replace(/\s*Download\s*$/, '').trim();
  }

  private shouldProcessFile(fileName: string, metadata: DownloadMetadata): boolean {
    if (!fileName || fileName.length > 100 || fileName.includes('Download')) {
      metadata.skippedFiles++;
      return false;
    }

    const extension = fileName.match(/(\.[^.]+)$/)?.[1]?.toLowerCase();
    const supportedExts = ['.cpp', '.h', '.py', '.java', '.js', '.ts', '.c', '.cs', '.rb', '.php', '.txt', '.md'];
    const isSupported = supportedExts.includes(extension || '') || fileName.toLowerCase().includes('makefile');
    
    if (extension) metadata.fileTypes[extension] = (metadata.fileTypes[extension] || 0) + 1;
    
    if (!isSupported) {
      console.log(`⚠️ Skipping unsupported: ${fileName}`);
      metadata.skippedFiles++;
      return false;
    }

    return true;
  }

  private updateMetadata(metadata: DownloadMetadata, fileName: string, content: FileContent): void {
    metadata.supportedFiles++;
    metadata.totalSize += content.size;
    if (content.size > metadata.largestFile.size) {
      metadata.largestFile = { name: fileName, size: content.size };
    }
  }

  private recordError(metadata: DownloadMetadata, errorMsg: string): void {
    metadata.errors.push(errorMsg);
    metadata.skippedFiles++;
  }

  /**
   * Fallback ZIP download method (simplified)
   */
  private async downloadZipFile(submissionId: string): Promise<DownloadResult> {
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
        console.log(`❌ ZIP URL failed: ${url} (${(error as Error).message})`);
      }
    }

    throw new Error('All download methods failed');
  }

  private getZipUrls(submissionId: string): string[] {
    const urlMatch = window.location.pathname.match(/\/courses\/(\d+)\/(assignments|questions)\/(\d+)/);
    if (!urlMatch) return [`/submissions/${submissionId}/zip_download`];
    
    const [, courseId, assignmentType, assignmentId] = urlMatch;
    
    return [
      `/${courseId}/${assignmentType}/${assignmentId}/submissions/${submissionId}/zip_download`,
      `/submissions/${submissionId}/zip_download`,
      `/${courseId}/assignments/${assignmentId}/submissions/${submissionId}/zip_download`
    ].map(path => path.startsWith('/') ? path : `/${path}`);
  }

  private async processZipFile(zipBlob: Blob): Promise<DownloadResult> {
    if (zipBlob.size === 0) {
      throw new Error('ZIP file is empty');
    }

    const zip = await (window as any).JSZip.loadAsync(zipBlob);
    const result: DownloadResult = { 
      files: {}, 
      metadata: this.createMetadata(Object.keys(zip.files).length, 'ZIP') 
    };

    for (const [path, zipEntry] of Object.entries(zip.files) as [string, any][]) {
      if (zipEntry.dir) continue;

      const fileName = path.replace(/\\/g, '/');
      if (!this.shouldProcessFile(fileName, result.metadata)) continue;

      try {
        const text = await zipEntry.async('text');
        const content = this.containsBinaryData(text) ? null : text;

        if (content) {
          const fileContent: FileContent = {
            content,
            size: content.length,
            encoding: 'utf8',
            extension: fileName.match(/(\.[^.]+)$/)?.[1]?.toLowerCase() || ''
          };
          result.files[fileName] = fileContent;
          this.updateMetadata(result.metadata, fileName, fileContent);
        }
      } catch (error) {
        this.recordError(result.metadata, `Error processing ${fileName}: ${(error as Error).message}`);
      }
    }

    return result;
  }

  /**
   * Helper method to detect binary data in text content
   */
  private containsBinaryData(content: string): boolean {
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
   * Extract rubric structure from DOM - Week 2 Day 3-4 Implementation
   */
  extractRubricStructure(): any[] {
    console.log('GradescopeAPI: Extracting rubric structure...');
    
    // Use the unified rubric detection system
    const rubricResult = getRubric();
    
    if (!rubricResult) {
      console.log('GradescopeAPI: No rubric structure found');
      return [];
    }
    
    if (rubricResult.type === 'manual') {
      console.log('GradescopeAPI: Manual scoring interface - no structured items');
      return [];
    }
    
    // Convert unified format to legacy format for backwards compatibility
    const rubricItems = rubricResult.items.map(item => ({
      id: typeof item.id === 'string' ? item.id : String(item.id),
      description: item.description || '',
      points: item.points || 0,
      category: 'default', // For simple cases, all items in same category
      currentlySelected: this.isRubricItemSelected(item.element),
      rubricStyle: rubricResult.rubricStyle
    }));
    
    console.log(`GradescopeAPI: Extracted ${rubricItems.length} rubric items`);
    return rubricItems;
  }

  /**
   * Check if a rubric item is currently selected
   */
  private isRubricItemSelected(element?: HTMLElement): boolean {
    if (!element) return false;
    const input = element.querySelector('input[type="checkbox"], input[type="radio"]') as HTMLInputElement;
    return input ? input.checked : false;
  }

  /**
   * Toggle a rubric item - Week 2 Day 3-4 Implementation
   */
  async toggleRubricItem(_questionId: string, rubricItemId: string, _points: number, _description: string): Promise<{success: boolean; message: string}> {
    console.log(`GradescopeAPI: Toggling rubric item ${rubricItemId}`);
    
    try {
      // Get current rubric structure
      const rubricResult = getRubric();
      
      if (!rubricResult) {
        return { success: false, message: 'No rubric structure found on page' };
      }
      
      if (rubricResult.type === 'manual') {
        return { success: false, message: 'Manual scoring interface - no structured rubric items' };
      }
      
      // Find the target item
      const targetItem = rubricResult.items.find(item => 
        String(item.id) === String(rubricItemId)
      );
      
      if (!targetItem) {
        return { success: false, message: `Rubric item ${rubricItemId} not found` };
      }
      
      // Get current state
      const currentlySelected = this.isRubricItemSelected(targetItem.element);
      const newState = !currentlySelected;
      
      // Apply the change using unified system
      const success = applyGrade(rubricResult, rubricItemId, newState);
      
      if (success) {
        const action = newState ? 'selected' : 'deselected';
        return { 
          success: true, 
          message: `Successfully ${action} rubric item ${rubricItemId} (${_points} pts)` 
        };
      } else {
        return { 
          success: false, 
          message: `Failed to toggle rubric item ${rubricItemId}` 
        };
      }
      
    } catch (error) {
      console.error('Error toggling rubric item:', error);
      return { 
        success: false, 
        message: `Error toggling rubric item: ${(error as Error).message}` 
      };
    }
  }

  /**
   * Add inline comment to code (placeholder - Week 2)
   */
  async addComment(_questionId: string, submissionId: string, _fileId: string, _lineStart: number, _lineEnd: number, _text: string): Promise<{success: boolean; message: string}> {
    console.log(`GradescopeAPI: Adding comment to submission ${submissionId}`);
    // TODO: Implement comment addition (Week 2)
    return { success: false, message: 'Not implemented yet' };
  }
}

// Create global instance
(window as any).GradescopeAPI = new GradescopeAPI();

// Set up supergrader helper as fallback (in case content script version doesn't work)
setTimeout(() => {
  if (!(window as any).supergrader && (window as any).GradescopeAPI) {
    (window as any).supergrader = {
      api: (window as any).GradescopeAPI,
      ui: (window as any).UIController,
      getStatus: () => (window as any).GradescopeAPI?.getAuthStatus?.(),
      getState: () => (window as any).supergraderState,
      downloadTest: (submissionId: string) => {
        const event = new CustomEvent('SUPERGRADER_TEST_DOWNLOAD', { 
          detail: { submissionId } 
        });
        window.dispatchEvent(event);
      },
      testRubric: async () => {
        console.log('supergrader: Testing rubric retrieval...');
        
        // Extract IDs from current page URL
        const urlMatch = window.location.pathname.match(
          /\/courses\/(\d+)\/(assignments|questions)\/(\d+)\/submissions\/(\d+)\/grade/
        );
        
        if (!urlMatch) {
          console.error('supergrader: Not on a valid grading page');
          return null;
        }
        
        const [, courseId, , assignmentId] = urlMatch;
        
        try {
          // Dynamic import to avoid module loading issues
          const rubricModule = await import(chrome.runtime.getURL('gradescope/rubric.js'));
          const rubricMap = await rubricModule.fetchRubricMap(parseInt(courseId, 10), parseInt(assignmentId, 10));
          
          console.log('supergrader: Rubric retrieval successful!');
          console.log('Questions:', rubricMap.questions);
          console.log('Item to Question mapping:', rubricMap.itemToQuestion);
          
          // Log detailed structure
          const questionCount = Object.keys(rubricMap.questions).length;
          const totalItems = Object.keys(rubricMap.itemToQuestion).length;
          
          console.log(`supergrader: Found ${questionCount} questions with ${totalItems} total rubric items`);
          
          // Log each question's details
          Object.entries(rubricMap.questions).forEach(([qId, qData]: [string, any]) => {
            console.log(`Question ${qId}: "${qData.name}" (${qData.rubricStyle}, parent: ${qData.parentId || 'none'})`);
            qData.items.forEach((item: any) => {
              console.log(`  Item ${item.id}: "${item.text}" (${item.points} pts)`);
            });
          });
          
          return rubricMap;
        } catch (error) {
          console.error('supergrader: Rubric retrieval failed:', error);
          return null;
        }
      },
      analyzeRubric: async () => {
        const rubricMap = await (window as any).supergrader.testRubric();
        if (!rubricMap) return null;
        
        const analysis = {
          totalQuestions: Object.keys(rubricMap.questions).length,
          totalItems: Object.keys(rubricMap.itemToQuestion).length,
          questionsByType: { CHECKBOX: 0, RADIO: 0 } as { CHECKBOX: number; RADIO: number },
          parentChildRelationships: 0,
          pointsDistribution: { positive: 0, negative: 0, zero: 0 },
          questionHierarchy: [] as Array<{
            id: number;
            name: string;
            children: Array<{ id: number; name: string }>;
          }>
        };
        
        // Analyze question structure
        Object.entries(rubricMap.questions).forEach(([_, qData]: [string, any]) => {
          analysis.questionsByType[qData.rubricStyle as 'CHECKBOX' | 'RADIO']++;
          
          if (qData.parentId !== null) {
            analysis.parentChildRelationships++;
          }
          
          // Analyze points distribution
          qData.items.forEach((item: any) => {
            if (item.points > 0) analysis.pointsDistribution.positive++;
            else if (item.points < 0) analysis.pointsDistribution.negative++;
            else analysis.pointsDistribution.zero++;
          });
        });
        
        // Build question hierarchy
        const rootQuestions = Object.entries(rubricMap.questions)
          .filter(([_, qData]: [string, any]) => qData.parentId === null)
          .map(([qId, qData]: [string, any]) => ({
            id: parseInt(qId),
            name: qData.name,
            children: Object.entries(rubricMap.questions)
              .filter(([_, childData]: [string, any]) => childData.parentId === parseInt(qId))
              .map(([childId, childData]: [string, any]) => ({
                id: parseInt(childId),
                name: childData.name
              }))
          }));
        
        analysis.questionHierarchy = rootQuestions;
        
        console.log('Rubric Analysis:', analysis);
        return analysis;
      },
      getRubricItem: async (itemId: number) => {
        const rubricMap = await (window as any).supergrader.testRubric();
        if (!rubricMap) return null;
        
        const questionId = rubricMap.itemToQuestion[itemId];
        if (!questionId) {
          console.error(`Item ${itemId} not found`);
          return null;
        }
        
        const question: any = rubricMap.questions[questionId];
        const item = question.items.find((i: any) => i.id === itemId);
        
        const result = {
          item,
          question: {
            id: questionId,
            name: question.name,
            parentId: question.parentId,
            rubricStyle: question.rubricStyle
          }
        };
        
        console.log(`Item ${itemId}:`, result);
        return result;
      },
      validateRubricStructure: async () => {
        console.log('supergrader: Validating rubric structure...');
        const rubricMap = await (window as any).supergrader.testRubric();
        if (!rubricMap) return false;
        
        const issues: string[] = [];
        
        // Check for orphaned items
        Object.entries(rubricMap.itemToQuestion).forEach(([itemId, questionId]: [string, any]) => {
          if (!rubricMap.questions[questionId as number]) {
            issues.push(`Orphaned item ${itemId} points to non-existent question ${questionId}`);
          }
        });
        
        // Check for missing reverse mappings
        Object.entries(rubricMap.questions).forEach(([questionId, question]: [string, any]) => {
          question.items.forEach((item: any) => {
            if (rubricMap.itemToQuestion[item.id] !== parseInt(questionId)) {
              issues.push(`Item ${item.id} in question ${questionId} not properly mapped in itemToQuestion`);
            }
          });
        });
        
        // Check parent-child consistency
        Object.entries(rubricMap.questions).forEach(([questionId, question]: [string, any]) => {
          if (question.parentId !== null) {
            if (!rubricMap.questions[question.parentId as number]) {
              issues.push(`Question ${questionId} has non-existent parent ${question.parentId}`);
            }
          }
        });
        
        if (issues.length === 0) {
                  console.log('✅ Rubric structure validation passed');
        return true;
      } else {
        console.error('❌ Rubric structure validation failed:');
        issues.forEach((issue: string) => console.error(`  - ${issue}`));
        return false;
      }
    },
    // Unified rubric functions - works on all Gradescope layouts
    testUnifiedRubric: () => {
      console.log('📝 Testing unified rubric detection...');
      const result = getRubric();
      if (!result) {
        console.info('❌ No rubric or score box found');
        return null;
      }
      
      if (result.type === 'manual') {
        console.info('✅ Manual-score interface detected');
        console.log('Score box:', result.box);
        return result;
      } else {
        console.info(`✅ Structured rubric detected – ${result.items.length} items (${result.rubricStyle})`);
        console.log('Items:', result.items);
        result.items.forEach(item => {
          console.log(`  ${item.id}: "${item.description}" (${item.points} pts)`);
        });
        return result;
      }
    },
    // Legacy iframe-based functions (for backwards compatibility)
    testIframeRubric: async () => {
      console.log('📝 Testing rubric extraction (legacy wrapper)...');
      try {
        const rubricData = await getRubricFromIframe();
        console.log('✅ Rubric extraction successful!');
        console.log('Items:', rubricData.items);
        console.log('Style:', rubricData.rubricStyle);
        console.log('Points distribution:', rubricData.pointsDistribution);
        return rubricData;
      } catch (error) {
        console.error('❌ Rubric extraction failed:', error);
        return null;
      }
    },
    // Unified apply functions
    applyGrade: (rubricId?: string, checked?: boolean, score?: number) => {
      const rubricResult = getRubric();
      return applyGrade(rubricResult, rubricId, checked, score);
    },
    applyRubric: (itemId: number, selected: boolean) => {
      return applyRubricItem(itemId, selected);
    },
    // Utility functions
    getRubric: () => getRubric(),
    getInnerDoc: () => getInnerDoc(),
    getIframeDoc: () => getIframeDocument()
  };
  console.log('supergrader: Console helper set up via fallback method');
  }
}, 1000);

// TESTING: Add test functionality to the existing UI
// This avoids CSP violations while providing testing capability
window.addEventListener('SUPERGRADER_TEST_DOWNLOAD', async (event: Event) => {
  const customEvent = event as CustomEvent;
  console.log('🔧 Testing file download for submission:', customEvent.detail.submissionId);
  
  try {
    const result = await (window as any).GradescopeAPI.downloadSubmissionFiles(customEvent.detail.submissionId);
    
    console.log('✅ Download successful!');
    console.log('📁 Files found:', Object.keys(result.files).length);
    console.log('📊 Metadata:', result.metadata);
    
    // Log file details
    Object.entries(result.files).forEach(([path, file]) => {
      const fileContent = file as FileContent;
      console.log(`📄 ${path}: ${fileContent.size} chars, ${fileContent.extension} (${fileContent.encoding})`);
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
    (resultElement as HTMLMetaElement).name = 'supergrader-test-result';
    (resultElement as HTMLMetaElement).content = JSON.stringify({
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
    (resultElement as HTMLMetaElement).name = 'supergrader-test-result';
    (resultElement as HTMLMetaElement).content = JSON.stringify({
      success: false,
      error: (error as Error).message,
      timestamp: Date.now()
    });
    if (!resultElement.parentNode) {
      document.head.appendChild(resultElement);
    }
  }
});

/**
 * Get document for rubric extraction - handles both iframe and frameless layouts
 */
function getInnerDoc(): Document {
  const frame = document.querySelector<HTMLIFrameElement>('iframe[src*="submissions"]');
  return frame?.contentDocument ?? frame?.contentWindow?.document ?? document;
}

/**
 * Legacy function for backwards compatibility
 */
function getIframeDocument(): Document | null {
  const doc = getInnerDoc();
  return doc === document ? null : doc; // Return null if fallback to main document
}

// Types for unified rubric detection
interface RubricItem {
  id: string | number;
  description?: string;
  points?: number;
  element?: HTMLElement;
}

interface StructuredRubric {
  type: 'structured';
  items: RubricItem[];
  rubricStyle: 'CHECKBOX' | 'RADIO';
}

interface ManualRubric {
  type: 'manual';
  box: HTMLInputElement;
}

type RubricResult = StructuredRubric | ManualRubric | null;

/**
 * Unified rubric detection - handles all Gradescope layouts
 */
function getRubric(): RubricResult {
  const root = getInnerDoc();
  
  // 2-a. Try hidden React props - works on frameless pages
  const propsEl = root.querySelector('[data-react-props]');
  if (propsEl) {
    try {
      const propsAttr = propsEl.getAttribute('data-react-props');
      if (propsAttr) {
        const data = JSON.parse(atob(propsAttr));
        if (data?.rubricItems?.length) {
          const items: RubricItem[] = data.rubricItems.map((item: any) => ({
            id: item.id || item.rubric_item_id,
            description: item.description || item.text,
            points: item.points || 0
          }));
          
          // Determine style from React data or default to CHECKBOX
          const rubricStyle: 'CHECKBOX' | 'RADIO' = data.rubricStyle || 'CHECKBOX';
          
          console.log(`📝 Found ${items.length} rubric items via React props`);
          return { type: 'structured', items, rubricStyle };
        }
      }
    } catch (error) {
      console.log('📝 Failed to parse React props, falling back to DOM');
    }
  }

  // 2-b. Fallback to DOM selectors - works on iframe and legacy pages
  const domItems = Array.from(root.querySelectorAll('.rubric-item[data-rubric-item-id]')) as HTMLElement[];
  if (domItems.length) {
    const items: RubricItem[] = [];
    let hasRadio = false;
    
    domItems.forEach((element) => {
      const itemId = element.dataset.rubricItemId;
      const description = element.querySelector('.rubric-description, .description')?.textContent?.trim();
      const pointsText = element.querySelector('.points')?.textContent?.trim();
      const points = pointsText ? parseFloat(pointsText.replace(/[^\d.-]/g, '')) || 0 : 0;
      
      // Check for radio buttons
      if (element.querySelector('input[type="radio"]')) {
        hasRadio = true;
      }
      
      if (itemId) {
        items.push({
          id: itemId,
          description: description || '',
          points,
          element
        });
      }
    });
    
    const rubricStyle: 'CHECKBOX' | 'RADIO' = hasRadio ? 'RADIO' : 'CHECKBOX';
    console.log(`📝 Found ${items.length} rubric items via DOM selectors`);
    return { type: 'structured', items, rubricStyle };
  }

  // 2-c. Detect manual-scoring single box
  const scoreBox = root.querySelector<HTMLInputElement>('input[name="score"], input[type="number"][placeholder*="score" i], input[type="number"][id*="score" i]');
  if (scoreBox) {
    console.log('📝 Found manual scoring input box');
    return { type: 'manual', box: scoreBox };
  }

  // Additional fallback - look for any number input in grading context
  const numberInputs = Array.from(root.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
  const gradingInput = numberInputs.find(input => 
    input.placeholder?.toLowerCase().includes('score') ||
    input.placeholder?.toLowerCase().includes('points') ||
    input.name?.toLowerCase().includes('score') ||
    input.id?.toLowerCase().includes('score')
  );
  
  if (gradingInput) {
    console.log('📝 Found grading number input as fallback');
    return { type: 'manual', box: gradingInput };
  }

  return null; // nothing found
}

/**
 * Apply grading action - handles both structured rubrics and manual scoring
 */
function applyGrade(target: RubricResult, rubricId?: string, checked?: boolean, score?: number): boolean {
  if (!target) {
    console.error('No rubric detected');
    return false;
  }

  if (target.type === 'structured') {
    if (!rubricId) {
      console.error('Rubric ID required for structured rubric');
      return false;
    }
    
    // Find the rubric item
    const item = target.items.find(i => String(i.id) === String(rubricId));
    if (!item) {
      console.error(`Rubric item ${rubricId} not found`);
      return false;
    }
    
    // Handle React-based items (no element property)
    if (!item.element) {
      console.error('Cannot toggle React-based rubric items directly (no DOM element)');
      return false;
    }
    
    const input = item.element.querySelector<HTMLInputElement>('input[type="checkbox"], input[type="radio"]');
    if (!input) {
      console.error(`No input found for rubric item ${rubricId}`);
      return false;
    }
    
    // Only click if the current state differs from desired state
    if (checked !== undefined && input.checked !== checked) {
      console.log(`📝 ${checked ? 'Selecting' : 'Deselecting'} rubric item ${rubricId}`);
      input.click(); // This triggers Gradescope's own event handlers
      return true;
    } else if (checked === undefined) {
      // Just toggle if no specific state requested
      console.log(`📝 Toggling rubric item ${rubricId}`);
      input.click();
      return true;
    } else {
      console.log(`📝 Rubric item ${rubricId} already in desired state (${checked})`);
      return true;
    }
    
  } else if (target.type === 'manual') {
    if (typeof score === 'number') {
      console.log(`📝 Setting manual score to ${score}`);
      target.box.value = String(score);
      // Trigger change event for React/Angular listeners
      target.box.dispatchEvent(new Event('input', { bubbles: true }));
      target.box.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } else {
      console.error('Score value required for manual scoring');
      return false;
    }
  }
  
  return false;
}

/**
 * Extract rubric items using unified detection (legacy wrapper)
 */
async function getRubricFromIframe(): Promise<{
  items: Array<{ id: number; text: string; points: number }>;
  rubricStyle: "RADIO" | "CHECKBOX";
  pointsDistribution: { positive: number; negative: number; zero: number };
}> {
  return new Promise((resolve, reject) => {
    const checkRubric = () => {
      const rubricResult = getRubric();
      
      if (!rubricResult) {
        // Check if we should retry (DOM might still be loading)
        const doc = getInnerDoc();
        if (doc.readyState !== 'complete') {
          setTimeout(checkRubric, 500);
          return;
        } else {
          reject(new Error('No rubric or score box found'));
          return;
        }
      }
      
      if (rubricResult.type === 'manual') {
        reject(new Error('Manual scoring interface - no structured rubric items'));
        return;
      }
      
      // Convert to legacy format
      const items = rubricResult.items.map(item => ({
        id: typeof item.id === 'string' ? parseInt(item.id, 10) : item.id as number,
        text: item.description || '',
        points: item.points || 0
      }));
      
      // Calculate points distribution
      const pointsDistribution = items.reduce(
        (acc, item) => {
          if (item.points > 0) acc.positive++;
          else if (item.points < 0) acc.negative++;
          else acc.zero++;
          return acc;
        },
        { positive: 0, negative: 0, zero: 0 }
      );
      
      console.log(`📝 Legacy wrapper: Found ${items.length} rubric items`);
      items.forEach(item => {
        console.log(`  Item ${item.id}: "${item.text}" (${item.points} pts)`);
      });
      
      resolve({
        items,
        rubricStyle: rubricResult.rubricStyle,
        pointsDistribution
      });
    };
    
    // Start checking immediately, then retry if needed
    checkRubric();
  });
}

/**
 * Apply rubric selection (legacy wrapper for applyGrade)
 */
function applyRubricItem(itemId: number, selected: boolean): boolean {
  const rubricResult = getRubric();
  return applyGrade(rubricResult, String(itemId), selected);
}

// TESTING: Add rubric test functionality - Week 2 Day 3-4: Rubric Parsing
window.addEventListener('SUPERGRADER_TEST_RUBRIC', async (_event: Event) => {
  console.log('📝 Testing rubric parsing functionality...');
  
  try {
    // Extract IDs from current page URL
    const urlMatch = window.location.pathname.match(
      /\/courses\/(\d+)\/(assignments|questions)\/(\d+)\/submissions\/(\d+)\/grade/
    );
    
    if (!urlMatch) {
      throw new Error('Not on a valid grading page - cannot extract course/assignment IDs');
    }
    
    const [, courseId, assignmentType, assignmentId] = urlMatch;
    console.log(`📝 Extracting rubric for course ${courseId}, ${assignmentType} ${assignmentId}`);
    
    // Handle question pages with iframe-based rubric
    if (assignmentType === 'questions') {
      console.log('📝 Question page detected - extracting rubric from iframe');
      
      try {
        const rubricData = await getRubricFromIframe();
        
        if (rubricData.items.length > 0) {
          console.log('✅ Iframe rubric extraction successful!');
          console.log('Rubric items:', rubricData.items);
          
          // Build question-style rubric map
          const questionId = parseInt(assignmentId, 10);
          const rubricMap = {
            questions: {
              [questionId]: {
                name: `Question ${questionId}`,
                parentId: null,
                rubricStyle: rubricData.rubricStyle,
                items: rubricData.items
              }
            },
            itemToQuestion: {} as { [key: number]: number }
          };
          
          // Build reverse lookup
          rubricData.items.forEach(item => {
            rubricMap.itemToQuestion[item.id] = questionId;
          });
          
          console.log('📊 Question-based Rubric Summary:');
          console.log(`  - 1 question with ${rubricData.items.length} rubric items`);
          console.log(`  - Rubric style: ${rubricData.rubricStyle}`);
          console.log(`  - Points distribution:`, rubricData.pointsDistribution);
          
          // Store successful result
          const resultElement = document.getElementById('supergrader-rubric-result') || document.createElement('meta');
          resultElement.id = 'supergrader-rubric-result';
          (resultElement as HTMLMetaElement).name = 'supergrader-rubric-result';
          (resultElement as HTMLMetaElement).content = JSON.stringify({
            success: true,
            questionCount: 1,
            totalItems: rubricData.items.length,
            rubricStyle: rubricData.rubricStyle,
            pointsDistribution: rubricData.pointsDistribution,
            extractionMethod: 'iframe-dom',
            timestamp: Date.now()
          });
          if (!resultElement.parentNode) {
            document.head.appendChild(resultElement);
          }
          
          return;
        } else {
          throw new Error('No rubric items found in iframe');
        }
        
      } catch (error) {
        console.log('ℹ️ No structured rubric found in iframe - likely outline/manual scoring interface');
        
        // Store result indicating no rubric structure available
        const resultElement = document.getElementById('supergrader-rubric-result') || document.createElement('meta');
        resultElement.id = 'supergrader-rubric-result';
        (resultElement as HTMLMetaElement).name = 'supergrader-rubric-result';
        (resultElement as HTMLMetaElement).content = JSON.stringify({
          success: true,
          questionCount: 0,
          totalItems: 0,
          interfaceType: 'Question-based (Manual Scoring)',
          message: 'This is a question-based interface that uses manual scoring instead of structured rubric items.',
          extractionMethod: 'iframe-dom-failed',
          timestamp: Date.now()
        });
        if (!resultElement.parentNode) {
          document.head.appendChild(resultElement);
        }
        
        return;
      }
    }
    
    // Traditional assignment interface - check outer DOM first
    const rubricItems = document.querySelectorAll('.rubric-item[data-rubric-item-id]');
    const scoreInputs = document.querySelectorAll('input[type="number"]');
    const textAreas = document.querySelectorAll('textarea');
    
    console.log('📝 Traditional interface analysis:', {
      rubricItems: rubricItems.length + ' rubric items',
      scoreInputs: scoreInputs.length + ' score inputs', 
      textAreas: textAreas.length + ' text areas',
      type: assignmentType,
      hasTraditionalRubric: rubricItems.length > 0
    });
    
    if (rubricItems.length === 0) {
      console.log('ℹ️ This is an assignment interface without traditional rubric items');
      
      // Store result indicating no rubric structure available  
      const resultElement = document.getElementById('supergrader-rubric-result') || document.createElement('meta');
      resultElement.id = 'supergrader-rubric-result';
      (resultElement as HTMLMetaElement).name = 'supergrader-rubric-result';
      (resultElement as HTMLMetaElement).content = JSON.stringify({
        success: true,
        questionCount: 0,
        totalItems: 0,
        interfaceType: 'Assignment (Manual Scoring)',
        message: 'This is an assignment interface that uses manual scoring instead of structured rubric items.',
        extractionMethod: 'outer-dom-failed',
        timestamp: Date.now()
      });
      if (!resultElement.parentNode) {
        document.head.appendChild(resultElement);
      }
      
      return; // Exit early - no rubric data to fetch
    }
    
    // Direct rubric retrieval - avoid timing issues with supergrader helper
    try {
      // Dynamic import to avoid module loading issues
      const rubricModule = await import(chrome.runtime.getURL('gradescope/rubric.js'));
      const rubricMap = await rubricModule.fetchRubricMap(parseInt(courseId, 10), parseInt(assignmentId, 10));
      
      console.log('✅ Rubric parsing successful!');
      console.log('Questions:', rubricMap.questions);
      console.log('Item to Question mapping:', rubricMap.itemToQuestion);
      
      // Calculate summary statistics
      const questionCount = Object.keys(rubricMap.questions).length;
      const totalItems = Object.keys(rubricMap.itemToQuestion).length;
      
      let parentChildRelationships = 0;
      let checkboxQuestions = 0;
      let radioQuestions = 0;
      let positivePoints = 0;
      let negativePoints = 0;
      let zeroPoints = 0;
      
      // Log each question's details
      Object.entries(rubricMap.questions).forEach(([qId, qData]: [string, any]) => {
        console.log(`Question ${qId}: "${qData.name}" (${qData.rubricStyle}, parent: ${qData.parentId || 'none'})`);
        qData.items.forEach((item: any) => {
          console.log(`  Item ${item.id}: "${item.text}" (${item.points} pts)`);
        });
        
        // Count statistics
        if (qData.parentId !== null) {
          parentChildRelationships++;
        }
        
        if (qData.rubricStyle === 'CHECKBOX') {
          checkboxQuestions++;
        } else if (qData.rubricStyle === 'RADIO') {
          radioQuestions++;
        }
        
        qData.items.forEach((item: any) => {
          if (item.points > 0) positivePoints++;
          else if (item.points < 0) negativePoints++;
          else zeroPoints++;
        });
      });
      
      console.log('📊 Rubric Summary:');
      console.log(`  - ${questionCount} total questions`);
      console.log(`  - ${totalItems} total rubric items`);
      console.log(`  - ${parentChildRelationships} parent-child relationships`);
      console.log(`  - ${checkboxQuestions} checkbox questions, ${radioQuestions} radio questions`);
      console.log(`  - Points: ${positivePoints} positive, ${negativePoints} negative, ${zeroPoints} zero`);
      
      // Store successful result in DOM
      const resultElement = document.getElementById('supergrader-rubric-result') || document.createElement('meta');
      resultElement.id = 'supergrader-rubric-result';
      (resultElement as HTMLMetaElement).name = 'supergrader-rubric-result';
      (resultElement as HTMLMetaElement).content = JSON.stringify({
        success: true,
        questionCount,
        totalItems,
        parentChildRelationships,
        checkboxQuestions,
        radioQuestions,
        pointsDistribution: { positive: positivePoints, negative: negativePoints, zero: zeroPoints },
        timestamp: Date.now()
      });
      if (!resultElement.parentNode) {
        document.head.appendChild(resultElement);
      }
      
    } catch (rubricError) {
      throw new Error(`Rubric retrieval failed: ${(rubricError as Error).message}`);
    }
    
  } catch (error) {
    console.error('❌ Rubric parsing failed:', error);
    
    // Store error in DOM
    const resultElement = document.getElementById('supergrader-rubric-result') || document.createElement('meta');
    resultElement.id = 'supergrader-rubric-result';
    (resultElement as HTMLMetaElement).name = 'supergrader-rubric-result';
    (resultElement as HTMLMetaElement).content = JSON.stringify({
      success: false,
      error: (error as Error).message,
      timestamp: Date.now()
    });
    if (!resultElement.parentNode) {
      document.head.appendChild(resultElement);
    }
  }
});

// CSP-safe: Store auth status in DOM data attribute for console access
function updateAuthStatusInDOM(): void {
  const authStatus = (window as any).GradescopeAPI?.getAuthStatus?.();
  if (authStatus && document.body) {
    // Store in a hidden meta element that console can access
    let statusElement = document.getElementById('supergrader-auth-status') as HTMLMetaElement;
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
const originalInitialize = (window as any).GradescopeAPI.initialize;
(window as any).GradescopeAPI.initialize = async function() {
  const result = await originalInitialize.call(this);
  updateAuthStatusInDOM();
  return result;
}; 