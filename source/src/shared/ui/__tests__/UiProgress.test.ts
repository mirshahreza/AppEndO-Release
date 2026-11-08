import { describe, expect, it } from 'vitest';
import {
  UI_PROGRESS_FILL_TONE_CLASS,
  UI_PROGRESS_TRACK_SIZE_CLASS,
  UI_PROGRESS_TRACK_TONE_CLASS,
} from '../UiProgress';

describe('UiProgress tokens', () => {
  it('keeps size tracks thicker than a scrollbar', () => {
    expect(UI_PROGRESS_TRACK_SIZE_CLASS.sm).toContain('h-2');
    expect(UI_PROGRESS_TRACK_SIZE_CLASS.md).toContain('h-2.5');
    expect(UI_PROGRESS_TRACK_SIZE_CLASS.lg).toContain('h-3.5');
  });

  it('uses meaning-first fill colors instead of grey-on-grey', () => {
    expect(UI_PROGRESS_TRACK_TONE_CLASS.accent).toContain('bg-primary/20');
    expect(UI_PROGRESS_FILL_TONE_CLASS.accent).toBe('bg-primary');
    expect(UI_PROGRESS_FILL_TONE_CLASS.success).toContain('emerald');
    expect(UI_PROGRESS_FILL_TONE_CLASS.warning).toContain('amber');
  });
});
