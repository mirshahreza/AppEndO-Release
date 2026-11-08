import React from 'react';
import { cn } from '../../../lib/utils';
import { useAiSettingsQuery } from '../../../shared/api/queries/aiModels';
import { isAiGloballyEnabled } from '../../../shared/lib/aiAccess';
import { WorkspaceVerticalSplitHandle } from '../../../shared/ui';
import { buildServerFunctionCatalogPath } from '../lib/duplicateServerFunctionIdentity';
import { buildServerFunctionAiSnapshot } from '../lib/serverFunctionAiSnapshot';
import type { ServerFunctionsPageState } from '../hooks/useServerFunctionsPage';
import { getActiveSourceLanguage } from '../templates';
import { ServerFunctionAiPanel } from './ServerFunctionAiPanel';
import { ServerFunctionEditorPanel } from './ServerFunctionEditorPanel';
import { ServerFunctionSidebarPanel } from './ServerFunctionSidebarPanel';
import { TestConsolePanel } from './TestConsolePanel';

export type ServerFunctionsLayoutProps = {
  page: ServerFunctionsPageState;
  workspace: React.ReactNode;
  onOpenUnusedFunctions?: () => void;
};

export const ServerFunctionsLayout: React.FC<ServerFunctionsLayoutProps> = ({
  page,
  workspace,
  onOpenUnusedFunctions,
}) => {
  const isListMode = !page.editSlugFromUrl;
  const aiSettingsQuery = useAiSettingsQuery();
  const showAi = isAiGloballyEnabled(aiSettingsQuery.data?.enabled);

  if (isListMode) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col bg-white font-sans">
        <ServerFunctionSidebarPanel
          page={page}
          layout="page"
          onOpenUnusedFunctions={onOpenUnusedFunctions}
        />
      </div>
    );
  }

  const isCreateMode = page.isNewDraftRoute || !page.activeId;
  const identityFn = page.activeFn;
  const displayName = isCreateMode ? (page.draftFn.name || 'Untitled') : (identityFn?.name ?? '—');
  const displayMethod = isCreateMode ? page.draftFn.method : identityFn?.method;
  const displayPath = isCreateMode
    ? (page.draftFn.name ? buildServerFunctionCatalogPath(page.draftFn.name) : '—')
    : (identityFn?.path ?? '—');
  const sourceLanguage = getActiveSourceLanguage(isCreateMode ? page.draftFn.language : identityFn?.language);
  const engineType = isCreateMode ? page.draftFn.engineType : (identityFn?.engineType ?? 'SANDBOX_JS');

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-1 flex-col bg-white xl:flex-row xl:items-stretch',
        (page.isResizingSidebar || page.isResizingPayload || page.isResizingPayloadHeight) && 'select-none',
      )}
    >
      <div
        ref={page.containerRef}
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col xl:flex-row xl:items-stretch"
      >
        <ServerFunctionEditorPanel page={page} workspace={workspace} />

        {page.activeId ? (
          <WorkspaceVerticalSplitHandle {...page.payloadSplitHandleProps} />
        ) : null}

        {page.activeId && page.activeFn ? (
          <TestConsolePanel
            isLargeScreen={page.isLargeScreen}
            payloadWidth={page.payloadWidth}
            payloadHeight={page.payloadHeight}
            column3Ref={page.column3Ref}
            activeFn={page.activeFn}
            testPayloadValue={page.getTestPayloadDisplay()}
            onTestPayloadChange={page.updateTestPayload}
            isRunning={page.isRunning}
            output={page.output}
            logs={page.logs ?? []}
            handleRun={() => void page.handleRun()}
            payloadHeightSplitHandleProps={page.payloadHeightSplitHandleProps}
          />
        ) : null}
      </div>

      {showAi ? (
        <div
          className={page.aiOpen ? 'flex h-full min-h-0 shrink-0 items-stretch' : 'hidden'}
          data-testid="server-functions-ai-dock"
        >
          <ServerFunctionAiPanel
            key={page.activeId ?? 'draft'}
            readSnapshot={() => buildServerFunctionAiSnapshot({
              name: displayName,
              method: displayMethod ?? null,
              path: displayPath,
              language: sourceLanguage,
              engineType: engineType ?? 'SANDBOX_JS',
              readOnly: page.isActiveBuiltIn,
              testPayload: page.getTestPayloadDisplay(),
              source: page.currentCode ?? '',
              lastRun: {
                isRunning: page.isRunning,
                output: page.output ?? null,
                logs: page.logs ?? [],
              },
            })}
            language={sourceLanguage === 'js' ? 'javascript' : 'typescript'}
            readOnly={page.isActiveBuiltIn}
            functionId={page.activeId ?? undefined}
            functionName={displayName !== '—' && displayName !== 'Untitled' ? displayName : undefined}
            onApplySource={page.applySourceToEditor}
            codeDiffBaseline={page.currentCode ?? ''}
          />
        </div>
      ) : null}
    </div>
  );
};
