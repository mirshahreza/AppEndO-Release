/**
 * Canonical nested-editor deep-link segments shared by Workflows, Server Functions, Workbooks, and other list→edit surfaces.
 * See `docs/standards/deep-linking.md`.
 */
export const NESTED_EDITOR_EDIT_SEGMENT = 'edit';
export const NESTED_EDITOR_VIEW_SEGMENT = 'view';

export const NESTED_EDITOR_DEEP_LINK_MODES = [
  NESTED_EDITOR_VIEW_SEGMENT,
  NESTED_EDITOR_EDIT_SEGMENT,
] as const;

export type NestedEditorDeepLinkMode = (typeof NESTED_EDITOR_DEEP_LINK_MODES)[number];

/** Segments after the list route segment → item slug (folder/name, workflow key, `new`, …). */
export function resolveNestedEditorItemSlug(
  segmentsAfterListSegment: string[],
  modeSegment: string = NESTED_EDITOR_EDIT_SEGMENT,
): string | undefined {
  const link = resolveNestedEditorDeepLink(segmentsAfterListSegment);
  if (!link || link.mode !== modeSegment) {
    return undefined;
  }
  return link.itemSlug;
}

export function resolveNestedEditorDeepLink(
  segmentsAfterListSegment: string[],
): { mode: NestedEditorDeepLinkMode; itemSlug: string } | null {
  if (segmentsAfterListSegment.length < 2) {
    return null;
  }

  const modeRaw = segmentsAfterListSegment[0];
  if (modeRaw !== NESTED_EDITOR_EDIT_SEGMENT && modeRaw !== NESTED_EDITOR_VIEW_SEGMENT) {
    return null;
  }

  const itemSegments = segmentsAfterListSegment.slice(1);
  if (itemSegments.length === 0) {
    return null;
  }

  return {
    mode: modeRaw,
    itemSlug: itemSegments.join('/'),
  };
}

export function buildNestedEditorRelativePath(
  listSegment: string,
  mode: NestedEditorDeepLinkMode,
  itemSlug: string,
): string {
  const trimmedSlug = itemSlug.replace(/^\/+/, '').replace(/\/+$/, '');
  return `${listSegment}/${mode}/${trimmedSlug}`;
}

export function buildNestedEditorEditRelativePath(
  listSegment: string,
  itemSlug: string,
): string {
  return buildNestedEditorRelativePath(listSegment, NESTED_EDITOR_EDIT_SEGMENT, itemSlug);
}

export function buildNestedEditorViewRelativePath(
  listSegment: string,
  itemSlug: string,
): string {
  return buildNestedEditorRelativePath(listSegment, NESTED_EDITOR_VIEW_SEGMENT, itemSlug);
}
