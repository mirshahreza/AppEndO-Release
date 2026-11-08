import React, { useEffect, useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Save, ShieldAlert, X } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import type { RoleMcpGrantInput } from '../../../shared/api/contracts/ai/mcpAccess';
import {
  useAiMcpAccessCatalogQuery,
  useRoleMcpGrantsQuery,
} from '../../../shared/api/queries/aiMcpAccess';
import { AppButton, CreateEditModalShell, UiCheckboxChoice } from '../../../shared/ui';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import type { RoleRecord } from '../types';

const toPascalCase = (name: string): string =>
  name
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');

const resolvePackIcon = (iconName: string): LucideIcon | null => {
  const icon = (LucideIcons as unknown as Record<string, LucideIcon | undefined>)[toPascalCase(iconName)];
  return icon ?? null;
};

const grantKey = (grant: RoleMcpGrantInput): string => `${grant.resourceKind}:${grant.resourceId}`;

export type RoleMcpAccessModalProps = {
  open: boolean;
  role: RoleRecord | null;
  editError: string | null;
  isSaving: boolean;
  selectedGrants: RoleMcpGrantInput[];
  onSelectedGrantsChange: (grants: RoleMcpGrantInput[]) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export const RoleMcpAccessModal: React.FC<RoleMcpAccessModalProps> = ({
  open,
  role,
  editError,
  isSaving,
  selectedGrants,
  onSelectedGrantsChange,
  onClose,
  onSubmit,
}) => {
  const t = useCultureT();
  const roleName = role?.name ?? null;
  const catalogQuery = useAiMcpAccessCatalogQuery(open);
  const grantsQuery = useRoleMcpGrantsQuery(roleName, open);
  const [initializedForRoleName, setInitializedForRoleName] = useState<string | null>(null);

  const adminBypass = grantsQuery.data?.adminBypass ?? false;
  const selectedKeys = useMemo(
    () => new Set(selectedGrants.map(grantKey)),
    [selectedGrants],
  );

  useEffect(() => {
    if (!open || !roleName || !grantsQuery.data) return;
    if (initializedForRoleName === roleName) return;
    onSelectedGrantsChange(grantsQuery.data.grants);
    setInitializedForRoleName(roleName);
  }, [open, roleName, grantsQuery.data, initializedForRoleName, onSelectedGrantsChange]);

  useEffect(() => {
    if (!open) {
      setInitializedForRoleName(null);
    }
  }, [open]);

  const toggleGrant = (grant: RoleMcpGrantInput, checked: boolean) => {
    if (adminBypass) return;
    const key = grantKey(grant);
    if (checked) {
      if (selectedKeys.has(key)) return;
      onSelectedGrantsChange([...selectedGrants, grant]);
      return;
    }
    onSelectedGrantsChange(selectedGrants.filter((entry) => grantKey(entry) !== key));
  };

  if (!open || !role) return null;

  const loadError = catalogQuery.isError
    ? (catalogQuery.error instanceof Error ? catalogQuery.error.message : t('roles.mcpAccess.loadCatalogFailed'))
    : grantsQuery.isError
      ? (grantsQuery.error instanceof Error ? grantsQuery.error.message : t('roles.mcpAccess.loadGrantsFailed'))
      : null;

  const isLoading = catalogQuery.isLoading || grantsQuery.isLoading;
  const externalServers = (catalogQuery.data?.mcpServers ?? []).filter((server) => server.resourceKind === 'external_mcp');
  const pluginServers = (catalogQuery.data?.mcpServers ?? []).filter((server) => server.resourceKind === 'plugin_mcp');

  return (
    <CreateEditModalShell
      size="3xl"
      title={t('roles.mcpAccess.title', { name: role.name })}
      onClose={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            {t('actions.cancel')}
          </AppButton>
          <AppButton
            intent="primary"
            onClick={onSubmit}
            disabled={isSaving || isLoading || Boolean(loadError) || adminBypass}
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? t('actions.saving') : t('actions.save')}
          </AppButton>
        </>
      )}
    >
      {adminBypass ? (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{t('roles.mcpAccess.adminBypass')}</p>
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-xs text-slate-400">{t('roles.mcpAccess.loading')}</p>
      ) : loadError ? (
        <p className="text-xs font-semibold text-red-600">{loadError}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <AppSurfaceBox title={t('roles.mcpAccess.builtinPacks')} tone="indigo">
            <div className="flex flex-col gap-2">
              {(catalogQuery.data?.packs ?? []).map((pack) => {
                const grant: RoleMcpGrantInput = { resourceKind: 'builtin_pack', resourceId: pack.id };
                const PackIcon = resolvePackIcon(pack.icon);
                return (
                  <UiCheckboxChoice
                    key={pack.id}
                    checked={selectedKeys.has(grantKey(grant))}
                    disabled={adminBypass || isSaving}
                    onChange={(checked) => toggleGrant(grant, checked)}
                    className="items-start rounded-md px-1 py-1 hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        {PackIcon ? <PackIcon className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" /> : null}
                        {pack.label}
                        {pack.hasWriteTools ? (
                          <span className="rounded bg-rose-50 px-1 py-0.5 text-[10px] font-semibold text-rose-700">
                            {t('roles.mcpAccess.writeBadge')}
                          </span>
                        ) : null}
                      </span>
                      {pack.description ? (
                        <span className="mt-0.5 block text-[11px] text-slate-500">{pack.description}</span>
                      ) : null}
                    </span>
                  </UiCheckboxChoice>
                );
              })}
            </div>
          </AppSurfaceBox>

          <AppSurfaceBox title={t('roles.mcpAccess.externalServers')} tone="cyan">
            {externalServers.length === 0 ? (
              <p className="text-xs text-slate-400">{t('roles.mcpAccess.noExternalServers')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {externalServers.map((server) => {
                  const grant: RoleMcpGrantInput = { resourceKind: 'external_mcp', resourceId: server.id };
                  return (
                    <UiCheckboxChoice
                      key={server.id}
                      checked={selectedKeys.has(grantKey(grant))}
                      disabled={adminBypass || isSaving}
                      onChange={(checked) => toggleGrant(grant, checked)}
                      className="items-start rounded-md px-1 py-1 hover:bg-slate-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-slate-700">{server.label}</span>
                        <span className="mt-0.5 block font-mono text-[10px] text-slate-400">{server.id}</span>
                      </span>
                    </UiCheckboxChoice>
                  );
                })}
              </div>
            )}
          </AppSurfaceBox>

          <AppSurfaceBox title={t('roles.mcpAccess.packageServers')} tone="violet">
            {pluginServers.length === 0 ? (
              <p className="text-xs text-slate-400">{t('roles.mcpAccess.noPackageServers')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {pluginServers.map((server) => {
                  const grant: RoleMcpGrantInput = { resourceKind: 'plugin_mcp', resourceId: server.id };
                  return (
                    <UiCheckboxChoice
                      key={server.id}
                      checked={selectedKeys.has(grantKey(grant))}
                      disabled={adminBypass || isSaving}
                      onChange={(checked) => toggleGrant(grant, checked)}
                      className="items-start rounded-md px-1 py-1 hover:bg-slate-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-slate-700">{server.label}</span>
                        <span className="mt-0.5 block text-[10px] text-slate-500">
                          {server.sourcePluginId ? t('roles.mcpAccess.pluginPrefix', { id: server.sourcePluginId }) : server.id}
                        </span>
                      </span>
                    </UiCheckboxChoice>
                  );
                })}
              </div>
            )}
          </AppSurfaceBox>
        </div>
      )}

      {editError ? <p className="mt-2 text-xs font-semibold text-red-600">{editError}</p> : null}
    </CreateEditModalShell>
  );
};
