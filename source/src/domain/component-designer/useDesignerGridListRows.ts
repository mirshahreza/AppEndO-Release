import { resolveGridListDataVarName } from './bindingGridEngine';
import { useDesignerHydratedRows, type DesignerHydratedRowsState } from './useDesignerHydratedRows';
import type { DesignerBindingDefinitions, DesignerDocument } from './types';

export type DesignerGridListRowsState = DesignerHydratedRowsState;

/**
 * Thin wrapper over the generic `useDesignerHydratedRows` (see that file for the reactivity fix
 * this session — the canvas's grid hydration previously never re-fetched on toolbar
 * search/filter changes). Kept as its own named hook since `DesignerCanvasHydratedDataGrid.tsx`
 * already depends on this exact name/shape.
 */
export const useDesignerGridListRows = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
  nodeId: string,
  designerStore?: Record<string, unknown>,
): DesignerGridListRowsState =>
  useDesignerHydratedRows(document, bindingDefinitions, resolveGridListDataVarName(nodeId), designerStore);
