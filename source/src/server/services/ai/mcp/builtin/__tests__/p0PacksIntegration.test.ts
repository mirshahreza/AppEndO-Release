import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPhase1ToolRegistry } from '../../../../../../core/ai/tools/ToolRegistry';
import { DRAFT_FILE_PATCH_TOOL_NAME } from '../../../../../../core/ai/tools/native/draftFilePatch';
import { GIT_STATUS_TOOL_NAME } from '../../../../../../core/ai/tools/native/git/gitTools';
import { READ_FILE_TOOL_NAME } from '../../../../../../core/ai/tools/native/readFile';
import { SEARCH_CODEBASE_TOOL_NAME } from '../../../../../../core/ai/tools/native/searchCodebase';
import {
  getAiCapabilityPack,
  P0_CAPABILITY_PACK_IDS,
} from '../../../../../../shared/api/contracts/ai/capabilityPacks';
import { FETCH_URL_TOOL_NAME } from '../webTools';
import { HTTP_REQUEST_TOOL_NAME } from '../httpTools';
import {
  AGENT_PACK_TOOL_GROUPS,
  createAgentPackRegistry,
  createPackTestWorkspace,
  expectPackToolsRegistered,
  listRegistryToolNames,
  registerPacks,
  type PackTestWorkspace,
} from '../testSupport/packTestHarness';

const P0_AGENT_ONLY_TOOL_NAMES = P0_CAPABILITY_PACK_IDS.flatMap((packId) =>
  getAiCapabilityPack(packId).toolNames.filter((name) => name !== DRAFT_FILE_PATCH_TOOL_NAME),
);

describe('M2g-1 P0 packs integration', () => {
  describe('registration and scope', () => {
    it('registers all P0 pack tools when every P0 pack is enabled', () => {
      const registry = createAgentPackRegistry();
      registerPacks(registry, P0_CAPABILITY_PACK_IDS);

      P0_CAPABILITY_PACK_IDS.forEach((packId) => {
        expectPackToolsRegistered(registry, packId);
      });
    });

    it('exposes only scoped packs (files + codebase default smoke)', () => {
      const registry = createAgentPackRegistry();
      registerPacks(registry, ['appendo-files', 'appendo-codebase']);

      const names = listRegistryToolNames(registry);
      expect(names).toContain(READ_FILE_TOOL_NAME);
      expect(names).toContain(SEARCH_CODEBASE_TOOL_NAME);
      expect(names).not.toContain(GIT_STATUS_TOOL_NAME);
      expect(names).not.toContain(FETCH_URL_TOOL_NAME);
      expect(names).not.toContain(HTTP_REQUEST_TOOL_NAME);
    });
  });

  describe('plan mode policy', () => {
    it('blocks P0 agent tools in plan mode (draft_file_patch remains allowed)', () => {
      const registry = createPhase1ToolRegistry('plan', AGENT_PACK_TOOL_GROUPS);
      registerPacks(registry, P0_CAPABILITY_PACK_IDS);

      const names = listRegistryToolNames(registry);
      P0_AGENT_ONLY_TOOL_NAMES.forEach((toolName) => {
        expect(names).not.toContain(toolName);
      });
      expect(names).toContain(DRAFT_FILE_PATCH_TOOL_NAME);
    });
  });

  describe('callable smoke (one per P0 pack)', () => {
    let workspace: PackTestWorkspace;

    beforeEach(() => {
      workspace = createPackTestWorkspace({ withGit: true });
    });

    afterEach(() => {
      workspace.dispose();
    });

    it('appendo-files: read_file returns workspace content', async () => {
      const registry = createAgentPackRegistry();
      registerPacks(registry, ['appendo-files']);

      const result = await registry.execute(
        READ_FILE_TOOL_NAME,
        { path: 'src/shared/ui/AppTableGrid.tsx' },
        {},
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data?.content).toContain('AppTableGrid');
      }
    });

    it('appendo-codebase: search_codebase finds sample symbol', async () => {
      const registry = createAgentPackRegistry();
      registerPacks(registry, ['appendo-codebase']);

      const result = await registry.execute(SEARCH_CODEBASE_TOOL_NAME, { query: 'AppTableGrid' }, {});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(
          result.data?.matches?.some((match: { path: string }) => match.path.includes('AppTableGrid.tsx')),
        ).toBe(true);
      }
    });

    it('appendo-git: git_status succeeds in fixture repo', async () => {
      const registry = createAgentPackRegistry();
      registerPacks(registry, ['appendo-git']);

      const result = await registry.execute(GIT_STATUS_TOOL_NAME, {}, {});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data?.output).toContain('branch');
      }
    });

    it('appendo-web: fetch_url blocks localhost (SSRF)', async () => {
      const registry = createAgentPackRegistry();
      registerPacks(registry, ['appendo-web']);

      const result = await registry.execute(FETCH_URL_TOOL_NAME, { url: 'http://localhost/secret' }, {});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('url_blocked');
      }
    });

    it('appendo-http: http_request rejects outbound call without allowlist', async () => {
      const registry = createAgentPackRegistry();
      registerPacks(registry, ['appendo-http']);

      const result = await registry.execute(
        HTTP_REQUEST_TOOL_NAME,
        { method: 'GET', url: 'https://example.com/api' },
        {},
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(['http_allowlist_empty', 'hostname_not_allowlisted']).toContain(result.error);
      }
    });
  });
});
