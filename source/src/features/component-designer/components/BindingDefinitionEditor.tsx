import React from 'react';
import { Trash2 } from 'lucide-react';
import { UiInput, UiSelect, DesignerCodeEditorField } from '../../../shared/ui';
import { AppButton } from '../../../shared/ui/AppButton';
import { ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_DELETE_CLASS } from '../../../shared/ui/surfaceClasses';
import { DesignerFieldRow } from './DesignerFieldRow';
import { InspectorAdvancedFieldGroup } from './InspectorAdvancedFieldGroup';
import { InspectorKeyValueListField } from './InspectorKeyValueListField';
import {
  formatBindingKeyLabel,
  INSPECTOR_BINDING_CARD_CLASS,
  resolveBindingBadge,
} from './inspectorBindingUi';
import { preventInspectorDetailsToggle } from './inspectorDetailsGuard';
import type { DesignerBindingDefinition } from '../../../domain/component-designer/types';

const SOURCE_TYPE_OPTIONS: Array<{ value: DesignerBindingDefinition['sourceType']; label: string }> = [
  { value: 'static', label: 'Static' },
  { value: 'expression', label: 'Page Data' },
  { value: 'formula', label: 'Formula' },
  { value: 'apiRef', label: 'API Ref' },
];

const HTTP_METHOD_OPTIONS: Array<NonNullable<NonNullable<DesignerBindingDefinition['requestConfig']>['method']>> = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
];

const STACK_FIELD = { layout: 'stack' as const };

const toJsonText = (value: unknown): string => {
  if (value === undefined) {
    return '';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
};

const parseJsonText = (value: string): unknown => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return JSON.parse(trimmed);
};

type BindingDefinitionEditorProps = {
  bindingKey: string;
  definition: DesignerBindingDefinition;
  onChange: (definition: DesignerBindingDefinition) => void;
  onRemove?: () => void;
  defaultExpanded?: boolean;
};

