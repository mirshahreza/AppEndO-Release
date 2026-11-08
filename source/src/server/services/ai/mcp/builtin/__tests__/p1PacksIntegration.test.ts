import { describe, expect, it, vi } from 'vitest';
import { createPhase1ToolRegistry } from '../../../../../../core/ai/tools/ToolRegistry';
import { DRAFT_COMPONENT_LAYOUT_TOOL_NAME } from '../../../../../../core/ai/tools/native/draftComponentLayout';
import { DRAFT_SERVER_FUNCTION_TOOL_NAME } from '../../../../../../core/ai/tools/native/draftServerFunction';
import { GET_PAGE_CONTEXT_TOOL_NAME } from '../../../../../../core/ai/tools/native/getPageContext';
import { GET_PROJECT_STANDARDS_TOOL_NAME } from '../../../../../../core/ai/tools/native/getProjectStandards';
import {
  getAiCapabilityPack,
  P1_CAPABILITY_PACK_IDS,
} from '../../../../../../shared/api/contracts/ai/capabilityPacks';
import {
  AGENT_PACK_TOOL_GROUPS,
  createAgentPackRegistry,
  expectPackToolsRegistered,
  listRegistryToolNames,
  registerPacks,
} from '../testSupport/packTestHarness';

const P1_FORMAL_PACK_IDS = ['appendo-standards', 'appendo-context', 'appendo-designer'] as const;

describe('M2g-1.1 P1 formal packs integration', () => {
  describe('registration and scope', () => {
    it('registers standards, context, and designer tools when each pack is enabled', () => {
      P1_FORMAL_PACK_IDS.forEach((packId) => {
        const registry = createAgentPackRegistry();
        registerPacks(registry, [packId]);
        expectPackToolsRegistered(registry, packId);
      });
    });

    it('exposes only scoped P1 packs', () => {
      const registry = createAgentPackRegistry();
      registerPacks(registry, ['appendo-standards']);

      const names = listRegistryToolNames(registry);
      expect(names).toContain(GET_PROJECT_STANDARDS_TOOL_NAME);
      expect(names).not.toContain(GET_PAGE_CONTEXT_TOOL_NAME);
      expect(names).not.toContain(DRAFT_COMPONENT_LAYOUT_TOOL_NAME);
    });

    it('registers all P1 catalog packs when every P1 pack is enabled', () => {
      const registry = createAgentPackRegistry();
      registerPacks(registry, P1_CAPABILITY_PACK_IDS);

      P1_CAPABILITY_PACK_IDS.forEach((packId) => {
        expectPackToolsRegistered(registry, packId);
      });
    });
  });

  describe('plan mode policy', () => {
    it('allows standards and summarize_context in plan mode', () => {
      const registry = createPhase1ToolRegistry('plan', AGENT_PACK_TOOL_GROUPS);
      registerPacks(registry, ['appendo-standards', 'appendo-context']);

      const names = listRegistryToolNames(registry);
      expect(names).toContain(GET_PROJECT_STANDARDS_TOOL_NAME);
      expect(names).toContain('summarize_context');
      expect(names).not.toContain(GET_PAGE_CONTEXT_TOOL_NAME);
    });

    it('blocks designer draft tools in plan mode', () => {
      const registry = createPhase1ToolRegistry('plan', AGENT_PACK_TOOL_GROUPS);
      registerPacks(registry, ['appendo-designer']);

      const names = listRegistryToolNames(registry);
      getAiCapabilityPack('appendo-designer').toolNames.forEach((toolName) => {
        expect(names).not.toContain(toolName);
      });
    });
  });

  describe('callable smoke (one per formalized P1 pack)', () => {
    it('appendo-standards: get_project_standards returns standards payload', async () => {
      const registry = createAgentPackRegistry();
      registerPacks(registry, ['appendo-standards']);

      const result = await registry.execute(GET_PROJECT_STANDARDS_TOOL_NAME, { query: 'grid' }, {});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data?.standards).toBeDefined();
        expect(Array.isArray(result.data?.standards)).toBe(true);
      }
    });

    it('appendo-context: get_page_context returns narrative when page context exists', async () => {
      const registry = createAgentPackRegistry();
      registerPacks(registry, ['appendo-context']);

      const result = await registry.execute(
        GET_PAGE_CONTEXT_TOOL_NAME,
        {},
        {
          pageContext: {
            path: '/client-components',
            pageLabel: 'Component Designer',
            layoutId: 'users-grid',
          },
        },
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data?.narrative).toContain('Component Designer');
      }
    });

    it('appendo-context: summarize_context compresses history via context memory', async () => {
      const registry = createAgentPackRegistry();
      registerPacks(registry, ['appendo-context']);

      const summarizeHistory = vi.fn(() => ({
        ok: true,
        summary: 'Compressed earlier turns.',
        prunedCount: 4,
      }));

      const result = await registry.execute(
        'summarize_context',
        { maxChars: 2000 },
        { contextMemory: { summarizeHistory } },
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.summary).toContain('Compressed');
        expect(summarizeHistory).toHaveBeenCalledWith(2000);
      }
    });

    it('appendo-designer: draft_component_layout creates a draft artifact', async () => {
      const registry = createAgentPackRegistry();
      registerPacks(registry, ['appendo-designer']);

      const result = await registry.execute(
        DRAFT_COMPONENT_LAYOUT_TOOL_NAME,
        { name: 'Test Users Grid' },
        {},
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data?.layoutId).toBe('test-users-grid');
        expect(result.artifacts?.[0]?.kind).toBe('draft');
      }
    });

    it('appendo-designer: draft_server_function creates a draft artifact', async () => {
      const registry = createAgentPackRegistry();
      registerPacks(registry, ['appendo-designer']);

      const result = await registry.execute(
        DRAFT_SERVER_FUNCTION_TOOL_NAME,
        {
          name: 'List Users',
          source: 'export async function handler() { return { success: true }; }',
        },
        {},
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data?.functionId).toBe('general.list-users');
        expect(result.artifacts?.[0]?.kind).toBe('draft');
      }
    });
  });
});
