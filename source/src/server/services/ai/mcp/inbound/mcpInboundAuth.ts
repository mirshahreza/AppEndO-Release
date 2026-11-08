import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { aiManager } from '../../../../../core/ai/AiManager';

const hashApiKey = (value: string) => createHash('sha256').update(value).digest();

const safeEqualSecret = (provided: string, expected: string): boolean => {
  const providedHash = hashApiKey(provided);
  const expectedHash = hashApiKey(expected);
  return timingSafeEqual(providedHash, expectedHash);
};

export const extractInboundMcpApiKey = (req: Request): string | undefined => {
  const apiKeyHeader = req.header('x-api-key')?.trim();
  if (apiKeyHeader) return apiKeyHeader;

  const authorization = req.header('authorization')?.trim() ?? '';
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim() || undefined;
  }

  return undefined;
};

export const resolveInboundMcpHostConfig = () => aiManager.getSettings()?.mcp.inboundHost;

export const isInboundMcpHostReady = (): boolean => {
  const config = resolveInboundMcpHostConfig();
  return Boolean(config?.enabled && config.apiKey?.trim());
};

export const verifyInboundMcpApiKey = (providedKey: string | undefined): boolean => {
  const configuredKey = resolveInboundMcpHostConfig()?.apiKey?.trim();
  if (!configuredKey || !providedKey) return false;
  return safeEqualSecret(providedKey, configuredKey);
};

export const requireInboundMcpApiKey = (req: Request, res: Response, next: NextFunction) => {
  const config = resolveInboundMcpHostConfig();
  if (!config?.enabled) {
    res.status(503).json({
      success: false,
      error: 'Inbound MCP host is disabled.',
    });
    return;
  }

  if (!config.apiKey?.trim()) {
    res.status(503).json({
      success: false,
      error: 'Inbound MCP host API key is not configured.',
    });
    return;
  }

  const providedKey = extractInboundMcpApiKey(req);
  if (!verifyInboundMcpApiKey(providedKey)) {
    res.status(401).json({
      success: false,
      error: 'Invalid MCP API key.',
    });
    return;
  }

  next();
};
