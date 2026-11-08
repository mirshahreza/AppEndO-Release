import React from 'react';
import { Crown, Layers, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { IdeaTeamModel } from '../../../shared/api/contracts/idea-foundry/types';
import { ActionTooltip, AppButton } from '../../../shared/ui';
import { ideaToneChipClass, resolveIdeaModelProviderChrome } from '../ideaFoundryCatalog';

type IdeaTeamModelCardProps = {
  model: IdeaTeamModel;
  role: 'lead' | 'supporting';
  onChange?: () => void;
  onMakeLead?: () => void;
  onRemove?: () => void;
};

export const IdeaTeamModelCard: React.FC<IdeaTeamModelCardProps> = ({
  model,
  role,
  onChange,
  onMakeLead,
  onRemove,
}) => {
  const chrome = resolveIdeaModelProviderChrome(model);
  const Icon = chrome.icon;
  const version = model.modelId?.trim() || null;
  const isLead = role === 'lead';
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <span
        className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
          ideaToneChipClass(isLead ? 'amber' : chrome.tone),
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-slate-800">{model.name}</span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
              ideaToneChipClass(isLead ? 'amber' : 'slate'),
            )}
          >
            {isLead ? <Crown className="h-3 w-3 shrink-0" aria-hidden /> : null}
            {isLead ? 'Lead model' : 'Supporting'}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
          {chrome.label}{version ? ` · ${version}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {onChange ? (
          <ActionTooltip content="Change lead model">
            <AppButton
              intent="utility"
              size="icon-sm"
              aria-label="Change lead model"
              onClick={onChange}
            >
              <Layers className="h-3.5 w-3.5" />
            </AppButton>
          </ActionTooltip>
        ) : null}
        {onMakeLead ? (
          <ActionTooltip content="Make lead model">
            <AppButton
              intent="utility"
              size="icon-sm"
              aria-label={`Make ${model.name} the lead model`}
              onClick={onMakeLead}
            >
              <Crown className="h-3.5 w-3.5" />
            </AppButton>
          </ActionTooltip>
        ) : null}
        {onRemove ? (
          <ActionTooltip content="Remove model">
            <AppButton
              intent="cancel"
              size="icon-sm"
              closeIcon
              aria-label={`Remove ${model.name}`}
              onClick={onRemove}
            >
              <X className="h-3.5 w-3.5" />
            </AppButton>
          </ActionTooltip>
        ) : null}
      </div>
    </div>
  );
};
