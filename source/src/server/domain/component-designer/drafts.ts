export type {
  DesignerDraftMetadata,
  DesignerDraftRecord,
  DesignerDraftSummary,
  DesignerVersionMetadata,
  DesignerVersionRecord,
  DesignerVersionSummary,
  SaveDraftInput,
} from './draftTypes';

export {
  designerDraftStoragePaths,
  getDesignerDraft,
  getDesignerDraftVersion,
  listDesignerDrafts,
  listDesignerDraftVersions,
} from './draftIo';

import {
  designerDraftStoragePaths,
  getDesignerDraft,
  getDesignerDraftVersion,
  listDesignerDrafts,
  listDesignerDraftVersions,
} from './draftIo';

export const listDesignerVersions = listDesignerDrafts;
export const getDesignerVersion = getDesignerDraft;
export const getDesignerVersionSnapshot = getDesignerDraftVersion;
export const listDesignerVersionHistory = listDesignerDraftVersions;
export const designerVersionStoragePaths = designerDraftStoragePaths;
