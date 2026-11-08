import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import type { Server } from 'http';
import { LogLevel, logger } from '../core/logging/Logger';
import { env } from './config/env';
import { assertJwtSecretsForBoot, usesDefaultJwtSecrets } from './config/authSecrets';
import { errorMiddleware } from './middleware/error.middleware';
import { createJsonBodyParserMiddleware } from './middleware/jsonBodyParser.middleware';
import { securityHeadersMiddleware } from './middleware/securityHeaders.middleware';
import { resolveRequestId } from './requestId';
import { recordEventRequestAls } from './domain/client-context/requestAls';

export type BaseMiddlewareOptions = {
  resolveHttpMethodLogId: (req: Request) => string;
  sanitizeClientPayloadForLog: (payload: unknown) => {
    sanitized: unknown;
    stats: Record<string, number> | null;
  };
};

export const createApp = (): Express => express();

export const applyBaseMiddleware = (app: Express, options: BaseMiddlewareOptions): void => {
  app.use(securityHeadersMiddleware);
  app.use(compression({
    threshold: 1024,
    filter: (req, res) => {
      const contentType = String(res.getHeader('content-type') || '');
      if (contentType.includes('text/event-stream')) {
        return false;
      }
      // Content-hashed build output under /assets/ never changes for a given filename and is
      // pre-gzip/brotli-compressed at build time (see createPrecompressedAssetsMiddleware below);
      // re-compressing it live on every cache-miss request wastes CPU/threadpool for no benefit.
      if (req.path.startsWith('/assets/')) {
        return false;
      }
      if (req.path === '/api/boot') {
        return false;
      }
      return compression.filter(req, res);
    },
  }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    const requestId = resolveRequestId(req.headers['x-request-id']);
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    recordEventRequestAls.run({ req }, next);
  });
  app.use((req, res, next) => {
    const requestPath = req.originalUrl.split('?')[0] || '';
    if (requestPath.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    }
    next();
  });
  app.use(createJsonBodyParserMiddleware());
  app.use((error: any, _req: Request, res: Response, next: NextFunction) => {
    if (error?.type === 'entity.too.large') {
      res.status(413).json({ success: false, error: 'Uploaded payload is too large.' });
      return;
    }
    next(error);
  });

  app.use((req, res, next) => {
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const requestPath = req.originalUrl.split('?')[0] || '';
      if (!requestPath.startsWith('/api')) {
        return;
      }

      const methodLogId = options.resolveHttpMethodLogId(req);
      if (!logger.shouldLogMethod(methodLogId, LogLevel.INFO)) {
        return;
      }

      const durationMs = Number((process.hrtime.bigint() - startedAt) / BigInt(1_000_000));
      const actor = req.auth?.email
        ? req.auth.email
        : (typeof req.body?.email === 'string' ? req.body.email : 'anonymous');
      const callSuccess = res.statusCode < 400;
      const failureReason = callSuccess ? null : `HTTP ${res.statusCode}`;

      const includeRequestPayload = logger.shouldLogMethod(methodLogId, LogLevel.DEBUG);
      const logMeta: Record<string, unknown> = {
        methodId: methodLogId,
        correlationId: req.requestId,
        requestId: req.requestId,
        actor,
        success: callSuccess,
        failureReason,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip,
        userId: req.auth?.userId,
        impersonatorId: req.impersonatorId,
      };

      if (includeRequestPayload) {
        const headersForLog: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(req.headers)) {
          const normalizedKey = key.toLowerCase();
          if (normalizedKey === 'cookie' || normalizedKey === 'authorization') {
            headersForLog[key] = '[REDACTED]';
            continue;
          }
          headersForLog[key] = value;
        }

        const payloadForLog: Record<string, unknown> = {
          headers: headersForLog,
          params: req.params,
          query: req.query,
          body: req.body,
        };
        const { sanitized: sanitizedPayload, stats: payloadOmissions } = options.sanitizeClientPayloadForLog(payloadForLog);
        logMeta.requestPayload = sanitizedPayload;
        logMeta.requestPayloadOmissions = payloadOmissions;
      }

      logger.info('HTTP', `${req.method} ${req.originalUrl}`, logMeta);
    });
    next();
  });

  assertJwtSecretsForBoot(env.isProduction);
  if (usesDefaultJwtSecrets()) {
    logger.warn('Server', 'Using default JWT secrets. Configure platform security settings for production.');
  }
};

const IMMUTABLE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const STATIC_ASSET_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const PRECOMPRESSED_CONTENT_TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

/**
 * Serves the .br/.gz siblings generated by scripts/precompress-dist-assets.ts for /assets/
 * requests, so the immutable, content-hashed build output never has to be gzipped live (see the
 * `compression` filter above). Falls through to the plain file (via express.static) when no
 * precompressed sibling exists — e.g. a dev build that skipped the precompress step.
 */
