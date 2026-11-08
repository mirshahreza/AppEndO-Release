import React from 'react';
import { Check, ListFilter, X } from 'lucide-react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../../core/culture/cultureShellKeys';
import { AppButton } from '../AppButton';
import { CreateEditModalShell } from '../CreateEditModalShell';
import { ICON_LABEL_ROW_CLASS } from '../surfaceClasses';
import { UiWhereBuilder } from '../where-builder/UiWhereBuilder';
import { WHERE_BUILDER_LIST_FILTER_CHROME } from '../where-builder/whereBuilderPresets';
import type { WhereField, WhereGroupNode, WhereOperator } from '../where-builder/whereBuilderModel';
import { formatListWhereSummary } from './listWhereFilter';

export type ListFilterDialogProps = {
  isOpen: boolean;
  title?: string;
  fields: readonly WhereField[];
  operators?: readonly WhereOperator[];
  value: WhereGroupNode;
  onChange: (next: WhereGroupNode) => void;
  onApply: () => void;
  onClose: () => void;
};

export const ListFilterDialog: React.FC<ListFilterDialogProps> = ({
  isOpen,
  title,
  fields,
  operators,
  value,
  onChange,
  onApply,
  onClose,
}) => {
  const culture = useOptionalCulture();
  const filterLabel = title ?? (culture?.ready
    ? culture.t('actions.filter')
    : CULTURE_ACTION_FALLBACK_LABELS['actions.filter'] ?? 'Filter');
  const cancelLabel = culture?.ready
    ? culture.t('actions.cancel')
    : CULTURE_ACTION_FALLBACK_LABELS['actions.cancel'];
  const applyLabel = culture?.ready
    ? culture.t('actions.apply')
    : CULTURE_ACTION_FALLBACK_LABELS['actions.apply'] ?? 'Apply';
  const summary = formatListWhereSummary(value, fields);
  const emptyHint = culture?.ready
    ? culture.t('whereBuilder.emptyApplyHint')
    : 'No conditions — apply to show every row.';
  const subtitle = summary || emptyHint;

  if (!isOpen) return null;

  return (
    <CreateEditModalShell
      size="3xl"
      title={(
        <span className={ICON_LABEL_ROW_CLASS}>
          <ListFilter className="h-3.5 w-3.5 text-indigo-600" aria-hidden />
          {filterLabel}
        </span>
      )}
      ariaLabel={filterLabel}
      onClose={onClose}
      subtitle={(
        <p className="min-w-0 font-mono text-[11px] leading-relaxed text-slate-600">
          {subtitle}
        </p>
      )}
      subtitleTone="elevated"
      shellClassName="flex min-h-[min(520px,72vh)] flex-col overflow-hidden"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !min-h-0"
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            {cancelLabel}
          </AppButton>
          <AppButton intent="primary" size="sm" onClick={onApply}>
            <Check className="h-3.5 w-3.5" />
            {applyLabel}
          </AppButton>
        </>
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <UiWhereBuilder
          value={value}
          onChange={onChange}
          fields={fields}
          operators={operators}
          ariaLabel={filterLabel}
          {...WHERE_BUILDER_LIST_FILTER_CHROME}
        />
      </div>
    </CreateEditModalShell>
  );
};
