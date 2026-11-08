/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInlineTranslationInteractionLock } from '../useInlineTranslationInteractionLock';

describe('useInlineTranslationInteractionLock', () => {
  it('marks the shell locked and blocks clicks outside the overlay layer', () => {
    const shell = document.createElement('div');
    shell.setAttribute('data-admin-shell-root', '');
    const button = document.createElement('button');
    shell.appendChild(button);
    document.body.appendChild(shell);

    const layer = document.createElement('div');
    layer.setAttribute('data-inline-translation-layer', '');
    const layerButton = document.createElement('button');
    layer.appendChild(layerButton);
    document.body.appendChild(layer);

    const blocked = vi.fn((event: Event) => event.preventDefault());
    button.addEventListener('click', blocked);

    const { unmount } = renderHook(() => useInlineTranslationInteractionLock(true));

    expect(shell.getAttribute('data-inline-translation-locked')).toBe('true');

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(blocked).not.toHaveBeenCalled();

    layerButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    unmount();
    document.body.removeChild(shell);
    document.body.removeChild(layer);
  });
});
