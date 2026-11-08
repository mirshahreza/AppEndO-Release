import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, Code2, GripVertical, Plus, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS,
  useFixedDropDownMenuStyle,
} from '../AppSplitButton';
import { NativeButton } from '../NativeButton';
import { UiInput, UiRadioGroup } from '../HeroFieldControls';
import { DesignerDatePickerField } from '../DesignerFormFields';
import { UiCombobox } from '../UiCombobox';
import { UiSegmentedControl } from '../UiSegmentedControl';
import { UiSelectMenu } from '../UiSelectMenu';
import {
  HEROUI_FIELD_BOX_CLASS,
  HEROUI_FIELD_RADIUS_CLASS,
  HEROUI_FIELD_SURFACE_CLASS,
  resolveHeroUiFieldSelectTriggerClass,
  resolveHeroUiFieldSelectValueClass,
} from '../heroFieldChrome';
import { resolveHeroUiFieldSizeTokens, type HeroUiFieldSize } from '../heroFieldSize';
import { resolveHeroUiFieldBorderClass } from '../surfaceClasses';
import { useOptionalCultureT } from '../../../core/culture/CultureContext';
import {
  WhereBuilderLabelsProvider,
  localizeWhereOperators,
  resolveWhereBuilderLabels,
  useWhereBuilderLabels,
} from './whereBuilderCultureLabels';
import {
  DEFAULT_WHERE_OPERATORS,
  addWhereChild,
  createWhereCondition,
  createWhereGroup,
  filterWhereContextItemsForOperator,
  formatWherePreview,
  isWhereContextRefValidForOperator,
  joinWhereValue,
  moveWhereNodeByDrag,
  operatorsForField,
  patchWhereCondition,
  patchWhereManual,
  removeWhereNodeAt,
  setWhereGroupOp,
  splitWhereValue,
  switchWhereNodeToManual,
  whereGroupDropId,
  whereFieldType,
  whereOperatorValueArity,
  type WhereConditionNode,
  type WhereConditionPatch,
  type WhereContextItem,
  type WhereField,
  type WhereFieldOption,
  type WhereGroupNode,
  type WhereManualNode,
  type WhereOperator,
  type WhereValueKind,
  type WhereValueType,
} from './whereBuilderModel';

export type UiWhereBuilderProps = {
  value: WhereGroupNode;
  onChange: (next: WhereGroupNode) => void;
  fields: readonly WhereField[];
  operators?: readonly WhereOperator[];
  density?: 'compact' | 'default';
  allowNestedGroups?: boolean;
  maxDepth?: number;
  isDisabled?: boolean;
  showPreview?: boolean;
  size?: HeroUiFieldSize;
  invalidConditionId?: string;
  contextItems?: readonly WhereContextItem[];
  allowManualNodes?: boolean;
  showTreeLines?: boolean;
  showGroupBoxes?: boolean;
  allowReorder?: boolean;
  className?: string;
  ariaLabel?: string;
};

const CIRCLE_BUTTON_CLASS =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-white text-slate-500 transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const CIRCLE_ADD_CLASS = `${CIRCLE_BUTTON_CLASS} border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700`;
const CIRCLE_DELETE_CLASS = `${CIRCLE_BUTTON_CLASS} border-slate-200 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600`;
const CIRCLE_MANUAL_CLASS = `${CIRCLE_BUTTON_CLASS} border-slate-200 text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700`;
const DRAG_HANDLE_CLASS =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border-0 bg-transparent text-slate-400 transition-colors touch-none cursor-grab hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40';

const whereCollisionDetection: CollisionDetection = (args) => {
  const collisions = pointerWithin(args);
  const list = collisions.length > 0 ? collisions : closestCorners(args);
  const sorted = [...list].sort((left, right) => {
    const leftRect = args.droppableRects.get(left.id);
    const rightRect = args.droppableRects.get(right.id);
    const leftArea = leftRect ? leftRect.width * leftRect.height : Number.POSITIVE_INFINITY;
    const rightArea = rightRect ? rightRect.width * rightRect.height : Number.POSITIVE_INFINITY;
    return leftArea - rightArea;
  });
  return sorted.slice(0, 1);
};

