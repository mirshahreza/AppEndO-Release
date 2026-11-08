import * as React from 'react';
import { ComponentDesignerView } from '../components/ComponentDesignerView';
import { useDesignerState } from './useDesignerState';
import { useDesignerVersions } from './useDesignerVersions';
import type { DesignerDialogFlags } from './types';

/** Catalog-only page hook — Live Designer is the sole editor surface. */
export function useComponentDesignerPage() {
  const dialogFlagsRef = React.useRef<DesignerDialogFlags>({
    draftDialogMode: null,
    isPreviewDialogOpen: false,
  });

  const previewPersistenceRef = React.useRef({
    activeDraftId: null as string | null,
    hasUnsavedChanges: false,
  });

  const designer = useDesignerState({
    getDialogFlags: () => dialogFlagsRef.current,
    getPreviewPersistence: () => previewPersistenceRef.current,
  });

  const versions = useDesignerVersions({
    state: designer.state,
    dispatch: designer.dispatch,
    flashToolbarStatus: designer.flashToolbarStatus,
    setPreviewState: designer.setPreviewState,
    loadCodeFromCompanionTsx: designer.loadCodeFromCompanionTsx,
    resetCodeFromGenerated: designer.resetCodeFromGenerated,
  });

  previewPersistenceRef.current = {
    activeDraftId: versions.activeDraftId,
    hasUnsavedChanges: versions.hasUnsavedChanges,
  };

  dialogFlagsRef.current = {
    draftDialogMode: versions.draftDialogMode,
    isPreviewDialogOpen: designer.isPreviewDialogOpen,
  };

  return {
    ...designer,
    ...versions,
  };
}

export type UseComponentDesignerPageResult = ReturnType<typeof useComponentDesignerPage>;

export type ComponentDesignerPageViewProps = UseComponentDesignerPageResult & {
  isCatalogListMode?: boolean;
  onOpenLiveDesigner?: (draftId: string) => void;
};

export const ComponentDesignerPageView: React.FC<ComponentDesignerPageViewProps> = (props) => (
  <ComponentDesignerView {...props} />
);
