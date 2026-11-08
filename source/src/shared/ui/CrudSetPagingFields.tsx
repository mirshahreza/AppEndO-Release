import React from 'react';
import {
  CRUD_SET_LIST_MODE_LABELS,
  CRUD_SET_LIST_MODES,
  CRUD_SET_PAGE_SIZES,
  CRUD_SET_PAGING_PATTERN_LABELS,
  CRUD_SET_PAGING_PATTERNS,
  crudSetPagingDefaultListMode,
  crudSetPagingDefaultPageSize,
  crudSetPagingFirstLastEnabled,
  crudSetPagingListModeSwitchEnabled,
  crudSetPagingPageSizes,
  crudSetPagingPattern,
  crudSetPagingSummaryEnabled,
  isCrudSetListMode,
  isCrudSetPageSize,
  isCrudSetPagingPattern,
  type CrudSetPagingConfig,
} from '../../domain/component-designer/crudSetSpec';
import { FormField } from './FormSection';
import { CrudSetConfigCheckbox } from './CrudSetConfigCheckbox';
import { parseUiSelectCsvValue, UiSelect } from './HeroFieldControls';

export type CrudSetPagingFooterSortConfig = {
  enabled: boolean;
  onChange: (checked: boolean) => void;
};

export type CrudSetPagingFieldsProps = {
  paging: CrudSetPagingConfig;
  onChange: (next: CrudSetPagingConfig) => void;
  footerSort?: CrudSetPagingFooterSortConfig;
  fieldClassName?: string;
  selectClassName?: string;
};

/** Paging footer chrome for the CRUD Set wizard and Base Components living sample. */
export const CrudSetPagingFields: React.FC<CrudSetPagingFieldsProps> = ({
  paging,
  onChange,
  footerSort,
  fieldClassName,
  selectClassName,
}) => {
  const spec = { paging };
  const pattern = crudSetPagingPattern(spec);
  const pageSizes = crudSetPagingPageSizes(spec);
  const defaultPageSize = crudSetPagingDefaultPageSize(spec);
  const listModeSwitch = crudSetPagingListModeSwitchEnabled(spec);
  const defaultListMode = crudSetPagingDefaultListMode(spec);
  const patch = (partial: Partial<CrudSetPagingConfig>) => onChange({ ...paging, ...partial });

  return (
    <>
      <FormField label="Paging pattern" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={pattern}
          onChange={(event) => {
            const next = event.target.value;
            if (isCrudSetPagingPattern(next)) {
              patch({ pattern: next });
            }
          }}
          ariaLabel="CRUD Set paging pattern"
        >
          {CRUD_SET_PAGING_PATTERNS.map((item) => (
            <option key={item} value={item}>{CRUD_SET_PAGING_PATTERN_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField label="Page sizes" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          multiple
          className={selectClassName}
          value={pageSizes.join(',')}
          onChange={(event) => {
            const selected = parseUiSelectCsvValue(event.target.value)
              .map((item) => Number(item))
              .filter(isCrudSetPageSize);
            const nextSizes = CRUD_SET_PAGE_SIZES.filter((size) => selected.includes(size));
            if (nextSizes.length === 0) {
              return;
            }
            patch({
              pageSizes: nextSizes,
              defaultPageSize: nextSizes.includes(defaultPageSize) ? defaultPageSize : nextSizes[0],
            });
          }}
          ariaLabel="CRUD Set page sizes"
        >
          {CRUD_SET_PAGE_SIZES.map((size) => (
            <option key={size} value={String(size)}>{size}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField label="Default page size" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={String(defaultPageSize)}
          onChange={(event) => patch({ defaultPageSize: Number(event.target.value) })}
          ariaLabel="CRUD Set default page size"
        >
          {pageSizes.map((size) => (
            <option key={size} value={String(size)}>{size}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField label="Default list mode" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={defaultListMode}
          onChange={(event) => {
            const next = event.target.value;
            if (isCrudSetListMode(next)) {
              patch({ defaultListMode: next });
            }
          }}
          ariaLabel="CRUD Set default list mode"
        >
          {CRUD_SET_LIST_MODES.map((item) => (
            <option key={item} value={item}>{CRUD_SET_LIST_MODE_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
      <CrudSetConfigCheckbox
        label="Range summary"
        checked={crudSetPagingSummaryEnabled(spec)}
        fieldClassName={fieldClassName}
        selectClassName={selectClassName}
        onChange={(checked) => patch({ summary: checked })}
      />
      {pattern === 'numbered' ? (
        <CrudSetConfigCheckbox
          label="First/last"
          checked={crudSetPagingFirstLastEnabled(spec)}
          fieldClassName={fieldClassName}
          selectClassName={selectClassName}
          onChange={(checked) => patch({ firstLast: checked })}
        />
      ) : null}
      <CrudSetConfigCheckbox
        label="List mode switch"
        checked={listModeSwitch}
        fieldClassName={fieldClassName}
        selectClassName={selectClassName}
        onChange={(checked) => patch({ listModeSwitch: checked })}
      />
      {footerSort ? (
        <CrudSetConfigCheckbox
          label="Footer sort"
          checked={footerSort.enabled}
          fieldClassName={fieldClassName}
          selectClassName={selectClassName}
          onChange={footerSort.onChange}
        />
      ) : null}
    </>
  );
};
