import React from 'react';
import { Plus, X } from 'lucide-react';
import { UiInput, UiSelect, UiCheckbox } from '../../../shared/ui';
import { MappingFieldsEditor } from './MappingFieldsEditor';
import type { CanonicalMapping } from '../types';

/**
 * HWF-2.3 — Repository Reality Audit finding (2026-08-30): `WorkItemEscalationPolicy` has been a
 * fully real, tested backend feature since Slice 8, but had ZERO Designer UI anywhere in the
 * codebase — an author could only set it by hand-editing the raw workflow JSON. This is the first
 * UI for it. A `NOTIFY`-only step (no state change, just an alert) is labeled "Reminder"; every
 * other action type is labeled "Escalation" — the distinction the plan asked for, now visible.
 */

type EscalationStepAction =
  | { type: 'REASSIGN_USER'; userId: string }
  | { type: 'REASSIGN_ROLE'; roleId: string }
  | { type: 'RAISE_PRIORITY'; priority: number }
  | { type: 'COMPLETE_WITH_OUTCOME'; outcomeKey: string; output: CanonicalMapping }
  | { type: 'FAIL_WORKFLOW_NODE'; errorCode: string; safeMessage: string }
  | { type: 'NOTIFY'; notificationRef: { bindingType: string; bindingId: string }; input: CanonicalMapping };

type EscalationStep = {
  key: string;
  trigger: { type: 'AFTER_OPEN_MS'; afterMs: number; respectBusinessHours?: boolean };
  action: EscalationStepAction;
  maxExecutions: number;
};

export type EscalationPolicy = { steps: EscalationStep[] };

const EMPTY_MAPPING: CanonicalMapping = { type: 'OBJECT', fields: {} };

/** `notificationRef` is part of the AWM shape but is not actually read by the runtime NOTIFY handler (`workItemEscalationService.ts` resolves everything from `input`'s mapped fields) — a fixed placeholder is honest here, not a lie about functionality. */
const defaultActionForType = (type: EscalationStepAction['type']): EscalationStepAction => {
  switch (type) {
    case 'REASSIGN_USER': return { type, userId: '' };
    case 'REASSIGN_ROLE': return { type, roleId: '' };
    case 'RAISE_PRIORITY': return { type, priority: 1 };
    case 'COMPLETE_WITH_OUTCOME': return { type, outcomeKey: '', output: EMPTY_MAPPING };
    case 'FAIL_WORKFLOW_NODE': return { type, errorCode: '', safeMessage: '' };
    case 'NOTIFY': return { type, notificationRef: { bindingType: 'notification', bindingId: 'default' }, input: EMPTY_MAPPING };
    default: {
      const exhaustive: never = type;
      throw new Error(`Unknown escalation action type: ${String(exhaustive)}`);
    }
  }
};

type EditorContext = { consumerNodeKey: string | null; isWaitEventContext: boolean; isWorkItemOutputContext: boolean; isOutputAssignmentContext: boolean; isForEachItemContext: boolean };

