import { fromUserId, loadUsernameMap, prisma, toUserId } from './prismaHelpers';

const mapRoleRow = (
  row: {
    id: bigint;
    name: string;
    note: string | null;
    createdAt: Date | null;
    createdBy: bigint | null;
    updatedAt: Date | null;
    updatedBy: bigint | null;
  },
  usernameById: Map<number, string>,
) => ({
  id: fromUserId(row.id),
  name: row.name,
  note: row.note,
  created_at: row.createdAt,
  created_by: row.createdBy !== null ? fromUserId(row.createdBy) : null,
  created_by_username: row.createdBy !== null ? usernameById.get(fromUserId(row.createdBy)) ?? null : null,
  updated_at: row.updatedAt,
  updated_by: row.updatedBy !== null ? fromUserId(row.updatedBy) : null,
  updated_by_username: row.updatedBy !== null ? usernameById.get(fromUserId(row.updatedBy)) ?? null : null,
});

export async function listRoleRows() {
  const rows = await prisma().baseRole.findMany({ orderBy: { name: 'asc' } });
  const usernameById = await loadUsernameMap(rows.flatMap((row) => [row.createdBy, row.updatedBy]));
  return rows.map((row) => mapRoleRow(row, usernameById));
}

export async function insertRole(name: string, note: unknown, actorId: number | null) {
  await prisma().baseRole.create({
    data: {
      name,
      note: note ? String(note) : null,
      createdBy: actorId !== null ? toUserId(actorId) : null,
      updatedBy: actorId !== null ? toUserId(actorId) : null,
    },
  });
}

export async function findRoleIdByName(name: string) {
  const row = await prisma().baseRole.findUnique({
    where: { name },
    select: { id: true },
  });
  return row ? { id: fromUserId(row.id) } : undefined;
}

export async function findRoleById(roleId: number) {
  const row = await prisma().baseRole.findUnique({
    where: { id: toUserId(roleId) },
    select: { id: true, name: true, note: true },
  });
  if (!row) return undefined;
  return { id: fromUserId(row.id), name: row.name, note: row.note };
}

export async function updateRole(name: string, note: unknown, actorId: number | null, roleId: number) {
  await prisma().baseRole.update({
    where: { id: toUserId(roleId) },
    data: {
      name,
      note: note ? String(note) : null,
      updatedBy: actorId !== null ? toUserId(actorId) : null,
      updatedAt: new Date(),
    },
  });
}

export async function renameUserRoleAssignments(nextName: string, currentName: string) {
  await prisma().baseUserRole.updateMany({
    where: { roleName: currentName },
    data: { roleName: nextName },
  });
}

export async function findRoleNameById(roleId: number) {
  const row = await prisma().baseRole.findUnique({
    where: { id: toUserId(roleId) },
    select: { name: true },
  });
  return row ? { name: row.name } : undefined;
}

export async function deleteUserRolesByName(roleName: string) {
  await prisma().baseUserRole.deleteMany({ where: { roleName } });
}

export async function deleteRole(roleId: number) {
  await prisma().baseRole.delete({ where: { id: toUserId(roleId) } });
}
