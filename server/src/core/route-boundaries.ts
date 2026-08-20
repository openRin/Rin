import { validateSchema } from "@rin/api";
import type { Schema, SchemaValidationIssue } from "@rin/api";
import type { AppContext } from "./hono-types";

type RouteResult = Response | Promise<Response>;
type RouteHandler = (c: AppContext) => RouteResult;

interface GuardResponseOptions {
    message?: string;
    status?: 401 | 403;
    format?: 'text' | 'json';
}

interface JsonValidationOptions {
    errorMessage?: (issues: SchemaValidationIssue[]) => string;
    format?: 'text' | 'json';
}

function guardResponse(c: AppContext, options: GuardResponseOptions) {
    const message = options.message ?? 'Unauthorized';
    const status = options.status ?? 401;
    return options.format === 'json'
        ? c.json({ error: message }, status)
        : c.text(message, status);
}

export function adminOnly(handler: RouteHandler, options: GuardResponseOptions = {}): RouteHandler {
    return (c) => {
        if (!c.get('admin')) {
            return guardResponse(c, options);
        }
        return handler(c);
    };
}

export function userOnly(
    handler: (c: AppContext, uid: number) => RouteResult,
    options: GuardResponseOptions = {},
): RouteHandler {
    return (c) => {
        const uid = c.get('uid');
        if (!uid) {
            return guardResponse(c, options);
        }
        return handler(c, uid);
    };
}

function validationResponse(c: AppContext, issues: SchemaValidationIssue[], options: JsonValidationOptions) {
    const message = options.errorMessage?.(issues) ?? issues[0]?.message ?? 'Invalid request body';
    return options.format === 'json'
        ? c.json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message,
                details: issues,
            },
        }, 400)
        : c.text(message, 400);
}

export function withJsonBody<T>(
    schema: Schema,
    handler: (c: AppContext, body: T) => RouteResult,
    options: JsonValidationOptions = {},
): RouteHandler {
    return async (c) => {
        let value: unknown;
        try {
            value = await c.req.json();
        } catch {
            return validationResponse(c, [{ path: '', message: 'Invalid JSON body' }], options);
        }

        const result = validateSchema<T>(schema, value);
        if (!result.success) {
            return validationResponse(c, result.issues, options);
        }

        return handler(c, result.data);
    };
}