const BOOLEAN_RADIO_GROUP_CLASS = '!w-auto flex-nowrap gap-x-4';
const BOOLEAN_RADIO_OPTION_CLASS = '!inline-flex !w-auto';

const WhereContextDropdown: React.FC<{
  items: readonly WhereContextItem[];
  selectedId?: string;
  isDisabled?: boolean;
  onSelect: (id: string) => void;
}> = ({ items, selectedId, isDisabled, onSelect }) => {
  const labels = useWhereBuilderLabels();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelStyle = useFixedDropDownMenuStyle(open, triggerRef, { align: 'end', minWidth: 192 });

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const panel = open ? (
    <div
      ref={panelRef}
      className={cn(SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS, 'max-h-56 min-w-[12rem] overflow-y-auto py-0.5')}
      style={panelStyle}
      role="listbox"
      aria-label={labels.serverContext}
    >
      {items.length === 0 ? (
        <p className="px-2.5 py-1.5 text-[11px] text-slate-500">{labels.serverContextEmpty}</p>
      ) : (
        items.map((item) => (
          <NativeButton
            key={item.id}
            type="button"
            role="option"
            aria-selected={item.id === selectedId}
            className={cn(
              'flex w-full px-2.5 py-1.5 text-start font-mono text-[11px] font-medium',
              item.id === selectedId
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-700',
            )}
            onClick={() => {
              setOpen(false);
              onSelect(item.id);
            }}
          >
            {item.label ?? item.id}
          </NativeButton>
        ))
      )}
    </div>
  ) : null;

  return (
    <>
      <NativeButton
        ref={triggerRef}
        type="button"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-slate-500 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={labels.serverContext}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={isDisabled}
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </NativeButton>
      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </>
  );
};

const WhereBooleanRadios: React.FC<{
  value: string;
  size: HeroUiFieldSize;
  ariaLabel: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  onChange: (value: string) => void;
}> = ({ value, size, ariaLabel, isDisabled, isInvalid, onChange }) => {
  const labels = useWhereBuilderLabels();
  const tokens = resolveHeroUiFieldSizeTokens(size);
  const booleanOptions = useMemo(
    () => [
      { value: 'true', label: labels.booleanTrue },
      { value: 'false', label: labels.booleanFalse },
    ],
    [labels.booleanFalse, labels.booleanTrue],
  );
  return (
    <div
      className={cn(
        'flex w-full min-w-0 items-stretch overflow-hidden',
        tokens.controlHeightClass,
        tokens.controlMaxHeightClass,
        HEROUI_FIELD_RADIUS_CLASS,
        HEROUI_FIELD_SURFACE_CLASS,
        resolveHeroUiFieldBorderClass(isInvalid),
        isDisabled && 'opacity-60',
      )}
    >
      <div className={cn('flex min-w-0 flex-1 items-center', HEROUI_FIELD_BOX_CLASS)}>
        <UiRadioGroup
          size={size}
          orientation="horizontal"
          className={BOOLEAN_RADIO_GROUP_CLASS}
          optionClassName={BOOLEAN_RADIO_OPTION_CLASS}
          ariaLabel={ariaLabel}
          value={value === 'false' ? 'false' : 'true'}
          isDisabled={isDisabled}
          options={booleanOptions}
          onChange={onChange}
        />
      </div>
    </div>
  );
};

const CircleIconButton: React.FC<{
  label: string;
  className: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, className, disabled, onClick, children }) => (
  <NativeButton
    type="button"
    tabIndex={-1}
    className={className}
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </NativeButton>
);

const WhereDragHandle: React.FC<{
  attributes?: DraggableAttributes;
  listeners?: DraggableSyntheticListeners;
  isDisabled?: boolean;
}> = ({ attributes, listeners, isDisabled }) => {
  const labels = useWhereBuilderLabels();
  return (
  <NativeButton
    type="button"
    tabIndex={-1}
    className={DRAG_HANDLE_CLASS}
    aria-label={labels.dragToMove}
    title={labels.dragToMove}
    disabled={isDisabled}
    {...attributes}
    {...listeners}
  >
    <GripVertical className="h-3.5 w-3.5" />
  </NativeButton>
  );
};

