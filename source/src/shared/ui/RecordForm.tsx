import React, { useEffect, useRef, useState } from 'react';
import { Pin, PinOff, Plus, Trash2 } from 'lucide-react';
import { useOptionalCulture } from '../../core/culture/CultureContext';
import {
  crudSetColumnCellKind,
  crudSetColumnFormControl,
  crudSetColumnFormPlacement,
  crudSetColumnLabel,
  crudSetFieldVisibleWhen,
  crudSetHumanizeField,
  RECORD_FORM_DEFAULT_SIDE_PANEL_PLACEMENT,
  RECORD_FORM_DEFAULT_SIDE_PANEL_SPLITTER,
  RECORD_FORM_SIDE_PANEL_WIDTH_PX,
  isRecordFormSidePanelBackground,
  isRecordFormSidePanelPlacement,
  recordFormSidePanelPhysicallyLeft,
  resolveRecordFormSidePanelBackgroundColor,
  type CrudSetFormControl,
  type CrudSetGridColumn,
  type RecordFormMode,
  type RecordFormSidePanelBackground,
  type RecordFormSidePanelPlacement,
} from '../../domain/component-designer/crudSetSpec';
import { mapRecordHistoryField } from '../lib/useRecordSubjectHistory';
import { isRecordAuditCreatedField } from '../lib/recordEventHistoryFields';
import { UiColorField } from '../../components/ui/UiColorField';
import { AppButton } from './AppButton';
import { AppSelectionToggle, APP_SELECTION_TOGGLE_WRAP_CLASS } from './AppSelectionToggle';
import { CrudSetConfigCheckbox } from './CrudSetConfigCheckbox';
import { FormField } from './FormSection';
import { RecordEventHistoryIcon } from './RecordEventHistoryIcon';
import { UiSelect, UiTextarea } from './HeroFieldControls';
import { UiImageField } from './UiImageField';
import { UiInput } from './ai-field-assist/AiAssistInput';
import {
  ICON_ACTION_BUTTON_BASE_CLASS,
  ICON_ACTION_CANCEL_CLASS,
  INSPECTOR_RAIL_TITLE_CLASS,
} from './surfaceClasses';
import { useWorkspaceVerticalSplitPanel } from './useWorkspaceVerticalSplitPanel';
import { WorkspaceVerticalSplitHandle } from './WorkspaceVerticalSplitHandle';
import { WORKSPACE_SPLIT_PANEL_KEYS } from './workspaceSplitStorage';
import { cn } from '../../lib/utils';

/** Shell min-height so a docked side rail can stretch header-to-footer. */
export const RECORD_FORM_DOCKED_SHELL_CLASS =
  'flex min-h-[min(480px,72vh)] flex-col overflow-hidden';
/** Body outer: flex column so the inner host (and rail) fill remaining height. */
export const RECORD_FORM_DOCKED_BODY_OUTER_CLASS =
  'flex min-h-0 flex-1 flex-col overflow-hidden';
/** Body inner: fill the outer as a flex child; no inset — rail flush to header, footer, and edge. */
export const RECORD_FORM_DOCKED_BODY_CLASS =
  'flex min-h-0 flex-1 flex-col overflow-hidden !p-0';
/** Equal 15px padding on the main form column (matches dialog body token). */
export const RECORD_FORM_DOCKED_MAIN_CLASS =
  'min-w-0 flex-1 self-stretch overflow-x-hidden overflow-y-auto p-[15px]';
/** Kill DialogFooter mt-2 so the rail meets the footer border. */
export const RECORD_FORM_DOCKED_FOOTER_CLASS = '!mt-0';

export const RECORD_FORM_DOCKED_DIALOG_CHROME = {
  shellClassName: RECORD_FORM_DOCKED_SHELL_CLASS,
  bodyOuterClassName: RECORD_FORM_DOCKED_BODY_OUTER_CLASS,
  bodyClassName: RECORD_FORM_DOCKED_BODY_CLASS,
  footerClassName: RECORD_FORM_DOCKED_FOOTER_CLASS,
  auxiliaryFooterClassName: RECORD_FORM_DOCKED_FOOTER_CLASS,
  intermediateFooterClassName: RECORD_FORM_DOCKED_FOOTER_CLASS,
} as const;

