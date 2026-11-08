import type { NextFunction, Request, RequestHandler, Response } from 'express';

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

const FALLBACK_MESSAGE_KEY = '__asyncHandlerFallbackMessage';

export const getAsyncHandlerFallbackMessage = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const fallback = (error as Record<string, unknown>)[FALLBACK_MESSAGE_KEY];
  return typeof fallback === 'string' ? fallback : undefined;
};

export type AsyncHandlerOptions = {
  onError?: (error: unknown, req: Request, res: Response) => boolean;
};

const INNER_HANDLER_KEY = '__innerHandler';

export const asyncHandler = (
  handler: AsyncRequestHandler,
  fallbackMessage: string,
  options?: AsyncHandlerOptions,
): RequestHandler => {
  const wrapped: RequestHandler = (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((error: unknown) => {
      if (options?.onError?.(error, req, res)) {
        return;
      }

      if (error && typeof error === 'object') {
        Object.defineProperty(error, FALLBACK_MESSAGE_KEY, {
          value: fallbackMessage,
          enumerable: false,
          configurable: true,
        });
      }
      next(error);
    });
  };

  Object.defineProperty(wrapped, INNER_HANDLER_KEY, {
    value: handler,
    enumerable: false,
    configurable: true,
  });

  return wrapped;
};

/**
 * Route reflection (`systemApiRoutes.ts`'s `buildSystemFunctionRoutePreviewCode`, used by the
 * OpenAPI doc pipeline) resolves the Express route's terminal middleware and calls `.toString()`
 * on it to derive `code` for `parseServerFunctionScriptDoc`. For a route registered as
 * `asyncHandler(realHandler, fallbackMessage)`, that terminal middleware is this module's generic
 * wrapper closure, not `realHandler` — without this accessor, every asyncHandler-wrapped route
 * (hundreds, platform-wide) would be documented from the identical wrapper source instead of its
 * own logic.
 */
export const getAsyncHandlerInnerHandler = (fn: unknown): AsyncRequestHandler | null => {
  if (typeof fn !== 'function') {
    return null;
  }
  const inner = (fn as unknown as Record<string, unknown>)[INNER_HANDLER_KEY];
  return typeof inner === 'function' ? inner as AsyncRequestHandler : null;
};
