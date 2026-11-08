import React from 'react';
import { ThemeEditorWorkspace } from './ThemeEditorWorkspace';
import { useAppearancePage } from '../hooks/useAppearancePage';

export const AppearanceWorkspace: React.FC = () => {
  const page = useAppearancePage();
  return <ThemeEditorWorkspace page={page} />;
};
