import type { ErrorRequestHandler } from 'express';
import { getAsyncHandlerFallbackMessage } from '../utils/asyncHandler';
import { sendHttpError } from '../utils/controllerHttp';

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const fallbackMessage = getAsyncHandlerFallbackMessage(error) || 'Internal server error.';
  sendHttpError(res, error, fallbackMessage);
};
