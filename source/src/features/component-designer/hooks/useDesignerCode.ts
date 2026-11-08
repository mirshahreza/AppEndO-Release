import * as React from 'react';
import {
  generateDesignerJsonString,
  generateDesignerTsxDisplay,
  syncCodeToCanvas,
  type DesignerCodeFormat,
} from '../../../domain/component-designer/codegen';
import type { DesignerAction, DesignerDiagnostic, DesignerState } from '../../../domain/component-designer/types';
import { createDraftFingerprint } from './designerUtils';
import { DESIGNER_CODE_TAB_ORDER, type DesignerCodeTab } from './types';

export const CODE_SYNC_DEBOUNCE_MS = 450;

/** Drop a hydrated companion TSX lock once the canvas document has moved on. */
export const shouldReleaseCompanionTsxLock = (
  tsxDirty: boolean,
  lockedFingerprint: string | null,
  currentFingerprint: string,
): boolean => {
  if (tsxDirty || lockedFingerprint === null) {
    return false;
  }
  return currentFingerprint !== lockedFingerprint;
};

export type UseDesignerCodeParams = {
  state: DesignerState;
  dispatch: React.Dispatch<DesignerAction>;
};

export type UseDesignerCodeResult = {
  activeCodeTab: DesignerCodeTab;
  setActiveCodeTab: React.Dispatch<React.SetStateAction<DesignerCodeTab>>;
  codeDraft: { tsx: string; tsxDirty: boolean };
  setCodeDraft: React.Dispatch<React.SetStateAction<{ tsx: string; tsxDirty: boolean }>>;
  setLastEditedFormat: React.Dispatch<React.SetStateAction<DesignerCodeFormat | null>>;
  resetCodeFromGenerated: () => void;
  loadCodeFromCompanionTsx: (
    tsx: string,
    snapshot?: {
      document: DesignerState['document'];
      bindingDefinitions: DesignerState['bindingDefinitions'];
    },
  ) => void;
  handleCodeTabKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  generatedJson: string;
  generatedTsx: string;
  codeDiagnostics: DesignerDiagnostic[];
};

