import {
  ADMIN_SHELL_CONTENT_HOST_CLASS,
  ADMIN_SHELL_HEADER_CLASS,
} from './surfaceClasses';

const CONTENT_HOST_MARKERS = ['border-shell-content-border', 'shadow-content-host'] as const;
const HEADER_MARKERS = ['admin-shell-chrome', 'z-30', 'h-[calc(52px'] as const;

const stripLegacyContentHostRounding = (className: string): string => (
  className
    .replace(/\bltr:lg:!?rounded-tl-\[[^\]]+\]/g, '')
    .replace(/\brtl:lg:!?rounded-tr-\[[^\]]+\]/g, '')
    .replace(/\bltr:lg:rounded-tl-\[[^\]]+\]/g, '')
    .replace(/\brtl:lg:rounded-tr-\[[^\]]+\]/g, '')
    .replace(/\b!shadow-content-host\b/g, 'shadow-content-host')
    .replace(/\s+/g, ' ')
    .trim()
);

export const isPublishedAdminShellContentHostClassName = (className: string): boolean => (
  CONTENT_HOST_MARKERS.every((marker) => className.includes(marker))
);

export const isPublishedAdminShellHeaderClassName = (className: string): boolean => (
  HEADER_MARKERS.every((marker) => className.includes(marker))
);

/** Upgrade frozen designer shell class strings to current admin-shell RTL/LTR contracts. */
export const normalizePublishedAdminShellClassName = (className: string): string => {
  let next = className;

  if (isPublishedAdminShellContentHostClassName(next)) {
    next = stripLegacyContentHostRounding(next);
    if (!next.includes('rounded-ss-')) {
      next = `${next} ${ADMIN_SHELL_CONTENT_HOST_CLASS.split(' ').filter((token) => token.startsWith('lg:rounded-')).join(' ')}`;
    }
    if (!next.includes('data-admin-shell-content-host')) {
      // marker for CSS — applied via data attribute in dom spread when normalized
    }
  }

  if (isPublishedAdminShellHeaderClassName(next)) {
    if (!next.includes('admin-shell-header-band')) {
      next = `${next} admin-shell-header-band`;
    }
    const headerTokens = ADMIN_SHELL_HEADER_CLASS.split(' ');
    for (const token of ['lg:h-[59px]', 'lg:min-h-[59px]']) {
      if (!next.includes(token)) {
        next = `${next} ${token}`;
      }
    }
    if (!next.includes('lg:!h-[59px]')) {
      next = `${next} lg:!h-[59px]`;
    }
  }

  return next.replace(/\s+/g, ' ').trim();
};

export const adminShellChromeDataAttributesForClassName = (
  className: string,
): Record<string, string> => {
  const attrs: Record<string, string> = {};
  if (isPublishedAdminShellContentHostClassName(className)) {
    attrs['data-admin-shell-content-host'] = 'true';
  }
  if (isPublishedAdminShellHeaderClassName(className) || className.includes('admin-shell-header-band')) {
    attrs['data-admin-shell-header'] = 'true';
  }
  return attrs;
};
