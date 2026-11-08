import type { DesignerDocument } from '../../domain/component-designer/types';
import { SHELL_CHROME_HEADER } from './shellChromeSlots';

export const SHELL_HEADER_SHOW_LOGO_PROP = 'showLogo' as const;
export const SHELL_HEADER_SHOW_BREADCRUMB_PROP = 'showBreadcrumb' as const;
export const SHELL_HEADER_SHOW_ACTIONS_PROP = 'showActions' as const;

export type ShellHeaderConfig = {
  showLogo?: boolean;
  showBreadcrumb?: boolean;
  showActions?: boolean;
};

export const resolveShellHeaderConfigFromProps = (
  props?: Record<string, unknown> | null,
): ShellHeaderConfig | null => {
  if (!props) {
    return null;
  }

  return {
    showLogo: props[SHELL_HEADER_SHOW_LOGO_PROP] !== false,
    showBreadcrumb: props[SHELL_HEADER_SHOW_BREADCRUMB_PROP] !== false,
    showActions: props[SHELL_HEADER_SHOW_ACTIONS_PROP] !== false,
  };
};

/** Reads header settings from the first `core.shell.header` system-slot in the document. */
export function extractShellHeaderConfigFromDocument(
  document: DesignerDocument,
): ShellHeaderConfig | null {
  for (const node of Object.values(document.nodes)) {
    if (node.type !== 'system-slot') {
      continue;
    }

    const slotId = typeof node.props.slotId === 'string' ? node.props.slotId.trim() : '';
    if (slotId !== SHELL_CHROME_HEADER) {
      continue;
    }

    return resolveShellHeaderConfigFromProps(node.props);
  }

  return null;
}
