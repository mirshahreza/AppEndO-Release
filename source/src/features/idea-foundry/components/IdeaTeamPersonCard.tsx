import React from 'react';
import { Crown, UserRound, Users, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { IdeaTeamPerson } from '../../../shared/api/contracts/idea-foundry/types';
import { ActionTooltip, AppButton, UiAvatar } from '../../../shared/ui';
import { ideaToneChipClass } from '../ideaFoundryCatalog';

type IdeaTeamPersonCardProps = {
  person: IdeaTeamPerson;
  role: 'decision-maker' | 'collaborator';
  onChange?: () => void;
  onMakeDecisionMaker?: () => void;
  onRemove?: () => void;
};

const initial = (person: IdeaTeamPerson): string => (
  (person.displayName.trim() || person.username || '?').slice(0, 1).toUpperCase()
);

export const IdeaTeamPersonCard: React.FC<IdeaTeamPersonCardProps> = ({
  person,
  role,
  onChange,
  onMakeDecisionMaker,
  onRemove,
}) => {
  const isDecisionMaker = role === 'decision-maker';
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <UiAvatar
        size="md"
        src={person.avatarUrl ?? undefined}
        alt=""
        fallback={initial(person)}
        color={isDecisionMaker ? 'warning' : 'default'}
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-slate-800">{person.displayName}</span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
              ideaToneChipClass(isDecisionMaker ? 'amber' : 'slate'),
            )}
          >
            {isDecisionMaker ? <Crown className="h-3 w-3 shrink-0" aria-hidden /> : null}
            {isDecisionMaker ? 'Decision maker' : 'Collaborator'}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs font-medium text-slate-500">@{person.username}</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {onChange ? (
          <ActionTooltip content="Change decision maker">
            <AppButton
              intent="utility"
              size="icon-sm"
              aria-label="Change decision maker"
              onClick={onChange}
            >
              <Users className="h-3.5 w-3.5" />
            </AppButton>
          </ActionTooltip>
        ) : null}
        {onMakeDecisionMaker ? (
          <ActionTooltip content="Make decision maker">
            <AppButton
              intent="utility"
              size="icon-sm"
              aria-label={`Make ${person.displayName} the decision maker`}
              onClick={onMakeDecisionMaker}
            >
              <Crown className="h-3.5 w-3.5" />
            </AppButton>
          </ActionTooltip>
        ) : null}
        {onRemove ? (
          <ActionTooltip content="Remove collaborator">
            <AppButton
              intent="cancel"
              size="icon-sm"
              closeIcon
              aria-label={`Remove ${person.displayName}`}
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

type IdeaTeamAddCardProps = {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
};

export const IdeaTeamAddCard: React.FC<IdeaTeamAddCardProps> = ({
  label,
  onClick,
  icon,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700"
  >
    {icon ?? <UserRound className="h-3.5 w-3.5" aria-hidden />}
    {label}
  </button>
);