const BOOLEAN_FORM_FIELD_RE = /^(active|enabled|archived|locked)$/i;
const WIDE_FORM_FIELD_RE = /^(subtitle|website|description|note|body|detailNote|comments|tags)$/i;
const LOOKUP_FORM_FIELDS = new Set(['status', 'owner', 'city', 'parentTitle', 'parentId']);
const PARENT_FORM_FIELDS = new Set(['parentTitle', 'parentId']);
const CHIPS_TOGGLE_FIELDS = new Set(['tags']);
const HAS_MANY_FORM_FIELDS = new Set(['comments']);
const TEXTAREA_FORM_FIELDS = new Set(['detailNote', 'note', 'description', 'body']);

const FormEditorStack: React.FC<{
  children: React.ReactNode;
  className?: string;
  isInvalid?: boolean;
  feedbackPlacement?: string;
  errorMessage?: string;
}> = ({ children, className }) => (
  <div className={className}>{children}</div>
);

export const stringifyRecordFormCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
};

export const recordFormChipValues = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => stringifyRecordFormCell(item)).filter(Boolean);
  }
  const text = stringifyRecordFormCell(value);
  if (!text) {
    return [];
  }
  if (text.includes(',')) {
    return text.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [text];
};

export const isRecordFormChipsField = (
  field: string,
  kind: ReturnType<typeof crudSetColumnCellKind>,
  value: unknown,
): boolean => (
  kind === 'chips'
  || CHIPS_TOGGLE_FIELDS.has(field)
  || HAS_MANY_FORM_FIELDS.has(field)
  || Array.isArray(value)
);

export const isRecordFormBooleanField = (
  field: string,
  kind: ReturnType<typeof crudSetColumnCellKind>,
  value: unknown,
): boolean => (
  kind === 'boolean-icon'
  || kind === 'lock-status'
  || typeof value === 'boolean'
  || value === 'true'
  || value === 'false'
  || BOOLEAN_FORM_FIELD_RE.test(field)
);

export type RecordFormProps = {
  mode: RecordFormMode;
  columns: readonly CrudSetGridColumn[];
  fields: readonly string[];
  values: Record<string, unknown>;
  onChange?: (next: Record<string, unknown>) => void;
  selectOptions?: (field: string, kind: ReturnType<typeof crudSetColumnCellKind>) => string[];
  chipOptions?: (field: string) => string[];
  sidePanelTitle: string;
  sidePanelPlacement?: RecordFormSidePanelPlacement;
  sidePanelPinnable?: boolean;
  sidePanelSplitter?: boolean;
  sidePanelShowTitle?: boolean;
  sidePanelTitleInHeader?: boolean;
  sidePanelBackground?: RecordFormSidePanelBackground;
  sidePanelBackgroundColor?: string;
  /** Fields that stay read-only even in create/edit (e.g. parent path, locked name). */
  lockedFields?: readonly string[];
  /** Designed component name shown when CRUD Set points at an Edit / View. */
  componentName?: string;
  historyTrackedFields?: readonly string[];
  historyFieldMap?: Record<string, string>;
  onOpenFieldHistory?: (field: string) => void;
  onOpenRecordHistory?: () => void;
};

const setField = (
  values: Record<string, unknown>,
  field: string,
  next: unknown,
  onChange?: (next: Record<string, unknown>) => void,
) => {
  onChange?.({ ...values, [field]: next });
};

const RecordFormSidePinButton: React.FC<{
  collapsed: boolean;
  onToggle: () => void;
}> = ({ collapsed, onToggle }) => (
  <AppButton
    type="button"
    size="icon-sm"
    className={cn(ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_CANCEL_CLASS, 'h-7 w-7 shrink-0')}
    aria-label={collapsed ? 'Pin side panel' : 'Unpin side panel'}
    title={collapsed ? 'Pin' : 'Unpin'}
    data-testid="record-form-side-pin"
    onClick={onToggle}
  >
    {collapsed
      ? <Pin className="h-3.5 w-3.5" aria-hidden />
      : <PinOff className="h-3.5 w-3.5" aria-hidden />}
  </AppButton>
);

