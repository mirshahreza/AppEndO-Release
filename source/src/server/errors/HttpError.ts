export class HttpError extends Error {
  readonly statusCode: number;

  readonly body: Record<string, unknown>;

  constructor(statusCode: number, message: string, body: Record<string, unknown> = {}) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

export const isHttpError = (error: unknown): error is HttpError => error instanceof HttpError;
