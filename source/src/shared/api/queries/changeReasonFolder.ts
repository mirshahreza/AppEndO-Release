import {
  RECORD_CHANGE_REASON_VOCAB_ROOT,
  hasAssignedReasonFolder,
} from '../contracts/record-events';
import {
  createBaseInfoNode,
  fetchBaseInfoChildren,
  fetchBaseInfoNode,
} from './base-info';

export const CHANGE_REASON_API_META_KEY = 'changeReasonApi';

export const changeReasonFolderOwnerKeyForFunction = (functionId: string): string => (
  `function:${functionId.trim()}`
);

export const changeReasonFolderOwnerKeyForDataApi = (definitionId: string): string => (
  `data-api:${definitionId.trim()}`
);

export const changeReasonFolderOwnerKeyForDataApiDraft = (
  edgeModelId: string,
  apiName: string,
): string => `data-api-draft:${edgeModelId.trim()}:${apiName.trim() || 'new'}`;

const readOwnerKey = (metadata?: string | null): string | null => {
  if (!metadata?.trim()) return null;
  try {
    const parsed = JSON.parse(metadata) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const value = (parsed as { [CHANGE_REASON_API_META_KEY]?: unknown })[CHANGE_REASON_API_META_KEY];
      return typeof value === 'string' && value.trim() ? value.trim() : null;
    }
  } catch {
    return null;
  }
  return null;
};

export type EnsureChangeReasonFolderInput = {
  ownerKey: string;
  title: string;
  storedNodeId?: string | null;
};

export const ensureChangeReasonFolder = async (
  input: EnsureChangeReasonFolderInput,
): Promise<string> => {
  const ownerKey = input.ownerKey.trim();
  if (!ownerKey) {
    throw new Error('Change-reason folder owner is required.');
  }

  const stored = input.storedNodeId?.trim() ?? '';
  if (hasAssignedReasonFolder(stored)) {
    const existing = await fetchBaseInfoNode(stored);
    if (existing?.id) {
      return existing.id;
    }
  }

  const siblings = await fetchBaseInfoChildren({
    lang: 'en',
    root: '',
    parentId: RECORD_CHANGE_REASON_VOCAB_ROOT,
  });
  const matched = siblings.find((row) => readOwnerKey(row.metadata) === ownerKey);
  if (matched?.id) {
    return matched.id;
  }

  const title = input.title.trim() || ownerKey;
  const created = await createBaseInfoNode({
    parentId: RECORD_CHANGE_REASON_VOCAB_ROOT,
    childDigits: 2,
    title,
    titleEn: title,
    metadata: JSON.stringify({ [CHANGE_REASON_API_META_KEY]: ownerKey }),
  });
  const createdId = typeof created.id === 'string' && created.id.trim() ? created.id.trim() : '';
  if (createdId) {
    return createdId;
  }

  const refreshed = await fetchBaseInfoChildren({
    lang: 'en',
    root: '',
    parentId: RECORD_CHANGE_REASON_VOCAB_ROOT,
  });
  const createdMatch = refreshed.find((row) => readOwnerKey(row.metadata) === ownerKey);
  if (!createdMatch?.id) {
    throw new Error('Failed to create a reason folder for this API.');
  }
  return createdMatch.id;
};
