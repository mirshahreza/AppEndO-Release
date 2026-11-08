import { isAllowedRecordPolicyContextRef } from '../../../shared/api/contracts/record-policy';
import {
  inferWhereContextValueShape,
  type WhereContextItem,
} from '../../../shared/ui/where-builder/whereBuilderModel';

export const buildRecordPolicyContextItems = (
  contextKeys: readonly string[],
  dimensionKeys: readonly string[],
): WhereContextItem[] => {
  const scopeOptions = dimensionKeys.length > 0
    ? dimensionKeys.map((key) => `scope.${key}`)
    : ['scope.org', 'scope.geo'];
  const keys = [...new Set([
    ...(contextKeys.length > 0 ? contextKeys : ['user.id', 'sys.roles']),
    ...scopeOptions,
  ])]
    .filter((key) => isAllowedRecordPolicyContextRef(key))
    .sort((left, right) => left.localeCompare(right));

  return keys.map((id) => ({
    id,
    label: id,
    valueShape: inferWhereContextValueShape(id),
  }));
};
