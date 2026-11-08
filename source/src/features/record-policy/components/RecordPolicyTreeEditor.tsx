import React from 'react';
import { Plus } from 'lucide-react';
import type { RecordPolicyDocument } from '../../../shared/api/contracts/record-policy';
import { AppButton } from '../../../shared/ui';
import { RecordPolicyPredicateBuilder } from './RecordPolicyPredicateBuilder';

type RecordPolicyTreeEditorProps = {
  activePolicy: RecordPolicyDocument | null;
  fields: string[];
  dimensionKeys: string[];
  contextKeys: string[];
  onSavePolicy: (policy: RecordPolicyDocument) => Promise<void>;
  onRequestCreatePolicy: () => void;
};

const persistPolicy = (
  policy: RecordPolicyDocument,
  patch: Partial<RecordPolicyDocument>,
): RecordPolicyDocument => ({
  ...policy,
  ...patch,
  version: policy.version + 1,
});

/** White-canvas predicate editor for the active policy. */
export const RecordPolicyTreeEditor: React.FC<RecordPolicyTreeEditorProps> = ({
  activePolicy,
  fields,
  dimensionKeys,
  contextKeys,
  onSavePolicy,
  onRequestCreatePolicy,
}) => (
  <div className="flex min-h-0 flex-1 flex-col bg-white">
    <div className="min-h-0 flex-1 overflow-auto">
      {activePolicy ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          <RecordPolicyPredicateBuilder
            key={activePolicy.id}
            predicate={activePolicy.predicate}
            fields={fields}
            dimensionKeys={dimensionKeys}
            contextKeys={contextKeys}
            onChange={(predicate) => {
              void onSavePolicy(persistPolicy(activePolicy, { predicate }));
            }}
          />
        </div>
      ) : (
        <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm font-medium text-slate-600">No policies yet</p>
          <p className="max-w-sm text-xs text-slate-500">
            Add a policy to build row filters with the same Where builder as Base Components.
          </p>
          <AppButton intent="secondary" size="sm" onClick={onRequestCreatePolicy}>
            <Plus className="h-3.5 w-3.5" />
            Add policy
          </AppButton>
        </div>
      )}
    </div>
  </div>
);
