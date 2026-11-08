import path from 'path';
import express, { type Express, type Request } from 'express';
import { logger } from '../../core/logging/Logger';
import {
  canAccessFunctionDoc,
} from '../../shared/api/openapi/buildManagedFunctionOpenApi';
import { HttpError } from '../errors/HttpError';
import { openApiSpecService } from '../services/openApiSpec.service';
import { refreshOpenApiDocumentationCaches } from '../services/openApiDocRefresh';
import { toAccessibleRouteListItem } from '../services/openApiRouteCatalog';
import { toFunctionDocAccessPrincipal } from '../utils/functionDocAccess';
import { formatDisplayDateYmd } from '../../shared/lib/gridDateFormat';

const swaggerUiDistPath = path.join(process.cwd(), 'node_modules/swagger-ui-dist');

const shouldRefreshFromQuery = (req: Request): boolean => {
  const value = req.query.refresh;
  return value === '1' || value === 'true';
};

type SwaggerUiRenderOptions = {
  functionId?: string;
};

const renderSwaggerUiHtml = (
  openApiUrl: string,
  title: string,
  options: SwaggerUiRenderOptions = {},
): string => {
  const statusUrl = options.functionId
    ? `/api/docs/status?functionId=${encodeURIComponent(options.functionId)}`
    : '/api/docs/status';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="/api/docs/swagger-ui/swagger-ui.css" />
    <style>
      html { box-sizing: border-box; overflow-y: scroll; }
      *, *:before, *:after { box-sizing: inherit; }
      body { margin: 0; background: #fafafa; }

      .swagger-ui .topbar {
        background: linear-gradient(90deg, #0f766e 0%, #0d9488 48%, #14b8a6 100%);
        border-bottom: 1px solid rgba(15, 23, 42, 0.12);
        padding: 0;
      }

      .swagger-ui .topbar .topbar-wrapper {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        max-width: none;
        padding: 10px 18px;
      }

      .swagger-ui .topbar .download-url-wrapper {
        flex: 1 1 220px;
        min-width: 0;
      }

      .appemdo-docs-meta {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-left: auto;
      }

      .appemdo-docs-version {
        position: relative;
        display: flex;
        align-items: stretch;
        gap: 10px;
        padding: 8px 12px 8px 10px;
        border-radius: 12px;
        background:
          linear-gradient(145deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.08) 100%);
        border: 1px solid rgba(255, 255, 255, 0.34);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.34),
          0 10px 24px rgba(15, 23, 42, 0.12);
        backdrop-filter: blur(8px);
        min-width: 13.5rem;
        overflow: hidden;
      }

      .appemdo-docs-version::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 3px;
        background: linear-gradient(180deg, #fef08a 0%, #ffffff 55%, #99f6e4 100%);
        border-radius: 12px 0 0 12px;
      }

      .appemdo-docs-version-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        margin-top: 1px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.18);
        border: 1px solid rgba(255, 255, 255, 0.28);
        color: #ffffff;
        flex-shrink: 0;
      }

      .appemdo-docs-version-icon svg {
        width: 16px;
        height: 16px;
      }

      .appemdo-docs-version-body {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        min-width: 0;
      }

      .appemdo-docs-version-head {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
      }

      .appemdo-docs-version-label {
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.88);
      }

      .appemdo-docs-version-live {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 1px 7px 1px 5px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.18);
        border: 1px solid rgba(255, 255, 255, 0.2);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.92);
      }

      .appemdo-docs-version-live::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: #6ee7b7;
        box-shadow: 0 0 0 2px rgba(110, 231, 183, 0.28);
      }

      #appemdo-docs-generated-at {
        display: flex;
        flex-direction: column;
        gap: 1px;
        font-variant-numeric: tabular-nums;
        line-height: 1.15;
        color: #ffffff;
        min-width: 0;
      }

      .appemdo-docs-version-date {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.01em;
        white-space: nowrap;
      }

      .appemdo-docs-version-clock {
        font-size: 11px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.86);
        white-space: nowrap;
      }

      #appemdo-docs-route-count {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.16);
        border: 1px solid rgba(255, 255, 255, 0.22);
        font-size: 10px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.92);
      }

      #appemdo-docs-route-count::before {
        content: '';
        width: 5px;
        height: 5px;
        border-radius: 999px;
        background: #ffffff;
        opacity: 0.85;
      }

      @media (max-width: 860px) {
        .appemdo-docs-meta {
          width: 100%;
          margin-left: 0;
          justify-content: space-between;
        }

        .appemdo-docs-version {
          min-width: 0;
          flex: 1 1 auto;
        }

        .appemdo-docs-version-body {
          align-items: flex-start;
        }
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api/docs/swagger-ui/swagger-ui-bundle.js" crossorigin></script>
    <script src="/api/docs/swagger-ui/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
      (function () {
        const specUrl = ${JSON.stringify(openApiUrl)};
        const statusUrl = ${JSON.stringify(statusUrl)};

        const versionIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

        const formatGeneratedAtParts = function (iso) {
          if (!iso) {
            return { date: 'Not generated yet', time: '—' };
          }
          const date = new Date(iso);
          if (Number.isNaN(date.getTime())) {
            return { date: 'Not generated yet', time: '—' };
          }
          return {
            date: formatDisplayDateYmd(iso),
            time: date.toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          };
        };

        const formatGeneratedAt = function (iso) {
          const parts = formatGeneratedAtParts(iso);
          return parts.date + ' · ' + parts.time;
        };

        let generatedAtEl = null;
        let routeCountEl = null;

        const setGeneratedAt = function (iso) {
          if (!generatedAtEl) {
            return;
          }
          const parts = formatGeneratedAtParts(iso);
          generatedAtEl.innerHTML = ''
            + '<span class="appemdo-docs-version-date">' + parts.date + '</span>'
            + '<span class="appemdo-docs-version-clock">' + parts.time + '</span>';
          generatedAtEl.setAttribute('datetime', iso || '');
          generatedAtEl.setAttribute('title', formatGeneratedAt(iso));
        };

        const setRouteCount = function (count) {
          if (!routeCountEl) {
            return;
          }
          if (typeof count === 'number' && count > 0) {
            routeCountEl.textContent = count + ' route' + (count === 1 ? '' : 's');
            routeCountEl.hidden = false;
          } else {
            routeCountEl.hidden = true;
          }
        };

        const syncStatus = async function () {
          const response = await fetch(statusUrl, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
          });
          if (!response.ok) {
            return;
          }
          const payload = await response.json();
          if (payload && payload.generatedAt) {
            setGeneratedAt(payload.generatedAt);
          }
          if (payload && typeof payload.routeCount === 'number') {
            setRouteCount(payload.routeCount);
          }
        };

        const mountDocsToolbar = function () {
          const topbarWrapper = document.querySelector('.swagger-ui .topbar .topbar-wrapper');
          if (!topbarWrapper || document.getElementById('appemdo-docs-version')) {
            return;
          }

          const meta = document.createElement('div');
          meta.className = 'appemdo-docs-meta';
          meta.innerHTML = ''
            + '<div id="appemdo-docs-version" class="appemdo-docs-version">'
            + '  <div class="appemdo-docs-version-icon">' + versionIcon + '</div>'
            + '  <div class="appemdo-docs-version-body">'
            + '    <div class="appemdo-docs-version-head">'
            + '      <span class="appemdo-docs-version-label">Documentation version</span>'
            + '      <span class="appemdo-docs-version-live">Live</span>'
            + '    </div>'
            + '    <time id="appemdo-docs-generated-at">'
            + '      <span class="appemdo-docs-version-date">Loading…</span>'
            + '      <span class="appemdo-docs-version-clock">—</span>'
            + '    </time>'
            + '    <span id="appemdo-docs-route-count" hidden></span>'
            + '  </div>'
            + '</div>';

          topbarWrapper.appendChild(meta);

          generatedAtEl = document.getElementById('appemdo-docs-generated-at');
          routeCountEl = document.getElementById('appemdo-docs-route-count');

          void syncStatus();
        };

        window.onload = function () {
          window.ui = SwaggerUIBundle({
            url: specUrl,
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
            layout: 'StandaloneLayout',
            onComplete: mountDocsToolbar,
          });
        };
      })();
    </script>
  </body>
