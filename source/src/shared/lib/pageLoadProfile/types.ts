export type PageLoadProfileDbQuery = {
  ms: number;
  sql: string;
  source: string;
  rowCount: number | null;
};

export type PageLoadProfileServerApplicationSection = {
  totalMs: number;
};

export type PageLoadProfileServerDatabaseSection = {
  totalMs: number;
  queryCount: number;
  queries: PageLoadProfileDbQuery[];
};

export type PageLoadProfileServerPerf = {
  totalMs: number;
  dbMs: number;
  dbQueries: number;
  queries: PageLoadProfileDbQuery[];
  applicationMs: number;
  sections: {
    database: PageLoadProfileServerDatabaseSection;
    application: PageLoadProfileServerApplicationSection;
  };
};

export type PageLoadProfileApiCall = {
  path: string;
  durationMs: number;
  requestId: string | null;
  server: PageLoadProfileServerPerf | null;
  startedAtMs: number;
  finishedAtMs: number;
};

export type PageLoadProfileSnapshot = {
  pathname: string;
  pageKey: string | null;
  startedAtMs: number;
  navigationPendingAtMs: number | null;
  pathnameCommittedAtMs: number | null;
  firstApiAtMs: number | null;
  lastApiAtMs: number | null;
  shellReadyAtMs: number | null;
  revealedAtMs: number | null;
  apiCalls: PageLoadProfileApiCall[];
};

export type PageLoadProfilePhaseRow = {
  id: string;
  label: string;
  durationMs: number | null;
  detail?: string;
};
