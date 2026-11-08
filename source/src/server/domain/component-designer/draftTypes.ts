import type { CatalogKind } from '../../../shared/api/queries/component-designer';
import type { DesignerBindingDefinitions, DesignerDocument, DesignerWorkspacePrefs } from '../../../domain/component-designer/types';

export type DesignerDraftMetadata = {
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  stateVersion?: number;
};

export type DesignerDraftRecord = {
  schema: 'component-designer-draft';
  id: string;
  name: string;
  folder: string;
  /** Operator catalog type: Custom, Shell, or Template. Built-ins stay derived. */
  catalogKind?: CatalogKind;
  /** Leftover disk field — Client Components no longer uses operator tags. */
  tags?: string[];
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  workspace?: DesignerWorkspacePrefs;
  metadata: DesignerDraftMetadata;
};

export type DesignerDraftSummary = {
  id: string;
  name: string;
  folder: string;
  catalogKind?: CatalogKind;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  isBuiltIn?: boolean;
};

export type DesignerVersionMetadata = DesignerDraftMetadata;
export type DesignerVersionRecord = DesignerDraftRecord;
export type DesignerVersionSummary = DesignerDraftSummary;

export type SaveDraftInput = {
  id?: string;
  name: string;
  folder?: string;
  catalogKind?: CatalogKind;
  tags?: string[];
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  workspace?: DesignerWorkspacePrefs;
  actor?: string;
  /** Required when updating a Shell Designer-owned draft. */
  expectedStateVersion?: number;
  /** Name/tags-only updates must not bump Shell Designer stateVersion. */
  preserveStateVersion?: boolean;
};

export type DesignerDraftIndex = {
  schema: 'component-designer-drafts-index';
  updatedAt: string;
  drafts: DesignerDraftSummary[];
};
