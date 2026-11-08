import {
  loadPageEditLockManifest,
} from '../../../../shared/lib/operatorPageEditLockCodegen';
import {
  evaluatePageEditLockForFile,
  extractExplicitPageKeysFromPrompt,
  summarizePageEditLockPolicy,
} from '../../../../shared/lib/operatorPageEditLock';
import { loadFeatureGraph } from '../../../../shared/lib/featureGraphStore';
import type { NativeToolDefinition } from '../ToolRegistry';

export const GET_OPERATOR_PAGE_EDIT_LOCKS_TOOL_NAME = 'get_operator_page_edit_locks';

export const getOperatorPageEditLocksTool: NativeToolDefinition = {
  name: GET_OPERATOR_PAGE_EDIT_LOCKS_TOOL_NAME,
  description:
    'Returns operator page edit-lock policy (all-locked by default), manifest summary, and optional prompt/file checks. Use before editing page-scoped code. Example: get_operator_page_edit_locks({ promptText: "fix users grid" }).',
  group: 'search',
  parameters: {
    type: 'object',
    properties: {
      pageKey: {
        type: 'string',
        description: 'Optional — return one manifest entry.',
      },
      promptText: {
        type: 'string',
        description: 'Optional — list page keys explicitly named in this operator prompt.',
      },
      filePath: {
        type: 'string',
        description: 'Optional repo-relative path — evaluate whether edits are allowed with promptText.',
      },
    },
  },
  execute: async (args) => {
    let manifest;
    try {
      manifest = loadPageEditLockManifest();
    } catch {
      return {
        ok: false,
        summary: 'Page edit lock manifest missing. Run npm run codegen:ai-index.',
        error: 'page_edit_lock_manifest_missing',
      };
    }

    const pageKey = typeof args.pageKey === 'string' ? args.pageKey.trim() : '';
    const promptText = typeof args.promptText === 'string' ? args.promptText : '';
    const filePath = typeof args.filePath === 'string' ? args.filePath.trim() : '';

    const policy = summarizePageEditLockPolicy(manifest);

    if (pageKey) {
      const entry = manifest.pages.find((p) => p.pageKey.toLowerCase() === pageKey.toLowerCase());
      if (!entry) {
        return {
          ok: false,
          summary: `No manifest entry for pageKey "${pageKey}".`,
          error: 'page_key_not_found',
        };
      }
      return {
        ok: true,
        summary: `Page edit lock entry for ${entry.pageKey}.`,
        data: { policy, entry },
      };
    }

    const explicitPageKeys = promptText
      ? extractExplicitPageKeysFromPrompt(promptText, manifest)
      : undefined;

    let fileEvaluation;
    if (filePath && promptText) {
      let graph;
      try {
        graph = loadFeatureGraph();
      } catch {
        graph = undefined;
      }
      fileEvaluation = evaluatePageEditLockForFile({
        filePath,
        promptText,
        manifest,
        graph,
      });
    }

    return {
      ok: true,
      summary: `Page edit lock policy ${policy.policy} (${policy.pageCount} pages).`,
      data: {
        policy,
        pageKeys: manifest.pages.map((p) => p.pageKey),
        explicitPageKeys,
        fileEvaluation,
        manifestPointer: policy.manifestPointer,
      },
    };
  },
};