const WhereSortableItem: React.FC<{
  id: string;
  isDisabled?: boolean;
  children: React.ReactNode;
}> = ({ id, isDisabled, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: Boolean(isDisabled),
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex min-w-0 items-start gap-1"
    >
      <div className="flex h-7 shrink-0 items-center">
        <WhereDragHandle
          attributes={attributes}
          listeners={isDisabled ? undefined : listeners}
          isDisabled={isDisabled}
        />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
};

const WhereGroupDropZone: React.FC<{
  groupId: string;
  childIds: readonly string[];
  compact: boolean;
  showTreeLines: boolean;
  empty: boolean;
  children: React.ReactNode;
}> = ({ groupId, childIds, compact, showTreeLines, empty, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id: whereGroupDropId(groupId) });
  return (
    <SortableContext items={[...childIds]} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={cn(
          'relative',
          compact ? 'mt-2 ms-3 ps-3' : 'mt-3 ms-3 ps-4',
          empty ? 'min-h-[2rem]' : compact ? 'space-y-2' : 'space-y-2.5',
          showTreeLines && 'border-s border-slate-200',
          isOver && 'rounded-sm bg-indigo-50/70',
        )}
      >
        {children}
      </div>
    </SortableContext>
  );
};

const WhereAddControl: React.FC<{
  canNest: boolean;
  isDisabled?: boolean;
  onAddCondition: () => void;
  onAddGroup: () => void;
}> = ({ canNest, isDisabled, onAddCondition, onAddGroup }) => {
  const labels = useWhereBuilderLabels();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!canNest) {
    return (
      <CircleIconButton label={labels.addCondition} className={CIRCLE_ADD_CLASS} disabled={isDisabled} onClick={onAddCondition}>
        <Plus className="h-3.5 w-3.5" />
      </CircleIconButton>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <CircleIconButton
        label={labels.addConditionOrGroup}
        className={CIRCLE_ADD_CLASS}
        disabled={isDisabled}
        onClick={() => setOpen((current) => !current)}
      >
        <Plus className="h-3.5 w-3.5" />
      </CircleIconButton>
      {open ? (
        <div
          className="absolute start-0 top-[calc(100%+4px)] z-[130] min-w-[8.5rem] rounded-md border border-slate-200 bg-white py-0.5 shadow-md"
          role="menu"
          aria-label={labels.addMenuAria}
        >
          <NativeButton
            type="button"
            role="menuitem"
            className="flex w-full px-2.5 py-1.5 text-start text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-700"
            onClick={() => {
              setOpen(false);
              onAddCondition();
            }}
          >
            {labels.menuCondition}
          </NativeButton>
          <NativeButton
            type="button"
            role="menuitem"
            className="flex w-full px-2.5 py-1.5 text-start text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-700"
            onClick={() => {
              setOpen(false);
              onAddGroup();
            }}
          >
            {labels.menuGroup}
          </NativeButton>
        </div>
      ) : null}
    </div>
  );
};

const optionItems = (options: readonly WhereFieldOption[]) => (
  options.map((item) => ({ id: item.id, textValue: item.label }))
);

