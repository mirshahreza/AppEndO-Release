import type { Response } from 'express';
import { isHttpError } from '../errors/HttpError';

export const sendJsonBody = (res: Response, body: unknown): void => {
  if (res.headersSent) {
    return;
  }

  res.json(body);
};

export const sendHttpError = (res: Response, error: unknown, fallbackMessage: string) => {
  if (res.headersSent) {
    return;
  }
  if (isHttpError(error)) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      ...error.body,
    });
    return;
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  res.status(500).json({ success: false, error: message || fallbackMessage });
};
