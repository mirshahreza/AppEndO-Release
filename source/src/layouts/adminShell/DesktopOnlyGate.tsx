import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptionalCultureT } from '../../core/culture/CultureContext';
import { AppButton } from '../../shared/ui/AppButton';
import { ViewportUnavailablePanel } from '../../shared/ui/ViewportUnavailablePanel';

export type DesktopOnlyGateProps = {
  homeTo: string;
  homeLabel?: string;
};

export const DesktopOnlyGate: React.FC<DesktopOnlyGateProps> = ({
  homeTo,
  homeLabel,
}) => {
  const navigate = useNavigate();
  const t = useOptionalCultureT();
  const resolvedHomeLabel = homeLabel ?? t('shell.desktopOnly.back');

  return (
    <ViewportUnavailablePanel
      title={t('shell.desktopOnly.title')}
      message={t('shell.desktopOnly.message')}
      action={(
        <AppButton intent="primary" onClick={() => navigate(homeTo)}>
          {resolvedHomeLabel}
        </AppButton>
      )}
    />
  );
};
