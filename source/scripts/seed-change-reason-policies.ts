/**
 * Enable optional Change reason on Users write APIs and tag the seeded 100.6 folders.
 *
 * Usage: npx tsx scripts/seed-change-reason-policies.ts
 */
import {
  readBuiltinFunctionMetadata,
  writeBuiltinFunctionMetadata,
} from '../src/core/functions/BuiltinFunctionMetadataStore';
import {
  closeControlPlaneSequelize,
  getControlPlaneSequelize,
} from '../src/server/db/controlPlaneSequelize';
import {
  RECORD_CHANGE_REASON_USERS_LIFECYCLE,
  RECORD_CHANGE_REASON_USERS_LOCK,
  RECORD_CHANGE_REASON_USERS_ROLES,
} from '../src/shared/api/contracts/record-events';
import type { FunctionAccessControl } from '../src/shared/api/contracts/server-functions/accessControl';

const ACTOR = 'seed-change-reason';

const serializePolicy = (folderId: string): string => JSON.stringify({
  changeReason: {
    reasonAsk: 'optional',
    reasonCapture: 'both',
    reasonVocabNodeId: folderId,
    reasonIncludeGeneral: true,
  },
});

const PROFILE_ACCESS: FunctionAccessControl = {
  accessMode: 'specific',
  allowRoles: ['DEVELOPER', 'USER'],
  allowUsers: ['mohsen.tehrani@append.os'],
  denyRoles: [],
  denyUsers: [],
};

const TARGETS: Array<{
  id: string;
  method: string;
  path: string;
  folderId: string;
  accessControl?: FunctionAccessControl;
}> = [
  { id: 'fn-users-update-profile', method: 'PUT', path: '/api/users/:id/profile', folderId: RECORD_CHANGE_REASON_USERS_LIFECYCLE },
  { id: 'fn-users-update', method: 'PUT', path: '/api/users/:id', folderId: RECORD_CHANGE_REASON_USERS_LIFECYCLE },
  { id: 'fn-users-create', method: 'POST', path: '/api/users', folderId: RECORD_CHANGE_REASON_USERS_LIFECYCLE },
  { id: 'fn-profile-save', method: 'PUT', path: '/api/profile', folderId: RECORD_CHANGE_REASON_USERS_LIFECYCLE },
  { id: 'fn-profile-update-my-account', method: 'PUT', path: '/api/profile/me', folderId: RECORD_CHANGE_REASON_USERS_LIFECYCLE },
  { id: 'fn-users-update-roles', method: 'PUT', path: '/api/users/:id/roles', folderId: RECORD_CHANGE_REASON_USERS_ROLES },
  { id: 'fn-users-set-locked', method: 'PATCH', path: '/api/users/:id/locked', folderId: RECORD_CHANGE_REASON_USERS_LOCK, accessControl: PROFILE_ACCESS },
  { id: 'fn-users-lock', method: 'PATCH', path: '/api/users/:id/lock', folderId: RECORD_CHANGE_REASON_USERS_LOCK, accessControl: PROFILE_ACCESS },
  { id: 'fn-users-unlock', method: 'PATCH', path: '/api/users/:id/unlock', folderId: RECORD_CHANGE_REASON_USERS_LOCK, accessControl: PROFILE_ACCESS },
];

const FOLDER_OWNERS: Array<{ id: string; ownerKey: string }> = [
  { id: RECORD_CHANGE_REASON_USERS_LIFECYCLE, ownerKey: 'function:fn-users-update-profile' },
  { id: RECORD_CHANGE_REASON_USERS_ROLES, ownerKey: 'function:fn-users-update-roles' },
  { id: RECORD_CHANGE_REASON_USERS_LOCK, ownerKey: 'function:fn-users-set-locked' },
];

const main = async () => {
  for (const target of TARGETS) {
    const existing = readBuiltinFunctionMetadata(target.id);
    writeBuiltinFunctionMetadata(
      target.id,
      target.method,
      target.path,
      {
        accessControl: existing?.accessControl ?? target.accessControl ?? PROFILE_ACCESS,
        metadataJson: serializePolicy(target.folderId),
      },
      ACTOR,
    );
    console.log(`Stored change reason on ${target.method} ${target.path}`);
  }

  const sequelize = getControlPlaneSequelize();
  for (const folder of FOLDER_OWNERS) {
    const metadata = JSON.stringify({ changeReasonApi: folder.ownerKey });
    await sequelize.query(
      'UPDATE base_info SET metadata = :metadata WHERE id = :id',
      { replacements: { id: folder.id, metadata } },
    );
    console.log(`Tagged ${folder.id} as ${folder.ownerKey}`);
  }
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeControlPlaneSequelize();
  });
