/** Stable identifiers for per-user grid column layout persistence. */
export const APP_GRID_IDS = {
  users: 'users',
  roles: 'roles',
  plugins: 'plugins',
  dataSources: 'data-sources',
  dataSourceEnrichmentQuestions: 'data-sources.enrichment-questions',
  logs: 'logs',
  recordEvents: 'record-events',
  recordEventHistory: 'record-event-history',
  cache: 'cache',
  settingsAttributes: 'settings-attributes',
  platformNavigations: 'platform-navigations',
} as const;

export type AppGridId = typeof APP_GRID_IDS[keyof typeof APP_GRID_IDS];
