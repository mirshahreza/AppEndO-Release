import type { Pool } from 'pg';
import type { AiCapabilityPackId } from '../../../shared/api/contracts/ai/capabilityPacks';
import type { McpGrantResourceKind } from '../../../shared/api/contracts/ai/mcpAccess';
import { prisma, toUserId } from '../../domain/users/prismaHelpers';

export const USER_DEFAULT_BUILTIN_PACK_IDS: readonly AiCapabilityPackId[] = [
  'appendo-files',
  'appendo-codebase',
  'appendo-standards',
  'appendo-context',
  'appendo-openapi',
  'appendo-data',
] as const;

export const DEVELOPER_EXTRA_BUILTIN_PACK_IDS: readonly AiCapabilityPackId[] = [
  'appendo-git',
  'appendo-designer',
  'appendo-server-functions',
  'appendo-packages',
  'appendo-jobs',
  'appendo-web',
  'appendo-http',
] as const;

type SeedGrant = {
  roleName: string;
  resourceKind: McpGrantResourceKind;
  resourceId: string;
};

const buildBuiltinGrants = (roleName: string, packIds: readonly AiCapabilityPackId[]): SeedGrant[] =>
  packIds.map((packId) => ({
    roleName,
    resourceKind: 'builtin_pack' as const,
    resourceId: packId,
  }));

export const buildDefaultRoleMcpSeedGrants = (): SeedGrant[] => [
  ...buildBuiltinGrants('DEVELOPER', [
    ...USER_DEFAULT_BUILTIN_PACK_IDS,
    ...DEVELOPER_EXTRA_BUILTIN_PACK_IDS,
  ]),
];

export async function seedRoleMcpGrants(pool: Pool, actorId: number | null): Promise<void> {
  const grants = buildDefaultRoleMcpSeedGrants();
  for (const grant of grants) {
    await pool.query(
      `INSERT INTO base_role_mcp_grants (
        role_name, resource_kind, resource_id, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $4)
      ON CONFLICT (role_name, resource_kind, resource_id) DO NOTHING`,
      [grant.roleName, grant.resourceKind, grant.resourceId, actorId],
    );
  }
}

export async function seedRoleMcpGrantsPrisma(actorId: number | null): Promise<void> {
  const actor = actorId !== null ? toUserId(actorId) : null;
  const grants = buildDefaultRoleMcpSeedGrants();

  for (const grant of grants) {
    await prisma().baseRoleMcpGrant.upsert({
      where: {
        roleName_resourceKind_resourceId: {
          roleName: grant.roleName,
          resourceKind: grant.resourceKind,
          resourceId: grant.resourceId,
        },
      },
      update: {},
      create: {
        roleName: grant.roleName,
        resourceKind: grant.resourceKind,
        resourceId: grant.resourceId,
        createdBy: actor,
        updatedBy: actor,
      },
    });
  }
}
