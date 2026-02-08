const TOKEN_KEY = 'rin_auth_token';

export function getAuthToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function removeAuthToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

export function headersWithAuth(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    const token = getAuthToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
}