import React, { useState } from 'react';
import { Code2, Save, Sparkles, TerminalSquare, Webhook } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { columnCommonKey } from '../../../core/culture/translations/cultureKeyHelpers';
import {
  AppButton,
  AppSplitButton,
  SplitButtonMenuItem,
  UiChip,
  WorkspaceBackIcon,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { useAiSettingsQuery } from '../../../shared/api/queries/aiModels';
import { isAiGloballyEnabled } from '../../../shared/lib/aiAccess';
import { INJECTABLE_SNIPPETS } from '../constants';
import type { ServerFunctionsPageState } from '../hooks/useServerFunctionsPage';
import { findServerFunctionByEditSlug } from '../serverFunctionRoute';
import { PackageSourceBadge } from '../../../shared/packages/PackageSourceBadge';
import { readServerFunctionCatalogTags } from '../../../shared/lib/serverFunctionCatalogTags';
import { buildServerFunctionCatalogPath } from '../lib/duplicateServerFunctionIdentity';
import { ServerFunctionDocsToolbarButtons } from './ServerFunctionDocsToolbarButtons';
import { ServerFunctionWorkspaceMetadataFooter } from './ServerFunctionWorkspaceMetadataFooter';

function getMethodPillClass(method: string, active: boolean): string {
  if (!active) {
    return 'text-slate-500 hover:text-slate-700';
  }
  if (method === 'GET') return 'bg-emerald-500 text-white shadow-xs';
  if (method === 'POST') return 'bg-amber-500 text-white shadow-xs';
  if (method === 'PUT') return 'bg-blue-500 text-white shadow-xs';
  return 'bg-red-500 text-white shadow-xs';
}

export type ServerFunctionEditorPanelProps = {
  page: ServerFunctionsPageState;
  workspace: React.ReactNode;
};

export const ServerFunctionEditorPanel: React.FC<ServerFunctionEditorPanelProps> = ({ page, workspace }) => {
  const t = useCultureT();
  const {
    activeId,
    activeFn,
    isNewDraftRoute,
    editSlugFromUrl,
    draftFn,
    isActiveBuiltIn,
    isActivePackageFn,
    isSnippetInjected,
    injectSnippet,
    persistEdgeState,
    handleCreateFromDraft,
    isCreatingFromDraft,
    setIsHooksOpen,
    functions,
    isLargeScreen,
    payloadCollapsed,
    togglePayload,
    setActiveId,
    aiOpen,
    setAiOpen,
  } = page;

  const isEditRoute = Boolean(editSlugFromUrl && !isNewDraftRoute);
  const isCreateMode = !isEditRoute && (isNewDraftRoute || !activeId);
  const urlMatchedFn = isEditRoute && editSlugFromUrl
    ? findServerFunctionByEditSlug(functions, editSlugFromUrl)
    : null;
  const identityFn = activeFn ?? urlMatchedFn;
  const displayMethod = isCreateMode ? draftFn.method : identityFn?.method;
  const displayName = isCreateMode ? (draftFn.name || 'Untitled') : (identityFn?.name ?? '—');
  const displayPath = isCreateMode
    ? (draftFn.name ? buildServerFunctionCatalogPath(draftFn.name) : '—')
    : (identityFn?.path ?? '—');
  const catalogTags = readServerFunctionCatalogTags(identityFn?.metadataJson);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const aiSettingsQuery = useAiSettingsQuery();
  const showAi = isAiGloballyEnabled(aiSettingsQuery.data?.enabled);
  const aiToggleLabel = aiOpen ? t('serverFunctions.ai.hide') : t('serverFunctions.ai.show');

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden border-b bg-white xl:border-b-0">

      <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-[9px]">
        <div className="flex min-h-8 min-w-0 flex-1 items-center justify-between gap-2 font-sans text-xs font-semibold text-slate-500 select-none">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <WorkspaceBackIcon
              ariaLabel={t('serverFunctions.editor.backAria')}
              title={t('serverFunctions.editor.backTitle')}
              onClick={() => setActiveId(null)}
            />
            <div className="flex min-w-0 items-center gap-1">
              <span className="shrink-0 font-mono text-[9px] font-bold uppercase text-slate-400">{t(columnCommonKey('name'))}</span>
              <span className="truncate font-mono text-xs font-semibold text-slate-700" title={displayName}>
                {displayName}
              </span>
            </div>
            <div className="hidden min-w-0 items-center gap-1 sm:flex">
              <span className="shrink-0 font-mono text-[9px] font-bold uppercase text-slate-400">Path</span>
              <span className="truncate font-mono text-[11px] text-slate-500" title={displayPath}>
                {displayPath}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="shrink-0 font-mono text-[9px] font-bold uppercase text-slate-400">{t(columnCommonKey('method'))}</span>
              <div
                className="inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded border border-slate-200 bg-white px-2"
                aria-label={t('serverFunctions.editor.httpMethodAria')}
              >
                {displayMethod ? (
                  <span
                    className={cn(
                      'select-none rounded px-1 py-0.5 font-mono text-[9px] font-bold',
                      getMethodPillClass(displayMethod, true),
                    )}
                  >
                    {displayMethod}
                  </span>
                ) : null}
              </div>
            </div>
            {catalogTags.length > 0 ? (
              <div className="hidden min-w-0 flex-wrap items-center gap-1 lg:flex">
                {catalogTags.slice(0, 3).map((tag) => (
                  <UiChip key={tag.toLowerCase()} size="sm" variant="soft" color="default">
                    {tag}
                  </UiChip>
                ))}
              </div>
            ) : null}
            {isActivePackageFn && activeFn ? (
              <PackageSourceBadge
                packageId={activeFn.packageId}
                packageDisplayName={activeFn.packageDisplayName}
              />
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {showAi ? (
              <AppButton
                size="icon-md"
                intent={aiOpen ? 'toggle-on' : 'toggle-off'}
                className="shrink-0"
                aria-label={aiToggleLabel}
                title={aiToggleLabel}
                aria-pressed={aiOpen}
                onClick={() => setAiOpen?.((open) => !open)}
              >
                <Sparkles className="h-3.5 w-3.5" />
              </AppButton>
            ) : null}

            <AppSplitButton
              intent="utility"
              size="sm"
              icon={<Code2 className="h-3.5 w-3.5" />}
              label="Code Snippets"
              isOpen={isMoreMenuOpen}
              onOpenChange={setIsMoreMenuOpen}
              triggerAriaLabel="Code Snippets"
              menuAriaLabel="Code Snippets"
              title="Code Snippets"
              menuClassName="w-72 overflow-hidden"
            >
              <div className="max-h-72 overflow-y-auto py-1">
                {INJECTABLE_SNIPPETS.map((snippet) => {
                  const injected = isSnippetInjected(snippet);
                  return (
                    <SplitButtonMenuItem
                      key={snippet.key}
                      disabled={injected || isActiveBuiltIn}
                      className={cn('justify-between', injected && 'bg-slate-50')}
                      onClick={() => {
                        injectSnippet(snippet);
                        setIsMoreMenuOpen(false);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">{snippet.label}</span>
                      <span className={cn(
                        'shrink-0 text-[10px] font-mono uppercase tracking-wide',
                        injected ? 'text-emerald-600' : 'text-slate-400',
                      )}
                      >
                        {injected ? t('serverFunctions.editor.injected') : t('serverFunctions.editor.available')}
                      </span>
                    </SplitButtonMenuItem>
                  );
                })}
              </div>
            </AppSplitButton>

            <ServerFunctionDocsToolbarButtons
              scope="function"
              functionId={activeFn?.id ?? activeId}
              disabled={!isEditRoute || !activeFn?.id}
            />

            {isLargeScreen && activeId && activeFn ? (
              <>
                <div className="w-px h-5 bg-slate-300/80" aria-hidden="true" />
                <AppButton
                  size="icon-md"
                  intent={payloadCollapsed ? 'toggle-off' : 'toggle-on'}
                  className="shrink-0"
                  aria-label={t('serverFunctions.editor.toggleTestConsole')}
                  aria-pressed={!payloadCollapsed}
                  title={payloadCollapsed ? t('serverFunctions.editor.showTestConsole') : t('serverFunctions.editor.hideTestConsole')}
                  onClick={togglePayload}
                >
                  <TerminalSquare className="h-3.5 w-3.5" />
                </AppButton>
              </>
            ) : null}

            <div className="w-px h-5 bg-slate-300/80" aria-hidden="true" />
            {!isActiveBuiltIn ? (
              <AppButton
                intent="utility"
                size="icon-md"
                className="shrink-0"
                disabled={!activeId}
                aria-label="Hooks"
                title="Before/after workflow hooks"
                onClick={() => {
                  if (!activeId) return;
                  setIsHooksOpen(true);
                }}
              >
                <Webhook className="h-3.5 w-3.5" />
              </AppButton>
            ) : null}
            <AppButton
              intent="primary"
              size="sm"
              disabled={isCreateMode ? isCreatingFromDraft || !draftFn.name.trim() : !activeId}
              onClick={() => {
                if (isCreateMode) {
                  void handleCreateFromDraft();
                  return;
                }
                void persistEdgeState();
              }}
            >
              <Save className="h-3.5 w-3.5" />
              {isCreateMode
                ? (isCreatingFromDraft ? t('serverFunctions.editor.creating') : t('actions.create'))
                : t('actions.save')}
            </AppButton>
          </div>
        </div>
      </div>

      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          {workspace}
        </div>
      </div>

      <ServerFunctionWorkspaceMetadataFooter
        fn={{
          created_at: identityFn?.created_at,
          created_by: identityFn?.created_by,
          updated_at: identityFn?.updated_at,
          updated_by: identityFn?.updated_by,
        }}
      />
    </div>
  );
};
