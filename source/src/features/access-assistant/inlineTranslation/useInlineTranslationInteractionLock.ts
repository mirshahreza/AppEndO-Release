import { useEffect } from 'react';
import {
  INLINE_TRANSLATION_EDIT_DIALOG_BACKDROP_CLASS,
  STUDIO_TOOLS_MENU_SELECTOR,
} from './inlineTranslationDomMarkers';

const SHELL_ROOT_SELECTOR = '[data-admin-shell-root]';
const LAYER_SELECTOR = '[data-inline-translation-layer]';
const EDIT_DIALOG_SELECTOR = `.${INLINE_TRANSLATION_EDIT_DIALOG_BACKDROP_CLASS}`;

const BLOCKED_POINTER_EVENTS = [
  'click',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'dblclick',
  'auxclick',
  'contextmenu',
] as const;

const isAllowedInteractionTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(
    target.closest(LAYER_SELECTOR)
    || target.closest(EDIT_DIALOG_SELECTOR)
    || target.closest(STUDIO_TOOLS_MENU_SELECTOR),
  );
};

/**
 * Blocks page interaction while inline translation mode is active.
 * Wheel / trackpad scroll still works so operators can reach more labels.
 */
export function useInlineTranslationInteractionLock(active: boolean): void {
  useEffect(() => {
    const shell = document.querySelector(SHELL_ROOT_SELECTOR);

    if (!active) {
      if (shell instanceof HTMLElement) {
        shell.removeAttribute('data-inline-translation-locked');
      }
      return undefined;
    }

    if (shell instanceof HTMLElement) {
      shell.setAttribute('data-inline-translation-locked', 'true');
    }

    const blockPointerInteraction = (event: Event) => {
      if (isAllowedInteractionTarget(event.target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isAllowedInteractionTarget(event.target)) {
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
      }
    };

    for (const type of BLOCKED_POINTER_EVENTS) {
      document.addEventListener(type, blockPointerInteraction, true);
    }
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      for (const type of BLOCKED_POINTER_EVENTS) {
        document.removeEventListener(type, blockPointerInteraction, true);
      }
      document.removeEventListener('keydown', onKeyDown, true);
      if (shell instanceof HTMLElement) {
        shell.removeAttribute('data-inline-translation-locked');
      }
    };
  }, [active]);
}
