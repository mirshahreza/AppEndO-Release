/**
 * Hierarchical ID (HID) allocation for base_info — application-layer port of
 * legacy PL/pgSQL functions zz_calculate_hid / zz_insert_base_info_node (p-45 PRM-1).
 */

export type CalculateBaseInfoHidInput = {
  parentId?: string | null;
  childDigits?: number;
  delimiter?: string;
  idExists: (candidate: string) => Promise<boolean>;
};

export type InsertBaseInfoNodeInput = {
  parentId?: string | null;
  childDigits?: number;
  title?: string | null;
  shortName?: string | null;
  viewOrder?: number | string | null;
  note?: string | null;
  metadata?: string | null;
  value?: number | null;
  isActive?: boolean | null;
  uiColor?: string | null;
  uiHtml?: string | null;
  actorId?: number | bigint | null;
  idExists: (candidate: string) => Promise<boolean>;
  insert: (row: {
    id: string;
    parentId: string | null;
    title: string | null;
    shortName: string | null;
    viewOrder: number | string | null;
    note: string | null;
    metadata: string | null;
    value: number | null;
    isActive: boolean;
    uiColor: string | null;
    uiHtml: string | null;
    actorId: number | bigint | null;
  }) => Promise<void>;
};

const normalizeParentId = (parentId?: string | null): string | null => {
  const trimmed = String(parentId ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const padNumber = (value: number, digits: number): string => String(value).padStart(digits, '0');

/**
 * Remap a HID from one root to another, stripping leading zeros on each child segment.
 * `120.001.002` under `120` → `100.4.1.2` when the new root is `100.4`.
 */
export const remapBaseInfoHidWithUnpaddedChildSegments = (
  oldId: string,
  oldRoot: string,
  newRoot: string,
): string => {
  if (oldId === oldRoot) return newRoot;
  const prefix = `${oldRoot}.`;
  if (!oldId.startsWith(prefix)) {
    throw new Error(`Base Info id ${oldId} is not in subtree ${oldRoot}.`);
  }
  const segments = oldId.slice(prefix.length).split('.').map((part) => {
    if (!/^\d+$/.test(part)) {
      throw new Error(`Invalid HID segment "${part}" in ${oldId}.`);
    }
    return String(Number.parseInt(part, 10));
  });
  return `${newRoot}.${segments.join('.')}`;
};

/** Port of zz_calculate_hid for base_info. */
export const calculateBaseInfoHierarchicalId = async (
  input: CalculateBaseInfoHidInput,
): Promise<string> => {
  const childDigits = input.childDigits ?? 3;
  const delimiter = input.delimiter ?? '.';

  if (childDigits < 1 || childDigits > 9) {
    throw new Error('childDigits must be between 1 and 9.');
  }
  if (delimiter.length !== 1) {
    throw new Error('delimiter must be exactly one character.');
  }

  const parentId = normalizeParentId(input.parentId);
  const prefix = parentId ? `${parentId}${delimiter}` : '';
  const startNumber = parentId ? 1 : 10 ** (childDigits - 1);
  const endNumber = 10 ** childDigits - 1;

  for (let num = startNumber; num <= endNumber; num += 1) {
    const candidate = `${prefix}${padNumber(num, childDigits)}`;
    const exists = await input.idExists(candidate);
    if (!exists) {
      return candidate;
    }
  }

  throw new Error(`No free hierarchical id found for parent ${parentId ?? '(root)'}.`);
};

/** Port of zz_calculate_hid_digits_count for base_info. */
export const calculateBaseInfoHidDigitsCount = async (
  parentId: string | null | undefined,
  listSiblingIds: (normalizedParentId: string) => Promise<string[]>,
  delimiter = '.',
): Promise<number> => {
  if (delimiter.length !== 1) {
    throw new Error('delimiter must be exactly one character.');
  }

  const normalizedParent = normalizeParentId(parentId) ?? '';
  const siblings = await listSiblingIds(normalizedParent);
  const lastId = siblings.length > 0 ? siblings[siblings.length - 1] : null;

  if (!lastId) {
    return 1;
  }

  if (normalizedParent === '') {
    return lastId.length;
  }

  const suffix = lastId.replace(`${normalizedParent}${delimiter}`, '');
  return suffix.length;
};

/** Port of zz_insert_base_info_node — allocates HID then inserts. */
export const insertBaseInfoNodeWithHid = async (input: InsertBaseInfoNodeInput): Promise<string> => {
  const parentId = normalizeParentId(input.parentId);
  const id = await calculateBaseInfoHierarchicalId({
    parentId,
    childDigits: input.childDigits,
    idExists: input.idExists,
  });

  await input.insert({
    id,
    parentId,
    title: input.title ?? null,
    shortName: input.shortName ?? null,
    viewOrder: input.viewOrder ?? null,
    note: input.note ?? null,
    metadata: input.metadata ?? null,
    value: input.value ?? null,
    isActive: input.isActive ?? true,
    uiColor: input.uiColor ?? null,
    uiHtml: input.uiHtml ?? null,
    actorId: input.actorId ?? null,
  });

  return id;
};
