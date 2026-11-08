import * as React from 'react';
import { Trash2, Unplug, X } from 'lucide-react';
import {
  AppButton,
  CreateEditModalShell,
  DevelopmentCatalogCard,
  DevelopmentCatalogCardBadge,
  DevelopmentCatalogCardFooter,
  DevelopmentCatalogCardGrid,
  DevelopmentCatalogCardHeader,
  DevelopmentCatalogCardPath,
  DevelopmentCatalogIconAction,
} from '../../../shared/ui';
import { useUnusedServerFunctionsQuery } from '../../../shared/api/queries/server-functions';

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

export type ServerFunctionUnusedDialogProps = {
  open: boolean;
  onClose: () => void;
  onDeleteFunction: (functionId: string) => void;
  isDeleteBusy?: boolean;
};

export const ServerFunctionUnusedDialog: React.FC<ServerFunctionUnusedDialogProps> = ({
  open,
  onClose,
  onDeleteFunction,
  isDeleteBusy = false,
}) => {
  const unusedQuery = useUnusedServerFunctionsQuery({ enabled: open });
  const functions = unusedQuery.data ?? [];

  if (!open) {
    return null;
  }

  return (
    <CreateEditModalShell
      size="maximized"
      title={(
        <span className="inline-flex items-center gap-2">
          <Unplug className="h-4 w-4 text-slate-600" aria-hidden />
          Unused server functions
        </span>
      )}
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <div className="flex justify-end">
          <AppButton intent="secondary" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" aria-hidden />
            Close
          </AppButton>
        </div>
      )}
    >
      <div className="flex h-full min-h-0 flex-col">
        {unusedQuery.isLoading ? (
          <p className="text-sm font-medium text-slate-400">Loading…</p>
        ) : unusedQuery.isError ? (
          <p className="text-sm font-medium text-rose-600">
            {unusedQuery.error instanceof Error ? unusedQuery.error.message : 'Failed to load unused server functions.'}
          </p>
        ) : functions.length === 0 ? (
          <p className="text-sm font-medium text-slate-500">No unused server functions.</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <DevelopmentCatalogCardGrid>
              {functions.map((entry) => (
                <DevelopmentCatalogCard
                  key={entry.id}
                  data-testid={`unused-server-function-${entry.id}`}
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
                          onDeleteFunction(entry.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </DevelopmentCatalogIconAction>
                    )}
                  />
                  <DevelopmentCatalogCardPath>{entry.path}</DevelopmentCatalogCardPath>
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
    </CreateEditModalShell>
  );
};
