import { STUDIO_PORTAL_SEGMENT } from '../../../../shared/api/contracts/platform/mountConstants';
import { buildDesignerComponentPath } from '../../../../shared/lib/designerComponentPath';
import type { DataSourceDefinition } from '../../../../domain/component-designer/types';
import { coerceBindingDefinitions } from '../../../../domain/component-designer/bindingRegistry';
import type { NativeToolDefinition } from '../ToolRegistry';
import { executeDraftComponentLayout } from './draftComponentLayout';
import {
  getAgentDraft,
  putAgentDraft,
  type ComponentLayoutDraft,
  type ComponentLayoutMenuEntry,
} from './agentDraftStore';

export const DRAFT_APPLICATION_SCAFFOLD_TOOL_NAME = 'draft_application_scaffold';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const slugifyName = (name: string): string => (
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled-app'
);

type ScaffoldPageInput = {
  name: string;
  templateId?: string;
  description?: string;
  /** Defaults to true — mirrors DesignerAddToMenuButton for each page. */
  addToMenu?: boolean;
};

const parsePages = (value: unknown): ScaffoldPageInput[] | { error: string } => {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: 'pages must be a non-empty array of { name, templateId?, description?, addToMenu? }.' };
  }

  const pages: ScaffoldPageInput[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) {
      return { error: 'Each page must be an object with a name.' };
    }
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!name) {
      return { error: 'Each page requires a non-empty name.' };
    }
    pages.push({
      name,
      templateId: typeof entry.templateId === 'string' ? entry.templateId.trim() : undefined,
      description: typeof entry.description === 'string' ? entry.description.trim() : undefined,
      addToMenu: entry.addToMenu === false ? false : true,
    });
  }
  return pages;
};

const parseSharedDataSources = (value: unknown): Record<string, DataSourceDefinition> => {
  if (!isRecord(value)) return {};
  const next: Record<string, DataSourceDefinition> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!key.trim() || !isRecord(entry)) continue;
    next[key.trim()] = entry as DataSourceDefinition;
  }
  return next;
};

const mergeSharedDataSourcesIntoDraft = (
  draft: ComponentLayoutDraft,
  sharedDataSources: Record<string, DataSourceDefinition>,
): ComponentLayoutDraft => {
  if (Object.keys(sharedDataSources).length === 0) return draft;

  const registry = coerceBindingDefinitions(draft.bindingDefinitions);
  const merged = {
    ...registry,
    dataSources: {
      ...registry.dataSources,
      ...sharedDataSources,
    },
  };

  const updated: ComponentLayoutDraft = {
    ...draft,
    bindingDefinitions: merged as unknown as ComponentLayoutDraft['bindingDefinitions'],
  };
  putAgentDraft(updated);
  return updated;
};

const attachMenuEntry = (
  draft: ComponentLayoutDraft,
  portalSegment: string,
): ComponentLayoutDraft => {
  const componentPath = buildDesignerComponentPath(draft.folder, draft.name);
  const menuEntry: ComponentLayoutMenuEntry = {
    portalSegment,
    navLabel: draft.name,
    pageKey: componentPath,
    path: `${componentPath}/`,
    loaderRef: componentPath,
  };
  const updated: ComponentLayoutDraft = { ...draft, menuEntry };
  putAgentDraft(updated);
  return updated;
};

/**
 * Orchestrates multiple `draft_component_layout` calls (pages + shell) and attaches
 * portal menu intents — no parallel document generator.
 */