export const useDesignerCode = ({
  state,
  dispatch,
}: UseDesignerCodeParams): UseDesignerCodeResult => {
  const [activeCodeTab, setActiveCodeTab] = React.useState<DesignerCodeTab>('tsx');
  const [codeDraft, setCodeDraft] = React.useState<{ tsx: string; tsxDirty: boolean }>({
    tsx: '',
    tsxDirty: false,
  });
  const [lastEditedFormat, setLastEditedFormat] = React.useState<DesignerCodeFormat | null>(null);

  const syncInFlightRef = React.useRef(false);
  const syncReentrancyLockRef = React.useRef(false);
  const codeDraftRef = React.useRef(codeDraft);
  const lastEditedFormatRef = React.useRef(lastEditedFormat);
  const documentIdRef = React.useRef(state.document.id);
  const stateRef = React.useRef(state);
  const lastSyncedDocumentFingerprintRef = React.useRef<string | null>(null);
  const generatedTsxRef = React.useRef('');
  const forceResetOnNextGenerateRef = React.useRef(false);
  const companionTsxLockRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  React.useEffect(() => {
    codeDraftRef.current = codeDraft;
  }, [codeDraft]);

  React.useEffect(() => {
    lastEditedFormatRef.current = lastEditedFormat;
  }, [lastEditedFormat]);

  const generatedJson = React.useMemo(
    () => generateDesignerJsonString(state.document, state.bindingDefinitions),
    [state.document, state.bindingDefinitions],
  );

  const generatedTsx = React.useMemo(
    () => generateDesignerTsxDisplay(state.document, state.bindingDefinitions),
    [state.document, state.bindingDefinitions],
  );

  React.useEffect(() => {
    generatedTsxRef.current = generatedTsx;
  }, [generatedTsx]);

  const resetCodeFromGenerated = React.useCallback(() => {
    companionTsxLockRef.current = null;
    forceResetOnNextGenerateRef.current = true;
  }, []);

  const loadCodeFromCompanionTsx = React.useCallback((
    tsx: string,
    snapshot?: {
      document: DesignerState['document'];
      bindingDefinitions: DesignerState['bindingDefinitions'];
    },
  ) => {
    const document = snapshot?.document ?? stateRef.current.document;
    const bindingDefinitions = snapshot?.bindingDefinitions ?? stateRef.current.bindingDefinitions;
    companionTsxLockRef.current = tsx;
    syncInFlightRef.current = false;
    syncReentrancyLockRef.current = false;
    forceResetOnNextGenerateRef.current = false;
    lastSyncedDocumentFingerprintRef.current = createDraftFingerprint(document, bindingDefinitions);
    setLastEditedFormat(null);
    setCodeDraft({
      tsx: tsx,
      tsxDirty: false,
    });
    dispatch({ type: 'clear-sync-diagnostics' });
  }, [dispatch]);

  const applyGeneratedCodeDraft = React.useCallback(() => {
    companionTsxLockRef.current = null;
    syncInFlightRef.current = false;
    lastSyncedDocumentFingerprintRef.current = null;
    setLastEditedFormat(null);
    setCodeDraft({
      tsx: generatedTsxRef.current,
      tsxDirty: false,
    });
    dispatch({ type: 'clear-sync-diagnostics' });
  }, [dispatch]);

  React.useEffect(() => {
    if (!forceResetOnNextGenerateRef.current) {
      return;
    }

    forceResetOnNextGenerateRef.current = false;
    applyGeneratedCodeDraft();
  }, [applyGeneratedCodeDraft, generatedJson, generatedTsx, state.bindingDefinitions, state.document]);

  React.useEffect(() => {
    if (codeDraft.tsxDirty) {
      companionTsxLockRef.current = null;
    }
  }, [codeDraft.tsxDirty]);

  React.useEffect(() => {
    if (documentIdRef.current === state.document.id) {
      return;
    }

    documentIdRef.current = state.document.id;
    if (companionTsxLockRef.current) {
      return;
    }

    applyGeneratedCodeDraft();
  }, [applyGeneratedCodeDraft, state.document.id]);

  React.useEffect(() => {
    const currentDocFingerprint = createDraftFingerprint(state.document, state.bindingDefinitions);
    if (syncInFlightRef.current) {
      if (
        lastSyncedDocumentFingerprintRef.current !== null
        && currentDocFingerprint === lastSyncedDocumentFingerprintRef.current
      ) {
        companionTsxLockRef.current = null;
        setCodeDraft((previous) => ({
          ...previous,
          tsx: generatedTsx,
          tsxDirty: false,
        }));
        syncInFlightRef.current = false;
      }
      return;
    }

    if (
      companionTsxLockRef.current
      && shouldReleaseCompanionTsxLock(
        codeDraftRef.current.tsxDirty,
        lastSyncedDocumentFingerprintRef.current,
        currentDocFingerprint,
      )
    ) {
      companionTsxLockRef.current = null;
    }

    setCodeDraft((previous) => ({
      ...previous,
      tsx: previous.tsxDirty ? previous.tsx : (companionTsxLockRef.current ?? generatedTsx),
    }));
  }, [generatedTsx, state.bindingDefinitions, state.document]);

  React.useEffect(() => {
    const hasDirtyCode = codeDraft.tsxDirty;
    if (!hasDirtyCode) {
      return;
    }

    const handle = window.setTimeout(() => {
      if (syncReentrancyLockRef.current) {
        return;
      }

      const draft = codeDraftRef.current;
      if (!draft.tsxDirty) {
        return;
      }

      syncReentrancyLockRef.current = true;

      try {
        const currentFingerprint = createDraftFingerprint(stateRef.current.document, stateRef.current.bindingDefinitions);
        const syncResult = syncCodeToCanvas({
          format: 'tsx',
          code: draft.tsx,
          currentDocument: stateRef.current.document,
          currentBindingDefinitions: stateRef.current.bindingDefinitions,
        });

        if ('diagnostics' in syncResult) {
          dispatch({ type: 'set-sync-diagnostics', diagnostics: syncResult.diagnostics });
          return;
        }

        const nextFingerprint = createDraftFingerprint(syncResult.document, syncResult.bindingDefinitions);

        if (nextFingerprint === currentFingerprint) {
          setCodeDraft((previous) => ({
            ...previous,
            tsxDirty: false,
          }));
          dispatch({ type: 'clear-sync-diagnostics' });
          return;
        }

        lastSyncedDocumentFingerprintRef.current = nextFingerprint;
        syncInFlightRef.current = true;

        dispatch({
          type: 'replace-document-from-code',
          document: syncResult.document,
          bindingDefinitions: syncResult.bindingDefinitions,
          preferredSelectedNodeId: stateRef.current.selectedNodeId,
        });

        setCodeDraft((previous) => ({
          ...previous,
          tsxDirty: false,
        }));
        dispatch({ type: 'clear-sync-diagnostics' });
      } finally {
        syncReentrancyLockRef.current = false;
      }
    }, CODE_SYNC_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(handle);
    };
  }, [codeDraft.tsx, codeDraft.tsxDirty, dispatch]);

  const handleCodeTabKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = DESIGNER_CODE_TAB_ORDER.indexOf(activeCodeTab);
    if (currentIndex < 0) {
      return;
    }

    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % DESIGNER_CODE_TAB_ORDER.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + DESIGNER_CODE_TAB_ORDER.length) % DESIGNER_CODE_TAB_ORDER.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = DESIGNER_CODE_TAB_ORDER.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextTab = DESIGNER_CODE_TAB_ORDER[nextIndex];
    setActiveCodeTab(nextTab);

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        const tabButton = document.getElementById(`designer-code-tab-${nextTab}`) as HTMLButtonElement | null;
        tabButton?.focus();
      });
    }
  }, [activeCodeTab]);

  const codeDiagnostics = React.useMemo(
    () => state.syncDiagnostics.filter((item) => item.code === 'parse-json' || item.code === 'parse-tsx' || item.code === 'sync-error'),
    [state.syncDiagnostics],
  );

  return {
    activeCodeTab,
    setActiveCodeTab,
    codeDraft,
    setCodeDraft,
    setLastEditedFormat,
    resetCodeFromGenerated,
    loadCodeFromCompanionTsx,
    handleCodeTabKeyDown,
    generatedJson,
    generatedTsx,
    codeDiagnostics,
  };
};
