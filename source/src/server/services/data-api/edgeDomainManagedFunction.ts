/**
 * Trusted Edge domain-action runner for managed functions.
 *
 * Used when metadataJson.origin === 'edge-domain-action'.
 * Executes developer-authored TypeScript on the main thread with
 * `resolvePublishedEdgeModel` (Sequelize) — not SANDBOX db.query.
 *
 * Package Phase 2 domain logic (CRM merge / change-stage / …) uses this path.
 */

import vm from 'vm';
import type { Request, Response } from 'express';
import { Op, QueryTypes } from 'sequelize';
import { transpileSandboxSource } from '../package-runtime/sandboxTranspile';
import type { ManagedFunctionExecutionRecord } from '../server-function.service';
import {
  configureDataApiPublishedRuntime,
  resolvePublishedEdgeModel,
} from './dataApiPublishedRuntime';
import type { StoredDataSource } from '../../db/dataSourcesStore';

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

export const isEdgeDomainActionManagedFunction = (
  record: ManagedFunctionExecutionRecord,
): boolean => {
  const raw = record.metadataJson ?? record.metadata_json;
  const meta = typeof raw === 'string'
    ? (() => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    })()
    : raw;
  const recordMeta = asRecord(meta);
  return recordMeta?.origin === 'edge-domain-action';
};

type RunOptions = {
  getDataSources: () => StoredDataSource[];
};

export const runEdgeDomainActionManagedFunction = async (
  req: Request,
  res: Response,
  record: ManagedFunctionExecutionRecord,
  params: Record<string, string>,
  options: RunOptions,
): Promise<void> => {
  configureDataApiPublishedRuntime(options.getDataSources);

  const source = String(record.code || '').trim();
  if (!source) {
    res.status(500).json({
      success: false,
      error: 'Edge domain action source is empty.',
    });
    return;
  }

  const transpiled = await transpileSandboxSource(source, `${record.folder || 'domain'}.${record.name || 'action'}.ts`);

  let responseCaptured = false;
  const sandboxRes = {
    json: (data: unknown) => {
      responseCaptured = true;
      if (!res.headersSent) {
        res.json(data);
      }
      return data;
    },
    status: (statusCode: number) => {
      res.status(Number(statusCode) || 200);
      return sandboxRes;
    },
    send: (data: unknown) => {
      responseCaptured = true;
      if (!res.headersSent) {
        res.send(data);
      }
      return data;
    },
    get headersSent() {
      return res.headersSent || responseCaptured;
    },
  };

  const sandbox = {
    req: {
      body: req.body,
      query: req.query,
      params: { ...req.params, ...params },
      method: req.method,
      headers: req.headers,
      auth: req.auth,
    },
    res: sandboxRes,
    params,
    console: {
      log: (...args: unknown[]) => console.log('[Edge Domain Action]', ...args),
      error: (...args: unknown[]) => console.error('[Edge Domain Action]', ...args),
    },
    resolvePublishedEdgeModel,
    Op,
    QueryTypes,
    module: { exports: {} as Record<string, unknown> },
    exports: {} as Record<string, unknown>,
  };
  (sandbox as { exports: Record<string, unknown> }).exports = sandbox.module.exports;

  try {
    let executable = transpiled
      .replace(/\s*\(async\s*\(\)\s*=>\s*\{\s*await handler\(\);\s*\}\)\(\);?\s*$/g, '')
      .replace(/\s*void handler\(\);?\s*$/g, '')
      .replace(/\s*await handler\(\);?\s*$/g, '');
    const wrapped = /\bhandler\b/.test(executable)
      ? `(async () => {\n${executable}\n  await handler();\n})()`
      : `(async () => {\n${executable}\n})()`;
    const script = new vm.Script(wrapped, {
      filename: `edge-domain:${record.id || 'action'}.js`,
    });
    const context = vm.createContext(sandbox);
    const result = script.runInContext(context, {
      timeout: Number(record.timeoutMs || record.timeout_ms) || 30_000,
    });
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      await result;
    }
    if (!responseCaptured && !res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Edge domain action finished without sending a response.',
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: message });
    }
  }
};
