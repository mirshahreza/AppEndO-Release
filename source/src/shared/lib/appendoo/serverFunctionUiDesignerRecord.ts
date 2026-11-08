import { prepareDesignerDocumentForPersist } from '../../../domain/component-designer/documentPersist';
import type { DesignerDraftRecord } from '../../../server/domain/component-designer/draftTypes';
import {
  buildServerFunctionUiDesignerDraft,
  type ServerFunctionUiDraftRecord,
} from './serverFunctionUiDraftScaffold';

/** Convert a server-function UI scaffold into a persisted designer draft record. */
export const scaffoldToDesignerDraftRecord = (
  scaffold: ServerFunctionUiDraftRecord,
  actorId: string,
  now = new Date().toISOString(),
): DesignerDraftRecord => ({
  schema: 'component-designer-draft',
  id: scaffold.id,
  name: scaffold.name,
  folder: scaffold.folder,
  document: prepareDesignerDocumentForPersist(scaffold.document, {
    draftId: scaffold.id,
    draftName: scaffold.name,
  }),
  bindingDefinitions: scaffold.bindingDefinitions,
  metadata: {
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
    updatedBy: actorId,
  },
});

export const buildDesignerDraftRecordForServerFunction = (
  functionId: string,
  actorId: string,
  title?: string,
): DesignerDraftRecord => scaffoldToDesignerDraftRecord(
  buildServerFunctionUiDesignerDraft(functionId, title),
  actorId,
);
