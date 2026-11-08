import React from 'react';
import { BookOpen, Braces, FileText, RefreshCw } from 'lucide-react';
import { AppSplitButton, showAppFeedbackToast, SplitButtonMenuItem } from '../../../shared/ui';
import {
  buildServerFunctionDocsRefreshUrl,
  buildServerFunctionOpenApiUrl,
  buildServerFunctionSwaggerUrl,
  openServerFunctionDocUrl,
  type ServerFunctionDocsScope,
} from '../lib/serverFunctionDocsUrls';

export type ServerFunctionDocsToolbarButtonsProps = {
  scope: ServerFunctionDocsScope;
  functionId?: string | null;
  disabled?: boolean;
};

export const ServerFunctionDocsToolbarButtons: React.FC<ServerFunctionDocsToolbarButtonsProps> = ({
  scope,
  functionId = null,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const isFunctionScope = scope === 'function';
  const isDisabled = disabled || (isFunctionScope && !functionId);

  const openSwagger = () => {
    if (isFunctionScope && !functionId) {
      return;
    }
    openServerFunctionDocUrl(buildServerFunctionSwaggerUrl(scope, functionId));
    setIsOpen(false);
  };

  const openOpenApi = () => {
    if (isFunctionScope && !functionId) {
      return;
    }
    openServerFunctionDocUrl(buildServerFunctionOpenApiUrl(scope, functionId));
    setIsOpen(false);
  };

  const refreshDocs = async () => {
    if (isFunctionScope && !functionId) {
      return;
    }
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    try {
      const response = await fetch(buildServerFunctionDocsRefreshUrl(scope, functionId), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error('Refresh failed');
      }
      showAppFeedbackToast('Swagger UI and OpenAPI JSON caches refreshed.', { type: 'success' });
      setIsOpen(false);
    } catch {
      showAppFeedbackToast('Failed to refresh API documentation.', { type: 'error' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const triggerLabel = isFunctionScope ? 'Route documentation' : 'API documentation';

  return (
    <AppSplitButton
      intent="utility"
      size="sm"
      icon={<FileText className="h-3.5 w-3.5" />}
      label={triggerLabel}
      disabled={isDisabled}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      triggerAriaLabel={triggerLabel}
      menuAriaLabel={`${triggerLabel} formats`}
      title={triggerLabel}
      menuClassName="min-w-[11.5rem]"
    >
      <SplitButtonMenuItem
        icon={<BookOpen className="h-3.5 w-3.5 shrink-0 text-cyan-600" />}
        onClick={openSwagger}
      >
        Swagger UI
      </SplitButtonMenuItem>
      <SplitButtonMenuItem
        icon={<Braces className="h-3.5 w-3.5 shrink-0 text-cyan-600" />}
        onClick={openOpenApi}
      >
        OpenAPI JSON
      </SplitButtonMenuItem>
      <div className="my-1 border-t border-slate-100" aria-hidden="true" />
      <SplitButtonMenuItem
        icon={(
          <RefreshCw
            className={`h-3.5 w-3.5 shrink-0 text-cyan-600 ${isRefreshing ? 'animate-spin' : ''}`}
          />
        )}
        disabled={isRefreshing}
        onClick={() => {
          void refreshDocs();
        }}
      >
        {isRefreshing ? 'Refreshing…' : 'Refresh docs'}
      </SplitButtonMenuItem>
    </AppSplitButton>
  );
};