</html>`;
};

const assertFunctionDocAccess = async (req: Request, functionId: string): Promise<void> => {
  const fn = await openApiSpecService.findFunctionInput(functionId);
  if (!fn) {
    throw new HttpError(404, 'Function not found.');
  }

  const principal = toFunctionDocAccessPrincipal(req);
  if (!canAccessFunctionDoc(principal, fn)) {
    throw new HttpError(403, 'Forbidden.');
  }
};

export const mountDocsRoutes = (app: Express): void => {
  app.use('/api/docs/swagger-ui', express.static(swaggerUiDistPath, { index: false }));

  app.get('/api/docs/status', async (req, res, next) => {
    try {
      const principal = toFunctionDocAccessPrincipal(req);
      const functionId = typeof req.query.functionId === 'string' && req.query.functionId.trim()
        ? req.query.functionId.trim()
        : undefined;

      if (functionId) {
        await assertFunctionDocAccess(req, functionId);
      }

      const status = await openApiSpecService.getDocsStatusForPrincipal(principal, functionId);
      res.json({ success: true, ...status });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/docs/refresh', async (req, res, next) => {
    try {
      const functionId = typeof req.query.functionId === 'string' && req.query.functionId.trim()
        ? req.query.functionId.trim()
        : undefined;

      if (functionId) {
        await assertFunctionDocAccess(req, functionId);
        refreshOpenApiDocumentationCaches(functionId);
      } else {
        refreshOpenApiDocumentationCaches();
      }

      const principal = toFunctionDocAccessPrincipal(req);
      const status = await openApiSpecService.getDocsStatusForPrincipal(principal, functionId);

      res.json({
        success: true,
        refreshedAt: status.generatedAt ?? new Date().toISOString(),
        routeCount: status.routeCount,
        scope: status.scope,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/docs/routes', async (req, res, next) => {
    try {
      if (shouldRefreshFromQuery(req)) {
        refreshOpenApiDocumentationCaches();
      }

      const principal = toFunctionDocAccessPrincipal(req);
      const routes = await openApiSpecService.listAccessibleRoutesForPrincipal(principal);
      const items = routes
        .map(toAccessibleRouteListItem)
        .sort((left, right) => (
          left.path.localeCompare(right.path)
          || left.method.localeCompare(right.method)
          || left.name.localeCompare(right.name)
        ));
      res.json({ success: true, items, count: items.length });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/docs/openapi.json', async (req, res, next) => {
    try {
      if (shouldRefreshFromQuery(req)) {
        refreshOpenApiDocumentationCaches();
      }

      const spec = await openApiSpecService.getAggregatedSpecForPrincipal(
        toFunctionDocAccessPrincipal(req),
      );
      res.json(spec);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/docs/routes/:functionId([^/]+)/openapi.json', async (req, res, next) => {
    try {
      await assertFunctionDocAccess(req, req.params.functionId);

      if (shouldRefreshFromQuery(req)) {
        refreshOpenApiDocumentationCaches(req.params.functionId);
      }

      const spec = await openApiSpecService.getFunctionSpec(req.params.functionId);
      if (!spec) {
        res.status(404).json({ success: false, error: 'Function not found.' });
        return;
      }
      res.json(spec);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/docs/routes/:functionId([^/]+)', async (req, res, next) => {
    try {
      await assertFunctionDocAccess(req, req.params.functionId);
      const fn = await openApiSpecService.findFunctionInput(req.params.functionId);
      if (!fn) {
        res.status(404).json({ success: false, error: 'Function not found.' });
        return;
      }
      res.type('html').send(renderSwaggerUiHtml(
        `/api/docs/routes/${encodeURIComponent(req.params.functionId)}/openapi.json`,
        `${fn.name} — Route Doc`,
        { functionId: req.params.functionId },
      ));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/docs', (_req, res) => {
    res.type('html').send(renderSwaggerUiHtml(
      '/api/docs/openapi.json',
      'AppEndO API Docs',
    ));
  });

  logger.info('Server', 'Mounted OpenAPI docs routes at /api/docs');
};
