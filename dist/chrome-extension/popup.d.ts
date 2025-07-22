interface Settings {
    autoApplyHighConfidence: boolean;
    confidenceThreshold: number;
    enabledForAssignment: boolean;
    backendUrl?: string;
}
interface PopupMessage {
    action: 'updateStatus' | string;
    status?: string;
    type?: 'ready' | 'not-ready' | 'error';
    settings?: Settings;
}
declare let statusDiv: HTMLElement | null;
declare let autoApplyToggle: HTMLElement | null;
declare let thresholdInput: HTMLInputElement | null;
declare let enabledToggle: HTMLElement | null;
declare let settingsBtn: HTMLButtonElement | null;
declare let helpBtn: HTMLButtonElement | null;
/**
 * Initialize popup functionality
 */
declare function initializePopup(): Promise<void>;
/**
 * Check if current tab is a Gradescope grading page
 */
declare function checkCurrentTab(): Promise<void>;
/**
 * Load settings from storage
 */
declare function loadSettings(): Promise<void>;
/**
 * Save settings to storage
 */
declare function saveSettings(): Promise<void>;
/**
 * Setup event listeners for UI interactions
 */
declare function setupEventListeners(): void;
/**
 * Utility function to update status display
 */
declare function updateStatus(message: string, type?: 'ready' | 'not-ready' | 'error'): void;
//# sourceMappingURL=popup.d.ts.map