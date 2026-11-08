import React, { useMemo } from 'react';
import { CheckCircle2, Hourglass, Pencil, Plus, Settings, Trash2, Webhook } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { ServerFunctionItem } from '../../../shared/api/contracts/server-functions/types';
import { isPackageServerFunction } from '../../../shared/api/contracts/server-functions/packageFunctions';
import type { EdgeApiDefinition } from '../../../shared/api/contracts/data-api';
import {
  useEdgeApiDefinitionsQuery,
  useEdgeModelsQuery,
} from '../../../shared/api/queries/data-api';
import { useServerFunctionsCatalogQuery } from '../../../shared/api/queries/server-functions';
import {
  ACCESS_CONTROL_ACTION_ARIA_LABEL,
  AccessControlActionIcon,
  AppButton,
  buildSideHintContent,
  FormSection,
  HOOKS_ACTION_ARIA_LABEL,
  NativeButton,
  SideHintTooltip,
} from '../../../shared/ui';
import {
  GRID_ACTION_ACCESS_CLASS,
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_CANCEL_CLASS,
  ICON_ACTION_EDIT_CLASS,
  ICON_ACTION_VIEW_CLASS,
} from '../../../shared/ui/surfaceClasses';
import { METHOD_BADGE_WIDTH_CLASS } from '../lib/dataApiRouteMethods';
import { listModelerApisForObject, type ModelerApiOperationRow } from '../lib/modelerApis';
import {
  MODELER_CAPTION_CLASS,
  MODELER_CARD_SURFACE_CLASS,
  MODELER_EMPTY_STATE_CLASS,
  MODELER_NEUTRAL_ICON_CLASS,
} from '../lib/modelerChipStyles';
import { ModelerInspectorListPreview } from './ModelerInspectorListPreview';

type EdgeModelModelerApisSectionProps = {
  modelId: string;
  objectName: string;
  onCreateApi: () => void;
  onEditApi: (definitionId: string, options?: { initialTab?: 'access' | 'hooks' | 'runtime'; openAccessModal?: boolean; openHooksModal?: boolean }) => void;
  onEditFunctionApi: (fn: ServerFunctionItem, mode?: 'settings' | 'access' | 'hooks') => void;
  onDeleteApi: (definition: EdgeApiDefinition) => void;
};

const METHOD_PILL_CLASS: Record<string, string> = {
  GET: 'border-slate-200 bg-slate-50 text-slate-700',
  POST: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  PUT: 'border-amber-200 bg-amber-50 text-amber-800',
  PATCH: 'border-amber-200 bg-amber-50 text-amber-800',
  DELETE: 'border-rose-200 bg-rose-50 text-rose-800',
};

/** Clip the start of long routes so the trailing segment stays visible. */
const MODELER_API_PATH_CLASS = cn(
  'min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left',
  'font-mono text-[11px] text-slate-700',
);

const ModelerApiPublishIndicator: React.FC<{ row: ModelerApiOperationRow }> = ({ row }) => {
  if (row.source !== 'data-api') {
    return <span className="inline-flex w-3.5 shrink-0" aria-hidden="true" />;
  }

  const isPublished = Boolean(row.definition?.publishedAt);

  if (isPublished) {
    return (
      <SideHintTooltip
        placement="left"
        content={buildSideHintContent(
          'Published',
          'This route is live and callable with the access rules you configured.',
          'emerald',
        )}
        className="inline-flex w-3.5 shrink-0 items-center justify-center"
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
      </SideHintTooltip>
    );
  }

  return (
    <SideHintTooltip
      placement="left"
      content={buildSideHintContent(
        'Draft',
        'Open the API designer and publish to activate this route.',
        'amber',
      )}
      className="inline-flex w-3.5 shrink-0 items-center justify-center"
    >
      <Hourglass className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
    </SideHintTooltip>
  );
};

