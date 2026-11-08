import type { ActionDefinition, ActionExecutor } from '../types';
import type { JsonValue } from '../../awm/types';
import { countAllUsers, findUserWorkflowSummary, lockUser, unlockUser } from '../../../users/userRepository';
import { listRoleMemberSummaries, listRoleNameRows } from '../../../users/userRoleRepository';
import { registerDynamicOptionsResolver } from '../dynamicOptionsRegistry';

/** p-99/WFT-2 — first real Dynamic Options consumer: `identity.role-members`'s `roleName` field gets a live dropdown of actual platform roles instead of requiring an author to know/type the exact name. */
export function registerIdentityDynamicOptionsResolvers(): void {
  registerDynamicOptionsResolver('identity.roles', async () => {
    const rows = await listRoleNameRows();
    return rows.map((row) => ({ value: row.name, label: row.name }));
  });
}

/**
 * Identity Action pack (p-89 ACT-6) — in-process reads against control-plane users/roles.
 * Workflow HTTP cannot call `/api/users` (SSRF blocks loopback); these Actions wrap the same
 * Prisma repositories the Users feature uses. Never returns password hashes or profile binaries.
 */

const inlineSchema = (schema: JsonValue = {}) => ({ type: 'INLINE' as const, schema });

const parseUserId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  return null;
};

export const identityUserGetDefinition: ActionDefinition = {
  key: 'identity.user-get',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      userId: { type: ['integer', 'string'], title: 'User id', description: 'base_users.id' },
    },
    required: ['userId'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      found: { type: 'boolean' },
      userId: { type: 'integer' },
      username: { type: 'string' },
      email: { type: ['string', 'null'] },
      mobile: { type: ['string', 'null'] },
      locked: { type: 'boolean' },
      isBuiltin: { type: 'boolean' },
      roles: { type: 'array', items: { type: 'string' } },
      displayName: { type: 'string' },
      firstname: { type: ['string', 'null'] },
      lastname: { type: ['string', 'null'] },
      nickname: { type: ['string', 'null'] },
      companyName: { type: ['string', 'null'] },
      personTypeCode: { type: ['string', 'null'] },
    },
  }),
  executionTimeoutMs: 10000,
  idempotency: { guarantee: 'DEDUPLICATED', deduplicationWindowMs: 86400000 },
  cancellationSupport: 'NONE',
  sideEffectClass: 'READ_EXTERNAL',
  riskClass: 'LOW',
  requiredCapabilities: ['identity.read'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['identity', 'users'],
};

export const identityUserGetExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const userId = parseUserId((input as { userId?: unknown } | null)?.userId);
    if (userId === null) {
      return {
        status: 'FAILED',
        errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.userId (positive integer).',
      };
    }
    const summary = await findUserWorkflowSummary(userId);
    if (!summary) {
      context.writeTraceMetadata({ type: 'IDENTITY_USER_GET', payload: { userId, found: false } });
      return {
        status: 'FAILED',
        errorCode: 'IDENTITY_USER_NOT_FOUND',
        errorClass: 'NOT_FOUND',
        safeMessage: `User ${userId} was not found.`,
      };
    }
    context.writeTraceMetadata({ type: 'IDENTITY_USER_GET', payload: { userId, found: true } });
    return {
      status: 'SUCCEEDED',
      output: {
        found: true,
        ...summary,
      },
    };
  },
};

export const identityRoleMembersDefinition: ActionDefinition = {
  key: 'identity.role-members',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      roleName: { type: 'string', title: 'Role name', description: 'Canonical role name (e.g. ADMIN).', format: 'dynamic-options', dynamicOptionsSource: 'identity.roles' },
      includeLocked: { type: 'boolean', default: false },
    },
    required: ['roleName'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      roleName: { type: 'string' },
      count: { type: 'integer' },
      members: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            userId: { type: 'integer' },
            username: { type: 'string' },
            email: { type: ['string', 'null'] },
            locked: { type: 'boolean' },
            displayName: { type: 'string' },
          },
        },
      },
      emails: {
        type: 'array',
        items: { type: 'string' },
        description: 'Non-empty member emails for notify loops.',
      },
    },
  }),
  executionTimeoutMs: 10000,
  idempotency: { guarantee: 'DEDUPLICATED', deduplicationWindowMs: 86400000 },
  cancellationSupport: 'NONE',
  sideEffectClass: 'READ_EXTERNAL',
  riskClass: 'LOW',
  requiredCapabilities: ['identity.read'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['identity', 'roles'],
};

