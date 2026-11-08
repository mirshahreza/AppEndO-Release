import type { ChangeSet, ChangeSetKind } from '../api/contracts/ai/agentTypes';
import type { DesignerDocument, DesignerNode } from '../../domain/component-designer/types';
import { computeLineDiffZones, formatDiffZoneLabel, type DiffZone } from './appendoo/diffZones';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const MAX_PREVIEW_LINES = 40;
const MAX_LINE_CHARS = 120;
const MAX_SOURCE_CHARS = 1600;

export type DiffLineStats = {
  insertions: number;
  deletions: number;
  unchanged: number;
};

export type DiffPreviewLine = {
  kind: 'context' | 'add' | 'remove' | 'same';
  text: string;
};

export type ChangeSetArtifactPreview = {
  artifactLabel: string;
  stats: DiffLineStats;
  lines: DiffPreviewLine[];
  plainText?: string;
  diffZones?: DiffZone[];
};

export const CHANGE_SET_KIND_LABELS: Record<ChangeSetKind, string> = {
  component_layout_patch: 'Layout',
  function_source_patch: 'Function',
  settings_block_patch: 'Settings',
  file_patch: 'File',
  git_operation: 'Git',
};

export type LayoutNodeDelta = {
  added: Array<{ id: string; type: string }>;
  removed: Array<{ id: string; type: string }>;
  changedProps: Array<{ id: string; type: string; keys: string[] }>;
};

export const diffDesignerDocuments = (
  before: DesignerDocument,
  after: DesignerDocument,
): LayoutNodeDelta => {
  const beforeNodes = before.nodes ?? {};
  const afterNodes = after.nodes ?? {};
  const beforeIds = new Set(Object.keys(beforeNodes));
  const afterIds = new Set(Object.keys(afterNodes));

  const added = [...afterIds]
    .filter((id) => !beforeIds.has(id))
    .map((id) => ({ id, type: afterNodes[id]?.type ?? 'unknown' }));

  const removed = [...beforeIds]
    .filter((id) => !afterIds.has(id))
    .map((id) => ({ id, type: beforeNodes[id]?.type ?? 'unknown' }));

  const changedProps: LayoutNodeDelta['changedProps'] = [];
  for (const id of afterIds) {
    if (!beforeIds.has(id)) continue;
    const beforeNode = beforeNodes[id];
    const afterNode = afterNodes[id];
    if (!beforeNode || !afterNode) continue;

    const keys = diffPropKeys(beforeNode, afterNode);
    if (keys.length > 0) {
      changedProps.push({ id, type: afterNode.type, keys });
    }
  }

  return { added, removed, changedProps };
};

const diffPropKeys = (before: DesignerNode, after: DesignerNode): string[] => {
  const keys = new Set([
    ...Object.keys(before.props ?? {}),
    ...Object.keys(after.props ?? {}),
  ]);
  const changed: string[] = [];
  for (const key of keys) {
    const beforeValue = JSON.stringify(before.props?.[key] ?? null);
    const afterValue = JSON.stringify(after.props?.[key] ?? null);
    if (beforeValue !== afterValue) {
      changed.push(key);
    }
  }
  return changed.sort();
};

export const formatLayoutNodeDelta = (delta: LayoutNodeDelta): string[] => {
  const lines: string[] = [];
  if (delta.added.length) {
    lines.push(`Added nodes (${delta.added.length}):`);
    for (const node of delta.added) {
      lines.push(`  + ${node.id} (${node.type})`);
    }
  }
  if (delta.removed.length) {
    lines.push(`Removed nodes (${delta.removed.length}):`);
    for (const node of delta.removed) {
      lines.push(`  - ${node.id} (${node.type})`);
    }
  }
  if (delta.changedProps.length) {
    lines.push(`Changed props (${delta.changedProps.length}):`);
    for (const node of delta.changedProps) {
      lines.push(`  ~ ${node.id} (${node.type}): ${node.keys.join(', ')}`);
    }
  }
  if (!lines.length) {
    lines.push('No structural node changes detected.');
  }
  return lines;
};

