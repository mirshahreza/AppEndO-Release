import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, Layers, Shield, SlidersHorizontal } from 'lucide-react';
import type {
  ColumnFilterRole,
  EdgeModelDefinition,
  QueryPresetDefinition,
  QuerySurfaceGrant,
} from '../../../shared/api/contracts/data-api';
import {
  emptyQuerySurfacesDocument,
  parseQuerySurfacesDocument,
  QUERY_SURFACES_EXTENSION_KEY,
} from '../../../shared/api/contracts/data-api';
import { useRolesListQuery } from '../../../shared/api/queries/roles';
import {
  useQuerySurfaceBindingQuery,
  useSaveQuerySurfaceBindingMutation,
} from '../../../shared/api/queries/query-surface-bindings';
import {
  useEdgeModelStudioMetaQuery,
  useUpsertEdgeModelStudioMetaMutation,
} from '../../../shared/api/queries/data-api';
import { useQuerySurfaceRuntimeQuery } from '../../../shared/api/queries/query-surfaces';
import {
  AppButton,
  CreateEditModalShell,
  FormSection,
  QueryErrorPanel,
  UiOptionCardGroup,
} from '../../../shared/ui';
import { MODELER_CAPTION_CLASS } from '../lib/modelerChipStyles';
import { QuerySurfaceDefinitionsPanel } from './QuerySurfaceDefinitionsPanel';
import {
  QuerySurfaceRoleGrantMatrix,
  type QuerySurfaceGrantRow,
} from './QuerySurfaceRoleGrantMatrix';

type QuerySurfacesDialogTab = 'definitions' | 'access' | 'record-scope';

type EdgeModelModelerQuerySurfacesDialogProps = {
  open: boolean;
  onClose: () => void;
  model: EdgeModelDefinition;
  policyCount?: number;
  columnFilterRoles: Record<string, ColumnFilterRole>;
  onUpdateColumnFilterRole: (columnName: string, filterRole: ColumnFilterRole) => void;
  onOpenRecordPolicies?: () => void;
};

const roleGrant = (
  binding: Record<string, QuerySurfaceGrant>,
  key: string,
): QuerySurfaceGrant => binding[key] ?? { mode: 'public' };

const toggleRole = (
  grant: QuerySurfaceGrant,
  roleName: string,
  checked: boolean,
): QuerySurfaceGrant => {
  const roleIds = new Set((grant.roleIds ?? []).map((id) => id.toUpperCase()));
  if (checked) {
    roleIds.add(roleName.toUpperCase());
  } else {
    roleIds.delete(roleName.toUpperCase());
  }
  const next = [...roleIds];
  if (next.length === 0) {
    return { mode: 'public' };
  }
  return { mode: 'roles', roleIds: next };
};

const TAB_OPTIONS = [
  {
    value: 'definitions' as const,
    title: 'Definitions',
    description: 'Named presets and list-filter columns on this model.',
    icon: SlidersHorizontal,
  },
  {
    value: 'access' as const,
    title: 'Role access',
    description: 'Grants for restricted presets and list-filter fields.',
    icon: KeyRound,
  },
  {
    value: 'record-scope' as const,
    title: 'Record scope',
    description: 'Row-level policies (complements query slices).',
    icon: Shield,
  },
];

