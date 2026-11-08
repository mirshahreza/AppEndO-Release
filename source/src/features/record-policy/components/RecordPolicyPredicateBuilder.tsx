import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RecordPolicyPredicateNode } from '../../../shared/api/contracts/record-policy';
import { MAX_PREDICATE_AST_DEPTH } from '../../../shared/api/contracts/record-policy/constants';
import {
  UiWhereBuilder,
  WHERE_BUILDER_RECORD_POLICY_CHROME,
  type WhereField,
  type WhereGroupNode,
} from '../../../shared/ui';
import { buildRecordPolicyContextItems } from '../lib/recordPolicyContextItems';
import {
  predicateToWhereGroup,
  whereGroupToPredicate,
} from '../lib/recordPolicyWhereAdapter';
import { RECORD_POLICY_WHERE_OPERATORS } from '../lib/recordPolicyWhereOperators';

export type RecordPolicyPredicateBuilderProps = {
  predicate: RecordPolicyPredicateNode;
  fields: readonly string[];
  dimensionKeys: readonly string[];
  contextKeys: readonly string[];
  isDisabled?: boolean;
  onChange: (predicate: RecordPolicyPredicateNode) => void;
};

const mapFields = (fields: readonly string[]): WhereField[] => (
  fields.map((field) => ({ id: field, label: field, type: 'text' as const }))
);

const serializePredicate = (predicate: RecordPolicyPredicateNode): string => (
  JSON.stringify(predicate)
);

/** Record-policy adapter around the canonical Base Components `UiWhereBuilder`. */
export const RecordPolicyPredicateBuilder: React.FC<RecordPolicyPredicateBuilderProps> = ({
  predicate,
  fields,
  dimensionKeys,
  contextKeys,
  isDisabled,
  onChange,
}) => {
  const whereFields = useMemo(() => mapFields(fields), [fields]);
  const contextItems = useMemo(
    () => buildRecordPolicyContextItems(contextKeys, dimensionKeys),
    [contextKeys, dimensionKeys],
  );
  const [value, setValue] = useState<WhereGroupNode>(() => predicateToWhereGroup(predicate));
  const lastEmittedPredicateRef = useRef(serializePredicate(predicate));
  const predicateKey = serializePredicate(predicate);

  useEffect(() => {
    if (predicateKey === lastEmittedPredicateRef.current) {
      return;
    }
    lastEmittedPredicateRef.current = predicateKey;
    setValue(predicateToWhereGroup(predicate));
  }, [predicate, predicateKey]);

  return (
    <UiWhereBuilder
      {...WHERE_BUILDER_RECORD_POLICY_CHROME}
      className="min-w-0"
      value={value}
      fields={whereFields}
      operators={RECORD_POLICY_WHERE_OPERATORS}
      contextItems={contextItems}
      maxDepth={MAX_PREDICATE_AST_DEPTH}
      isDisabled={isDisabled}
      ariaLabel="Record policy predicate"
      onChange={(next) => {
        setValue(next);
        const converted = whereGroupToPredicate(next);
        if (!converted) {
          return;
        }
        lastEmittedPredicateRef.current = serializePredicate(converted);
        onChange(converted);
      }}
    />
  );
};
