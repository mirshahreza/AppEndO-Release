import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Shield, ShieldOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { EdgeModelDefinition } from '../../shared/api/contracts/data-api';
import {
  PRESET_SCOPE_CONTEXT_KEYS,
  ROOT_POLICY_TREE_GROUP_ID,
  appendPolicyToGroup,
  collectPolicyIdsFromTree,
  createPolicyTreeRoot,
  findGroupPathById,
  isAllowedRecordPolicyContextRef,
  removePolicyFromTree,
  resolvePolicyTree,
  type RecordPolicyDocument,
  type RecordPolicyTreeNode,
  type RecordScopeMode,
} from '../../shared/api/contracts/record-policy';
import {
  useDeleteRecordPolicyMutation,
  useRecordPoliciesQuery,
  useRecordPolicyBindingQuery,
  useSaveRecordPolicyBindingMutation,
  useSaveRecordPolicyMutation,
  useScopeDimensionsQuery,
} from '../../shared/api/queries/record-policy';
import { useSessionContextSettingsQuery } from '../../shared/api/queries/sessionContextSettings';
import {
  CreateEditModalShell,
  FieldHintTooltip,
  UiCheckbox,
  UiOptionCardGroup,
  type UiOptionCardIcon,
} from '../../shared/ui';
import {
  MODELER_CAPTION_CLASS,
} from '../data-studio/lib/modelerChipStyles';
import { RecordPolicyNameDialog } from './components/RecordPolicyNameDialog';
import { RecordPolicyPolicyBand } from './components/RecordPolicyPolicyBand';
import { RecordPolicyTreeEditor } from './components/RecordPolicyTreeEditor';
import {
  buildSingleEnabledUpdates,
  countEnabledPolicies,
  pickEnabledPolicyId,
  policiesInTree,
} from './lib/recordPolicyEnabledState';

type EdgeModelModelerRecordPoliciesDialogProps = {
  open: boolean;
  onClose: () => void;
  model: EdgeModelDefinition;
};

const FORCE_SCOPE_FOR_ADMIN_LABEL = 'Apply record scope to the ADMIN role';
const FORCE_SCOPE_FOR_ADMIN_HINT =
  'This is the platform ADMIN role, not a specific user. Unchecked (default): ADMIN role members skip these row filters. Checked: they are filtered like every other role.';

const RECORD_SCOPE_MODE_OPTIONS: Array<{
  value: RecordScopeMode;
  title: string;
  description: string;
  icon: UiOptionCardIcon;
}> = [
  {
    value: 'off',
    title: 'Off',
    description: 'Record scope is ignored. Saved policies are not applied.',
    icon: ShieldOff,
  },
  {
    value: 'on',
    title: 'On',
    description: 'The active policy filters every query on this model.',
    icon: Shield,
  },
];

const newPolicyId = (): string => `rp_${Date.now().toString(36)}`;

const bumpPolicy = (
  policy: RecordPolicyDocument,
  patch: Partial<RecordPolicyDocument>,
): RecordPolicyDocument => ({
  ...policy,
  ...patch,
  version: policy.version + 1,
});