export const createPrecompressedAssetsMiddleware = (distPath: string) => (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }

  const pathname = req.path;
  if (!pathname.startsWith('/assets/')) {
    next();
    return;
  }

  const ext = path.extname(pathname);
  const contentType = PRECOMPRESSED_CONTENT_TYPES[ext];
  if (!contentType) {
    next();
    return;
  }

  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  const candidates: Array<{ encoding: 'br' | 'gzip'; suffix: string }> = [];
  if (acceptEncoding.includes('br')) {
    candidates.push({ encoding: 'br', suffix: '.br' });
  }
  if (acceptEncoding.includes('gzip')) {
    candidates.push({ encoding: 'gzip', suffix: '.gz' });
  }

  const relativePath = pathname.replace(/^\/assets\//, '');
  for (const candidate of candidates) {
    const filePath = path.join(distPath, 'assets', `${relativePath}${candidate.suffix}`);
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Encoding', candidate.encoding);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('Cache-Control', `public, max-age=${Math.floor(IMMUTABLE_MAX_AGE_MS / 1000)}, immutable`);
      res.sendFile(filePath);
      return;
    }
  }

  next();
};

/** Serve a Vite build output: content-hashed files under assets/ cached immutable, HTML never cached. */
export const createSpaDistStaticHandler = (distPath: string) => express.static(distPath, {
  setHeaders: (res, filePath) => {
    const normalized = filePath.replace(/\\/g, '/');
    if (normalized.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
      return;
    }
    if (normalized.includes('/assets/')) {
      res.setHeader('Cache-Control', `public, max-age=${Math.floor(IMMUTABLE_MAX_AGE_MS / 1000)}, immutable`);
    }
  },
  maxAge: STATIC_ASSET_MAX_AGE_MS,
});

/** Serve platform asset roots (fonts, PWA icons, package assets) with a multi-day cache. */
export const createPlatformAssetStaticHandler = (rootPath: string) => express.static(rootPath, {
  maxAge: STATIC_ASSET_MAX_AGE_MS,
});

export const applyErrorMiddleware = (app: Express): void => {
  app.use(errorMiddleware);
};

export type GracefulShutdownOptions = {
  timeoutMs?: number;
  onCleanup?: () => Promise<void>;
};

export const setupGracefulShutdown = (
  server: Server,
  options: GracefulShutdownOptions = {},
): void => {
  const timeoutMs = options.timeoutMs ?? 10_000;
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info('Server', `Received ${signal}, shutting down gracefully…`);

    const forceExitTimer = setTimeout(() => {
      logger.error('Server', 'Graceful shutdown timed out; forcing exit.');
      process.exit(1);
    }, timeoutMs);
    forceExitTimer.unref?.();

    server.close(() => {
      void (async () => {
        try {
          await options.onCleanup?.();
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          logger.warn('Server', `Shutdown cleanup error: ${message}`);
        } finally {
          clearTimeout(forceExitTimer);
          process.exit(0);
        }
      })();
    });
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
};

export type ListenResult = {
  port: number;
  server: Server;
};

export type ListenHost = '127.0.0.1' | '::' | '0.0.0.0';

export const listenOnAvailablePort = async (
  app: Express,
  initialPort: number,
  maxAttempts = 25,
  /**
   * Dev should prefer `127.0.0.1`. On Windows, leftover browser tabs on `http://localhost`
   * reconnect via `::1` the instant the port opens and stampede Vite transforms until
   * `/api/boot` starves ("server up, page never loads"). Binding IPv4-loopback only
   * ignores those tabs; open `http://127.0.0.1:<port>` after Ready.
   */
  host: ListenHost = '127.0.0.1',
): Promise<ListenResult> => new Promise((resolve, reject) => {
  const tryListen = (port: number, attempt: number, bindHost: ListenHost = host) => {
    const server = app.listen({
      port,
      host: bindHost,
      ipv6Only: false,
    });

    server.once('listening', () => {
      resolve({ port, server });
    });

    server.once('error', (err: NodeJS.ErrnoException) => {
      server.close();
      if ((err.code === 'EAFNOSUPPORT' || err.code === 'EADDRNOTAVAIL') && bindHost === '::') {
        logger.warn('Server', 'IPv6 listen unavailable; falling back to 0.0.0.0.');
        tryListen(port, attempt, '0.0.0.0');
        return;
      }
      if (err.code === 'EADDRINUSE' && attempt < maxAttempts) {
        const nextPort = port + 1;
        logger.warn('Server', `Port ${port} is already in use. Retrying on port ${nextPort}...`);
        tryListen(nextPort, attempt + 1, bindHost);
        return;
      }
      reject(err);
    });
  };

  tryListen(initialPort, 0);
});
