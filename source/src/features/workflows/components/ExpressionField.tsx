import React, { useEffect, useState } from 'react';
import { ReferencePickerInput } from './ReferencePickerInput';
import { describeExpression, descriptorToExpression, parseLiteralInput } from './expressionUtils';
import type { CanonicalExpression, ReferenceDescriptor } from '../types';

/**
 * One expression-shaped field: type a literal value directly, or type `@` to open the doc 08
 * section 7 reference picker and insert a stable canonical reference. Compiles to a real
 * `CanonicalExpression` on every keystroke/selection — this is what lets ACTION/END/FAIL/SWITCH's
 * bespoke forms round-trip through the exact same `applyDraftOperations` validation the raw-JSON
 * editor already used, without the author ever hand-writing AST JSON for these common cases.
 */
export const ExpressionField: React.FC<{
  label: string;
  definitionId: number;
  value: CanonicalExpression | undefined;
  onChange: (expression: CanonicalExpression) => void;
  context: { consumerNodeKey: string | null; isWaitEventContext: boolean; isWorkItemOutputContext: boolean; isOutputAssignmentContext: boolean; isForEachItemContext: boolean };
  placeholder?: string;
  /** See `ReferencePickerInput`'s prop of the same name — threaded through unchanged. */
  getOutputFieldNames?: (nodeKey: string) => string[];
  getOutputFieldPaths?: (nodeKey: string) => string[][];
}> = ({ label, definitionId, value, onChange, context, placeholder, getOutputFieldNames, getOutputFieldPaths }) => {
  const [text, setText] = useState(() => describeExpression(value).text);

  useEffect(() => {
    setText(describeExpression(value).text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value)]);

  const handleChange = (nextText: string) => {
    setText(nextText);
    onChange(parseLiteralInput(nextText));
  };

  const handleSelectDescriptor = (descriptor: ReferenceDescriptor, segments?: Array<string | number>) => {
    onChange(descriptorToExpression(descriptor, segments));
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-slate-700">{label}</label>
      <ReferencePickerInput
        definitionId={definitionId}
        value={text}
        onChange={handleChange}
        onSelectDescriptor={handleSelectDescriptor}
        context={context}
        getOutputFieldNames={getOutputFieldNames}
        getOutputFieldPaths={getOutputFieldPaths}
      />
      {placeholder ? <p className="text-[10px] text-slate-400">{placeholder}</p> : null}
    </div>
  );
};
