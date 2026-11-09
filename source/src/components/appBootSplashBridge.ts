import { isDefaultAppEndBrandLogoUrl } from '../config/appendoBrandAssets';
import { classifyLoadingLogoShape, loadingLogoStageClassName } from './appRouteLoadingLogoStage';
import { scheduleAppBootSplashDismiss } from './scheduleAppBootSplashDismiss';

const BOOT_SPLASH_ID = 'app-boot-splash';
const ALLOWED_LOGO_PREFIXES = [
  '/assets/workspace/portals/',
  '/assets/hawiety/',
  '/assets/appendo/brand/',
];

function isBootSplashVisible(): boolean {
  const splash = document.getElementById(BOOT_SPLASH_ID);
  return Boolean(splash && !splash.hasAttribute('hidden'));
}

function isSplashLogoLocked(): boolean {
  return document.documentElement.hasAttribute('data-boot-splash-logo-locked');
}

function lockSplashLogo(): void {
  document.documentElement.setAttribute('data-boot-splash-logo-locked', '1');
}

function isAllowedSplashLogo(pathOnly: string): boolean {
  if (!pathOnly || pathOnly.includes('..') || pathOnly.includes('<')) {
    return false;
  }
  return ALLOWED_LOGO_PREFIXES.some((prefix) => pathOnly.startsWith(prefix));
}

/** Keep the HTML first-paint loader in sync when React resolves a portal logo. */
export function syncAppBootSplashLogo(logoUrl: string | undefined): void {
  if (!isBootSplashVisible() || typeof document === 'undefined') {
    return;
  }
  if (isSplashLogoLocked()) {
    return;
  }

  const pathOnly = logoUrl?.trim().split('?')[0] ?? '';
  if (!pathOnly || !isAllowedSplashLogo(pathOnly) || isDefaultAppEndBrandLogoUrl(pathOnly)) {
    return;
  }

  const stage = document.querySelector<HTMLElement>(`#${BOOT_SPLASH_ID} .app-boot-logo-stage`);
  const logo = document.querySelector<HTMLElement>(`#${BOOT_SPLASH_ID} .app-boot-logo`);
  if (!stage || !logo) {
    return;
  }

  const nextShape = classifyLoadingLogoShape(pathOnly);
  const nextStageClass = loadingLogoStageClassName(nextShape, 'app-boot');

  if (logo instanceof HTMLImageElement) {
    if (logo.getAttribute('src') === pathOnly && stage.className === nextStageClass) {
      lockSplashLogo();
      return;
    }
    if (logo.getAttribute('src') !== pathOnly) {
      logo.src = pathOnly;
    }
    if (stage.className !== nextStageClass) {
      stage.className = nextStageClass;
    }
    logo.className = 'app-boot-logo app-boot-logo--custom';
    document.documentElement.setAttribute('data-portal-logo-ready', '1');
    lockSplashLogo();
    return;
  }

  stage.className = nextStageClass;
  const frame = logo.parentElement;
  const img = document.createElement('img');
  img.className = 'app-boot-logo app-boot-logo--custom';
  img.src = pathOnly;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  logo.replaceWith(img);
  if (frame && !frame.classList.contains('app-boot-logo-frame')) {
    frame.classList.add('app-boot-logo-frame');
  }
  document.documentElement.setAttribute('data-portal-logo-ready', '1');
  lockSplashLogo();
}

export function isAppBootSplashDelegated(): boolean {
  return isBootSplashVisible();
}

export function dismissAppBootSplashIfNoFullscreenLoading(): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (document.querySelector('[data-testid="app-route-loading"]')) {
    return;
  }
  if (document.querySelector('[data-shell-chrome-enter="true"]')) {
    return;
  }
  scheduleAppBootSplashDismiss();
}
