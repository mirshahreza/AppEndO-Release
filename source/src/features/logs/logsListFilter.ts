import { LOG_LEVELS } from '../../shared/api/contracts/logs/constants';
import type { LogLevel } from '../../shared/api/contracts/logs/types';
import {
  DEFAULT_WHERE_OPERATORS,
  sanitizeListWhereTree,
  type WhereField,
  type WhereGroupNode,
} from '../../shared/ui';
import { createEmptyWhereTree } from '../../shared/ui/where-builder/whereBuilderModel';

export const LOGS_WHERE_OPERATORS = DEFAULT_WHERE_OPERATORS;

export function createLogsWhereFields(
  visibleLevels: Record<LogLevel, boolean>,
): WhereField[] {
  const levels = LOG_LEVELS
    .filter((level) => visibleLevels[level])
    .map((level) => ({ id: level, label: level }));
  return [
    { id: 'level', label: 'Level', type: 'text', options: levels },
    { id: 'actor', label: 'Actor', type: 'text' },
    { id: 'context', label: 'Context', type: 'text' },
    { id: 'folder', label: 'Folder', type: 'text' },
    { id: 'functionName', label: 'Function', type: 'text' },
    { id: 'key', label: 'Key', type: 'text' },
    { id: 'timestamp', label: 'Time', type: 'date' },
    { id: 'durationMs', label: 'Duration (ms)', type: 'number' },
    { id: 'callSuccess', label: 'Success', type: 'boolean' },
    { id: 'requestId', label: 'Request id', type: 'text' },
  ];
}

export function sanitizeLogsWhereTree(
  raw: unknown,
  fields: readonly WhereField[],
): WhereGroupNode {
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw) && (raw as { kind?: string }).kind === 'group') {
    return sanitizeListWhereTree(raw, fields, LOGS_WHERE_OPERATORS);
  }
  return createEmptyWhereTree();
}
