/**
 * Append-only designer draft audit log (Phase 54 / gap #21).
 * Persists under workspace/designer/audit/{draftId}.jsonl
 */

import fs from 'fs';
import path from 'path';
import { atomicWriteText } from '../../../core/runtime/RuntimeFileStore';
import { runtimeDirs } from '../../../core/runtime/runtimePaths';
import type { DesignerDocument } from '../../../domain/component-designer/types';
import {
  computeDesignerDraftAuditChanges,
  type DesignerDraftAuditEntryChange,
} from '../../../domain/component-designer/draftAuditDiff';
import { designerStoragePaths, ensureDesignerStoragePaths } from './storage';

export type DesignerDraftAuditLogEntry = {
  id: string;
  draftId: string;
  actor: string;
  at: string;
  versionHint?: number;
  changes: DesignerDraftAuditEntryChange[];
};

export const designerAuditPaths = {
  root: path.join(designerStoragePaths.root, 'audit'),
} as const;

const ensureAuditStorage = (): void => {
  ensureDesignerStoragePaths();
  fs.mkdirSync(designerAuditPaths.root, { recursive: true });
};

const sanitizeDraftIdForFile = (draftId: string): string =>
  draftId.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'draft';

export const draftAuditLogPath = (draftId: string): string =>
  path.join(designerAuditPaths.root, `${sanitizeDraftIdForFile(draftId)}.jsonl`);

const createAuditEntryId = (): string =>
  `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const parseAuditLine = (line: string): DesignerDraftAuditLogEntry | null => {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (
      typeof record.id !== 'string'
      || typeof record.draftId !== 'string'
      || typeof record.actor !== 'string'
      || typeof record.at !== 'string'
      || !Array.isArray(record.changes)
    ) {
      return null;
    }
    return {
      id: record.id,
      draftId: record.draftId,
      actor: record.actor,
      at: record.at,
      versionHint: typeof record.versionHint === 'number' ? record.versionHint : undefined,
      changes: record.changes as DesignerDraftAuditEntryChange[],
    };
  } catch {
    return null;
  }
};

export const listDesignerDraftAuditLog = (draftId: string): DesignerDraftAuditLogEntry[] => {
  ensureAuditStorage();
  const filePath = draftAuditLogPath(draftId);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const entries: DesignerDraftAuditLogEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const entry = parseAuditLine(line);
    if (entry) {
      entries.push(entry);
    }
  }
  return entries;
};

export const appendDesignerDraftAuditLog = (
  entry: DesignerDraftAuditLogEntry,
): DesignerDraftAuditLogEntry => {
  ensureAuditStorage();
  const filePath = draftAuditLogPath(entry.draftId);
  const line = `${JSON.stringify(entry)}\n`;
  fs.appendFileSync(filePath, line, 'utf8');
  return entry;
};

/**
 * Diff previous vs next document and append an audit entry when there are changes.
 * Returns null when there is nothing to record.
 */
export const recordDesignerDraftAuditOnSave = (input: {
  draftId: string;
  actor: string;
  previousDocument: DesignerDocument | null | undefined;
  nextDocument: DesignerDocument;
  versionHint?: number;
}): DesignerDraftAuditLogEntry | null => {
  const changes = computeDesignerDraftAuditChanges(
    input.previousDocument,
    input.nextDocument,
  );
  if (changes.length === 0) {
    return null;
  }

  const entry: DesignerDraftAuditLogEntry = {
    id: createAuditEntryId(),
    draftId: input.draftId,
    actor: input.actor.trim() || 'unknown',
    at: new Date().toISOString(),
    versionHint: input.versionHint,
    changes,
  };

  return appendDesignerDraftAuditLog(entry);
};

/** Test helper: wipe a draft's audit file (does not touch other drafts). */
export const clearDesignerDraftAuditLogForTests = (draftId: string): void => {
  ensureAuditStorage();
  const filePath = draftAuditLogPath(draftId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

/** Test helper: replace entire audit file contents atomically. */
export const writeDesignerDraftAuditLogForTests = (
  draftId: string,
  entries: DesignerDraftAuditLogEntry[],
): void => {
  ensureAuditStorage();
  const filePath = draftAuditLogPath(draftId);
  const body = entries.map((entry) => JSON.stringify(entry)).join('\n');
  atomicWriteText(
    filePath,
    body ? `${body}\n` : '',
    runtimeDirs.workspaceTemp,
  );
};