export const EscalationPolicyEditor: React.FC<{
  definitionId: number;
  policy: EscalationPolicy | undefined;
  onChange: (policy: EscalationPolicy | undefined) => void;
  context: EditorContext;
  getOutputFieldNames?: (nodeKey: string) => string[];
  getOutputFieldPaths?: (nodeKey: string) => string[][];
}> = ({ definitionId, policy, onChange, context, getOutputFieldNames, getOutputFieldPaths }) => {
  const steps = policy?.steps ?? [];

  const setSteps = (next: EscalationStep[]) => onChange(next.length > 0 ? { steps: next } : undefined);

  const addStep = () => {
    setSteps([
      ...steps,
      { key: `escalation-${steps.length + 1}`, trigger: { type: 'AFTER_OPEN_MS', afterMs: 86_400_000 }, action: defaultActionForType('NOTIFY'), maxExecutions: 1 },
    ]);
  };

  const updateStep = (index: number, patch: Partial<EscalationStep>) => setSteps(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const removeStep = (index: number) => setSteps(steps.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-2 rounded border border-slate-200 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-700">Escalation policy</span>
        <button type="button" onClick={addStep} className="flex items-center gap-1 text-[11px] font-medium text-primary-700 hover:underline">
          <Plus className="h-3 w-3" /> Add step
        </button>
      </div>

      {steps.length === 0 ? (
        <p className="text-[10px] font-normal text-slate-400">No escalation steps — this Work Item never auto-escalates or reminds anyone while open.</p>
      ) : (
        steps.map((step, index) => {
          const isReminder = step.action.type === 'NOTIFY';
          return (
            // eslint-disable-next-line react/no-array-index-key
            <div key={index} className="flex flex-col gap-1.5 rounded border border-slate-100 bg-slate-50 p-2">
              <div className="flex items-center justify-between">
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${isReminder ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isReminder ? 'Reminder (no state change)' : 'Escalation'}
                </span>
                <button type="button" aria-label="Remove escalation step" onClick={() => removeStep(index)} className="text-slate-400 hover:text-rose-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-600">
                  Step key
                  <UiInput size="sm" aiAssist={false} autoDir={false} className="text-xs font-normal" value={step.key} onChange={(e) => updateStep(index, { key: e.target.value })} />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-600">
                  After (ms since opened)
                  <UiInput
                    type="number"
                    size="sm"
                    aiAssist={false}
                    className="text-xs font-normal"
                    value={step.trigger.afterMs}
                    onChange={(e) => updateStep(index, { trigger: { ...step.trigger, afterMs: Number(e.target.value) } })}
                  />
                </label>
              </div>

              <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
                <UiCheckbox size="sm" checked={Boolean(step.trigger.respectBusinessHours)} onChange={(e) => updateStep(index, { trigger: { ...step.trigger, respectBusinessHours: e.target.checked } })} />
                Respect business hours calendar (HWF-2.2)
              </label>

              <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-600">
                Action
                <UiSelect
                  size="sm"
                  className="text-xs font-normal"
                  value={step.action.type}
                  onChange={(e) => updateStep(index, { action: defaultActionForType(e.target.value as EscalationStepAction['type']) })}
                >
                  <option value="NOTIFY">Notify (reminder)</option>
                  <option value="REASSIGN_USER">Reassign to user</option>
                  <option value="REASSIGN_ROLE">Reassign to role</option>
                  <option value="RAISE_PRIORITY">Raise priority</option>
                  <option value="COMPLETE_WITH_OUTCOME">Auto-complete with outcome</option>
                  <option value="FAIL_WORKFLOW_NODE">Fail the workflow node</option>
                </UiSelect>
              </label>

              {step.action.type === 'REASSIGN_USER' ? (
                <UiInput size="sm" aiAssist={false} autoDir={false} className="text-xs font-normal" placeholder="target user id" value={step.action.userId} onChange={(e) => updateStep(index, { action: { type: 'REASSIGN_USER', userId: e.target.value } })} />
              ) : null}

              {step.action.type === 'REASSIGN_ROLE' ? (
                <UiInput size="sm" aiAssist={false} autoDir={false} className="text-xs font-normal" placeholder="target role name" value={step.action.roleId} onChange={(e) => updateStep(index, { action: { type: 'REASSIGN_ROLE', roleId: e.target.value } })} />
              ) : null}

              {step.action.type === 'RAISE_PRIORITY' ? (
                <UiInput type="number" size="sm" aiAssist={false} className="text-xs font-normal" placeholder="new priority" value={step.action.priority} onChange={(e) => updateStep(index, { action: { type: 'RAISE_PRIORITY', priority: Number(e.target.value) } })} />
              ) : null}

              {step.action.type === 'FAIL_WORKFLOW_NODE' ? (
                <>
                  <UiInput size="sm" aiAssist={false} autoDir={false} className="text-xs font-normal" placeholder="error code" value={step.action.errorCode} onChange={(e) => updateStep(index, { action: { type: 'FAIL_WORKFLOW_NODE', errorCode: e.target.value, safeMessage: (step.action as { safeMessage: string }).safeMessage } })} />
                  <UiInput size="sm" aiAssist={false} autoDir={false} className="text-xs font-normal" placeholder="safe message" value={step.action.safeMessage} onChange={(e) => updateStep(index, { action: { type: 'FAIL_WORKFLOW_NODE', errorCode: (step.action as { errorCode: string }).errorCode, safeMessage: e.target.value } })} />
                </>
              ) : null}

              {step.action.type === 'COMPLETE_WITH_OUTCOME' ? (
                <>
                  <UiInput size="sm" aiAssist={false} autoDir={false} className="text-xs font-normal" placeholder="outcome key" value={step.action.outcomeKey} onChange={(e) => updateStep(index, { action: { type: 'COMPLETE_WITH_OUTCOME', outcomeKey: e.target.value, output: (step.action as { output: CanonicalMapping }).output } })} />
                  <MappingFieldsEditor
                    label="Auto-completion output"
                    definitionId={definitionId}
                    mapping={step.action.output}
                    onChange={(m) => updateStep(index, { action: { type: 'COMPLETE_WITH_OUTCOME', outcomeKey: (step.action as { outcomeKey: string }).outcomeKey, output: m } })}
                    context={context}
                    getOutputFieldNames={getOutputFieldNames}
                    getOutputFieldPaths={getOutputFieldPaths}
                  />
                </>
              ) : null}

              {step.action.type === 'NOTIFY' ? (
                <>
                  <p className="text-[10px] font-normal text-slate-400">Recognized fields: title, body, severity, href, userId, roleId — falls back to the Work Item&apos;s own assignee if userId/roleId aren&apos;t set.</p>
                  <MappingFieldsEditor
                    label="Notification fields"
                    definitionId={definitionId}
                    mapping={step.action.input}
                    onChange={(m) => updateStep(index, { action: { type: 'NOTIFY', notificationRef: (step.action as { notificationRef: { bindingType: string; bindingId: string } }).notificationRef, input: m } })}
                    context={context}
                    getOutputFieldNames={getOutputFieldNames}
                    getOutputFieldPaths={getOutputFieldPaths}
                  />
                </>
              ) : null}

              <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-600">
                Max executions
                <UiInput type="number" size="sm" aiAssist={false} min={1} className="text-xs font-normal" value={step.maxExecutions} onChange={(e) => updateStep(index, { maxExecutions: Number(e.target.value) })} />
              </label>
            </div>
          );
        })
      )}
    </div>
  );
};
