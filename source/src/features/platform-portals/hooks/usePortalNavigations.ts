import { useCallback, useEffect, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import type { ExperienceManifestPortal } from '../../../shared/api/contracts/platform/experienceManifest';

import { portalSupportsNavigation } from '../../../shared/api/contracts/platform/experienceManifest';

import { isBuiltInNavigationId } from '../../../shared/api/contracts/platform/navigation';

import { formatQueryError } from '../../../shared/api/client';

import {

  createNavigationManifestRecord,

  deleteNavigationManifestRecord,

  renameNavigationManifestRecord,

  platformQueryKeys,

  updatePortalRecord,

  useNavigationManifestsQuery,

} from '../../../shared/api/queries/platform';

import { useNavigationManifestEditor } from '../../platform-navigations/hooks/useNavigationManifestEditor';



export function usePortalNavigations(

  portal: ExperienceManifestPortal | null,

  onPortalUpdated?: () => void,

) {

  const queryClient = useQueryClient();

  const portalSegment = portal?.segment?.trim() ?? '';

  const isRedirectPortal = portal ? !portalSupportsNavigation(portal) : true;

  const listQuery = useNavigationManifestsQuery({

    enabled: Boolean(portalSegment) && !isRedirectPortal,

    portalSegment,

  });



  const [formError, setFormError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  const [editorId, setEditorId] = useState<string | null>(null);

  const [isCreateMode, setIsCreateMode] = useState(false);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const initialSelectionAppliedRef = useRef(false);

  const sessionMutationRef = useRef<'create' | 'rename' | 'delete' | null>(null);

  const pendingEditorIdRef = useRef<string | null>(null);

  const suppressCloseUntilRef = useRef(0);

  const blockModalCloseRef = useRef(false);

  const closeProtectionActiveRef = useRef(false);

  const pendingNavigationDeleteRef = useRef(false);



  const editor = useNavigationManifestEditor(editorId);



  const initCreateDraft = useCallback((id = '') => {

    if (!portalSegment) {

      return;

    }

    editor.initDraft({

      id,

      version: '1',

      portalSegment,

      groups: [],

    });

  }, [editor, portalSegment]);



  useEffect(() => {

    if (!isCreateMode || !portalSegment || editor.workingManifest) {

      return;

    }

    initCreateDraft();

  }, [editor.workingManifest, initCreateDraft, isCreateMode, portalSegment]);



  useEffect(() => {

    if (!editorId && !isCreateMode) {

      editor.resetEditorState();

    }

  }, [editor, editorId, isCreateMode]);



  const items = listQuery.data ?? [];



  useEffect(() => {

    initialSelectionAppliedRef.current = false;

    setEditorId(null);

    setIsCreateMode(false);

    setFormError(null);

    setDeleteTargetId(null);

  }, [portalSegment]);



  useEffect(() => {

    if (listQuery.isLoading) {

      return;

    }



    if (items.length === 0 && listQuery.isFetching) {

      return;

    }



    if (!initialSelectionAppliedRef.current) {

      initialSelectionAppliedRef.current = true;



      if (items.length === 0) {

        if (sessionMutationRef.current === null) {

          setIsCreateMode(true);

          setEditorId(null);

        }

        return;

      }



      setIsCreateMode(false);

      setEditorId(items[0]!.id);

      return;

    }



    const pendingEditorId = pendingEditorIdRef.current;

    if (pendingEditorId) {

      if (items.some((item) => item.id === pendingEditorId)) {

        pendingEditorIdRef.current = null;

        sessionMutationRef.current = null;

        setIsCreateMode(false);

        setEditorId(pendingEditorId);

        return;

      }

      if (listQuery.isFetching || listQuery.isLoading) {

        return;

      }

    }



    if (sessionMutationRef.current === 'rename' || sessionMutationRef.current === 'create' || sessionMutationRef.current === 'delete') {

      return;

    }



    setEditorId((current) => {

      if (current && items.some((item) => item.id === current)) {

        return current;

      }



      if (items.length === 0) {

        setIsCreateMode(true);

        return null;

      }



      setIsCreateMode(false);

      return items[0]!.id;

    });

  }, [items, listQuery.isFetching, listQuery.isLoading]);



  const primaryNavigationRef = portal?.navigationRef?.trim() || portalSegment;



  const invalidateAfterMutation = useCallback(async (options?: {
    notifyPortal?: boolean;
    skipManifest?: boolean;
  }) => {

    await queryClient.invalidateQueries({ queryKey: platformQueryKeys.navigations() });

    if (!options?.skipManifest) {

      await queryClient.invalidateQueries({ queryKey: platformQueryKeys.experienceManifest('admin') });

      await queryClient.invalidateQueries({ queryKey: platformQueryKeys.runtimeConfig() });

    }

    await listQuery.refetch();

    if (options?.notifyPortal !== false) {

      onPortalUpdated?.();

    }

  }, [listQuery, onPortalUpdated, queryClient]);



  const beginModalCloseProtection = useCallback(() => {

    blockModalCloseRef.current = true;

    closeProtectionActiveRef.current = true;

    suppressCloseUntilRef.current = Date.now() + 3000;

  }, []);



  const endModalCloseProtection = useCallback(() => {

    window.setTimeout(() => {

      blockModalCloseRef.current = false;

      closeProtectionActiveRef.current = false;

      suppressCloseUntilRef.current = Date.now() + 1200;

    }, 600);

  }, []);



  const isModalCloseBlocked = useCallback(() => (

    blockModalCloseRef.current

    || isSaving

    || sessionMutationRef.current !== null

    || pendingNavigationDeleteRef.current

    || Date.now() < suppressCloseUntilRef.current

  ), [isSaving]);



  const shouldSwallowModalEnter = useCallback(() => (

    blockModalCloseRef.current

    || closeProtectionActiveRef.current

    || sessionMutationRef.current !== null

    || pendingNavigationDeleteRef.current

    || Date.now() < suppressCloseUntilRef.current

  ), []);



  useEffect(() => {

    const swallowEnter = (event: KeyboardEvent) => {

      if (event.key !== 'Enter' || !shouldSwallowModalEnter()) {

        return;

      }

      event.preventDefault();

      event.stopImmediatePropagation();

    };



    window.addEventListener('keydown', swallowEnter, true);

    window.addEventListener('keyup', swallowEnter, true);

    return () => {

      window.removeEventListener('keydown', swallowEnter, true);

      window.removeEventListener('keyup', swallowEnter, true);

    };

  }, [shouldSwallowModalEnter]);



  const selectNavigation = useCallback((id: string) => {

    setFormError(null);

    setIsCreateMode(false);

    setEditorId(id);

  }, []);



  const startCreateNavigation = useCallback(() => {

    setFormError(null);

    setIsCreateMode(true);

    setEditorId(null);

    editor.resetEditorState();

    initCreateDraft();

  }, [editor, initCreateDraft]);



  const updateCreateId = useCallback((id: string) => {

    const manifest = editor.workingManifest;

    if (!manifest) {

      initCreateDraft(id);

      return;

    }

    editor.initDraft({ ...manifest, id });

  }, [editor, initCreateDraft]);



  const createManifest = useCallback(async (): Promise<boolean> => {

    const manifest = editor.workingManifest;

    const id = manifest?.id.trim() ?? '';

    if (!id) {

      setFormError('Navigation id is required.');

      return false;

    }

    if (!portalSegment) {

      setFormError('Portal segment is required.');

      return false;

    }

    if (items.some((item) => item.id === id)) {

      setFormError(`Navigation "${id}" already exists.`);

      return false;

    }



    setFormError(null);

    beginModalCloseProtection();

    setIsSaving(true);

    sessionMutationRef.current = 'create';



    try {

      await createNavigationManifestRecord({

        ...manifest,

        id,

        portalSegment,

      });

      pendingEditorIdRef.current = id;

      setIsCreateMode(false);

      setEditorId(id);

      editor.resetEditorState();

      await invalidateAfterMutation();



      window.setTimeout(() => {

        endModalCloseProtection();

      }, 800);

      return true;

    } catch (caught) {

      sessionMutationRef.current = null;

      pendingEditorIdRef.current = null;

      setFormError(formatQueryError(caught, 'Failed to create navigation manifest.'));

      endModalCloseProtection();

      return false;

    } finally {

      setIsSaving(false);

    }

  }, [
    beginModalCloseProtection,
    editor,
    endModalCloseProtection,
    invalidateAfterMutation,
    items,
    portalSegment,
  ]);



  const savePortalNavigation = useCallback(async (): Promise<void> => {

    if (isCreateMode) {

      await createManifest();

      return;

    }

    await editor.saveEditor();

  }, [createManifest, editor, isCreateMode]);



  const canSavePortalNavigation = Boolean(

    isCreateMode

      ? editor.workingManifest?.id.trim()

        && !items.some((item) => item.id === editor.workingManifest?.id.trim())

        && !editor.jsonError

        && !isSaving

      : editor.canSaveEditor,

  );



  const renameNavigation = useCallback(async (oldId: string, nextId: string): Promise<boolean> => {

    const newId = nextId.trim();

    if (!newId) {

      setFormError('Navigation id is required.');

      return false;

    }

    if (newId === oldId) {

      return true;

    }

    if (isBuiltInNavigationId(oldId)) {

      setFormError('Built-in navigation cannot be renamed.');

      return false;

    }

    if (items.some((item) => item.id === newId)) {

      setFormError(`Navigation "${newId}" already exists.`);

      return false;

    }

    if (!portalSegment) {

      setFormError('Portal segment is required.');

      return false;

    }



    const manifest = editor.workingManifest;

    if (!manifest || manifest.id !== oldId) {

      setFormError('Navigation manifest is not loaded.');

      return false;

    }



    setFormError(null);

    beginModalCloseProtection();

    setIsSaving(true);

    sessionMutationRef.current = 'rename';



    try {

      await renameNavigationManifestRecord(oldId, newId);



      pendingEditorIdRef.current = newId;

      setIsCreateMode(false);

      setEditorId(newId);

      await invalidateAfterMutation({ notifyPortal: false, skipManifest: true });

      return true;

    } catch (caught) {

      sessionMutationRef.current = null;

      pendingEditorIdRef.current = null;

      setFormError(formatQueryError(caught, 'Failed to rename navigation manifest.'));

      return false;

    } finally {

      setIsSaving(false);

    }

  }, [
    beginModalCloseProtection,
    editor.workingManifest,
    invalidateAfterMutation,
    items,
    portalSegment,
  ]);



  const removeManifest = useCallback(async (id: string) => {

    setFormError(null);

    beginModalCloseProtection();

    pendingNavigationDeleteRef.current = true;

    setIsSaving(true);

    sessionMutationRef.current = 'delete';



    try {

      const remaining = items.filter((item) => item.id !== id);

      const isPrimary = primaryNavigationRef === id;

      const replacementId = remaining[0]?.id ?? null;



      await deleteNavigationManifestRecord(id, {

        replacementNavigationRef: isPrimary ? replacementId : undefined,

      });



      if (isPrimary && portal) {

        await updatePortalRecord(portal.segment, {

          ...portal,

          navigationRef: replacementId ?? undefined,

        });

      }



      if (editorId === id) {

        if (remaining.length === 0) {

          pendingEditorIdRef.current = null;

          setIsCreateMode(true);

          setEditorId(null);

          initCreateDraft();

        } else {

          const nextId = remaining[0]!.id;

          pendingEditorIdRef.current = nextId;

          setIsCreateMode(false);

          setEditorId(nextId);

        }

      }



      await invalidateAfterMutation();

      suppressCloseUntilRef.current = Date.now() + 2500;



      window.setTimeout(() => {

        setDeleteTargetId(null);

        sessionMutationRef.current = null;

        pendingNavigationDeleteRef.current = false;

        endModalCloseProtection();

      }, 100);

    } catch (caught) {

      sessionMutationRef.current = null;

      pendingNavigationDeleteRef.current = false;

      setFormError(formatQueryError(caught, 'Failed to delete navigation manifest.'));

      endModalCloseProtection();

      throw caught;

    } finally {

      setIsSaving(false);

    }

  }, [
    beginModalCloseProtection,
    editorId,
    endModalCloseProtection,
    initCreateDraft,
    invalidateAfterMutation,
    items,
    portal,
    primaryNavigationRef,
  ]);



  const setPrimaryNavigation = useCallback(async (navigationId: string) => {

    if (!portal) {

      return;

    }



    setFormError(null);

    setIsSaving(true);



    try {

      await updatePortalRecord(portal.segment, {

        ...portal,

        navigationRef: navigationId,

      });

      await invalidateAfterMutation();

    } catch (caught) {

      setFormError(formatQueryError(caught, 'Failed to set primary navigation.'));

      throw caught;

    } finally {

      setIsSaving(false);

    }

  }, [invalidateAfterMutation, portal]);



  return {

    suppressCloseUntilRef,

    beginModalCloseProtection,

    endModalCloseProtection,

    isModalCloseBlocked,

    portal,

    isRedirectPortal,

    listQuery,

    items,

    primaryNavigationRef,

    formError,

    setFormError,

    isSaving,

    editorId,

    isCreateMode,

    editor,

    selectNavigation,

    startCreateNavigation,

    updateCreateId,

    createManifest,

    savePortalNavigation,

    canSavePortalNavigation,

    renameNavigation,

    deleteTargetId,

    setDeleteTargetId,

    removeManifest,

    setPrimaryNavigation,

    isBuiltInNavigationId,

  };

}



export type PortalNavigationsModel = ReturnType<typeof usePortalNavigations>;

