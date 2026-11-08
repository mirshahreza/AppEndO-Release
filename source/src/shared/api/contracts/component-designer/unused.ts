/** Registry-unused drafts; `lastHitAt` is runtime (published mount), not registry linkage. */
export type UnusedDesignerComponentEntry = {
  draftId: string;
  name: string;
  lastHitAt: string | null;
};

export type UnusedDesignerComponentsReport = {
  components: UnusedDesignerComponentEntry[];
};
