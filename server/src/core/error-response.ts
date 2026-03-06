import type { Context } from "hono";
import type { RinApp } from "./app-types";

export function registerErrorHandlers(app: RinApp) {
  app.notFound((c: Context) => {
    return c.json(
      {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Route ${c.req.method} ${c.req.path} not found`,
        },
      },
      404,
    );
  });

  app.onError((err: Error, c: Context) => {
    console.error("Error:", err);

    const error = err as Error & {
      code?: string;
      statusCode?: number;
      details?: unknown;
    };

    if (error.code && error.statusCode) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        error.statusCode as 200,
      );
    }

    return c.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: err.message || "An unexpected error occurred",
        },
      },
      500,
    );
  });
}
