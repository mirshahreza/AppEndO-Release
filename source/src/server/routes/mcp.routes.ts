import { Router, type Express } from 'express';
import {
  handleInboundMcpDelete,
  handleInboundMcpGet,
  handleInboundMcpPost,
} from '../services/ai/mcp/inbound/mcpInboundHost.service';
import { requireInboundMcpApiKey } from '../services/ai/mcp/inbound/mcpInboundAuth';

export const mountMcpRoutes = (app: Express): void => {
  const router = Router();

  router.get('/', requireInboundMcpApiKey, (req, res) => {
    void handleInboundMcpGet(req, res);
  });
  router.post('/', requireInboundMcpApiKey, (req, res) => {
    void handleInboundMcpPost(req, res);
  });
  router.delete('/', requireInboundMcpApiKey, (req, res) => {
    void handleInboundMcpDelete(req, res);
  });

  app.use('/api/mcp', router);
};