const RecordFormSplitLayout: React.FC<{
  title: string;
  placement: RecordFormSidePanelPlacement;
  pinnable: boolean;
  splitter: boolean;
  showTitle: boolean;
  titleInHeader: boolean;
  background: RecordFormSidePanelBackground;
  backgroundColor?: string;
  main: React.ReactNode;
  side: React.ReactNode;
}> = ({
  title,
  placement,
  pinnable,
  splitter,
  showTitle,
  titleInHeader,
  background,
  backgroundColor,
  main,
  side,
}) => {
  const culture = useOptionalCulture();
  const isRtl = culture?.direction === 'rtl'
    || (typeof document !== 'undefined' && document.documentElement.getAttribute('dir') === 'rtl');
  const physicallyLeft = recordFormSidePanelPhysicallyLeft(placement, isRtl);
  const containerRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const split = useWorkspaceVerticalSplitPanel({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.recordFormSidePanel,
    defaultSize: RECORD_FORM_SIDE_PANEL_WIDTH_PX,
    minSize: 180,
    maxSize: 420,
    measure: physicallyLeft ? 'leading' : 'trailing',
    containerRef,
    side: physicallyLeft ? 'start' : 'end',
    collapsible: false,
    persist: false,
    displayClassName: 'block',
  });

  useEffect(() => {
    if (!pinnable) {
      setCollapsed(false);
    }
  }, [pinnable]);

  const titleNode = showTitle && !collapsed ? (
    <h3 className={INSPECTOR_RAIL_TITLE_CLASS}>
      {title}
    </h3>
  ) : null;
  const headerTitle = Boolean(showTitle && titleInHeader && !collapsed);
  const bodyTitle = Boolean(showTitle && !titleInHeader && !collapsed);
  const headerBand = !collapsed && (headerTitle || (pinnable && !bodyTitle));
  const sideWidth = collapsed
    ? 36
    : splitter
      ? split.size
      : RECORD_FORM_SIDE_PANEL_WIDTH_PX;
  const fill = resolveRecordFormSidePanelBackgroundColor(background, backgroundColor);

  const aside = (
    <aside
      className={cn(
        'flex min-h-0 shrink-0 flex-col self-stretch overflow-hidden',
        physicallyLeft
          ? 'border-e border-[color:var(--app-inspector-rail-border)]'
          : 'border-s border-[color:var(--app-inspector-rail-border)]',
        collapsed && 'items-center',
      )}
      style={{ width: sideWidth, backgroundColor: fill }}
      data-testid="record-form-side"
      data-placement={placement}
      data-collapsed={collapsed ? 'true' : 'false'}
      data-title-in-header={titleInHeader ? 'true' : 'false'}
      data-background={background}
      data-docked="true"
    >
      {collapsed ? (
        pinnable ? (
          <div className="py-2">
            <RecordFormSidePinButton collapsed onToggle={() => setCollapsed(false)} />
          </div>
        ) : null
      ) : (
        <>
          {headerBand ? (
            <div
              className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3"
              data-testid="record-form-side-header"
            >
              {headerTitle ? titleNode : <span />}
              {pinnable ? (
                <RecordFormSidePinButton collapsed={false} onToggle={() => setCollapsed(true)} />
              ) : null}
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
            {bodyTitle ? (
              <div className="flex items-start justify-between gap-2">
                {titleNode}
                {pinnable ? (
                  <RecordFormSidePinButton collapsed={false} onToggle={() => setCollapsed(true)} />
                ) : null}
              </div>
            ) : null}
            {side}
          </div>
        </>
      )}
    </aside>
  );

  const splitHandle = splitter && !collapsed ? (
    <div className="flex self-stretch" data-testid="record-form-side-split">
      <WorkspaceVerticalSplitHandle
        {...split.splitHandleProps}
        appearance="ghost"
        displayClassName="block"
      />
    </div>
  ) : null;

  const mainColumn = (
    <div className={RECORD_FORM_DOCKED_MAIN_CLASS} data-testid="record-form-main">
      {main}
    </div>
  );

  return (
    <div ref={containerRef} className="flex min-h-0 min-w-0 flex-1 items-stretch overflow-hidden">
      {physicallyLeft ? (
        <>
          {aside}
          {splitHandle}
          {mainColumn}
        </>
      ) : (
        <>
          {mainColumn}
          {splitHandle}
          {aside}
        </>
      )}
    </div>
  );
};

/** Edit / View / Create record body: main fields plus optional side panel. */
export const RecordForm: React.FC<RecordFormProps> = ({
  mode,
  columns,
  fields,
  values,
  onChange,
  selectOptions,
  chipOptions,
  sidePanelTitle,
  sidePanelPlacement,
  sidePanelPinnable = false,
  sidePanelSplitter = RECORD_FORM_DEFAULT_SIDE_PANEL_SPLITTER,
  sidePanelShowTitle = true,
  sidePanelTitleInHeader = false,
  sidePanelBackground,
  sidePanelBackgroundColor,
  lockedFields = [],
  componentName,
  historyTrackedFields,
  historyFieldMap,
  onOpenFieldHistory,
  onOpenRecordHistory,
}) => {
  const readOnly = mode === 'view';
  const locked = new Set(lockedFields);
  const [chipDraft, setChipDraft] = useState<Record<string, string>>({});
  const columnByField = new Map(columns.map((column) => [column.field, column]));

  const visibleFields = fields.filter((field) => (
    crudSetFieldVisibleWhen(columnByField.get(field), values)
  ));
  const mainFields = visibleFields.filter((field) => (
    crudSetColumnFormPlacement(columnByField.get(field) ?? { field }) === 'main'
  ));
  const sideFields = visibleFields.filter((field) => (
    crudSetColumnFormPlacement(columnByField.get(field) ?? { field }) === 'side'
  ));
  const showSide = sideFields.length > 0;

  const addChipDraft = (field: string) => {
    const token = (chipDraft[field] ?? '').trim();
    if (!token || readOnly) {
      return;
    }
    const current = recordFormChipValues(values[field]);
    if (!current.includes(token)) {
      setField(values, field, [...current, token], onChange);
    }
    setChipDraft((draft) => ({ ...draft, [field]: '' }));
  };

  const renderField = (field: string) => {
    const value = values[field];
    const column = columnByField.get(field);
    const label = column ? crudSetColumnLabel(column) : crudSetHumanizeField(field);
    const kind = crudSetColumnCellKind(column ?? { field });
    const control: CrudSetFormControl = column
      ? crudSetColumnFormControl(column)
      : 'auto';
    const fieldReadOnly = readOnly || locked.has(field);
    const isBoolean = control === 'checkbox' || (control === 'auto' && isRecordFormBooleanField(field, kind, value));
    const isNumber = field === 'latitude' || field === 'longitude' || typeof value === 'number';
    const wide = WIDE_FORM_FIELD_RE.test(field)
      || kind === 'chips'
      || control === 'textarea'
      || control === 'html'
      || control === 'json'
      || control === 'image'
      || column?.formColumnSpan === 2;
    const fieldClassName = wide ? 'sm:col-span-2' : undefined;
    const formHint = column?.formHint?.trim() || undefined;
    const textareaRows = column?.formTextareaRows ?? 3;
    const showHistory = mode !== 'create' && Boolean(onOpenFieldHistory);
    const tracked = new Set(
      (historyTrackedFields ?? []).map((item) => mapRecordHistoryField(item, historyFieldMap)),
    );
    const eventField = mapRecordHistoryField(field, historyFieldMap);
    const auditCreated = isRecordAuditCreatedField(field) || isRecordAuditCreatedField(eventField);
    const historyOn = showHistory && (
      tracked.size === 0
        || tracked.has(field)
        || tracked.has(eventField)
    );
    const historyIcon = auditCreated && mode !== 'create' && onOpenRecordHistory
      ? <RecordEventHistoryIcon onClick={() => onOpenRecordHistory()} />
      : historyOn && onOpenFieldHistory
        ? <RecordEventHistoryIcon onClick={() => onOpenFieldHistory(eventField)} />
        : undefined;

    const fieldShell = (control: React.ReactNode) => (
      <FormField
        key={field}
        label={label}
        className={fieldClassName}
        hint={formHint}
        labelExtra={historyIcon}
      >
        {control}
      </FormField>
    );

    if (control === 'password') {
      return fieldShell(
        fieldReadOnly ? (
          <p className="text-sm text-slate-700">••••••••</p>
        ) : (
          <UiInput
            type="password"
            value={stringifyRecordFormCell(value)}
            ariaLabel={label}
            onChange={(event) => setField(values, field, event.target.value, onChange)}
          />
        ),
      );
    }

    if (control === 'image') {
      const src = stringifyRecordFormCell(value);
      return fieldShell(
        fieldReadOnly ? (
          src ? (
            <img src={src} alt="" className="h-16 w-16 rounded-md object-cover" />
          ) : (
            <p className="text-sm text-slate-700">—</p>
          )
        ) : (
          <UiImageField
            previewSrc={src || null}
            openEditorOnPick={false}
            showFileName={false}
            enableAiPanel={false}
            ariaLabel={label}
            onChange={(file) => {
              if (!file) {
                setField(values, field, '', onChange);
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setField(values, field, String(reader.result ?? ''), onChange);
              reader.readAsDataURL(file);
            }}
          />
        ),
      );
    }

    if (control === 'color') {
      return fieldShell(
        <UiColorField
          value={stringifyRecordFormCell(value)}
          ariaLabel={label}
          disabled={fieldReadOnly}
          clearable={!fieldReadOnly}
          onChange={(next) => setField(values, field, next, onChange)}
        />,
      );
    }

    if (control === 'html' || control === 'json' || control === 'textarea') {
      const text = stringifyRecordFormCell(value);
      return fieldShell(
        fieldReadOnly ? (
          <pre className="whitespace-pre-wrap break-words font-mono text-xs text-slate-700">{text || '—'}</pre>
        ) : (
          <UiTextarea
            value={text}
            ariaLabel={label}
            rows={textareaRows}
            className={control === 'textarea' ? undefined : 'font-mono'}
            onChange={(event) => setField(values, field, event.target.value, onChange)}
          />
        ),
      );
    }

    if (isBoolean) {
      const checked = value === true || value === 'true';
      return (
        <div key={field} className={fieldClassName}>
          {historyIcon ? <div className="mb-1 flex justify-end">{historyIcon}</div> : null}
          <CrudSetConfigCheckbox
            label={label}
            checked={checked}
            disabled={fieldReadOnly}
            control="checkbox"
            onChange={(next) => setField(values, field, next, onChange)}
          />
        </div>
      );
    }

    if (HAS_MANY_FORM_FIELDS.has(field) || (kind === 'chips' && field === 'comments')) {
      const items = recordFormChipValues(value);
      return fieldShell(
        fieldReadOnly ? (
          <p className="text-sm text-slate-700">{items.join(', ') || '—'}</p>
        ) : (
          <FormEditorStack className="flex flex-col gap-2">
            {items.map((item, index) => (
              <div key={`${field}-${index}`} className="flex items-center gap-2">
                <UiInput
                  value={item}
                  ariaLabel={`${label} ${index + 1}`}
                  onChange={(event) => {
                    const next = [...items];
                    next[index] = event.target.value;
                    setField(values, field, next, onChange);
                  }}
                />
                <AppButton
                  type="button"
                  size="icon-sm"
                  intent="destructive-soft"
                  aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
                  onClick={() => setField(values, field, items.filter((_, itemIndex) => itemIndex !== index), onChange)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </AppButton>
              </div>
            ))}
            <AppButton
              type="button"
              size="sm"
              intent="utility"
              onClick={() => setField(values, field, [...items, ''], onChange)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add {label.toLowerCase().replace(/s$/, '')}
            </AppButton>
          </FormEditorStack>
        ),
      );
    }

    if (control === 'chips' || isRecordFormChipsField(field, kind, value)) {
      const selected = recordFormChipValues(value);
      const options = chipOptions?.(field) ?? selected;
      return fieldShell(
        fieldReadOnly ? (
          <p className="text-sm text-slate-700">{selected.join(', ') || '—'}</p>
        ) : (
          <FormEditorStack className="flex flex-col gap-2">
            <div className={APP_SELECTION_TOGGLE_WRAP_CLASS}>
              {options.map((option) => {
                const on = selected.includes(option);
                return (
                  <AppSelectionToggle
                    key={option}
                    selected={on}
                    onClick={() => setField(
                      values,
                      field,
                      on ? selected.filter((item) => item !== option) : [...selected, option],
                      onChange,
                    )}
                  >
                    {option}
                  </AppSelectionToggle>
                );
              })}
            </div>
            <UiInput
              value={chipDraft[field] ?? ''}
              ariaLabel={`Add ${label.toLowerCase()}`}
              placeholder={`Add ${label.toLowerCase()}`}
              onChange={(event) => setChipDraft((current) => ({ ...current, [field]: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addChipDraft(field);
                }
              }}
            />
          </FormEditorStack>
        ),
      );
    }

    if (TEXTAREA_FORM_FIELDS.has(field) && control === 'auto') {
      return fieldShell(
        fieldReadOnly ? (
          <p className="whitespace-pre-wrap text-sm text-slate-700">{stringifyRecordFormCell(value) || '—'}</p>
        ) : (
          <UiTextarea
            value={stringifyRecordFormCell(value)}
            ariaLabel={label}
            rows={textareaRows}
            onChange={(event) => setField(values, field, event.target.value, onChange)}
          />
        ),
      );
    }

    const options = isNumber ? [] : (selectOptions?.(field, kind) ?? []);
    if (options.length > 0) {
      const selected = stringifyRecordFormCell(value);
      return fieldShell(
        fieldReadOnly ? (
          <p className="text-sm text-slate-700">{selected || '—'}</p>
        ) : (
          <UiSelect
            value={selected}
            ariaLabel={label}
            onChange={(event) => setField(values, field, event.target.value, onChange)}
          >
            <option value="">Select {label.toLowerCase()}</option>
            {options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </UiSelect>
        ),
      );
    }

    return fieldShell(
      fieldReadOnly ? (
        <p className="text-sm text-slate-700">{stringifyRecordFormCell(value) || '—'}</p>
      ) : (
        <UiInput
          type={isNumber ? 'number' : kind === 'link' || field === 'website' ? 'url' : 'text'}
          step={isNumber ? 'any' : undefined}
          value={stringifyRecordFormCell(value)}
          ariaLabel={label}
          onChange={(event) => {
            const next = event.target.value;
            setField(values, field, isNumber && next !== '' ? Number(next) : next, onChange);
          }}
        />
      ),
    );
  };

  if (fields.length === 0) {
    return <p className="text-sm text-slate-600">This form has no fields.</p>;
  }

  const placement = isRecordFormSidePanelPlacement(sidePanelPlacement)
    ? sidePanelPlacement
    : RECORD_FORM_DEFAULT_SIDE_PANEL_PLACEMENT;
  const background = isRecordFormSidePanelBackground(sidePanelBackground)
    ? sidePanelBackground
    : 'theme';
  const designedNote = componentName ? (
    <p className="text-xs text-slate-500">Uses designed component {componentName}.</p>
  ) : null;
  const mainGrid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {mainFields.map(renderField)}
    </div>
  );

  if (!showSide) {
    return (
      <div className="flex min-h-0 flex-col gap-3" data-testid="record-form">
        {designedNote}
        {mainGrid}
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col self-stretch overflow-hidden"
      data-testid="record-form"
      data-docked="true"
    >
      <RecordFormSplitLayout
        title={sidePanelTitle}
        placement={placement}
        pinnable={sidePanelPinnable}
        splitter={sidePanelSplitter}
        showTitle={sidePanelShowTitle}
        titleInHeader={sidePanelTitleInHeader}
        background={background}
        backgroundColor={sidePanelBackgroundColor}
        main={(
          <>
            {designedNote}
            {mainGrid}
          </>
        )}
        side={sideFields.map(renderField)}
      />
    </div>
  );
};

export const defaultRecordFormFieldValue = (
  field: string,
  kind: ReturnType<typeof crudSetColumnCellKind>,
): unknown => {
  if (isRecordFormChipsField(field, kind, undefined)) {
    return [];
  }
  if (!isRecordFormBooleanField(field, kind, undefined)) {
    return '';
  }
  return /^(active|enabled)$/i.test(field);
};

export const PARENT_RECORD_FORM_FIELDS = PARENT_FORM_FIELDS;
export const LOOKUP_RECORD_FORM_FIELDS = LOOKUP_FORM_FIELDS;
