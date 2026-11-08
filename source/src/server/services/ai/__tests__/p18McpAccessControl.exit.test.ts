/**
 * p-18 exit criteria — MCP access control (M2h).
 * Consolidates scenarios from the historical p-18 MCP access control plan §18.6.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AI_SETTINGS } from '../../../../shared/api/contracts/ai/constants';
import { createPhase1ToolRegistry } from '../../../../core/ai/tools/ToolRegistry';
import { GIT_STATUS_TOOL_NAME } from '../../../../core/ai/tools/native/git/gitTools';
import { AGENT_CAPABILITY_UI_PACKS } from '../../../../shared/api/contracts/ai/capabilityPacks';
import { USER_DEFAULT_BUILTIN_PACK_IDS } from '../mcpAccessSeed';
import { registerBuiltinCapabilityPacks } from '../mcp/builtin';

const accessStore = vi.hoisted(() => ({
  userRoles: new Map<number, string[]>(),
  roleGrants: new Map<string, Array<{ resource_kind: string; resource_id: string }>>(),
}));

vi.mock('../../../domain/users/userRoleRepository', () => ({
  getUserRolesForRequest: async (userId: number, fallbackRole?: string) => {
    const roles = accessStore.userRoles.get(userId);
    if (roles && roles.length > 0) {
      return roles;
    }
    return fallbackRole ? [fallbackRole] : [];
  },
}));

vi.mock('../../../domain/ai/mcpAccessRepository', () => ({
  listRoleMcpGrantRows: async (roleNames: readonly string[]) => {
    const rows: Array<{
      id: number;
      role_name: string;
      resource_kind: string;
      resource_id: string;
    }> = [];
    let rowId = 1;
    roleNames.forEach((roleName) => {
      const grants = accessStore.roleGrants.get(roleName) ?? [];
      grants.forEach((grant) => {
        rows.push({
          id: rowId,
          role_name: roleName,
          resource_kind: grant.resource_kind,
          resource_id: grant.resource_id,
        });
        rowId += 1;
      });
    });
    return rows;
  },
  replaceRoleMcpGrants: vi.fn(async () => {}),
}));

const processAgentRunMock = vi.hoisted(() => vi.fn(async () => ({
  text: 'ok',
  modelId: 'test-model',
  iterationCount: 1,
  traces: [],
})));

vi.mock('../../../domain/ai/agentTraceRepository', () => ({
  insertAgentTraces: vi.fn(async () => {}),
}));

const USER_ID = 100;
const ADMIN_ID = 1;

const seedBuiltinGrants = (roleName: string, packIds: readonly string[]) => {
  accessStore.roleGrants.set(
    roleName,
    packIds.map((packId) => ({
      resource_kind: 'builtin_pack',
      resource_id: packId,
    })),
  );
};

const buildAgentRunPayload = (packIds: string[]) => ({
  mode: 'agent' as const,
  messages: [{ role: 'user' as const, content: 'MCP access exit test' }],
  enabledCapabilityPackIds: packIds,
});

beforeEach(async () => {
  accessStore.userRoles.clear();
  accessStore.roleGrants.clear();
  processAgentRunMock.mockClear();

  accessStore.userRoles.set(USER_ID, ['BASIC']);
  seedBuiltinGrants('BASIC', USER_DEFAULT_BUILTIN_PACK_IDS);

  accessStore.userRoles.set(ADMIN_ID, ['ADMIN']);

  const { aiManager } = await import('../../../../core/ai/AiManager');
  aiManager.reloadFromSettings(DEFAULT_AI_SETTINGS);
  vi.spyOn(aiManager, 'isModelToolsCapable').mockReturnValue(true);
  vi.spyOn(aiManager, 'processAgentRun').mockImplementation(processAgentRunMock);
});

afterEach(async () => {
  const { aiManager } = await import('../../../../core/ai/AiManager');
  vi.restoreAllMocks();
  aiManager.reloadFromSettings(DEFAULT_AI_SETTINGS);
});

describe('p-18 MCP access control exit criteria', () => {
  describe('agent runtime enforcement', () => {
    it('rejects basic-role agent run when appendo-git is outside role grants (403)', async () => {
      const { AgentService } = await import('../agent.service');
      const service = new AgentService();

      await expect(service.runStream(
        buildAgentRunPayload(['appendo-git']),
        USER_ID,
        () => {},
      )).rejects.toMatchObject({
        statusCode: 403,
        message: 'One or more agent capabilities are not allowed for your role.',
      });

      expect(processAgentRunMock).not.toHaveBeenCalled();
    });

    it('allows basic-role agent run for read-only granted packs', async () => {
      const { AgentService } = await import('../agent.service');
      const service = new AgentService();

      await service.runStream(
        buildAgentRunPayload(['appendo-codebase']),
        USER_ID,
        () => {},
      );

      expect(processAgentRunMock).toHaveBeenCalledTimes(1);
      const prepareRegistry = processAgentRunMock.mock.calls[0]?.[0]?.prepareRegistry;
      expect(prepareRegistry).toBeTypeOf('function');

      const registry = createPhase1ToolRegistry('agent', ['read', 'search']);
      await prepareRegistry?.(registry);
      const toolNames = registry.listDefinitions().map((tool) => tool.name);
      expect(toolNames).toEqual(expect.arrayContaining(['search_codebase']));
      expect(toolNames).not.toContain(GIT_STATUS_TOOL_NAME);
    });

    it('allows ADMIN bypass for write packs such as appendo-git', async () => {
      const { AgentService } = await import('../agent.service');
      const service = new AgentService();

      await service.runStream(
        buildAgentRunPayload(['appendo-git']),
        ADMIN_ID,
        () => {},
      );

      expect(processAgentRunMock).toHaveBeenCalledTimes(1);
      const prepareRegistry = processAgentRunMock.mock.calls[0]?.[0]?.prepareRegistry;
      const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
      await prepareRegistry?.(registry);
      expect(registry.listDefinitions().map((tool) => tool.name)).toContain(GIT_STATUS_TOOL_NAME);
    });
  });

  describe('effective grants API (me)', () => {
    it('returns basic-role visible packs without appendo-git', async () => {
      const { mcpAccessService } = await import('../mcpAccess.service');
      const { body } = await mcpAccessService.getMe(USER_ID, 'BASIC');

      expect(body.adminBypass).toBe(false);
      expect(body.packs.map((pack) => pack.id)).toEqual(
        expect.arrayContaining([...USER_DEFAULT_BUILTIN_PACK_IDS]),
      );
      expect(body.packs.map((pack) => pack.id)).not.toContain('appendo-git');
    });

    it('returns ADMIN bypass with full catalog packs', async () => {
      const { mcpAccessService } = await import('../mcpAccess.service');
      const { body } = await mcpAccessService.getMe(ADMIN_ID, 'ADMIN');

      expect(body.adminBypass).toBe(true);
      expect(body.packs.map((pack) => pack.id)).toContain('appendo-git');
      expect(body.packs.length).toBe(AGENT_CAPABILITY_UI_PACKS.length);
    });
  });

  describe('session scope clamp', () => {
    it('strips denied packs when session scope is loaded for basic role', async () => {
      const { clampSessionAgentCapabilityScope } = await import('../mcpAccess.service');

      const clamped = await clampSessionAgentCapabilityScope(USER_ID, {
        packIds: ['appendo-files', 'appendo-git'],
        mcpServerIds: [],
      });

      expect(clamped.packIds).toEqual(['appendo-files']);
      expect(clamped.mcpServerIds).toEqual([]);
    });

    it('preserves write packs for ADMIN session scope', async () => {
      const { clampSessionAgentCapabilityScope } = await import('../mcpAccess.service');

      const clamped = await clampSessionAgentCapabilityScope(ADMIN_ID, {
        packIds: ['appendo-files', 'appendo-git'],
        mcpServerIds: [],
      });

      expect(clamped.packIds).toEqual(expect.arrayContaining(['appendo-files', 'appendo-git']));
    });
  });

  describe('inbound MCP ∩ role grants', () => {
    it('exposes only inbound default packs allowed for the configured service role', async () => {
      seedBuiltinGrants('DEVELOPER', USER_DEFAULT_BUILTIN_PACK_IDS);

      const { aiManager } = await import('../../../../core/ai/AiManager');
      aiManager.reloadFromSettings({
        ...DEFAULT_AI_SETTINGS,
        mcp: {
          ...DEFAULT_AI_SETTINGS.mcp,
          defaultCapabilityPackIds: ['appendo-standards', 'appendo-git'],
          inboundHost: {
            ...DEFAULT_AI_SETTINGS.mcp.inboundHost,
            serviceRoleName: 'DEVELOPER',
          },
        },
      });

      const { resolveInboundMcpCapabilityPackIds } = await import('../mcpAccess.service');
      const effectivePackIds = await resolveInboundMcpCapabilityPackIds();

      expect(effectivePackIds).toEqual(['appendo-standards']);
      expect(effectivePackIds).not.toContain('appendo-git');
    });

    it('returns all configured inbound packs when service role is ADMIN', async () => {
      const { aiManager } = await import('../../../../core/ai/AiManager');
      aiManager.reloadFromSettings({
        ...DEFAULT_AI_SETTINGS,
        mcp: {
          ...DEFAULT_AI_SETTINGS.mcp,
          defaultCapabilityPackIds: ['appendo-standards', 'appendo-git'],
          inboundHost: {
            ...DEFAULT_AI_SETTINGS.mcp.inboundHost,
            serviceRoleName: 'ADMIN',
          },
        },
      });

      const { resolveInboundMcpCapabilityPackIds } = await import('../mcpAccess.service');
      const effectivePackIds = await resolveInboundMcpCapabilityPackIds();

      expect(effectivePackIds).toEqual(['appendo-standards', 'appendo-git']);
    });
  });

  describe('M2g regression — scoped pack registration', () => {
    it('registers git tools only when appendo-git is in the effective run scope', () => {
      const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
      registerBuiltinCapabilityPacks(registry, ['appendo-files']);
      expect(registry.listDefinitions().map((tool) => tool.name)).not.toContain(GIT_STATUS_TOOL_NAME);

      registerBuiltinCapabilityPacks(registry, ['appendo-git']);
      expect(registry.listDefinitions().map((tool) => tool.name)).toContain(GIT_STATUS_TOOL_NAME);
    });
  });

  describe('admin grant guard', () => {
    it('rejects editing grants on ADMIN role', async () => {
      const { mcpAccessService } = await import('../mcpAccess.service');

      await expect(mcpAccessService.replaceRoleGrants(
        'ADMIN',
        { grants: [{ resourceKind: 'builtin_pack', resourceId: 'appendo-files' }] },
        1,
      )).rejects.toMatchObject({
        statusCode: 400,
        message: 'ADMIN role uses full MCP bypass; grants cannot be edited.',
      });
    });
  });
});
