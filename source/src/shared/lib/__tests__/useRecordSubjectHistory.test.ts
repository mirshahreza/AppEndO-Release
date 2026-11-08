/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRecordSubjectHistory } from '../useRecordSubjectHistory';

describe('useRecordSubjectHistory', () => {
  it('keeps field History icons off until the header toggle', () => {
    const { result, rerender } = renderHook(
      (props: { subjectId: string }) => useRecordSubjectHistory({
        subjectKind: 'base_users',
        subjectId: props.subjectId,
      }),
      { initialProps: { subjectId: '12' } },
    );

    expect(result.current.fieldIconsVisible).toBe(false);

    act(() => {
      result.current.toggleFieldIcons();
    });
    expect(result.current.fieldIconsVisible).toBe(true);

    rerender({ subjectId: '13' });
    expect(result.current.fieldIconsVisible).toBe(false);
  });

  it('exposes a sole tracked field and skips field-icon chrome for one history target', () => {
    const { result } = renderHook(() => useRecordSubjectHistory({
      subjectKind: 'base_users',
      subjectId: '12',
      trackedFields: ['roles'],
    }));

    expect(result.current.soleTrackedField).toBe('roles');
    expect(result.current.fieldIconsVisible).toBe(false);

    act(() => {
      result.current.toggleFieldIcons();
    });
    expect(result.current.fieldIconsVisible).toBe(false);

    act(() => {
      result.current.openHistory();
    });
    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.dialogField).toBeNull();
  });
});
