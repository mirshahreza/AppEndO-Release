import React from 'react';
import { useLocation } from 'react-router-dom';
import { useOptionalCultureT } from '../../../../core/culture/CultureContext';
import { isPublicAppPath } from '../../../../app/platform/publicAppPaths';
import { useAuth } from '../../../../contexts/AuthContext';
import { useAiSettingsQuery } from '../../../api/queries/aiModels';
import { isAiGloballyEnabled } from '../../../lib/aiAccess';
import { AppendooCompanion } from './AppendooCompanion';
import { shouldRenderAppendooCompanion } from './shouldRenderAppendooCompanion';
import { usePageGuideActive } from '../pageGuide/pageGuideStore';
import { usePersistedAppEndooOpen } from '../usePersistedAppEndooOpen';

/** Floating AppEndoo creature — hidden while chat or the page guide is open. */
export const AppendooCompanionHost: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const t = useOptionalCultureT();
  const settingsQuery = useAiSettingsQuery({
    enabled: isAuthenticated && !isPublicAppPath(location.pathname),
  });
  const aiEnabled = isAiGloballyEnabled(settingsQuery.data?.enabled);
  const [isOpen, setIsOpen] = usePersistedAppEndooOpen();
  const pageGuideActive = usePageGuideActive();

  if (!shouldRenderAppendooCompanion({
    isAuthenticated,
    pathname: location.pathname,
    aiEnabled,
  }) || isOpen || pageGuideActive) {
    return null;
  }

  return (
    <AppendooCompanion
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      openAriaLabel={t('appendoo.companion.openAria')}
      closeAriaLabel={t('appendoo.companion.closeAria')}
      untuckAriaLabel={t('appendoo.companion.untuckAria')}
    />
  );
};