const WhereValueControl: React.FC<{
  type: WhereValueType;
  arity: 0 | 1 | 2;
  value: string;
  valueKind?: WhereValueKind;
  endValueKind?: WhereValueKind;
  size: HeroUiFieldSize;
  isDisabled?: boolean;
  isInvalid?: boolean;
  contextItems?: readonly WhereContextItem[];
  options?: readonly WhereFieldOption[];
  allowCustomValue?: boolean;
  onChange: (next: { value: string; valueKind?: WhereValueKind; endValueKind?: WhereValueKind }) => void;
}> = ({
  type,
  arity,
  value,
  valueKind = 'literal',
  endValueKind = 'literal',
  size,
  isDisabled,
  isInvalid,
  contextItems = [],
  options,
  allowCustomValue = false,
  onChange,
}) => {
  const labels = useWhereBuilderLabels();

  if (arity === 0) {
    return <span className="text-[11px] text-slate-400">—</span>;
  }

  const hasContext = type === 'text' && contextItems.length > 0;
  const closedOptions = options && options.length > 0 ? options : null;
  const [start, end] = splitWhereValue(value);

  const renderTyped = (
    current: string,
    kind: WhereValueKind,
    label: string,
    commit: (nextValue: string, nextKind: WhereValueKind) => void,
  ) => {
    if (closedOptions && kind === 'literal') {
      if (allowCustomValue) {
        return (
          <UiCombobox
            size={size}
            ariaLabel={label}
            className="w-full"
            allowCustomValue
            menuTrigger="focus"
            placeholder={labels.valuePlaceholder}
            value={current}
            items={optionItems(closedOptions)}
            isDisabled={isDisabled}
            isInvalid={isInvalid}
            onChange={(event) => commit(String(event.target.value), 'literal')}
            onCommitInputValue={(next) => commit(next, 'literal')}
          />
        );
      }
      const selected = closedOptions.some((item) => item.id === current)
        ? current
        : (closedOptions[0]?.id ?? '');
      return (
        <WhereMenuDropdown
          ariaLabel={label}
          selectedKey={selected}
          options={closedOptions.map((item) => ({ id: item.id, label: item.label }))}
          size={size}
          isDisabled={isDisabled}
          onSelectionChange={(next) => commit(next, 'literal')}
        />
      );
    }
    if (type === 'text') {
      const dropdown = hasContext ? (
        <WhereContextDropdown
          items={contextItems}
          selectedId={kind === 'context' ? current : undefined}
          isDisabled={isDisabled}
          onSelect={(id) => commit(id, 'context')}
        />
      ) : null;
      return (
        <UiInput
          size={size}
          ariaLabel={label}
          type="text"
          value={current}
          isDisabled={isDisabled}
          isInvalid={isInvalid}
          autoDir={false}
          placeholder={kind === 'context' ? 'user.id' : labels.valuePlaceholderList}
          className={kind === 'context' ? 'font-mono' : undefined}
          endContent={dropdown}
          endContentClassName={dropdown ? '!px-0' : undefined}
          onChange={(event) => commit(event.target.value, 'literal')}
        />
      );
    }

    if (type === 'number') {
      return (
        <UiInput
          size={size}
          ariaLabel={label}
          type="number"
          value={current}
          isDisabled={isDisabled}
          isInvalid={isInvalid}
          autoDir={false}
          placeholder={labels.valuePlaceholder}
          onChange={(event) => commit(event.target.value, 'literal')}
        />
      );
    }

    if (type === 'boolean') {
      return (
        <WhereBooleanRadios
          size={size}
          ariaLabel={label}
          value={current === 'false' ? 'false' : 'true'}
          isDisabled={isDisabled}
          isInvalid={isInvalid}
          onChange={(next) => commit(next, 'literal')}
        />
      );
    }

    return (
      <DesignerDatePickerField
        size={size}
        ariaLabel={label}
        value={current}
        isDisabled={isDisabled}
        isInvalid={isInvalid}
        className="!min-w-0"
        onChange={(next) => commit(next, 'literal')}
      />
    );
  };

  if (arity === 2) {
    return (
      <div className="grid min-w-0 grid-cols-1 gap-1">
        {renderTyped(start, valueKind, labels.value, (nextValue, nextKind) => {
          onChange({ value: joinWhereValue(nextValue, end), valueKind: nextKind });
        })}
        {renderTyped(end, endValueKind, labels.endValue, (nextValue, nextKind) => {
          onChange({ value: joinWhereValue(start, nextValue), endValueKind: nextKind });
        })}
      </div>
    );
  }

  return renderTyped(value, valueKind, labels.value, (nextValue, nextKind) => {
    onChange({ value: nextValue, valueKind: nextKind });
  });
};

