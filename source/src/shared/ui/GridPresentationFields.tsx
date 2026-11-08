import React from 'react';
import type { GridCardBelowTier, GridPresentationMode } from '../lib/appTableGridPresentation';
import { gridTabletTierUsesCardGrid } from '../lib/appTableGridPresentation';
import type { GridCompactCardsPerRow } from '../lib/gridCompactViewport';
import type {
  GridPresentationFieldsConfig,
  GridPresentationInheritLayout,
  GridPresentationTriState,
  GridRowActionsFieldsConfig,
} from '../lib/gridPresentationConfigBridge';
import { FormField, FormSection } from './FormSection';
import { UiSelect } from './HeroFieldControls';

export type {
  GridPresentationFieldsConfig,
  GridPresentationInheritLayout,
  GridPresentationTriState,
  GridRowActionsFieldsConfig,
} from '../lib/gridPresentationConfigBridge';

export type GridPresentationFieldsChrome = {
  fieldClassName?: string;
  selectClassName?: string;
  fieldsStackClassName?: string;
  sectionTone?: 'default' | 'muted';
  useSections?: boolean;
};

type GridPresentationFieldsProps = {
  variant?: 'grid' | 'tree';
  config: GridPresentationFieldsConfig;
  onChange: (patch: Partial<GridPresentationFieldsConfig>) => void;
  showPresentation?: boolean;
  showCompact?: boolean;
  chrome?: GridPresentationFieldsChrome;
};

const DEFAULT_FIELD_CLASS = 'min-w-0';
const DEFAULT_SELECT_CLASS = 'w-full';
const DEFAULT_STACK_CLASS = 'flex flex-col gap-2';

const PRESENTATION_OPTIONS: ReadonlyArray<{ value: GridPresentationMode; label: string }> = [
  { value: 'table', label: 'table (keep grid)' },
  { value: 'auto', label: 'auto' },
  { value: 'cards', label: 'cards' },
  { value: 'table-scroll', label: 'table scroll' },
];

const COMPACT_LAYOUT_OPTIONS: ReadonlyArray<{ value: GridPresentationInheritLayout; label: string }> = [
  { value: 'inherit', label: 'inherit' },
  { value: 'keep-table', label: 'keep table' },
  { value: 'table-scroll', label: 'table scroll' },
  { value: 'cards', label: 'cards' },
];

function FieldStack({
  children,
  chrome,
}: {
  children: React.ReactNode;
  chrome: GridPresentationFieldsChrome;
}) {
  if (chrome.useSections === false) {
    return <>{children}</>;
  }
  return <div className={chrome.fieldsStackClassName ?? DEFAULT_STACK_CLASS}>{children}</div>;
}

