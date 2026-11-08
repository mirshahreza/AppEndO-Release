import { describe, expect, it } from 'vitest';
import { resolveAppButtonGroupClass } from '../AppButtonGroup';

describe('AppButtonGroup', () => {
  it('joins horizontal peers on the inline-start edge and vertical peers on the block-start edge', () => {
    expect(resolveAppButtonGroupClass('horizontal')).toContain('[&>button:not(:first-child)]:-ms-px');
    expect(resolveAppButtonGroupClass('horizontal')).toContain('[&>button:first-child]:rounded-s-md');
    expect(resolveAppButtonGroupClass('vertical')).toContain('flex-col');
    expect(resolveAppButtonGroupClass('vertical')).toContain('[&>button:not(:first-child)]:-mt-px');
  });
});