const WhereMenuDropdown: React.FC<{
  ariaLabel: string;
  selectedKey: string;
  options: readonly { id: string; label: string }[];
  size: HeroUiFieldSize;
  isDisabled?: boolean;
  onSelectionChange: (key: string) => void;
}> = ({ ariaLabel, selectedKey, options, size, isDisabled, onSelectionChange }) => (
  <UiSelectMenu
    ariaLabel={ariaLabel}
    selectedKey={selectedKey}
    isDisabled={isDisabled}
    size={size}
    options={options.map((item) => ({
      id: item.id,
      textValue: item.label,
      content: item.label,
    }))}
    onSelectionChange={onSelectionChange}
    triggerClassName={resolveHeroUiFieldSelectTriggerClass({ size })}
    valueClassName={resolveHeroUiFieldSelectValueClass(size)}
    listBoxClassName={HEROUI_FIELD_RADIUS_CLASS}
  />
);

const WhereConditionRow: React.FC<{
  node: WhereConditionNode;
  fields: readonly WhereField[];
  operators: readonly WhereOperator[];
  size: HeroUiFieldSize;
  stacked: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  contextItems?: readonly WhereContextItem[];
  allowManual?: boolean;
  onPatch: (patch: WhereConditionPatch) => void;
  onSwitchManual: () => void;
  onRemove: () => void;
}> = ({
  node,
  fields,
  operators,
  size,
  stacked,
  isDisabled,
  isInvalid,
  contextItems,
  allowManual,
  onPatch,
  onSwitchManual,
  onRemove,
}) => {
  const labels = useWhereBuilderLabels();
  const field = fields.find((item) => item.id === node.field) ?? { id: node.field, label: node.field };
  const fieldOptions = fields.some((item) => item.id === node.field)
    ? fields
    : [field, ...fields];
  const fieldOperators = operatorsForField(field, operators);
  const type = whereFieldType(field);
  const arity = whereOperatorValueArity(node.operator, operators);
  const operatorContextItems = filterWhereContextItemsForOperator(node.operator, contextItems ?? []);

  const patchOperator = (nextOperator: string) => {
    const contextStillValid = node.valueKind === 'context'
      && isWhereContextRefValidForOperator(nextOperator, node.value, contextItems ?? []);
    const endContextStillValid = node.endValueKind === 'context'
      && isWhereContextRefValidForOperator(nextOperator, splitWhereValue(node.value)[1], contextItems ?? []);
    onPatch({
      operator: nextOperator,
      value: contextStillValid || endContextStillValid ? node.value : '',
      valueKind: contextStillValid ? 'context' : 'literal',
      endValueKind: endContextStillValid ? 'context' : 'literal',
    });
  };

  return (
    <div className={cn('flex min-w-0 items-start gap-2', stacked ? 'flex-col' : 'flex-row')}>
      <div className={cn(
        'min-w-0 flex-1',
        stacked
          ? 'grid grid-cols-1 gap-1'
          : 'grid grid-cols-[minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(9rem,1.3fr)] items-start gap-2',
      )}
      >
        <WhereMenuDropdown
          ariaLabel={labels.field}
          selectedKey={node.field}
          options={fieldOptions.map((item) => ({ id: item.id, label: item.label }))}
          size={size}
          isDisabled={isDisabled}
          onSelectionChange={(nextFieldId) => {
            const nextField = fields.find((item) => item.id === nextFieldId);
            const nextOperators = operatorsForField(nextField, operators);
            const nextOperator = nextOperators.some((item) => item.id === node.operator)
              ? node.operator
              : (nextOperators[0]?.id ?? 'eq');
            const nextType = whereFieldType(nextField);
            const keepExpression = nextType === 'text' && nextOperator === node.operator;
            const closedOptions = nextField?.options;
            const valueStillValid = Boolean(
              keepExpression
              && (
                !closedOptions?.length
                || nextField?.allowCustomValue
                || closedOptions.some((item) => item.id === node.value)
              ),
            );
            onPatch({
              field: nextFieldId,
              operator: nextOperator,
              value: valueStillValid
                ? node.value
                : (closedOptions?.[0] && !nextField?.allowCustomValue ? closedOptions[0].id : ''),
              valueKind: keepExpression && valueStillValid ? node.valueKind : 'literal',
              endValueKind: keepExpression && valueStillValid ? node.endValueKind : 'literal',
            });
          }}
        />
        <WhereMenuDropdown
          ariaLabel={labels.operator}
          selectedKey={node.operator}
          options={(fieldOperators.some((item) => item.id === node.operator)
            ? fieldOperators
            : [{ id: node.operator, label: node.operator }, ...fieldOperators]
          ).map((item) => ({ id: item.id, label: item.label }))}
          size={size}
          isDisabled={isDisabled}
          onSelectionChange={patchOperator}
        />
        <WhereValueControl
          type={type}
          arity={arity}
          value={node.value}
          valueKind={node.valueKind}
          endValueKind={node.endValueKind}
          size={size}
          isDisabled={isDisabled}
          isInvalid={isInvalid}
          contextItems={operatorContextItems}
          options={field.options}
          allowCustomValue={field.allowCustomValue}
          onChange={(next) => onPatch(next)}
        />
        </div>
        <div className="flex shrink-0 items-center gap-1 self-start">
          {allowManual ? (
            <CircleIconButton
              label={labels.switchManual}
              className={CIRCLE_MANUAL_CLASS}
              disabled={isDisabled}
              onClick={onSwitchManual}
            >
              <Code2 className="h-3.5 w-3.5" />
            </CircleIconButton>
          ) : null}
          <CircleIconButton label={labels.removeCondition} className={CIRCLE_DELETE_CLASS} disabled={isDisabled} onClick={onRemove}>
            <X className="h-3.5 w-3.5" />
          </CircleIconButton>
        </div>
    </div>
  );
};

