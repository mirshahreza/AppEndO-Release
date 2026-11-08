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

export const isRunPanelShortcutKeyboardEvent = (event: KeyboardEvent): boolean => (
  isPlainF5KeyboardEvent(event) || isCtrlEnterKeyboardEvent(event)
);

type SubscribeSchemaObjectRunF5Options = {
  shouldHandle: () => boolean;
  onPlay: () => void;
};

const interceptReloadNavigation = (
  event: Event,
  onPlay: () => void,
): boolean => {
  const navigateEvent = event as ReloadNavigateEvent;
  if (navigateEvent.navigationType !== 'reload') {
    return false;
  }

  if (typeof navigateEvent.intercept === 'function' && navigateEvent.canIntercept !== false) {
    navigateEvent.intercept({
      handler: async () => {
        onPlay();
      },
    });
    return true;
  }

  if (event.cancelable) {
    event.preventDefault();
    onPlay();
    return true;
  }

  return false;
};

export function subscribeSchemaObjectRunF5({
  shouldHandle,
  onPlay,
}: SubscribeSchemaObjectRunF5Options): () => void {
  const cleanups: Array<() => void> = [];

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isRunPanelShortcutKeyboardEvent(event) || !shouldHandle()) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    onPlay();
  };

  const handleNavigate = (event: Event) => {
    if (!shouldHandle()) {
      return;
    }

    interceptReloadNavigation(event, onPlay);
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
