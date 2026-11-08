import { isBaseRole, isRetiredRoleName } from '../../../shared/api/contracts/roles/roleNames';
import {
  deleteRole,
  deleteUserRolesByName,
  findRoleById,
  findRoleIdByName,
  findRoleNameById,
  insertRole,
  listRoleRows,
  renameUserRoleAssignments,
  updateRole,
} from '../../domain/users/roleRepository';
import { HttpError } from '../../errors/HttpError';
import type { ActorContext } from '../../types/requestContext';
import { actorId } from './shared';
import {
  emitRoleCatalogDiff,
  stripUserHistoryPayload,
} from '../../domain/record-events/userHistory';

export async function listRoles() {
  const items = await listRoleRows();

  return { body: { success: true as const, items } };
}

export async function createRole(
  actor: ActorContext,
  input: { name?: string; note?: unknown },
) {
  const { name, note } = input;
  if (!name) {
    throw new HttpError(400, 'name is required.');
  }

  const nextName = String(name).trim().toUpperCase();
  if (isRetiredRoleName(nextName)) {
    throw new HttpError(400, `Role name "${nextName}" is reserved.`);
  }
  const currentActorId = actorId(actor);
  await insertRole(nextName, note, currentActorId);
  const createdRole = await findRoleIdByName(nextName);

  return { statusCode: 201, body: { success: true as const, id: Number(createdRole?.id || 0) } };
}

export async function updateRoleRecord(
  actor: ActorContext,
  roleId: number,
  input: { name?: string; note?: unknown },
) {
  const historyPayload = input as Record<string, unknown>;
  input = stripUserHistoryPayload(historyPayload) as { name?: string; note?: unknown };
  const { name, note } = input;

  const current = await findRoleById(roleId);
  if (!current) {
    throw new HttpError(404, 'Role not found.');
  }

  const nextName = name ? String(name).trim() : current.name;
  const nextNote = note ?? current.note;
  const currentActorId = actorId(actor);
  await updateRole(nextName, nextNote, currentActorId, roleId);

  if (nextName !== current.name) {
    await renameUserRoleAssignments(nextName, current.name);
  }

  await emitRoleCatalogDiff(
    nextName,
    { name: current.name, note: current.note },
    { name: nextName, note: nextNote },
    historyPayload,
  );

  return { body: { success: true as const } };
}

export async function deleteRoleRecord(roleId: number) {
  const role = await findRoleNameById(roleId);
  if (!role) {
    throw new HttpError(404, 'Role not found.');
  }

  if (isBaseRole(role.name)) {
    throw new HttpError(400, 'Base roles cannot be deleted.');
  }

  await deleteUserRolesByName(role.name);
  await deleteRole(roleId);

  return { body: { success: true as const } };
}
