import type { ShellHeaderOverride } from './mergeShellHeaderModule';

/** Mode segment appended on nested-editor (item) routes — not item identity. */
export const NESTED_EDITOR_SHELL_EDIT_LABEL = 'Edit';
export const NESTED_EDITOR_SHELL_VIEW_LABEL = 'View';
/** Live connection session (Sftp / SSH / RDP) — not an editor. */
export const NESTED_EDITOR_SHELL_SESSION_LABEL = 'Session';

/**
 * Nested-editor shell override: `titleTrail` is `[listLabel, mode]`.
 * Keep `groupLabel` unset so merge retains the nav group; `ShellHeaderTitle`
 * prepends the group → rendered trail is `{group} / {page} / {mode}`.
 * Default mode is `Edit`. Connection hubs pass `Session`. Item identity belongs
 * in the content header — never append it here.
 * Pass `modeLabel: null` for singleton pages that are not list→item deep links.
 */
export function buildNestedEditorShellHeaderOverride(input: {
  listLabel: string;
  description?: string;
  icon: string;
  modeLabel?: string | null;
}): ShellHeaderOverride {
  const listLabel = input.listLabel.trim() || 'Untitled';
  const modeLabel = input.modeLabel === undefined
    ? NESTED_EDITOR_SHELL_EDIT_LABEL
    : (input.modeLabel?.trim() ?? '');
  return {
    icon: input.icon,
    label: listLabel,
    description: input.description?.trim() || undefined,
    titleTrail: modeLabel ? [listLabel, modeLabel] : [listLabel],
  };
}
