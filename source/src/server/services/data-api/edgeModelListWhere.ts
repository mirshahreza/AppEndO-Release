import type {
  EdgeModelDefinition,
  EdgeModelStudioColumnMeta,
  QuerySurfaceBindingDocument,
} from '../../../shared/api/contracts/data-api';
import type { ListWhereColumnMap } from '../../../shared/ui/list-filter/listWhereQuery';
import {
  resolveEffectiveFilterRole,
  columnParticipatesInListWhere,
} from '../../domain/data-api/querySurfaceDefaultHeuristics';
import { grantAllowsPrincipal, type QuerySurfacePrincipal } from '../../domain/data-api/querySurfaceGrants';

const DATE_TYPE_PATTERN = /DATE|TIME|TIMESTAMP/i;

const columnSqlTypeKind = (sqlType: string): ListWhereColumnMap[string]['type'] => {
  if (DATE_TYPE_PATTERN.test(sqlType)) {
    return 'date';
  }
  if (/INT|DECIMAL|NUMERIC|FLOAT|REAL|DOUBLE/i.test(sqlType)) {
    return 'number';
  }
  if (/BOOL|BIT/i.test(sqlType)) {
    return 'boolean';
  }
  return 'string';
};

export const edgeModelListWhereColumns = (model: EdgeModelDefinition): ListWhereColumnMap => {
  const map: ListWhereColumnMap = {};
  for (const column of model.columns) {
    const sqlType = column.sqlType ?? column.type ?? '';
    const type = columnSqlTypeKind(String(sqlType));
    map[column.field] = {
      path: column.field,
      type,
      preferContains: type === 'string',
    };
  }
  return map;
};

export const edgeModelListWhereColumnsFromRoles = (
  model: EdgeModelDefinition,
  columnMeta: readonly EdgeModelStudioColumnMeta[],
  binding: QuerySurfaceBindingDocument,
  principal: QuerySurfacePrincipal,
  allowedFields: Set<string>,
): ListWhereColumnMap => {
  const map: ListWhereColumnMap = {};
  for (const column of model.columns) {
    const field = column.field;
    if (!allowedFields.has(field) && !allowedFields.has(column.name)) {
      continue;
    }
    const role = resolveEffectiveFilterRole(column, columnMeta);
    if (!columnParticipatesInListWhere(role)) {
      continue;
    }
    if (role === 'restricted') {
      const grant = binding.columnWhereGrants[field] ?? binding.columnWhereGrants[column.name];
      if (!grantAllowsPrincipal(grant, principal)) {
        continue;
      }
    }
    const sqlType = column.sqlType ?? column.type ?? '';
    const type = columnSqlTypeKind(String(sqlType));
    map[field] = {
      path: field,
      type,
      preferContains: type === 'string',
    };
  }
  return map;
};
