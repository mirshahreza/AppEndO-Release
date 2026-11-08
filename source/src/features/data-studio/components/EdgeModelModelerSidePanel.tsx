import React from 'react';
import { Eraser, Fingerprint, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { EdgeApiDefinition } from '../../../shared/api/contracts/data-api';
import type { ServerFunctionItem } from '../../../shared/api/contracts/server-functions/types';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import { formatNavigationIconRefLabel } from '../../../shared/lib/navigationIcons/navigationIconRef';
import {
  AppButton,
  DirectionalText,
  FORM_FIELD_LABEL_CLASS,
  FormSection,
} from '../../../shared/ui';
import type { EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import { NAV_DEFAULT_ICON_COLOR } from '../../platform-navigations/constants';
import {
  resolveNavColor,
  resolveNavigationColorLabel,
} from '../../platform-navigations/lib/navigationTailwindColorOptions';
import type { EdgeModelModelerModel } from '../hooks/useEdgeModelModeler';
import { EdgeModelModelerApisSection } from './EdgeModelModelerApisSection';
import { EdgeModelModelerRelationsSection } from './EdgeModelModelerRelationsSection';

const GENERAL_SECTION_HINT =
  'Metadata in this section guides the AI assistant to build better interfaces.';

const FIELD_LABEL_CLASS = cn(
  FORM_FIELD_LABEL_CLASS,
  'normal-case tracking-normal text-[11px] text-slate-500',
);

const displayText = (value: string | null | undefined, empty = '—') => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : empty;
};

const MetaField: React.FC<{
  label: string;
  value: React.ReactNode;
}> = ({ label, value }) => (
  <div className="min-w-0 flex flex-col gap-[2px] overflow-hidden ps-[4px]">
    <div className={FIELD_LABEL_CLASS}>{label}</div>
    <div className="min-w-0 overflow-hidden break-words text-sm font-medium text-slate-800">
      {typeof value === 'string' ? <DirectionalText as="span" text={value} /> : value}
    </div>
  </div>
);

export type EdgeModelModelerSidePanelProps = {
  modeler: EdgeModelModelerModel;
  modelId: string;
  onEditGeneral: () => void;
  onViewIdentity: () => void;
  onOpenRelations: () => void;
  onCreateApi: () => void;
  onEditApi: (definitionId: string, options?: { initialTab?: 'access' | 'hooks' | 'runtime'; openAccessModal?: boolean; openHooksModal?: boolean }) => void;
  onEditFunctionApi: (fn: ServerFunctionItem, mode?: 'settings' | 'access' | 'hooks') => void;
  onDeleteApi: (definition: EdgeApiDefinition) => void;
  onDeleteObject: () => void;
  onTruncateTable: () => void;
  isDeletingObject?: boolean;
  isTruncatingTable?: boolean;
};

export const EdgeModelModelerSidePanel: React.FC<EdgeModelModelerSidePanelProps> = ({
  modeler,
  modelId,
  onEditGeneral,
  onViewIdentity,
  onOpenRelations,
  onCreateApi,
  onEditApi,
  onEditFunctionApi,
  onDeleteApi,
  onDeleteObject,
  onTruncateTable,
  isDeletingObject = false,
  isTruncatingTable = false,
}) => {
  const model = modeler.model as EdgeModelDefinition;
  const draft = modeler.draft!;
  const showDestructiveFooter = !modeler.isControlPlaneObject;
  const showTruncate = showDestructiveFooter && model.objectType === 'TABLE';

  return (
    <>
      <aside className="flex w-80 min-w-0 shrink-0 flex-col overflow-x-hidden border-s border-slate-200 bg-white">
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3">
          <div className="flex flex-col gap-1">
            <FormSection
              title="General"
              ink="accent"
              hint={GENERAL_SECTION_HINT}
              headerExtra={(
                <div className="flex shrink-0 items-center gap-1">
                  <AppButton
                    intent="secondary"
                    size="icon-sm"
                    aria-label="View identity"
                    title="View identity"
                    onClick={onViewIdentity}
                  >
                    <Fingerprint className="h-3.5 w-3.5" />
                  </AppButton>
                  <AppButton
                    intent="secondary"
                    size="icon-sm"
                    aria-label="Edit general"
                    title="Edit general"
                    onClick={onEditGeneral}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </AppButton>
                </div>
              )}
            >
              <div className="flex flex-col gap-2.5">
                <MetaField label="Title" value={displayText(draft.title, model.objectName)} />
                <MetaField
                  label="Icon"
                  value={(
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      {draft.icon.trim() ? (
                        <NavigationIcon
                          iconRef={draft.icon}
                          className={cn(
                            'h-4 w-4 shrink-0',
                            resolveNavColor(draft.color, NAV_DEFAULT_ICON_COLOR),
                          )}
                        />
                      ) : (
                        <span
                          className={cn(
                            'inline-block h-3 w-3 shrink-0 rounded-full bg-current ring-1 ring-inset ring-black/10',
                            resolveNavColor(draft.color, NAV_DEFAULT_ICON_COLOR),
                          )}
                          aria-hidden
                        />
                      )}
                      <span className="truncate font-mono text-[11px] font-medium text-slate-600">
                        {draft.icon.trim()
                          ? formatNavigationIconRefLabel(draft.icon)
                          : 'No icon'}
                        {' · '}
                        {resolveNavigationColorLabel(
                          resolveNavColor(draft.color, NAV_DEFAULT_ICON_COLOR),
                        )}
                      </span>
                    </span>
                  )}
                />
                <MetaField label="Studio tags" value={displayText(draft.studio.tagsText)} />
              </div>
            </FormSection>

            <EdgeModelModelerRelationsSection
              dataSourceId={model.dataSourceId}
              objectName={model.objectName}
              objectType={model.objectType}
              associations={draft.associations}
              relationDisplayLabels={draft.studio.relationDisplayLabels}
              relationIcons={draft.studio.relationIcons}
              relationFormWidgets={draft.studio.relationFormWidgets}
              relationTargetFilters={draft.studio.relationTargetFilters}
              relationDeveloperNotes={draft.studio.relationDeveloperNotes}
              relationInterfaceNotes={draft.studio.relationInterfaceNotes}
              relationCubeDimensions={draft.studio.relationCubeDimensions}
              relationHistories={draft.studio.relationHistories}
              onApplyRelationStudioMeta={modeler.applyRelationStudioMeta}
              onOpenRelations={onOpenRelations}
            />

            <EdgeModelModelerApisSection
              modelId={modelId}
              objectName={model.objectName}
              onCreateApi={onCreateApi}
              onEditApi={onEditApi}
              onEditFunctionApi={onEditFunctionApi}
              onDeleteApi={onDeleteApi}
            />
          </div>
        </div>

        {showDestructiveFooter ? (
          <div className="flex shrink-0 flex-col gap-1.5 border-t border-slate-200 px-3 py-2.5">
            <p className={cn('ps-[4px] text-[10px] font-semibold uppercase tracking-wider text-slate-400')}>
              Danger zone
            </p>
            <div className="flex items-center justify-end gap-1.5">
              {showTruncate ? (
                <AppButton
                  intent="destructive-soft"
                  size="sm"
                  disabled={isTruncatingTable || isDeletingObject}
                  title={`Truncate ${model.objectName} — type the object name to confirm`}
                  onClick={onTruncateTable}
                >
                  <Eraser className={cn('h-3.5 w-3.5', isTruncatingTable && 'animate-pulse')} />
                  Truncate
                </AppButton>
              ) : null}
              <AppButton
                intent="destructive-soft"
                size="sm"
                disabled={isDeletingObject || isTruncatingTable}
                title={`Delete ${model.objectName} — type the object name to confirm`}
                onClick={onDeleteObject}
              >
                <Trash2 className={cn('h-3.5 w-3.5', isDeletingObject && 'animate-pulse')} />
                Delete
              </AppButton>
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
};
