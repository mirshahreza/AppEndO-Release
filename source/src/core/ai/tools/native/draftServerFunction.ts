import type { NativeToolDefinition } from '../ToolRegistry';
import { resolveServerFunctionDraftMetadata } from '../../serverFunctionManualParity';
import { resolveServerFunctionDraftOperation } from '../../serverFunctionDraftOperation';
import { normalizeSandboxSource } from '../../../../shared/server-functions/sandboxSourceNormalize';
import type { ToolExecutionContext } from '../../agent/types';
import { createDraftId, findServerFunctionDraftByFunctionId, upsertServerFunctionDraft } from './agentDraftStore';

export const DRAFT_SERVER_FUNCTION_TOOL_NAME = 'draft_server_function';

export const resolveDraftServerFunctionId = (
  name: string,
  folder?: string,
  existingFunctionId?: string,
): string => resolveServerFunctionDraftMetadata({
  name,
  folder,
  functionId: existingFunctionId,
}).functionId;

export const executeDraftServerFunction = async (
  args: Record<string, unknown>,
  context: ToolExecutionContext = {},
) => {
  const name = typeof args.name === 'string' ? args.name.trim() : '';
  if (!name) {
    return { ok: false as const, summary: 'Function name is required.', error: 'missing_name' };
  }

  const source = typeof args.source === 'string' ? args.source : '';
  if (!source.trim()) {
    return { ok: false as const, summary: 'Function source code is required.', error: 'missing_source' };
  }

  const metadata = resolveServerFunctionDraftMetadata({
    name,
    folder: typeof args.folder === 'string' ? args.folder : undefined,
    method: typeof args.method === 'string' ? args.method : undefined,
    path: typeof args.path === 'string' ? args.path : undefined,
    testPayload: typeof args.testPayload === 'string' ? args.testPayload : undefined,
    functionId: typeof args.functionId === 'string' ? args.functionId : undefined,
  });
  const normalizedSource = normalizeSandboxSource(source);
  const draftId = createDraftId();
  const pageFunctionId = context.pageContext?.functionId?.trim();
  const explicitFunctionId = typeof args.functionId === 'string' ? args.functionId.trim() : '';
  const { operation, baseFunctionId } = resolveServerFunctionDraftOperation({
    targetFunctionId: metadata.functionId,
    pageFunctionId,
    explicitFunctionId: explicitFunctionId || undefined,
  });

  const existingDraft = findServerFunctionDraftByFunctionId(metadata.functionId);
  let beforeSource = existingDraft?.beforeSource;
  if (!beforeSource && operation === 'update') {
    try {
      const { findManagedFunctionById } = await import('../../../../server/domain/functions/functionRepository');
      const existing = await findManagedFunctionById(metadata.functionId);
      if (existing?.code) {
        beforeSource = existing.code;
      }
    } catch {
      // Best-effort baseline for diff preview.
    }
  }

  const draft = upsertServerFunctionDraft({
    kind: 'server_function',
    id: draftId,
    functionId: metadata.functionId,
    name: metadata.name,
    folder: metadata.folder,
    method: metadata.method,
    path: metadata.path,
    testPayload: metadata.testPayload,
    source: normalizedSource,
    beforeSource,
    baseFunctionId,
    operation,
  });

  return {
    ok: true as const,
    summary: `Drafted server function "${metadata.name}" (${metadata.functionId}) at ${metadata.path}.`,
    data: {
      draftId: draft.id,
      functionId: draft.functionId,
      name: draft.name,
      folder: draft.folder,
      method: draft.method,
      path: draft.path,
      lineCount: draft.source.split(/\r?\n/).length,
    },
    artifacts: [{ kind: 'draft' as const, id: draft.id, label: draft.name }],
  };
};

export const draftServerFunctionTool: NativeToolDefinition = {
  name: DRAFT_SERVER_FUNCTION_TOOL_NAME,
  description: 'Drafts a managed Server Function through the same path as the Server Functions UI Save (workspace/server-functions/custom). Use when creating or updating API handlers — never use draft_file_patch for functions. Returns draftId, functionId, route metadata, and a draft artifact. Example: draft_server_function({ name: "sum-two-numbers", folder: "math", method: "POST", source: "<handler ts>" }).',
  group: 'draft',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Function slug/name (e.g. sum-two-numbers)' },
      source: { type: 'string', description: 'Full TypeScript sandbox source (global req/res + async function handler — export default is auto-normalized)' },
      folder: { type: 'string', description: 'API folder segment (e.g. math, users). Default: general' },
      method: { type: 'string', description: 'HTTP method: GET | POST | PUT | DELETE | PATCH' },
      path: { type: 'string', description: 'Route path. Default: /api/{folder}/{name}' },
      testPayload: { type: 'string', description: 'JSON test payload for Test Console — put body fields at root (e.g. { "a": 1, "b": 2 }); use params/query only for path/query params' },
      functionId: { type: 'string', description: 'Existing managed id (folder.name) when patching' },
    },
    required: ['name', 'source'],
  },
  execute: executeDraftServerFunction,
};
