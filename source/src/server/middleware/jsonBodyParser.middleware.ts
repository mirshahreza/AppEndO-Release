import express, { type RequestHandler } from 'express';

export const DEFAULT_JSON_BODY_LIMIT = '5mb';
export const MEDIUM_JSON_BODY_LIMIT = '20mb';
export const LARGE_JSON_BODY_LIMIT = '100mb';

/** Upload-heavy surfaces (zip/package/binary payloads encoded in JSON). */
const LARGE_JSON_BODY_PATH_PREFIXES = [
  '/api/component-designer',
  '/api/packages',
  '/api/file-manager',
  '/api/cms',
  '/api/crm',
];

/** Surfaces with occasional big-but-bounded payloads (base64 avatars, fonts, AI context, function source). */
const MEDIUM_JSON_BODY_PATH_PREFIXES = [
  '/api/users',
  '/api/profile',
  '/api/settings',
  '/api/ai',
  '/api/hwy',
  '/api/core/server-functions',
];

const defaultJsonParser = express.json({ limit: DEFAULT_JSON_BODY_LIMIT });
const mediumJsonParser = express.json({ limit: MEDIUM_JSON_BODY_LIMIT });
const largeJsonParser = express.json({ limit: LARGE_JSON_BODY_LIMIT });

const matchesPrefix = (pathname: string, prefixes: readonly string[]): boolean => (
  prefixes.some((prefix) => (
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  ))
);

const isMultipartRequest = (req: { headers: { 'content-type'?: string | string[] } }): boolean => {
  const raw = req.headers['content-type'];
  const contentType = Array.isArray(raw) ? raw[0] : raw;
  return typeof contentType === 'string' && contentType.toLowerCase().includes('multipart/form-data');
};

export const createJsonBodyParserMiddleware = (): RequestHandler => (
  req,
  res,
  next,
) => {
  if (isMultipartRequest(req)) {
    next();
    return;
  }
  const pathname = (req.originalUrl || req.url || '').split('?')[0] || '';
  if (matchesPrefix(pathname, LARGE_JSON_BODY_PATH_PREFIXES)) {
    largeJsonParser(req, res, next);
    return;
  }
  if (matchesPrefix(pathname, MEDIUM_JSON_BODY_PATH_PREFIXES)) {
    mediumJsonParser(req, res, next);
    return;
  }
  defaultJsonParser(req, res, next);
};
