// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAiFieldEditHistory } from '../useAiFieldEditHistory';

describe('useAiFieldEditHistory', () => {
  it('pushes before value on apply and supports undo/redo', () => {
    const { result } = renderHook(() => useAiFieldEditHistory());

    act(() => {
      result.current.pushAppliedEdit('hello', 'hello world');
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    let undone: string | null = null;
    act(() => {
      undone = result.current.undo('hello world');
    });

    expect(undone).toBe('hello');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    let redone: string | null = null;
    act(() => {
      redone = result.current.redo('hello');
    });

    expect(redone).toBe('hello world');
  });

  it('ignores identical before/after values', () => {
    const { result } = renderHook(() => useAiFieldEditHistory());

    act(() => {
      result.current.pushAppliedEdit('same', 'same');
    });

    expect(result.current.canUndo).toBe(false);
  });
});
