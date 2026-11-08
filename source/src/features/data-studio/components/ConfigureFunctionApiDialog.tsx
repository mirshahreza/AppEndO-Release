import React, { useEffect, useMemo, useState } from 'react';
import { Save, Settings, X } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import type { FunctionAccessControl } from '../../../shared/api/contracts/server-functions/accessControl';
import { buildBuiltinFunctionMetadataPayload, buildManagedFunctionPayload } from '../../../shared/api/contracts/server-functions/mappers';
import { isPackageServerFunction } from '../../../shared/api/contracts/server-functions/packageFunctions';
import type { ServerFunctionItem } from '../../../shared/api/contracts/server-functions/types';
import {
  useUpdateBuiltinServerFunctionMutation,
  useUpdateServerFunctionMutation,
} from '../../../shared/api/queries/server-functions';
import { resolvePackageBadgeLabel } from '../../../shared/packages/packageBadgeLabel';
import {
  AccessControlModal,
  AppButton,
  CreateEditModalShell,
  ServerFunctionHooksModal,
  ServerFunctionSettingsForm,
} from '../../../shared/ui';

export type ConfigureFunctionApiMode = 'settings' | 'access' | 'hooks';

export type ConfigureFunctionApiTarget = {
  fn: ServerFunctionItem;
  mode: ConfigureFunctionApiMode;
};

export type ConfigureFunctionApiDialogProps = {
  target: ConfigureFunctionApiTarget | null;
  onClose: () => void;
  onSaved?: (text: string) => void;
};

const EDGE_STATE_STORAGE_KEY = 'append.server-functions.state.v4';

const cloneFunctionItem = (source: ServerFunctionItem): ServerFunctionItem => ({
  ...source,
  accessControl: {
    ...source.accessControl,
    allowRoles: [...source.accessControl.allowRoles],
    allowUsers: [...source.accessControl.allowUsers],
    denyRoles: [...source.accessControl.denyRoles],
    denyUsers: [...source.accessControl.denyUsers],
  },
  metadataJson: source.metadataJson ? structuredClone(source.metadataJson) : null,
  hooks: source.hooks ? structuredClone(source.hooks) : source.hooks,
});

