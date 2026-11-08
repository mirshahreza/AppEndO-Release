import {
  createWhereCondition,
  createWhereGroup,
  type WhereGroupNode,
} from '../ui/where-builder/whereBuilderModel';

/** Single equality preset root (AND group with one condition). */
export const queryPresetWhereEq = (field: string, value: string, id?: string): WhereGroupNode => (
  createWhereGroup('and', [
    createWhereCondition(field, 'eq', value, id ?? `preset-${field}`),
  ], id ?? `preset-root-${field}`)
);

export const queryPresetWhereIsTrue = (field: string): WhereGroupNode => (
  queryPresetWhereEq(field, 'true', `preset-${field}-true`)
);

export const queryPresetWhereIsFalse = (field: string): WhereGroupNode => (
  queryPresetWhereEq(field, 'false', `preset-${field}-false`)
);