export const formatComponentLayoutPatchPreview = (patch: unknown): string => {
  if (!isRecord(patch)) {
    return 'Invalid layout patch payload.';
  }

  const name = typeof patch.name === 'string' && patch.name.trim()
    ? patch.name.trim()
    : '(unnamed layout)';
  const folder = typeof patch.folder === 'string' && patch.folder.trim()
    ? patch.folder.trim()
    : 'general';

  const lines = [
    `Name: ${name}`,
    `Folder: ${folder}`,
  ];

  if (typeof patch.baseLayoutId === 'string' && patch.baseLayoutId.trim()) {
    lines.push(`Based on: ${patch.baseLayoutId.trim()}`);
  }

  const afterDocument = isRecord(patch.document) ? patch.document as DesignerDocument : null;
  const beforeDocument = isRecord(patch.previousDocument)
    ? patch.previousDocument as DesignerDocument
    : null;

  if (afterDocument?.nodes) {
    if (beforeDocument?.nodes) {
      const delta = diffDesignerDocuments(beforeDocument, afterDocument);
      lines.push(...formatLayoutNodeDelta(delta));
    } else {
      const nodes = Object.values(afterDocument.nodes);
      lines.push(`Nodes: ${nodes.length}`);
      const types = [...new Set(nodes.map((node) => node.type).filter(Boolean))];
      if (types.length > 0) {
        lines.push(`Node types: ${types.join(', ')}`);
      }
    }
  }

  const bindingCount = isRecord(patch.bindingDefinitions)
    ? Object.keys(patch.bindingDefinitions).length
    : 0;
  if (bindingCount > 0) {
    lines.push(`Bindings: ${bindingCount}`);
  }

  return lines.join('\n');
};

export const formatFunctionSourcePatchPreview = (patch: unknown): string => {
  if (!isRecord(patch)) {
    return 'Invalid function patch payload.';
  }

  const name = typeof patch.name === 'string' && patch.name.trim()
    ? patch.name.trim()
    : '(unnamed function)';
  const folder = typeof patch.folder === 'string' && patch.folder.trim()
    ? patch.folder.trim()
    : 'general';

  const lines = [
    `Name: ${name}`,
    `Folder: ${folder}`,
  ];

  if (typeof patch.baseFunctionId === 'string' && patch.baseFunctionId.trim()) {
    lines.push(`Based on: ${patch.baseFunctionId.trim()}`);
  }

  const source = typeof patch.source === 'string' ? patch.source : '';
  const beforeSource = typeof patch.beforeSource === 'string' ? patch.beforeSource : undefined;
  if (source) {
    if (beforeSource !== undefined && beforeSource !== source) {
      lines.push('', 'Diff preview:', formatUnifiedDiffPreview(beforeSource, source));
    } else {
      const truncated = source.length > MAX_SOURCE_CHARS
        ? `${source.slice(0, MAX_SOURCE_CHARS)}\n… (${source.length} chars total)`
        : source;
      lines.push('', 'Source preview:', truncated);
    }
  } else {
    lines.push('Source: (empty)');
  }

  return lines.join('\n');
};

const truncateLine = (line: string): string => (
  line.length > MAX_LINE_CHARS ? `${line.slice(0, MAX_LINE_CHARS)}…` : line
);

export const computeLayoutDeltaStats = (delta: LayoutNodeDelta): DiffLineStats => ({
  insertions: delta.added.length + delta.changedProps.length,
  deletions: delta.removed.length,
  unchanged: 0,
});

export const computeUnifiedDiffStats = (before: string, after: string): DiffLineStats => {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  let insertions = 0;
  let deletions = 0;
  let unchanged = 0;
  const maxLen = Math.max(beforeLines.length, afterLines.length);

  for (let index = 0; index < maxLen; index += 1) {
    const beforeLine = beforeLines[index];
    const afterLine = afterLines[index];
    if (beforeLine === afterLine) {
      if (beforeLine !== undefined) unchanged += 1;
      continue;
    }
    if (beforeLine !== undefined) deletions += 1;
    if (afterLine !== undefined) insertions += 1;
  }

  return { insertions, deletions, unchanged };
};

