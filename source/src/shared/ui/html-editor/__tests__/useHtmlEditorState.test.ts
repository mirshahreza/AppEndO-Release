/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useHtmlEditorState } from '../useHtmlEditorState';

describe('useHtmlEditorState', () => {
  it('keeps raw source while exposing sanitized safeHtml', () => {
    const { result } = renderHook(() => useHtmlEditorState({
      defaultValue: '<p>Hi</p><script>alert(1)</script>',
      defaultMode: 'source',
    }));

    expect(result.current.html).toContain('<script>');
    expect(result.current.safeHtml).not.toContain('<script>');
    expect(result.current.safeHtml).toContain('<p>Hi</p>');
  });

  it('notifies mode changes', () => {
    const onModeChange = vi.fn();
    const { result } = renderHook(() => useHtmlEditorState({
      defaultMode: 'visual',
      onModeChange,
    }));

    act(() => {
      result.current.setMode('split');
    });

    expect(result.current.mode).toBe('split');
    expect(onModeChange).toHaveBeenCalledWith('split');
  });
});
