import React, { useState } from 'react';
import {
  RELATION_FORM_WIDGET_OPTIONS,
  relationFormWidgetOptionsForKind,
  type RelationFormWidget,
  type RelationWidgetKindHint,
} from '../../api/contracts/data-api';
import { cn } from '../../../lib/utils';
import { FieldHintTooltip } from '../FieldHintTooltip';
import { FormSection, FORM_FIELD_HINT_SLOT_CLASS } from '../FormSection';
import type { HeroUiFieldSize } from '../heroFieldSize';
import { RELATION_FORM_WIDGET_COMPONENTS } from './RelationFormWidgetDemos';

const KIND_SECTIONS: readonly {
  kind: RelationWidgetKindHint;
  title: string;
  description: string;
}[] = [
  {
    kind: 'belongsTo',
    title: 'Belongs to / physical',
    description: 'Pick one existing related record (FK picker).',
  },
  {
    kind: 'hasOne',
    title: 'Has one',
    description: 'Create / edit at most one owned nested record.',
  },
  {
    kind: 'hasMany',
    title: 'Has many',
    description: 'Manage an owned child collection (add / edit / remove rows).',
  },
  {
    kind: 'belongsToMany',
    title: 'Belongs to many',
    description: 'Attach / detach existing peers through a junction table.',
  },
];

const KIND_TONE: Record<RelationWidgetKindHint, string> = {
  belongsTo: 'bg-sky-50 text-sky-700 border-sky-200',
  physical: 'bg-sky-50 text-sky-700 border-sky-200',
  hasOne: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  hasMany: 'bg-violet-50 text-violet-700 border-violet-200',
  belongsToMany: 'bg-amber-50 text-amber-800 border-amber-200',
};

export type RelationFormWidgetGalleryProps = {
  size?: HeroUiFieldSize;
  disabled?: boolean;
  /** Limit to a relation kind (default: show all kinds). */
  kind?: RelationWidgetKindHint | 'all';
  /** Override the outer FormSection title (defaults from kind / catalog). */
  title?: string;
  /** Override the outer FormSection hint (defaults from kind / catalog). */
  hint?: string;
  className?: string;
  /** Optional filter of widget values. */
  widgets?: readonly RelationFormWidget[];
};

type RelationFormWidgetCardProps = {
  option: (typeof RELATION_FORM_WIDGET_OPTIONS)[number];
  size: HeroUiFieldSize;
  disabled: boolean;
};

const RelationFormWidgetCard: React.FC<RelationFormWidgetCardProps> = ({
  option,
  size,
  disabled,
}) => {
  const [titleExtra, setTitleExtra] = useState<React.ReactNode | null>(null);
  const Widget = RELATION_FORM_WIDGET_COMPONENTS[option.value];

  return (
    <div className="rounded-[6px] border border-slate-200 bg-white p-3">
      <div className="mb-2 flex min-w-0 flex-nowrap items-center gap-2">
        <span className="shrink-0 text-sm font-semibold text-slate-800">{option.label}</span>
        <span className={FORM_FIELD_HINT_SLOT_CLASS}>
          <FieldHintTooltip hint={option.description} label={option.label} />
        </span>
        <code className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
          {option.value}
        </code>
        {titleExtra ? (
          <div className="ms-auto flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
            {titleExtra}
          </div>
        ) : null}
      </div>
      <Widget size={size} disabled={disabled} setTitleExtra={setTitleExtra} />
    </div>
  );
};

/**
 * Renders relation FORM WIDGET demos from the internal catalog, filtered by relation kind.
 * Canonical visual reference for Data Studio Relation Properties (Sandbox → Relations).
 * Source of truth for labels/descriptions: RELATION_FORM_WIDGET_OPTIONS.
 * Source of truth for visuals: RELATION_FORM_WIDGET_COMPONENTS.
 * Selectable items in the modeler use `relationFormWidgetOptionsForKind` from the same catalog.
 */
export const RelationFormWidgetGallery: React.FC<RelationFormWidgetGalleryProps> = ({
  size = 'sm',
  disabled = false,
  kind = 'all',
  title,
  hint,
  className,
  widgets,
}) => {
  const singleKind = kind !== 'all';
  const sections = KIND_SECTIONS.filter((section) => (
    kind === 'all' || section.kind === kind || (kind === 'physical' && section.kind === 'belongsTo')
  ));
  const activeSection = sections[0];
  const resolvedTitle = title
    ?? (singleKind && activeSection ? activeSection.title : 'Relation form widgets');
  const resolvedHint = hint
    ?? (singleKind && activeSection
      ? activeSection.description
      : 'Live previews for Data Studio Relation Properties → Form Widget. Each relation kind has its own catalog.');

  const showHidden = !widgets || widgets.includes('hidden');
  const hiddenOption = RELATION_FORM_WIDGET_OPTIONS.find((item) => item.value === 'hidden');

  return (
    <FormSection
      title={resolvedTitle}
      tone="violet"
      className={className}
      hint={resolvedHint}
    >
      <div className="flex flex-col gap-3">
        {sections.map((section) => {
          const entries = relationFormWidgetOptionsForKind(section.kind).filter((option) => {
            if (option.value === 'hidden') {
              return false;
            }
            if (widgets && !widgets.includes(option.value)) {
              return false;
            }
            return true;
          });
          if (entries.length === 0) {
            return null;
          }
          return (
            <div key={section.kind} className="flex flex-col gap-3">
              {!singleKind ? (
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="m-0 text-sm font-semibold text-slate-800">{section.title}</h3>
                  <span className={FORM_FIELD_HINT_SLOT_CLASS}>
                    <FieldHintTooltip hint={section.description} label={section.title} />
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      KIND_TONE[section.kind],
                    )}
                  >
                    {section.kind}
                  </span>
                </div>
              ) : null}
              {entries.map((option) => (
                <RelationFormWidgetCard
                  key={`${section.kind}-${option.value}`}
                  option={option}
                  size={size}
                  disabled={disabled}
                />
              ))}
            </div>
          );
        })}
        {showHidden && hiddenOption ? (
          singleKind ? (
            <RelationFormWidgetCard
              key={`hidden-${kind}`}
              option={hiddenOption}
              size={size}
              disabled={disabled}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="m-0 text-sm font-semibold text-slate-800">Any kind</h3>
                <span className={FORM_FIELD_HINT_SLOT_CLASS}>
                  <FieldHintTooltip
                    hint="Available on every relation kind when the field must stay off the form."
                    label="Any kind"
                  />
                </span>
              </div>
              <RelationFormWidgetCard
                key="hidden-any"
                option={hiddenOption}
                size={size}
                disabled={disabled}
              />
            </div>
          )
        ) : null}
      </div>
    </FormSection>
  );
};
