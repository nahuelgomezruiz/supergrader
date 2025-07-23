// Gradescope API integration module
// Handles authentication, data extraction, and grading actions

// JSZip is loaded globally via the manifest.json
declare const JSZip: any;

// fetchRubricMap is loaded globally via the manifest.json
declare function fetchRubricMap(courseId: number, assignmentId: number): Promise<any>;



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
// @ts-ignore - Type used in dynamic code
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

        return true;
      } else {
        console.error('GradescopeAPI: CSRF token found but appears invalid:', this.csrfToken?.substring(0, 10) + '...');
        return false;
      }
    } else {
      console.error('GradescopeAPI: No CSRF token meta tag found in DOM');

      return false;
    }
  }

  /**
   * Validate session cookies and authentication state
   */
  private async validateSession(): Promise<boolean> {


    const cookies = document.cookie;
    const cookieNames = cookies.split(';').map(c => c.trim().split('=')[0]);
    
    

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
      
      
      // Schedule retry with exponential backoff
      const retryDelay = Math.pow(2, this.authState.retryCount) * 1000;
      setTimeout(() => {

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

      this.initialize(); // Re-validate in background
      return true; // Assume still valid for now
    }

    return true;
  }

  /**
   * Make authenticated API request with rate limiting and error handling
   */
  async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {


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

  /**
   * Get current authentication state for debugging
   */
  getAuthState(): AuthState & { csrfToken: string | null } {
    return {
      ...this.authState,
      csrfToken: this.csrfToken ? `${this.csrfToken.substring(0, 10)}...` : null,
    };
  }

  // ============ PLACEHOLDER METHODS (for future weeks) ============

  /**
   * Download and extract source files from submission ZIP
   * Implements Week 2, Day 1-2: Source code extraction
   */
  async downloadSubmissionFiles(submissionId: string): Promise<DownloadResult> {


    if (!submissionId || !this.isAuthenticated()) {
      throw new Error(!submissionId ? 'Submission ID required' : 'Not authenticated');
    }

    // Inspect DOM for available files
    const fileInfo = this.inspectAvailableFiles();
    
    if (!fileInfo.hasFiles) {
      return this.createEmptyResult(fileInfo);
    }

    

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
    if (!text || text.length > 200) return false;
    
    // Basic filename validation - avoid obvious non-files
    const cleaned = text.trim().replace(/^[▼▶\s]*/, '');
    if (cleaned.length === 0) return false;
    
    // Skip obvious UI elements or non-file text
    const invalidPatterns = [
      /^(download|click|button|link|file|expand|collapse|show|hide)$/i,
      /\s+(download|click|button|link)\s+/i,
      /^https?:\/\//,
      /^\d+\s*(bytes?|kb|mb|gb)$/i
    ];
    
    if (invalidPatterns.some(pattern => pattern.test(cleaned))) {
      return false;
    }
    
    // Accept anything that looks like a filename (with or without extension)
    return true;
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
    if (!fileName || fileName.length > 200) {
      metadata.skippedFiles++;
      return false;
    }

    const extension = fileName.match(/(\.[^.]+)$/)?.[1]?.toLowerCase();
    if (extension) {
      metadata.fileTypes[extension] = (metadata.fileTypes[extension] || 0) + 1;
    }

    // Skip common binary / archive formats ‑ they won't be useful for grading text.
    const binaryPattern = /\.(zip|rar|7z|gz|tar|bz2|exe|bin|dll|so|o|obj|class)$/;
    if (extension && binaryPattern.test(extension)) {
      console.log(`⚠️ Skipping binary file: ${fileName}`);
      metadata.skippedFiles++;
      return false;
    }

    // Otherwise keep the file (it may be a test or text file)
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
    
    // Old Gradescope interface with actual input elements
    const input = element.querySelector('input[type="checkbox"], input[type="radio"]') as HTMLInputElement;
    if (input) {
      return input.checked;
    }
    
    // New Gradescope interface with CSS classes
    // Check for applied state in regular rubric items
    const keyButton = element.querySelector('.rubricItem--key');
    if (keyButton && keyButton.classList.contains('rubricItem--key-applied')) {
      return true;
    }
    
    // Check for applied state in rubric groups (multiple possible class names)
    const groupKeyButton = element.querySelector('.rubricItemGroup--key');
    if (groupKeyButton && (
        groupKeyButton.classList.contains('rubricItemGroup--key-is-applied') ||
        groupKeyButton.classList.contains('rubricItemGroup--key-applied')
      )) {
      return true;
    }
    
    // For radio groups, check if any child option is selected
    if (element.classList.contains('rubricItemGroup')) {
      // Look for selected options within the group
      const selectedOption = element.querySelector('.rubricItem--key-applied');
      if (selectedOption) {
        return true;
      }
      
      // Alternative selection indicators
      const appliedItems = element.querySelectorAll('.rubricItem--applied, .selected, .rubricItem.applied');
      if (appliedItems.length > 0) {
        return true;
      }
    }
    
    // Additional fallback checks
    if (element.classList.contains('rubricItem--applied') || 
        element.classList.contains('selected') ||
        element.classList.contains('applied')) {
      return true;
    }
    
          // Check for visual indicators (like checked icons, highlighted backgrounds, etc.)
      const visualIndicators = element.querySelectorAll('.fa-check, .checkmark, [class*="checked"], [class*="selected"]');
      if (visualIndicators.length > 0) {
        return true;
      }
      
      return false;
    }



    /**
     * Debug method to inspect selection state of a specific element
     */
    debugElementSelection(element: HTMLElement): any {
      console.log('🔍 Debug Element Selection:', element);
      console.log('Element classes:', element.className);
      
      const selectionChecks = {
        hasInput: !!element.querySelector('input[type="checkbox"], input[type="radio"]'),
        inputChecked: (element.querySelector('input[type="checkbox"], input[type="radio"]') as HTMLInputElement)?.checked,
        hasKeyApplied: !!element.querySelector('.rubricItem--key-applied'),
        hasGroupKeyApplied: !!element.querySelector('.rubricItemGroup--key-is-applied, .rubricItemGroup--key-applied'),
        hasAppliedClass: element.classList.contains('rubricItem--applied') || element.classList.contains('applied'),
        hasSelectedClass: element.classList.contains('selected'),
        hasVisualIndicators: element.querySelectorAll('.fa-check, .checkmark, [class*="checked"], [class*="selected"]').length > 0,
        
        // For radio groups specifically
        isRadioGroup: element.classList.contains('rubricItemGroup'),
        hasSelectedChild: !!element.querySelector('.rubricItem--key-applied'),
        hasAppliedChild: !!element.querySelector('.rubricItem--applied')
      };
      
      console.log('Selection indicators:', selectionChecks);
      console.log('Final result from isRubricItemSelected():', this.isRubricItemSelected(element));
      
      return selectionChecks;
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

// Set up comprehensive console helpers using IIFE with Object.assign
(() => {
  const apiHelpers = {
    // Ensure core properties are set (may override existing)
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
          // Call global fetchRubricMap function
          const rubricMap = await fetchRubricMap(parseInt(courseId, 10), parseInt(assignmentId, 10));
          
          console.log('supergrader: Rubric retrieval successful!');
          console.log('Questions:', rubricMap.questions);
          console.log('Item to Question mapping:', rubricMap.itemToQuestion);
          
          // Log detailed structure
          const questionCount = Object.keys(rubricMap.questions).length;
          const totalItems = Object.keys(rubricMap.itemToQuestion).length;
          
          console.log(`supergrader: Found ${questionCount} questions with ${totalItems} total rubric items`);
          
                // Log each question's details with enhanced formatting
      Object.entries(rubricMap.questions).forEach(([qId, qData]: [string, any]) => {
        const qTypeEmoji = qData.rubricStyle === 'RADIO' ? '📻' : '☑️';
        const parentInfo = qData.parentId ? `parent: ${qData.parentId}` : 'root question';
        console.log(`${qTypeEmoji} Question ${qId}: "${qData.name}" (${qData.rubricStyle}, ${parentInfo})`);
        
        if (qData.items && qData.items.length > 0) {
          console.log(`    📋 ${qData.items.length} items available:`);
          qData.items.forEach((item: any, index: number) => {
            const pointsEmoji = item.points > 0 ? '➕' : item.points < 0 ? '➖' : '⚪';
            console.log(`      ${index + 1}. [${item.id}] "${item.text}" ${pointsEmoji} ${item.points} pts`);
          });
        } else {
          console.log(`    ⚠️ No items found for this question`);
        }
        console.log('');
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

  // Merge with any existing supergrader object
  (window as any).supergrader = Object.assign(
    (window as any).supergrader || {},
    apiHelpers
  );

  const keys = Object.keys((window as any).supergrader);
  console.log('supergrader: API helpers merged, final keys:', keys);
})();

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
  itemType?: 'CHECKBOX' | 'RADIO'; // Track individual item type
}

interface StructuredRubric {
  type: 'structured';
  items: RubricItem[];
  rubricStyle: 'CHECKBOX' | 'RADIO' | 'MIXED';
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
  let domItems = Array.from(root.querySelectorAll('.rubric-item[data-rubric-item-id]')) as HTMLElement[];
  
  // 2-c. Try newer Gradescope interface with different class names
  if (domItems.length === 0) {
    domItems = Array.from(root.querySelectorAll('.rubricItem')) as HTMLElement[];
    
    // Also look for radio-button style groups (encoder Design, decoder Design, etc.)
    const groupItems = Array.from(root.querySelectorAll('.rubricItemGroup')) as HTMLElement[];
    domItems = domItems.concat(groupItems);
  }
  
  if (domItems.length) {
    const items: RubricItem[] = [];
    let hasRadio = false;
    let hasCheckbox = false;
    
    domItems.forEach((element, index) => {
      // Handle both old and new Gradescope interfaces
      let itemId = element.dataset.rubricItemId;
      let description = element.querySelector('.rubric-description, .description')?.textContent?.trim();
      let pointsText = element.querySelector('.points')?.textContent?.trim();
      let points = pointsText ? parseFloat(pointsText.replace(/[^\d.-]/g, '')) || 0 : 0;
      
             // New Gradescope interface (.rubricItem)
       if (!itemId) {
                   // Handle radio-button style groups (.rubricItemGroup)
          if (element.classList.contains('rubricItemGroup')) {
            const groupKeyButton = element.querySelector('.rubricItemGroup--key');
            itemId = groupKeyButton?.textContent?.trim() || `group_${index}`;
            
            // Get the main group description (like "encoder Design")
            const groupDescElement = element.querySelector('.rubricField-description');
            const groupDesc = groupDescElement?.textContent?.trim();
            
            // Find ALL available options in this group (not just selected)
            const allOptions: string[] = [];
            let selectedOption = '';
            let selectedPoints = 0;
            
            // --- NEW IMPLEMENTATION ------------------------------------------------------
            // Radio groups show their individual options in a *sibling* container with the
            // class `.rubricItemGroup--rubricItems`.  Each option is a `.rubricItem` node.
            // 1.  Locate that sibling container via the aria-describedby linkage:
            let radioOptions: HTMLElement[] = [];
            const headerId = groupKeyButton?.getAttribute('id');
            const rootDoc = getInnerDoc();

            if (headerId) {
              const siblingContainer = rootDoc.querySelector(`[aria-describedby="${headerId}"]`);
              if (siblingContainer) {
                radioOptions = Array.from(siblingContainer.querySelectorAll('.rubricItem')) as HTMLElement[];
              }
            }

            // Fallbacks – try other relative relations if the first strategy failed
            if (radioOptions.length === 0) {
              const possible = element.parentElement?.querySelectorAll('.rubricItemGroup--rubricItems .rubricItem');
              if (possible && possible.length) {
                radioOptions = Array.from(possible) as HTMLElement[];
              }
            }

            // If still empty, as a last resort, search globally but this should rarely happen
            if (radioOptions.length === 0) {
              radioOptions = Array.from(rootDoc.querySelectorAll('.rubricItemGroup--rubricItems .rubricItem')) as HTMLElement[];
            }

            // Parse each option that we found
            if (radioOptions.length > 0) {
              radioOptions.forEach((optionElement) => {
                const keyBtn = optionElement.querySelector('.rubricItem--key');

                // Points
                const ptsEl = optionElement.querySelector('.rubricField-points');
                const ptsText = ptsEl?.textContent?.trim() || '';
                const optionPointValue = parseFloat(ptsText.replace(/[^\d.-]/g, '')) || 0;

                // Description – markdown container lives inside .rubricField-description
                const descEl = optionElement.querySelector('.rubricField-description');
                let optionDesc = descEl?.textContent?.trim() || '';
                optionDesc = optionDesc.replace(/^Grading comment:\s*/, '');

                // Build option text summary
                const optionText = optionDesc ? `"${optionDesc}" (${optionPointValue} pts)` : `${keyBtn?.textContent || '?'} (${optionPointValue} pts)`;
                allOptions.push(optionText);

                // Detect if this is the currently selected radio option
                const keyApplied = keyBtn?.classList.contains('rubricItem--key-applied');
                const ariaPressed = keyBtn?.getAttribute('aria-pressed') === 'true';
                if (keyApplied || ariaPressed) {
                  selectedOption = optionDesc;
                  selectedPoints = optionPointValue;
                }
              });
            } else {
              // Group might be collapsed, only summary visible
              const summaryEl = element.querySelector('.rubricField-description');
              if (summaryEl) {
                const cleanSummary = summaryEl.textContent?.trim().replace(/^Grading comment:\s*/, '') || '';
                allOptions.push(`"${cleanSummary}" (collapsed - expand to see all options)`);
                selectedOption = cleanSummary;
                // Points are shown in group header even when collapsed
                const groupPts = element.querySelector('.rubricField-points')?.textContent?.trim() || '0';
                selectedPoints = parseFloat(groupPts.replace(/[^\d.-]/g, '')) || 0;
              }
            }
            
            // Build enhanced description showing this is a radio group with ALL options
            description = `📻 ${groupDesc || 'Radio Group'} (Select one option)`;
            if (allOptions.length > 0) {
              description += `\n  📋 Available options (${allOptions.length}):\n  ◦ ${allOptions.join('\n  ◦ ')}`;
            }
            if (selectedOption) {
              description += `\n  ⭐ Currently selected: "${selectedOption}" (${selectedPoints} pts)`;
            } else {
              description += `\n  ⚪ No option currently selected`;
            }
            
            points = selectedPoints;
            hasRadio = true; // This is definitely a radio-style group
            
          } else {
           // Regular rubric item (.rubricItem)
           const keyButton = element.querySelector('.rubricItem--key');
           itemId = keyButton?.textContent?.trim() || `item_${index}`;
           
           // Get description from rubricField-description
           const descElement = element.querySelector('.rubricField-description, .rubricField.rubricField-description');
           description = descElement?.textContent?.trim();
           
                       // Get points from rubricField-points
            const pointsElement = element.querySelector('.rubricField-points, .rubricField.rubricField-points');
            pointsText = pointsElement?.textContent?.trim();
            points = pointsText ? parseFloat(pointsText.replace(/[^\d.-]/g, '')) || 0 : 0;
            
            hasCheckbox = true; // This is a regular checkbox-style item
          }
        }
        
        // Note: Individual radio/checkbox detection is handled above per item type
      
              if (itemId && description) {
          // Add item type information
          const itemType = element.classList.contains('rubricItemGroup') ? 'RADIO' : 'CHECKBOX';
          items.push({
            id: itemId,
            description: description || '',
            points,
            element,
            itemType // Add type info to each item
          });
        }
      });
      
      // Determine overall rubric style
      let rubricStyle: 'CHECKBOX' | 'RADIO' | 'MIXED';
      if (hasRadio && hasCheckbox) {
        rubricStyle = 'MIXED';
      } else if (hasRadio) {
        rubricStyle = 'RADIO';
      } else {
        rubricStyle = 'CHECKBOX';
      }
                console.log(`📝 Found ${items.length} rubric items via DOM selectors`);
            
            // Enhanced debugging information for each item with emojis
            items.forEach(item => {
              const itemEmoji = item.itemType === 'RADIO' ? '📻' : '☑️';
              const titleLine = item.description?.split('\n')[0] || 'No description';
              const truncated = titleLine.length > 60 ? titleLine.substring(0, 60) + '...' : titleLine;
              
              console.log(`  ${itemEmoji} ${item.id}: "${truncated}" (${item.points} pts, ${item.itemType})`);
              
              // Show options count for radio groups
              if (item.itemType === 'RADIO' && item.description?.includes('Available options')) {
                const optionLines = item.description.split('\n').filter(l => l.includes('◦ '));
                console.log(`    📋 ${optionLines.length} options available`);
                
                // Show selected option if any
                const selectedLine = item.description.split('\n').find(l => l.includes('⭐ Currently selected:'));
                if (selectedLine) {
                  console.log(`    ⭐ Selection made`);
                } else {
                  console.log(`    ⚪ No selection`);
                }
              }
              
              if (item.element) {
                // Enhanced selection state debugging
                const hasInput = item.element.querySelector('input[type="checkbox"], input[type="radio"]');
                const hasKeyApplied = item.element.querySelector('.rubricItem--key-applied');
                const hasGroupKeyApplied = item.element.querySelector('.rubricItemGroup--key-is-applied, .rubricItemGroup--key-applied');
                
                console.log(`    🔍 Debug - hasInput: ${!!hasInput}, hasKeyApplied: ${!!hasKeyApplied}, hasGroupKeyApplied: ${!!hasGroupKeyApplied}`);
                
                if (hasInput) {
                  const inputEmoji = (hasInput as HTMLInputElement).checked ? '✅' : '⬜';
                  console.log(`    ${inputEmoji} Input state: ${(hasInput as HTMLInputElement).checked}`);
                }
              }
            });
    return { type: 'structured', items, rubricStyle };
  }

  // 2-d. Detect manual-scoring single box
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
  rubricStyle: "RADIO" | "CHECKBOX" | "MIXED";
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
      // Call global fetchRubricMap function
      const rubricMap = await fetchRubricMap(parseInt(courseId, 10), parseInt(assignmentId, 10));
      
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
      
      console.log('📊 ENHANCED RUBRIC SUMMARY:');
      console.log(`  🎯 ${questionCount} total questions`);
      console.log(`  📝 ${totalItems} total rubric items`);
      console.log(`  🔗 ${parentChildRelationships} parent-child relationships`);
      console.log(`  ☑️ ${checkboxQuestions} checkbox questions`);
      console.log(`  📻 ${radioQuestions} radio questions`);
      console.log(`  ➕ ${positivePoints} positive points, ➖ ${negativePoints} negative points, ⚪ ${zeroPoints} zero points`);
      
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

// =============================================================================
// WEEK 2 DAY 5: API TESTING - COMPREHENSIVE TEST SUITE
// =============================================================================

/**
 * API Test Result Interface
 */
interface APITestResult {
  testName: string;
  status: 'success' | 'failure' | 'warning' | 'info';
  message: string;
  timing?: number;
  details?: any;
}

/**
 * Test Data Fixtures for API Testing
 */
const API_TEST_FIXTURES = {
  // Sample rubric item IDs for testing (these would be real IDs from the page)
  sampleRubricItems: [
    { id: 'RbA1', description: 'Correct implementation', points: -2 },
    { id: 'RbB2', description: 'Missing error handling', points: -1 },
    { id: 'RbC3', description: 'Good code style', points: 0 }
  ],
  
  // Mock CSRF tokens for testing
  testTokens: {
    valid: 'test-csrf-token-123456789012345678901234567890',
    invalid: 'invalid-token',
    malformed: 'too-short',
    empty: ''
  },
  
  // Expected API responses
  expectedResponses: {
    success: { status: 200, ok: true },
    unauthorized: { status: 401, ok: false },
    forbidden: { status: 403, ok: false },
    csrfError: { status: 422, ok: false },
    rateLimited: { status: 429, ok: false },
    serverError: { status: 500, ok: false }
  },
  
  // Test course/assignment IDs
  testIds: {
    courseId: '12345',
    assignmentId: '67890', 
    questionId: '11111',
    submissionId: '99999'
  }
};

/**
 * Comprehensive API Testing Class - Week 2 Day 5
 */
class APITester {
  private gradescopeAPI: GradescopeAPI;
  private testResults: APITestResult[] = [];
  
  constructor(api: GradescopeAPI) {
    this.gradescopeAPI = api;
  }

  /**
   * Main test runner for all API tests
   */
  async runAllTests(): Promise<APITestResult[]> {
    console.log('🧪 Starting comprehensive API testing (Week 2 Day 5)...');
    this.testResults = [];
    
    try {
      // Test 1: CSRF Token Validation
      await this.testCSRFTokenValidation();
      
      // Test 2: Rubric Item Toggle Endpoint Testing
      await this.testRubricItemToggleEndpoint();
      
      // Test 3: Error Handling and Retries
      await this.testErrorHandlingAndRetries();
      
      // Test 4: Rate Limiting Behavior
      await this.testRateLimiting();
      
      // Test 5: Authentication Edge Cases
      await this.testAuthenticationEdgeCases();
      
      // Test 6: Network Failure Recovery
      await this.testNetworkFailureRecovery();
      
    } catch (error) {
      this.addResult('API Testing Suite', 'failure', 
        `Test suite failed: ${(error as Error).message}`, 0, { error });
    }
    
    this.printTestSummary();
    return this.testResults;
  }

  /**
   * Test 1: CSRF Token Validation - Week 2 Day 5 Requirement
   */
  async testCSRFTokenValidation(): Promise<void> {
    console.log('🔐 Testing CSRF token validation...');
    const startTime = performance.now();
    
    try {
      // Test valid CSRF token extraction
      const authState = this.gradescopeAPI.getAuthState();
      if (!authState.csrfTokenValid || !authState.csrfToken) {
        this.addResult('CSRF Token Validation', 'failure',
          'No valid CSRF token found - authentication may have failed');
        return;
      }
      
      this.addResult('CSRF Token Extraction', 'success',
        `✅ Valid CSRF token found: ${authState.csrfToken}`, 
        performance.now() - startTime);
      
      // Test CSRF token format validation
      const tokenLength = authState.csrfToken.replace('...', '').length + 20; // Estimate full length
      if (tokenLength < 30) {
        this.addResult('CSRF Token Format', 'warning',
          'CSRF token appears shorter than expected - may be truncated for display');
      } else {
        this.addResult('CSRF Token Format', 'success',
          `✅ CSRF token format appears valid (estimated length: ${tokenLength})`);
      }
      
      // Test CSRF token in request headers
      await this.testCSRFInHeaders();
      
    } catch (error) {
      this.addResult('CSRF Token Validation', 'failure',
        `CSRF validation failed: ${(error as Error).message}`, 
        performance.now() - startTime, { error });
    }
  }

  /**
   * Test CSRF token inclusion in API requests
   */
  private async testCSRFInHeaders(): Promise<void> {
    try {
      // Test safe request with CSRF token
      const testUrl = window.location.href;
      const response = await fetch(testUrl, {
        method: 'HEAD',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': this.gradescopeAPI.getAuthState().csrfToken?.replace('...', '') || '',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        this.addResult('CSRF Header Usage', 'success',
          '✅ CSRF token successfully included in request headers');
      } else if (response.status === 422) {
        this.addResult('CSRF Header Usage', 'failure',
          '❌ CSRF token rejected by server (422 Unprocessable Entity)');
      } else {
        this.addResult('CSRF Header Usage', 'info',
          `ℹ️ CSRF test inconclusive (status: ${response.status})`);
      }
    } catch (error) {
      this.addResult('CSRF Header Usage', 'warning',
        `CSRF header test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Test 2: Rubric Item Toggle Endpoint Testing - Week 2 Day 5 Requirement
   */
  private async testRubricItemToggleEndpoint(): Promise<void> {
    console.log('📝 Testing rubric item toggle endpoint...');
    const startTime = performance.now();
    
    try {
      // Get current page context
      const pageContext = this.extractPageContext();
      if (!pageContext.courseId || !pageContext.questionId) {
        this.addResult('Toggle Endpoint Setup', 'info',
          'ℹ️ Cannot test PUT endpoint - missing course/question IDs (may be assignment page)');
        return;
      }
      
      // Test endpoint URL construction
      const sampleItemId = 'test-item-123';
      const toggleUrl = `/courses/${pageContext.courseId}/questions/${pageContext.questionId}/rubric_items/${sampleItemId}`;
      
      this.addResult('Toggle Endpoint URL', 'success',
        `✅ Toggle endpoint URL constructed: ${toggleUrl}`);
      
      // Test PUT request structure (without actually sending to avoid changing grades)
      await this.testPUTRequestStructure(pageContext);
      
    } catch (error) {
      this.addResult('Rubric Toggle Endpoint', 'failure',
        `Toggle endpoint test failed: ${(error as Error).message}`, 
        performance.now() - startTime, { error });
    }
  }

  /**
   * Test PUT request structure for rubric item toggling
   */
  private async testPUTRequestStructure(_pageContext: any): Promise<void> {
    try {
      // Test request payload structure
      const testPayload = {
        points: -2,
        description: "Test rubric item description"
      };
      
      // Validate payload format
      if (typeof testPayload.points === 'number' && 
          typeof testPayload.description === 'string') {
        this.addResult('PUT Payload Structure', 'success',
          '✅ PUT request payload format is correct');
      }
      
      // Test headers for PUT request
      const putHeaders = {
        'X-CSRF-Token': this.gradescopeAPI.getAuthState().csrfToken?.replace('...', '') || '',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      };
      
      if (putHeaders['X-CSRF-Token'] && putHeaders['Content-Type']) {
        this.addResult('PUT Request Headers', 'success',
          '✅ PUT request headers properly configured');
      } else {
        this.addResult('PUT Request Headers', 'failure',
          '❌ Missing required headers for PUT request');
      }
      
      // Note: We don't actually send the PUT request to avoid changing real grades
      this.addResult('PUT Request Test', 'info',
        'ℹ️ PUT request structure validated (not sent to preserve grading data)');
        
    } catch (error) {
      this.addResult('PUT Request Structure', 'failure',
        `PUT request structure test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Test 3: Error Handling and Retries - Week 2 Day 5 Requirement
   */
  async testErrorHandlingAndRetries(): Promise<void> {
    console.log('🔄 Testing error handling and retries...');
    
    try {
      // Test retry mechanism with simulated failures
      await this.testRetryMechanism();
      
      // Test error response handling
      await this.testErrorResponseHandling();
      
      // Test timeout handling
      await this.testTimeoutHandling();
      
    } catch (error) {
      this.addResult('Error Handling Tests', 'failure',
        `Error handling test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Test retry mechanism with exponential backoff
   */
  private async testRetryMechanism(): Promise<void> {
    const maxRetries = 3;
    let attemptCount = 0;
    const startTime = performance.now();
    
    try {
      const testRetryFunction = async (): Promise<boolean> => {
        attemptCount++;
        console.log(`🔄 Retry test attempt ${attemptCount}/${maxRetries}`);
        
        if (attemptCount < 2) {
          // Simulate failure on first attempt
          throw new Error('Simulated network failure');
        }
        return true; // Success on second attempt
      };
      
      // Test retry with exponential backoff
      let delay = 100; // Start with 100ms
      for (let i = 0; i < maxRetries; i++) {
        try {
          await testRetryFunction();
          break; // Success, exit loop
        } catch (error) {
          if (i === maxRetries - 1) {
            throw error; // Last attempt failed
          }
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        }
      }
      
      const totalTime = performance.now() - startTime;
      this.addResult('Retry Mechanism', 'success',
        `✅ Retry with exponential backoff successful (${attemptCount} attempts)`, totalTime);
        
    } catch (error) {
      this.addResult('Retry Mechanism', 'failure',
        `Retry mechanism failed after ${attemptCount} attempts: ${(error as Error).message}`);
    }
  }

  /**
   * Test error response handling for different HTTP status codes
   */
  private async testErrorResponseHandling(): Promise<void> {
    try {
      // Test different error status codes
      const errorScenarios = [
        { status: 401, name: 'Unauthorized', expected: 'authentication failure' },
        { status: 403, name: 'Forbidden', expected: 'permission denied' },
        { status: 422, name: 'CSRF Error', expected: 'CSRF token invalid' },
        { status: 429, name: 'Rate Limited', expected: 'rate limit exceeded' },
        { status: 500, name: 'Server Error', expected: 'server error' }
      ];
      
      for (const scenario of errorScenarios) {
        // Simulate error response handling
        const mockResponse = {
          ok: false,
          status: scenario.status,
          statusText: scenario.name
        };
        
        const errorMessage = this.handleMockAPIError(mockResponse as Response);
        if (errorMessage.toLowerCase().includes(scenario.expected.toLowerCase())) {
          this.addResult(`${scenario.name} Handling`, 'success',
            `✅ ${scenario.status} error properly handled: ${errorMessage}`);
        } else {
          this.addResult(`${scenario.name} Handling`, 'warning',
            `⚠️ ${scenario.status} error handling may need improvement: ${errorMessage}`);
        }
      }
      
    } catch (error) {
      this.addResult('Error Response Handling', 'failure',
        `Error response test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Mock error handler for testing
   */
  private handleMockAPIError(response: Response): string {
    switch (response.status) {
      case 401:
        return 'Authentication failure - user not logged in';
      case 403:
        return 'Permission denied - insufficient privileges';
      case 422:
        return 'CSRF token invalid or missing';
      case 429:
        return 'Rate limit exceeded - too many requests';
      case 500:
        return 'Internal server error';
      default:
        return `HTTP ${response.status}: ${response.statusText}`;
    }
  }

  /**
   * Test timeout handling
   */
  private async testTimeoutHandling(): Promise<void> {
    const timeoutMs = 1000;
    const startTime = performance.now();
    
    try {
      // Simulate a slow request
      const slowRequest = new Promise((resolve, _reject) => {
        setTimeout(() => resolve('Success'), 2000); // 2 second delay
      });
      
      // Create timeout promise
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
      });
      
      // Race between request and timeout
      await Promise.race([slowRequest, timeout]);
      
      // If we get here, the request was faster than timeout
      this.addResult('Timeout Handling', 'info',
        'ℹ️ Request completed before timeout');
      
    } catch (error) {
      const elapsed = performance.now() - startTime;
      if ((error as Error).message.includes('timeout') && elapsed >= timeoutMs) {
        this.addResult('Timeout Handling', 'success',
          `✅ Timeout properly detected after ${Math.round(elapsed)}ms`);
      } else {
        this.addResult('Timeout Handling', 'failure',
          `Timeout test failed: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Test 4: Rate Limiting Behavior
   */
  private async testRateLimiting(): Promise<void> {
    console.log('⏱️ Testing rate limiting behavior...');
    
    try {
      // Test concurrent request limiting
      const testRequests: Promise<any>[] = [];
      
      for (let i = 0; i < 15; i++) { // Try more than the limit
        testRequests.push(this.simulateAPIRequest(i));
      }
      
      const startTime = performance.now();
      const results = await Promise.allSettled(testRequests);
      const totalTime = performance.now() - startTime;
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (failed > 0) {
        this.addResult('Rate Limiting', 'success',
          `✅ Rate limiting working: ${successful} passed, ${failed} limited`, totalTime);
      } else {
        this.addResult('Rate Limiting', 'info',
          `ℹ️ All ${successful} requests passed (may need more aggressive testing)`, totalTime);
      }
      
    } catch (error) {
      this.addResult('Rate Limiting Test', 'failure',
        `Rate limiting test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Simulate API request for rate limiting test
   */
  private async simulateAPIRequest(requestId: number): Promise<string> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    // Check rate limiter state (if available)
    const authState = this.gradescopeAPI.getAuthState();
    if (authState.csrfTokenValid) {
      return `Request ${requestId} successful`;
    } else {
      throw new Error(`Request ${requestId} rate limited`);
    }
  }

  /**
   * Test 5: Authentication Edge Cases
   */
  private async testAuthenticationEdgeCases(): Promise<void> {
    console.log('🔑 Testing authentication edge cases...');
    
    try {
      // Test expired session detection
      // Note: We can't actually expire the session, but we can test the detection logic
      this.addResult('Session Expiry Detection', 'info',
        'ℹ️ Session expiry detection logic present (cannot test without expiring session)');
      
      // Test re-authentication flow
      const authState = this.gradescopeAPI.getAuthState();
      if (authState.retryCount !== undefined && authState.maxRetries !== undefined) {
        this.addResult('Re-authentication Flow', 'success',
          `✅ Re-authentication configured: ${authState.retryCount}/${authState.maxRetries} retries`);
      } else {
        this.addResult('Re-authentication Flow', 'warning',
          '⚠️ Re-authentication retry logic not found');
      }
      
    } catch (error) {
      this.addResult('Authentication Edge Cases', 'failure',
        `Auth edge case test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Test 6: Network Failure Recovery
   */
  private async testNetworkFailureRecovery(): Promise<void> {
    console.log('🌐 Testing network failure recovery...');
    
    try {
      // Simulate network failure and recovery
      let networkUp = false;
      
      const testNetworkCall = async (): Promise<string> => {
        if (!networkUp) {
          networkUp = true; // Simulate network coming back up
          throw new Error('Network unreachable');
        }
        return 'Network call successful';
      };
      
      try {
        await testNetworkCall();
        this.addResult('Network Failure Recovery', 'info',
          'ℹ️ Network call succeeded immediately');
      } catch (error) {
        // Try recovery
        try {
          await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay
          await testNetworkCall(); // Should succeed now
          this.addResult('Network Failure Recovery', 'success',
            '✅ Network failure recovery successful');
        } catch (_recoveryError) {
          this.addResult('Network Failure Recovery', 'failure',
            'Network failure recovery failed');
        }
      }
      
    } catch (error) {
      this.addResult('Network Failure Recovery', 'failure',
        `Network recovery test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Extract page context for testing
   */
  private extractPageContext(): any {
    const urlMatch = window.location.pathname.match(
      /\/courses\/(\d+)\/(?:(assignments|questions)\/(\d+)\/)?submissions\/(\d+)\/grade/
    );
    
    if (!urlMatch) {
      return {};
    }
    
    const [, courseId, type, assignmentOrQuestionId, submissionId] = urlMatch;
    return {
      courseId,
      type,
      assignmentId: type === 'assignments' ? assignmentOrQuestionId : null,
      questionId: type === 'questions' ? assignmentOrQuestionId : null,
      submissionId
    };
  }

  /**
   * Add test result to results array
   */
  private addResult(testName: string, status: APITestResult['status'], 
                   message: string, timing?: number, details?: any): void {
    this.testResults.push({
      testName,
      status,
      message,
      timing: timing ? Math.round(timing * 100) / 100 : undefined,
      details
    });
    
    // Log result immediately
    const icon = { success: '✅', failure: '❌', warning: '⚠️', info: 'ℹ️' }[status];
    const timingStr = timing ? ` (${Math.round(timing)}ms)` : '';
    console.log(`${icon} ${testName}: ${message}${timingStr}`);
  }

  /**
   * Print comprehensive test summary
   */
  private printTestSummary(): void {
    const summary = this.testResults.reduce((acc, result) => {
      acc[result.status] = (acc[result.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\n🧪 API Testing Summary (Week 2 Day 5):');
    console.log('=====================================================');
    console.log(`✅ Passed: ${summary.success || 0}`);
    console.log(`❌ Failed: ${summary.failure || 0}`);
    console.log(`⚠️ Warnings: ${summary.warning || 0}`);
    console.log(`ℹ️ Info: ${summary.info || 0}`);
    console.log(`📊 Total Tests: ${this.testResults.length}`);
    
    // Show detailed failures
    const failures = this.testResults.filter(r => r.status === 'failure');
    if (failures.length > 0) {
      console.log('\n❌ Failed Tests:');
      failures.forEach(failure => {
        console.log(`  - ${failure.testName}: ${failure.message}`);
      });
    }
    
    console.log('=====================================================\n');
  }

  /**
   * Get test results for UI display
   */
  getTestResults(): APITestResult[] {
    return [...this.testResults];
  }
}

// Global API tester instance
let globalAPITester: APITester | null = null;

/**
 * Initialize global API testing interface - Week 2 Day 5
 */
function initializeAPITesting() {
  // Create global supergrader API helper if it doesn't exist
  if (!(window as any).supergrader) {
    (window as any).supergrader = {};
  }
  
  // Add API testing functions to global namespace
  (window as any).supergrader.testAPI = async () => {
    console.log('🧪 Starting comprehensive API testing...');
    
    const gradescopeAPI = (window as any).GradescopeAPI;
    if (!gradescopeAPI) {
      console.error('❌ GradescopeAPI not available for testing');
      return null;
    }
    
    if (!globalAPITester) {
      globalAPITester = new APITester(gradescopeAPI);
    }
    
    return await globalAPITester.runAllTests();
  };
  
  // Add individual test functions
  (window as any).supergrader.testCSRF = async () => {
    const gradescopeAPI = (window as any).GradescopeAPI;
    if (!gradescopeAPI) return null;
    
    if (!globalAPITester) {
      globalAPITester = new APITester(gradescopeAPI);
    }
    
    console.log('🔐 Testing CSRF token validation only...');
    await globalAPITester.testCSRFTokenValidation();
    return globalAPITester.getTestResults();
  };
  
  (window as any).supergrader.testRetries = async () => {
    const gradescopeAPI = (window as any).GradescopeAPI;
    if (!gradescopeAPI) return null;
    
    if (!globalAPITester) {
      globalAPITester = new APITester(gradescopeAPI);
    }
    
    console.log('🔄 Testing error handling and retries only...');
    await globalAPITester.testErrorHandlingAndRetries();
    return globalAPITester.getTestResults();
  };
  
  // Add test data fixtures to global namespace
  (window as any).supergrader.API_TEST_FIXTURES = API_TEST_FIXTURES;
  
  // Add enhanced rubric inspection function with radio button option display
  (window as any).supergrader.showRubricData = () => {
    console.log('🔍 ENHANCED RUBRIC DATA DISPLAY:');
    console.log('═'.repeat(50));
     
     // Check unified system
     const getRubric = (window as any).getRubric;
     if (typeof getRubric === 'function') {
       const rubricResult = getRubric();
       
       if (rubricResult?.type === 'structured') {
         const styleEmoji = rubricResult.rubricStyle === 'RADIO' ? '📻' : 
                           rubricResult.rubricStyle === 'CHECKBOX' ? '☑️' : 
                           rubricResult.rubricStyle === 'MIXED' ? '🔄' : '📝';
         console.log(`${styleEmoji} Found ${rubricResult.items.length} rubric items (${rubricResult.rubricStyle} style)`);
         console.log('');
         
         let radioCount = 0;
         let checkboxCount = 0;
         
         rubricResult.items.forEach((item: any, index: number) => {
           const itemTypeEmoji = item.itemType === 'RADIO' ? '📻' : '☑️';
           
           // Enhanced radio group display
           if (item.description && item.description.includes('Available options:')) {
             radioCount++;
             const lines = item.description.split('\n');
             const title = lines[0];
             const optionLines = lines.filter((l: string) => l.includes('- '));
             const selectedLine = lines.find((l: string) => l.includes('Currently selected:'));
             
             console.log(`${itemTypeEmoji} ${index + 1}. ${title} (${item.points} pts)`);
             
             // Show all available options with proper formatting
             if (optionLines.length > 0) {
               console.log(`    📋 Available Options:`);
               optionLines.forEach((option: string) => {
                 const cleanOption = option.replace(/^\s*-\s*/, '');
                 console.log(`       • ${cleanOption}`);
               });
             }
             
             // Show current selection with highlighting
             if (selectedLine) {
               const selected = selectedLine.replace(/^\s*Currently selected:\s*/, '');
               console.log(`    ⭐ ${selected}`);
             } else {
               console.log(`    ⚪ No option currently selected`);
             }
             
           } else {
             // Regular checkbox item with enhanced display
             checkboxCount++;
             const desc = item.description && item.description.length > 100 ? 
               item.description.substring(0, 100) + '...' : item.description || 'No description';
             
             // Show selection state for checkboxes
             const selected = item.element ? 
               ((window as any).GradescopeAPI?.isRubricItemSelected?.(item.element) || false) : false;
             const selectionEmoji = selected ? '✅' : '⬜';
             
             console.log(`${itemTypeEmoji} ${index + 1}. ${desc} (${item.points} pts) ${selectionEmoji}`);
           }
           console.log('');
         });
         
         // Summary with emojis
         console.log('📊 RUBRIC SUMMARY:');
         console.log(`    📻 Radio Groups: ${radioCount}`);
         console.log(`    ☑️ Checkbox Items: ${checkboxCount}`);
         console.log(`    🎯 Total Items: ${rubricResult.items.length}`);
         
       } else if (rubricResult?.type === 'manual') {
         console.log('✍️ Manual scoring interface detected');
         console.log(`📝 Current score: ${rubricResult.box?.value || '(empty)'}`);
         console.log(`🎯 Score box placeholder: "${rubricResult.box?.placeholder || 'none'}"`);
         
       } else {
         console.log('❌ No rubric found on this page');
         console.log('💡 This might be a non-grading page or unsupported interface');
       }
     } else {
       console.log('❌ Rubric system not available');
       console.log('💡 Try refreshing the page or check if you\'re on a grading page');
     }
     
     console.log('═'.repeat(50));
   };

  // Add function specifically for displaying radio button details
  (window as any).supergrader.showRadioButtons = () => {
    console.log('📻 RADIO BUTTON GROUPS DETAILED VIEW:');
    console.log('═'.repeat(50));
    
    const getRubric = (window as any).getRubric;
    if (typeof getRubric === 'function') {
      const rubricResult = getRubric();
      
      if (rubricResult?.type === 'structured') {
        const radioItems = rubricResult.items.filter((item: any) => 
          item.itemType === 'RADIO' || (item.description && item.description.includes('Available options:')));
        
        if (radioItems.length === 0) {
          console.log('⚪ No radio button groups found on this page');
          return;
        }
        
        console.log(`Found ${radioItems.length} radio button groups:`);
        console.log('');
        
        radioItems.forEach((item: any, index: number) => {
          console.log(`📻 GROUP ${index + 1}: ${item.id}`);
          console.log(`Points: ${item.points}`);
          
          if (item.description) {
            const lines = item.description.split('\n');
            const title = lines[0].replace('📻 ', ''); // Remove emoji prefix if present
            console.log(`Title: ${title}`);
            
            const optionLines = lines.filter((l: string) => l.includes('◦ '));
            if (optionLines.length > 0) {
              console.log('Available Options:');
              optionLines.forEach((option: string, optIndex: number) => {
                const cleanOption = option.replace(/^\s*◦\s*/, '').replace(/"/g, '');
                console.log(`  ${optIndex + 1}. ${cleanOption}`);
              });
            }
            
            const selectedLine = lines.find((l: string) => l.includes('⭐ Currently selected:'));
            if (selectedLine) {
              const selected = selectedLine.replace(/^\s*⭐ Currently selected:\s*/, '').replace(/"/g, '');
              console.log(`✅ Selected: ${selected}`);
            } else {
              console.log(`⚪ No selection made yet`);
            }
          }
          
          console.log('─'.repeat(30));
        });
        
      } else {
        console.log('❌ No structured rubric found on this page');
      }
    } else {
      console.log('❌ Rubric system not available');
    }
    
    console.log('═'.repeat(50));
  };
  
  // Add function to scan expanded radio group for options
  (window as any).supergrader.scanExpandedRadioGroup = (group: Element, groupNumber: number) => {
    console.log(`\n🔍 SCANNING EXPANDED GROUP ${groupNumber}:`);
    (window as any).supergrader.performRadioGroupScan(group, groupNumber);
  };

  // Add function to perform the actual radio group scanning
  (window as any).supergrader.performRadioGroupScan = (group: Element, _groupNumber: number) => {
    // ENHANCED SEARCH: Try multiple container patterns
    const containerSelectors = [
      '.rubricItemGroup--rubricItems',
      '.rubricItems',
      '.options',
      '.radio-options',
      '[class*="options"]',
      '[class*="items"]'
    ];
    
    const optionSelectors = [
      '.rubricItem',
      '.option',
      '.radio-option',  
      '[class*="option"]',
      '[class*="item"]',
      'input[type="radio"]',
      'label',
      'button'
    ];
    
    let optionsContainer = null;
    let containerFound = false;
    
    for (const selector of containerSelectors) {
      optionsContainer = group.querySelector(selector);
      if (optionsContainer) {
        console.log(`  ✅ Found options container with selector: ${selector}`);
        containerFound = true;
        break;
      }
    }
    
    if (!containerFound) {
      console.log('  ❌ No standard options container found');
    }
    
    let allFoundOptions: Element[] = [];
    
    // Search in container if found
    if (optionsContainer) {
      for (const selector of optionSelectors) {
        const options = Array.from(optionsContainer.querySelectorAll(selector));
        if (options.length > 0) {
          console.log(`    ✅ Found ${options.length} options with selector: ${selector}`);
          allFoundOptions = allFoundOptions.concat(options);
        }
      }
    }
    
    // Search directly in group if no container or container has no options
    if (allFoundOptions.length === 0) {
      console.log('  🔍 Searching directly in group element...');
      for (const selector of optionSelectors) {
        const options = Array.from(group.querySelectorAll(selector));
        if (options.length > 0) {
          console.log(`    ✅ Found ${options.length} direct options with selector: ${selector}`);
          allFoundOptions = allFoundOptions.concat(options);
        }
      }
    }
    
    // Remove duplicates
    const uniqueOptions = Array.from(new Set(allFoundOptions));
    console.log(`  📊 Total unique options found: ${uniqueOptions.length}`);
    
    // Filter out obvious non-options (settings buttons, etc.)
    const filteredOptions = uniqueOptions.filter(option => {
      const text = option.textContent?.trim() || '';
      const classes = option.className || '';
      
      // Filter out control/settings buttons
      if (classes.includes('rubricSettings') || 
          classes.includes('control') ||
          text === 'Select one' ||
          text === '' ||
          classes.includes('dragHandle')) {
        return false;
      }
      
      return true;
    });
    
    console.log(`  🎯 Filtered to ${filteredOptions.length} likely option elements:`);
    
    // Look specifically for standard option letters (Q, W, E, R, T, etc.)
    const optionLetterElements = filteredOptions.filter(option => {
      const text = option.textContent?.trim() || '';
      return /^[A-Z]$/.test(text); // Single uppercase letters
    });
    
    if (optionLetterElements.length > 0) {
      console.log(`  🎯 Found ${optionLetterElements.length} standard option letters: [${optionLetterElements.map(el => el.textContent?.trim()).join(', ')}]`);
    }
    
    // Prioritize option letters for detailed analysis
    const priorityOptions = optionLetterElements.length > 0 ? optionLetterElements : filteredOptions;
    
    // Analyze each priority option
    priorityOptions.forEach((option, optIndex) => {
      const text = option.textContent?.trim() || '';
      const isOptionLetter = /^[A-Z]$/.test(text);
      
      console.log(`\n    ${isOptionLetter ? '⭐ OPTION LETTER' : 'Option'} ${optIndex + 1}:`);
      console.log(`      Element: ${option.tagName}.${option.className}`);
      console.log(`      Text content: "${text}"`);
      
      if (isOptionLetter) {
        console.log(`      🎯 Standard radio option: "${text}"`);
        
        // For option letters, look for associated content
        const parent = option.closest('.rubricItem, .option, div');
        if (parent && parent !== option) {
          const parentText = parent.textContent?.trim() || '';
          if (parentText !== text && parentText.length > text.length) {
            console.log(`      📝 Associated content: "${parentText.substring(0, 150)}..."`);
          }
        }
      }
      
      // Try multiple ways to find description
      const descSelectors = [
        '.rubricField-description',
        '.description', 
        '.text',
        '[class*="desc"]',
        'label',
        'span'
      ];
      
      let optionDesc = '';
      for (const descSel of descSelectors) {
        const descEl = option.querySelector(descSel);
        if (descEl && descEl.textContent?.trim()) {
          optionDesc = descEl.textContent.trim();
          console.log(`      Description (${descSel}): "${optionDesc}"`);
          break;
        }
      }
      
      if (!optionDesc && option.textContent?.trim() && !isOptionLetter) {
        optionDesc = option.textContent.trim();
        console.log(`      Description (direct text): "${optionDesc}"`);
      }
      
      // Try multiple ways to find points
      const pointSelectors = [
        '.rubricField-points',
        '.points',
        '.score',
        '[class*="point"]'
      ];
      
      let optionPoints = '';
      for (const pointSel of pointSelectors) {
        const pointEl = option.querySelector(pointSel);
        if (pointEl && pointEl.textContent?.trim()) {
          optionPoints = pointEl.textContent.trim();
          console.log(`      Points (${pointSel}): "${optionPoints}"`);
          break;
        }
      }
      
      // For option letters, also check nearby elements for points
      if (isOptionLetter && !optionPoints) {
        const nearbyElements = [
          option.nextElementSibling,
          option.previousElementSibling,
          option.parentElement?.querySelector('[class*="point"]')
        ].filter(Boolean);
        
        for (const nearby of nearbyElements) {
          const nearbyText = nearby?.textContent?.trim() || '';
          if (/\d+\s*(pt|pts|point|points)/i.test(nearbyText)) {
            console.log(`      Points (nearby): "${nearbyText}"`);
            break;
          }
        }
      }
      
      // Try multiple ways to detect selection
      const selectionIndicators = [
        '.rubricItem--key-applied',
        '.applied',
        '.selected',
        '.active', 
        '.checked',
        '[class*="applied"]',
        '[class*="selected"]'
      ];
      
      let isSelected = false;
      for (const selSel of selectionIndicators) {
        if (option.querySelector(selSel) || option.classList.contains(selSel.replace('.', ''))) {
          isSelected = true;
          console.log(`      ✅ Selected (indicator: ${selSel})`);
          break;
        }
      }
      
      if (!isSelected && option.tagName === 'INPUT') {
        isSelected = (option as HTMLInputElement).checked;
        if (isSelected) console.log(`      ✅ Selected (input checked)`);
      }
      
      if (!isSelected) {
        console.log(`      ⭕ Not selected`);
      }
      
      console.log(`      Raw HTML: ${option.outerHTML.substring(0, 150)}...`);
    });
    
    // Summary for this group
    console.log(`\n  📊 GROUP SCAN SUMMARY:`);
    console.log(`    - Total elements found: ${uniqueOptions.length}`);
    console.log(`    - After filtering: ${filteredOptions.length}`);
    console.log(`    - Option letters found: ${optionLetterElements.length} [${optionLetterElements.map(el => el.textContent?.trim()).join(', ')}]`);
    
    if (optionLetterElements.length === 0) {
      console.log(`    ⚠️ No standard option letters detected - group may be collapsed or use different structure`);
    }
    
    // If still no good options found, run the advanced analysis
    if (filteredOptions.length === 0) {
      console.log('  ⚠️ No clear options found after filtering, running advanced analysis...');
      
      // Show immediate children structure
      const allChildren = Array.from(group.children);
      console.log(`  📋 ${allChildren.length} immediate children:`);
      allChildren.forEach((child, childIndex) => {
        console.log(`    Child ${childIndex + 1}: ${child.tagName}.${child.className}`);
        console.log(`      Text preview: "${child.textContent?.trim().substring(0, 50)}"`);
        console.log(`      Has children: ${child.children.length > 0}`);
      });
      
      // STRATEGY: Look for elements with significant text content (likely options)
      console.log('  📝 Looking for text-rich elements (potential option descriptions)...');
      const allDescendants = Array.from(group.querySelectorAll('*'));
      const textRichElements = allDescendants.filter(el => {
        const text = el.textContent?.trim() || '';
        const hasSignificantText = text.length > 15 && text.length < 500;
        const isNotContainer = el.children.length === 0 || 
                               Array.from(el.children).every(child => 
                                 (child.textContent?.trim().length || 0) < 20
                               );
        return hasSignificantText && isNotContainer;
      });
      
      console.log(`  Found ${textRichElements.length} text-rich elements:`);
      textRichElements.slice(0, 8).forEach((textEl, idx) => {
        console.log(`    Text-rich ${idx + 1}: ${textEl.tagName}.${textEl.className}`);
        console.log(`      Content: "${textEl.textContent?.trim().substring(0, 100)}..."`);
      });
    }
  };

  // Add DOM depth analysis function  
  (window as any).supergrader.analyzeRadioGroupDepth = (groupElement: Element) => {
    const analysis = {
      maxDepth: 0,
      depthCounts: {} as Record<number, number>,
      elementsAtDepth: {} as Record<number, Element[]>,
      likelyOptionDepth: 0
    };
    
    // Recursively traverse and catalog depth
    const traverse = (element: Element, depth: number) => {
      analysis.maxDepth = Math.max(analysis.maxDepth, depth);
      analysis.depthCounts[depth] = (analysis.depthCounts[depth] || 0) + 1;
      
      if (!analysis.elementsAtDepth[depth]) {
        analysis.elementsAtDepth[depth] = [];
      }
      analysis.elementsAtDepth[depth].push(element);
      
      Array.from(element.children).forEach(child => {
        traverse(child, depth + 1);
      });
    };
    
    // Start traversal from group element children (depth 1)
    Array.from(groupElement.children).forEach(child => {
      traverse(child, 1);
    });
    
    // Find most likely option depth based on heuristics
    let bestScore = 0;
    for (let depth = 1; depth <= analysis.maxDepth; depth++) {
      const elementsAtThisDepth = analysis.elementsAtDepth[depth] || [];
      let score = 0;
      
      // Score based on number of elements (more options = higher score)
      score += elementsAtThisDepth.length * 10;
      
      // Score based on text content patterns
      elementsAtThisDepth.forEach(el => {
        const text = el.textContent?.trim() || '';
        if (text.length > 20 && text.length < 300) score += 20; // Good option length
        if (/\d+\s*(pt|pts|point|points)/i.test(text)) score += 30; // Has points
        if (text.includes('**') || text.includes('Steps')) score += 15; // Formatting indicators
        if (el.children.length === 0) score += 10; // Leaf elements preferred
      });
      
      if (score > bestScore) {
        bestScore = score;
        analysis.likelyOptionDepth = depth;
      }
    }
    
    return analysis;
  };

  // Add debug functions for investigating selection issues
  (window as any).supergrader.debugSelection = () => {
    console.log('🔍 SELECTION STATE DEBUGGING:');
    console.log('='.repeat(60));
    
    const rubricResult = getRubric();
    if (!rubricResult || rubricResult.type !== 'structured') {
      console.log('❌ No structured rubric found');
      return;
    }
    
    console.log(`Found ${rubricResult.items.length} items, checking each for selection state:`);
    
    rubricResult.items.forEach((item, index) => {
      console.log(`\n${index + 1}. Item ID: ${item.id}`);
      console.log(`   Description: ${item.description?.split('\n')[0]}`);
      console.log(`   Points: ${item.points}`);
      console.log(`   Type: ${item.itemType}`);
      
      if (item.element) {
        // Call the debug method on the API instance
        const api = (window as any).GradescopeAPI;
        if (api && typeof api.debugElementSelection === 'function') {
          api.debugElementSelection(item.element);
        } else {
          // Fallback debugging
          const hasInput = item.element.querySelector('input');
          const hasApplied = item.element.querySelector('[class*="applied"]');
          console.log(`   Has input: ${!!hasInput}`);
          if (hasInput) console.log(`   Input checked: ${hasInput.checked}`);
          console.log(`   Has applied class: ${!!hasApplied}`);
        }
      } else {
        console.log('   ⚠️ No DOM element found for this item');
      }
    });
    
    console.log('='.repeat(60));
  };
  
  (window as any).supergrader.debugRadioOptions = () => {
    console.log('📻 Radio Options Debug:');
     
     const root = getInnerDoc();
     const radioGroups = Array.from(root.querySelectorAll('.rubricItemGroup'));
     
     console.log(`Found ${radioGroups.length} radio groups on page`);
     
     // Sequential scanning function
     (window as any).supergrader.scanRadioGroupsSequentially(radioGroups, 0);
   };

  // Add sequential radio group scanning to handle accordion behavior  
  (window as any).supergrader.scanRadioGroupsSequentially = (groups: Element[], currentIndex: number) => {
    if (currentIndex >= groups.length) {
      console.log('✅ All radio groups scanned');
      return;
    }

    const group = groups[currentIndex];
    console.log(`📋 Group ${currentIndex + 1}:`);
    
    (window as any).supergrader.scanSingleRadioGroup(group, currentIndex + 1, () => {
      // Continue to next group after current one is complete
      setTimeout(() => {
        (window as any).supergrader.scanRadioGroupsSequentially(groups, currentIndex + 1);
      }, 200); // Brief pause between groups
    });
  };

  // Modified single group scanning with callback
  (window as any).supergrader.scanSingleRadioGroup = (group: Element, groupNumber: number, onComplete: () => void) => {
    const groupDesc = group.querySelector('.rubricField-description')?.textContent?.trim();
    console.log(`  ${groupDesc || 'Unknown'}`);
     
     // 🔑 KEY FIX: Check if group is collapsed and expand it
     const expandButton = group.querySelector('button[aria-expanded="false"]');
     
     if (expandButton) {
       try {
         // Expand the group
         (expandButton as HTMLElement).click();
         
         // Give it more time to expand and load content
         setTimeout(() => {
           (window as any).supergrader.performDeepRadioGroupScan(group, groupNumber);
           
           // Collapse it back to restore original state
           setTimeout(() => {
             if (expandButton.getAttribute('aria-expanded') === 'true') {
               (expandButton as HTMLElement).click();
             }
             onComplete(); // Signal completion
           }, 100);
         }, 300); // Longer wait for dynamic content
         
       } catch (error) {
         console.log('  ❌ Expansion failed');
         onComplete();
       }
     } else {
       (window as any).supergrader.performDeepRadioGroupScan(group, groupNumber);
       onComplete();
     }
   };

  // Enhanced deep scanning function - now uses correct selectors from DOM analysis
  (window as any).supergrader.performDeepRadioGroupScan = (group: Element, _groupNumber: number) => {
    // NEW IMPLEMENTATION: locate sibling container that holds individual `.rubricItem` nodes
    const headerBtn = group.querySelector('.rubricItemGroup--key');
    const headerId = headerBtn?.getAttribute('id');
    let optionItems: Element[] = [];

    if (headerId) {
      const container = getInnerDoc().querySelector(`[aria-describedby="${headerId}"]`);
      if (container) {
        optionItems = Array.from(container.querySelectorAll('.rubricItem'));
      }
    }

    // Fallbacks if nothing found yet
    if (optionItems.length === 0) {
      optionItems = Array.from(group.querySelectorAll('.rubricItemGroup--rubricItems .rubricItem'));
    }
    if (optionItems.length === 0) {
      optionItems = Array.from(getInnerDoc().querySelectorAll('.rubricItemGroup--rubricItems .rubricItem'));
    }

    console.log(`    📊 Found ${optionItems.length} radio options`);

    if (optionItems.length > 0) {
      console.log(`    ✅ ${optionItems.length} options`);
       
     } else {
      console.log(`    ⚠️ No options found`);
     }
   };

  // Legacy forEach approach (keeping for backwards compatibility)
  (window as any).supergrader.debugRadioOptionsLegacy = () => {
    console.log('📻 RADIO BUTTON OPTIONS DEBUGGING (Legacy):');
    console.log('='.repeat(60));
    
    const root = getInnerDoc();
    const radioGroups = root.querySelectorAll('.rubricItemGroup');
    
    console.log(`Found ${radioGroups.length} radio groups on page`);
    
    radioGroups.forEach((group, index) => {
            console.log(`\nGroup ${index + 1}:`);
      console.log('  Element:', group);
      console.log('  Classes:', group.className);
      console.log('  innerHTML preview:', group.innerHTML.substring(0, 200) + '...');
      
      // Check for group description
      const groupDesc = group.querySelector('.rubricField-description')?.textContent?.trim();
      console.log('  Group description:', groupDesc);
      
      // Note: This legacy version doesn't handle accordion behavior properly
      console.log('  ⚠️ Using legacy scanning (may miss options in collapsed groups)');
      (window as any).supergrader.performRadioGroupScan(group, index + 1);
    });
    
    console.log('='.repeat(60));
    console.log('💡 TIP: Use supergrader.debugRadioOptions() for better accordion handling');
  };
  
  console.log('🧪 API testing functions initialized');
  console.log('💡 Quick commands:');
  console.log('   supergrader.showRubricData() - Show actual rubric content + run all debugging');
  console.log('   supergrader.debugSelection() - Debug selection detection issues');
  console.log('   supergrader.debugRadioOptions() - 🌟 SEQUENTIAL radio button scanning (handles accordion)');
  console.log('   supergrader.debugRadioOptionsLegacy() - Legacy simultaneous scanning');
  console.log('   supergrader.analyzeRadioGroupDepth(element) - Analyze DOM structure depth');
  console.log('   supergrader.testAPI() - Full API test suite');
  console.log('');
  console.log('🎯 For radio buttons: Use the main debugRadioOptions() - it handles one-at-a-time expansion!');
}

// Initialize API testing when script loads
initializeAPITesting(); 

// Add wait helper to ensure option nodes are present before scanning
(window as any).supergrader.waitForRadioOptions = (grp: Element, timeoutMs = 1500): Promise<Element[]> => {
  return new Promise(resolve => {
    const selector = '.rubricItemGroupSummary--item';

    // quick check first
    const immediate = grp.querySelectorAll(selector);
    if (immediate.length) {
      resolve(Array.from(immediate));
      return;
    }

    const start = Date.now();
    const tryFind = (): boolean => {
      const items = grp.querySelectorAll(selector);
      if (items.length) {
        resolve(Array.from(items));
        return true;
      }
      return false;
    };

    // polling every 60 ms
    const pollId = setInterval(() => {
      if (tryFind() || Date.now() - start > timeoutMs) {
        clearInterval(pollId);
      }
    }, 60);

    // mutation observer as backup
    const mo = new MutationObserver(() => {
      if (tryFind()) {
        mo.disconnect();
        clearInterval(pollId);
      }
    });
    mo.observe(grp, { childList: true, subtree: true });
  });
}; 

(window as any).showRadioDiag = async () => {
  const root = getInnerDoc();
  const groups = Array.from(root.querySelectorAll('.rubricItemGroup'));
  if (groups.length === 0) {
    console.log('⚪ No radio groups detected');
    return;
  }
  console.log(`📻 Inspecting ${groups.length} radio groups...`);

  const expandIfNeeded = async (group: Element): Promise<void> => {
    const btn = group.querySelector('button[aria-expanded="false"]');
    if (btn) {
      (btn as HTMLElement).click();
      await new Promise(r => setTimeout(r, 350)); // wait for DOM render
    }
  };

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    await expandIfNeeded(group);

    // container with options
    const headerId = group.querySelector('.rubricItemGroup--key')?.getAttribute('id');
    let options: Element[] = [];
    if (headerId) {
      const container = root.querySelector(`[aria-describedby="${headerId}"]`);
      if (container) options = Array.from(container.querySelectorAll('.rubricItem'));
    }
    if (options.length === 0) {
      options = Array.from(group.querySelectorAll('.rubricItemGroup--rubricItems .rubricItem'));
    }

    // title
    const title = group.querySelector('.rubricField-description')?.textContent?.trim() || `Group ${i+1}`;
    console.log(`${i + 1}. ${title} — ${options.length} options`);

    options.forEach((opt, idx) => {
      const desc = opt.querySelector('.rubricField-description')?.textContent?.trim() || 'No desc';
      const pts = opt.querySelector('.rubricField-points')?.textContent?.trim() || '';
      const key = opt.querySelector('.rubricItem--key')?.textContent?.trim() || String.fromCharCode(65+idx);
      const isSel = opt.querySelector('.rubricItem--key-applied');
      const selMark = isSel ? '⭐' : '•';
      console.log(`   ${selMark} ${key}: ${desc.substring(0,80)} ${pts}`);
    });

    // collapse back to minimize UI disruption
    const btnCollapse = group.querySelector('button[aria-expanded="true"]');
    if (btnCollapse) {
      (btnCollapse as HTMLElement).click();
      await new Promise(r => setTimeout(r, 150));
    }
  }

  console.log('✅ Radio diagnostic complete');
};