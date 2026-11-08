import React from 'react';
import {
  CRUD_SET_DEFAULT_PAGING,
  CRUD_SET_DEFAULT_SORTING,
  type CrudSetGridColumn,
  type CrudSetListBodyKind,
  type CrudSetPagingConfig,
  type CrudSetSortingConfig,
} from '../../../domain/component-designer/crudSetSpec';
import { CrudSetPagingFields, CrudSetSortingFields, FormField, FormSection, UiSelect } from '../../../shared/ui';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
} from '../baseComponentsConfiguratorLayout';
import { markBaseComponentsConfigSectionSource } from './baseComponentsConfigSectionSource';

export type BaseComponentsCrudSetPagingFieldsProps = {
  listBody: CrudSetListBodyKind;
  pagination: boolean;
  paging: CrudSetPagingConfig;
  sorting: CrudSetSortingConfig;
  columns: readonly CrudSetGridColumn[];
  onPaginationChange: (enabled: boolean) => void;
  onPagingChange: (next: CrudSetPagingConfig) => void;
  onSortingChange: (next: CrudSetSortingConfig) => void;
};

/** CRUD Set paging + sort defaults accordion section — mirrors Grid → Paging in the living sample. */
export const BaseComponentsCrudSetPagingFields: React.FC<BaseComponentsCrudSetPagingFieldsProps> = ({
  listBody,
  pagination,
  paging,
  sorting,
  columns,
  onPaginationChange,
  onPagingChange,
  onSortingChange,
}) => {
  const pagedBody = listBody === 'grid' || listBody === 'kanban';
  const resolvedPaging = paging ?? CRUD_SET_DEFAULT_PAGING;
  const resolvedSorting = sorting ?? CRUD_SET_DEFAULT_SORTING;

  return (
    <FormSection title="Paging" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
      <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
        {pagedBody ? (
          <>
            <FormField label="Paging" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
              <UiSelect
                size="sm"
                className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                value={pagination ? 'on' : 'off'}
                onChange={(event) => onPaginationChange(event.target.value === 'on')}
                ariaLabel="CRUD Set paging"
              >
                <option value="on">on</option>
                <option value="off">off</option>
              </UiSelect>
            </FormField>
            {pagination ? (
              <CrudSetPagingFields
                paging={resolvedPaging}
                onChange={onPagingChange}
                footerSort={{
                  enabled: resolvedSorting.footer !== false,
                  onChange: (checked) => onSortingChange({ ...resolvedSorting, footer: checked }),
                }}
                fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
              />
            ) : (
              <p className="text-[11px] leading-snug text-slate-500">
                Off shows the full queried set with no paging footer.
              </p>
            )}
          </>
        ) : (
          <p className="text-[11px] leading-snug text-slate-500">
            {listBody === 'tree-grid' ? 'Tree-grid is never paged.' : 'Map is never paged.'}
          </p>
        )}
        <CrudSetSortingFields
          sorting={resolvedSorting}
          columns={columns}
          showFooter={pagedBody && pagination}
          onChange={onSortingChange}
          fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
          selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
        />
      </div>
    </FormSection>
  );
};

markBaseComponentsConfigSectionSource(BaseComponentsCrudSetPagingFields);
