import * as React from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { DesignerAction, DesignerNode } from '../../../domain/component-designer/types';
import type { ContentRecordFieldDef } from '../../../domain/component-designer/inspectorRegistry';
import { AppButton } from '../../../shared/ui/AppButton';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { UiCheckbox, UiInput, UiTextarea } from '../../../shared/ui';
import { ICON_ACTION_CANCEL_CLASS, ICON_ACTION_DELETE_CLASS } from '../../../shared/ui/surfaceClasses';
import { DesignerFieldRow } from './DesignerFieldRow';
import { preventInspectorDetailsToggle } from './inspectorDetailsGuard';
import {
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';
import { InspectorMicroLabel, InspectorSectionValueBadge } from './inspectorFieldPrimitives';

type ContentRecord = Record<string, string>;

type InspectorContentRecordsFieldProps = {
  node: DesignerNode;
  dispatch: React.Dispatch<DesignerAction>;
  /** The node prop holding the JSON array string (e.g. `data`, `slides`). */
  propKey: string;
  /** Panel label, e.g. "Team members", "Blog posts". */
  title: string;
  /** Singular label used on the Add button and per-card heading, e.g. "member", "post". */
  itemLabel: string;
  /** Per-record sub-fields, in display order. The first field is used as the card heading. */
  fields: ContentRecordFieldDef[];
  /** Whether records get an auto-generated `id` (most widgets key by id; description-list does not). */
  hasId?: boolean;
};

const coerceRecordArray = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const parseRecords = (raw: unknown): ContentRecord[] => {
  const parsed = coerceRecordArray(raw);
  return parsed.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return {};
    }
    return Object.fromEntries(
      Object.entries(entry as Record<string, unknown>).map(([key, value]) => [key, value === undefined || value === null ? '' : String(value)]),
    );
  });
};

const createEmptyRecord = (fields: ContentRecordFieldDef[], hasId: boolean, index: number): ContentRecord => {
  const record: ContentRecord = {};
  if (hasId) {
    record.id = `item-${Date.now()}-${index}`;
  }
  for (const fieldDef of fields) {
    record[fieldDef.key] = '';
  }
  return record;
};

export const InspectorContentRecordsField: React.FC<InspectorContentRecordsFieldProps> = ({
  node,
  dispatch,
  propKey,
  title,
  itemLabel,
  fields,
  hasId = true,
}) => {
  const [records, setRecords] = React.useState<ContentRecord[]>(() => parseRecords(node.props[propKey]));
  const skipPropsSyncRef = React.useRef(false);

  React.useEffect(() => {
    if (skipPropsSyncRef.current) {
      skipPropsSyncRef.current = false;
      return;
    }
    setRecords(parseRecords(node.props[propKey]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, node.props[propKey]]);

  const persist = React.useCallback((nextRecords: ContentRecord[]) => {
    skipPropsSyncRef.current = true;
    setRecords(nextRecords);
    dispatch({
      type: 'set-node-prop',
      nodeId: node.id,
      key: propKey,
      value: JSON.stringify(nextRecords),
    });
  }, [dispatch, node.id, propKey]);

  const updateRecord = (index: number, patch: Partial<ContentRecord>) => {
    persist(records.map((record, recordIndex) => (recordIndex === index ? { ...record, ...patch } : record)));
  };

  const addRecord = () => {
    persist([...records, createEmptyRecord(fields, hasId, records.length)]);
  };

  const removeRecord = (index: number) => {
    persist(records.filter((_, recordIndex) => recordIndex !== index));
  };

  const moveRecord = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= records.length) {
      return;
    }
    const next = [...records];
    const [moved] = next.splice(index, 1);
    if (!moved) {
      return;
    }
    next.splice(targetIndex, 0, moved);
    persist(next);
  };

  const headingField = fields[0]?.key;

  return (
    <DesignerFieldRow label={title} layout="stack" align="start">
      <div className="flex w-full flex-col gap-2" {...preventInspectorDetailsToggle}>
        <AppSurfaceBox
          tone="cyan"
          title={title}
          layout="panel"
          collapsible
          defaultOpen
          headerExtra={(
            <InspectorSectionValueBadge
              count={records.length}
              label={`${records.length} ${itemLabel}${records.length === 1 ? '' : 's'}`}
              active={records.length > 0}
            />
          )}
        >
          <div className="space-y-3">
            {records.length === 0 ? (
              <p className={`rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-center ${INSPECTOR_TEXT_XS} text-slate-500`}>
                No {itemLabel}s yet.
              </p>
            ) : null}
            {records.map((record, index) => (
              <div
                key={`${node.id}:${propKey}:${index}`}
                className={`flex flex-col gap-2 rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50/50 p-2.5 shadow-sm`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate ${INSPECTOR_TEXT_XS} font-semibold text-slate-600`}>
                    {headingField ? (record[headingField]?.trim() || `${itemLabel} ${index + 1}`) : `${itemLabel} ${index + 1}`}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <AppButton
                      type="button"
                      size="icon-sm"
                      className={ICON_ACTION_CANCEL_CLASS}
                      aria-label={`Move ${itemLabel} ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => moveRecord(index, -1)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </AppButton>
                    <AppButton
                      type="button"
                      size="icon-sm"
                      className={ICON_ACTION_CANCEL_CLASS}
                      aria-label={`Move ${itemLabel} ${index + 1} down`}
                      disabled={index === records.length - 1}
                      onClick={() => moveRecord(index, 1)}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </AppButton>
                    <AppButton
                      type="button"
                      size="icon-sm"
                      className={ICON_ACTION_DELETE_CLASS}
                      aria-label={`Remove ${itemLabel} ${index + 1}`}
                      onClick={() => removeRecord(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </AppButton>
                  </div>
                </div>

                {fields.map((fieldDef) => (
                  <div key={fieldDef.key} className="flex flex-col gap-[2px]">
                    {fieldDef.control === 'checkbox' ? (
                      <UiCheckbox
                        size="sm"
                        checked={record[fieldDef.key] === 'true'}
                        onChange={(event) => updateRecord(index, { [fieldDef.key]: event.target.checked ? 'true' : 'false' })}
                      >
                        {fieldDef.label}
                      </UiCheckbox>
                    ) : (
                      <>
                        <InspectorMicroLabel>{fieldDef.label}</InspectorMicroLabel>
                        {fieldDef.control === 'textarea' ? (
                          <UiTextarea
                            size="sm"
                            nested
                            className="w-full bg-white text-slate-700"
                            placeholder={fieldDef.placeholder}
                            value={record[fieldDef.key] ?? ''}
                            onChange={(event) => updateRecord(index, { [fieldDef.key]: event.target.value })}
                            ariaLabel={`${itemLabel} ${index + 1} ${fieldDef.label}`}
                          />
                        ) : (
                          <UiInput
                            size="sm"
                            nested
                            className="w-full bg-white text-slate-700"
                            placeholder={fieldDef.placeholder}
                            value={record[fieldDef.key] ?? ''}
                            onChange={(event) => updateRecord(index, { [fieldDef.key]: event.target.value })}
                            ariaLabel={`${itemLabel} ${index + 1} ${fieldDef.label}`}
                          />
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))}

            <div className="pt-1">
              <AppButton type="button" size="sm" intent="secondary" onClick={addRecord}>
                <Plus className="h-3.5 w-3.5" />
                Add {itemLabel}
              </AppButton>
            </div>
          </div>
        </AppSurfaceBox>
      </div>
    </DesignerFieldRow>
  );
};
