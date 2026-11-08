import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { collectTemplateParamNames } from '../../../domain/component-designer/bindingApiHelpers';
import { AppButton } from '../../../shared/ui/AppButton';
import { UiInput } from '../../../shared/ui';
import { ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_DELETE_CLASS } from '../../../shared/ui/surfaceClasses';
import { preventInspectorDetailsToggle } from './inspectorDetailsGuard';
import {
  INSPECTOR_TEXT_XS,
} from './inspectorDesignTokens';

type KeyValueEntry = {
  id: string;
  key: string;
  value: string;
};

const createEntry = (key = '', value = ''): KeyValueEntry => ({
  id: `entry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  key,
  value,
});

const recordToEntries = (record: Record<string, string> | undefined): KeyValueEntry[] => {
  const entries = Object.entries(record ?? {}).map(([key, value]) => createEntry(key, value));
  return entries.length > 0 ? entries : [createEntry()];
};

const entriesToRecord = (entries: KeyValueEntry[]): Record<string, string> =>
  Object.fromEntries(
    entries
      .filter((entry) => entry.key.trim().length > 0 && entry.value.trim().length > 0)
      .map((entry) => [entry.key.trim(), entry.value.trim()]),
  );

type InspectorBindingRequestConfigProps = {
  endpoint: string;
  urlParams: Record<string, string>;
  headers: Record<string, string>;
  onUrlParamsChange: (next: Record<string, string>) => void;
  onHeadersChange: (next: Record<string, string>) => void;
};

const KeyValueEditor: React.FC<{
  title: string;
  description: string;
  keyPlaceholder: string;
  valuePlaceholder: string;
  entries: KeyValueEntry[];
  onChange: (entries: KeyValueEntry[]) => void;
}> = ({
  title,
  description,
  keyPlaceholder,
  valuePlaceholder,
  entries,
  onChange,
}) => (
  <div className="space-y-2 border-t border-slate-100 pt-3" {...preventInspectorDetailsToggle}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-col gap-[2px]">
        <span className={`ps-[4px] ${INSPECTOR_TEXT_XS} font-semibold text-slate-700`}>{title}</span>
        <span className={`ps-[4px] ${INSPECTOR_TEXT_XS} text-slate-500`}>{description}</span>
      </div>
      <AppButton
        type="button"
        intent="secondary"
        size="sm"
        className={`h-7 px-2 ${INSPECTOR_TEXT_XS}`}
        onClick={() => onChange([...entries, createEntry()])}
      >
        <Plus className="mr-1 h-3 w-3" strokeWidth={2} />
        Add
      </AppButton>
    </div>

    <div className="space-y-2">
      {entries.map((entry) => (
        <div key={entry.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px] items-center gap-2">
          <UiInput
            size="sm"
            className="w-full"
            placeholder={keyPlaceholder}
            ariaLabel={`${title} key`}
            value={entry.key}
            onChange={(event) => {
              onChange(entries.map((candidate) =>
                candidate.id === entry.id ? { ...candidate, key: event.target.value } : candidate,
              ));
            }}
          />
          <UiInput
            size="sm"
            className="w-full"
            placeholder={valuePlaceholder}
            ariaLabel={`${title} value`}
            value={entry.value}
            onChange={(event) => {
              onChange(entries.map((candidate) =>
                candidate.id === entry.id ? { ...candidate, value: event.target.value } : candidate,
              ));
            }}
          />
          <AppButton
            type="button"
            size="icon-sm"
            className={`${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_DELETE_CLASS}`}
            aria-label={`Remove ${title} row`}
            disabled={entries.length <= 1}
            onClick={() => {
              const nextEntries = entries.filter((candidate) => candidate.id !== entry.id);
              onChange(nextEntries.length > 0 ? nextEntries : [createEntry()]);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </AppButton>
        </div>
      ))}
    </div>
  </div>
);

export const InspectorBindingRequestConfig: React.FC<InspectorBindingRequestConfigProps> = ({
  endpoint,
  urlParams,
  headers,
  onUrlParamsChange,
  onHeadersChange,
}) => {
  const [urlParamEntries, setUrlParamEntries] = React.useState<KeyValueEntry[]>(() => recordToEntries(urlParams));
  const [headerEntries, setHeaderEntries] = React.useState<KeyValueEntry[]>(() => recordToEntries(headers));

  React.useEffect(() => {
    setUrlParamEntries(recordToEntries(urlParams));
  }, [urlParams]);

  React.useEffect(() => {
    setHeaderEntries(recordToEntries(headers));
  }, [headers]);

  React.useEffect(() => {
    const detectedParams = collectTemplateParamNames(endpoint, entriesToRecord(headerEntries));
    if (detectedParams.length === 0) {
      return;
    }

    setUrlParamEntries((current) => {
      const currentRecord = entriesToRecord(current);
      let changed = false;
      const nextRecord = { ...currentRecord };

      for (const paramName of detectedParams) {
        if (!nextRecord[paramName]) {
          nextRecord[paramName] = '';
          changed = true;
        }
      }

      if (!changed) {
        return current;
      }

      return recordToEntries(nextRecord);
    });
  }, [endpoint, headerEntries]);

  const updateUrlParams = (entries: KeyValueEntry[]) => {
    setUrlParamEntries(entries);
    onUrlParamsChange(entriesToRecord(entries));
  };

  const updateHeaders = (entries: KeyValueEntry[]) => {
    setHeaderEntries(entries);
    onHeadersChange(entriesToRecord(entries));
  };

  return (
    <>
      <KeyValueEditor
        title="URL Parameters"
        description="Map {param} placeholders to bindingContext paths (e.g. route.userId)."
        keyPlaceholder="userId"
        valuePlaceholder="route.userId"
        entries={urlParamEntries}
        onChange={updateUrlParams}
      />

      <KeyValueEditor
        title="Auth / Headers"
        description="Request headers; values may include {token} placeholders."
        keyPlaceholder="Authorization"
        valuePlaceholder="Bearer {token}"
        entries={headerEntries}
        onChange={updateHeaders}
      />
    </>
  );
};