export const buildUnifiedDiffLines = (
  before: string,
  after: string,
  maxLines = MAX_PREVIEW_LINES,
): DiffPreviewLine[] => {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const lines: DiffPreviewLine[] = [];
  const maxLen = Math.max(beforeLines.length, afterLines.length);
  let emitted = 0;

  for (let index = 0; index < maxLen && emitted < maxLines; index += 1) {
    const beforeLine = beforeLines[index];
    const afterLine = afterLines[index];
    if (beforeLine === afterLine) {
      if (beforeLine !== undefined) {
        lines.push({ kind: 'same', text: truncateLine(beforeLine) });
        emitted += 1;
      }
      continue;
    }
    if (beforeLine !== undefined) {
      lines.push({ kind: 'remove', text: truncateLine(beforeLine) });
      emitted += 1;
    }
    if (afterLine !== undefined && emitted < maxLines) {
      lines.push({ kind: 'add', text: truncateLine(afterLine) });
      emitted += 1;
    }
  }

  if (maxLen > emitted) {
    lines.push({
      kind: 'context',
      text: `… (${maxLen - emitted} more line(s))`,
    });
  }

  return lines;
};

export const formatUnifiedDiffPreview = (before: string, after: string): string => (
  buildUnifiedDiffLines(before, after).map((line) => {
    if (line.kind === 'add') return `+ ${line.text}`;
    if (line.kind === 'remove') return `- ${line.text}`;
    if (line.kind === 'context') return line.text;
    return `  ${line.text}`;
  }).join('\n')
);

export const formatFilePatchPreview = (
  path: string,
  content: string,
  beforeContent?: string,
): string => {
  const lines = [`Path: ${path}`];

  if (beforeContent !== undefined && beforeContent !== content) {
    lines.push('', 'Diff preview:', formatUnifiedDiffPreview(beforeContent, content));
  } else {
    const truncated = content.length > MAX_SOURCE_CHARS
      ? `${content.slice(0, MAX_SOURCE_CHARS)}\n… (${content.length} chars total)`
      : content;
    lines.push('', 'Content preview:', truncated);
  }

  return lines.join('\n');
};

export const formatChangeSetPreview = (changeSet: ChangeSet): string => {
  switch (changeSet.kind) {
    case 'component_layout_patch':
      return formatComponentLayoutPatchPreview(changeSet.patch);
    case 'function_source_patch':
      return formatFunctionSourcePatchPreview(changeSet.patch);
    case 'file_patch':
      return formatFilePatchPreview(
        changeSet.path,
        changeSet.content,
        changeSet.beforeContent,
      );
    case 'git_operation':
      if (changeSet.operation === 'commit') {
        return `commit · ${changeSet.message ?? ''}`;
      }
      if (changeSet.operation === 'checkout') {
        return `checkout · ${changeSet.target ?? ''}`;
      }
      return `branch · ${changeSet.branchName ?? ''}${changeSet.checkout === false ? ' (no checkout)' : ''}`;
    default:
      return changeSet.summary || `${changeSet.kind} · Draft patch`;
  }
};

export const getChangeSetDisplayLabel = (changeSet: ChangeSet): string => {
  switch (changeSet.kind) {
    case 'file_patch':
      return changeSet.path;
    case 'function_source_patch': {
      const patch = isRecord(changeSet.patch) ? changeSet.patch : {};
      const folder = typeof patch.folder === 'string' && patch.folder.trim()
        ? patch.folder.trim()
        : 'general';
      const functionId = changeSet.functionId.includes('.')
        ? changeSet.functionId
        : `${folder}.${typeof patch.name === 'string' && patch.name.trim() ? patch.name.trim() : changeSet.functionId}`;
      return `workspace/server-functions/custom/${functionId}.ts`;
    }
    case 'component_layout_patch': {
      const patch = isRecord(changeSet.patch) ? changeSet.patch : {};
      const name = typeof patch.name === 'string' && patch.name.trim()
        ? patch.name.trim()
        : changeSet.layoutId;
      const folder = typeof patch.folder === 'string' && patch.folder.trim()
        ? patch.folder.trim()
        : 'general';
      return `workspace/designer/drafts/${folder}/${name}.json`;
    }
    case 'git_operation':
      if (changeSet.operation === 'commit') {
        return `git commit: ${changeSet.message ?? changeSet.title}`;
      }
      if (changeSet.operation === 'checkout') {
        return `git checkout: ${changeSet.target ?? changeSet.title}`;
      }
      return `git branch: ${changeSet.branchName ?? changeSet.title}`;
    default:
      return changeSet.summary || changeSet.title;
  }
};