export const EdgeModelModelerApisSection: React.FC<EdgeModelModelerApisSectionProps> = ({
  modelId,
  objectName,
  onCreateApi,
  onEditApi,
  onEditFunctionApi,
  onDeleteApi,
}) => {
  const definitionsQuery = useEdgeApiDefinitionsQuery();
  const modelsQuery = useEdgeModelsQuery();
  const functionsQuery = useServerFunctionsCatalogQuery();

  const modelApis = useMemo(
    () => listModelerApisForObject(
      objectName,
      modelId,
      definitionsQuery.data ?? [],
      modelsQuery.data ?? [],
      functionsQuery.data?.functions ?? [],
    ),
    [
      definitionsQuery.data,
      functionsQuery.data?.functions,
      modelId,
      modelsQuery.data,
      objectName,
    ],
  );

  const isLoading = (
    definitionsQuery.isLoading
    || modelsQuery.isLoading
    || functionsQuery.isLoading
  );

  return (
    <FormSection
      title="APIs"
      ink="contrast"
      divided
      hint="Platform routes, built-in functions, and published Data APIs for this model."
      headerExtra={(
        <AppButton
          intent="create"
          size="sm"
          onClick={onCreateApi}
        >
          <Plus className="h-3.5 w-3.5" />
          Create API
        </AppButton>
      )}
    >
      {isLoading && modelApis.length === 0 ? (
        <p className={cn('ps-[4px]', MODELER_CAPTION_CLASS)}>Loading APIs…</p>
      ) : null}

      {!isLoading && modelApis.length === 0 ? (
        <button
          type="button"
          className={MODELER_EMPTY_STATE_CLASS}
          onClick={onCreateApi}
        >
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
            <Plus className={cn('h-3.5 w-3.5', MODELER_NEUTRAL_ICON_CLASS)} aria-hidden="true" />
            No APIs yet
          </span>
          <span className={cn('ps-[4px]', MODELER_CAPTION_CLASS)}>
            Create an API to expose this model.
          </span>
        </button>
      ) : null}

      {modelApis.length > 0 ? (
        <ModelerInspectorListPreview key={modelId} items={modelApis}>
          {(visible) => (
            <div className={cn(MODELER_CARD_SURFACE_CLASS, 'overflow-hidden')}>
              <div className="divide-y divide-slate-100">
                {visible.map((row) => {
                  const canEdit = Boolean(row.definition || row.function);
                  const handleOpenEditor = () => {
                    if (row.definition) {
                      onEditApi(row.definition.id);
                      return;
                    }
                    if (row.function) {
                      onEditFunctionApi(row.function);
                    }
                  };
                  const rowBody = (
                    <>
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center justify-center rounded border px-1 py-px text-center text-[10px] font-semibold uppercase tracking-wide',
                          METHOD_BADGE_WIDTH_CLASS,
                          METHOD_PILL_CLASS[row.method] ?? METHOD_PILL_CLASS.GET,
                        )}
                      >
                        {row.method}
                      </span>
                      {row.source === 'platform' ? (
                        <span className="inline-flex shrink-0 rounded border border-indigo-200 bg-indigo-50 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-indigo-800">
                          Platform
                        </span>
                      ) : null}
                      {row.source === 'function' ? (
                        <span className="inline-flex shrink-0 rounded border border-slate-200 bg-slate-50 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                          Built-in
                        </span>
                      ) : null}
                      {row.source === 'data-api' && row.definition?.operations.some((operation) => operation.bypassRecordPolicy) ? (
                        <span className="inline-flex shrink-0 rounded border border-amber-200 bg-amber-50 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                          Skip scope
                        </span>
                      ) : null}
                      <span dir="rtl" className={MODELER_API_PATH_CLASS}>
                        {row.path}
                      </span>
                    </>
                  );
                  const rowActions = row.definition || row.function ? (
                      <div
                        className={cn(
                          'pointer-events-none absolute inset-y-0 end-0 z-10 flex items-center pe-1',
                          'opacity-0 transition-opacity',
                          'group-hover/api-row:pointer-events-auto group-hover/api-row:opacity-100',
                          'group-focus-within/api-row:pointer-events-auto group-focus-within/api-row:opacity-100',
                        )}
                      >
                        <div
                          className={cn(
                            'pointer-events-none absolute inset-y-0 end-0 w-[5.5rem]',
                            'bg-gradient-to-l from-white from-55% to-transparent',
                            'group-hover/api-row:from-slate-50/95 group-focus-within/api-row:from-slate-50/95',
                          )}
                          aria-hidden="true"
                        />
                        <div className="relative flex items-center gap-0.5 ps-5">
                        {row.function ? (
                          <>
                            <NativeButton
                              type="button"
                              aria-label={`Settings for ${row.label}`}
                              title="Settings"
                              className={cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_EDIT_CLASS)}
                              onClick={() => onEditFunctionApi(row.function!, 'settings')}
                            >
                              <Settings className="h-3 w-3" />
                            </NativeButton>
                            {!isPackageServerFunction(row.function) ? (
                              <>
                                <NativeButton
                                  type="button"
                                  aria-label={`${ACCESS_CONTROL_ACTION_ARIA_LABEL} for ${row.label}`}
                                  title="Access"
                                  className={cn(ICON_ACTION_BUTTON_SM_CLASS, GRID_ACTION_ACCESS_CLASS)}
                                  onClick={() => onEditFunctionApi(row.function!, 'access')}
                                >
                                  <AccessControlActionIcon className="h-3 w-3" />
                                </NativeButton>
                                <NativeButton
                                  type="button"
                                  aria-label={`${HOOKS_ACTION_ARIA_LABEL} for ${row.label}`}
                                  title="Hooks"
                                  className={cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_VIEW_CLASS)}
                                  onClick={() => onEditFunctionApi(row.function!, 'hooks')}
                                >
                                  <Webhook className="h-3 w-3" />
                                </NativeButton>
                              </>
                            ) : null}
                          </>
                        ) : null}
                        {row.definition ? (
                          <>
                            <NativeButton
                              type="button"
                              aria-label={`Edit ${row.label}`}
                              title="Edit API"
                              className={ICON_ACTION_BUTTON_SM_CLASS}
                              onClick={() => onEditApi(row.definition!.id)}
                            >
                              <Pencil className="h-3 w-3" />
                            </NativeButton>
                            <NativeButton
                              type="button"
                              aria-label={`${ACCESS_CONTROL_ACTION_ARIA_LABEL} for ${row.label}`}
                              title="Access"
                              className={cn(ICON_ACTION_BUTTON_SM_CLASS, GRID_ACTION_ACCESS_CLASS)}
                              onClick={() => onEditApi(row.definition!.id, {
                                initialTab: 'access',
                                openAccessModal: true,
                              })}
                            >
                              <AccessControlActionIcon className="h-3 w-3" />
                            </NativeButton>
                            <NativeButton
                              type="button"
                              aria-label={`${HOOKS_ACTION_ARIA_LABEL} for ${row.label}`}
                              title="Hooks"
                              className={cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_VIEW_CLASS)}
                              onClick={() => onEditApi(row.definition!.id, {
                                initialTab: 'hooks',
                                openHooksModal: true,
                              })}
                            >
                              <Webhook className="h-3 w-3" />
                            </NativeButton>
                            <NativeButton
                              type="button"
                              aria-label={`Delete ${row.label}`}
                              title="Delete API"
                              className={cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_CANCEL_CLASS)}
                              onClick={() => onDeleteApi(row.definition!)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </NativeButton>
                          </>
                        ) : null}
                        </div>
                      </div>
                  ) : null;
                  return (
                  <div
                    key={row.id}
                    className="group/api-row relative flex min-h-9 min-w-0 items-center gap-1.5 px-3 py-1.5 transition-colors hover:bg-slate-50/80"
                  >
                    <ModelerApiPublishIndicator row={row} />
                    {canEdit ? (
                      <button
                        type="button"
                        aria-label={`Edit ${row.label}`}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-start"
                        onClick={handleOpenEditor}
                      >
                        {rowBody}
                      </button>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        {rowBody}
                      </div>
                    )}
                    {rowActions}
                  </div>
                  );
                })}
              </div>
            </div>
          )}
        </ModelerInspectorListPreview>
      ) : null}
    </FormSection>
  );
};
