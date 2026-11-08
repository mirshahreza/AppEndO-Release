import React, { useMemo } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import type { RJSFSchema } from '@rjsf/utils';
import {
  normalizeWorkItemPayloadRoot,
  parseWorkItemJsonPayload,
} from '../lib/workItemSchemaUtils';
import './DynamicWorkItemForm.css';

export type WorkItemPayloadReadViewProps = {
  /** Serialized JSON from `WorkItem.inputJson` or similar. */
  json: string;
  emptyLabel?: string;
  invalidLabel?: string;
  className?: string;
};

/**
 * Read-only, schema-inferred presentation of workflow payload JSON (task context / prior output).
 */
export const WorkItemPayloadReadView: React.FC<WorkItemPayloadReadViewProps> = ({
  json,
  emptyLabel = 'No fields to display.',
  invalidLabel = 'Could not read this data.',
  className,
}) => {
  const parsed = useMemo(() => parseWorkItemJsonPayload(json.trim()), [json]);

  const viewModel = useMemo((): { schema: RJSFSchema; formData: Record<string, unknown> } | null => {
    if (!parsed.ok) {
      return null;
    }
    const { schema, formData } = normalizeWorkItemPayloadRoot(parsed.value);
    if (schema.type === 'object' && schema.properties && Object.keys(schema.properties).length === 0) {
      return null;
    }
    return { schema, formData };
  }, [parsed]);

  if (!parsed.ok) {
    return <p className="text-sm text-rose-700">{invalidLabel}</p>;
  }

  if (!viewModel) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <div className={['dynamic-work-item-form dynamic-work-item-form--readonly rounded-lg border border-slate-200 bg-slate-50/50 p-3 sm:p-4', className].filter(Boolean).join(' ')}>
      <Form
        schema={viewModel.schema}
        formData={viewModel.formData}
        validator={validator}
        readonly
        disabled
      >
        <></>
      </Form>
    </div>
  );
};