const readGlobalDefaults = (): { vmMode: 'v18.x' | 'v20.x'; ram: number; timeout: number } => {
  const defaults: { vmMode: 'v18.x' | 'v20.x'; ram: number; timeout: number } = {
    vmMode: 'v20.x',
    ram: 128,
    timeout: 1500,
  };
  try {
    const raw = localStorage.getItem(EDGE_STATE_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as {
      globalDefaultVMMode?: string;
      globalDefaultRAM?: number;
      globalDefaultTimeout?: number;
    };
    if (parsed?.globalDefaultVMMode === 'v18.x' || parsed?.globalDefaultVMMode === 'v20.x') {
      defaults.vmMode = parsed.globalDefaultVMMode;
    }
    if (typeof parsed?.globalDefaultRAM === 'number') {
      defaults.ram = parsed.globalDefaultRAM;
    }
    if (typeof parsed?.globalDefaultTimeout === 'number') {
      defaults.timeout = parsed.globalDefaultTimeout;
    }
  } catch {
    return defaults;
  }
  return defaults;
};

export const ConfigureFunctionApiDialog: React.FC<ConfigureFunctionApiDialogProps> = ({
  target,
  onClose,
  onSaved,
}) => {
  const t = useCultureT();
  const updateBuiltinMutation = useUpdateBuiltinServerFunctionMutation();
  const updateFunctionMutation = useUpdateServerFunctionMutation();
  const [draft, setDraft] = useState<ServerFunctionItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [globalDefaults] = useState(readGlobalDefaults);

  useEffect(() => {
    if (!target) {
      setDraft(null);
      setError(null);
      return;
    }
    setDraft(cloneFunctionItem(target.fn));
    setError(null);
  }, [target]);

  const isPackage = useMemo(() => (draft ? isPackageServerFunction(draft) : false), [draft]);
  const isSubmitting = updateBuiltinMutation.isPending || updateFunctionMutation.isPending;
  const packageSourceLabel = draft && isPackage ? resolvePackageBadgeLabel(draft) : null;

  const persistDraft = async (): Promise<boolean> => {
    if (!draft) {
      return false;
    }
    setError(null);
    if (isPackage) {
      setError('Package APIs cannot store settings from Data Studio.');
      return false;
    }

    try {
      if (draft.isBuiltIn) {
        const { response, data } = await updateBuiltinMutation.mutateAsync({
          id: draft.id,
          payload: buildBuiltinFunctionMetadataPayload(draft),
        });
        if (!response.ok || !data.success) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save API.');
        }
      } else {
        const { response, data } = await updateFunctionMutation.mutateAsync({
          id: draft.id,
          payload: buildManagedFunctionPayload(draft),
        });
        if (!response.ok || !data.success) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save API.');
        }
      }
      return true;
    } catch (saveError) {
      const message = isApiError(saveError)
        ? formatApiErrorMessage(saveError)
        : (saveError instanceof Error ? saveError.message : 'Failed to save API.');
      setError(message);
      return false;
    }
  };

  if (!target || !draft) {
    return null;
  }

  const titlePath = `${draft.method} ${draft.path}`;
  const updateDraft = (updates: Partial<ServerFunctionItem>) => {
    setDraft((current) => (current ? { ...current, ...updates } : current));
  };

  const handleSave = async (successText: string) => {
    const saved = await persistDraft();
    if (!saved) {
      return;
    }
    onSaved?.(successText);
    onClose();
  };

  if (target.mode === 'access') {
    return (
      <AccessControlModal
        open
        titlePath={titlePath}
        accessControl={draft.accessControl}
        disabled={isPackage || isSubmitting}
        isSaving={isSubmitting}
        error={error}
        onClose={isSubmitting ? () => undefined : onClose}
        onChange={(accessControl: FunctionAccessControl) => updateDraft({ accessControl })}
        onSave={() => { void handleSave(`Access saved for ${draft.path}`); }}
      />
    );
  }

  if (target.mode === 'hooks') {
    return (
      <ServerFunctionHooksModal
        open
        titlePath={titlePath}
        hooks={draft.hooks ?? {}}
        metadataJson={draft.metadataJson}
        disabled={isPackage || isSubmitting}
        onClose={isSubmitting ? () => undefined : onClose}
        onChange={(hooks) => updateDraft({ hooks })}
        onSave={() => { void handleSave(`Hooks saved for ${draft.path}`); }}
      />
    );
  }

  return (
    <CreateEditModalShell
      size="3xl"
      shellClassName="min-h-[600px]"
      title={(
        <span className="inline-flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary-500" />
          <span>{t('serverFunctions.settings.title').replace('{path}', titlePath)}</span>
        </span>
      )}
      onClose={isSubmitting ? () => undefined : onClose}
      onBackdropClick={isSubmitting ? () => undefined : onClose}
      bodyClassName="space-y-6 overflow-y-auto max-h-[70vh]"
      footer={(
        <>
          <AppButton intent="cancel" size="sm" disabled={isSubmitting} onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="primary"
            size="sm"
            disabled={isSubmitting || isPackage}
            onClick={() => { void handleSave(`Settings saved for ${draft.path}`); }}
          >
            <Save className="h-3.5 w-3.5" />
            {t('serverFunctions.settings.save')}
          </AppButton>
        </>
      )}
    >
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      ) : null}
      <ServerFunctionSettingsForm
        targetFn={draft}
        updateTarget={updateDraft}
        globalDefaultVMMode={globalDefaults.vmMode}
        globalDefaultRAM={globalDefaults.ram}
        globalDefaultTimeout={globalDefaults.timeout}
        isBuiltInTarget={Boolean(draft.isBuiltIn)}
        isPackageTarget={isPackage}
        packageSourceLabel={packageSourceLabel}
        canToggleBuiltIn={false}
        isBuiltInChecked={Boolean(draft.isBuiltIn)}
      />
    </CreateEditModalShell>
  );
};
