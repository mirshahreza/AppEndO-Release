import type { DesignerDocument } from '../../domain/component-designer/types';
import {
  findShellFrameNode,
  type ShellBoundedEdge,
  type ShellBoundedMaxWidth,
  type ShellLayoutWidth,
} from '../ui/shell-foundation/shellLayoutWidth';

export type ShellLayoutDocumentSettings = {
  layoutWidth: ShellLayoutWidth;
  boundedMaxWidth?: ShellBoundedMaxWidth;
  boundedEdge?: ShellBoundedEdge;
  layoutWidthUserControl?: boolean;
};

export function applyShellLayoutSettingsToDocument(
  document: DesignerDocument,
  settings: ShellLayoutDocumentSettings,
): DesignerDocument {
  const { layoutWidth, boundedMaxWidth, boundedEdge, layoutWidthUserControl } = settings;
  const now = new Date().toISOString();
  const nodes = { ...document.nodes };
  const frame = findShellFrameNode(document);
  if (frame) {
    nodes[frame.id] = {
      ...frame,
      props: {
        ...frame.props,
        layoutWidth,
        ...(boundedMaxWidth ? { boundedMaxWidth } : {}),
        ...(boundedEdge ? { boundedEdge } : {}),
      },
    };
  }

  const shellDesigner = document.metadata.shellDesigner;
  const metadata: DesignerDocument['metadata'] = {
    ...document.metadata,
    updatedAt: now,
    shellLayoutWidth: layoutWidth,
    ...(boundedMaxWidth ? { shellBoundedMaxWidth: boundedMaxWidth } : {}),
    ...(boundedEdge ? { shellBoundedEdge: boundedEdge } : {}),
    ...(layoutWidthUserControl === undefined
      ? {}
      : { shellLayoutWidthUserControl: layoutWidthUserControl }),
  };

  if (shellDesigner?.owner === 'shell-designer') {
    metadata.shellDesigner = {
      ...shellDesigner,
      recipe: {
        ...shellDesigner.recipe,
        visual: {
          ...shellDesigner.recipe.visual,
          layoutWidth,
          boundedMaxWidth: boundedMaxWidth ?? shellDesigner.recipe.visual.boundedMaxWidth ?? 'lg',
          boundedEdge: boundedEdge ?? shellDesigner.recipe.visual.boundedEdge ?? 'outset',
          ...(layoutWidthUserControl === undefined
            ? {}
            : { layoutWidthUserControl }),
        },
      },
    };
  }

  return {
    ...document,
    nodes,
    metadata,
  };
}

/** @deprecated Use applyShellLayoutSettingsToDocument */
export function applyShellLayoutWidthToDocument(
  document: DesignerDocument,
  layoutWidth: ShellLayoutWidth,
  boundedEdge?: ShellBoundedEdge,
): DesignerDocument {
  return applyShellLayoutSettingsToDocument(document, { layoutWidth, boundedEdge });
}
