import React, { createContext, useContext, useMemo } from 'react';
import type { TranslationFn } from '../../../core/culture/TranslationRuntime';
import { useOptionalCultureT } from '../../../core/culture/CultureContext';
import type { WhereOperator } from './whereBuilderModel';

export type WhereBuilderLabels = {
  emptyApplyHint: string;
  emptyGroup: string;
  combinatorAnd: string;
  combinatorOr: string;
  combinatorAria: string;
  addCondition: string;
  addConditionOrGroup: string;
  addMenuAria: string;
  menuCondition: string;
  menuGroup: string;
  field: string;
  operator: string;
  value: string;
  endValue: string;
  valuePlaceholder: string;
  valuePlaceholderList: string;
  manual: string;
  manualExpression: string;
  manualPlaceholder: string;
  switchManual: string;
  removeCondition: string;
  removeGroup: string;
  dragToMove: string;
  serverContext: string;
  serverContextEmpty: string;
  whereClauseAria: string;
  booleanTrue: string;
  booleanFalse: string;
};

const OPERATOR_LABEL_KEY: Record<string, string> = {
  eq: 'whereBuilder.operator.eq',
  neq: 'whereBuilder.operator.neq',
  in: 'whereBuilder.operator.in',
  notIn: 'whereBuilder.operator.notIn',
  gt: 'whereBuilder.operator.gt',
  gte: 'whereBuilder.operator.gte',
  lt: 'whereBuilder.operator.lt',
  lte: 'whereBuilder.operator.lte',
  between: 'whereBuilder.operator.between',
  isNull: 'whereBuilder.operator.isNull',
  isNotNull: 'whereBuilder.operator.isNotNull',
  startsWith: 'whereBuilder.operator.startsWith',
  contains: 'whereBuilder.operator.contains',
};

export function resolveWhereBuilderLabels(t: TranslationFn): WhereBuilderLabels {
  return {
    emptyApplyHint: t('whereBuilder.emptyApplyHint'),
    emptyGroup: t('whereBuilder.emptyGroup'),
    combinatorAnd: t('whereBuilder.combinator.and'),
    combinatorOr: t('whereBuilder.combinator.or'),
    combinatorAria: t('whereBuilder.combinator.aria'),
    addCondition: t('whereBuilder.add.condition'),
    addConditionOrGroup: t('whereBuilder.add.conditionOrGroup'),
    addMenuAria: t('whereBuilder.add.menuAria'),
    menuCondition: t('whereBuilder.add.menuCondition'),
    menuGroup: t('whereBuilder.add.menuGroup'),
    field: t('whereBuilder.field'),
    operator: t('whereBuilder.operator.label'),
    value: t('grid.filter.value'),
    endValue: t('whereBuilder.endValue'),
    valuePlaceholder: t('whereBuilder.valuePlaceholder'),
    valuePlaceholderList: t('whereBuilder.valuePlaceholderList'),
    manual: t('whereBuilder.manual'),
    manualExpression: t('whereBuilder.manualExpression'),
    manualPlaceholder: t('whereBuilder.manualPlaceholder'),
    switchManual: t('whereBuilder.switchManual'),
    removeCondition: t('whereBuilder.removeCondition'),
    removeGroup: t('whereBuilder.removeGroup'),
    dragToMove: t('whereBuilder.dragToMove'),
    serverContext: t('whereBuilder.serverContext'),
    serverContextEmpty: t('whereBuilder.serverContextEmpty'),
    whereClauseAria: t('whereBuilder.whereClauseAria'),
    booleanTrue: t('grid.filter.true'),
    booleanFalse: t('grid.filter.false'),
  };
}

export function localizeWhereOperators(
  operators: readonly WhereOperator[],
  t: TranslationFn,
): readonly WhereOperator[] {
  return operators.map((operator) => {
    const key = OPERATOR_LABEL_KEY[operator.id];
    if (!key) {
      return operator;
    }
    const label = t(key);
    return label && label !== key ? { ...operator, label } : operator;
  });
}

const WhereBuilderLabelsContext = createContext<WhereBuilderLabels | null>(null);

export const WhereBuilderLabelsProvider: React.FC<{
  labels: WhereBuilderLabels;
  children: React.ReactNode;
}> = ({ labels, children }) => (
  <WhereBuilderLabelsContext.Provider value={labels}>
    {children}
  </WhereBuilderLabelsContext.Provider>
);

export function useWhereBuilderLabels(): WhereBuilderLabels {
  const fromContext = useContext(WhereBuilderLabelsContext);
  const t = useOptionalCultureT();
  const fallback = useMemo(() => resolveWhereBuilderLabels(t), [t]);
  return fromContext ?? fallback;
}
