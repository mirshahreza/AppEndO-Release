import React from 'react';
import { cn } from '../../../lib/utils';
import {
  APP_SEARCH_BOX_BAR_CLASS,
  PAGE_HEADER_META_CLASS,
  PAGE_HEADER_META_INLINE_OFFSET_CLASS,
  PAGE_HEADER_META_SEPARATOR_CLASS,
  PAGE_HEADER_TITLE_CLASS,
  PAGE_HEADER_TITLE_ROW_CLASS,
} from '../../../shared/ui/surfaceClasses';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';

export const FILE_MANAGER_HEADER_BAR_OVERRIDES = 'border-slate-200 px-4';

export const FILE_MANAGER_PANEL_HEADER_CLASS = cn(
  APP_SEARCH_BOX_BAR_CLASS,
  'flex-wrap gap-y-1 sm:flex-nowrap',
  'justify-between gap-2',
  FILE_MANAGER_HEADER_BAR_OVERRIDES,
);

type FileManagerPreviewHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export const FileManagerPreviewHeader: React.FC<FileManagerPreviewHeaderProps> = ({
  title,
  subtitle,
  actions,
}) => (
  <div
    className={FILE_MANAGER_PANEL_HEADER_CLASS}
    {...pageGuideLocalProps(
      title,
      subtitle?.trim() || PAGE_GUIDE_EN['pageGuide.page.fileManager.preview.hint'],
      15,
    )}
  >
    <div className={cn(PAGE_HEADER_TITLE_ROW_CLASS, 'min-w-0 flex-1 sm:gap-2')}>
      <span className={cn(PAGE_HEADER_TITLE_CLASS, 'text-xs font-semibold text-slate-800')}>{title}</span>
      {subtitle ? (
        <>
          <span className={PAGE_HEADER_META_SEPARATOR_CLASS} aria-hidden>
            ·
          </span>
          <span
            className={cn(
              PAGE_HEADER_META_CLASS,
              'min-w-0 truncate',
              'leading-none',
              PAGE_HEADER_META_INLINE_OFFSET_CLASS,
            )}
          >
            {subtitle}
          </span>
        </>
      ) : null}
    </div>
    {actions ? (
      <div className="flex shrink-0 items-center gap-2">
        {actions}
      </div>
    ) : null}
  </div>
);
