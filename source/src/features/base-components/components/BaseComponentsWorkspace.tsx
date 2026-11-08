import React from 'react';
import { useBaseComponentsPage } from '../hooks/useBaseComponentsPage';
import { EnglishOnlyCultureScope } from '../../../core/culture/EnglishOnlyCultureScope';
import { BaseComponentsPageView } from './BaseComponentsPageView';

export const BaseComponentsWorkspace: React.FC = () => {
  const page = useBaseComponentsPage();

  return (
    <EnglishOnlyCultureScope className="flex h-full min-h-0 flex-col">
      <BaseComponentsPageView page={page} />
    </EnglishOnlyCultureScope>
  );
};
