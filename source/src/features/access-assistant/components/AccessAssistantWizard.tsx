import React, { useEffect, useMemo, useState } from 'react';
import { Check, KeyRound, User } from 'lucide-react';
import type { FunctionAccessEntityKind } from '../../../shared/api/contracts/server-functions/entityAccess';
import {
  useAccessAssistantContextQuery,
  useSaveAccessAssistantContextMutation,
} from '../../../shared/api/queries/access-assistant';
import {
  StepWizardShell,
} from '../../../shared/ui';
import type { StepWizardStepDef } from '../../../shared/ui/StepWizardShell';
import { AccessAssistantAccessStep } from './AccessAssistantAccessStep';
import { AccessAssistantSubjectStep } from './AccessAssistantSubjectStep';
import { cn } from '../../../lib/utils';

export type AccessAssistantWizardProps = {
  open: boolean;
  pageKey: string;
  pageTitle: string;
  onClose: () => void;
};

export const AccessAssistantWizard: React.FC<AccessAssistantWizardProps> = ({
  open,
  pageKey,
  pageTitle,
  onClose,
}) => {
  const [step, setStep] = useState(0);
  const [entityKind, setEntityKind] = useState<FunctionAccessEntityKind | null>(null);
  const [entityKey, setEntityKey] = useState<string | null>(null);
  const [allowedMap, setAllowedMap] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const contextQuery = useAccessAssistantContextQuery(
    pageKey,
    entityKind,
    entityKey,
    open && Boolean(entityKind && entityKey),
  );
  const saveMutation = useSaveAccessAssistantContextMutation();

  useEffect(() => {
    if (!open) {
      setStep(0);
      setEntityKind(null);
      setEntityKey(null);
      setAllowedMap({});
      setSaveError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!contextQuery.data?.surfaces) {
      return;
    }
    const next: Record<string, boolean> = {};
    for (const surface of contextQuery.data.surfaces) {
      for (const fn of surface.functions) {
        next[fn.id] = fn.allowed;
      }
    }
    setAllowedMap(next);
  }, [contextQuery.data]);

  const steps = useMemo<readonly StepWizardStepDef[]>(() => [
    {
      title: 'Subject',
      icon: User,
      description: 'Choose a user or role to configure.',
    },
    {
      title: 'Access',
      icon: KeyRound,
      description: 'Allow functions used by this screen.',
    },
  ], []);

  const toggleAllowed = (functionId: string, checked: boolean) => {
    setAllowedMap((current) => ({ ...current, [functionId]: checked }));
  };

  const handleSave = async () => {
    if (!entityKind || !entityKey) {
      return false;
    }
    setSaveError(null);
    try {
      await saveMutation.mutateAsync({
        pageKey,
        payload: {
          entityKind,
          entityKey,
          allowedByFunctionId: allowedMap,
        },
      });
      onClose();
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save access.');
      return false;
    }
  };

  const canAdvanceFromStep0 = Boolean(entityKind && entityKey);

  const handleNext = () => {
    if (step === 0 && !canAdvanceFromStep0) {
      return false;
    }
    return true;
  };

  if (!open) {
    return null;
  }

  return (
    <>
      <StepWizardShell
        size="5xl"
        title={`Configuring access for: ${pageTitle}`}
        titleIcon={KeyRound}
        steps={steps}
        step={step}
        onStepChange={(nextStep) => {
          if (nextStep > 0 && !canAdvanceFromStep0) {
            return;
          }
          setSaveError(null);
          setStep(nextStep);
        }}
        onClose={onClose}
        onNext={handleNext}
        canMoveNext={step === 0 ? canAdvanceFromStep0 : true}
        canActivateStep={(index) => index === 0 || canAdvanceFromStep0}
        finalStepAction={{
          label: saveMutation.isPending ? 'Saving…' : 'Save access',
          icon: <Check className="h-3.5 w-3.5" />,
          disabled: saveMutation.isPending || contextQuery.data?.adminBypass,
          onClick: () => void handleSave(),
        }}
        bodyInnerClassName={cn(
          'flex min-h-0 flex-1 flex-col',
          '!overflow-hidden',
        )}
      >
        {saveError ? (
          <div className="mb-3 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {saveError}
          </div>
        ) : null}

        {step === 0 ? (
          <AccessAssistantSubjectStep
            wizardOpen={open}
            entityKind={entityKind}
            onEntityKindChange={(kind) => {
              setEntityKind(kind);
              setEntityKey(null);
            }}
            entityKey={entityKey}
            onEntitySelect={(key) => {
              setEntityKey(key);
            }}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {contextQuery.isLoading ? (
              <p className="text-sm text-slate-500">Loading functions…</p>
            ) : contextQuery.isError ? (
              <p className="text-sm text-rose-600">Failed to load access details.</p>
            ) : contextQuery.data?.adminBypass ? (
              <p className="text-sm text-slate-600">
                This principal bypasses server function access (admin account, ADMIN, or DEVELOPER). Nothing to change here.
              </p>
            ) : (contextQuery.data?.surfaces ?? []).length === 0 ? (
              <p className="text-sm text-slate-600">No mapped functions for this page.</p>
            ) : (
              <AccessAssistantAccessStep
                surfaces={contextQuery.data?.surfaces ?? []}
                allowedMap={allowedMap}
                onToggleAllowed={toggleAllowed}
                disabled={saveMutation.isPending}
              />
            )}
          </div>
        )}
      </StepWizardShell>
    </>
  );
};
