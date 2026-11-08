const ICON_OFFSET_PX = 6;

export type ShellDirection = 'ltr' | 'rtl';

export type TranslationIconAnchor = {
  top: number;
  left: number;
  /** Tailwind translate utilities — icon sits on the shell inline-start corner. */
  translateClassName: string;
};

const resolveShellDirection = (shellDirection?: ShellDirection): ShellDirection => {
  if (shellDirection) {
    return shellDirection;
  }
  const documentDir = document.documentElement.getAttribute('dir');
  return documentDir === 'rtl' ? 'rtl' : 'ltr';
};

/** Pin the icon on the label inline-start corner (matches shell reading direction). */
export function resolveTranslationIconAnchor(
  element: HTMLElement,
  shellDirection?: ShellDirection,
): TranslationIconAnchor {
  const rect = element.getBoundingClientRect();
  const direction = resolveShellDirection(shellDirection);
  const isRtl = direction === 'rtl';

  if (isRtl) {
    return {
      top: rect.top + ICON_OFFSET_PX,
      left: rect.right - ICON_OFFSET_PX,
      translateClassName: '-translate-x-full -translate-y-1/2',
    };
  }

  return {
    top: rect.top + ICON_OFFSET_PX,
    left: rect.left + ICON_OFFSET_PX,
    translateClassName: '-translate-y-1/2',
  };
}
