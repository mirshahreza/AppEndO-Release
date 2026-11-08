const BOOT_SPLASH_EXIT_MS = 420;

function usesShellFormattedReveal(): boolean {
  return Boolean(document.querySelector('[data-shell-chrome-enter="true"]'));
}

/**
 * Hide the HTML first-paint splash.
 * Prefer calling when the first real surface is ready (ShellChromeEnter) so the
 * user keeps one continuous boot look — not a late style handoff.
 */
export const dismissAppBootSplash = (): void => {
  const splash = document.getElementById('app-boot-splash');
  if (!splash || splash.hasAttribute('hidden')) {
    return;
  }

  if (splash.classList.contains('app-boot-splash--exit')) {
    return;
  }

  const shellReveal = usesShellFormattedReveal();
  if (!shellReveal) {
    document.documentElement.setAttribute('data-app-boot-phase', 'reveal');
  }

  splash.classList.add('app-boot-splash--exit');
  splash.setAttribute('aria-busy', 'false');

  window.setTimeout(() => {
    if (!splash.isConnected) {
      document.documentElement.removeAttribute('data-app-boot-phase');
      return;
    }
    splash.setAttribute('hidden', '');
    splash.classList.remove('app-boot-splash--exit');
    document.documentElement.removeAttribute('data-loading-identity');
    if (!shellReveal) {
      document.documentElement.setAttribute('data-app-boot-phase', 'done');
      window.requestAnimationFrame(() => {
        document.documentElement.removeAttribute('data-app-boot-phase');
      });
    }
  }, BOOT_SPLASH_EXIT_MS);
};
