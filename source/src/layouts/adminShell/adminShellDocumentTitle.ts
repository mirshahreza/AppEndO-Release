import { formatPortalBrowserDocumentTitle } from '../../domain/hwy/selfRegistration/hwyPublicPortalDocumentTitle';
import {
  formatShellBootDocumentTitle,
  SHELL_BOOT_DOCUMENT_TITLE_SUFFIX,
} from '../../shared/lib/shellBrowserDocumentTitle';
import type { ResolvedShellHeaderModule } from './mergeShellHeaderModule';
import { resolveShellHeaderCompactTitle } from './ShellHeaderTitle';

export const ADMIN_SHELL_BOOT_DOCUMENT_TITLE_SUFFIX = SHELL_BOOT_DOCUMENT_TITLE_SUFFIX;

export type AdminShellDocumentTitleModule = Pick<
  ResolvedShellHeaderModule,
  'label' | 'groupLabel' | 'titleTrail'
>;

/** Boot / loading tab before the active page label is known. */
export const formatAdminShellBootDocumentTitle = formatShellBootDocumentTitle;

export type FormatAdminShellBrowserDocumentTitleInput = {
  module: AdminShellDocumentTitleModule;
  fallbackLabel: string;
  portalWindowTitle?: string | null;
  pageTitleReady?: boolean;
};

/** Browser tab: `{portal window title} / {current page label}`. */
export function formatAdminShellBrowserDocumentTitle(input: FormatAdminShellBrowserDocumentTitleInput): string;
export function formatAdminShellBrowserDocumentTitle(
  module: AdminShellDocumentTitleModule,
  fallbackLabel: string,
  portalWindowTitle?: string | null,
): string;
export function formatAdminShellBrowserDocumentTitle(
  moduleOrInput: AdminShellDocumentTitleModule | FormatAdminShellBrowserDocumentTitleInput,
  fallbackLabel?: string,
  portalWindowTitle?: string | null,
): string {
  const input: FormatAdminShellBrowserDocumentTitleInput = typeof fallbackLabel === 'string'
    ? {
      module: moduleOrInput as AdminShellDocumentTitleModule,
      fallbackLabel,
      portalWindowTitle,
      pageTitleReady: true,
    }
    : moduleOrInput as FormatAdminShellBrowserDocumentTitleInput;

  const { module, fallbackLabel: fallback, pageTitleReady = true } = input;
  const windowTitle = input.portalWindowTitle?.trim();

  if (!pageTitleReady) {
    return formatAdminShellBootDocumentTitle(windowTitle);
  }

  const routeLeaf = resolveShellHeaderCompactTitle({
    groupLabel: module.groupLabel,
    pageLabel: module.label,
    titleTrail: module.titleTrail,
    fallbackLabel: fallback,
  });

  if (windowTitle) {
    return formatPortalBrowserDocumentTitle(windowTitle, routeLeaf);
  }
  return routeLeaf;
}

export function isAdminShellPageTitleReady(
  module: AdminShellDocumentTitleModule,
  fallbackLabel: string,
  pageKey?: string | null,
): boolean {
  if (module.titleTrail?.length) {
    return true;
  }
  const label = module.label?.trim();
  if (!label || label === fallbackLabel.trim()) {
    return false;
  }
  return Boolean(pageKey?.trim());
}
