import React from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { RecordPolicyDocument } from '../../../shared/api/contracts/record-policy';
import { AppButton, NativeButton } from '../../../shared/ui';
import {
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_DELETE_CLASS,
} from '../../../shared/ui/surfaceClasses';

export type RecordPolicyPolicyBandProps = {
  policyIds: readonly string[];
  policies: readonly RecordPolicyDocument[];
  activePolicyId: string | null;
  isActivating?: boolean;
  onSelectPolicy: (policyId: string) => void;
  onActivatePolicy: (policyId: string) => void;
  onAddPolicy: () => void;
  onDeleteActivePolicy: () => void;
};

export const RecordPolicyPolicyBand: React.FC<RecordPolicyPolicyBandProps> = ({
  policyIds,
  policies,
  activePolicyId,
  isActivating = false,
  onSelectPolicy,
  onActivatePolicy,
  onAddPolicy,
  onDeleteActivePolicy,
}) => {
  const activePolicy = policies.find((policy) => policy.id === activePolicyId) ?? null;

  return (
    <div dir="ltr" className="flex w-full min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {policyIds.map((policyId) => {
            const policy = policies.find((item) => item.id === policyId);
            const selected = policyId === activePolicyId;
            const isRuntimeActive = Boolean(policy?.enabled);
            return (
              <NativeButton
                key={policyId}
                type="button"
                className={cn(
                  'inline-flex max-w-[14rem] items-center gap-1.5 truncate rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors',
                  selected
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                )}
                title={policy?.name ?? 'Policy'}
                onClick={() => onSelectPolicy(policyId)}
              >
                <span className="truncate">{policy?.name ?? 'Policy'}</span>
                {isRuntimeActive ? (
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-emerald-100 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                    <Check className="h-2.5 w-2.5" aria-hidden />
                    Active
                  </span>
                ) : null}
              </NativeButton>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {activePolicyId && !activePolicy?.enabled ? (
            <AppButton
              intent="secondary"
              size="sm"
              disabled={isActivating}
              onClick={() => onActivatePolicy(activePolicyId)}
            >
              Set active
            </AppButton>
          ) : null}
          <AppButton intent="secondary" size="sm" onClick={onAddPolicy}>
            <Plus className="h-3.5 w-3.5" />
            Add policy
          </AppButton>
          <NativeButton
            type="button"
            className={cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_DELETE_CLASS)}
            aria-label="Delete policy"
            title="Delete selected policy"
            disabled={!activePolicyId}
            onClick={onDeleteActivePolicy}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </NativeButton>
        </div>
    </div>
  );
};
