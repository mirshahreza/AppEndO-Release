import {
  normalizeFunctionAccessControl,
  resolveFunctionAccessMode,
  type FunctionAccessControl,
  type FunctionAccessMode,
} from './accessControl';

export type FunctionAccessEntityKind = 'user' | 'role';
export type FunctionAccessTone = 'allow' | 'deny';
export type EntityFunctionAccessDecision = 'none' | 'allow' | 'deny';

export type EntityFunctionAccessEntry = {
  id: string;
  name: string;
  method: string;
  path: string;
  folder: string;
  accessMode: FunctionAccessMode;
  decision: EntityFunctionAccessDecision;
  editable: boolean;
};

export type EntityFunctionAccessResponse = {
  success: true;
  entityKind: FunctionAccessEntityKind;
  entityKey: string;
  entityLabel: string;
  adminBypass: boolean;
  entries: EntityFunctionAccessEntry[];
};

export type ReplaceEntityFunctionAccessPayload = {
  decisions: Record<string, EntityFunctionAccessDecision>;
};

/** Stable display order: folder → name → id. */
export const compareEntityFunctionAccessEntries = (
  left: EntityFunctionAccessEntry,
  right: EntityFunctionAccessEntry,
): number => {
  const folderCompare = (left.folder || '').localeCompare(right.folder || '', undefined, { sensitivity: 'base' });
  if (folderCompare !== 0) {
    return folderCompare;
  }
  const nameCompare = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  if (nameCompare !== 0) {
    return nameCompare;
  }
  return left.id.localeCompare(right.id);
};

export const sortEntityFunctionAccessEntries = (
  entries: EntityFunctionAccessEntry[],
): EntityFunctionAccessEntry[] => (
  [...entries].sort(compareEntityFunctionAccessEntries)
);

type AccessListField = 'allowRoles' | 'allowUsers' | 'denyRoles' | 'denyUsers';

const listFieldFor = (
  kind: FunctionAccessEntityKind,
  tone: FunctionAccessTone,
): AccessListField => {
  if (kind === 'user') {
    return tone === 'allow' ? 'allowUsers' : 'denyUsers';
  }
  return tone === 'allow' ? 'allowRoles' : 'denyRoles';
};

const oppositeListFieldFor = (
  kind: FunctionAccessEntityKind,
  tone: FunctionAccessTone,
): AccessListField => {
  if (kind === 'user') {
    return tone === 'allow' ? 'denyUsers' : 'allowUsers';
  }
  return tone === 'allow' ? 'denyRoles' : 'allowRoles';
};

export const buildUserAccessEntityKeys = (
  userId: number,
  email?: string | null,
): string[] => {
  const keys: string[] = [];
  if (Number.isFinite(userId)) {
    keys.push(String(userId));
  }
  if (email?.trim()) {
    keys.push(email.trim());
  }
  return keys;
};

export const resolvePrimaryUserAccessEntityKey = (
  userId: number,
  email?: string | null,
): string => (email?.trim() || String(userId)).trim();

export const buildRoleAccessEntityKey = (roleName: string): string => (
  roleName.trim().toUpperCase()
);

const normalizeStoredEntry = (
  kind: FunctionAccessEntityKind,
  value: string,
): string => (
  kind === 'role' ? value.trim().toUpperCase() : value.trim()
);

const entityMatchesUserKeys = (entityKeys: string[], list: string[]): boolean => {
  const normalizedList = list.map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  return entityKeys.some((key) => normalizedList.includes(key.trim().toLowerCase()));
};

export const resolveEntityFunctionAccessDecision = (
  accessControl: FunctionAccessControl,
  kind: FunctionAccessEntityKind,
  entityKeys: string[],
): EntityFunctionAccessDecision => {
  if (entityInAccessList(accessControl, kind, entityKeys, 'allow')) {
    return 'allow';
  }
  if (entityInAccessList(accessControl, kind, entityKeys, 'deny')) {
    return 'deny';
  }
  return 'none';
};

export const entityInAccessList = (
  accessControl: FunctionAccessControl,
  kind: FunctionAccessEntityKind,
  entityKeys: string[],
  tone: FunctionAccessTone,
): boolean => {
  const normalized = normalizeFunctionAccessControl(accessControl);
  const list = normalized[listFieldFor(kind, tone)];

  if (kind === 'user') {
    return entityMatchesUserKeys(entityKeys, list);
  }

  const roleKey = entityKeys[0]?.trim().toUpperCase();
  return roleKey ? list.includes(roleKey) : false;
};

export const applyEntityAccessSelection = (
  accessControl: FunctionAccessControl,
  kind: FunctionAccessEntityKind,
  entityKeys: string[],
  primaryEntityKey: string,
  tone: FunctionAccessTone,
  selected: boolean,
): FunctionAccessControl => {
  const normalized = normalizeFunctionAccessControl(accessControl);
  const targetField = listFieldFor(kind, tone);
  const oppositeField = oppositeListFieldFor(kind, tone);
  const normalizedEntityKeys = new Set(
    entityKeys.map((key) => normalizeStoredEntry(kind, key)).filter(Boolean),
  );
  const primaryKey = normalizeStoredEntry(kind, primaryEntityKey);

  const matchesEntry = (entry: string): boolean => {
    const normalizedEntry = normalizeStoredEntry(kind, entry);
    if (kind === 'user') {
      return normalizedEntityKeys.has(normalizedEntry)
        || [...normalizedEntityKeys].some(
          (key) => key.toLowerCase() === normalizedEntry.toLowerCase(),
        );
    }
    return normalizedEntry === primaryKey;
  };

  let targetList = [...normalized[targetField]];
  let oppositeList = [...normalized[oppositeField]];

  if (selected) {
    if (primaryKey && !targetList.some((entry) => matchesEntry(entry))) {
      targetList.push(primaryKey);
    }
    oppositeList = oppositeList.filter((entry) => !matchesEntry(entry));
  } else {
    targetList = targetList.filter((entry) => !matchesEntry(entry));
  }

  const next: FunctionAccessControl = {
    ...normalized,
    accessMode: 'specific',
    [targetField]: targetList,
    [oppositeField]: oppositeList,
  };

  return normalizeFunctionAccessControl(next);
};

export const applyEntityAccessDecision = (
  accessControl: FunctionAccessControl,
  kind: FunctionAccessEntityKind,
  entityKeys: string[],
  primaryEntityKey: string,
  decision: EntityFunctionAccessDecision,
): FunctionAccessControl => {
  if (decision === 'allow') {
    return applyEntityAccessSelection(
      accessControl,
      kind,
      entityKeys,
      primaryEntityKey,
      'allow',
      true,
    );
  }

  if (decision === 'deny') {
    return applyEntityAccessSelection(
      accessControl,
      kind,
      entityKeys,
      primaryEntityKey,
      'deny',
      true,
    );
  }

  let next = applyEntityAccessSelection(
    accessControl,
    kind,
    entityKeys,
    primaryEntityKey,
    'allow',
    false,
  );
  next = applyEntityAccessSelection(
    next,
    kind,
    entityKeys,
    primaryEntityKey,
    'deny',
    false,
  );
  return next;
};

export const formatEntityFunctionAccessLabel = (
  accessControl: FunctionAccessControl,
): string => resolveFunctionAccessMode(accessControl);
