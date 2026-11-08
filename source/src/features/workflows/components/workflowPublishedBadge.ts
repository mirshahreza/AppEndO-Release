export const workflowPublishedBadgeClass = (published: boolean): string =>
  published
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-slate-200 bg-slate-50 text-slate-700';

export const workflowPublishedLabel = (published: boolean): string =>
  published ? 'Published' : 'Unpublished';

export const workflowPublishedCardClass = (published: boolean): string =>
  published
    ? 'border-emerald-200/80 bg-emerald-50/35 hover:border-emerald-300/70 hover:bg-emerald-50/55 hover:shadow-emerald-500/15'
    : 'border-slate-200/90 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50 hover:shadow-slate-400/10';