export const BindingDefinitionEditor: React.FC<BindingDefinitionEditorProps> = ({
  bindingKey,
  definition,
  onChange,
  onRemove,
  defaultExpanded = true,
}) => {
  const badge = resolveBindingBadge(definition, bindingKey);
  const [bodyText, setBodyText] = React.useState(() => toJsonText(definition.requestConfig?.body));
  const [retryStatusesText, setRetryStatusesText] = React.useState(() => (definition.retryPolicy?.retryOnStatuses ?? []).join(', '));
  const [jsonErrors, setJsonErrors] = React.useState<{ body?: string }>({});

  React.useEffect(() => {
    setBodyText(toJsonText(definition.requestConfig?.body));
  }, [definition.requestConfig?.body]);

  React.useEffect(() => {
    setRetryStatusesText((definition.retryPolicy?.retryOnStatuses ?? []).join(', '));
  }, [definition.retryPolicy?.retryOnStatuses]);

  React.useEffect(() => {
    setJsonErrors({});
  }, [bindingKey]);

  const updateRequestConfig = (patch: Partial<NonNullable<DesignerBindingDefinition['requestConfig']>>) => {
    onChange({
      ...definition,
      requestConfig: {
        ...definition.requestConfig,
        ...patch,
      },
    });
  };

  const updateRetryPolicy = (patch: Partial<NonNullable<DesignerBindingDefinition['retryPolicy']>>) => {
    onChange({
      ...definition,
      retryPolicy: {
        ...definition.retryPolicy,
        ...patch,
      },
    });
  };

  const primaryFields = (
    <>
      <DesignerFieldRow label="Source Type" {...STACK_FIELD}>
        <UiSelect
          size="sm"
          className="w-full"
          value={definition.sourceType}
          onChange={(event) => onChange({ ...definition, sourceType: event.target.value as DesignerBindingDefinition['sourceType'] })}
        >
          {SOURCE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </UiSelect>
      </DesignerFieldRow>

      <DesignerFieldRow label={definition.sourceType === 'formula' ? 'Formula' : 'Source Path'} {...STACK_FIELD}>
        {definition.sourceType === 'formula' ? (
          <DesignerCodeEditorField
            ariaLabel="Formula expression"
            language="javascript"
            editorHeight={120}
            lineNumbers={false}
            minimap={false}
            fontSize={12}
            placeholder="store.form.qty * store.form.price"
            value={definition.sourcePath ?? definition.dataPath ?? ''}
            onChange={(nextValue) => onChange({
              ...definition,
              sourceType: 'formula',
              sourcePath: nextValue,
              dataPath: nextValue,
              formulaExpression: nextValue,
            })}
          />
        ) : (
          <UiInput
            size="sm"
            autoDir={false}
            className="w-full"
            placeholder={definition.sourceType === 'expression' ? 'state.user.name' : 'data.user.email'}
            value={definition.sourcePath ?? ''}
            onChange={(event) => onChange({ ...definition, sourcePath: event.target.value })}
          />
        )}
      </DesignerFieldRow>

      <DesignerFieldRow label="Fallback Value" {...STACK_FIELD}>
        <UiInput
          size="sm"
          className="w-full"
          placeholder="Optional default"
          value={definition.fallbackValue === undefined ? '' : String(definition.fallbackValue)}
          onChange={(event) => onChange({ ...definition, fallbackValue: event.target.value })}
        />
      </DesignerFieldRow>

      {definition.sourceType === 'apiRef' ? (
        <>
          <DesignerFieldRow label="Endpoint Ref" {...STACK_FIELD}>
            <UiInput
              size="sm"
              autoDir={false}
              className="w-full"
              placeholder="/api/v1/resource"
              value={definition.endpointRef ?? ''}
              onChange={(event) => onChange({ ...definition, endpointRef: event.target.value })}
            />
          </DesignerFieldRow>

          <DesignerFieldRow label="Method" {...STACK_FIELD}>
            <UiSelect
              size="sm"
              className="w-full"
              value={definition.requestConfig?.method ?? 'GET'}
              onChange={(event) =>
                updateRequestConfig({
                  method: event.target.value as NonNullable<NonNullable<DesignerBindingDefinition['requestConfig']>['method']>,
                })
              }
            >
              {HTTP_METHOD_OPTIONS.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </UiSelect>
          </DesignerFieldRow>

          <DesignerFieldRow label="Timeout (ms)" {...STACK_FIELD}>
            <UiInput
              size="sm"
              className="w-full"
              type="number"
              placeholder="5000"
              value={definition.timeoutMs ?? ''}
              onChange={(event) => {
                const next = event.target.value.trim();
                onChange({ ...definition, timeoutMs: next ? Number(next) : undefined });
              }}
            />
          </DesignerFieldRow>
        </>
      ) : null}
    </>
  );

  const advancedApiFields = definition.sourceType === 'apiRef' ? (
    <>
      <DesignerFieldRow label="Headers" align="start" {...STACK_FIELD}>
        <InspectorKeyValueListField
          value={definition.requestConfig?.headers}
          onChange={(next) => updateRequestConfig({ headers: next })}
          keyPlaceholder="Authorization"
          valuePlaceholder="Bearer ..."
          addLabel="Add Header"
          fieldLabel="Header"
        />
      </DesignerFieldRow>

      <DesignerFieldRow label="Query" align="start" {...STACK_FIELD}>
        <InspectorKeyValueListField
          value={definition.requestConfig?.query}
          onChange={(next) => updateRequestConfig({ query: next })}
          keyPlaceholder="page"
          valuePlaceholder="1"
          addLabel="Add Query Param"
          fieldLabel="Query param"
        />
      </DesignerFieldRow>

      <DesignerFieldRow label="Body JSON" align="start" {...STACK_FIELD}>
        <DesignerCodeEditorField
          ariaLabel="Request body JSON"
          language="json"
          editorHeight={110}
          lineNumbers={false}
          minimap={false}
          fontSize={12}
          placeholder='{"name":"value"}'
          value={bodyText}
          isInvalid={Boolean(jsonErrors.body)}
          errorMessage={jsonErrors.body}
          onChange={(nextValue) => {
            setBodyText(nextValue);
            try {
              const parsed = parseJsonText(nextValue);
              setJsonErrors((previous) => ({ ...previous, body: undefined }));
              updateRequestConfig({ body: parsed });
            } catch (error) {
              setJsonErrors((previous) => ({
                ...previous,
                body: (error as Error).message || 'Invalid JSON for body.',
              }));
            }
          }}
        />
      </DesignerFieldRow>

      <DesignerFieldRow label="Response Mapping" {...STACK_FIELD}>
        <UiInput
          size="sm"
          autoDir={false}
          className="w-full"
          placeholder="data.items"
          value={definition.responseMapping ?? ''}
          onChange={(event) => onChange({ ...definition, responseMapping: event.target.value })}
        />
      </DesignerFieldRow>

      <DesignerFieldRow label="Error Mapping" {...STACK_FIELD}>
        <UiInput
          size="sm"
          autoDir={false}
          className="w-full"
          placeholder="error.message"
          value={definition.errorMapping ?? ''}
          onChange={(event) => onChange({ ...definition, errorMapping: event.target.value })}
        />
      </DesignerFieldRow>

      <DesignerFieldRow label="Max Attempts" {...STACK_FIELD}>
        <UiInput
          size="sm"
          className="w-full"
          type="number"
          placeholder="3"
          value={definition.retryPolicy?.maxAttempts ?? ''}
          onChange={(event) => {
            const next = event.target.value.trim();
            updateRetryPolicy({ maxAttempts: next ? Number(next) : undefined });
          }}
        />
      </DesignerFieldRow>

      <DesignerFieldRow label="Retry Delay (ms)" {...STACK_FIELD}>
        <UiInput
          size="sm"
          className="w-full"
          type="number"
          placeholder="1000"
          value={definition.retryPolicy?.retryDelayMs ?? ''}
          onChange={(event) => {
            const next = event.target.value.trim();
            updateRetryPolicy({ retryDelayMs: next ? Number(next) : undefined });
          }}
        />
      </DesignerFieldRow>

      <DesignerFieldRow label="Retry Statuses" {...STACK_FIELD}>
        <UiInput
          size="sm"
          autoDir={false}
          className="w-full"
          placeholder="408, 429, 500"
          value={retryStatusesText}
          onChange={(event) => {
            const next = event.target.value;
            setRetryStatusesText(next);
            const statuses = next
              .split(',')
              .map((item) => item.trim())
              .filter((item) => item.length > 0)
              .map((item) => Number(item))
              .filter((item) => Number.isFinite(item));
            updateRetryPolicy({ retryOnStatuses: statuses.length > 0 ? statuses : undefined });
          }}
        />
      </DesignerFieldRow>
    </>
  ) : null;

  return (
    <details className={INSPECTOR_BINDING_CARD_CLASS} open={defaultExpanded}>
      <summary className="flex cursor-pointer list-none items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-3 py-2">
        <span className={`inline-flex shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${badge.className}`}>
          {badge.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-700" title={bindingKey}>
          {formatBindingKeyLabel(bindingKey)}
        </span>
        {onRemove ? (
          <AppButton
            type="button"
            size="icon-sm"
            className={`${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_DELETE_CLASS} shrink-0`}
            aria-label={`Remove ${bindingKey}`}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRemove();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </AppButton>
        ) : null}
      </summary>

      <div className="space-y-2 p-3" {...preventInspectorDetailsToggle}>
        {definition.sourceType === 'apiRef' ? (
          <InspectorAdvancedFieldGroup
            defaultShowAdvanced={Boolean(
              definition.requestConfig?.headers
              || definition.requestConfig?.query
              || definition.requestConfig?.body
              || definition.responseMapping
              || definition.errorMapping
              || definition.retryPolicy?.maxAttempts,
            )}
            primary={primaryFields}
            advanced={advancedApiFields ?? null}
          />
        ) : (
          primaryFields
        )}
      </div>
    </details>
  );
};
