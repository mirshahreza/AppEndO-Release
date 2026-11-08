import { useMemo } from 'react';
import { useShellHeaderOverride } from '../../layouts/adminShell/ShellHeaderOverrideContext';
import { buildNestedEditorShellHeaderOverride } from '../../layouts/adminShell/nestedEditorShellHeader';
import { NESTED_EDITOR_EDIT_SEGMENT } from '../../shared/routing/nestedEditorDeepLink';

const DEFAULT_ICON = 'FileText';

function titleCaseSegment(segment: string): string {
  return segment
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** From `cms/contents/edit/42` → list label `Contents` (item stays in content header). */
export function resolveDesignerPublishedNestedEditorLabels(editSlug: string | undefined): {
  listLabel: string;
  itemLabel: string;
} | null {
  const segments = editSlug?.split('/').map((part) => part.trim()).filter(Boolean) ?? [];
  const editIndex = segments.lastIndexOf(NESTED_EDITOR_EDIT_SEGMENT);
  if (editIndex < 1 || editIndex >= segments.length - 1) {
    return null;
  }

  const listSegment = segments[editIndex - 1] ?? '';
  const itemLabel = segments.slice(editIndex + 1).join('/');
  if (!listSegment || !itemLabel) {
    return null;
  }

  return {
    listLabel: titleCaseSegment(listSegment),
    itemLabel,
  };
}

export type DesignerPublishedShellHeaderInput = {
  enabled: boolean;
  editSlug?: string | null;
  listLabel?: string | null;
  icon?: string | null;
};

export function buildDesignerPublishedShellHeaderOverride(input: {
  listLabel: string;
  icon?: string;
}) {
  return buildNestedEditorShellHeaderOverride({
    listLabel: input.listLabel,
    icon: input.icon?.trim() || DEFAULT_ICON,
  });
}

export function useDesignerPublishedShellHeader(input: DesignerPublishedShellHeaderInput): void {
  const resolved = useMemo(() => {
    if (!input.enabled) {
      return null;
    }
    const fromSlug = resolveDesignerPublishedNestedEditorLabels(input.editSlug ?? undefined);
    const listLabel = input.listLabel?.trim() || fromSlug?.listLabel;
    if (!listLabel) {
      return null;
    }
    return buildDesignerPublishedShellHeaderOverride({
      listLabel,
      icon: input.icon ?? undefined,
    });
  }, [input.editSlug, input.enabled, input.icon, input.listLabel]);

  useShellHeaderOverride(resolved);
}
