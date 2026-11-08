import React from 'react';
import { ListFilter, X } from 'lucide-react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../../core/culture/cultureShellKeys';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { AppButton } from '../AppButton';
import { pageGuideLocalProps } from '../shell/pageGuide/pageGuideChrome';
import {
  LIST_FILTER_SUMMARY_BAND_CLASS,
  LIST_FILTER_SUMMARY_TEXT_CLASS,
  PAGE_HEADER_ICON_SLOT_CLASS,
} from '../surfaceClasses';

export type ListFilterSummaryBandProps = {
  summary: string;
  onEdit: () => void;
  onClear: () => void;
};

export const ListFilterSummaryBand: React.FC<ListFilterSummaryBandProps> = ({
  summary,
  onEdit,
  onClear,
}) => {
  const culture = useOptionalCulture();
  const clearLabel = culture?.ready
    ? culture.t('actions.clearFilter')
    : CULTURE_ACTION_FALLBACK_LABELS['actions.clearFilter'] ?? 'Clear filter';
  const editLabel = culture?.ready
    ? culture.t('actions.filter')
    : CULTURE_ACTION_FALLBACK_LABELS['actions.filter'] ?? 'Filter';

  if (!summary.trim()) return null;

  return (
    <div
      className={LIST_FILTER_SUMMARY_BAND_CLASS}
      role="status"
      {...pageGuideLocalProps(
        PAGE_GUIDE_EN['pageGuide.chrome.filterSummary.title'] ?? 'Active filter',
        PAGE_GUIDE_EN['pageGuide.chrome.filterSummary.hint']
          ?? 'This is the filter in force. Open Filter to edit it, or clear it to show every row.',
        23,
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-2 text-start sm:items-center"
        onClick={onEdit}
        aria-label={`${editLabel}: ${summary}`}
      >
        <span className={`${PAGE_HEADER_ICON_SLOT_CLASS} mt-0.5 text-indigo-600 sm:mt-0`} aria-hidden>
          <ListFilter className="h-4 w-4" />
        </span>
        <span className={LIST_FILTER_SUMMARY_TEXT_CLASS} dir="ltr">
          {summary}
        </span>
      </button>
      <AppButton
        intent="cancel"
        size="icon-sm"
        tabStop="skip"
        aria-label={clearLabel}
        title={clearLabel}
        onClick={onClear}
      >
        <X className="h-3.5 w-3.5" />
      </AppButton>
    </div>
  );
};
