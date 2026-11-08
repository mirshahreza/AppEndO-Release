import { useMemo, useState } from 'react';
import { useSettingsIdentityProvidersOverlayDeepLink } from '../../hooks/useSettingsIdentityProvidersOverlayDeepLink';
import type { IdentityProviderConfig, IdentityProviderPublicConfig } from '../../../../shared/api/contracts/auth/identityProviders';
import { formatQueryError } from '../../../../shared/api/client';
import {
  useCreateIdentityProviderMutation,
  useIdentityProvidersQuery,
  useTestIdentityProviderMutation,
  useUpdateIdentityProviderMutation,
} from '../../../../shared/api/queries/identityProviders';
import {
  BUILTIN_IDENTITY_PROVIDER_CATALOG,
  buildDefaultIdentityProviderRedirectUri,
  EMPTY_IDENTITY_PROVIDER_FORM,
  type BuiltinIdentityProviderCatalogEntry,
} from './constants';

type ToastState = { type: 'success' | 'error'; text: string } | null;

export type IdentityProviderCatalogRow = BuiltinIdentityProviderCatalogEntry & {
  config: IdentityProviderPublicConfig | null;
};

const OIDC_KINDS = new Set(['microsoft-oauth', 'oidc-generic']);

const validateForm = (form: IdentityProviderConfig, mode: 'create' | 'edit'): string | null => {
  if (!form.id.trim()) return 'Provider ID is required.';
  if (!/^[a-z][a-z0-9-]{2,63}$/.test(form.id.trim())) {
    return 'Provider ID must be a lowercase slug (3–64 chars).';
  }
  if (!form.label.trim()) return 'Label is required.';
  if (!form.clientId?.trim()) return 'Client ID is required.';
  if (!form.redirectUri?.trim()) return 'Redirect URI is required.';
  if (OIDC_KINDS.has(form.kind) && !form.issuerUrl?.trim()) {
    return 'Issuer URL is required for Microsoft and OIDC generic providers.';
  }
  if (mode === 'create' && !form.clientSecret?.trim()) return 'Client secret is required on first save.';
  return null;
};

export function useIdentityProvidersSection(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const providersQuery = useIdentityProvidersQuery(enabled);
  const createMutation = useCreateIdentityProviderMutation();
  const updateMutation = useUpdateIdentityProviderMutation();
  const testMutation = useTestIdentityProviderMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [form, setForm] = useState<IdentityProviderConfig>(EMPTY_IDENTITY_PROVIDER_FORM);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);

  const rows = useMemo((): IdentityProviderCatalogRow[] => {
    const savedByKind = new Map(
      (providersQuery.data ?? []).map((item) => [item.kind, item] as const),
    );
    return BUILTIN_IDENTITY_PROVIDER_CATALOG.map((entry) => ({
      ...entry,
      config: savedByKind.get(entry.kind) ?? null,
    }));
  }, [providersQuery.data]);

  const openConfigModal = (row: IdentityProviderCatalogRow) => {
    if (row.config) {
      setFormMode('edit');
      setForm({
        ...row.config,
        clientSecret: row.config.hasClientSecret ? row.config.clientSecret : '',
      });
    } else {
      setFormMode('create');
      setForm({
        ...EMPTY_IDENTITY_PROVIDER_FORM,
        id: row.defaultId,
        kind: row.kind,
        label: row.label,
        redirectUri: buildDefaultIdentityProviderRedirectUri(row.defaultId),
        issuerUrl: row.kind === 'microsoft-oauth'
          ? 'https://login.microsoftonline.com/common/v2.0'
          : '',
      });
    }
    setFormError('');
    setFormOpen(true);
  };

  const closeFormModal = () => {
    setFormOpen(false);
    setFormError('');
  };

  const saveForm = async () => {
    const validationError = validateForm(form, formMode);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      if (formMode === 'create') {
        await createMutation.mutateAsync(form);
        setToast({ type: 'success', text: 'Identity provider configured.' });
      } else {
        await updateMutation.mutateAsync({ id: form.id, payload: form });
        setToast({ type: 'success', text: 'Identity provider updated.' });
      }
      closeFormModal();
    } catch (error) {
      setFormError(formatQueryError(error, 'Failed to save identity provider.'));
    }
  };

  const testConnection = async () => {
    if (formMode !== 'edit' || !form.id.trim()) return;
    try {
      const { data } = await testMutation.mutateAsync(form.id);
      const payload = data as { success?: boolean; message?: string };
      setToast({
        type: payload.success ? 'success' : 'error',
        text: payload.message || (payload.success ? 'Connection test passed.' : 'Connection test failed.'),
      });
    } catch (error) {
      setToast({ type: 'error', text: formatQueryError(error, 'Connection test failed.') });
    }
  };

  useSettingsIdentityProvidersOverlayDeepLink({
    formOpen,
    activeKind: formOpen ? form.kind : null,
    providerKinds: rows.map((row) => row.kind),
    openConfigByKind: (kind) => {
      const row = rows.find((item) => item.kind === kind);
      if (row) {
        openConfigModal(row);
      }
    },
  });

  return {
    providersQuery,
    rows,
    formOpen,
    formMode,
    form,
    setForm,
    formError,
    toast,
    isSaving: createMutation.isPending || updateMutation.isPending,
    isTesting: testMutation.isPending,
    openConfigModal,
    closeFormModal,
    saveForm,
    testConnection,
  };
}

export type IdentityProvidersSectionModel = ReturnType<typeof useIdentityProvidersSection>;
