import crypto from 'crypto';
import type { EdgeModelColumn } from '../../../shared/api/contracts/data-api';

type FingerprintInput = {
  dataSourceId: string;
  schema: string | null;
  objectName: string;
  columns: Pick<EdgeModelColumn, 'name' | 'dataType' | 'isPrimaryKey' | 'allowNull'>[];
  primaryKey: string | string[];
};

export const computeSchemaFingerprint = (input: FingerprintInput): string => {
  const payload = {
    dataSourceId: input.dataSourceId,
    schema: input.schema,
    objectName: input.objectName,
    primaryKey: input.primaryKey,
    columns: input.columns
      .map((column) => ({
        name: column.name,
        dataType: column.dataType,
        isPrimaryKey: column.isPrimaryKey,
        allowNull: column.allowNull,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 16);
};
