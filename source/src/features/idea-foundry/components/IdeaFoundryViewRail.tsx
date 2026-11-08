import React from 'react';
import { Bot, Crown } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { formatDisplayDateYmd } from '../../../shared/lib/gridDateFormat';
import type {
  IdeaTeamModel,
  IdeaTeamPerson,
  ProductIdeaRecord,
} from '../../../shared/api/contracts/idea-foundry/types';
import {
  DirectionalText,
  FieldHintTooltip,
  ICON_LABEL_ROW_CLASS,
  INSPECTOR_RAIL_ASIDE_CLASS,
  INSPECTOR_RAIL_CARD_CLASS,
  INSPECTOR_RAIL_INNER_CLASS,
  INSPECTOR_RAIL_KV_CLASS,
  INSPECTOR_RAIL_LABEL_CLASS,
  INSPECTOR_RAIL_TITLE_CLASS,
  INSPECTOR_RAIL_VALUE_CLASS,
  UiAvatar,
} from '../../../shared/ui';
import {
  formatIdeaHomeLabel,
  IDEA_IMPORTANCE_LABEL,
  IDEA_SCALE_LABEL,
} from '../ideaFoundryCatalog';

type IdeaFoundryViewRailProps = {
  idea: ProductIdeaRecord;
  widthPx?: number;
};

const RAIL_BADGE_CLASS =
  'inline-flex max-w-full truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700';
const RAIL_CHIP_CLASS =
  'flex h-8 w-full min-w-0 items-center gap-1.5 rounded-md bg-slate-100 px-2 text-start text-xs font-semibold text-slate-700';
const EMPTY_VALUE = 'None selected';

const personInitial = (person: IdeaTeamPerson): string => (
  (person.displayName.trim() || person.username || '?').slice(0, 1).toUpperCase()
);

const formatIdeaAuditDate = (iso: string): string => formatDisplayDateYmd(iso, '');

const RailSection: React.FC<{
  title?: string;
  hint?: string;
  testId?: string;
  children: React.ReactNode;
}> = ({ title, hint, testId, children }) => (
  <section
    className={INSPECTOR_RAIL_CARD_CLASS}
    data-testid={testId}
  >
    {title ? (
      <div className={cn(ICON_LABEL_ROW_CLASS, 'mb-3')}>
        <h2 className={INSPECTOR_RAIL_TITLE_CLASS}>{title}</h2>
        {hint ? <FieldHintTooltip hint={hint} label={title} /> : null}
      </div>
    ) : null}
    <div className={INSPECTOR_RAIL_KV_CLASS}>{children}</div>
  </section>
);

const KvRow: React.FC<{
  label: React.ReactNode;
  value: React.ReactNode;
}> = ({ label, value }) => (
  <>
    <div className={INSPECTOR_RAIL_LABEL_CLASS}>{label}</div>
    <div className={INSPECTOR_RAIL_VALUE_CLASS}>
      {typeof value === 'string' ? <DirectionalText as="span" text={value} /> : value}
    </div>
  </>
);

const EmptyValue: React.FC = () => (
  <span className="text-xs text-slate-400">{EMPTY_VALUE}</span>
);

const PersonBadge: React.FC<{
  person: IdeaTeamPerson;
  decisionMaker?: boolean;
}> = ({ person, decisionMaker = false }) => (
  <span className={RAIL_CHIP_CLASS}>
    <UiAvatar size="sm" src={person.avatarUrl ?? undefined} alt="" fallback={personInitial(person)} />
    <span className="min-w-0 truncate text-sm font-semibold text-slate-800">{person.displayName}</span>
    {decisionMaker ? <Crown className="h-3 w-3 shrink-0 text-slate-500" aria-hidden /> : null}
  </span>
);

const ModelBadge: React.FC<{
  model: IdeaTeamModel;
  lead?: boolean;
}> = ({ model, lead = false }) => (
  <span className={RAIL_CHIP_CLASS}>
    {lead
      ? <Crown className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
      : <Bot className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />}
    <span className="min-w-0 truncate">{model.name}</span>
  </span>
);

const ChipStack: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex w-full min-w-0 flex-col items-stretch gap-1.5">{children}</div>
);

const formatAuditDetail = (username: string | null, iso: string): string | null => {
  const who = username?.trim() || '';
  const when = formatIdeaAuditDate(iso);
  if (!who && !when) return null;
  if (who && when) return `${who} • ${when}`;
  return who || when;
};

export const IdeaFoundryViewRail: React.FC<IdeaFoundryViewRailProps> = ({ idea, widthPx }) => {
  const createdDetail = formatAuditDetail(idea.createdByUsername, idea.createdAt);
  const editedDetail = formatAuditDetail(idea.updatedByUsername, idea.updatedAt);
  const leadModel = idea.models[0];
  const supportingModels = idea.models.slice(1);

  return (
    <aside
      className={INSPECTOR_RAIL_ASIDE_CLASS}
      style={widthPx ? { width: `${widthPx}px` } : undefined}
      data-testid="idea-foundry-view-rail"
    >
      <div className={INSPECTOR_RAIL_INNER_CLASS}>
        <RailSection
          title="Metadata"
          hint="Where the idea lives, how hard it pulls attention, and how big the slice is."
        >
          <KvRow
            label="Kind"
            value={<span className={RAIL_BADGE_CLASS}>{formatIdeaHomeLabel(idea)}</span>}
          />
          <KvRow
            label="Importance"
            value={(
              <span className={RAIL_BADGE_CLASS}>
                {IDEA_IMPORTANCE_LABEL[idea.importance] ?? idea.importance}
              </span>
            )}
          />
          <KvRow
            label="Scale"
            value={(
              <span className={RAIL_BADGE_CLASS}>
                {IDEA_SCALE_LABEL[idea.scale] ?? idea.scale}
              </span>
            )}
          />
        </RailSection>

        <RailSection
          title="Team"
          hint="Who decides, who collaborates, and which model leads."
        >
          <KvRow
            label="Decision maker"
            value={idea.decisionMaker
              ? <PersonBadge person={idea.decisionMaker} decisionMaker />
              : <EmptyValue />}
          />
          <KvRow
            label="Collaborators"
            value={idea.collaborators.length > 0 ? (
              <ChipStack>
                {idea.collaborators.map((person) => (
                  <PersonBadge key={person.userId} person={person} />
                ))}
              </ChipStack>
            ) : <EmptyValue />}
          />
          <div className="col-span-3 my-1 border-t border-slate-100" role="separator" />
          <KvRow
            label="Lead model"
            value={leadModel ? <ModelBadge model={leadModel} lead /> : <EmptyValue />}
          />
          <KvRow
            label="Supporting models"
            value={supportingModels.length > 0 ? (
              <ChipStack>
                {supportingModels.map((model) => (
                  <ModelBadge key={model.id} model={model} />
                ))}
              </ChipStack>
            ) : <EmptyValue />}
          />
        </RailSection>

        {createdDetail || editedDetail ? (
          <RailSection testId="idea-foundry-view-audit">
            {createdDetail ? (
              <KvRow
                label="Created"
                value={<span className="text-xs text-slate-500">{createdDetail}</span>}
              />
            ) : null}
            {editedDetail ? (
              <KvRow
                label="Edited"
                value={<span className="text-xs text-slate-500">{editedDetail}</span>}
              />
            ) : null}
          </RailSection>
        ) : null}
      </div>
    </aside>
  );
};