const WhereManualRow: React.FC<{
  node: WhereManualNode;
  size: HeroUiFieldSize;
  stacked: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  onChange: (expression: string) => void;
  onRemove: () => void;
}> = ({ node, size, stacked, isDisabled, isInvalid, onChange, onRemove }) => {
  const labels = useWhereBuilderLabels();
  return (
  <div className={cn('flex min-w-0 items-start gap-2', stacked ? 'flex-col' : 'flex-row')}>
    <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
          {labels.manual}
        </span>
        <UiInput
          size={size}
          ariaLabel={labels.manualExpression}
          value={node.expression}
          isDisabled={isDisabled}
          isInvalid={isInvalid}
          autoDir={false}
          placeholder={labels.manualPlaceholder}
          className="font-mono"
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <div className="flex shrink-0 items-center gap-1 self-start">
        <CircleIconButton label={labels.removeCondition} className={CIRCLE_DELETE_CLASS} disabled={isDisabled} onClick={onRemove}>
        <X className="h-3.5 w-3.5" />
      </CircleIconButton>
    </div>
  </div>
  );
};

type WhereGroupViewProps = {
  node: WhereGroupNode;
  path: number[];
  depth: number;
  isRoot: boolean;
  fields: readonly WhereField[];
  operators: readonly WhereOperator[];
  density: 'compact' | 'default';
  allowNestedGroups: boolean;
  maxDepth: number;
  stacked: boolean;
  isDisabled?: boolean;
  invalidConditionId?: string;
  contextItems?: readonly WhereContextItem[];
  allowManualNodes: boolean;
  showTreeLines: boolean;
  showGroupBoxes: boolean;
  allowReorder: boolean;
  size: HeroUiFieldSize;
  onChange: (next: WhereGroupNode) => void;
  root: WhereGroupNode;
};

