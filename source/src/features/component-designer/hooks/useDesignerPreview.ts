import * as React from 'react';
import type { DesignerPreviewRuntimeState } from '../dialogs/types';
import type {
  DesignerBindingDefinition,
  DesignerDiagnostic,
  DesignerNode,
  DesignerState,
} from '../../../domain/component-designer/types';
import { useRunComponentDesignerPreviewMutation } from '../../../shared/api/queries/component-designer';
import {
  buildDesignerOutlinePreviewEmbeddedUrl,
  buildDesignerOutlinePreviewUrl,
  stashDesignerPreviewSession,
} from '../lib/designerPreviewSession';
import { useDesignerPreviewContext } from './useDesignerPreviewContext';
import { collectPreviewBindings } from './designerUtils';

export type UseDesignerPreviewParams = {
  state: DesignerState;
  selectedNode: DesignerNode | null | undefined;
  flashToolbarStatus: (message: string) => void;
  activeDraftId: string | null;
  hasUnsavedChanges: boolean;
  simulatedPreviewRole?: string;
};

export type UseDesignerPreviewResult = {
  previewState: DesignerPreviewRuntimeState;
  setPreviewState: React.Dispatch<React.SetStateAction<DesignerPreviewRuntimeState>>;
  isPreviewDialogOpen: boolean;
  setIsPreviewDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  previewSessionPath: string | null;
  handleRunPreview: () => Promise<void>;
  handleOpenOutlinePreview: () => Promise<void>;
  previewBindings: Record<string, DesignerBindingDefinition>;
  previewContext: ReturnType<typeof useDesignerPreviewContext>;
};

export const useDesignerPreview = ({
  state,
  selectedNode,
  flashToolbarStatus,
  activeDraftId,
  hasUnsavedChanges,
  simulatedPreviewRole = '',
}: UseDesignerPreviewParams): UseDesignerPreviewResult => {
  const previewContext = useDesignerPreviewContext();
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = React.useState(false);
  const [previewSessionPath, setPreviewSessionPath] = React.useState<string | null>(null);
  const [previewState, setPreviewState] = React.useState<DesignerPreviewRuntimeState>({
    isRunning: false,
    lastRunAt: null,
    diagnostics: [],
    results: {},
    logs: [],
  });

  const previewMutation = useRunComponentDesignerPreviewMutation();

  const previewBindings = React.useMemo(
    () => collectPreviewBindings(state.document, state.bindingDefinitions),
    [state.document, state.bindingDefinitions],
  );

  const executePreviewRuntime = React.useCallback(async () => {
    setPreviewState((previous) => ({ ...previous, isRunning: true, diagnostics: [] }));
    try {
      const response = await previewMutation.mutateAsync({
        bindingDefinitions: previewBindings,
        context: {
          globals: {
            documentId: state.document.id,
            documentName: state.document.name,
          },
          nodeProps: selectedNode?.props ?? {},
        },
      });
      setPreviewState({
        isRunning: false,
        lastRunAt: new Date().toISOString(),
        diagnostics: response.diagnostics,
        results: response.results,
        logs: response.logs,
      });
      flashToolbarStatus(response.diagnostics.length > 0 ? 'Preview completed with runtime issues.' : 'Preview completed.');
      return response.results;
    } catch (error) {
      const diagnostics = (error as Error & { diagnostics?: DesignerDiagnostic[] }).diagnostics ?? [
        {
          id: `binding-runtime:${Date.now()}`,
          code: 'binding-runtime',
          level: 'error',
          message: (error as Error).message || 'Failed to execute runtime preview.',
        },
      ];
      setPreviewState((previous) => ({
        ...previous,
        isRunning: false,
        lastRunAt: new Date().toISOString(),
        diagnostics,
      }));
      flashToolbarStatus((error as Error).message || 'Runtime preview failed.');
      return {};
    }
  }, [flashToolbarStatus, previewBindings, previewMutation, selectedNode?.props, state.document.id, state.document.name]);

  const handleRunPreview = React.useCallback(async () => {
    const useSessionPreview = activeDraftId === null || hasUnsavedChanges;

    if (useSessionPreview) {
      const previewResults = await executePreviewRuntime();
      const sessionId = stashDesignerPreviewSession({
        document: state.document,
        bindingDefinitions: state.bindingDefinitions,
        previewResults,
        createdAt: new Date().toISOString(),
        simulatedRole: simulatedPreviewRole.trim() || undefined,
      });
      setPreviewSessionPath(buildDesignerOutlinePreviewEmbeddedUrl(sessionId, {
        cultureId: previewContext.selectedCultureId,
        portalSegment: previewContext.selectedPortalSegment,
      }));
    } else {
      setPreviewSessionPath(null);
    }

    setIsPreviewDialogOpen(true);
  }, [
    activeDraftId,
    executePreviewRuntime,
    hasUnsavedChanges,
    previewContext.selectedCultureId,
    previewContext.selectedPortalSegment,
    state.bindingDefinitions,
    state.document,
    simulatedPreviewRole,
  ]);

  const handleOpenOutlinePreview = React.useCallback(async () => {
    const previewResults = await executePreviewRuntime();
    const sessionId = stashDesignerPreviewSession({
      document: state.document,
      bindingDefinitions: state.bindingDefinitions,
      previewResults,
      createdAt: new Date().toISOString(),
      simulatedRole: simulatedPreviewRole.trim() || undefined,
    });
    const previewUrl = buildDesignerOutlinePreviewUrl(sessionId, {
      cultureId: previewContext.selectedCultureId,
      portalSegment: previewContext.selectedPortalSegment,
    });
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
    flashToolbarStatus('Opened outline preview in a new tab.');
  }, [
    executePreviewRuntime,
    flashToolbarStatus,
    previewContext.selectedCultureId,
    previewContext.selectedPortalSegment,
    state.bindingDefinitions,
    state.document,
    simulatedPreviewRole,
  ]);

  return {
    previewState,
    setPreviewState,
    isPreviewDialogOpen,
    setIsPreviewDialogOpen,
    previewSessionPath,
    handleRunPreview,
    handleOpenOutlinePreview,
    previewBindings,
    previewContext,
  };
};
