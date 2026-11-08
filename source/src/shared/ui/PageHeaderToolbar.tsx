import React from 'react';
import { cn } from '../../lib/utils';
import { pageGuideProps } from './shell/pageGuide/pageGuide.attrs';
import {
  PAGE_HEADER_ICON_SLOT_CLASS,
  PAGE_HEADER_ICON_TITLE_CLUSTER_CLASS,
  PAGE_HEADER_META_CLASS,
  PAGE_HEADER_META_INLINE_OFFSET_CLASS,
  PAGE_HEADER_META_SEPARATOR_CLASS,
  PAGE_HEADER_TITLE_CLASS,
  PAGE_HEADER_TITLE_ROW_CLASS,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
} from './surfaceClasses';

export type PageHeaderToolbarProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  titleClassName?: string;
  description?: string;
  descriptionClassName?: string;
  /** Optional inline metadata rendered after the description (e.g. status badges). */
  meta?: React.ReactNode;
  /** Optional override for the icon + title + metadata row container. */
  titleRowClassName?: string;
  actions?: React.ReactNode;
  /** Heading level for the page title. Default 2. */
  headingLevel?: 1 | 2;
  className?: string;
};

export const PageHeaderToolbar: React.FC<PageHeaderToolbarProps> = ({
  icon,
  title,
  titleClassName,
  description,
  descriptionClassName,
  meta,
  titleRowClassName,
  actions,
  headingLevel = 2,
  className,
}) => {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';

  const titleText = typeof title === 'string' ? title : '';
  const descriptionText = description?.trim() ?? '';

  return (
    <div
      className={cn(`${PAGE_TOOLBAR_SINGLE_ROW_CLASS} justify-between`, className)}
      {...(titleText && descriptionText
        ? pageGuideProps({ title: titleText, hint: descriptionText, priority: 25, surface: true })
        : {})}
    >
      <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
        <div className={cn(PAGE_HEADER_TITLE_ROW_CLASS, titleRowClassName)}>
          <div className={PAGE_HEADER_ICON_TITLE_CLUSTER_CLASS}>
            {icon ? (
              <span className={PAGE_HEADER_ICON_SLOT_CLASS} aria-hidden>
                {icon}
              </span>
            ) : null}
            <Heading className={cn(PAGE_HEADER_TITLE_CLASS, titleClassName, 'leading-none')}>{title}</Heading>
          </div>
          {description ? (
            <>
              <span className={PAGE_HEADER_META_SEPARATOR_CLASS} aria-hidden>
                ·
              </span>
              <p
                className={cn(
                  PAGE_HEADER_META_CLASS,
                  descriptionClassName,
                  'leading-none',
                  PAGE_HEADER_META_INLINE_OFFSET_CLASS,
                )}
                title={description}
              >
                {description}
              </p>
            </>
          ) : null}
          {meta ? (
            <>
              <span className={PAGE_HEADER_META_SEPARATOR_CLASS} aria-hidden>
                ·
              </span>
              <span className={cn(PAGE_HEADER_META_CLASS, 'inline-flex items-center leading-none')}>
                {meta}
              </span>
            </>
          ) : null}
        </div>
      </div>

      {actions ? (
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          {actions}
        </div>
      ) : null}
    </div>
  );
};