const WhereGroupView: React.FC<WhereGroupViewProps> = ({
  node,
  path,
  depth,
  isRoot,
  fields,
  operators,
  density,
  allowNestedGroups,
  maxDepth,
  stacked,
  isDisabled,
  invalidConditionId,
  contextItems,
  allowManualNodes,
  showTreeLines,
  showGroupBoxes,
  allowReorder,
  size,
  onChange,
  root,
}) => {
  const labels = useWhereBuilderLabels();
  const combinatorItems = useMemo(
    () => [
      { id: 'and', label: labels.combinatorAnd },
      { id: 'or', label: labels.combinatorOr },
    ],
    [labels.combinatorAnd, labels.combinatorOr],
  );
  const fallbackField = fields[0];
  const fallbackFieldId = fallbackField?.id ?? 'id';
  const fallbackValue = fallbackField?.options?.[0] && !fallbackField.allowCustomValue
    ? fallbackField.options[0].id
    : '';
  const canNest = allowNestedGroups && depth < maxDepth;
  const compact = density === 'compact';
  const addCondition = () => {
    onChange(addWhereChild(root, path, createWhereCondition(fallbackFieldId, 'eq', fallbackValue)));
  };
  const addGroup = () => {
    onChange(addWhereChild(root, path, createWhereGroup(node.op === 'and' ? 'or' : 'and', [
      createWhereCondition(fallbackFieldId, 'eq', fallbackValue),
    ])));
  };

  return (
    <div className={cn(
      'min-w-0',
      showGroupBoxes && [
        'rounded-md border bg-white',
        node.op === 'or' ? 'border-amber-200/80' : 'border-slate-200',
        compact ? 'p-2' : 'p-3',
      ],
    )}
    >
      <div className="flex flex-wrap items-center justify-start gap-2">
        <UiSegmentedControl
          ariaLabel={labels.combinatorAria}
          items={combinatorItems}
          selectedKey={node.op}
          isDisabled={isDisabled}
          onSelectionChange={(key) => {
            onChange(setWhereGroupOp(root, path, key === 'or' ? 'or' : 'and'));
          }}
        />
        <WhereAddControl
          canNest={canNest}
          isDisabled={isDisabled}
          onAddCondition={addCondition}
          onAddGroup={addGroup}
        />
        {!isRoot && allowManualNodes ? (
          <CircleIconButton
            label={labels.switchManual}
            className={CIRCLE_MANUAL_CLASS}
            disabled={isDisabled}
            onClick={() => onChange(switchWhereNodeToManual(root, path))}
          >
            <Code2 className="h-3.5 w-3.5" />
          </CircleIconButton>
        ) : null}
        {!isRoot ? (
          <CircleIconButton
            label={labels.removeGroup}
            className={CIRCLE_DELETE_CLASS}
            disabled={isDisabled}
            onClick={() => onChange(removeWhereNodeAt(root, path))}
          >
            <X className="h-3.5 w-3.5" />
          </CircleIconButton>
        ) : null}
      </div>

      {(() => {
        const emptyMessage = (
          <p className={cn(!allowReorder && 'mt-2', 'text-[11px] text-slate-500')}>
            {labels.emptyGroup}
          </p>
        );
        const renderChild = (child: typeof node.children[number], index: number) => {
          const childPath = [...path, index];
          if (child.kind === 'condition') {
            return (
              <WhereConditionRow
                node={child}
                fields={fields}
                operators={operators}
                size={size}
                stacked={stacked}
                isDisabled={isDisabled}
                isInvalid={invalidConditionId === child.id}
                contextItems={contextItems}
                allowManual={allowManualNodes}
                onPatch={(patch) => onChange(patchWhereCondition(root, childPath, patch))}
                onSwitchManual={() => onChange(switchWhereNodeToManual(root, childPath))}
                onRemove={() => onChange(removeWhereNodeAt(root, childPath))}
              />
            );
          }
          if (child.kind === 'manual') {
            return (
              <WhereManualRow
                node={child}
                size={size}
                stacked={stacked}
                isDisabled={isDisabled}
                isInvalid={invalidConditionId === child.id}
                onChange={(expression) => onChange(patchWhereManual(root, childPath, expression))}
                onRemove={() => onChange(removeWhereNodeAt(root, childPath))}
              />
            );
          }
          return (
            <WhereGroupView
              node={child}
              path={childPath}
              depth={depth + 1}
              isRoot={false}
              fields={fields}
              operators={operators}
              density={density}
              allowNestedGroups={allowNestedGroups}
              maxDepth={maxDepth}
              stacked={stacked}
              isDisabled={isDisabled}
              invalidConditionId={invalidConditionId}
              contextItems={contextItems}
              allowManualNodes={allowManualNodes}
              showTreeLines={showTreeLines}
              showGroupBoxes={showGroupBoxes}
              allowReorder={allowReorder}
              size={size}
              onChange={onChange}
              root={root}
            />
          );
        };
        const childrenList = node.children.map((child, index) => (
          allowReorder ? (
            <WhereSortableItem key={child.id} id={child.id} isDisabled={isDisabled}>
              {renderChild(child, index)}
            </WhereSortableItem>
          ) : (
            <div key={child.id} className="min-w-0">
              {renderChild(child, index)}
            </div>
          )
        ));
        const body = node.children.length === 0 ? emptyMessage : childrenList;
        if (allowReorder) {
          return (
            <WhereGroupDropZone
              groupId={node.id}
              childIds={node.children.map((child) => child.id)}
              compact={compact}
              showTreeLines={showTreeLines}
              empty={node.children.length === 0}
            >
              {body}
            </WhereGroupDropZone>
          );
        }
        if (node.children.length === 0) {
          return body;
        }
        return (
          <div className={cn(
            'relative',
            compact ? 'mt-2 space-y-2 ms-3 ps-3' : 'mt-3 space-y-2.5 ms-3 ps-4',
            showTreeLines && 'border-s border-slate-200',
          )}
          >
            {body}
          </div>
        );
      })()}
    </div>
  );
};

