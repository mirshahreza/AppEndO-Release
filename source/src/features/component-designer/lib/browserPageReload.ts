export function isBrowserRefreshKeyboardEvent(event: KeyboardEvent): boolean {
  if (event.key === 'F5') {
    return true;
  }

  if (event.key.toLowerCase() !== 'r') {
    return false;
  }

  return event.ctrlKey || event.metaKey;
}

type PageReloadIntentOptions = {
  shouldHandle: () => boolean;
  onIntent: () => void;
};

export function subscribePageReloadIntent({
  shouldHandle,
  onIntent,
}: PageReloadIntentOptions): () => void {
  const cleanups: Array<() => void> = [];

  const handleIntent = () => {
    if (!shouldHandle()) {
      return;
    }

    onIntent();
  };

  if ('navigation' in window) {
    const handleNavigate = (event: Event) => {
      const navigateEvent = event as NavigateEvent;
      if (navigateEvent.navigationType !== 'reload') {
        return;
      }

      if (!shouldHandle()) {
        return;
      }

      event.preventDefault();
      handleIntent();
    };

    window.navigation.addEventListener('navigate', handleNavigate);
    cleanups.push(() => {
      window.navigation.removeEventListener('navigate', handleNavigate);
    });
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isBrowserRefreshKeyboardEvent(event)) {
      return;
    }

    if (!shouldHandle()) {
      return;
    }

    event.preventDefault();
    handleIntent();
  };

  window.addEventListener('keydown', handleKeyDown, { capture: true });
  cleanups.push(() => {
    window.removeEventListener('keydown', handleKeyDown, { capture: true });
  });

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
