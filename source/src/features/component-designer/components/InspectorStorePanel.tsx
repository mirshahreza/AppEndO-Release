import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { DesignerAction, DesignerBindingDefinitions, DesignerDocument, DesignerStoreSegment } from '../../../domain/component-designer/types';
import { countStoreSegmentReaders } from '../../../domain/component-designer/bindingStoreEngine';
import { AppButton } from '../../../shared/ui/AppButton';
import { DesignerCodeEditorField, UiInput, UiSelect } from '../../../shared/ui';
import { ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_DELETE_CLASS } from '../../../shared/ui/surfaceClasses';
import { DesignerFieldRow } from './DesignerFieldRow';
import {
  INSPECTOR_TEXT_SM,
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';

type InspectorStorePanelProps = {
  bindingDefinitions: DesignerBindingDefinitions;
  document: DesignerDocument;
  dispatch: React.Dispatch<DesignerAction>;
};

const createSegmentId = (): string => `segment_${Date.now().toString(36)}`;

const serializeInitialValue = (value: unknown): string => {
  if (value === undefined) {
    return '';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
};

const parseInitialValue = (raw: string): unknown | undefined => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return JSON.parse(trimmed) as unknown;
};

export const InspectorStorePanel: React.FC<InspectorStorePanelProps> = ({
  bindingDefinitions,
  document,
  dispatch,
}) => {
  const segments: DesignerStoreSegment[] = Object.values(bindingDefinitions.storeSegments);

  const handleAddSegment = () => {
    const segmentId = createSegmentId();
    dispatch({
      type: 'set-store-segment',
      segmentId,
      segment: {
        id: segmentId,
        initialValue: {},
        persist: 'none',
      },
    });
  };

  const updateSegment = (segmentId: string, updater: (segment: DesignerStoreSegment) => DesignerStoreSegment) => {
    const current = bindingDefinitions.storeSegments[segmentId];
    if (!current) {
      return;
    }

    dispatch({
      type: 'set-store-segment',
      segmentId,
      segment: updater(current),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className={`ps-[4px] ${INSPECTOR_TEXT_SM} text-slate-500`}>
          Document-scoped reactive state shared across sibling components. Bind reads with store paths on properties and writes on interactions.
        </p>
        <AppButton
          type="button"
          intent="secondary"
          size="sm"
          className={`h-7 shrink-0 px-2 ${INSPECTOR_TEXT_XS}`}
          onClick={handleAddSegment}
        >
          <Plus className="mr-1 h-3 w-3" strokeWidth={2} />
          Add Segment
        </AppButton>
      </div>

      {segments.length === 0 ? (
        <p className={`rounded-md border border-dashed border-slate-200 bg-slate-50 px-2 py-3 text-center ${INSPECTOR_TEXT_SM} text-slate-500`}>
          No store segments yet. Add a segment such as <span className="font-medium text-slate-700">selection</span> or <span className="font-medium text-slate-700">filters</span>.
        </p>
      ) : (
        <div className="space-y-2">
          {segments.map((segment) => (
            <div key={segment.id} className={`rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2.5`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className={`ps-[4px] ${INSPECTOR_TEXT_XS} font-semibold uppercase tracking-[0.08em] text-slate-600`}>Segment</span>
                <AppButton
                  type="button"
                  size="icon-sm"
                  className={`${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_DELETE_CLASS}`}
                  aria-label={`Remove store segment ${segment.id}`}
                  onClick={() => dispatch({ type: 'remove-store-segment', segmentId: segment.id })}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </AppButton>
              </div>

              <div className="space-y-2">
                <DesignerFieldRow label="Segment ID">
                  <UiInput
                    size="sm"
                    nested
                    value={segment.id}
                    onChange={(event) => {
                      const nextId = event.target.value.trim();
                      if (!nextId || nextId === segment.id) {
                        return;
                      }

                      dispatch({ type: 'remove-store-segment', segmentId: segment.id });
                      dispatch({
                        type: 'set-store-segment',
                        segmentId: nextId,
                        segment: { ...segment, id: nextId },
                      });
                    }}
                  />
                </DesignerFieldRow>

                <DesignerFieldRow label="Initial Value (JSON)" align="start">
                  <DesignerCodeEditorField
                    ariaLabel={`${segment.id} initial value JSON`}
                    language="json"
                    editorHeight={90}
                    lineNumbers={false}
                    minimap={false}
                    fontSize={12}
                    placeholder="{}"
                    value={serializeInitialValue(segment.initialValue)}
                    onChange={(nextText) => {
                      try {
                        const nextValue = parseInitialValue(nextText);
                        updateSegment(segment.id, (current) => ({ ...current, initialValue: nextValue }));
                      } catch {
                        // Ignore invalid JSON while typing.
                      }
                    }}
                  />
                </DesignerFieldRow>

                <DesignerFieldRow label="Hydrate From">
                  <UiInput
                    size="sm"
                    nested
                    placeholder="countries"
                    value={segment.hydrateFrom ?? ''}
                    onChange={(event) =>
                      updateSegment(segment.id, (current) => ({
                        ...current,
                        hydrateFrom: event.target.value.trim().length > 0 ? event.target.value.trim() : undefined,
                      }))
                    }
                  />
                </DesignerFieldRow>

                <DesignerFieldRow label="Persist">
                  <UiSelect
                    size="sm"
                    nested
                    value={segment.persist ?? 'none'}
                    onChange={(event) =>
                      updateSegment(segment.id, (current) => ({
                        ...current,
                        persist: event.target.value as DesignerStoreSegment['persist'],
                      }))
                    }
                  >
                    <option value="none">None</option>
                    <option value="session">Session</option>
                    <option value="local">Local</option>
                  </UiSelect>
                </DesignerFieldRow>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={`rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50/80 px-2 py-2 ${INSPECTOR_TEXT_XS} text-slate-600`}>
        <p className="font-medium text-slate-700">Active store readers</p>
        <ul className="mt-1 space-y-0.5">
          {segments.length === 0 ? (
            <li>No segments defined.</li>
          ) : (
            segments.map((segment) => {
              const readers = countStoreSegmentReaders(document, segment.id);
              return (
                <li key={`reader-summary:${segment.id}`}>
                  <span className="font-mono text-slate-700">{segment.id}.*</span>
                  {' · '}
                  {readers} bound {readers === 1 ? 'property' : 'properties'}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
};
