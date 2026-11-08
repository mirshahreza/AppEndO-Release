import type {
  ColumnFilterRole,
  ColumnSearchRole,
  EdgeModelColumn,
  EdgeModelStudioColumnMeta,
} from '../../../shared/api/contracts/data-api';
import {
  DEFAULT_COLUMN_FILTER_ROLE,
  DEFAULT_COLUMN_SEARCH_ROLE,
} from '../../../shared/api/contracts/data-api';

const TEXT_COLUMN_TYPE_PATTERN = /STRING|TEXT|CHAR|NCHAR|NVARCHAR/i;
const SENSITIVE_NAME = /password|passwd|hash|secret|token|salt|otp/i;
const HEAVY_BODY = /^(body|html_content|payload|snapshot|metadata|json|config_json|raw_json)$/i;
const BINARY_NAME = /binary|blob|image_bytes|file_bytes|thumbnail_bytes/i;

const metaByColumn = (
  columnMeta: readonly EdgeModelStudioColumnMeta[],
): Map<string, EdgeModelStudioColumnMeta> => (
  new Map(columnMeta.map((item) => [item.columnName, item]))
);

export const inferColumnSearchRole = (
  column: Pick<EdgeModelColumn, 'name' | 'field' | 'sequelizeType' | 'type' | 'sqlType'>,
  explicit?: ColumnSearchRole,
): ColumnSearchRole => {
  if (explicit) {
    return explicit;
  }
  const field = column.field || column.name;
  const sqlType = String(column.sequelizeType ?? column.sqlType ?? column.type ?? '');
  if (SENSITIVE_NAME.test(field) || BINARY_NAME.test(field)) {
    return 'none';
  }
  if (HEAVY_BODY.test(field)) {
    return 'advanced';
  }
  if (!TEXT_COLUMN_TYPE_PATTERN.test(sqlType)) {
    if (/DATE|TIME|TIMESTAMP/i.test(sqlType)) {
      return 'advanced';
    }
    if (/BOOL|BIT/i.test(sqlType)) {
      return 'none';
    }
    if (/INT|DECIMAL|NUMERIC|FLOAT|REAL|DOUBLE/i.test(sqlType)) {
      return field === 'id' || field.endsWith('_id') ? 'none' : 'advanced';
    }
    return 'none';
  }
  if (field === 'id' || field.endsWith('_id')) {
    return 'none';
  }
  if (
    /^(title|name|slug|code|username|email|phone|first_name|father_name|family_name|nickname|national_id)$/i.test(field)
    || field.endsWith('_code')
  ) {
    return 'basic';
  }
  if (/^(created_at|updated_at|published_at|moderated_at)$/i.test(field)) {
    return 'advanced';
  }
  if (/^(note|summary|description|operator_note|developer_notes)$/i.test(field)) {
    return 'advanced';
  }
  return 'none';
};

export const inferColumnFilterRole = (
  column: Pick<EdgeModelColumn, 'name' | 'field'>,
  explicit?: ColumnFilterRole,
): ColumnFilterRole => {
  if (explicit) {
    return explicit;
  }
  const field = column.field || column.name;
  if (SENSITIVE_NAME.test(field) || BINARY_NAME.test(field) || HEAVY_BODY.test(field)) {
    return 'none';
  }
  if (/^(password_hash|refresh_token|session_token)$/i.test(field)) {
    return 'none';
  }
  if (/national_id|phone1|phone2|author_email/i.test(field)) {
    return 'restricted';
  }
  return DEFAULT_COLUMN_FILTER_ROLE;
};

export const resolveEffectiveSearchRole = (
  column: EdgeModelColumn,
  columnMeta: readonly EdgeModelStudioColumnMeta[],
): ColumnSearchRole => {
  const meta = metaByColumn(columnMeta).get(column.name);
  return inferColumnSearchRole(column, meta?.searchRole);
};

export const resolveEffectiveFilterRole = (
  column: EdgeModelColumn,
  columnMeta: readonly EdgeModelStudioColumnMeta[],
): ColumnFilterRole => {
  const meta = metaByColumn(columnMeta).get(column.name);
  return inferColumnFilterRole(column, meta?.filterRole);
};

export const columnParticipatesInQuickSearch = (role: ColumnSearchRole): boolean => (
  role === 'basic'
);

export const columnParticipatesInListWhere = (role: ColumnFilterRole): boolean => (
  role === 'public' || role === 'restricted'
);

export { DEFAULT_COLUMN_SEARCH_ROLE, DEFAULT_COLUMN_FILTER_ROLE };
