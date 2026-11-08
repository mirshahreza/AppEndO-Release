import React from 'react';
import Form, { type IChangeEvent } from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import './DynamicWorkItemForm.css';

export type DynamicWorkItemFormProps = {
  /** Already-unwrapped raw JSON Schema (the `.schema` half of the node's `JsonSchemaRefOrInline` `outputSchema`). */
  schema: RJSFSchema;
  /** Optional author-time layout/widget override layer (`WorkItemNodeDefinition.outputUiSchema`, HWF-1.1) — omit for a reasonable default render straight from `schema`. */
  uiSchema?: UiSchema;
  formData: unknown;
  onChange: (data: unknown) => void;
  disabled?: boolean;
};

/**
 * HWF-1.3 — schema-driven runtime form renderer for `formMode: 'DYNAMIC_SCHEMA_FORM'` Work Items.
 * No submit button of its own (`<></>` as children) — the Work Item Inbox's own Complete button
 * drives submission; this component only owns live value + client-side validation feedback. Reuses
 * the platform's already-pinned `ajv@8.20.0` (`@rjsf/validator-ajv8`) — the SAME schema interpretation
 * the server's `validateAgainstJsonSchema` gate (HWF-1.2) re-checks at completion time, not a second
 * independent parser.
 */
export const DynamicWorkItemForm: React.FC<DynamicWorkItemFormProps> = ({ schema, uiSchema, formData, onChange, disabled }) => (
  <div className="dynamic-work-item-form">
    <Form
      schema={schema}
      uiSchema={uiSchema}
      formData={formData}
      validator={validator}
      liveValidate
      disabled={disabled}
      onChange={(e: IChangeEvent) => onChange(e.formData)}
    >
      <></>
    </Form>
  </div>
);
