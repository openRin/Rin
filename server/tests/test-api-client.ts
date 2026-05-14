import type { Hono } from "hono";

interface ApiResponse<T> {
    data?: T;
    error?: {
        status: number;
        value: unknown;
    };
}

interface AuthApi {
    login(credentials: { username: string; password: string }): Promise<ApiResponse<{
        success: boolean;
        token: string;
        user: {
            id: number;
            username: string;
            permission: boolean;
        };
    }>>;
    status(): Promise<ApiResponse<{
        github: boolean;
        password: boolean;
    }>>;
}

interface TestClient {
    auth: AuthApi;
}

interface FetchableApp {
    fetch(request: Request, env?: Env): Response | Promise<Response>;
}

/**
 * Create a test client for Hono app with auth namespace
 */
export function createTestClient(app: Hono | FetchableApp, env: Env): TestClient {
    const baseUrl = "http://localhost";
    const fetchableApp = app as FetchableApp;

    return {
        auth: {
            async login(credentials: { username: string; password: string }): Promise<ApiResponse<any>> {
                const req = new Request(`${baseUrl}/auth/login`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(credentials),
                });
                const res = await fetchableApp.fetch(req, env);
                const data = await res.json().catch(() => null);
                
                if (res.ok) {
                    return { data };
                } else {
                    return {
                        error: {
                            status: res.status,
                            value: data,
                        },
                    };
                }
            },

            async status(): Promise<ApiResponse<any>> {
                const req = new Request(`${baseUrl}/auth/status`, {
                    method: "GET",
                });
                const res = await fetchableApp.fetch(req, env);
                const data = await res.json().catch(() => null);
                
                if (res.ok) {
                    return { data };
                } else {
                    return {
                        error: {
                            status: res.status,
                            value: data,
                        },
                    };
                }
            },
        },
    };
}
