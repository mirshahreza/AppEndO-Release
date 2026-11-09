import React from 'react';
import { cn } from '../../../lib/utils';
import { TYPE_CAPTION_CLASS, TYPE_SECTION_TITLE_CLASS } from '../typographyRoles';
import { CatalogSpecimenCodeBadge } from './CatalogSpecimenCodeBadge';

type CatalogSpecimenCardProps = {
  specimenCode: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  previewClassName?: string;
};

export const CatalogSpecimenCard: React.FC<CatalogSpecimenCardProps> = ({
  specimenCode,
  title,
  description,
  children,
  className,
  previewClassName,
}) => (
  <article
    className={cn(
      'flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm',
      className,
    )}
  >
    <header className="shrink-0 space-y-1 border-b border-slate-100 bg-slate-50/80 px-3 py-2.5">
      <h3 className={cn(TYPE_SECTION_TITLE_CLASS, 'text-sm font-semibold leading-snug text-slate-900')}>
        {title}
      </h3>
      {description ? (
        <p className={cn(TYPE_CAPTION_CLASS, 'text-[11px] leading-snug text-slate-600')}>{description}</p>
      ) : null}
    </header>

    <div className="min-h-0 flex-1 p-3">
      <div
        className={cn(
          'flex h-full min-h-[5.5rem] flex-col justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/40 p-4 text-start',
          previewClassName,
        )}
      >
        {children}
      </div>
    </div>

    <footer className="shrink-0 border-t border-slate-200 bg-slate-100/90 px-3 py-2">
      <CatalogSpecimenCodeBadge code={specimenCode} className="w-full max-w-none justify-between" />
    </footer>
  </article>
);
