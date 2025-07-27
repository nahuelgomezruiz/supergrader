interface Settings {
    confidenceThreshold: number;
    autoApplyHighConfidence: boolean;
    backendUrl?: string;
    enabledForAssignment: boolean;
}
interface PopupMessage {
    action: 'updateStatus' | 'settingsChanged' | string;
    status?: string;
    type?: 'ready' | 'not-ready' | 'error';
    settings?: Settings;
}
declare let statusDiv: HTMLElement | null;
declare let enabledToggle: HTMLElement | null;
declare let toggleText: HTMLElement | null;
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