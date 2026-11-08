// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import {
  isDesignerSelectAllHotkey,
  isLiveDesignerNativeSelectAllTarget,
} from '../liveDesignerSelectAllHotkey';

afterEach(() => {
  document.body.replaceChildren();
});

describe('liveDesignerSelectAllHotkey', () => {
  it('treats Ctrl/Cmd+A as the designer select-all hotkey', () => {
    expect(isDesignerSelectAllHotkey(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }))).toBe(true);
    expect(isDesignerSelectAllHotkey(new KeyboardEvent('keydown', { key: 'A', metaKey: true }))).toBe(true);
    expect(isDesignerSelectAllHotkey(new KeyboardEvent('keydown', { key: 'x', code: 'KeyA', ctrlKey: true }))).toBe(true);
    expect(isDesignerSelectAllHotkey(new KeyboardEvent('keydown', { key: 'a' }))).toBe(false);
  });

  it('keeps native select-all in Code and Properties fields only', () => {
    const code = document.createElement('div');
    code.setAttribute('data-testid', 'live-designer-code-panel');
    const monaco = document.createElement('textarea');
    code.appendChild(monaco);

    const properties = document.createElement('div');
    properties.setAttribute('data-testid', 'live-designer-properties-panel');
    const propInput = document.createElement('input');
    properties.appendChild(propInput);

    const toolbox = document.createElement('input');
    toolbox.placeholder = 'toolbox…';

    document.body.append(code, properties, toolbox);

    expect(isLiveDesignerNativeSelectAllTarget(monaco)).toBe(true);
    expect(isLiveDesignerNativeSelectAllTarget(propInput)).toBe(true);
    expect(isLiveDesignerNativeSelectAllTarget(toolbox)).toBe(false);
    expect(isLiveDesignerNativeSelectAllTarget(document.body)).toBe(false);
  });
});
