import React, { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { CultureProvider } from '../../../../app/platform/CultureContext';
import { useOptionalCultureT } from '../../../../core/culture/CultureContext';
import { resolveCultureFromPathname } from '../../../../core/culture/CultureUrlResolver';
import { isPublicAppPath } from '../../../../app/platform/publicAppPaths';
import { useAuth } from '../../../../contexts/AuthContext';
import { useViewportTier } from '../../../lib/useViewportTier';
import { PageGuideOverlay } from './PageGuideOverlay';
import { stopPageGuide, usePageGuideActive } from './pageGuideStore';

class PageGuideRenderGuard extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    console.error('[PageGuide] overlay failed', error);
  }

  render(): React.ReactNode {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

const formatStepCopy = (template: unknown, current: number, total: number): string => {
  const source = typeof template === 'string' && template.trim()
    ? template
    : '{current} of {total}';
  return source
    .replace('{current}', String(current))
    .replace('{total}', String(total));
};

const PageGuideOverlayLocalized: React.FC<{
  pathname: string;
  onClose: () => void;
}> = ({ pathname, onClose }) => {
  const t = useOptionalCultureT();

  return (
    <PageGuideOverlay
      pathname={pathname}
      copy={{
        closeAria: t('pageGuide.closeAria'),
        next: t('pageGuide.next'),
        previous: t('pageGuide.previous'),
        playAria: t('pageGuide.playAria'),
        pauseAria: t('pageGuide.pauseAria'),
        done: t('pageGuide.done'),
        step: (current, total) => formatStepCopy(t('pageGuide.step'), current, total),
        changeShapeAria: t('pageGuide.changeShapeAria'),
        emptyTitle: t('pageGuide.emptyTitle'),
        emptyHint: t('pageGuide.emptyHint'),
        chooser: {
          title: t('pageGuide.chooser.title'),
          hint: t('pageGuide.chooser.hint'),
          aria: t('pageGuide.chooser.aria'),
          pageTitle: t('pageGuide.chooser.page.title'),
          pageHint: t('pageGuide.chooser.page.hint'),
          navigationTitle: t('pageGuide.chooser.navigation.title'),
          navigationHint: t('pageGuide.chooser.navigation.hint'),
          capabilitiesTitle: t('pageGuide.chooser.capabilities.title'),
          capabilitiesHint: t('pageGuide.chooser.capabilities.hint'),
        },
      }}
      onClose={onClose}
    />
  );
};

export const PageGuideHost: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const active = usePageGuideActive();
  const viewportTier = useViewportTier();
  const isPublicSurface = isPublicAppPath(location.pathname);
  const hideOnPhone = viewportTier === 'phone';
  const { cultureId } = useMemo(
    () => resolveCultureFromPathname(location.pathname),
    [location.pathname],
  );

  useEffect(() => {
    if (hideOnPhone && active) {
      stopPageGuide();
    }
  }, [active, hideOnPhone]);

  if (!isAuthenticated || isPublicSurface || !active || hideOnPhone) {
    return null;
  }

  return (
    <PageGuideRenderGuard>
      <CultureProvider cultureId={cultureId}>
        <PageGuideOverlayLocalized pathname={location.pathname} onClose={stopPageGuide} />
      </CultureProvider>
    </PageGuideRenderGuard>
  );
};
