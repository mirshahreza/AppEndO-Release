import type { SchemaFunctionKind, SchemaObjectType } from '../api/queries/data-sources';
import { isControlPlaneSchemaObjectName } from './controlPlaneSchemaObjects';

const DROP_OBJECT_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export const assertDropSchemaObjectName = (value: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized || !DROP_OBJECT_NAME_PATTERN.test(normalized)) {
    throw new Error('Invalid object name.');
  }
  return normalized;
};

export const assertDeletableSchemaObjectName = (value: string): string => {
  const normalized = assertDropSchemaObjectName(value);
  if (isControlPlaneSchemaObjectName(normalized)) {
    throw new Error('Control-plane objects cannot be deleted.');
  }
  return normalized;
};

export type DropSchemaObjectRequest = {
  objectName: string;
  objectType: SchemaObjectType;
  functionKind?: SchemaFunctionKind;
};

const quotePg = (name: string) => `"${name}"`;

export const buildDropSchemaObjectStatement = (
  sourceType: string,
  input: DropSchemaObjectRequest,
): string => {
  const name = assertDeletableSchemaObjectName(input.objectName);
  const dialect = sourceType.trim();

  if (dialect === 'PostgreSQL') {
    switch (input.objectType) {
      case 'TABLE':
        return `DROP TABLE IF EXISTS ${quotePg(name)} CASCADE`;
      case 'VIEW':
        return `DROP VIEW IF EXISTS ${quotePg(name)} CASCADE`;
      case 'PROCEDURE':
        return `DROP PROCEDURE IF EXISTS ${quotePg(name)}() CASCADE`;
      case 'FUNCTION':
        return `DROP FUNCTION IF EXISTS ${quotePg(name)}() CASCADE`;
      default:
        throw new Error(`Unsupported object type: ${input.objectType}`);
    }
  }

  if (dialect === 'SQLite') {
    switch (input.objectType) {
      case 'TABLE':
        return `DROP TABLE IF EXISTS ${name}`;
      case 'VIEW':
        return `DROP VIEW IF EXISTS ${name}`;
      default:
        throw new Error('SQLite supports dropping tables and views only.');
    }
  }

  if (dialect === 'MySQL') {
    switch (input.objectType) {
      case 'TABLE':
        return `DROP TABLE IF EXISTS ${name}`;
      case 'VIEW':
        return `DROP VIEW IF EXISTS ${name}`;
      case 'PROCEDURE':
        return `DROP PROCEDURE IF EXISTS ${name}`;
      case 'FUNCTION':
        return `DROP FUNCTION IF EXISTS ${name}`;
      default:
        throw new Error(`Unsupported object type: ${input.objectType}`);
    }
  }

  if (dialect === 'SQL Server') {
    switch (input.objectType) {
      case 'TABLE':
        return `DROP TABLE IF EXISTS ${name}`;
      case 'VIEW':
        return `DROP VIEW IF EXISTS ${name}`;
      case 'PROCEDURE':
        return `DROP PROCEDURE IF EXISTS ${name}`;
      case 'FUNCTION':
        return `DROP FUNCTION IF EXISTS ${name}`;
      default:
        throw new Error(`Unsupported object type: ${input.objectType}`);
    }
  }

  throw new Error(`Dropping schema objects is not supported for ${dialect} yet.`);
};
