import React, { useCallback, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { CultureProvider } from '../../../app/platform/CultureContext';
import { isPublicAppPath } from '../../../app/platform/publicAppPaths';
import { useAuth } from '../../../contexts/AuthContext';
import { resolveCultureFromPathname } from '../../../core/culture/CultureUrlResolver';
import { LazyAppEndooPanel } from '../../../components/LazyAppEndooPanel';
import { enrichPageContextFromPath, mergeAiPageContext } from '../../api/contracts/ai/pageContext';
import { useAiPageContextEnrichment } from '../../lib/aiPageContextStore';
import { resetAppEndooSessionSurface } from './resetAppEndooSessionSurface';
import { usePersistedAppEndooOpen } from './usePersistedAppEndooOpen';

/** Single app-wide chat surface — shells only toggle open state, never mount their own panel. */
export const AppEndooHost: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const aiPageEnrichment = useAiPageContextEnrichment();
  const [isOpen, setIsOpen] = usePersistedAppEndooOpen();
  const isPublicSurface = isPublicAppPath(location.pathname);
  const canRenderAppEndoo = isAuthenticated && !isPublicSurface;
  const { cultureId } = useMemo(
    () => resolveCultureFromPathname(location.pathname),
    [location.pathname],
  );

  useEffect(() => {
    if (!canRenderAppEndoo) {
      resetAppEndooSessionSurface();
    }
  }, [canRenderAppEndoo]);

  const pageContext = useMemo(
    () => enrichPageContextFromPath(mergeAiPageContext(
      {
        path: location.pathname,
        pageLabel: typeof document !== 'undefined' && document.title.trim()
          ? document.title.trim()
          : 'AppEndO',
        search: location.search || undefined,
      },
      aiPageEnrichment,
    )),
    [aiPageEnrichment, location.pathname, location.search],
  );

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  if (!canRenderAppEndoo || !isOpen) {
    return null;
  }

  return (
    <CultureProvider cultureId={cultureId}>
      <LazyAppEndooPanel
        hostPriority={100}
        isOpen={isOpen}
        onClose={closePanel}
        pageContext={pageContext}
      />
    </CultureProvider>
  );
};
