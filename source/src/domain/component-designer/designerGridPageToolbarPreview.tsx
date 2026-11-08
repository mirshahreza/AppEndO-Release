import * as React from 'react';
import { cn } from '../../lib/utils';
import {
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
  TOOLBAR_SEARCH_INPUT_HOST_CLASS,
} from '../../shared/ui';
import {
  resolveEffectiveFieldFilters,
  resolveFieldFilterStaticOptions,
  type DesignerGridToolbarConfig,
} from './designerGridToolbarConfig';
import { resolveDesignerGridActionIcon } from './designerGridActionColumns';
import { AppButton } from '../../shared/ui/AppButton';

type DesignerGridPageToolbarPreviewProps = {
  config: DesignerGridToolbarConfig;
};

/**
 * Read-only toolbar chrome for design canvas — avoids interactive controls that can
 * destabilize the designer while API-bound grids are hydrating.
 */
export const DesignerGridPageToolbarPreview: React.FC<DesignerGridPageToolbarPreviewProps> = ({
  config,
}) => {
  const search = config.search;
  const fieldFilters = resolveEffectiveFieldFilters(config);
  const create = config.create;
  const refresh = config.refresh;
  const serverQuery = config.serverQuery;
  const CreateIcon = resolveDesignerGridActionIcon(create?.icon ?? 'Plus');
  const hasEmptyCheckboxFilter = fieldFilters.some((filter) => (
    filter.controlType === 'checkbox-group' && resolveFieldFilterStaticOptions(filter).length === 0
  ));

  return (
    <div
      className={`${PAGE_TOOLBAR_SINGLE_ROW_CLASS} pointer-events-none select-none justify-between opacity-95`}
      aria-hidden="true"
      data-testid="designer-grid-toolbar-preview"
    >
      <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
        {search?.enabled ? (
          <div
            className={TOOLBAR_SEARCH_INPUT_HOST_CLASS}
            data-testid="designer-grid-toolbar-preview-search"
          >
            <div className="toolbar-page-search-input flex h-8 w-full items-center rounded-lg border border-slate-200 bg-slate-50 ps-8 pe-3 text-start text-xs font-medium text-slate-500">
              {search.placeholder ?? '…'}
            </div>
          </div>
        ) : null}

        {fieldFilters.map((filter) => {
          const options = resolveFieldFilterStaticOptions(filter);
          if (options.length === 0) {
            return null;
          }
          if (filter.controlType === 'checkbox-group') {
            return (
              <div
                key={filter.id}
                className={cn(PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS, 'bg-slate-50 text-slate-600')}
                data-testid={`designer-grid-toolbar-preview-field-filter-${filter.id}`}
              >
                <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                  {(filter.matchLogic ?? 'or').toUpperCase()}
                </span>
                <span className="h-4 w-px shrink-0 bg-slate-200" aria-hidden />
                {options.map((option) => (
                  <span key={option.value} className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-4 w-4 rounded border border-slate-300 bg-white" />
                    {option.label}
                  </span>
                ))}
              </div>
            );
          }
          if (filter.controlType === 'select') {
            return (
              <div
                key={filter.id}
                className="inline-flex h-8 min-w-[9rem] max-w-[12rem] items-center rounded-[6px] border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-600"
                data-testid={`designer-grid-toolbar-preview-field-filter-${filter.id}`}
              >
                <span className="truncate">{filter.label}: All</span>
              </div>
            );
          }
          return (
            <div
              key={filter.id}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-600"
              data-testid={`designer-grid-toolbar-preview-field-filter-${filter.id}`}
            >
              <span className="font-semibold">{filter.label}:</span>
              {options.map((option) => option.label).join(' / ')}
            </div>
          );
        })}

        {hasEmptyCheckboxFilter || (config.roleFilters?.enabled && fieldFilters.length === 0) ? (
          <span
            className="rounded-md border border-dashed border-slate-200 px-2 py-1 text-[10px] text-slate-500"
            data-testid="designer-grid-toolbar-preview-role-filters-empty"
          >
            Add filter options in inspector
          </span>
        ) : null}

        {/* Keep legacy test id when a roles checkbox filter is present */}
        {fieldFilters.some((filter) => filter.field === 'roles' || filter.id === 'roles') ? (
          <span className="sr-only" data-testid="designer-grid-toolbar-preview-role-filters">Roles</span>
        ) : null}

        {serverQuery?.enabled ? (
          <span
            className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-medium text-sky-700"
            data-testid="designer-grid-toolbar-preview-server-query"
          >
            API sync on
          </span>
        ) : null}
      </div>

      <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
        {create?.enabled ? (
          <AppButton
            type="button"
            intent="secondary"
            size="icon-md"
            disabled
            tabIndex={-1}
            aria-label={create.label ?? 'Add'}
            title={create.label ?? 'Add'}
          >
            <CreateIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </AppButton>
        ) : null}
        {refresh?.enabled ? (
          <AppButton
            type="button"
            intent="utility"
            size="icon-md"
            disabled
            tabIndex={-1}
            aria-label="Refresh preview"
            data-testid="designer-grid-toolbar-preview-refresh"
          >
            <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />
          </AppButton>
        ) : null}
        {(config.export?.enabled === true || config.showExportButton === true) ? (
          <AppButton
            type="button"
            intent="utility"
            size="sm"
            disabled
            tabIndex={-1}
            aria-label="Export preview"
            data-testid="designer-grid-toolbar-preview-export"
          >
            Export
          </AppButton>
        ) : null}
      </div>
    </div>
  );
};
