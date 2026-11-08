import React, { useRef, useState } from 'react';

import { AppRouteLoading } from '../../../components/AppRouteLoading';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { appearanceLabel } from '../lib/appearanceCulture';

import {
  QueryErrorPanel,
  ListPageShell,
} from '../../../shared/ui';

import type { AppearancePageModel } from '../hooks/useAppearancePage';

import { useAppearanceShellHeader } from '../hooks/useAppearanceShellHeader';

import { ThemeTokenEditor } from './ThemeTokenEditor';
import { AppearanceShellPreferencesPanel } from './AppearanceShellPreferencesPanel';
import {
  AppearanceWorkspaceSectionNav,
  type AppearanceWorkspaceSection,
} from './AppearanceWorkspaceSectionNav';



type ThemeEditorWorkspaceProps = {

  page: AppearancePageModel;

};



export const ThemeEditorWorkspace: React.FC<ThemeEditorWorkspaceProps> = ({ page }) => {
  const atmosphereTokensRef = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<AppearanceWorkspaceSection>('shell');
  const culture = useOptionalCulture();
  const t = culture?.t;

  useAppearanceShellHeader({ enabled: true });



  if (page.isEditorLoading || !page.draft) {

    return <AppRouteLoading variant="embedded" />;

  }



  if (page.isEditorError) {

    return (

      <div className="flex h-full min-h-0 flex-col bg-white p-4">

        <QueryErrorPanel

          message={appearanceLabel(t, 'theme.loadFailed', 'Failed to load theme preset.')}

          detail={page.editorErrorMessage}

          onRetry={page.retryLoad}

          isRetrying={page.isRefreshing}

        />

      </div>

    );

  }



  return (

    <ListPageShell className="min-h-0 flex-1">

      {page.formError ? (

        <div className="border-b border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">

          {page.formError}

        </div>

      ) : null}



      <AppearanceWorkspaceSectionNav section={section} onSectionChange={setSection} />

      {section === 'shell' ? (
        <AppearanceShellPreferencesPanel />
      ) : null}

      {section === 'atmosphere' ? (
        <div ref={atmosphereTokensRef} className="min-h-0 flex-1 flex flex-col">
          <ThemeTokenEditor
            tokens={page.draft.tokens}
            onTokenChange={page.updateToken}
            onRegenerateFromBase={page.regenerateFromBase}
            onUndo={page.undo}
            onRedo={page.redo}
            canUndo={page.canUndo}
            canRedo={page.canRedo}
          />
        </div>
      ) : null}

    </ListPageShell>

  );

};

