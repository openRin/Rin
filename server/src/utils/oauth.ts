import { Elysia } from "elysia";

export interface OAuthProvider {
    name: string;
    clientId: string;
    clientSecret: string;
    redirectUri?: string;
    authorizeUrl: string;
    tokenUrl: string;
    scopes: string[];
}

export interface OAuthToken {
    accessToken: string;
    tokenType: string;
    scope?: string;
    expiresIn?: number;
    refreshToken?: string;
}

export interface GitHubConfig {
    clientId: string;
    clientSecret: string;
    redirectUri?: string;
}

export class GitHubProvider implements OAuthProvider {
    name = "GitHub";
    clientId: string;
    clientSecret: string;
    redirectUri?: string;
    authorizeUrl = "https://github.com/login/oauth/authorize";
    tokenUrl = "https://github.com/login/oauth/access_token";
    scopes: string[] = ["read:user"];

    constructor(config: GitHubConfig) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.redirectUri = config.redirectUri;
    }
}

export interface OAuth2Methods {
    redirect: (providerName: string, scopes?: string[]) => Response;
    authorize: (providerName: string, code?: string) => Promise<OAuthToken>;
    verifyState: (state: string) => boolean;
    getStateData: (state: string) => { provider: string; timestamp: number } | undefined;
    removeState: (state: string) => void;
}

export function createOAuthPlugin(providers: Record<string, OAuthProvider>) {
    const stateStore = new Map<string, { provider: string; timestamp: number }>();

    // Clean up expired states (older than 10 minutes)
    const cleanupExpiredStates = () => {
        const now = Date.now();
        const expiryTime = 10 * 60 * 1000; // 10 minutes
        for (const [state, data] of stateStore.entries()) {
            if (now - data.timestamp > expiryTime) {
                stateStore.delete(state);
            }
        }
    };

    // Generate random state string
    const generateState = (): string => {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
    };

    return new Elysia({ name: "oauth2" })
        .decorate("oauth2", {
            createRedirectUrl: (providerName: string): string => {
                const provider = providers[providerName];
                if (!provider) {
                    throw new Error(`OAuth provider "${providerName}" not found`);
                }

                cleanupExpiredStates();

                const state = generateState();
                stateStore.set(state, {
                    provider: providerName,
                    timestamp: Date.now(),
                });

                const params = new URLSearchParams({
                    client_id: provider.clientId,
                    state: state,
                });

                // if (provider.redirectUri) {
                    // params.set("redirect_uri", provider.redirectUri);
                // }

                return `${provider.authorizeUrl}?${params.toString()}`;
            },

            authorize: async (providerName: string, code?: string): Promise<OAuthToken> => {
                const provider = providers[providerName];
                if (!provider) {
                    throw new Error(`OAuth provider "${providerName}" not found`);
                }

                if (!code) {
                    throw new Error("Authorization code is required");
                }

                const params = new URLSearchParams({
                    client_id: provider.clientId,
                    client_secret: provider.clientSecret,
                    code: code,
                });

                if (provider.redirectUri) {
                    params.set("redirect_uri", provider.redirectUri);
                }

                const response = await fetch(provider.tokenUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        Accept: "application/json",
                    },
                    body: params.toString(),
                });

                if (!response.ok) {
                    throw new Error(`Failed to exchange code for token: ${response.statusText}`);
                }

                const data = await response.json() as {
                    access_token: string;
                    token_type?: string;
                    scope?: string;
                    expires_in?: number;
                    refresh_token?: string;
                };

                return {
                    accessToken: data.access_token,
                    tokenType: data.token_type || "Bearer",
                    scope: data.scope,
                    expiresIn: data.expires_in,
                    refreshToken: data.refresh_token,
                };
            },

            verifyState: (state: string): boolean => {
                cleanupExpiredStates();
                return stateStore.has(state);
            },

            getStateData: (state: string) => {
                return stateStore.get(state);
            },

            removeState: (state: string) => {
                stateStore.delete(state);
            },
        });
}