export const EdgeModelModelerQuerySurfacesDialog: React.FC<EdgeModelModelerQuerySurfacesDialogProps> = ({
  open,
  onClose,
  model,
  columnFilterRoles,
  onUpdateColumnFilterRole,
  policyCount = 0,
  onOpenRecordPolicies,
}) => {
  const [activeTab, setActiveTab] = useState<QuerySurfacesDialogTab>('definitions');
  const metaQuery = useEdgeModelStudioMetaQuery(model.id);
  const bindingQuery = useQuerySurfaceBindingQuery(model.id, open);
  const saveBindingMutation = useSaveQuerySurfaceBindingMutation();
  const upsertMetaMutation = useUpsertEdgeModelStudioMetaMutation();
  const rolesQuery = useRolesListQuery();
  const runtimeQuery = useQuerySurfaceRuntimeQuery(open ? model.id : undefined);

  const persistedPresets = useMemo(() => {
    const doc = parseQuerySurfacesDocument(metaQuery.data?.extensions);
    return doc?.presets ?? [];
  }, [metaQuery.data?.extensions]);

  const [draftPresets, setDraftPresets] = useState<QueryPresetDefinition[]>([]);
  const [presetGrants, setPresetGrants] = useState<Record<string, QuerySurfaceGrant>>({});
  const [columnGrants, setColumnGrants] = useState<Record<string, QuerySurfaceGrant>>({});

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraftPresets(persistedPresets);
    setActiveTab('definitions');
  }, [open, persistedPresets]);

  useEffect(() => {
    if (!open || !bindingQuery.data) {
      return;
    }
    setPresetGrants(bindingQuery.data.presetGrants ?? {});
    setColumnGrants(bindingQuery.data.columnWhereGrants ?? {});
  }, [bindingQuery.data, open]);

  const presetsDirty = useMemo(
    () => JSON.stringify(draftPresets) !== JSON.stringify(persistedPresets),
    [draftPresets, persistedPresets],
  );

  const restrictedColumns = useMemo(
    () => (metaQuery.data?.columnMeta ?? []).filter((column) => {
      const role = columnFilterRoles[column.columnName] ?? column.filterRole;
      return role === 'restricted';
    }),
    [columnFilterRoles, metaQuery.data?.columnMeta],
  );

  const restrictedPresets = useMemo(
    () => draftPresets.filter((preset) => preset.visibility === 'restricted'),
    [draftPresets],
  );

  const roleOptions = useMemo(
    () => (rolesQuery.data ?? []).map((role) => ({
      name: role.name?.trim() || String(role.id),
      note: role.note,
    })),
    [rolesQuery.data],
  );

  const grantRows = useMemo((): QuerySurfaceGrantRow[] => {
    const presetRows: QuerySurfaceGrantRow[] = restrictedPresets.map((preset) => ({
      key: `preset:${preset.id}`,
      kind: 'preset',
      title: preset.label,
      detail: preset.id,
    }));
    const columnRows: QuerySurfaceGrantRow[] = restrictedColumns.map((column) => ({
      key: `column:${column.columnName}`,
      kind: 'column',
      title: column.displayLabel?.trim() || column.columnName,
      detail: column.columnName,
    }));
    return [...presetRows, ...columnRows];
  }, [restrictedColumns, restrictedPresets]);

  const getMatrixGrant = (rowKey: string): QuerySurfaceGrant => {
    if (rowKey.startsWith('preset:')) {
      return roleGrant(presetGrants, rowKey.slice('preset:'.length));
    }
    if (rowKey.startsWith('column:')) {
      return roleGrant(columnGrants, rowKey.slice('column:'.length));
    }
    return { mode: 'public' };
  };

  const setMatrixGrant = (rowKey: string, grant: QuerySurfaceGrant) => {
    if (rowKey.startsWith('preset:')) {
      const id = rowKey.slice('preset:'.length);
      setPresetGrants((current) => ({ ...current, [id]: grant }));
      return;
    }
    if (rowKey.startsWith('column:')) {
      const columnName = rowKey.slice('column:'.length);
      setColumnGrants((current) => ({ ...current, [columnName]: grant }));
    }
  };

  const handleMatrixToggle = (rowKey: string, roleName: string, checked: boolean) => {
    const grant = getMatrixGrant(rowKey);
    setMatrixGrant(rowKey, toggleRole(grant, roleName, checked));
  };

  const showAccessSection = grantRows.length > 0;
  const whereFields = runtimeQuery.data?.listWhereFields ?? [];

  const handleSave = async () => {
    if (presetsDirty) {
      const extensions = {
        ...(metaQuery.data?.extensions ?? {}),
        [QUERY_SURFACES_EXTENSION_KEY]: {
          ...emptyQuerySurfacesDocument(),
          presets: draftPresets,
        },
      };
      await upsertMetaMutation.mutateAsync({
        modelId: model.id,
        patch: { extensions },
      });
    }
    if (showAccessSection) {
      await saveBindingMutation.mutateAsync({
        edgeModelId: model.id,
        presetGrants,
        columnWhereGrants: columnGrants,
      });
    }
    onClose();
  };

  if (!open) {
    return null;
  }

  return (
    <CreateEditModalShell
      onClose={onClose}
      title={(
        <span className="inline-flex min-w-0 items-center gap-2">
          <Layers className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
          <span>List &amp; access</span>
          <span className="font-normal text-slate-400" aria-hidden>—</span>
          <span className="truncate font-mono text-sm font-semibold text-indigo-600">{model.objectName}</span>
        </span>
      )}
      size="maximized"
      bodyClassName="flex min-h-0 flex-col"
      primaryAction={{
        label: 'Save',
        onClick: () => { void handleSave(); },
        disabled: saveBindingMutation.isPending || upsertMetaMutation.isPending,
      }}
      secondaryAction={{ label: 'Cancel', onClick: onClose }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <UiOptionCardGroup
          value={activeTab}
          onChange={(value) => setActiveTab(value as QuerySurfacesDialogTab)}
          options={TAB_OPTIONS.map((option) => (
            option.value === 'record-scope' && policyCount > 0
              ? { ...option, title: `Record scope (${policyCount})` }
              : option
          ))}
          columns={3}
          ariaLabel="List and access section"
        />

        {activeTab === 'record-scope' ? (
          <FormSection title="Record policies" ink="slate">
            <p className={MODELER_CAPTION_CLASS}>
              Predefined queries narrow <strong>which rows match a slice</strong> (status, active flag, …).
              Record policies answer <strong>which rows this principal may see at all</strong>.
              Data API list applies: default WHERE → preset WHERE → user filter/search → then record policy.
            </p>
            <AppButton
              type="button"
              intent="primary"
              size="sm"
              onClick={() => {
                onClose();
                onOpenRecordPolicies?.();
              }}
            >
              <Shield className="h-3.5 w-3.5" />
              Open record policies editor
            </AppButton>
          </FormSection>
        ) : null}

        {activeTab === 'definitions' ? (
          <QuerySurfaceDefinitionsPanel
            model={model}
            presets={draftPresets}
            onPresetsChange={setDraftPresets}
            columnFilterRoles={columnFilterRoles}
            onUpdateColumnFilterRole={onUpdateColumnFilterRole}
            whereFields={whereFields}
          />
        ) : (
          <>
            {rolesQuery.isError ? (
              <QueryErrorPanel message="Failed to load roles." onRetry={() => { void rolesQuery.refetch(); }} />
            ) : null}
            {showAccessSection ? (
              <FormSection title="Role grant matrix" ink="indigo" className="flex min-h-0 flex-1 flex-col">
                {roleOptions.length === 0 ? (
                  <p className={MODELER_CAPTION_CLASS}>No roles are defined yet. Create roles in Studio first.</p>
                ) : (
                  <QuerySurfaceRoleGrantMatrix
                    rows={grantRows}
                    roles={roleOptions}
                    getGrant={getMatrixGrant}
                    onToggle={handleMatrixToggle}
                    onSetRowRoles={setMatrixGrant}
                    className="min-h-0 flex-1"
                  />
                )}
              </FormSection>
            ) : (
              <p className={MODELER_CAPTION_CLASS}>
                No restricted presets or list-filter columns — switch to Definitions to add presets or mark columns as role-restricted.
              </p>
            )}
          </>
        )}
      </div>
    </CreateEditModalShell>
  );
};
