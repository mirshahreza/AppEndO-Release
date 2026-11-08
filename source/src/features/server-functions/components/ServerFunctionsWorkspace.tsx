import React, { useMemo } from 'react';
import { useServerFunctionsPage } from '../hooks/useServerFunctionsPage';
import { usePublishAiPageContext } from '../../../shared/lib/aiPageContextStore';
import { ServerFunctionsPageView } from './ServerFunctionsPageView';

export const ServerFunctionsWorkspace: React.FC = () => {
  const page = useServerFunctionsPage();

  const aiContext = useMemo(() => {
    const functionId = page.activeFn?.id ?? (page.activeId && !page.isNewDraftRoute ? page.activeId : undefined);
    const functionName = page.activeFn?.name ?? (page.isNewDraftRoute ? page.draftFn.name : undefined);
    if (!functionId && !functionName) {
      return null;
    }
    return {
      pageKey: 'server-functions',
      functionId,
      functionName: functionName?.trim() || undefined,
    };
  }, [
    page.activeFn?.id,
    page.activeFn?.name,
    page.activeId,
    page.draftFn.name,
    page.isNewDraftRoute,
  ]);

  usePublishAiPageContext(aiContext);

  return <ServerFunctionsPageView page={page} />;
};
