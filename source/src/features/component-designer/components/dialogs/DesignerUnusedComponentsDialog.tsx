import * as React from 'react';
import { Trash2, Unplug, X } from 'lucide-react';
import {
  AppButton,
  DevelopmentCatalogCard,
  DevelopmentCatalogCardFooter,
  DevelopmentCatalogCardGrid,
  DevelopmentCatalogCardHeader,
  DevelopmentCatalogCardBadge,
  DevelopmentCatalogIconAction,
} from '../../../../shared/ui';
import { useUnusedDesignerComponentsQuery } from '../../../../shared/api/queries/component-designer';
import { DesignerDialog, DESIGNER_DIALOG_BODY_FULL_HEIGHT_CLASS } from './DesignerDialog';

const MAXIMIZED_SURFACE_CLASS = 'w-[calc(100vw-24px)] h-[calc(100vh-24px)] max-w-none rounded-lg flex flex-col overflow-hidden';

const formatLastHitAt = (value: string | null): string => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toISOString().slice(0, 10);
};

export type DesignerUnusedComponentsDialogProps = {
  open: boolean;
  onClose: () => void;
  onDeleteComponent: (draftId: string) => void;
  isDeleteBusy?: boolean;
};

export const DesignerUnusedComponentsDialog: React.FC<DesignerUnusedComponentsDialogProps> = ({
  open,
  onClose,
  onDeleteComponent,
  isDeleteBusy = false,
}) => {
  const unusedQuery = useUnusedDesignerComponentsQuery({ enabled: open });
  const components = unusedQuery.data ?? [];

  return (
    <DesignerDialog
      title="Unused components"
      titleIcon={<Unplug className="h-4 w-4 text-slate-600" />}
      open={open}
      onClose={onClose}
      surfaceClassName={MAXIMIZED_SURFACE_CLASS}
      bodyClassName={DESIGNER_DIALOG_BODY_FULL_HEIGHT_CLASS}
      footer={(
        <div className="flex justify-end">
          <AppButton size="sm" intent="secondary" onClick={onClose}>
            <X className="h-3.5 w-3.5" aria-hidden />
            Close
          </AppButton>
        </div>
      )}
    >
      <div className="flex h-full min-h-0 flex-col bg-white p-[15px]">
        {unusedQuery.isLoading ? (
          <p className="text-sm font-medium text-slate-400">Loading…</p>
        ) : unusedQuery.isError ? (
          <p className="text-sm font-medium text-rose-600">
            {unusedQuery.error instanceof Error ? unusedQuery.error.message : 'Failed to load unused components.'}
          </p>
        ) : components.length === 0 ? (
          <p className="text-sm font-medium text-slate-500">No unused components.</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <DevelopmentCatalogCardGrid>
              {components.map((entry) => (
                <DevelopmentCatalogCard
                  key={entry.draftId}
                  data-testid={`unused-component-${entry.draftId}`}
                >
                  <DevelopmentCatalogCardHeader
                    title={entry.name}
                    titleTone="identifier"
                    titleAction={(
                      <DevelopmentCatalogIconAction
                        intent="delete"
                        aria-label={`Delete ${entry.name}`}
                        title="Delete"
                        disabled={isDeleteBusy}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteComponent(entry.draftId);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </DevelopmentCatalogIconAction>
                    )}
                  />
                  <div className="mt-auto">
                    <DevelopmentCatalogCardFooter
                      date={`Last used ${formatLastHitAt(entry.lastHitAt)}`}
                      badge={(
                        <DevelopmentCatalogCardBadge className="border-slate-200 bg-slate-50 text-slate-600">
                          Unused
                        </DevelopmentCatalogCardBadge>
                      )}
                    />
                  </div>
                </DevelopmentCatalogCard>
              ))}
            </DevelopmentCatalogCardGrid>
          </div>
        )}
      </div>
    </DesignerDialog>
  );
};
