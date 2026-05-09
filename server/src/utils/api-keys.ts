function bytesToHex(buffer: ArrayBuffer) {
    return Array.from(new Uint8Array(buffer))
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
}

type ApiKeyRouteRule = {
    method: string;
    pattern: RegExp;
    scope: string;
};

const API_KEY_ROUTE_RULES: ApiKeyRouteRule[] = [
    { method: "GET", pattern: /^\/feed(?:\/timeline)?$/, scope: "content:read" },
    { method: "GET", pattern: /^\/feed\/[^/]+$/, scope: "content:read" },
    { method: "POST", pattern: /^\/feed$/, scope: "content:write" },
    { method: "POST", pattern: /^\/feed\/[^/]+$/, scope: "content:write" },
    { method: "DELETE", pattern: /^\/feed\/[^/]+$/, scope: "content:write" },
    { method: "POST", pattern: /^\/moments$/, scope: "moments:write" },
    { method: "POST", pattern: /^\/storage$/, scope: "media:write" },
];

export async function hashApiKey(secret: string): Promise<string> {
    const encoder = new TextEncoder();
    return bytesToHex(await crypto.subtle.digest("SHA-256", encoder.encode(secret)));
}

export function generateApiKeySecret() {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    return `rin_${bytesToHex(bytes.buffer)}`;
}

export function getApiKeyPrefix(secret: string) {
    return secret.slice(0, 12);
}

export function parseApiKeyScopes(value: string | null | undefined) {
    if (!value) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((scope): scope is string => typeof scope === "string") : [];
    } catch {
        return [];
    }
}

export function getRequiredApiKeyScope(method: string, path: string) {
    const normalizedMethod = method.toUpperCase();

    for (const rule of API_KEY_ROUTE_RULES) {
        if (rule.method === normalizedMethod && rule.pattern.test(path)) {
            return rule.scope;
        }
    }

    return null;
}

export function hasApiKeyScope(scopes: string[] | undefined, requiredScope: string) {
    return Array.isArray(scopes) && scopes.includes(requiredScope);
}
