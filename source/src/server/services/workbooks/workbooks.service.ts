import { HttpError } from '../../errors/HttpError';
import type { FunctionAccessControl } from '../../../shared/api/contracts/server-functions/accessControl';
import { normalizeFunctionAccessControl } from '../../../shared/api/contracts/server-functions/accessControl';
import type { ManagedFunctionAccessPrincipal } from '../../../shared/api/contracts/server-functions/accessControl';
import {
  DEFAULT_WORKBOOK_ACCESS_PERMISSION,
  canAccessWorkbookRecord,
  isExplicitWorkbookShare,
  isWorkbookAccessPermission,
  resolveWorkbookViewerRole,
  workbookAccessKeyForUser,
  type WorkbookAccessPermission,
} from '../../../shared/api/contracts/workbooks/access';
import type { WorkbookRecord, WorkbookSharedMember, WorkbookSheet } from '../../../shared/api/contracts/workbooks/types';
import { emptyWorkbookSheets } from '../../../shared/api/contracts/workbooks/types';
import type { ActorContext } from '../../types/requestContext';
import {
  findAuthUserByEmail,
  findAuthUserById,
  findAuthUserByUsername,
  findUserWorkflowSummary,
} from '../../domain/users/userRepository';
import { getUserProfileAvatarXs } from '../../domain/users/userProfileRepository';
import {
  createWorkbook,
  deleteWorkbook,
  getWorkbookForViewer,
  asWorkbookUserId,
  getWorkbookRowById,
  listCandidateSharedWorkbooks,
  listWorkbooks,
  readWorkbookAccessControl,
  readWorkbookAccessPermission,
  updateWorkbook,
  updateWorkbookAccess,
} from '../../domain/workbooks/workbookRepository';

export type WorkbookActor = ActorContext & {
  roles: string[];
};

const requireSignedIn = (actor: WorkbookActor): number => {
  if (!actor.userId) {
    throw new HttpError(401, 'Authentication required.');
  }
  return actor.userId;
};

export const toWorkbookPrincipal = (actor: WorkbookActor): ManagedFunctionAccessPrincipal => ({
  isAuthenticated: Boolean(actor.userId),
  isAdmin: false,
  userId: actor.userId || null,
  email: actor.email ?? null,
  roles: actor.roles,
});

const avatarDataUrl = async (userId: number): Promise<string | null> => {
  try {
    const avatar = await getUserProfileAvatarXs(userId);
    if (!avatar) {
      return null;
    }
    const body = Buffer.isBuffer(avatar.body) ? avatar.body : Buffer.from(avatar.body);
    return `data:${avatar.mime || 'image/jpeg'};base64,${body.toString('base64')}`;
  } catch {
    return null;
  }
};

const resolveMember = async (key: string): Promise<WorkbookSharedMember | null> => {
  const trimmed = key.trim();
  if (!trimmed) {
    return null;
  }
  const byEmail = trimmed.includes('@') ? await findAuthUserByEmail(trimmed) : undefined;
  const numericId = Number(trimmed);
  const byId = !byEmail && Number.isFinite(numericId) ? await findAuthUserById(numericId) : undefined;
  const user = byEmail ?? byId;
  if (!user) {
    return {
      key: trimmed,
      userId: Number.isFinite(numericId) ? numericId : 0,
      username: trimmed,
      displayName: trimmed,
      avatar: null,
    };
  }
  const summary = await findUserWorkflowSummary(user.id);
  return {
    key: trimmed,
    userId: user.id,
    username: user.username,
    displayName: summary?.displayName ?? user.username,
    avatar: await avatarDataUrl(user.id),
  };
};

const resolveSharedMembers = async (accessControl: FunctionAccessControl): Promise<WorkbookSharedMember[]> => {
  const keys = normalizeFunctionAccessControl(accessControl).allowUsers;
  const members = await Promise.all(keys.map((key) => resolveMember(key)));
  return members.filter((member): member is WorkbookSharedMember => Boolean(member));
};

const requireRow = async (id: string) => {
  const row = await getWorkbookRowById(id);
  if (!row) {
    throw new HttpError(404, 'Workbook not found.');
  }
  return row;
};

const assertCanRead = (row: Awaited<ReturnType<typeof requireRow>>, actor: WorkbookActor): void => {
  const acl = readWorkbookAccessControl(row.accessControl);
  if (canAccessWorkbookRecord(asWorkbookUserId(row.ownerUserId), acl, toWorkbookPrincipal(actor))) {
    return;
  }
  if (!actor.userId && readWorkbookAccessControl(row.accessControl).accessMode === 'authenticated') {
    throw new HttpError(401, 'Authentication required.');
  }
  throw new HttpError(404, 'Workbook not found.');
};

const viewerFor = (row: Awaited<ReturnType<typeof requireRow>>, actor: WorkbookActor) => {
  const isOwner = Boolean(actor.userId) && asWorkbookUserId(actor.userId) === asWorkbookUserId(row.ownerUserId);
  return {
    isOwner,
    permission: isOwner ? 'edit' as const : readWorkbookAccessPermission(row.accessPermission),
  };
};

