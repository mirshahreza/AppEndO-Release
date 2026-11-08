import { useState } from 'react';
import {
  useCreateServerFunctionMutation,
  useDeleteServerFunctionMutation,
  useUpdateBuiltinServerFunctionMutation,
  useUpdateServerFunctionMutation,
} from '../../../shared/api/queries/server-functions';
import { DEFAULT_SERVER_FUNCTION_LANGUAGE } from '../constants';
import { createScriptDraftDefaults } from '../lib/scriptDraftDefaults';
import { buildBuiltinFunctionMetadataPayload, buildManagedFunctionPayload } from '../mappers';
import { isPackageServerFunction } from '../../../shared/api/contracts/server-functions/packageFunctions';
import type { FunctionAccessControl } from '../../../shared/api/contracts/server-functions/accessControl';
import {
  buildServerFunctionCatalogPath,
  buildServerFunctionPreviewPath,
  isServerFunctionIdentityTaken,
  normalizeServerFunctionFolder,
  normalizeServerFunctionName,
  suggestDuplicateServerFunctionName,
} from '../lib/duplicateServerFunctionIdentity';
import { buildServerFunctionTemplate } from '../templates';
import type { ServerFunctionItem } from '../types';
import {
  readServerFunctionCatalogTags,
  withServerFunctionCatalogTags,
} from '../../../shared/lib/serverFunctionCatalogTags';
import { normalizeCatalogTags } from '../../../shared/lib/catalogTags';
import { clearServerFunctionDraft, patchServerFunctionDraft } from './serverFunctionDraftCache';
import type { ServerFunctionCatalogState } from './useServerFunctionCatalog';
import type { ServerFunctionEditorState } from './useServerFunctionEditor';
import type { ServerFunctionSettingsState } from './useServerFunctionSettings';

const DEFAULT_CUSTOM_FOLDER = 'general';

const cloneAccessControl = (accessControl: FunctionAccessControl): FunctionAccessControl => ({
  ...accessControl,
  allowRoles: [...accessControl.allowRoles],
  allowUsers: [...accessControl.allowUsers],
  denyRoles: [...accessControl.denyRoles],
  denyUsers: [...accessControl.denyUsers],
});

const cloneServerFunctionForAccess = (source: ServerFunctionItem): ServerFunctionItem => ({
  ...source,
  accessControl: cloneAccessControl(source.accessControl),
});

const cloneServerFunctionForSettings = (source: ServerFunctionItem): ServerFunctionItem => ({
  ...source,
  accessControl: cloneAccessControl(source.accessControl),
  metadataJson: source.metadataJson ? structuredClone(source.metadataJson) : null,
  hooks: source.hooks ? structuredClone(source.hooks) : source.hooks,
});

type UseServerFunctionActionsInput = {
  catalog: ServerFunctionCatalogState;
  editor: ServerFunctionEditorState;
  settings: ServerFunctionSettingsState;
  addLog: (msg: string, type?: 'info' | 'success' | 'warn') => void;
  showToast: (type: 'success' | 'error', text: string) => void;
};

