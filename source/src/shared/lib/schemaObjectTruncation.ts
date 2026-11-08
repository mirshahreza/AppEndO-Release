import { isControlPlaneSchemaObjectName } from './controlPlaneSchemaObjects';

const TRUNCATE_OBJECT_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export const assertTruncatableSchemaObjectName = (value: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized || !TRUNCATE_OBJECT_NAME_PATTERN.test(normalized)) {
    throw new Error('Invalid object name.');
  }
  if (isControlPlaneSchemaObjectName(normalized)) {
    throw new Error('Control-plane objects cannot be truncated.');
  }
  return normalized;
};

export type TruncateSchemaObjectRequest = {
  objectName: string;
};

const quotePg = (name: string) => `"${name}"`;

export const buildTruncateTableStatement = (
  sourceType: string,
  input: TruncateSchemaObjectRequest,
): string => {
  const name = assertTruncatableSchemaObjectName(input.objectName);
  const dialect = sourceType.trim();

  if (dialect === 'PostgreSQL') {
    return `TRUNCATE TABLE ${quotePg(name)} RESTART IDENTITY CASCADE`;
  }

  if (dialect === 'SQLite') {
    return `DELETE FROM ${name}`;
  }

  if (dialect === 'MySQL') {
    return `TRUNCATE TABLE ${name}`;
  }

  if (dialect === 'SQL Server') {
    return `TRUNCATE TABLE ${name}`;
  }

  throw new Error(`Truncating tables is not supported for ${dialect} yet.`);
};
