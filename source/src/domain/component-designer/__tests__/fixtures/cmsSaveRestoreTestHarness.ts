import type { DesignerBindingDefinitions, DesignerDocument } from '../../types';
import { buildPreviewDesignerStore } from '../../designerPreviewResolvers';
import { collectPreviewDataSourceHydrationTargets } from '../../bindingDynamicActionsCodegen';
import { visibilityStorePathForNode } from '../../bindingDynamicActionsEngine';
import {
  buildCmsTestContentRecord,
  buildCmsTestSettingsRecord,
} from './cmsSaveRestoreFixtures';

export const findNodeByProp = (
  document: DesignerDocument,
  key: string,
  value: unknown,
): string | null => {
  const match = Object.entries(document.nodes).find(([, node]) => node.props[key] === value);
  return match?.[0] ?? null;
};

export const findModalNodeId = (document: DesignerDocument, title: string): string => {
  const nodeId = findNodeByProp(document, 'title', title);
  if (!nodeId) {
    throw new Error(`Modal "${title}" was not found in the designer document.`);
  }
  return nodeId;
};

export const buildModalVisibilityStore = (
  document: DesignerDocument,
  modalTitle: string,
  routeParams?: Record<string, string>,
) => {
  const modalId = findModalNodeId(document, modalTitle);
  const baseStore = buildPreviewDesignerStore({}, routeParams);
  return {
    ...baseStore,
    routeParams: routeParams ?? (baseStore.routeParams as Record<string, unknown> | undefined) ?? {},
    ui: {
      ...((baseStore.ui as Record<string, unknown> | undefined) ?? {}),
      visibility: {
        ...(((baseStore.ui as { visibility?: Record<string, boolean> } | undefined)?.visibility) ?? {}),
        [modalId]: true,
      },
    },
  };
};

type HydrationSeedOptions = {
  routeParams?: Record<string, string>;
  content?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  openModalTitle?: string;
};

export const buildCmsPreviewHarness = (
  bundle: {
    document: DesignerDocument;
    bindingDefinitions: DesignerBindingDefinitions;
  },
  options: HydrationSeedOptions = {},
) => {
  const contentRecord = buildCmsTestContentRecord(options.content);
  const settingsRecord = buildCmsTestSettingsRecord(options.settings);
  const routeParams = options.routeParams;
  const designerStore = options.openModalTitle
    ? buildModalVisibilityStore(bundle.document, options.openModalTitle, routeParams)
    : buildPreviewDesignerStore(bundle.bindingDefinitions, routeParams);

  const hydrationData: Record<string, unknown> = {};
  const targets = collectPreviewDataSourceHydrationTargets(bundle.document, bundle.bindingDefinitions);

  for (const target of targets) {
    const isRecord = target.resultShape === 'record'
      || Object.keys(target.urlParams ?? {}).length > 0;

    if (target.dataSourceId === 'cmsSettings' || target.endpoint.includes('/api/cms/settings')) {
      hydrationData[target.dataVar] = settingsRecord;
      continue;
    }

    if (target.dataSourceId === 'cmsContents' || target.endpoint.includes('/api/cms/contents/')) {
      if (isRecord) {
        hydrationData[target.dataVar] = contentRecord;
      } else {
        hydrationData[target.dataVar] = [contentRecord];
      }
      continue;
    }

    hydrationData[target.dataVar] = isRecord ? {} : [];
  }

  return { designerStore, hydrationData, contentRecord, settingsRecord };
};

export const patchStoreVisibility = (
  store: Record<string, unknown>,
  modalNodeId: string,
  visible = true,
) => ({
  ...store,
  ui: {
    ...((store.ui as Record<string, unknown> | undefined) ?? {}),
    visibility: {
      ...(((store.ui as { visibility?: Record<string, boolean> } | undefined)?.visibility) ?? {}),
      [modalNodeId]: visible,
    },
  },
});

export const visibilityPathForModal = (modalNodeId: string) => visibilityStorePathForNode(modalNodeId);
