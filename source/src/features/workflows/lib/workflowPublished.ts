export type WorkflowPublishedInput = {
  currentPublishedRevisionId?: number | null;
  currentPublishedRevision?: { id: number } | null;
  publicationStatus?: { isPublished?: boolean } | null;
  definition?: { isPublished?: boolean; currentPublishedRevisionId?: number | null } | null;
};

/** Published state is derived from list summaries (`currentPublishedRevisionId`), designer
 * projections (`publicationStatus.isPublished` / `currentPublishedRevision`), and dossiers
 * (`definition.isPublished`). All shapes must stay aligned — the list and editor switch share this helper. */
export const isWorkflowPublished = (input: WorkflowPublishedInput): boolean =>
  input.publicationStatus?.isPublished === true
  || input.definition?.isPublished === true
  || input.definition?.currentPublishedRevisionId != null
  || input.currentPublishedRevisionId != null
  || input.currentPublishedRevision != null;
