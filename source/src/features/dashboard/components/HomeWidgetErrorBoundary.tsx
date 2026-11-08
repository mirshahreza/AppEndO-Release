import React from 'react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { DashboardWidgetShell } from './DashboardWidgetShell';

type HomeWidgetErrorBoundaryProps = {
  titleKey: string;
  children: React.ReactNode;
};

type HomeWidgetErrorBoundaryState = {
  hasError: boolean;
};

export class HomeWidgetErrorBoundary extends React.Component<
  HomeWidgetErrorBoundaryProps,
  HomeWidgetErrorBoundaryState
> {
  state: HomeWidgetErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): HomeWidgetErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <HomeWidgetErrorFallback titleKey={this.props.titleKey} />;
    }
    return this.props.children;
  }
}

const HomeWidgetErrorFallback: React.FC<{ titleKey: string }> = ({ titleKey }) => {
  const t = useCultureT();
  return (
    <DashboardWidgetShell title={t(titleKey)}>
      <p className="px-3 py-2 text-sm text-slate-500">{t('homeWidget.loadError')}</p>
    </DashboardWidgetShell>
  );
};
