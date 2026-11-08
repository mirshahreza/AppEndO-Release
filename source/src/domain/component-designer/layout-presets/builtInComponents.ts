import type { DesignerVersionRecord, DesignerVersionSummary } from '../../../shared/api/queries/component-designer';
import {
  NEW_LAYOUT_PRESETS,
  createStableStateFromNewLayoutPreset,
} from './newLayoutPresets';
import { isBuiltInShellPresetId, type NewLayoutPresetId } from './types';
import { DEFAULT_DRAFT_FOLDER, isSystemManagedShellLayoutDraft } from '../../../shared/lib/designerShellEntry';
import { normalizeDesignerComponentName } from '../../../shared/lib/designerIdentity';
import { parseDesignerComponentPath } from '../../../shared/lib/designerComponentPath';

const BUILT_IN_COMPONENT_EPOCH = '2024-01-01T00:00:00.000Z';
const BUILT_IN_COMPONENT_PREFIX = 'builtin-';

/** Virtual folder for layout starter templates. Copy sources only — not live portal skins. */
export const LAYOUT_TEMPLATE_FOLDER = 'templates';

export const catalogFolderForBuiltInPreset = (presetId: NewLayoutPresetId): string => (
  isBuiltInShellPresetId(presetId) ? DEFAULT_DRAFT_FOLDER : LAYOUT_TEMPLATE_FOLDER
);

/** Former admin-page mock ids (`builtin-page-*`). Callers must reject these; they are not in the catalog. */
const LEGACY_BUILT_IN_ADMIN_PAGE_PREFIX = 'builtin-page-';

export const isBuiltInComponentId = (componentId: string): boolean => componentId.startsWith(BUILT_IN_COMPONENT_PREFIX);

export const toBuiltInComponentId = (presetId: NewLayoutPresetId): string => `${BUILT_IN_COMPONENT_PREFIX}${presetId}`;

export const getBuiltInPresetId = (componentId: string): NewLayoutPresetId | null => {
  if (!isBuiltInComponentId(componentId) || componentId.startsWith(LEGACY_BUILT_IN_ADMIN_PAGE_PREFIX)) {
    return null;
  }

  const presetId = componentId.slice(BUILT_IN_COMPONENT_PREFIX.length) as NewLayoutPresetId;
  return NEW_LAYOUT_PRESETS.some((preset) => preset.id === presetId) ? presetId : null;
};

const listLayoutPresetSummaries = (): DesignerVersionSummary[] => (
  NEW_LAYOUT_PRESETS
    .filter((preset) => preset.id !== 'blank')
    .map((preset) => ({
      id: toBuiltInComponentId(preset.id),
      name: preset.id,
      folder: catalogFolderForBuiltInPreset(preset.id),
      createdAt: BUILT_IN_COMPONENT_EPOCH,
      updatedAt: BUILT_IN_COMPONENT_EPOCH,
      createdBy: 'system',
      updatedBy: 'system',
      isBuiltIn: true,
    }))
);

export const listBuiltInComponentSummaries = (): DesignerVersionSummary[] => (
  listLayoutPresetSummaries()
);

export const getBuiltInComponentRecord = (componentId: string): DesignerVersionRecord | null => {
  const presetId = getBuiltInPresetId(componentId);
  if (!presetId) {
    return null;
  }

  const preset = NEW_LAYOUT_PRESETS.find((item) => item.id === presetId);
  if (!preset) {
    return null;
  }

  const { state } = createStableStateFromNewLayoutPreset(presetId, componentId, preset.id);

  return {
    id: componentId,
    name: preset.id,
    folder: catalogFolderForBuiltInPreset(presetId),
    document: state.document,
    bindingDefinitions: state.bindingDefinitions,
    metadata: {
      createdAt: BUILT_IN_COMPONENT_EPOCH,
      updatedAt: BUILT_IN_COMPONENT_EPOCH,
      createdBy: 'system',
      updatedBy: 'system',
    },
  };
};

export const getBuiltInComponentRecordByName = (componentLookup: string): DesignerVersionRecord | null => {
  const trimmed = componentLookup.trim();
  if (!trimmed) {
    return null;
  }

  const parsedPath = parseDesignerComponentPath(trimmed);
  const lookupKey = normalizeDesignerComponentName(parsedPath?.componentName ?? trimmed);
  if (!lookupKey) {
    return null;
  }

  const summary = listBuiltInComponentSummaries().find(
    (item) => normalizeDesignerComponentName(item.name) === lookupKey,
  );

  return summary ? getBuiltInComponentRecord(summary.id) : null;
};

export const isLayoutTemplateSummary = (
  item: Pick<DesignerVersionSummary, 'isBuiltIn' | 'folder' | 'name'>,
): boolean => {
  if (isBuiltInShellPresetId(item.name)) {
    return false;
  }

  return Boolean(item.isBuiltIn) || item.folder?.trim() === LAYOUT_TEMPLATE_FOLDER;
};

/** Saved drafts + package UI + built-in shells in `general`, plus copy starters in `templates`. */
export const mergeComponentsCatalog = (
  customItems: DesignerVersionSummary[],
): DesignerVersionSummary[] => {
  const customOnly = customItems.filter(
    (item) => !item.isBuiltIn && !isSystemManagedShellLayoutDraft(item),
  );
  const customIds = new Set(customOnly.map((item) => item.id));
  const customNames = new Set(
    customOnly.map((item) => normalizeDesignerComponentName(item.name)),
  );
  const templateItems = listBuiltInComponentSummaries().filter((item) => (
    !customIds.has(item.id)
    && !customNames.has(normalizeDesignerComponentName(item.name))
  ));
  const normalizedCustomItems = customOnly.map((item) => ({
    ...item,
    folder: item.folder?.trim() ? item.folder.trim().toLowerCase() : 'general',
    isBuiltIn: false,
  }));

  return [...templateItems, ...normalizedCustomItems].sort((left, right) => {
    const byUpdatedAt = (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '');
    if (byUpdatedAt !== 0) {
      return byUpdatedAt;
    }

    return left.id.localeCompare(right.id);
  });
};
