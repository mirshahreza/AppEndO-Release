// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { INLINE_TRANSLATION_SCAN_ROOT_ATTR } from '../../../../shared/ui/shell/inlineTranslationScanRoot';
import { resolveInlineTranslationContentRoot } from '../resolveInlineTranslationContentRoot';

describe('resolveInlineTranslationContentRoot', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('prefers the front-most scan root over shell content', () => {
    container.innerHTML = `
      <div data-shell-content-root><p>Page label</p></div>
      <div ${INLINE_TRANSLATION_SCAN_ROOT_ATTR}="true" style="width:200px;height:100px">
        <p>Modal label</p>
      </div>
    `;

    const root = resolveInlineTranslationContentRoot();
    expect(root?.textContent).toContain('Modal label');
  });
});
