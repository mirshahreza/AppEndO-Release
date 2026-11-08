const F5_DOM_KEY_CODE = 116;

type ReloadNavigateEvent = Event & {
  navigationType?: string;
  canIntercept?: boolean;
  intercept?: (options: { handler: () => Promise<void> }) => void;
};

export const isPlainF5KeyboardEvent = (event: KeyboardEvent): boolean => {
  const isF5 = event.key === 'F5' || event.code === 'F5' || event.keyCode === F5_DOM_KEY_CODE;
  return isF5 && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey;
};

export const isCtrlEnterKeyboardEvent = (event: KeyboardEvent): boolean => {
  if (event.key !== 'Enter' && event.code !== 'Enter') {
    return false;
  }
  return (event.ctrlKey || event.metaKey) && !event.altKey;
};

export const isSqlConsoleRunShortcutKeyboardEvent = (event: KeyboardEvent): boolean => (
  isPlainF5KeyboardEvent(event) || isCtrlEnterKeyboardEvent(event)
);

type SubscribeSqlConsoleRunShortcutOptions = {
  shouldHandle: () => boolean;
  onRun: () => void;
};

const interceptReloadNavigation = (
  event: Event,
  onRun: () => void,
): boolean => {
  const navigateEvent = event as ReloadNavigateEvent;
  if (navigateEvent.navigationType !== 'reload') {
    return false;
  }

  if (typeof navigateEvent.intercept === 'function' && navigateEvent.canIntercept !== false) {
    navigateEvent.intercept({
      handler: async () => {
        onRun();
      },
    });
    return true;
  }

  if (event.cancelable) {
    event.preventDefault();
    onRun();
    return true;
  }

  return false;
};

export function subscribeSqlConsoleRunShortcut({
  shouldHandle,
  onRun,
}: SubscribeSqlConsoleRunShortcutOptions): () => void {
  const cleanups: Array<() => void> = [];

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isSqlConsoleRunShortcutKeyboardEvent(event) || !shouldHandle()) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    onRun();
  };

  const handleNavigate = (event: Event) => {
    if (!shouldHandle()) {
      return;
    }

    interceptReloadNavigation(event, onRun);
  };

  window.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });
  cleanups.push(() => {
    window.removeEventListener('keydown', handleKeyDown, true);
  });

  if ('navigation' in window) {
    window.navigation.addEventListener('navigate', handleNavigate);
    cleanups.push(() => {
      window.navigation.removeEventListener('navigate', handleNavigate);
    });
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