export const identityRoleMembersExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const raw = (input ?? {}) as { roleName?: unknown; includeLocked?: unknown };
    const roleName = typeof raw.roleName === 'string' ? raw.roleName.trim() : '';
    if (!roleName) {
      return {
        status: 'FAILED',
        errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.roleName (non-empty string).',
      };
    }
    const includeLocked = raw.includeLocked === true;
    const result = await listRoleMemberSummaries(roleName, { includeLocked });
    if ('roleMissing' in result) {
      context.writeTraceMetadata({ type: 'IDENTITY_ROLE_MEMBERS', payload: { roleName, roleMissing: true } });
      return {
        status: 'FAILED',
        errorCode: 'IDENTITY_ROLE_NOT_FOUND',
        errorClass: 'NOT_FOUND',
        safeMessage: `Role "${roleName}" was not found.`,
      };
    }
    const emails = result.members
      .map((member) => member.email)
      .filter((email): email is string => typeof email === 'string' && email.trim().length > 0);
    context.writeTraceMetadata({
      type: 'IDENTITY_ROLE_MEMBERS',
      payload: { roleName: result.roleName, count: result.members.length },
    });
    return {
      status: 'SUCCEEDED',
      output: {
        roleName: result.roleName,
        count: result.members.length,
        members: result.members,
        emails,
      },
    };
  },
};

export const identityUserLockDefinition: ActionDefinition = {
  key: 'identity.user-lock',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      userId: { type: ['integer', 'string'], title: 'Target user id' },
      locked: { type: 'boolean', default: true, description: 'true to lock, false to unlock' },
      actorUserId: { type: ['integer', 'string'], description: 'Operator performing the lock/unlock' },
    },
    required: ['userId'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      userId: { type: 'integer' },
      locked: { type: 'boolean' },
      username: { type: 'string' },
      displayName: { type: 'string' },
    },
  }),
  executionTimeoutMs: 10000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'HIGH',
  requiredCapabilities: ['identity.write'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['identity', 'users', 'security'],
};

export const identityUserLockExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const record = (input && typeof input === 'object' && !Array.isArray(input))
      ? input as Record<string, unknown>
      : {};
    const userId = parseUserId(record.userId);
    if (userId === null) {
      return {
        status: 'FAILED',
        errorCode: 'IDENTITY_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.userId (positive integer).',
      };
    }
    const locked = record.locked === false ? false : true;
    const actorUserId = parseUserId(record.actorUserId);
    const before = await findUserWorkflowSummary(userId);
    if (!before) {
      return {
        status: 'FAILED',
        errorCode: 'IDENTITY_USER_NOT_FOUND',
        errorClass: 'NOT_FOUND',
        safeMessage: `User ${userId} was not found.`,
      };
    }
    if (before.isBuiltin && locked) {
      return {
        status: 'FAILED',
        errorCode: 'IDENTITY_BUILTIN_LOCK_FORBIDDEN',
        errorClass: 'AUTHORIZATION',
        safeMessage: 'Built-in users cannot be locked via workflow Action.',
      };
    }
    try {
      if (locked) await lockUser(actorUserId, userId);
      else await unlockUser(actorUserId, userId);
      const after = await findUserWorkflowSummary(userId);
      context.writeTraceMetadata({
        type: 'IDENTITY_USER_LOCK',
        payload: { userId, locked, actorUserId },
      });
      return {
        status: 'SUCCEEDED',
        output: {
          userId,
          locked: after?.locked ?? locked,
          username: after?.username ?? before.username,
          displayName: after?.displayName ?? before.displayName,
        },
      };
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'User lock/unlock failed.';
      return {
        status: 'FAILED',
        errorCode: 'IDENTITY_USER_LOCK_FAILED',
        errorClass: 'EXTERNAL_ERROR',
        safeMessage,
      };
    }
  },
};

export const identityUserCountDefinition: ActionDefinition = {
  key: 'identity.user-count',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({ type: 'object', properties: {} }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      count: { type: 'integer' },
    },
  }),
  executionTimeoutMs: 10000,
  idempotency: { guarantee: 'DEDUPLICATED', deduplicationWindowMs: 86400000 },
  cancellationSupport: 'NONE',
  sideEffectClass: 'READ_EXTERNAL',
  riskClass: 'LOW',
  requiredCapabilities: ['identity.read'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['identity', 'users'],
};

export const identityUserCountExecutor: ActionExecutor = {
  async execute(context) {
    const count = await countAllUsers();
    context.writeTraceMetadata({ type: 'IDENTITY_USER_COUNT', payload: { count } });
    return { status: 'SUCCEEDED', output: { count } };
  },
};