export const UiWhereBuilder: React.FC<UiWhereBuilderProps> = ({
  value,
  onChange,
  fields,
  operators = DEFAULT_WHERE_OPERATORS,
  density = 'default',
  allowNestedGroups = true,
  maxDepth = 3,
  isDisabled = false,
  showPreview = false,
  size = 'sm',
  invalidConditionId,
  contextItems,
  allowManualNodes = true,
  showTreeLines = true,
  showGroupBoxes = true,
  allowReorder = true,
  className,
  ariaLabel,
}) => {
  const t = useOptionalCultureT();
  const labels = useMemo(() => resolveWhereBuilderLabels(t), [t]);
  const localizedOperators = useMemo(
    () => localizeWhereOperators(operators, t),
    [operators, t],
  );
  const resolvedAriaLabel = ariaLabel ?? labels.whereClauseAria;
  const stacked = density === 'compact';
  const preview = showPreview ? formatWherePreview(value) : '';
  const dragEnabled = allowReorder && !isDisabled;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      return;
    }
    const next = moveWhereNodeByDrag(value, String(active.id), String(over.id), maxDepth);
    if (next !== value) {
      onChange(next);
    }
  }, [maxDepth, onChange, value]);

  const tree = (
    <WhereGroupView
      node={value}
      path={[]}
      depth={0}
      isRoot
      fields={fields}
      operators={localizedOperators}
      density={density}
      allowNestedGroups={allowNestedGroups}
      maxDepth={maxDepth}
      stacked={stacked}
      isDisabled={isDisabled}
      invalidConditionId={invalidConditionId}
      contextItems={contextItems}
      allowManualNodes={allowManualNodes}
      showTreeLines={showTreeLines}
      showGroupBoxes={showGroupBoxes}
      allowReorder={dragEnabled}
      size={size}
      onChange={onChange}
      root={value}
    />
  );

  return (
    <WhereBuilderLabelsProvider labels={labels}>
      <div
        className={cn('min-w-0', className)}
        role="group"
        aria-label={resolvedAriaLabel}
        aria-disabled={isDisabled || undefined}
      >
        {dragEnabled ? (
          <DndContext
            sensors={sensors}
            collisionDetection={whereCollisionDetection}
            onDragEnd={handleDragEnd}
          >
            {tree}
          </DndContext>
        ) : tree}
        {showPreview ? (
          <p className="mt-3 font-mono text-[11px] leading-relaxed text-slate-500">
            {preview}
          </p>
        ) : null}
      </div>
    </WhereBuilderLabelsProvider>
  );
};
