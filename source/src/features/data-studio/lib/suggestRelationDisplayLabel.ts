import type { EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import { humanizeColumnFieldName } from './resolveColumnDisplayName';
import type { RelationsDatasheetRow } from './relationsDatasheetRows';

type PeerModel = Pick<EdgeModelDefinition, 'id' | 'objectName' | 'labels'>;

const ASSOCIATION_AS_LABELS: Record<string, string> = {
  createdByUser: 'Created by',
  updatedByUser: 'Updated by',
  membershipStatusUpdatedByUser: 'Membership status updated by',
  invitedBy: 'Invited by',
  instituteStateUpdatedByUser: 'Affairs state updated by',
  author: 'Author',
  user: 'Platform user',
};

const FOREIGN_KEY_LABELS: Record<string, string> = {
  created_by: 'Created by',
  updated_by: 'Updated by',
  invited_by: 'Invited by',
  deleted_by: 'Deleted by',
  user_id: 'User',
  parent_id: 'Parent',
};

const CONSTRAINT_LABEL_OVERRIDES: Record<string, string> = {
  FK_hwy_nakhebin_member_id: 'Nakhebin rows',
  FK_hwy_username_repo_member_id: 'Username reservations',
  FK_hwy_members_nakhebin_id: 'Members (nakhebin link)',
};

const stripTablePrefix = (objectName: string): string => (
  objectName.replace(/^(base_|hwy_|cms_)/, '')
);

export const modelTitleForObjectName = (
  objectName: string,
  peerModels: ReadonlyArray<PeerModel>,
): string => {
  const model = peerModels.find((entry) => entry.objectName === objectName);
  const title = model?.labels?.title?.trim();
  if (title) {
    return title;
  }
  return humanizeColumnFieldName(stripTablePrefix(objectName));
};

const fkColumnRoleLabel = (column: string, targetTable: string): string => {
  const normalized = column.trim().toLowerCase();
  const direct = FOREIGN_KEY_LABELS[normalized];
  if (direct) {
    return direct;
  }
  if (normalized.endsWith('_user_id') && targetTable === 'base_users') {
    const stem = normalized.slice(0, -'_user_id'.length);
    if (!stem) {
      return 'User';
    }
    return humanizeColumnFieldName(stem);
  }
  if (normalized.endsWith('_id') && normalized !== 'id') {
    return humanizeColumnFieldName(normalized.slice(0, -3));
  }
  if (normalized.endsWith('_code')) {
    return humanizeColumnFieldName(normalized.slice(0, -5));
  }
  return humanizeColumnFieldName(normalized);
};

const belongsToDisplayLabel = (
  foreignKey: string,
  targetObjectName: string,
  associationAs: string,
  peerModels: ReadonlyArray<PeerModel>,
): string => {
  const asLabel = ASSOCIATION_AS_LABELS[associationAs];
  if (asLabel) {
    return asLabel;
  }
  const fkLabel = FOREIGN_KEY_LABELS[foreignKey.trim().toLowerCase()];
  if (fkLabel) {
    return fkLabel;
  }
  const targetTitle = modelTitleForObjectName(targetObjectName, peerModels);
  const role = fkColumnRoleLabel(foreignKey, targetObjectName);
  if (foreignKey.endsWith('_id') && foreignKey !== 'id' && role !== targetTitle) {
    return role;
  }
  if (associationAs.trim()) {
    return humanizeColumnFieldName(associationAs);
  }
  return targetTitle;
};

const inboundPhysicalLabel = (
  focusObjectName: string,
  fromTable: string,
  fromColumn: string,
  peerModels: ReadonlyArray<PeerModel>,
): string => {
  const childTitle = modelTitleForObjectName(fromTable, peerModels);
  const role = fkColumnRoleLabel(fromColumn, focusObjectName);
  const col = fromColumn.trim().toLowerCase();

  if (col === 'user_id' && focusObjectName === 'base_users') {
    return childTitle;
  }
  if (col === 'created_by' || col === 'updated_by' || col === 'invited_by') {
    return `${childTitle} (${role.toLowerCase()})`;
  }
  if (col.endsWith('_user_id') && focusObjectName === 'base_users') {
    return `${childTitle} (${role})`;
  }
  if (col.endsWith('_id') || col.endsWith('_code')) {
    return `${childTitle} (${role})`;
  }
  return `${childTitle} (${role})`;
};

const outboundPhysicalLabel = (
  fromColumn: string,
  toTable: string,
  peerModels: ReadonlyArray<PeerModel>,
): string => {
  const fk = fromColumn.trim().toLowerCase();
  const direct = FOREIGN_KEY_LABELS[fk];
  if (direct) {
    return direct;
  }
  if (fk.endsWith('_id') && fk !== 'id') {
    return fkColumnRoleLabel(fromColumn, toTable);
  }
  if (fk.endsWith('_code')) {
    return fkColumnRoleLabel(fromColumn, toTable);
  }
  const targetTitle = modelTitleForObjectName(toTable, peerModels);
  return `${fkColumnRoleLabel(fromColumn, toTable)} (${targetTitle})`;
};

const logicalOrBothLabel = (
  row: RelationsDatasheetRow & { nature: 'logical' | 'both' },
  peerModels: ReadonlyArray<PeerModel>,
): string => {
  const { association } = row;
  const target = peerModels.find((entry) => entry.id === association.targetModelId);
  const targetObjectName = target?.objectName ?? association.targetModelId;

  if (association.kind === 'hasMany' || association.kind === 'hasOne') {
    const asLabel = ASSOCIATION_AS_LABELS[association.as]
      ?? humanizeColumnFieldName(association.as);
    if (asLabel) {
      return asLabel;
    }
    return modelTitleForObjectName(targetObjectName, peerModels);
  }

  return belongsToDisplayLabel(
    association.foreignKey,
    targetObjectName,
    association.as,
    peerModels,
  );
};

export const suggestRelationDisplayLabel = (args: {
  focusObjectName: string;
  row: RelationsDatasheetRow;
  peerModels: ReadonlyArray<PeerModel>;
}): string => {
  const { row, focusObjectName, peerModels } = args;

  if (row.nature === 'logical' || row.nature === 'both') {
    return logicalOrBothLabel(row, peerModels);
  }

  const constraint = row.relation.constraintName?.trim();
  if (constraint && CONSTRAINT_LABEL_OVERRIDES[constraint]) {
    return CONSTRAINT_LABEL_OVERRIDES[constraint];
  }

  const { relation } = row;
  if (relation.fromTable === focusObjectName) {
    return outboundPhysicalLabel(relation.fromColumn, relation.toTable, peerModels);
  }
  return inboundPhysicalLabel(
    focusObjectName,
    relation.fromTable,
    relation.fromColumn,
    peerModels,
  );
};