export const GridPresentationFields: React.FC<GridPresentationFieldsProps> = ({
  variant = 'grid',
  config,
  onChange,
  showPresentation = true,
  showCompact = true,
  chrome = {},
}) => {
  const fieldClassName = chrome.fieldClassName ?? DEFAULT_FIELD_CLASS;
  const selectClassName = chrome.selectClassName ?? DEFAULT_SELECT_CLASS;
  const sectionTone = chrome.sectionTone ?? 'default';
  const presentationOptions = variant === 'tree'
    ? PRESENTATION_OPTIONS.filter((option) => option.value !== 'table-scroll')
    : PRESENTATION_OPTIONS;
  const layoutOptions = variant === 'tree'
    ? COMPACT_LAYOUT_OPTIONS.filter((option) => option.value !== 'table-scroll')
    : COMPACT_LAYOUT_OPTIONS;
  const presentationValue = variant === 'tree' && config.presentation === 'table-scroll'
    ? 'table'
    : config.presentation;

  const showTabletCardsPerRow = variant === 'grid'
    && gridTabletTierUsesCardGrid({
      presentation: config.presentation,
      cardBelow: config.cardBelow,
      compactTabletLayout: config.compactTabletLayout,
    });

  const presentationFields = (
    <FieldStack chrome={chrome}>
      <FormField label="Presentation" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={presentationValue}
          onChange={(event) => onChange({ presentation: event.target.value as GridPresentationMode })}
          ariaLabel="Presentation"
        >
          {presentationOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField label="Card view from" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={config.cardBelow}
          onChange={(event) => onChange({
            cardBelow: event.target.value as GridCardBelowTier,
          })}
          ariaLabel="Card view from viewport"
        >
          <option value="phone">phone</option>
          <option value="tablet">tablet</option>
          <option value="desktop">desktop (all sizes)</option>
        </UiSelect>
      </FormField>
    </FieldStack>
  );

  const compactFields = (
    <FieldStack chrome={chrome}>
      <FormField label="Phone layout" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={config.compactPhoneLayout}
          onChange={(event) => onChange({
            compactPhoneLayout: event.target.value as GridPresentationInheritLayout,
          })}
          ariaLabel="Phone compact layout"
        >
          {layoutOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField label="Tablet layout" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={config.compactTabletLayout}
          onChange={(event) => onChange({
            compactTabletLayout: event.target.value as GridPresentationInheritLayout,
          })}
          ariaLabel="Tablet compact layout"
        >
          {layoutOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </UiSelect>
      </FormField>
      {showTabletCardsPerRow ? (
        <FormField
          label="Tablet cards per row"
          className={fieldClassName}
          reserveHintSlot={false}
          hint="Applies when tablet uses card layout (auto + card from tablet, presentation cards, or tablet layout cards). Phone stays 1 per row."
        >
          <UiSelect
            size="sm"
            className={selectClassName}
            value={String(config.compactTabletCardsPerRow ?? 2)}
            onChange={(event) => onChange({
              compactTabletCardsPerRow: Number(event.target.value) as GridCompactCardsPerRow,
            })}
            ariaLabel="Tablet cards per row"
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </UiSelect>
        </FormField>
      ) : null}
      {variant === 'grid' ? (
        <FormField label="Freeze first column" className={fieldClassName} reserveHintSlot={false}>
          <UiSelect
            size="sm"
            className={selectClassName}
            value={config.compactFreezeFirstColumn ?? 'inherit'}
            onChange={(event) => onChange({
              compactFreezeFirstColumn: event.target.value as GridPresentationTriState,
            })}
            ariaLabel="Freeze first column"
          >
            <option value="inherit">auto</option>
            <option value="on">on</option>
            <option value="off">off</option>
          </UiSelect>
        </FormField>
      ) : null}
      <FormField label="Collapse extra fields" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={config.compactCollapseExtraFields ? 'yes' : 'no'}
          onChange={(event) => onChange({
            compactCollapseExtraFields: event.target.value === 'yes',
          })}
          ariaLabel="Collapse extra card fields"
        >
          <option value="no">show all</option>
          <option value="yes">more control</option>
        </UiSelect>
      </FormField>
      {config.compactCollapseExtraFields ? (
        <FormField label="Visible fields" className={fieldClassName} reserveHintSlot={false}>
          <UiSelect
            size="sm"
            className={selectClassName}
            value={String(config.compactVisibleFieldCount ?? 3)}
            onChange={(event) => onChange({
              compactVisibleFieldCount: Number(event.target.value),
            })}
            ariaLabel="Visible card field count"
          >
            {[1, 2, 3, 4, 5, 6].map((count) => (
              <option key={count} value={String(count)}>{count}</option>
            ))}
          </UiSelect>
        </FormField>
      ) : null}
      <FormField label="Card actions" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={config.compactShowActions ? 'yes' : 'no'}
          onChange={(event) => onChange({
            compactShowActions: event.target.value === 'yes',
          })}
          ariaLabel="Card actions"
        >
          <option value="yes">show (footer)</option>
          <option value="no">hide</option>
        </UiSelect>
      </FormField>
      {variant === 'grid' ? (
        <FormField label="Card meta" className={fieldClassName} reserveHintSlot={false}>
          <UiSelect
            size="sm"
            className={selectClassName}
            value={config.compactShowMeta ? 'yes' : 'no'}
            onChange={(event) => onChange({
              compactShowMeta: event.target.value === 'yes',
            })}
            ariaLabel="Show card meta"
          >
            <option value="yes">show</option>
            <option value="no">hide</option>
          </UiSelect>
        </FormField>
      ) : null}
    </FieldStack>
  );

  return (
    <>
      {showPresentation ? (
        chrome.useSections === false ? presentationFields : (
          <FormSection title="Presentation" tone={sectionTone}>
            {presentationFields}
          </FormSection>
        )
      ) : null}
      {showCompact ? (
        chrome.useSections === false ? compactFields : (
          <FormSection title="Compact viewport" tone={sectionTone}>
            {compactFields}
          </FormSection>
        )
      ) : null}
    </>
  );
};

type GridRowActionsFieldsProps = {
  config: GridRowActionsFieldsConfig;
  onChange: (patch: Partial<GridRowActionsFieldsConfig>) => void;
  chrome?: GridPresentationFieldsChrome;
};

export const GridRowActionsFields: React.FC<GridRowActionsFieldsProps> = ({
  config,
  onChange,
  chrome = {},
}) => {
  const fieldClassName = chrome.fieldClassName ?? DEFAULT_FIELD_CLASS;
  const selectClassName = chrome.selectClassName ?? DEFAULT_SELECT_CLASS;

  return (
    <>
      <FormField label="Row actions" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={config.rowActions ? 'yes' : 'no'}
          onChange={(event) => onChange({ rowActions: event.target.value === 'yes' })}
          ariaLabel="Row actions"
        >
          <option value="yes">show</option>
          <option value="no">hide</option>
        </UiSelect>
      </FormField>
      {config.rowActions ? (
        <FormField label="Visible action icons" className={fieldClassName} reserveHintSlot={false}>
          <UiSelect
            size="sm"
            className={selectClassName}
            value={String(config.maxVisibleActions)}
            onChange={(event) => onChange({ maxVisibleActions: Number(event.target.value) })}
            ariaLabel="Visible action icon count"
          >
            {[1, 2, 3, 4, 5].map((count) => (
              <option key={count} value={String(count)}>{count}</option>
            ))}
          </UiSelect>
        </FormField>
      ) : null}
    </>
  );
};

export function GridHeightField({
  fillHeight,
  onChange,
  ariaLabel = 'Height',
  fieldClassName = DEFAULT_FIELD_CLASS,
  selectClassName = DEFAULT_SELECT_CLASS,
}: {
  fillHeight: boolean;
  onChange: (fillHeight: boolean) => void;
  ariaLabel?: string;
  fieldClassName?: string;
  selectClassName?: string;
}) {
  return (
    <FormField label="Height" className={fieldClassName} reserveHintSlot={false}>
      <UiSelect
        size="sm"
        className={selectClassName}
        value={fillHeight ? 'fill' : 'content'}
        onChange={(event) => onChange(event.target.value === 'fill')}
        ariaLabel={ariaLabel}
      >
        <option value="fill">100%</option>
        <option value="content">content</option>
      </UiSelect>
    </FormField>
  );
}
