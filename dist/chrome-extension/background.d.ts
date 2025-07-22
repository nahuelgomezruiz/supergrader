interface Settings {
    confidenceThreshold: number;
    autoApplyHighConfidence: boolean;
    backendUrl?: string;
    enabledForAssignment: boolean;
}
interface MessageRequest {
    action: 'getSettings' | 'updateSettings' | 'logEvent' | string;
    settings?: Partial<Settings>;
    event?: string;
    data?: any;
}
interface MessageResponse {
    success: boolean;
    settings?: Settings;
    error?: string;
}
/**
 * Get extension settings from storage
 */
declare function handleGetSettings(sendResponse: (response: MessageResponse) => void): void;
/**
 * Update extension settings in storage
 */
declare function handleUpdateSettings(settings: Partial<Settings>, sendResponse: (response: MessageResponse) => void): void;
/**
 * Log events for analytics and debugging
 */
declare function handleLogEvent(event: string, data?: any): void;
//# sourceMappingURL=background.d.ts.map