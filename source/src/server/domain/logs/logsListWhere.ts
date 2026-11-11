import type { ListWhereColumnMap } from '../../../shared/ui/list-filter/listWhereQuery';

export const LOGS_LIST_WHERE_COLUMNS: ListWhereColumnMap = {
  level: { path: 'level', type: 'enum' },
  actor: { path: 'actor', type: 'string' },
  context: { path: 'context', type: 'string' },
  folder: {
    path: 'message',
    type: 'string',
    transformValue: (value) => `/${value.replace(/^\/+|\/+$/g, '')}/`,
  },
  functionName: { path: 'message', type: 'string' },
  key: { path: 'message', type: 'string' },
  timestamp: { path: 'createdAt', type: 'date' },
  durationMs: { path: 'durationMs', type: 'number' },
  callSuccess: { path: 'callSuccess', type: 'boolean', booleanAsInt: true },
  requestId: {
    path: 'metaJson',
    type: 'string',
    preferContains: true,
    transformValue: (value) => `"requestId":"${value.replace(/"/g, '')}"`,
  },
};