export const getChangeSetPreviewMeta = (changeSet: ChangeSet): { subtitle: string } => {
  switch (changeSet.kind) {
    case 'file_patch':
      return { subtitle: changeSet.path };
    case 'component_layout_patch':
      return { subtitle: changeSet.layoutId };
    case 'function_source_patch':
      return { subtitle: changeSet.functionId };
    default:
      return { subtitle: changeSet.summary ?? changeSet.kind };
  }
};

const layoutDeltaToDiffLines = (delta: LayoutNodeDelta): DiffPreviewLine[] => {
  const lines: DiffPreviewLine[] = [];
  for (const node of delta.added) {
    lines.push({ kind: 'add', text: `${node.id} (${node.type})` });
  }
  for (const node of delta.removed) {
    lines.push({ kind: 'remove', text: `${node.id} (${node.type})` });
  }
  for (const node of delta.changedProps) {
    lines.push({ kind: 'add', text: `${node.id} (${node.type}): ${node.keys.join(', ')}` });
  }
  if (!lines.length) {
    lines.push({ kind: 'context', text: 'No structural node changes detected.' });
  }
  return lines;
};

export const getChangeSetArtifactPreview = (changeSet: ChangeSet): ChangeSetArtifactPreview => {
  const artifactLabel = getChangeSetDisplayLabel(changeSet);

  switch (changeSet.kind) {
    case 'file_patch': {
      const before = changeSet.beforeContent ?? '';
      const after = changeSet.content;
      const hasDiff = changeSet.beforeContent !== undefined && before !== after;
      const diffZones = changeSet.diffZones?.length
        ? changeSet.diffZones
        : (hasDiff ? computeLineDiffZones(before, after) : undefined);
      return {
        artifactLabel,
        stats: hasDiff ? computeUnifiedDiffStats(before, after) : {
          insertions: after.split('\n').filter((line) => line.length > 0).length,
          deletions: 0,
          unchanged: 0,
        },
        lines: hasDiff
          ? buildUnifiedDiffLines(before, after)
          : [{ kind: 'add', text: after.slice(0, MAX_SOURCE_CHARS) }],
        plainText: formatFilePatchPreview(changeSet.path, after, changeSet.beforeContent),
        diffZones,
      };
    }
    case 'function_source_patch': {
      const patch = isRecord(changeSet.patch) ? changeSet.patch : {};
      const source = typeof patch.source === 'string' ? patch.source : '';
      const beforeSource = typeof patch.beforeSource === 'string' ? patch.beforeSource : undefined;
      const hasDiff = beforeSource !== undefined && beforeSource !== source;
      return {
        artifactLabel,
        stats: hasDiff
          ? computeUnifiedDiffStats(beforeSource, source)
          : {
            insertions: source.split('\n').filter((line) => line.length > 0).length,
            deletions: 0,
            unchanged: 0,
          },
        lines: hasDiff
          ? buildUnifiedDiffLines(beforeSource, source)
          : [{ kind: 'add', text: source.slice(0, MAX_SOURCE_CHARS) || '(empty)' }],
        plainText: formatFunctionSourcePatchPreview(changeSet.patch),
      };
    }
    case 'component_layout_patch': {
      const patch = isRecord(changeSet.patch) ? changeSet.patch : {};
      const afterDocument = isRecord(patch.document) ? patch.document as DesignerDocument : null;
      const beforeDocument = isRecord(patch.previousDocument)
        ? patch.previousDocument as DesignerDocument
        : null;
      const delta = afterDocument?.nodes && beforeDocument?.nodes
        ? diffDesignerDocuments(beforeDocument, afterDocument)
        : { added: [], removed: [], changedProps: [] };
      return {
        artifactLabel,
        stats: computeLayoutDeltaStats(delta),
        lines: layoutDeltaToDiffLines(delta),
        plainText: formatComponentLayoutPatchPreview(changeSet.patch),
      };
    }
    default:
      return {
        artifactLabel,
        stats: { insertions: 0, deletions: 0, unchanged: 0 },
        lines: [{ kind: 'context', text: formatChangeSetPreview(changeSet) }],
        plainText: formatChangeSetPreview(changeSet),
      };
  }
};
