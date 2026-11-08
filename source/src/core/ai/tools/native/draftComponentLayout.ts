import { createStableStateFromTemplateSeeds } from '../../../../domain/component-designer/templateStateBuilder';
import { getDesignerDraft } from '../../../../server/domain/component-designer/drafts';
import { sanitizeDraftId } from '../../../../server/domain/component-designer/draftIo';
import {
  getBuiltInComponentRecord,
  getBuiltInPresetId,
  isBuiltInComponentId,
  toBuiltInComponentId,
} from '../../../../domain/component-designer/layout-presets/builtInComponents';
import type { NewLayoutPresetId } from '../../../../domain/component-designer/layout-presets/types';
import type { DesignerDocument } from '../../../../domain/component-designer/types';
import type { NativeToolDefinition } from '../ToolRegistry';
import { createDraftId, putAgentDraft } from './agentDraftStore';

export const DRAFT_COMPONENT_LAYOUT_TOOL_NAME = 'draft_component_layout';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const slugifyName = (name: string): string => (
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled-component'
);

export const executeDraftComponentLayout = async (args: Record<string, unknown>) => {
  const name = typeof args.name === 'string' ? args.name.trim() : '';
  if (!name) {
    return { ok: false as const, summary: 'Component name is required.', error: 'missing_name' };
  }

  const folder = typeof args.folder === 'string' && args.folder.trim()
    ? args.folder.trim().toLowerCase()
    : 'general';
  const description = typeof args.description === 'string' ? args.description.trim() : undefined;
  const templateId = typeof args.templateId === 'string' ? args.templateId.trim() : '';
  const layoutIdArg = typeof args.layoutId === 'string' ? args.layoutId.trim() : '';
  const componentId = slugifyName(name);
  const layoutId = sanitizeDraftId(componentId);

  let document: DesignerDocument;
  let bindingDefinitions: Record<string, unknown> = {};
  let baseLayoutId: string | undefined;

  if (isRecord(args.document)) {
    document = args.document as DesignerDocument;
  } else if (layoutIdArg) {
    baseLayoutId = layoutIdArg;
    const existing = isBuiltInComponentId(layoutIdArg)
      ? getBuiltInComponentRecord(layoutIdArg)
      : getDesignerDraft(layoutIdArg);
    if (!existing) {
      return { ok: false as const, summary: `Layout "${layoutIdArg}" was not found.`, error: 'layout_not_found' };
    }
    document = structuredClone(existing.document);
    bindingDefinitions = structuredClone(existing.bindingDefinitions ?? {});
  } else if (templateId) {
    const builtInId = isBuiltInComponentId(templateId)
      ? templateId
      : toBuiltInComponentId(templateId as NewLayoutPresetId);
    const fromPreset = getBuiltInPresetId(builtInId)
      ? getBuiltInComponentRecord(builtInId)
      : null;
    if (!fromPreset) {
      return {
        ok: false as const,
        summary: `Built-in template "${templateId}" was not found.`,
        error: 'template_not_found',
      };
    }
    document = structuredClone(fromPreset.document);
    bindingDefinitions = structuredClone(fromPreset.bindingDefinitions ?? {});
  } else {
    const built = createStableStateFromTemplateSeeds([], layoutId, name);
    document = built.state.document;
    bindingDefinitions = built.state.bindingDefinitions ?? {};
  }

  document = {
    ...document,
    id: layoutId,
    name,
  };

  const draftId = createDraftId();
  const draft = putAgentDraft({
    kind: 'component_layout',
    id: draftId,
    layoutId,
    name,
    folder,
    description,
    document,
    bindingDefinitions: bindingDefinitions as Record<string, import('../../../../domain/component-designer/types').DesignerBindingDefinition>,
    baseLayoutId,
  }) as import('./agentDraftStore').ComponentLayoutDraft;

  return {
    ok: true as const,
    summary: `Drafted component layout "${name}" (${draft.layoutId}).`,
    data: {
      draftId: draft.id,
      layoutId: draft.layoutId,
      name: draft.name,
      folder: draft.folder,
      nodeCount: Object.keys(draft.document.nodes).length,
      templateId: templateId || undefined,
    },
    artifacts: [{ kind: 'draft' as const, id: draft.id, label: draft.name }],
  };
};

export const draftComponentLayoutTool: NativeToolDefinition = {
  name: DRAFT_COMPONENT_LAYOUT_TOOL_NAME,
  description: 'Drafts a Component Designer layout (no save to disk). Use when building a single screen or UI from built-in layout presets (contact-form, kpi-metrics-grid, …) — for a multi-page app (shell + pages + menu), use draft_application_scaffold instead. Every generated form control must include label plus a plain-language hint so the studio page guide can explain it (auto-form/CRUD builders already emit hint). After insert, set hint via designer_set_prop when adding fields by hand. Returns draftId, folder, nodeCount, templateId, and a draft artifact.',
  group: 'draft',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Component display name' },
      folder: { type: 'string', description: 'Component folder (default: general)' },
      templateId: { type: 'string', description: 'Built-in layout preset id (contact-form, auth-login, kpi-metrics-grid, …) or builtin-<presetId>' },
      layoutId: { type: 'string', description: 'Existing layout/draft id to base changes on' },
      description: { type: 'string', description: 'Optional draft description' },
      document: { type: 'object', description: 'Full DesignerDocument replacement when editing the open Live Designer canvas from a snapshot' },
      bindingDefinitions: { type: 'object', description: 'Optional binding definitions to store with the document' },
    },
    required: ['name'],
  },
  execute: executeDraftComponentLayout,
};