export const executeDraftApplicationScaffold = async (args: Record<string, unknown>) => {
  const appName = typeof args.appName === 'string' ? args.appName.trim() : '';
  if (!appName) {
    return { ok: false as const, summary: 'Application name is required.', error: 'missing_app_name' };
  }

  const pagesResult = parsePages(args.pages);
  if ('error' in pagesResult) {
    return { ok: false as const, summary: pagesResult.error, error: 'invalid_pages' };
  }

  const folder = typeof args.folder === 'string' && args.folder.trim()
    ? args.folder.trim().toLowerCase()
    : slugifyName(appName);
  const shellTemplateId = typeof args.shellTemplateId === 'string' && args.shellTemplateId.trim()
    ? args.shellTemplateId.trim()
    : 'app-shell';
  const portalSegment = typeof args.portalSegment === 'string' && args.portalSegment.trim()
    ? args.portalSegment.trim()
    : STUDIO_PORTAL_SEGMENT;
  const description = typeof args.description === 'string' ? args.description.trim() : undefined;
  const sharedDataSources = parseSharedDataSources(args.sharedDataSources);

  const shellResult = await executeDraftComponentLayout({
    name: `${appName} Shell`,
    folder,
    templateId: shellTemplateId,
    description: description
      ? `Shell for ${appName}: ${description}`
      : `Application shell for ${appName}`,
  });
  if (!shellResult.ok || !shellResult.data?.draftId) {
    return {
      ok: false as const,
      summary: shellResult.ok === false
        ? shellResult.summary
        : 'Failed to draft application shell.',
      error: shellResult.ok === false ? shellResult.error : 'shell_draft_failed',
    };
  }

  const pageDrafts: Array<{
    draftId: string;
    layoutId: string;
    name: string;
    folder: string;
    nodeCount: number;
    menuEntry?: ComponentLayoutMenuEntry;
  }> = [];
  const artifacts: Array<{ kind: 'draft'; id: string; label: string }> = [
    { kind: 'draft', id: shellResult.data.draftId, label: `${appName} Shell` },
  ];

  for (const page of pagesResult) {
    const pageResult = await executeDraftComponentLayout({
      name: page.name,
      folder,
      templateId: page.templateId || undefined,
      description: page.description
        || (description ? `${appName} — ${page.name}: ${description}` : `${appName} — ${page.name}`),
    });
    if (!pageResult.ok || !pageResult.data?.draftId) {
      return {
        ok: false as const,
        summary: pageResult.ok === false
          ? `Page "${page.name}": ${pageResult.summary}`
          : `Failed to draft page "${page.name}".`,
        error: pageResult.ok === false ? pageResult.error : 'page_draft_failed',
        data: {
          shell: shellResult.data,
          pagesCompleted: pageDrafts,
        },
      };
    }

    let draft = getAgentDraft(pageResult.data.draftId);
    if (!draft || draft.kind !== 'component_layout') {
      return {
        ok: false as const,
        summary: `Page "${page.name}" draft was not stored.`,
        error: 'page_draft_missing',
      };
    }

    draft = mergeSharedDataSourcesIntoDraft(draft, sharedDataSources);
    if (page.addToMenu !== false) {
      draft = attachMenuEntry(draft, portalSegment);
    }

    pageDrafts.push({
      draftId: draft.id,
      layoutId: draft.layoutId,
      name: draft.name,
      folder: draft.folder,
      nodeCount: Object.keys(draft.document.nodes).length,
      menuEntry: draft.menuEntry,
    });
    artifacts.push({ kind: 'draft', id: draft.id, label: draft.name });
  }

  const menuEntries = pageDrafts
    .map((page) => page.menuEntry)
    .filter((entry): entry is ComponentLayoutMenuEntry => Boolean(entry));

  return {
    ok: true as const,
    summary: `Drafted application scaffold "${appName}" (${pageDrafts.length} page(s) + shell; ${menuEntries.length} menu entr${menuEntries.length === 1 ? 'y' : 'ies'}).`,
    data: {
      appName,
      folder,
      portalSegment,
      shellTemplateId,
      shell: shellResult.data,
      pages: pageDrafts,
      menuEntries,
      sharedDataSourceKeys: Object.keys(sharedDataSources),
    },
    artifacts,
  };
};

export const draftApplicationScaffoldTool: NativeToolDefinition = {
  name: DRAFT_APPLICATION_SCAFFOLD_TOOL_NAME,
  description: [
    'Scaffolds a multi-page application by orchestrating draft_component_layout (no parallel generator).',
    'Creates one Shell layout plus N page layouts in the same folder, attaches portal menu intents (DesignerAddToMenuButton parity),',
    'and optionally merges shared Data Sources into each page. Use for multi-screen apps (list+detail, CRUD portals, etc.) — for a single Designer screen, use draft_component_layout instead.',
    'Every generated visual control must carry label + hint (page-guide sidecar) so the companion can explain the published UI.',
    'Example: draft_application_scaffold({ appName: "Order Management", pages: [{ name: "Orders List", templateId: "crud-collection-page" }, { name: "Order Detail" }] }).',
  ].join(' '),
  group: 'draft',
  parameters: {
    type: 'object',
    properties: {
      appName: { type: 'string', description: 'Application display name (also used as default folder slug)' },
      folder: { type: 'string', description: 'Shared component folder for shell + pages (default: slugified appName)' },
      shellTemplateId: { type: 'string', description: 'Shell built-in template id (default: app-shell; admin-shell also valid)' },
      portalSegment: { type: 'string', description: 'Portal segment for menu entries (default: studio)' },
      description: { type: 'string', description: 'Optional description applied to shell/pages' },
      pages: {
        type: 'array',
        description: 'Page specs: [{ name, templateId?, description?, addToMenu? }]. addToMenu defaults true.',
      },
      sharedDataSources: {
        type: 'object',
        description: 'Optional DataSourceDefinition map merged into every page draft (shared bindings).',
      },
    },
    required: ['appName', 'pages'],
  },
  execute: executeDraftApplicationScaffold,
};