export class WorkbooksService {
  async list(actor: WorkbookActor) {
    return listWorkbooks(requireSignedIn(actor));
  }

  async listShared(actor: WorkbookActor) {
    const userId = requireSignedIn(actor);
    const principal = toWorkbookPrincipal(actor);
    const candidates = await listCandidateSharedWorkbooks();
    const visible = candidates.filter((item) => (
      asWorkbookUserId(item.row.ownerUserId) !== userId
      && isExplicitWorkbookShare(asWorkbookUserId(item.row.ownerUserId), item.accessControl, principal)
    ));
    const records = await Promise.all(visible.map((item) => getWorkbookForViewer(item.row, {
      isOwner: false,
      permission: item.accessPermission,
    })));
    return records.map(({ sheets: _sheets, sharedMembers: _members, ...rest }) => rest);
  }

  async get(actor: WorkbookActor, id: string) {
    requireSignedIn(actor);
    const row = await requireRow(id);
    assertCanRead(row, actor);
    const viewer = viewerFor(row, actor);
    const members = viewer.isOwner
      ? await resolveSharedMembers(readWorkbookAccessControl(row.accessControl))
      : [];
    return getWorkbookForViewer(row, viewer, members);
  }

  async open(actor: WorkbookActor, id: string) {
    const row = await requireRow(id);
    assertCanRead(row, actor);
    return getWorkbookForViewer(row, viewerFor(row, actor));
  }

  async create(actor: WorkbookActor, payload: Record<string, unknown>): Promise<WorkbookRecord> {
    const ownerUserId = requireSignedIn(actor);
    const name = String(payload.name ?? '').trim();
    if (!name) {
      throw new HttpError(400, 'name is required.');
    }
    return createWorkbook({
      name,
      note: typeof payload.note === 'string' ? payload.note : null,
      sheets: emptyWorkbookSheets(),
      ownerUserId,
    });
  }

  async update(actor: WorkbookActor, id: string, payload: Record<string, unknown>): Promise<WorkbookRecord> {
    const sharingOnly = (payload.accessControl != null || payload.permission != null)
      && payload.sheets == null
      && payload.name == null
      && payload.note === undefined;
    if (sharingOnly) {
      return this.updateAccess(actor, id, payload);
    }

    const row = await requireRow(id);
    assertCanRead(row, actor);
    const viewer = viewerFor(row, actor);
    if (!viewer.isOwner && viewer.permission === 'view') {
      throw new HttpError(403, 'This workbook is read-only.');
    }
    const isOwner = viewer.isOwner;
    return updateWorkbook({
      id,
      actorUserId: actor.userId || null,
      name: isOwner && typeof payload.name === 'string' ? payload.name : undefined,
      note: isOwner
        ? (typeof payload.note === 'string' ? payload.note : payload.note === null ? null : undefined)
        : undefined,
      sheets: Array.isArray(payload.sheets) ? payload.sheets as WorkbookSheet[] : undefined,
      allowRename: isOwner,
    });
  }

  async updateAccess(actor: WorkbookActor, id: string, payload: Record<string, unknown>): Promise<WorkbookRecord> {
    const ownerUserId = requireSignedIn(actor);
    const row = await requireRow(id);
    if (asWorkbookUserId(row.ownerUserId) !== ownerUserId) {
      throw new HttpError(403, 'Only the owner can change sharing.');
    }
    const accessControl = normalizeFunctionAccessControl(
      payload.accessControl as Partial<FunctionAccessControl> | null | undefined,
    );
    const permission = isWorkbookAccessPermission(payload.permission)
      ? payload.permission
      : DEFAULT_WORKBOOK_ACCESS_PERMISSION;
    const updated = await updateWorkbookAccess({
      id,
      ownerUserId,
      accessControl,
      accessPermission: permission,
    });
    return {
      ...updated,
      sharedMembers: await resolveSharedMembers(updated.accessControl),
      viewerRole: resolveWorkbookViewerRole(true, 'edit'),
    };
  }

  async resolveUsername(actor: WorkbookActor, rawUsername: string) {
    requireSignedIn(actor);
    const username = rawUsername.trim();
    if (!username) {
      return { exists: false as const };
    }
    const user = await findAuthUserByUsername(username);
    if (!user) {
      return { exists: false as const };
    }
    const summary = await findUserWorkflowSummary(user.id);
    return {
      exists: true as const,
      userId: user.id,
      username: user.username,
      displayName: summary?.displayName ?? user.username,
      accessKey: workbookAccessKeyForUser({ userId: user.id, email: user.email }),
      avatar: await avatarDataUrl(user.id),
    };
  }

  async remove(actor: WorkbookActor, id: string): Promise<void> {
    await deleteWorkbook(id, requireSignedIn(actor));
  }
}

let singleton: WorkbooksService | undefined;

export const getWorkbooksService = (): WorkbooksService => {
  if (!singleton) {
    singleton = new WorkbooksService();
  }
  return singleton;
};
