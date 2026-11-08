import type { DesignerDocument } from '../../domain/component-designer/types';
/** Minimal document for studio `AppShell` before the portal layout draft finishes loading. */
export const APP_SHELL_LAYOUT_WIDTH_FALLBACK_DOCUMENT: DesignerDocument = {
  schemaVersion: '1',
  id: 'appendo:app-shell-layout-width-fallback',
  name: 'App Shell chrome',
  rootNodeId: 'root',
  nodes: {
    root: {
      id: 'root',
      type: 'container',
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: [],
    },
  },
  metadata: {
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    shellLayoutWidth: 'bounded',
    shellLayoutWidthUserControl: true,
    shellBoundedMaxWidth: 'lg',
    shellBoundedEdge: 'outset',
  },
  diagnostics: [],
};

export function resolveAppShellLayoutDocument(
  loaded: DesignerDocument | null | undefined,
  appShellChrome: boolean,
): DesignerDocument {
  if (!appShellChrome) {
    if (!loaded) {
      return APP_SHELL_LAYOUT_WIDTH_FALLBACK_DOCUMENT;
    }
    return {
      ...loaded,
      metadata: {
        ...APP_SHELL_LAYOUT_WIDTH_FALLBACK_DOCUMENT.metadata,
        ...loaded.metadata,
      },
    };
  }

  if (!loaded) {
    return APP_SHELL_LAYOUT_WIDTH_FALLBACK_DOCUMENT;
  }

  // Built-in studio admin chrome (`AdminLayout` / `AppShell`) — same header control in every culture (RTL/LTR).
  return {
    ...loaded,
    metadata: {
      ...loaded.metadata,
      shellLayoutWidth: 'bounded',
      shellLayoutWidthUserControl: true,
      shellBoundedMaxWidth: loaded.metadata.shellBoundedMaxWidth ?? 'lg',
      shellBoundedEdge: loaded.metadata.shellBoundedEdge ?? 'outset',
    },
  };
}
