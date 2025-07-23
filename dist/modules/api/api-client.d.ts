import { AuthManager } from '../auth/auth-manager';
export declare class APIClient {
    private authManager;
    constructor(authManager: AuthManager);
    /**
     * Make authenticated request
     */
    makeRequest(url: string, options?: RequestInit): Promise<Response>;
    /**
     * Make GET request
     */
    get(url: string): Promise<Response>;
    /**
     * Make POST request
     */
    post(url: string, data?: any): Promise<Response>;
    /**
     * Make PUT request
     */
    put(url: string, data?: any): Promise<Response>;
    /**
     * Make DELETE request
     */
    delete(url: string): Promise<Response>;
}
//# sourceMappingURL=api-client.d.ts.map