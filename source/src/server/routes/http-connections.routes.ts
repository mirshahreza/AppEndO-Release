import { Router, type Express } from 'express';
import { createBuiltInRouteGuard } from '../middleware/builtInFunctionAccess.middleware';
import { parseOpenApiConnectorSpec } from '../../shared/lib/openApiConnectorSpec';
import { validateMcpRemoteUrl, createSsrfGuardedFetch } from '../services/ai/mcp/mcpUrlGuard';
import {
  createHttpConnection,
  deleteHttpConnection,
  getHttpConnectionRecord,
  getHttpConnectionSummary,
  listHttpConnections,
  updateHttpConnection,
  type HttpConnectionAuthKind,
} from '../services/http-connections/httpConnectionStore';
import { callHttpConnection } from '../services/http-connections/httpConnectionExecutor';

const VALID_AUTH_KINDS: HttpConnectionAuthKind[] = ['none', 'apiKey', 'bearer', 'basic'];
const isValidAuthKind = (value: unknown): value is HttpConnectionAuthKind => (
  typeof value === 'string' && (VALID_AUTH_KINDS as string[]).includes(value)
);

const ssrfGuardedFetch = createSsrfGuardedFetch();

export const mountHttpConnectionRoutes = (app: Express): void => {
  const routeGuard = createBuiltInRouteGuard('ADMIN');
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ success: true, items: listHttpConnections() });
  });

  router.get('/:id', (req, res) => {
    const item = getHttpConnectionSummary(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: 'Connection not found.' });
      return;
    }
    res.json({ success: true, item });
  });

  router.post('/parse-spec', async (req, res) => {
    const specUrl = typeof req.body?.specUrl === 'string' ? req.body.specUrl.trim() : '';
    const specText = typeof req.body?.specText === 'string' ? req.body.specText : '';

    try {
      let raw = specText;
      if (!raw && specUrl) {
        const url = await validateMcpRemoteUrl(specUrl);
        const response = await ssrfGuardedFetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
          res.status(400).json({ success: false, error: `Failed to fetch spec: HTTP ${response.status}` });
          return;
        }
        raw = await response.text();
      }
      if (!raw.trim()) {
        res.status(400).json({ success: false, error: 'Provide either specText or specUrl.' });
        return;
      }
      const parsed = parseOpenApiConnectorSpec(raw);
      res.json({ success: true, spec: parsed });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to parse OpenAPI spec.';
      res.status(400).json({ success: false, error: message });
    }
  });

  router.post('/', async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }
    const name = String(req.body?.name || '').trim();
    const baseUrl = String(req.body?.baseUrl || '').trim();
    const authKind = req.body?.authKind;
    if (!name || !baseUrl || !isValidAuthKind(authKind)) {
      res.status(400).json({ success: false, error: 'name, baseUrl and a valid authKind are required.' });
      return;
    }
    const item = await createHttpConnection({
      name,
      baseUrl,
      authKind,
      apiKeyHeaderName: typeof req.body?.apiKeyHeaderName === 'string' ? req.body.apiKeyHeaderName.trim() : undefined,
      basicUsername: typeof req.body?.basicUsername === 'string' ? req.body.basicUsername.trim() : undefined,
      secretPlaintext: typeof req.body?.secretPlaintext === 'string' ? req.body.secretPlaintext : undefined,
      openApiSpec: req.body?.openApiSpec,
      createdByUserId: userId,
    });
    res.json({ success: true, item });
  });

  router.patch('/:id', async (req, res) => {
    const patch = req.body || {};
    const authKind = patch.authKind !== undefined ? patch.authKind : undefined;
    if (authKind !== undefined && !isValidAuthKind(authKind)) {
      res.status(400).json({ success: false, error: 'Invalid authKind.' });
      return;
    }
    const item = await updateHttpConnection(req.params.id, {
      ...(patch.name !== undefined ? { name: String(patch.name).trim() } : {}),
      ...(patch.baseUrl !== undefined ? { baseUrl: String(patch.baseUrl).trim() } : {}),
      ...(authKind !== undefined ? { authKind } : {}),
      ...(patch.apiKeyHeaderName !== undefined ? { apiKeyHeaderName: patch.apiKeyHeaderName } : {}),
      ...(patch.basicUsername !== undefined ? { basicUsername: patch.basicUsername } : {}),
      ...(patch.secretPlaintext !== undefined ? { secretPlaintext: patch.secretPlaintext } : {}),
      ...(patch.openApiSpec !== undefined ? { openApiSpec: patch.openApiSpec } : {}),
    });
    if (!item) {
      res.status(404).json({ success: false, error: 'Connection not found.' });
      return;
    }
    res.json({ success: true, item });
  });

  router.delete('/:id', async (req, res) => {
    const deleted = await deleteHttpConnection(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Connection not found.' });
      return;
    }
    res.json({ success: true });
  });

  router.post('/:id/call', async (req, res) => {
    const connection = getHttpConnectionRecord(req.params.id);
    if (!connection) {
      res.status(404).json({ success: false, error: 'Connection not found.' });
      return;
    }
    const operationId = String(req.body?.operationId || '').trim();
    if (!operationId) {
      res.status(400).json({ success: false, error: 'operationId is required.' });
      return;
    }
    try {
      const result = await callHttpConnection(connection, {
        operationId,
        pathParams: req.body?.pathParams,
        query: req.body?.query,
        body: req.body?.body,
      });
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'HTTP connection call failed.';
      res.status(502).json({ success: false, error: message });
    }
  });

  app.use('/api/http-connections', routeGuard, router);
};
