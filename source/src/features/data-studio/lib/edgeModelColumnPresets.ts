import type { EdgeModelColumn } from '../../../shared/api/contracts/data-api';
import type { NativeDatabaseDialect } from './nativeDatabaseTypes';
import { createEdgeModelColumnFromNativeType } from './edgeModelColumnUtils';

export type EdgeModelColumnPresetSpec = {
  name: string;
  dataType: string;
  nullable?: boolean;
};

type DialectNativeTypes = {
  binary: string;
  integer: string;
  text: string;
  bigint: string;
  timestamp: string;
};

const DIALECT_NATIVE_TYPES: Record<NativeDatabaseDialect, DialectNativeTypes> = {
  postgres: {
    binary: 'bytea',
    integer: 'integer',
    text: 'text',
    bigint: 'bigint',
    timestamp: 'timestamp with time zone',
  },
  mysql: {
    binary: 'longblob',
    integer: 'integer',
    text: 'varchar',
    bigint: 'bigint',
    timestamp: 'timestamp',
  },
  sqlite: {
    binary: 'blob',
    integer: 'integer',
    text: 'text',
    bigint: 'integer',
    timestamp: 'text',
  },
  mssql: {
    binary: 'varbinary',
    integer: 'int',
    text: 'nvarchar',
    bigint: 'bigint',
    timestamp: 'datetimeoffset',
  },
  oracle: {
    binary: 'blob',
    integer: 'number',
    text: 'nvarchar2',
    bigint: 'number',
    timestamp: 'timestamp with time zone',
  },
};

const FALLBACK_NATIVE_TYPES: DialectNativeTypes = DIALECT_NATIVE_TYPES.postgres;

const resolveDialectTypes = (dialect: NativeDatabaseDialect | null): DialectNativeTypes => (
  dialect ? DIALECT_NATIVE_TYPES[dialect] : FALLBACK_NATIVE_TYPES
);

export const RECORD_AUDIT_COLUMN_NAMES = [
  'created_by',
  'created_at',
  'updated_by',
  'updated_at',
] as const;

export const buildImageColumnPresetSpecs = (
  baseName: string,
  dialect: NativeDatabaseDialect | null,
): EdgeModelColumnPresetSpec[] => {
  const types = resolveDialectTypes(dialect);
  const name = baseName.trim();

  return [
    { name, dataType: types.binary },
    { name: `${name}_xs`, dataType: types.binary },
    { name: `${name}_size`, dataType: types.integer },
    { name: `${name}_name`, dataType: types.text },
  ];
};

export const buildFileColumnPresetSpecs = (
  baseName: string,
  dialect: NativeDatabaseDialect | null,
): EdgeModelColumnPresetSpec[] => {
  const types = resolveDialectTypes(dialect);
  const name = baseName.trim();

  return [
    { name, dataType: types.binary },
    { name: `${name}_size`, dataType: types.integer },
    { name: `${name}_name`, dataType: types.text },
  ];
};

export const buildRecordAuditColumnPresetSpecs = (
  dialect: NativeDatabaseDialect | null,
): EdgeModelColumnPresetSpec[] => {
  const types = resolveDialectTypes(dialect);

  return [
    { name: 'created_by', dataType: types.bigint },
    { name: 'created_at', dataType: types.timestamp },
    { name: 'updated_by', dataType: types.bigint },
    { name: 'updated_at', dataType: types.timestamp },
  ];
};

export const buildSetAuditColumnPresetSpecs = (
  setName: string,
  dialect: NativeDatabaseDialect | null,
): EdgeModelColumnPresetSpec[] => {
  const types = resolveDialectTypes(dialect);
  const name = setName.trim();

  return [
    { name: `${name}_updated_by`, dataType: types.bigint },
    { name: `${name}_updated_at`, dataType: types.timestamp },
  ];
};

export const createEdgeModelColumnsFromPresetSpecs = (
  specs: ReadonlyArray<EdgeModelColumnPresetSpec>,
  existingColumns: ReadonlyArray<Pick<EdgeModelColumn, 'name'>>,
): EdgeModelColumn[] => {
  const existing = new Set(existingColumns.map((column) => column.name));
  const created: EdgeModelColumn[] = [];

  for (const spec of specs) {
    if (!spec.name || existing.has(spec.name)) {
      continue;
    }

    existing.add(spec.name);
    created.push(createEdgeModelColumnFromNativeType(spec.name, spec.dataType, {
      nullable: spec.nullable ?? true,
    }));
  }

  return created;
};
