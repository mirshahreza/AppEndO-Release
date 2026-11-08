import { describe, expect, it } from 'vitest';
import { DEFAULT_AGENT_CAPABILITY_SCOPE } from '../../../../shared/api/contracts/ai/capabilityPacks';
import {
  assertAgentRunWithinMcpAccess,
  assertRoleMcpGrantsInCatalog,
  buildAdminEffectiveMcpAccess,
  buildCatalogMcpServers,
  buildEffectiveMcpAccessFromGrants,
  buildManagedFunctionAccessPrincipal,
  buildMcpAccessCatalogGrantKeys,
  clampAgentCapabilityScope,
  filterEffectiveMcpAccessByResourcePolicy,
  intersectInboundMcpPackIds,
  isAdminMcpBypass,
  isAdminRoleName,
  normalizeRoleMcpGrantInputs,
  resolveDefaultAgentCapabilityScope,
  resolveInboundMcpServiceRoleName,
} from '../mcpAccess.service';
import { USER_DEFAULT_BUILTIN_PACK_IDS } from '../mcpAccessSeed';
import { HttpError } from '../../../errors/HttpError';

describe('mcpAccess.service', () => {
  it('detects ADMIN bypass role', () => {
    expect(isAdminMcpBypass(['DEVELOPER', 'ADMIN'])).toBe(true);
    expect(isAdminMcpBypass(['DEVELOPER'])).toBe(false);
  });

  it('builds default builtin grants from seed rows', () => {
    const grants = USER_DEFAULT_BUILTIN_PACK_IDS.map((packId) => ({
      resource_kind: 'builtin_pack',
      resource_id: packId,
    }));
    const access = buildEffectiveMcpAccessFromGrants(grants, []);
    expect(access.adminBypass).toBe(false);
    expect(access.packIds).toEqual([...USER_DEFAULT_BUILTIN_PACK_IDS].sort());
    expect(access.mcpServerIds).toEqual([]);
  });

  it('clamps session scope to effective grants', () => {
    const access = buildEffectiveMcpAccessFromGrants(
      USER_DEFAULT_BUILTIN_PACK_IDS.map((packId) => ({
        resource_kind: 'builtin_pack',
        resource_id: packId,
      })),
      [],
    );
    const clamped = clampAgentCapabilityScope(
      {
        packIds: ['appendo-files', 'appendo-git'],
        mcpServerIds: ['external-1'],
      },
      access,
    );
    expect(clamped.packIds).toEqual(['appendo-files']);
    expect(clamped.mcpServerIds).toEqual([]);
  });

  it('resolves default scope intersected with grants', () => {
    const access = buildEffectiveMcpAccessFromGrants(
      [{ resource_kind: 'builtin_pack', resource_id: 'appendo-codebase' }],
      [],
    );
    const scope = resolveDefaultAgentCapabilityScope(access);
    expect(scope.packIds).toEqual(['appendo-codebase']);
  });

  it('rejects agent run when requested packs are outside grants', () => {
    const access = buildEffectiveMcpAccessFromGrants(
      [{ resource_kind: 'builtin_pack', resource_id: 'appendo-codebase' }],
      [],
    );
    expect(() => assertAgentRunWithinMcpAccess(
      { packIds: ['appendo-codebase'], mcpServerIds: [] },
      { enabledCapabilityPackIds: ['appendo-git'] },
      access,
      { userId: 1 },
    )).toThrow(HttpError);
  });

  it('allows ADMIN bypass catalog', () => {
    const access = buildAdminEffectiveMcpAccess([]);
    expect(access.adminBypass).toBe(true);
    expect(access.packIds.length).toBeGreaterThan(0);
    expect(() => assertAgentRunWithinMcpAccess(
      DEFAULT_AGENT_CAPABILITY_SCOPE,
      { enabledCapabilityPackIds: access.packIds },
      access,
      { userId: 1 },
    )).not.toThrow();
  });

  it('detects ADMIN role name for grant editing guard', () => {
    expect(isAdminRoleName('ADMIN')).toBe(true);
    expect(isAdminRoleName('admin')).toBe(true);
    expect(isAdminRoleName('DEVELOPER')).toBe(false);
  });

  it('normalizes and deduplicates grant inputs', () => {
    const grants = normalizeRoleMcpGrantInputs([
      { resourceKind: 'builtin_pack', resourceId: 'appendo-files' },
      { resourceKind: 'builtin_pack', resourceId: 'appendo-files' },
      { resourceKind: 'external_mcp', resourceId: 'remote-1' },
    ]);
    expect(grants).toEqual([
      { resourceKind: 'builtin_pack', resourceId: 'appendo-files' },
      { resourceKind: 'external_mcp', resourceId: 'remote-1' },
    ]);
  });

  it('rejects grants outside catalog', () => {
    expect(() => assertRoleMcpGrantsInCatalog(
      [{ resourceKind: 'builtin_pack', resourceId: 'unknown-pack' }],
      [],
    )).toThrow(HttpError);
  });

  it('builds catalog grant keys from packs and configured servers', () => {
    const keys = buildMcpAccessCatalogGrantKeys([
      {
        id: 'remote-1',
        label: 'Remote',
        enabled: true,
        transport: 'stdio',
        command: 'node',
      },
    ]);
    expect(keys.has('builtin_pack:appendo-files')).toBe(true);
    expect(keys.has('external_mcp:remote-1')).toBe(true);
    expect(buildCatalogMcpServers([
      {
        id: 'remote-1',
        label: 'Remote',
        enabled: true,
        transport: 'stdio',
        command: 'node',
      },
    ])).toEqual([
      expect.objectContaining({
        id: 'remote-1',
        resourceKind: 'external_mcp',
      }),
    ]);
  });

  it('intersects inbound configured packs with role grants', () => {
    const access = buildEffectiveMcpAccessFromGrants(
      [{ resource_kind: 'builtin_pack', resource_id: 'appendo-standards' }],
      [],
    );
    const effective = intersectInboundMcpPackIds(
      ['appendo-standards', 'appendo-git'],
      access,
    );
    expect(effective).toEqual(['appendo-standards']);
  });

  it('returns all configured inbound packs for ADMIN bypass access', () => {
    const access = buildAdminEffectiveMcpAccess([]);
    const effective = intersectInboundMcpPackIds(
      ['appendo-standards', 'appendo-git'],
      access,
    );
    expect(effective).toEqual(['appendo-standards', 'appendo-git']);
  });

  it('defaults inbound service role to DEVELOPER', () => {
    expect(resolveInboundMcpServiceRoleName()).toBe('DEVELOPER');
  });

  it('filters role grants by per-resource access control', () => {
    const grantAccess = buildEffectiveMcpAccessFromGrants(
      [
        { resource_kind: 'builtin_pack', resource_id: 'appendo-files' },
        { resource_kind: 'external_mcp', resource_id: 'remote-1' },
      ],
      [
        {
          id: 'remote-1',
          label: 'Remote',
          enabled: true,
          transport: 'stdio',
          command: 'node',
          accessControl: {
            accessMode: 'specific',
            allowRoles: ['DEVELOPER'],
            allowUsers: [],
            denyRoles: [],
            denyUsers: [],
          },
        },
      ],
    );

    const userPrincipal = buildManagedFunctionAccessPrincipal(10, ['MODERATOR']);
    const filteredForUser = filterEffectiveMcpAccessByResourcePolicy(
      grantAccess,
      userPrincipal,
      [
        {
          id: 'remote-1',
          label: 'Remote',
          enabled: true,
          transport: 'stdio',
          command: 'node',
          accessControl: {
            accessMode: 'specific',
            allowRoles: ['DEVELOPER'],
            allowUsers: [],
            denyRoles: [],
            denyUsers: [],
          },
        },
      ],
      {
        stdioAllowlist: [],
        resourceAccessControl: {
          'appendo-files': {
            accessMode: 'specific',
            allowRoles: ['DEVELOPER'],
            allowUsers: [],
            denyRoles: [],
            denyUsers: [],
          },
        },
      },
    );

    expect(filteredForUser.packIds).toEqual([]);
    expect(filteredForUser.mcpServerIds).toEqual([]);

    const developerPrincipal = buildManagedFunctionAccessPrincipal(11, ['DEVELOPER']);
    const filteredForDeveloper = filterEffectiveMcpAccessByResourcePolicy(
      grantAccess,
      developerPrincipal,
      [
        {
          id: 'remote-1',
          label: 'Remote',
          enabled: true,
          transport: 'stdio',
          command: 'node',
          accessControl: {
            accessMode: 'specific',
            allowRoles: ['DEVELOPER'],
            allowUsers: [],
            denyRoles: [],
            denyUsers: [],
          },
        },
      ],
      {
        stdioAllowlist: [],
        resourceAccessControl: {
          'appendo-files': {
            accessMode: 'specific',
            allowRoles: ['DEVELOPER'],
            allowUsers: [],
            denyRoles: [],
            denyUsers: [],
          },
        },
      },
    );

    expect(filteredForDeveloper.packIds).toEqual(['appendo-files']);
    expect(filteredForDeveloper.mcpServerIds).toEqual(['remote-1']);
  });
});
