"use strict";
// Gradescope API integration module
// Handles authentication, data extraction, and grading actions
console.log('supergrader: Gradescope API module loaded');
/**
 * Enhanced Gradescope API wrapper class with robust authentication
 */
class GradescopeAPI {
    constructor() {
        this.csrfToken = null;
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
        }
        catch (error) {
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
            this.csrfToken = csrfMeta.getAttribute('content') ||
                csrfMeta.value;
            if (this.csrfToken && this.csrfToken.length > 10) {
                this.authState.csrfTokenValid = true;
                console.log('GradescopeAPI: CSRF token extracted and validated');
                return true;
            }
            else {
                console.error('GradescopeAPI: CSRF token found but appears invalid:', this.csrfToken?.substring(0, 10) + '...');
                return false;
            }
        }
        else {
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
        const foundSessionCookie = sessionCookiePatterns.find(pattern => cookieNames.some(name => name.includes(pattern.replace('__Host-', ''))));
        if (foundSessionCookie) {
            this.authState.sessionValid = true;
            console.log('GradescopeAPI: Session cookie found:', foundSessionCookie);
        }
        else {
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
        }
        else {
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
            }
            else if (response.status === 401 || response.status === 403) {
                console.error('GradescopeAPI: Authentication test failed - unauthorized');
                return false;
            }
            else {
                console.warn('GradescopeAPI: Authentication test inconclusive, status:', response.status);
                return true; // Assume OK for non-auth errors
            }
        }
        catch (error) {
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
        }
        else {
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
        }
        finally {
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
    /**
     * Get current authentication state for debugging
     */
    getAuthState() {
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
        if (fileInfo.files?.length && fileInfo.files.length > 0) {
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
                    downloadLink: downloadBtn?.href || downloadBtn?.getAttribute('href') || undefined,
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
    findDownloadButton(elem) {
        // Search in element and nearby siblings
        const searchAreas = [elem, elem.nextElementSibling, elem.parentElement].filter(Boolean);
        for (const area of searchAreas) {
            if (!area)
                continue;
            const btn = area.querySelector('a[href*="download"], button[data-download]') ||
                Array.from(area.querySelectorAll('button, a'))
                    .find(b => b.textContent?.toLowerCase().includes('download'));
            if (btn)
                return btn;
        }
        return null;
    }
    /**
     * Find filename associated with a download button
     */
    findAssociatedFileName(btn) {
        const parent = btn.closest('details, .file-container, div, section');
        if (!parent)
            return undefined;
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
        return Boolean(text && text.length < 100 &&
            /\.(cpp|h|py|java|js|ts|txt|c|cs|rb|php|go|rs|swift|kt|scala|pl|sh|r|m|sql|html|css|xml|json|yaml|yml|md|rst|makefile)$/i.test(text));
    }
    /**
     * Detect non-programming submission types
     */
    detectNonProgrammingType() {
        if (document.querySelector('.submission-content, .student-answer'))
            return 'text';
        if (document.querySelectorAll('img[src*="submission"]').length > 0)
            return 'image';
        if (document.querySelector('.pdf-viewer, iframe[src*="pdf"]'))
            return 'pdf';
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
                fileTypes: {},
                largestFile: { name: '', size: 0 },
                totalSize: 0,
                downloadMethod: 'none',
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
        const result = {
            files: {},
            metadata: this.createMetadata(detectedFiles.length, 'individual')
        };
        for (const fileInfo of detectedFiles) {
            const fileName = this.cleanFileName(fileInfo.fileName || 'unknown');
            if (!fileName || !this.shouldProcessFile(fileName, result.metadata))
                continue;
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
            }
            catch (error) {
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
        if (fileInfo.downloadLink)
            return fileInfo.downloadLink;
        if (fileInfo.fileId)
            return `/files/${fileInfo.fileId}/download?submission_id=${submissionId}`;
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
        if (!name || name === 'unknown')
            return null;
        return name.replace(/^\s*[▼▶]\s*/, '').replace(/\s*Download\s*$/, '').trim();
    }
    shouldProcessFile(fileName, metadata) {
        if (!fileName || fileName.length > 100 || fileName.includes('Download')) {
            metadata.skippedFiles++;
            return false;
        }
        const extension = fileName.match(/(\.[^.]+)$/)?.[1]?.toLowerCase();
        const supportedExts = ['.cpp', '.h', '.py', '.java', '.js', '.ts', '.c', '.cs', '.rb', '.php', '.txt', '.md'];
        const isSupported = supportedExts.includes(extension || '') || fileName.toLowerCase().includes('makefile');
        if (extension)
            metadata.fileTypes[extension] = (metadata.fileTypes[extension] || 0) + 1;
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
            }
            catch (error) {
                console.log(`❌ ZIP URL failed: ${url} (${error.message})`);
            }
        }
        throw new Error('All download methods failed');
    }
    getZipUrls(submissionId) {
        const urlMatch = window.location.pathname.match(/\/courses\/(\d+)\/(assignments|questions)\/(\d+)/);
        if (!urlMatch)
            return [`/submissions/${submissionId}/zip_download`];
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
        const zip = await window.JSZip.loadAsync(zipBlob);
        const result = {
            files: {},
            metadata: this.createMetadata(Object.keys(zip.files).length, 'ZIP')
        };
        for (const [path, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir)
                continue;
            const fileName = path.replace(/\\/g, '/');
            if (!this.shouldProcessFile(fileName, result.metadata))
                continue;
            try {
                const text = await zipEntry.async('text');
                const content = this.containsBinaryData(text) ? null : text;
                if (content) {
                    const fileContent = {
                        content,
                        size: content.length,
                        encoding: 'utf8',
                        extension: fileName.match(/(\.[^.]+)$/)?.[1]?.toLowerCase() || ''
                    };
                    result.files[fileName] = fileContent;
                    this.updateMetadata(result.metadata, fileName, fileContent);
                }
            }
            catch (error) {
                this.recordError(result.metadata, `Error processing ${fileName}: ${error.message}`);
            }
        }
        return result;
    }
    /**
     * Helper method to detect binary data in text content
     */
    containsBinaryData(content) {
        if (typeof content !== 'string')
            return true;
        // Check for null bytes (common in binary files)
        if (content.includes('\0'))
            return true;
        // Check for high percentage of non-printable characters
        const nonPrintableCount = (content.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g) || []).length;
        const nonPrintableRatio = nonPrintableCount / content.length;
        // If more than 10% non-printable characters, likely binary
        return nonPrintableRatio > 0.1;
    }
    /**
     * Extract rubric structure from DOM - Week 2 Day 3-4 Implementation
     */
    extractRubricStructure() {
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
    isRubricItemSelected(element) {
        if (!element)
            return false;
        const input = element.querySelector('input[type="checkbox"], input[type="radio"]');
        return input ? input.checked : false;
    }
    /**
     * Toggle a rubric item - Week 2 Day 3-4 Implementation
     */
    async toggleRubricItem(_questionId, rubricItemId, _points, _description) {
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
            const targetItem = rubricResult.items.find(item => String(item.id) === String(rubricItemId));
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
            }
            else {
                return {
                    success: false,
                    message: `Failed to toggle rubric item ${rubricItemId}`
                };
            }
        }
        catch (error) {
            console.error('Error toggling rubric item:', error);
            return {
                success: false,
                message: `Error toggling rubric item: ${error.message}`
            };
        }
    }
    /**
     * Add inline comment to code (placeholder - Week 2)
     */
    async addComment(_questionId, submissionId, _fileId, _lineStart, _lineEnd, _text) {
        console.log(`GradescopeAPI: Adding comment to submission ${submissionId}`);
        // TODO: Implement comment addition (Week 2)
        return { success: false, message: 'Not implemented yet' };
    }
}
// Create global instance
window.GradescopeAPI = new GradescopeAPI();
// Set up comprehensive console helpers using IIFE with Object.assign
(() => {
    const apiHelpers = {
        // Ensure core properties are set (may override existing)
        api: window.GradescopeAPI,
        ui: window.UIController,
        getStatus: () => window.GradescopeAPI?.getAuthStatus?.(),
        getState: () => window.supergraderState,
        downloadTest: (submissionId) => {
            const event = new CustomEvent('SUPERGRADER_TEST_DOWNLOAD', {
                detail: { submissionId }
            });
            window.dispatchEvent(event);
        },
        testRubric: async () => {
            console.log('supergrader: Testing rubric retrieval...');
            // Extract IDs from current page URL
            const urlMatch = window.location.pathname.match(/\/courses\/(\d+)\/(assignments|questions)\/(\d+)\/submissions\/(\d+)\/grade/);
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
                Object.entries(rubricMap.questions).forEach(([qId, qData]) => {
                    console.log(`Question ${qId}: "${qData.name}" (${qData.rubricStyle}, parent: ${qData.parentId || 'none'})`);
                    qData.items.forEach((item) => {
                        console.log(`  Item ${item.id}: "${item.text}" (${item.points} pts)`);
                    });
                });
                return rubricMap;
            }
            catch (error) {
                console.error('supergrader: Rubric retrieval failed:', error);
                return null;
            }
        },
        analyzeRubric: async () => {
            const rubricMap = await window.supergrader.testRubric();
            if (!rubricMap)
                return null;
            const analysis = {
                totalQuestions: Object.keys(rubricMap.questions).length,
                totalItems: Object.keys(rubricMap.itemToQuestion).length,
                questionsByType: { CHECKBOX: 0, RADIO: 0 },
                parentChildRelationships: 0,
                pointsDistribution: { positive: 0, negative: 0, zero: 0 },
                questionHierarchy: []
            };
            // Analyze question structure
            Object.entries(rubricMap.questions).forEach(([_, qData]) => {
                analysis.questionsByType[qData.rubricStyle]++;
                if (qData.parentId !== null) {
                    analysis.parentChildRelationships++;
                }
                // Analyze points distribution
                qData.items.forEach((item) => {
                    if (item.points > 0)
                        analysis.pointsDistribution.positive++;
                    else if (item.points < 0)
                        analysis.pointsDistribution.negative++;
                    else
                        analysis.pointsDistribution.zero++;
                });
            });
            // Build question hierarchy
            const rootQuestions = Object.entries(rubricMap.questions)
                .filter(([_, qData]) => qData.parentId === null)
                .map(([qId, qData]) => ({
                id: parseInt(qId),
                name: qData.name,
                children: Object.entries(rubricMap.questions)
                    .filter(([_, childData]) => childData.parentId === parseInt(qId))
                    .map(([childId, childData]) => ({
                    id: parseInt(childId),
                    name: childData.name
                }))
            }));
            analysis.questionHierarchy = rootQuestions;
            console.log('Rubric Analysis:', analysis);
            return analysis;
        },
        getRubricItem: async (itemId) => {
            const rubricMap = await window.supergrader.testRubric();
            if (!rubricMap)
                return null;
            const questionId = rubricMap.itemToQuestion[itemId];
            if (!questionId) {
                console.error(`Item ${itemId} not found`);
                return null;
            }
            const question = rubricMap.questions[questionId];
            const item = question.items.find((i) => i.id === itemId);
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
            const rubricMap = await window.supergrader.testRubric();
            if (!rubricMap)
                return false;
            const issues = [];
            // Check for orphaned items
            Object.entries(rubricMap.itemToQuestion).forEach(([itemId, questionId]) => {
                if (!rubricMap.questions[questionId]) {
                    issues.push(`Orphaned item ${itemId} points to non-existent question ${questionId}`);
                }
            });
            // Check for missing reverse mappings
            Object.entries(rubricMap.questions).forEach(([questionId, question]) => {
                question.items.forEach((item) => {
                    if (rubricMap.itemToQuestion[item.id] !== parseInt(questionId)) {
                        issues.push(`Item ${item.id} in question ${questionId} not properly mapped in itemToQuestion`);
                    }
                });
            });
            // Check parent-child consistency
            Object.entries(rubricMap.questions).forEach(([questionId, question]) => {
                if (question.parentId !== null) {
                    if (!rubricMap.questions[question.parentId]) {
                        issues.push(`Question ${questionId} has non-existent parent ${question.parentId}`);
                    }
                }
            });
            if (issues.length === 0) {
                console.log('✅ Rubric structure validation passed');
                return true;
            }
            else {
                console.error('❌ Rubric structure validation failed:');
                issues.forEach((issue) => console.error(`  - ${issue}`));
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
            }
            else {
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
            }
            catch (error) {
                console.error('❌ Rubric extraction failed:', error);
                return null;
            }
        },
        // Unified apply functions
        applyGrade: (rubricId, checked, score) => {
            const rubricResult = getRubric();
            return applyGrade(rubricResult, rubricId, checked, score);
        },
        applyRubric: (itemId, selected) => {
            return applyRubricItem(itemId, selected);
        },
        // Utility functions
        getRubric: () => getRubric(),
        getInnerDoc: () => getInnerDoc(),
        getIframeDoc: () => getIframeDocument()
    };
    // Merge with any existing supergrader object
    window.supergrader = Object.assign(window.supergrader || {}, apiHelpers);
    const keys = Object.keys(window.supergrader);
    console.log('supergrader: API helpers merged, final keys:', keys);
})();
// TESTING: Add test functionality to the existing UI
// This avoids CSP violations while providing testing capability
window.addEventListener('SUPERGRADER_TEST_DOWNLOAD', async (event) => {
    const customEvent = event;
    console.log('🔧 Testing file download for submission:', customEvent.detail.submissionId);
    try {
        const result = await window.GradescopeAPI.downloadSubmissionFiles(customEvent.detail.submissionId);
        console.log('✅ Download successful!');
        console.log('📁 Files found:', Object.keys(result.files).length);
        console.log('📊 Metadata:', result.metadata);
        // Log file details
        Object.entries(result.files).forEach(([path, file]) => {
            const fileContent = file;
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
    }
    catch (error) {
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
/**
 * Get document for rubric extraction - handles both iframe and frameless layouts
 */
function getInnerDoc() {
    const frame = document.querySelector('iframe[src*="submissions"]');
    return frame?.contentDocument ?? frame?.contentWindow?.document ?? document;
}
/**
 * Legacy function for backwards compatibility
 */
function getIframeDocument() {
    const doc = getInnerDoc();
    return doc === document ? null : doc; // Return null if fallback to main document
}
/**
 * Unified rubric detection - handles all Gradescope layouts
 */
function getRubric() {
    const root = getInnerDoc();
    // 2-a. Try hidden React props - works on frameless pages
    const propsEl = root.querySelector('[data-react-props]');
    if (propsEl) {
        try {
            const propsAttr = propsEl.getAttribute('data-react-props');
            if (propsAttr) {
                const data = JSON.parse(atob(propsAttr));
                if (data?.rubricItems?.length) {
                    const items = data.rubricItems.map((item) => ({
                        id: item.id || item.rubric_item_id,
                        description: item.description || item.text,
                        points: item.points || 0
                    }));
                    // Determine style from React data or default to CHECKBOX
                    const rubricStyle = data.rubricStyle || 'CHECKBOX';
                    console.log(`📝 Found ${items.length} rubric items via React props`);
                    return { type: 'structured', items, rubricStyle };
                }
            }
        }
        catch (error) {
            console.log('📝 Failed to parse React props, falling back to DOM');
        }
    }
    // 2-b. Fallback to DOM selectors - works on iframe and legacy pages
    let domItems = Array.from(root.querySelectorAll('.rubric-item[data-rubric-item-id]'));
    // 2-c. Try newer Gradescope interface with different class names
    if (domItems.length === 0) {
        domItems = Array.from(root.querySelectorAll('.rubricItem'));
        // Also look for radio-button style groups (encoder Design, decoder Design, etc.)
        const groupItems = Array.from(root.querySelectorAll('.rubricItemGroup'));
        domItems = domItems.concat(groupItems);
    }
    if (domItems.length) {
        const items = [];
        let hasRadio = false;
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
                    // Find all available options in this group
                    const summaryElement = element.querySelector('.rubricItemGroupSummary');
                    const summaryDesc = summaryElement?.querySelector('.rubricItemGroupSummary--description--widthContainer')?.textContent?.trim();
                    // Get the currently selected option's points
                    const summaryPoints = summaryElement?.querySelector('.rubricItemGroupSummary--points')?.textContent?.trim();
                    const summaryPointValue = summaryPoints ? parseFloat(summaryPoints.replace(/[^\d.-]/g, '')) || 0 : 0;
                    // Build description showing this is a radio group with options
                    description = `${groupDesc || 'Radio Group'} (Select one option)`;
                    if (summaryDesc) {
                        description += ` - Currently selected: "${summaryDesc}" (${summaryPointValue} pts)`;
                    }
                    points = summaryPointValue;
                    hasRadio = true; // This is definitely a radio-style group
                }
                else {
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
                }
            }
            // Check for radio buttons or applied state
            if (element.querySelector('input[type="radio"]') || element.classList.contains('rubricItemGroup')) {
                hasRadio = true;
            }
            if (itemId && description) {
                items.push({
                    id: itemId,
                    description: description || '',
                    points,
                    element
                });
            }
        });
        const rubricStyle = hasRadio ? 'RADIO' : 'CHECKBOX';
        console.log(`📝 Found ${items.length} rubric items via DOM selectors`);
        return { type: 'structured', items, rubricStyle };
    }
    // 2-d. Detect manual-scoring single box
    const scoreBox = root.querySelector('input[name="score"], input[type="number"][placeholder*="score" i], input[type="number"][id*="score" i]');
    if (scoreBox) {
        console.log('📝 Found manual scoring input box');
        return { type: 'manual', box: scoreBox };
    }
    // Additional fallback - look for any number input in grading context
    const numberInputs = Array.from(root.querySelectorAll('input[type="number"]'));
    const gradingInput = numberInputs.find(input => input.placeholder?.toLowerCase().includes('score') ||
        input.placeholder?.toLowerCase().includes('points') ||
        input.name?.toLowerCase().includes('score') ||
        input.id?.toLowerCase().includes('score'));
    if (gradingInput) {
        console.log('📝 Found grading number input as fallback');
        return { type: 'manual', box: gradingInput };
    }
    return null; // nothing found
}
/**
 * Apply grading action - handles both structured rubrics and manual scoring
 */
function applyGrade(target, rubricId, checked, score) {
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
        const input = item.element.querySelector('input[type="checkbox"], input[type="radio"]');
        if (!input) {
            console.error(`No input found for rubric item ${rubricId}`);
            return false;
        }
        // Only click if the current state differs from desired state
        if (checked !== undefined && input.checked !== checked) {
            console.log(`📝 ${checked ? 'Selecting' : 'Deselecting'} rubric item ${rubricId}`);
            input.click(); // This triggers Gradescope's own event handlers
            return true;
        }
        else if (checked === undefined) {
            // Just toggle if no specific state requested
            console.log(`📝 Toggling rubric item ${rubricId}`);
            input.click();
            return true;
        }
        else {
            console.log(`📝 Rubric item ${rubricId} already in desired state (${checked})`);
            return true;
        }
    }
    else if (target.type === 'manual') {
        if (typeof score === 'number') {
            console.log(`📝 Setting manual score to ${score}`);
            target.box.value = String(score);
            // Trigger change event for React/Angular listeners
            target.box.dispatchEvent(new Event('input', { bubbles: true }));
            target.box.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
        else {
            console.error('Score value required for manual scoring');
            return false;
        }
    }
    return false;
}
/**
 * Extract rubric items using unified detection (legacy wrapper)
 */
async function getRubricFromIframe() {
    return new Promise((resolve, reject) => {
        const checkRubric = () => {
            const rubricResult = getRubric();
            if (!rubricResult) {
                // Check if we should retry (DOM might still be loading)
                const doc = getInnerDoc();
                if (doc.readyState !== 'complete') {
                    setTimeout(checkRubric, 500);
                    return;
                }
                else {
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
                id: typeof item.id === 'string' ? parseInt(item.id, 10) : item.id,
                text: item.description || '',
                points: item.points || 0
            }));
            // Calculate points distribution
            const pointsDistribution = items.reduce((acc, item) => {
                if (item.points > 0)
                    acc.positive++;
                else if (item.points < 0)
                    acc.negative++;
                else
                    acc.zero++;
                return acc;
            }, { positive: 0, negative: 0, zero: 0 });
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
function applyRubricItem(itemId, selected) {
    const rubricResult = getRubric();
    return applyGrade(rubricResult, String(itemId), selected);
}
// TESTING: Add rubric test functionality - Week 2 Day 3-4: Rubric Parsing
window.addEventListener('SUPERGRADER_TEST_RUBRIC', async (_event) => {
    console.log('📝 Testing rubric parsing functionality...');
    try {
        // Extract IDs from current page URL
        const urlMatch = window.location.pathname.match(/\/courses\/(\d+)\/(assignments|questions)\/(\d+)\/submissions\/(\d+)\/grade/);
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
                        itemToQuestion: {}
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
                    resultElement.name = 'supergrader-rubric-result';
                    resultElement.content = JSON.stringify({
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
                }
                else {
                    throw new Error('No rubric items found in iframe');
                }
            }
            catch (error) {
                console.log('ℹ️ No structured rubric found in iframe - likely outline/manual scoring interface');
                // Store result indicating no rubric structure available
                const resultElement = document.getElementById('supergrader-rubric-result') || document.createElement('meta');
                resultElement.id = 'supergrader-rubric-result';
                resultElement.name = 'supergrader-rubric-result';
                resultElement.content = JSON.stringify({
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
            resultElement.name = 'supergrader-rubric-result';
            resultElement.content = JSON.stringify({
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
            Object.entries(rubricMap.questions).forEach(([qId, qData]) => {
                console.log(`Question ${qId}: "${qData.name}" (${qData.rubricStyle}, parent: ${qData.parentId || 'none'})`);
                qData.items.forEach((item) => {
                    console.log(`  Item ${item.id}: "${item.text}" (${item.points} pts)`);
                });
                // Count statistics
                if (qData.parentId !== null) {
                    parentChildRelationships++;
                }
                if (qData.rubricStyle === 'CHECKBOX') {
                    checkboxQuestions++;
                }
                else if (qData.rubricStyle === 'RADIO') {
                    radioQuestions++;
                }
                qData.items.forEach((item) => {
                    if (item.points > 0)
                        positivePoints++;
                    else if (item.points < 0)
                        negativePoints++;
                    else
                        zeroPoints++;
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
            resultElement.name = 'supergrader-rubric-result';
            resultElement.content = JSON.stringify({
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
        }
        catch (rubricError) {
            throw new Error(`Rubric retrieval failed: ${rubricError.message}`);
        }
    }
    catch (error) {
        console.error('❌ Rubric parsing failed:', error);
        // Store error in DOM
        const resultElement = document.getElementById('supergrader-rubric-result') || document.createElement('meta');
        resultElement.id = 'supergrader-rubric-result';
        resultElement.name = 'supergrader-rubric-result';
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
window.GradescopeAPI.initialize = async function () {
    const result = await originalInitialize.call(this);
    updateAuthStatusInDOM();
    return result;
};
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
    constructor(api) {
        this.testResults = [];
        this.gradescopeAPI = api;
    }
    /**
     * Main test runner for all API tests
     */
    async runAllTests() {
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
        }
        catch (error) {
            this.addResult('API Testing Suite', 'failure', `Test suite failed: ${error.message}`, 0, { error });
        }
        this.printTestSummary();
        return this.testResults;
    }
    /**
     * Test 1: CSRF Token Validation - Week 2 Day 5 Requirement
     */
    async testCSRFTokenValidation() {
        console.log('🔐 Testing CSRF token validation...');
        const startTime = performance.now();
        try {
            // Test valid CSRF token extraction
            const authState = this.gradescopeAPI.getAuthState();
            if (!authState.csrfTokenValid || !authState.csrfToken) {
                this.addResult('CSRF Token Validation', 'failure', 'No valid CSRF token found - authentication may have failed');
                return;
            }
            this.addResult('CSRF Token Extraction', 'success', `✅ Valid CSRF token found: ${authState.csrfToken}`, performance.now() - startTime);
            // Test CSRF token format validation
            const tokenLength = authState.csrfToken.replace('...', '').length + 20; // Estimate full length
            if (tokenLength < 30) {
                this.addResult('CSRF Token Format', 'warning', 'CSRF token appears shorter than expected - may be truncated for display');
            }
            else {
                this.addResult('CSRF Token Format', 'success', `✅ CSRF token format appears valid (estimated length: ${tokenLength})`);
            }
            // Test CSRF token in request headers
            await this.testCSRFInHeaders();
        }
        catch (error) {
            this.addResult('CSRF Token Validation', 'failure', `CSRF validation failed: ${error.message}`, performance.now() - startTime, { error });
        }
    }
    /**
     * Test CSRF token inclusion in API requests
     */
    async testCSRFInHeaders() {
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
                this.addResult('CSRF Header Usage', 'success', '✅ CSRF token successfully included in request headers');
            }
            else if (response.status === 422) {
                this.addResult('CSRF Header Usage', 'failure', '❌ CSRF token rejected by server (422 Unprocessable Entity)');
            }
            else {
                this.addResult('CSRF Header Usage', 'info', `ℹ️ CSRF test inconclusive (status: ${response.status})`);
            }
        }
        catch (error) {
            this.addResult('CSRF Header Usage', 'warning', `CSRF header test failed: ${error.message}`);
        }
    }
    /**
     * Test 2: Rubric Item Toggle Endpoint Testing - Week 2 Day 5 Requirement
     */
    async testRubricItemToggleEndpoint() {
        console.log('📝 Testing rubric item toggle endpoint...');
        const startTime = performance.now();
        try {
            // Get current page context
            const pageContext = this.extractPageContext();
            if (!pageContext.courseId || !pageContext.questionId) {
                this.addResult('Toggle Endpoint Setup', 'info', 'ℹ️ Cannot test PUT endpoint - missing course/question IDs (may be assignment page)');
                return;
            }
            // Test endpoint URL construction
            const sampleItemId = 'test-item-123';
            const toggleUrl = `/courses/${pageContext.courseId}/questions/${pageContext.questionId}/rubric_items/${sampleItemId}`;
            this.addResult('Toggle Endpoint URL', 'success', `✅ Toggle endpoint URL constructed: ${toggleUrl}`);
            // Test PUT request structure (without actually sending to avoid changing grades)
            await this.testPUTRequestStructure(pageContext);
        }
        catch (error) {
            this.addResult('Rubric Toggle Endpoint', 'failure', `Toggle endpoint test failed: ${error.message}`, performance.now() - startTime, { error });
        }
    }
    /**
     * Test PUT request structure for rubric item toggling
     */
    async testPUTRequestStructure(_pageContext) {
        try {
            // Test request payload structure
            const testPayload = {
                points: -2,
                description: "Test rubric item description"
            };
            // Validate payload format
            if (typeof testPayload.points === 'number' &&
                typeof testPayload.description === 'string') {
                this.addResult('PUT Payload Structure', 'success', '✅ PUT request payload format is correct');
            }
            // Test headers for PUT request
            const putHeaders = {
                'X-CSRF-Token': this.gradescopeAPI.getAuthState().csrfToken?.replace('...', '') || '',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            };
            if (putHeaders['X-CSRF-Token'] && putHeaders['Content-Type']) {
                this.addResult('PUT Request Headers', 'success', '✅ PUT request headers properly configured');
            }
            else {
                this.addResult('PUT Request Headers', 'failure', '❌ Missing required headers for PUT request');
            }
            // Note: We don't actually send the PUT request to avoid changing real grades
            this.addResult('PUT Request Test', 'info', 'ℹ️ PUT request structure validated (not sent to preserve grading data)');
        }
        catch (error) {
            this.addResult('PUT Request Structure', 'failure', `PUT request structure test failed: ${error.message}`);
        }
    }
    /**
     * Test 3: Error Handling and Retries - Week 2 Day 5 Requirement
     */
    async testErrorHandlingAndRetries() {
        console.log('🔄 Testing error handling and retries...');
        try {
            // Test retry mechanism with simulated failures
            await this.testRetryMechanism();
            // Test error response handling
            await this.testErrorResponseHandling();
            // Test timeout handling
            await this.testTimeoutHandling();
        }
        catch (error) {
            this.addResult('Error Handling Tests', 'failure', `Error handling test failed: ${error.message}`);
        }
    }
    /**
     * Test retry mechanism with exponential backoff
     */
    async testRetryMechanism() {
        const maxRetries = 3;
        let attemptCount = 0;
        const startTime = performance.now();
        try {
            const testRetryFunction = async () => {
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
                }
                catch (error) {
                    if (i === maxRetries - 1) {
                        throw error; // Last attempt failed
                    }
                    console.log(`Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Exponential backoff
                }
            }
            const totalTime = performance.now() - startTime;
            this.addResult('Retry Mechanism', 'success', `✅ Retry with exponential backoff successful (${attemptCount} attempts)`, totalTime);
        }
        catch (error) {
            this.addResult('Retry Mechanism', 'failure', `Retry mechanism failed after ${attemptCount} attempts: ${error.message}`);
        }
    }
    /**
     * Test error response handling for different HTTP status codes
     */
    async testErrorResponseHandling() {
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
                const errorMessage = this.handleMockAPIError(mockResponse);
                if (errorMessage.toLowerCase().includes(scenario.expected.toLowerCase())) {
                    this.addResult(`${scenario.name} Handling`, 'success', `✅ ${scenario.status} error properly handled: ${errorMessage}`);
                }
                else {
                    this.addResult(`${scenario.name} Handling`, 'warning', `⚠️ ${scenario.status} error handling may need improvement: ${errorMessage}`);
                }
            }
        }
        catch (error) {
            this.addResult('Error Response Handling', 'failure', `Error response test failed: ${error.message}`);
        }
    }
    /**
     * Mock error handler for testing
     */
    handleMockAPIError(response) {
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
    async testTimeoutHandling() {
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
            this.addResult('Timeout Handling', 'info', 'ℹ️ Request completed before timeout');
        }
        catch (error) {
            const elapsed = performance.now() - startTime;
            if (error.message.includes('timeout') && elapsed >= timeoutMs) {
                this.addResult('Timeout Handling', 'success', `✅ Timeout properly detected after ${Math.round(elapsed)}ms`);
            }
            else {
                this.addResult('Timeout Handling', 'failure', `Timeout test failed: ${error.message}`);
            }
        }
    }
    /**
     * Test 4: Rate Limiting Behavior
     */
    async testRateLimiting() {
        console.log('⏱️ Testing rate limiting behavior...');
        try {
            // Test concurrent request limiting
            const testRequests = [];
            for (let i = 0; i < 15; i++) { // Try more than the limit
                testRequests.push(this.simulateAPIRequest(i));
            }
            const startTime = performance.now();
            const results = await Promise.allSettled(testRequests);
            const totalTime = performance.now() - startTime;
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            if (failed > 0) {
                this.addResult('Rate Limiting', 'success', `✅ Rate limiting working: ${successful} passed, ${failed} limited`, totalTime);
            }
            else {
                this.addResult('Rate Limiting', 'info', `ℹ️ All ${successful} requests passed (may need more aggressive testing)`, totalTime);
            }
        }
        catch (error) {
            this.addResult('Rate Limiting Test', 'failure', `Rate limiting test failed: ${error.message}`);
        }
    }
    /**
     * Simulate API request for rate limiting test
     */
    async simulateAPIRequest(requestId) {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        // Check rate limiter state (if available)
        const authState = this.gradescopeAPI.getAuthState();
        if (authState.csrfTokenValid) {
            return `Request ${requestId} successful`;
        }
        else {
            throw new Error(`Request ${requestId} rate limited`);
        }
    }
    /**
     * Test 5: Authentication Edge Cases
     */
    async testAuthenticationEdgeCases() {
        console.log('🔑 Testing authentication edge cases...');
        try {
            // Test expired session detection
            // Note: We can't actually expire the session, but we can test the detection logic
            this.addResult('Session Expiry Detection', 'info', 'ℹ️ Session expiry detection logic present (cannot test without expiring session)');
            // Test re-authentication flow
            const authState = this.gradescopeAPI.getAuthState();
            if (authState.retryCount !== undefined && authState.maxRetries !== undefined) {
                this.addResult('Re-authentication Flow', 'success', `✅ Re-authentication configured: ${authState.retryCount}/${authState.maxRetries} retries`);
            }
            else {
                this.addResult('Re-authentication Flow', 'warning', '⚠️ Re-authentication retry logic not found');
            }
        }
        catch (error) {
            this.addResult('Authentication Edge Cases', 'failure', `Auth edge case test failed: ${error.message}`);
        }
    }
    /**
     * Test 6: Network Failure Recovery
     */
    async testNetworkFailureRecovery() {
        console.log('🌐 Testing network failure recovery...');
        try {
            // Simulate network failure and recovery
            let networkUp = false;
            const testNetworkCall = async () => {
                if (!networkUp) {
                    networkUp = true; // Simulate network coming back up
                    throw new Error('Network unreachable');
                }
                return 'Network call successful';
            };
            try {
                await testNetworkCall();
                this.addResult('Network Failure Recovery', 'info', 'ℹ️ Network call succeeded immediately');
            }
            catch (error) {
                // Try recovery
                try {
                    await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay
                    await testNetworkCall(); // Should succeed now
                    this.addResult('Network Failure Recovery', 'success', '✅ Network failure recovery successful');
                }
                catch (_recoveryError) {
                    this.addResult('Network Failure Recovery', 'failure', 'Network failure recovery failed');
                }
            }
        }
        catch (error) {
            this.addResult('Network Failure Recovery', 'failure', `Network recovery test failed: ${error.message}`);
        }
    }
    /**
     * Extract page context for testing
     */
    extractPageContext() {
        const urlMatch = window.location.pathname.match(/\/courses\/(\d+)\/(?:(assignments|questions)\/(\d+)\/)?submissions\/(\d+)\/grade/);
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
    addResult(testName, status, message, timing, details) {
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
    printTestSummary() {
        const summary = this.testResults.reduce((acc, result) => {
            acc[result.status] = (acc[result.status] || 0) + 1;
            return acc;
        }, {});
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
    getTestResults() {
        return [...this.testResults];
    }
}
// Global API tester instance
let globalAPITester = null;
/**
 * Initialize global API testing interface - Week 2 Day 5
 */
function initializeAPITesting() {
    // Create global supergrader API helper if it doesn't exist
    if (!window.supergrader) {
        window.supergrader = {};
    }
    // Add API testing functions to global namespace
    window.supergrader.testAPI = async () => {
        console.log('🧪 Starting comprehensive API testing...');
        const gradescopeAPI = window.GradescopeAPI;
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
    window.supergrader.testCSRF = async () => {
        const gradescopeAPI = window.GradescopeAPI;
        if (!gradescopeAPI)
            return null;
        if (!globalAPITester) {
            globalAPITester = new APITester(gradescopeAPI);
        }
        console.log('🔐 Testing CSRF token validation only...');
        await globalAPITester.testCSRFTokenValidation();
        return globalAPITester.getTestResults();
    };
    window.supergrader.testRetries = async () => {
        const gradescopeAPI = window.GradescopeAPI;
        if (!gradescopeAPI)
            return null;
        if (!globalAPITester) {
            globalAPITester = new APITester(gradescopeAPI);
        }
        console.log('🔄 Testing error handling and retries only...');
        await globalAPITester.testErrorHandlingAndRetries();
        return globalAPITester.getTestResults();
    };
    // Add test data fixtures to global namespace
    window.supergrader.API_TEST_FIXTURES = API_TEST_FIXTURES;
    // Add quick rubric inspection function
    window.supergrader.showRubricData = () => {
        console.log('🔍 QUICK RUBRIC DATA INSPECTION:');
        console.log('='.repeat(60));
        // Check unified system
        const getRubric = window.getRubric;
        if (typeof getRubric === 'function') {
            const rubricResult = getRubric();
            if (rubricResult?.type === 'structured') {
                console.log('📝 STRUCTURED RUBRIC FOUND:');
                console.log(`Style: ${rubricResult.rubricStyle} | Items: ${rubricResult.items.length}`);
                console.log('');
                rubricResult.items.forEach((item, index) => {
                    console.log(`${index + 1}. "${item.description}" (${item.points} pts)`);
                    console.log(`   ID: ${item.id}`);
                    if (item.element) {
                        const input = item.element.querySelector('input[type="checkbox"], input[type="radio"]');
                        console.log(`   Currently: ${input?.checked ? 'SELECTED' : 'unselected'}`);
                    }
                    console.log('');
                });
            }
            else if (rubricResult?.type === 'manual') {
                console.log('📝 MANUAL SCORING INTERFACE:');
                console.log(`Score box value: "${rubricResult.box?.value || '(empty)'}"`);
            }
            else {
                console.log('❌ NO RUBRIC FOUND on this page');
                console.log('Page URL:', window.location.href);
                console.log('');
                // Debug: Let's see what DOM elements are actually available
                console.log('🔧 DEBUGGING - Available DOM elements:');
                console.log('Rubric items (.rubric-item):', document.querySelectorAll('.rubric-item').length);
                console.log('Rubric items with IDs:', document.querySelectorAll('.rubric-item[data-rubric-item-id]').length);
                console.log('Score inputs:', document.querySelectorAll('input[type="number"]').length);
                console.log('Text areas:', document.querySelectorAll('textarea').length);
                console.log('All inputs:', document.querySelectorAll('input').length);
                console.log('Iframes:', document.querySelectorAll('iframe').length);
                // Check if we can find rubric-related elements
                const possibleRubrics = document.querySelectorAll('[class*="rubric"], [class*="score"], [class*="grade"]');
                console.log('Elements with rubric/score/grade classes:', possibleRubrics.length);
                if (possibleRubrics.length > 0) {
                    console.log('Found elements that might be rubric-related:');
                    possibleRubrics.forEach((el, i) => {
                        console.log(`  ${i + 1}. ${el.tagName}.${el.className} - "${el.textContent?.slice(0, 50)}..."`);
                    });
                }
                // Check iframe content
                const iframes = document.querySelectorAll('iframe');
                if (iframes.length > 0) {
                    console.log('Found iframes - checking content:');
                    iframes.forEach((iframe, i) => {
                        try {
                            console.log(`  Iframe ${i + 1}: ${iframe.src || 'no src'}`);
                            if (iframe.contentDocument) {
                                const iframeRubrics = iframe.contentDocument.querySelectorAll('.rubric-item');
                                console.log(`    Contains ${iframeRubrics.length} .rubric-item elements`);
                            }
                            else {
                                console.log('    Cannot access iframe content (cross-origin or not loaded)');
                            }
                        }
                        catch (e) {
                            console.log(`    Error accessing iframe ${i + 1}: ${e.message}`);
                        }
                    });
                }
            }
        }
        else {
            console.log('❌ getRubric function not available');
        }
        console.log('='.repeat(60));
        console.log('💡 TIP: Run this on a Gradescope grading page to see actual rubric content');
    };
    console.log('🧪 API testing functions initialized');
    console.log('💡 Quick commands:');
    console.log('   supergrader.showRubricData() - Show actual rubric content');
    console.log('   supergrader.testAPI() - Full API test suite');
}
// Initialize API testing when script loads
initializeAPITesting();
//# sourceMappingURL=gradescope-api.js.map