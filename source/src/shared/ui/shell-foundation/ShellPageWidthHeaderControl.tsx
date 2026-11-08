import * as React from 'react';
import { FoldHorizontal, UnfoldHorizontal } from 'lucide-react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { CULTURE_SHELL_FALLBACK_LABELS } from '../../../core/culture/cultureShellKeys';
import { HeaderHintTooltip } from '../SideHintTooltip';
import { pageGuideChromeProps } from '../shell/pageGuide/pageGuideChrome';
import { useOptionalShellLayoutWidth } from './ShellLayoutWidthContext';
import { ADMIN_SHELL_HEADER_ICON_BUTTON_CLASS } from '../surfaceClasses';

export type ShellPageWidthHeaderControlProps = {
  className?: string;
  /**
   * Built-in studio admin header (`AdminShellHeader` / `AppShellHeader`).
   * Keeps the control visible when layout metadata opts out in a published draft (RTL/LTR parity).
   */
  studioAdminChrome?: boolean;
};

export const ShellPageWidthHeaderControl: React.FC<ShellPageWidthHeaderControlProps> = ({
  className,
  studioAdminChrome = false,
}) => {
  const layout = useOptionalShellLayoutWidth();
  const culture = useOptionalCulture();
  const tShell = React.useCallback(
    (key: string) => (culture?.ready ? culture.t(key) : CULTURE_SHELL_FALLBACK_LABELS[key] ?? key),
    [culture?.ready, culture?.t],
  );

  const headerControlVisible = studioAdminChrome
    ? layout?.headerControlVisible !== false
    : Boolean(layout?.headerControlVisible);

  if (!headerControlVisible) {
    return null;
  }

  const expanded = layout?.isExpanded ?? false;
  const toggle = layout?.toggle ?? (() => undefined);
  const title = expanded ? tShell('shell.restorePageWidth') : tShell('shell.expandPageWidth');

  return (
    <HeaderHintTooltip
      title={title}
      hint={tShell('pageGuide.chrome.pageWidth.hint')}
      tone="cyan"
      className={className ?? 'inline-flex'}
    >
      <button
        type="button"
        data-testid="shell-page-width-header-control"
        data-designer-chrome-interactive="true"
        onClick={toggle}
        aria-label={title}
        aria-pressed={expanded}
        className={ADMIN_SHELL_HEADER_ICON_BUTTON_CLASS}
        {...pageGuideChromeProps(tShell, 'pageWidth', 21)}
      >
        {expanded ? (
          <FoldHorizontal className="h-[18px] w-[18px] rtl:-scale-x-100" aria-hidden />
        ) : (
          <UnfoldHorizontal className="h-[18px] w-[18px] rtl:-scale-x-100" aria-hidden />
        )}
      </button>
    </HeaderHintTooltip>
  );
};
