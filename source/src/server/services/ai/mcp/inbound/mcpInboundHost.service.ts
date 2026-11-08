import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createInboundMcpServer } from './createInboundMcpServer';
import { resolveInboundMcpCapabilityPackIds } from '../../mcpAccess.service';

type InboundMcpSession = {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
};

const sessions = new Map<string, InboundMcpSession>();

const jsonRpcError = (res: Response, status: number, message: string) => {
  if (res.headersSent) return;
  res.status(status).json({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message,
    },
    id: null,
  });
};

const getSession = (sessionId: string | undefined): InboundMcpSession | undefined => (
  sessionId ? sessions.get(sessionId) : undefined
);

export const handleInboundMcpPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    const existing = getSession(sessionId);

    if (existing) {
      await existing.transport.handleRequest(req, res, req.body);
      return;
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      const packIds = await resolveInboundMcpCapabilityPackIds();
      const server = createInboundMcpServer(packIds);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (initializedSessionId) => {
          sessions.set(initializedSessionId, { transport, server });
        },
      });

      transport.onclose = () => {
        const closedSessionId = transport.sessionId;
        if (closedSessionId) {
          sessions.delete(closedSessionId);
        }
      };

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    jsonRpcError(res, 400, 'Bad Request: No valid session ID provided');
  } catch {
    jsonRpcError(res, 500, 'Internal server error');
  }
};

export const handleInboundMcpGet = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    const existing = getSession(sessionId);
    if (!existing) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    await existing.transport.handleRequest(req, res);
  } catch {
    if (!res.headersSent) {
      res.status(500).send('Internal server error');
    }
  }
};

export const handleInboundMcpDelete = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    const existing = getSession(sessionId);
    if (!existing) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    await existing.transport.handleRequest(req, res);
    if (sessionId) {
      sessions.delete(sessionId);
    }
  } catch {
    if (!res.headersSent) {
      res.status(500).send('Error processing session termination');
    }
  }
};

export const resetInboundMcpSessionsForTests = (): void => {
  sessions.clear();
};

export const getInboundMcpSessionCountForTests = (): number => sessions.size;
