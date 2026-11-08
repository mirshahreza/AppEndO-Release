import { sanitizeListWhereTree } from '../../../ui/list-filter/listWhereFilter';
import type { ListWhereColumnMap } from '../../../ui/list-filter/listWhereQuery';
import {
  createEmptyWhereTree,
  DEFAULT_WHERE_OPERATORS,
  type WhereField,
  type WhereGroupNode,
} from '../../../ui/where-builder/whereBuilderModel';

export const USERS_WHERE_OPERATORS = DEFAULT_WHERE_OPERATORS;

export const USERS_LIST_WHERE_COLUMNS: ListWhereColumnMap = {
  email: { path: 'email', type: 'string', preferContains: true },
  username: { path: 'username', type: 'string', preferContains: true },
  locked: { path: 'locked', type: 'boolean', booleanAsInt: true },
  created_at: { path: 'createdAt', type: 'date' },
  updated_at: { path: 'updatedAt', type: 'date' },
};

export function createUsersWhereFields(): WhereField[] {
  return [
    { id: 'email', label: 'Email', type: 'text' },
    { id: 'username', label: 'Username', type: 'text' },
    { id: 'locked', label: 'Locked', type: 'boolean' },
    { id: 'created_at', label: 'Created', type: 'date' },
    { id: 'updated_at', label: 'Updated', type: 'date' },
  ];
}

export function sanitizeUsersWhereTree(
  raw: unknown,
  fields: readonly WhereField[] = createUsersWhereFields(),
): WhereGroupNode {
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw) && (raw as { kind?: string }).kind === 'group') {
    return sanitizeListWhereTree(raw, fields, USERS_WHERE_OPERATORS);
  }
  return createEmptyWhereTree();
}