export const EdgeModelModelerRecordPoliciesDialog: React.FC<EdgeModelModelerRecordPoliciesDialogProps> = ({
  open,
  onClose,
  model,
}) => {
  const policiesQuery = useRecordPoliciesQuery(model.id, open);
  const bindingQuery = useRecordPolicyBindingQuery(model.id, open);
  const dimensionsQuery = useScopeDimensionsQuery();
  const sessionContextQuery = useSessionContextSettingsQuery();
  const saveBindingMutation = useSaveRecordPolicyBindingMutation();
  const savePolicyMutation = useSaveRecordPolicyMutation();
  const deletePolicyMutation = useDeleteRecordPolicyMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const [activePolicyId, setActivePolicyId] = useState<string | null>(null);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameDialogError, setNameDialogError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const normalizedEnabledRef = useRef(false);

  const binding = bindingQuery.data;
  const policies = policiesQuery.data ?? [];
  const columns = model.columns.map((column) => column.field);
  const fallbackField = columns[0] ?? 'id';
  const dimensionKeys = useMemo(
    () => (dimensionsQuery.data ?? []).map((dimension) => dimension.key),
    [dimensionsQuery.data],
  );
  const recordScope = binding?.recordScope ?? 'off';
  const policyTree = useMemo(
    () => resolvePolicyTree(binding?.policyTree, policies.map((policy) => policy.id)),
    [binding?.policyTree, policies],
  );
  const policyIds = useMemo(
    () => collectPolicyIdsFromTree(
      policyTree.kind === 'group'
        ? policyTree
        : { kind: 'group', id: ROOT_POLICY_TREE_GROUP_ID, op: 'and', children: [policyTree] },
    ),
    [policyTree],
  );
  const activePolicy = policies.find((policy) => policy.id === activePolicyId) ?? null;
  const enabledPolicies = useMemo(
    () => policies.filter((policy) => policy.enabled),
    [policies],
  );
  const scopeIsEnforced = recordScope === 'on' && enabledPolicies.length > 0;
  const scopeOnWithoutActive = recordScope === 'on' && enabledPolicies.length === 0 && policies.length > 0;

  useEffect(() => {
    if (!open) {
      setFormError(null);
      setActivePolicyId(null);
      setNameDialogOpen(false);
      setNameDialogError(null);
      return;
    }
    if (policyIds.length === 0) {
      setActivePolicyId(null);
      return;
    }
    if (activePolicyId && policyIds.includes(activePolicyId)) {
      return;
    }
    const enabledInTree = policies.find((policy) => policyIds.includes(policy.id) && policy.enabled);
    setActivePolicyId(enabledInTree?.id ?? policyIds[0] ?? null);
  }, [activePolicyId, open, policies, policyIds]);

  const serverContextKeys = useMemo(() => {
    const fromSettings = (sessionContextQuery.data ?? [])
      .flatMap((group) => group.entries)
      .filter((entry) => entry.server)
      .map((entry) => entry.contextKey);
    const presets = Object.values(PRESET_SCOPE_CONTEXT_KEYS);
    return [...new Set(['user.id', 'sys.roles', ...presets, ...fromSettings])]
      .filter((key) => isAllowedRecordPolicyContextRef(key))
      .sort();
  }, [sessionContextQuery.data]);

  const persistBinding = async (patch: Partial<NonNullable<typeof binding>>) => {
    if (!binding) return;
    await saveBindingMutation.mutateAsync({
      ...binding,
      ...patch,
      edgeModelId: model.id,
    });
  };

  const persistTree = async (tree: RecordPolicyTreeNode) => {
    await persistBinding({ policyTree: tree });
  };

  const savePolicy = async (document: RecordPolicyDocument) => {
    setFormError(null);
    try {
      await savePolicyMutation.mutateAsync(document);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save policy.';
      setFormError(message);
      throw error;
    }
  };

  const applySingleEnabledPolicy = async (
    enabledPolicyId: string,
    scopedPolicies: readonly RecordPolicyDocument[],
    scopeIds: readonly string[],
  ) => {
    const updates = buildSingleEnabledUpdates(enabledPolicyId, scopedPolicies, scopeIds);
    if (updates.length === 0) {
      return;
    }
    setIsActivating(true);
    try {
      for (const policy of updates) {
        await savePolicy(bumpPolicy(policy, { enabled: policy.id === enabledPolicyId }));
      }
    } catch {
      // savePolicy already surfaced formError
    } finally {
      setIsActivating(false);
    }
  };

  useEffect(() => {
    if (!open) {
      normalizedEnabledRef.current = false;
      return;
    }
    if (policiesQuery.isLoading || bindingQuery.isLoading || policyIds.length === 0) {
      return;
    }
    const scoped = policiesInTree(policies, policyIds);
    if (countEnabledPolicies(scoped) === 1) {
      normalizedEnabledRef.current = true;
      return;
    }
    if (normalizedEnabledRef.current) {
      return;
    }
    const targetId = pickEnabledPolicyId(scoped, policyIds);
    if (!targetId) {
      return;
    }
    normalizedEnabledRef.current = true;
    void applySingleEnabledPolicy(targetId, scoped, policyIds);
  }, [open, policies, policyIds, policiesQuery.isLoading, bindingQuery.isLoading]);

  const setActivePolicy = (policyId: string) => {
    if (policyId === activePolicyId) {
      return;
    }
    setActivePolicyId(policyId);
  };

  const activatePolicy = async (policyId: string) => {
    if (!policyIds.includes(policyId)) {
      return;
    }
    const scoped = policiesInTree(policies, policyIds);
    await applySingleEnabledPolicy(policyId, scoped, policyIds);
  };

  const createPolicy = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameDialogError('Policy name is required.');
      return;
    }
    setFormError(null);
    setNameDialogError(null);
    const document: RecordPolicyDocument = {
      id: newPolicyId(),
      edgeModelId: model.id,
      name: trimmed,
      effect: 'allow',
      principals: { roles: [], users: [] },
      predicate: { op: 'isNotNull', field: fallbackField },
      enabled: !policies.some((policy) => policy.enabled),
      version: 1,
    };
    try {
      await savePolicyMutation.mutateAsync(document);
      const attachPath = findGroupPathById(policyTree, ROOT_POLICY_TREE_GROUP_ID) ?? [];
      const nextTree = appendPolicyToGroup(
        policyTree.kind === 'group' ? policyTree : createPolicyTreeRoot(policies.map((policy) => policy.id)),
        attachPath,
        document.id,
      );
      await persistTree(nextTree);
      if (document.enabled) {
        const nextIds = [...policyIds, document.id];
        await applySingleEnabledPolicy(document.id, [...policies, document], nextIds);
      }
      setActivePolicyId(document.id);
      setNameDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save policy.';
      setNameDialogError(message);
      setFormError(message);
    }
  };

  const deleteActivePolicy = async () => {
    if (!activePolicyId) {
      return;
    }
    setFormError(null);
    const deletingId = activePolicyId;
    const remainingPolicies = policies.filter((policy) => policy.id !== deletingId);
    const remainingIds = remainingPolicies.map((policy) => policy.id);
    try {
      await deletePolicyMutation.mutateAsync({ id: deletingId, edgeModelId: model.id });
      const nextTree = removePolicyFromTree(binding?.policyTree, deletingId, remainingIds);
      await persistTree(nextTree);
      if (remainingIds.length === 0) {
        setActivePolicyId(null);
        return;
      }
      const targetEnabledId = pickEnabledPolicyId(remainingPolicies, remainingIds);
      if (!targetEnabledId) {
        setActivePolicyId(null);
        return;
      }
      await applySingleEnabledPolicy(targetEnabledId, remainingPolicies, remainingIds);
      setActivePolicyId(targetEnabledId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete policy.';
      setFormError(message);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <>
      <CreateEditModalShell
        size="maximized"
        title={(
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span>Record Policies</span>
            <span className="font-normal text-slate-400" aria-hidden>—</span>
            <span className="truncate font-mono font-semibold text-indigo-600">{model.objectName}</span>
          </span>
        )}
        subtitle={(
          <div className="flex w-full min-w-0 items-center gap-1.5">
            <UiCheckbox
              checked={Boolean(binding?.forceScopeForAdmin)}
              onChange={(event) => {
                void persistBinding({ forceScopeForAdmin: Boolean(event.target.checked) });
              }}
              isDisabled={!binding || saveBindingMutation.isPending}
            >
              {FORCE_SCOPE_FOR_ADMIN_LABEL}
            </UiCheckbox>
            <FieldHintTooltip
              label={FORCE_SCOPE_FOR_ADMIN_LABEL}
              hint={FORCE_SCOPE_FOR_ADMIN_HINT}
              contentClassName="max-w-[22rem]"
            />
          </div>
        )}
        subtitleClassName="!overflow-visible !text-inherit"
        metaBand={(
          <div dir="ltr" className="w-full min-w-0">
            <UiOptionCardGroup
              value={recordScope}
              onChange={(value) => {
                if (value === recordScope) return;
                void persistBinding({ recordScope: value as RecordScopeMode });
              }}
              disabled={!binding || saveBindingMutation.isPending}
              ariaLabel="Record scope"
              columns={2}
              density="compact"
              className="w-full"
              options={RECORD_SCOPE_MODE_OPTIONS.map((option) => ({
                value: option.value,
                title: option.title,
                description: option.description,
                icon: option.icon,
              }))}
            />
          </div>
        )}
        metaBandTone="elevated"
        metaBandClassName="!overflow-visible !text-inherit !border-indigo-100 !bg-indigo-50/50 !py-2.5"
        secondaryMetaBand={(
          <RecordPolicyPolicyBand
            policyIds={policyIds}
            policies={policies}
            activePolicyId={activePolicyId}
            isActivating={isActivating}
            onSelectPolicy={setActivePolicy}
            onActivatePolicy={(policyId) => {
              void activatePolicy(policyId);
            }}
            onAddPolicy={() => {
              setNameDialogError(null);
              setNameDialogOpen(true);
            }}
            onDeleteActivePolicy={() => {
              void deleteActivePolicy();
            }}
          />
        )}
        secondaryMetaBandTone="muted"
        secondaryMetaBandClassName="!overflow-visible !text-inherit !border-slate-200 !bg-slate-100/90 !py-2"
        shellClassName="flex min-h-0 flex-col overflow-hidden"
        bodyOuterClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !min-h-0 !p-0"
        onClose={onClose}
        onBackdropClick={onClose}
      >
        <div className="flex h-full min-h-0 flex-col">
          {formError ? (
            <p className="shrink-0 border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs font-semibold text-red-600">
              {formError}
            </p>
          ) : null}
          {scopeOnWithoutActive ? (
            <p className="shrink-0 border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">
              Record scope is On but no active policy is set. Queries still return every row until you set one policy active.
            </p>
          ) : null}
          {scopeIsEnforced ? (
            <p className="shrink-0 border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-900">
              Active policy
              {' '}
              <span className="font-semibold">{enabledPolicies[0]?.name ?? 'Policy'}</span>
              {' '}
              is enforced on Data API queries for this model.
            </p>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
            {policiesQuery.isLoading || bindingQuery.isLoading ? (
              <p className={cn('px-4 py-3', MODELER_CAPTION_CLASS)}>Loading policies…</p>
            ) : (
              <RecordPolicyTreeEditor
                activePolicy={activePolicy}
                fields={columns.length > 0 ? columns : ['id']}
                dimensionKeys={dimensionKeys}
                contextKeys={serverContextKeys}
                onSavePolicy={savePolicy}
                onRequestCreatePolicy={() => {
                  setNameDialogError(null);
                  setNameDialogOpen(true);
                }}
              />
            )}
          </div>
        </div>
      </CreateEditModalShell>
      <RecordPolicyNameDialog
        open={nameDialogOpen}
        isSaving={savePolicyMutation.isPending}
        error={nameDialogError}
        onClose={() => {
          if (savePolicyMutation.isPending) {
            return;
          }
          setNameDialogOpen(false);
          setNameDialogError(null);
        }}
        onSubmit={(name) => {
          void createPolicy(name);
        }}
      />
    </>
  );
};
