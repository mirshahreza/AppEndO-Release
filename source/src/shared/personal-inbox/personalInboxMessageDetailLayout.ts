/** Full internal width inside admin shell — detail surfaces only (not the inbox list grid). */
/** Horizontal padding shared by detail toolbar + body (aligned scan path). */
export const PERSONAL_INBOX_MESSAGE_DETAIL_HORIZONTAL_PAD_CLASS =
  'px-5 sm:px-8 lg:px-10 xl:px-12';

export const PERSONAL_INBOX_MESSAGE_DETAIL_PAGE_CLASS =
  `flex min-h-0 w-full min-w-0 flex-1 flex-col gap-5 py-5 ${PERSONAL_INBOX_MESSAGE_DETAIL_HORIZONTAL_PAD_CLASS}`;

export const PERSONAL_INBOX_MESSAGE_DETAIL_TOOLBAR_CLASS =
  `page-toolbar sticky top-0 z-10 shrink-0 select-none border-b border-slate-200 bg-white flex min-h-14 flex-col justify-between gap-2.5 py-2.5 lg:flex-row lg:items-center lg:gap-3 lg:py-0 ${PERSONAL_INBOX_MESSAGE_DETAIL_HORIZONTAL_PAD_CLASS}`;

export const PERSONAL_INBOX_MESSAGE_DETAIL_THREAD_CLASS =
  'min-h-0 w-full min-w-0 flex-1 overflow-y-auto';

export const PERSONAL_INBOX_MESSAGE_DETAIL_ACTIONS_CLASS =
  'flex flex-wrap gap-2 pb-1';