export function useServerFunctionActions({ catalog, editor, settings, addLog, showToast }: UseServerFunctionActionsInput) {
  const createServerFunctionMutation = useCreateServerFunctionMutation();
  const updateServerFunctionMutation = useUpdateServerFunctionMutation();
  const updateBuiltinServerFunctionMutation = useUpdateBuiltinServerFunctionMutation();
  const deleteServerFunctionMutation = useDeleteServerFunctionMutation();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState<ServerFunctionItem | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const [accessTarget, setAccessTarget] = useState<ServerFunctionItem | null>(null);
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [isHooksOpen, setIsHooksOpen] = useState(false);
  const [newFuncName, setNewFuncName] = useState('');
  const [newFuncTags, setNewFuncTags] = useState<string[]>([]);
  const [newFuncMethod, setNewFuncMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [isCreatingFromDraft, setIsCreatingFromDraft] = useState(false);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<ServerFunctionItem | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateTags, setDuplicateTags] = useState<string[]>([]);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameSource, setRenameSource] = useState<ServerFunctionItem | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameTags, setRenameTags] = useState<string[]>([]);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  const openCreateDialog = () => {
    setNewFuncName('');
    setNewFuncTags([]);
    setNewFuncMethod('GET');
    setIsCreateOpen(true);
  };

  const handleCreateFunction = async () => {
    if (!newFuncName.trim()) return;

    const folderSlug = DEFAULT_CUSTOM_FOLDER;
    const nameSlug = normalizeServerFunctionName(newFuncName);
    if (!nameSlug) {
      showToast('error', 'Name is required.');
      return;
    }
    if (isServerFunctionIdentityTaken(catalog.functions, folderSlug, nameSlug)) {
      showToast('error', `A function named "${nameSlug}" already exists.`);
      return;
    }

    const path = buildServerFunctionCatalogPath(nameSlug);
    const newId = `fn-${Math.random().toString(36).substring(2, 9)}`;
    const catalogTags = normalizeCatalogTags(newFuncTags);

    const newFn: ServerFunctionItem = {
      id: newId,
      name: nameSlug,
      folder: folderSlug,
      method: newFuncMethod,
      path,
      code: buildServerFunctionTemplate(newFuncMethod, path, nameSlug),
      language: DEFAULT_SERVER_FUNCTION_LANGUAGE,
      testPayload: `{\n  "payload": "Default template input data"\n}`,
      memoryLimit: settings.globalDefaultRAM,
      timeoutMs: settings.globalDefaultTimeout,
      runtimeVersion: settings.globalDefaultVMMode,
      useGlobalConfig: true,
      enableLogs: true,
      cacheEnabled: false,
      cacheTtlMs: 3600000,
      accessControl: { allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
      metadataJson: withServerFunctionCatalogTags(null, catalogTags),
      ...createScriptDraftDefaults(),
    };

    try {
      const { response, data } = await createServerFunctionMutation.mutateAsync(buildManagedFunctionPayload(newFn));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create function in API.');
      }

      newFn.id = String(data.id || newId);
      catalog.upsertCatalogFunction(newFn);
      catalog.setActiveId(newFn.id);
    } catch (error: any) {
      const message = error?.message || 'Failed to create function.';
      addLog(message, 'warn');
      showToast('error', message);
      return;
    }
    setNewFuncName('');
    setNewFuncTags([]);
    setIsCreateOpen(false);

    addLog(`Created new dynamic proxy mapping at: ${path}`, 'success');
    showToast('success', `Created edge route ${path}`);
  };

  const handleBulkApply = () => {
    catalog.filteredFunctions.forEach((fn) => {
      if (fn.isBuiltIn) {
        return;
      }
      patchServerFunctionDraft(catalog.queryClient, fn.id, {
        runtimeVersion: settings.bulkVMMode,
        memoryLimit: settings.bulkRAM,
        timeoutMs: settings.bulkTimeout,
      });
    });
    catalog.bumpDraftRevision();

    addLog(`Bulk updated ${catalog.filteredFunctions.length} ${catalog.filteredFunctions.length === 1 ? 'route' : 'routes'} VM config: Mode=${settings.bulkVMMode}, RAM=${settings.bulkRAM}MB, Timeout=${settings.bulkTimeout}ms.`, 'success');

    const currentIsMatched = catalog.filteredFunctions.some((f) => f.id === catalog.activeId);
    if (currentIsMatched) {
      settings.setTestVMMode(settings.bulkVMMode);
      settings.setTestRAM(settings.bulkRAM);
      settings.setTestTimeout(settings.bulkTimeout);
    }

    settings.setIsBulkOpen(false);
  };

  const handleCreateFromDraft = async (identityOverride?: { folder: string; name: string }) => {
    const rawName = identityOverride?.name ?? editor.draftFn.name;
    if (!rawName.trim() || isCreatingFromDraft) return;

    const folderSlug = DEFAULT_CUSTOM_FOLDER;
    const nameSlug = normalizeServerFunctionName(rawName);
    if (!nameSlug) return;
    const path = buildServerFunctionCatalogPath(nameSlug);
    const code = editor.draftCodeIsAutoGeneratedRef.current
      ? buildServerFunctionTemplate(editor.draftFn.method, path)
      : editor.draftFn.code;
    const newId = `fn-${Math.random().toString(36).substring(2, 9)}`;

    const newFn: ServerFunctionItem = {
      id: newId,
      name: nameSlug,
      folder: folderSlug,
      method: editor.draftFn.method,
      path,
      code,
      language: editor.draftFn.language,
      testPayload: editor.draftFn.testPayload,
      memoryLimit: editor.draftFn.memoryLimit,
      timeoutMs: editor.draftFn.timeoutMs,
      runtimeVersion: editor.draftFn.runtimeVersion,
      useGlobalConfig: editor.draftFn.useGlobalConfig,
      enableLogs: editor.draftFn.enableLogs,
      isBuiltIn: editor.draftFn.isBuiltIn || false,
      cacheEnabled: editor.draftFn.cacheEnabled,
      cacheTtlMs: editor.draftFn.cacheTtlMs,
      accessControl: editor.draftFn.accessControl,
      engineType: editor.draftFn.engineType ?? 'SANDBOX_JS',
      metadataJson: editor.draftFn.metadataJson ?? null,
    };

    setIsCreatingFromDraft(true);
    try {
      const { response, data } = await createServerFunctionMutation.mutateAsync(buildManagedFunctionPayload(newFn));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create function.');
      }

      newFn.id = String(data.id || newId);
      catalog.upsertCatalogFunction(newFn);
      catalog.setActiveId(newFn.id);
    } catch (error: any) {
      const message = error?.message || 'Failed to create function.';
      addLog(message, 'warn');
      showToast('error', message);
      return;
    } finally {
      setIsCreatingFromDraft(false);
    }

    editor.draftCodeIsAutoGeneratedRef.current = true;
    editor.setDraftFn({
      name: '',
      folder: '',
      method: 'GET',
      code: buildServerFunctionTemplate('GET', '/api/hello-world', 'hello-world'),
      language: DEFAULT_SERVER_FUNCTION_LANGUAGE,
      testPayload: `{\n  "payload": "Default template input data"\n}`,
      memoryLimit: settings.globalDefaultRAM,
      timeoutMs: settings.globalDefaultTimeout,
      runtimeVersion: settings.globalDefaultVMMode,
      useGlobalConfig: true,
      enableLogs: true,
      cacheEnabled: false,
      cacheTtlMs: 3600000,
      accessControl: { allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
      ...createScriptDraftDefaults(),
    });

    addLog(`Created new dynamic proxy mapping at: ${path}`, 'success');
    showToast('success', `Created edge route ${path}`);
  };

  const closeDuplicateDialog = () => {
    setIsDuplicateOpen(false);
    setDuplicateSource(null);
    setDuplicateName('');
    setDuplicateTags([]);
    setDuplicateError(null);
  };

  const updateDuplicateName = (value: string) => {
    setDuplicateName(value);
    setDuplicateError(null);
  };

  const openDuplicateDialog = (sourceOverride?: ServerFunctionItem) => {
    const source = sourceOverride ?? editor.activeFn;
    if (!source) {
      return;
    }

    setDuplicateSource(source);
    setDuplicateName(suggestDuplicateServerFunctionName(DEFAULT_CUSTOM_FOLDER, source.name, catalog.functions));
    setDuplicateTags(readServerFunctionCatalogTags(source.metadataJson));
    setDuplicateError(null);
    setIsDuplicateOpen(true);
  };

  const confirmDuplicateToDraft = async () => {
    if (!duplicateSource || isDuplicating) {
      return;
    }

    const name = duplicateName.trim();
    if (!name) {
      setDuplicateError('Name is required.');
      return;
    }

    const folderSlug = DEFAULT_CUSTOM_FOLDER;
    if (isServerFunctionIdentityTaken(catalog.functions, folderSlug, name)) {
      const previewPath = buildServerFunctionCatalogPath(name);
      setDuplicateError(`A function already exists at ${previewPath}. Choose a different name.`);
      return;
    }

    const nameSlug = normalizeServerFunctionName(name);
    const path = buildServerFunctionCatalogPath(nameSlug);
    const newId = `fn-${Math.random().toString(36).substring(2, 9)}`;

    const newFn: ServerFunctionItem = {
      id: newId,
      name: nameSlug,
      folder: folderSlug,
      method: duplicateSource.method,
      path,
      code: duplicateSource.code,
      language: duplicateSource.language,
      testPayload: duplicateSource.testPayload,
      memoryLimit: duplicateSource.memoryLimit,
      timeoutMs: duplicateSource.timeoutMs,
      runtimeVersion: duplicateSource.runtimeVersion,
      useGlobalConfig: duplicateSource.useGlobalConfig,
      enableLogs: duplicateSource.enableLogs,
      cacheEnabled: duplicateSource.cacheEnabled,
      cacheTtlMs: duplicateSource.cacheTtlMs,
      cacheByParam: duplicateSource.cacheByParam,
      cacheByUser: duplicateSource.cacheByUser,
      engineType: duplicateSource.engineType,
      metadataJson: withServerFunctionCatalogTags(
        duplicateSource.metadataJson ? structuredClone(duplicateSource.metadataJson) : null,
        duplicateTags,
      ),
      accessControl: {
        ...duplicateSource.accessControl,
        allowRoles: [...duplicateSource.accessControl.allowRoles],
        allowUsers: [...duplicateSource.accessControl.allowUsers],
        denyRoles: [...duplicateSource.accessControl.denyRoles],
        denyUsers: [...duplicateSource.accessControl.denyUsers],
      },
    };

    setIsDuplicating(true);
    try {
      const { response, data } = await createServerFunctionMutation.mutateAsync(buildManagedFunctionPayload(newFn));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to duplicate function.');
      }

      newFn.id = String(data.id || newId);
      catalog.upsertCatalogFunction(newFn);
      catalog.setActiveId(newFn.id);

      addLog(`Duplicated ${duplicateSource.path} to ${path}.`, 'success');
      showToast('success', `Duplicated to ${path}`);
      closeDuplicateDialog();
    } catch (error: any) {
      const message = error?.message || 'Failed to duplicate function.';
      setDuplicateError(message);
      addLog(message, 'warn');
      showToast('error', message);
    } finally {
      setIsDuplicating(false);
    }
  };

  const closeRenameDialog = () => {
    setIsRenameOpen(false);
    setRenameSource(null);
    setRenameName('');
    setRenameTags([]);
    setRenameError(null);
  };

  const openRenameDialog = (source: ServerFunctionItem) => {
    if (source.isBuiltIn || isPackageServerFunction(source)) {
      addLog(`"${source.name}" cannot be renamed here.`, 'warn');
      return;
    }
    setRenameSource(source);
    setRenameName(source.name);
    setRenameTags(readServerFunctionCatalogTags(source.metadataJson));
    setRenameError(null);
    setIsRenameOpen(true);
  };

  const confirmRenameFromList = async () => {
    if (!renameSource || isRenaming) {
      return;
    }

    const nameSlug = normalizeServerFunctionName(renameName);
    if (!nameSlug) {
      setRenameError('Name is required.');
      return;
    }

    const folderSlug = normalizeServerFunctionFolder(renameSource.folder) || DEFAULT_CUSTOM_FOLDER;
    if (isServerFunctionIdentityTaken(catalog.functions, folderSlug, nameSlug, renameSource.id)) {
      setRenameError(`A function named "${nameSlug}" already exists.`);
      return;
    }

    const nextPath = buildServerFunctionCatalogPath(nameSlug);
    const nextFn: ServerFunctionItem = {
      ...renameSource,
      name: nameSlug,
      folder: folderSlug,
      path: nextPath,
      metadataJson: withServerFunctionCatalogTags(renameSource.metadataJson, renameTags),
    };

    setIsRenaming(true);
    try {
      const { response, data } = await updateServerFunctionMutation.mutateAsync({
        id: renameSource.id,
        payload: buildManagedFunctionPayload(nextFn),
      });
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to rename function.');
      }

      const savedId = String(data.id || `${folderSlug}.${nameSlug}`);
      const savedFn = { ...nextFn, id: savedId };
      catalog.replaceCatalogFunctionIdentity(renameSource.id, savedFn);
      if (catalog.activeId === renameSource.id) {
        catalog.setActiveId(savedId);
      }

      addLog(`Renamed to ${nextPath}.`, 'success');
      showToast('success', `Renamed to ${nameSlug}`);
      closeRenameDialog();
    } catch (error: any) {
      const message = error?.message || 'Failed to rename function.';
      setRenameError(message);
      addLog(message, 'warn');
      showToast('error', message);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteFunction = (id: string) => {
    const fn = catalog.functions.find((f) => f.id === id);
    if (fn && isPackageServerFunction(fn)) {
      addLog(`"${fn.name}" is a package API and cannot be deleted here. Uninstall the package instead.`, 'warn');
      return;
    }
    if (fn?.isBuiltIn) {
      addLog(`"${fn.name}" is a built-in route and cannot be deleted.`, 'warn');
      return;
    }
    if (catalog.functions.filter((f) => !f.isBuiltIn).length <= 0 && catalog.functions.length <= 1) {
      addLog('Cannot delete the last remaining server function route.', 'warn');
      return;
    }
    setIdToDelete(id);
  };

  const confirmDelete = async () => {
    if (!idToDelete) return;
    const fnTarget = catalog.functions.find((f) => f.id === idToDelete);
    if (fnTarget) {
      if (!fnTarget.isBuiltIn) {
        try {
          const { response, data } = await deleteServerFunctionMutation.mutateAsync(idToDelete);
          if (!response.ok) {
            throw new Error(data?.error || 'Failed to delete function from API.');
          }
        } catch (error: any) {
          addLog(error?.message || 'Failed to delete function.', 'warn');
          return;
        }
      }
      clearServerFunctionDraft(catalog.queryClient, idToDelete);
      if (catalog.activeId === idToDelete) {
        catalog.setActiveId(null);
      }
      addLog(`Deleted route mapping: ${fnTarget.path}`, 'warn');
    }
    setIdToDelete(null);
  };

  const openSettingsDialog = (source?: ServerFunctionItem) => {
    if (source) {
      if (isPackageServerFunction(source)) {
        addLog(`"${source.name}" is a package API — settings are managed by the package.`, 'warn');
        showToast('error', 'Package API settings are managed by the package.');
        return;
      }
      setSettingsTarget(cloneServerFunctionForSettings(source));
    } else {
      setSettingsTarget(null);
    }
    setIsSettingsOpen(true);
  };

  const closeSettingsDialog = () => {
    setIsSettingsOpen(false);
    setSettingsTarget(null);
  };

  const updateSettingsTarget = (updates: Partial<ServerFunctionItem>) => {
    setSettingsTarget((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const saveSettingsFromList = async (): Promise<boolean> => {
    if (!settingsTarget || isSavingSettings) {
      return false;
    }
    if (isPackageServerFunction(settingsTarget)) {
      showToast('error', 'Package API settings are managed by the package.');
      return false;
    }

    setIsSavingSettings(true);
    try {
      if (settingsTarget.isBuiltIn) {
        const { response, data } = await updateBuiltinServerFunctionMutation.mutateAsync({
          id: settingsTarget.id,
          payload: buildBuiltinFunctionMetadataPayload(settingsTarget),
        });
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to save settings.');
        }
      } else {
        const { response, data } = await updateServerFunctionMutation.mutateAsync({
          id: settingsTarget.id,
          payload: buildManagedFunctionPayload(settingsTarget),
        });
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to save settings.');
        }
      }

      catalog.upsertCatalogFunction(settingsTarget);
      if (catalog.activeId === settingsTarget.id) {
        editor.updateActiveFunction(settingsTarget);
      }
      addLog(`Updated settings for ${settingsTarget.path}.`, 'success');
      showToast('success', `Settings saved for ${settingsTarget.path}`);
      return true;
    } catch (error: any) {
      const message = error?.message || 'Failed to save settings.';
      addLog(message, 'warn');
      showToast('error', message);
      return false;
    } finally {
      setIsSavingSettings(false);
    }
  };

  const openAccessDialog = (source?: ServerFunctionItem) => {
    if (source) {
      if (isPackageServerFunction(source)) {
        addLog(`"${source.name}" is a package API — access is managed by the package.`, 'warn');
        showToast('error', 'Package API access is managed by the package.');
        return;
      }
      setAccessTarget(cloneServerFunctionForAccess(source));
    } else {
      setAccessTarget(null);
    }
    setIsAccessOpen(true);
  };

  const closeAccessDialog = () => {
    setIsAccessOpen(false);
    setAccessTarget(null);
  };

  const updateAccessTargetControl = (accessControl: FunctionAccessControl) => {
    setAccessTarget((prev) => (prev ? { ...prev, accessControl } : prev));
  };

  const saveAccessFromList = async (): Promise<boolean> => {
    if (!accessTarget || isSavingAccess) {
      return false;
    }
    if (isPackageServerFunction(accessTarget)) {
      showToast('error', 'Package API access is managed by the package.');
      return false;
    }

    setIsSavingAccess(true);
    try {
      if (accessTarget.isBuiltIn) {
        const { response, data } = await updateBuiltinServerFunctionMutation.mutateAsync({
          id: accessTarget.id,
          payload: buildBuiltinFunctionMetadataPayload(accessTarget),
        });
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to save access control.');
        }
      } else {
        const { response, data } = await updateServerFunctionMutation.mutateAsync({
          id: accessTarget.id,
          payload: buildManagedFunctionPayload(accessTarget),
        });
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to save access control.');
        }
      }

      catalog.upsertCatalogFunction(accessTarget);
      if (catalog.activeId === accessTarget.id) {
        editor.updateActiveFunction({ accessControl: accessTarget.accessControl });
      }
      addLog(`Updated access control for ${accessTarget.path}.`, 'success');
      showToast('success', `Access saved for ${accessTarget.path}`);
      return true;
    } catch (error: any) {
      const message = error?.message || 'Failed to save access control.';
      addLog(message, 'warn');
      showToast('error', message);
      return false;
    } finally {
      setIsSavingAccess(false);
    }
  };

  return {
    isCreateOpen,
    setIsCreateOpen,
    openCreateDialog,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsTarget,
    openSettingsDialog,
    closeSettingsDialog,
    updateSettingsTarget,
    saveSettingsFromList,
    isSavingSettings,
    isAccessOpen,
    setIsAccessOpen,
    accessTarget,
    openAccessDialog,
    closeAccessDialog,
    updateAccessTargetControl,
    saveAccessFromList,
    isSavingAccess,
    isHooksOpen,
    setIsHooksOpen,
    newFuncName,
    setNewFuncName,
    newFuncTags,
    setNewFuncTags,
    newFuncMethod,
    setNewFuncMethod,
    idToDelete,
    setIdToDelete,
    handleCreateFunction,
    handleBulkApply,
    handleCreateFromDraft,
    handleDeleteFunction,
    confirmDelete,
    isCreatingFromDraft,
    isDuplicateOpen,
    duplicateSource,
    duplicateName,
    setDuplicateName: updateDuplicateName,
    duplicateTags,
    setDuplicateTags,
    duplicateError,
    isDuplicating,
    openDuplicateDialog,
    closeDuplicateDialog,
    confirmDuplicateToDraft,
    isRenameOpen,
    renameSource,
    renameName,
    setRenameName,
    renameTags,
    setRenameTags,
    renameError,
    isRenaming,
    openRenameDialog,
    closeRenameDialog,
    confirmRenameFromList,
  };
}

export type ServerFunctionActionsState = ReturnType<typeof useServerFunctionActions>;
