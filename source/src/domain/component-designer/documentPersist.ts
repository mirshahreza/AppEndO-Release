import { DESIGNER_DOCUMENT_SCHEMA_VERSION } from './documentSchema';
import type { DesignerDocument } from './types';
import { validateDesignerDocument } from './validation';

export type PrepareDesignerDocumentForPersistOptions = {
  draftId?: string;
  draftName?: string;
};

/**
 * Normalize a document loaded from file-backed storage.
 * Diagnostics are ephemeral — recomputed in the designer reducer after hydrate.
 * Slot validation uses the static platform catalog, not SlotRegistry runtime state.
 */
export const normalizeDesignerDocumentFromPersist = (
  document: DesignerDocument,
): DesignerDocument => ({
  ...structuredClone(document),
  schemaVersion: document.schemaVersion?.trim() || DESIGNER_DOCUMENT_SCHEMA_VERSION,
  diagnostics: [],
});

export const prepareDesignerDocumentForPersist = (
  document: DesignerDocument,
  options: PrepareDesignerDocumentForPersistOptions = {},
): DesignerDocument => {
  const normalized = normalizeDesignerDocumentFromPersist(document);

  if (options.draftId) {
    normalized.id = options.draftId;
  }

  if (options.draftName) {
    normalized.name = options.draftName;
  }

  return normalized;
};

export const assertPersistableDesignerDocument = (document: DesignerDocument): void => {
  const errors = validateDesignerDocument(document).filter((item) => item.level === 'error');
  if (errors.length > 0) {
    throw new Error(errors.map((item) => item.message).join(' | '));
  }
};
