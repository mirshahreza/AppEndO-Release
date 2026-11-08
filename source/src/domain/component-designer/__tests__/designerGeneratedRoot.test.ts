import { describe, expect, it } from 'vitest';
import {
  DESIGNER_GENERATED_ROOT_CLASS,
  DESIGNER_GENERATED_ROOT_CLASS_LEGACY,
  DESIGNER_PREVIEW_DOCUMENT_CLASS,
  isDesignerGeneratedRootClass,
} from '../designerGeneratedRoot';

describe('designerGeneratedRoot', () => {
  it('recognizes current, legacy, and preview document wrappers', () => {
    expect(isDesignerGeneratedRootClass(DESIGNER_GENERATED_ROOT_CLASS)).toBe(true);
    expect(isDesignerGeneratedRootClass(DESIGNER_GENERATED_ROOT_CLASS_LEGACY)).toBe(true);
    expect(isDesignerGeneratedRootClass(DESIGNER_PREVIEW_DOCUMENT_CLASS)).toBe(true);
  });

  it('does not unwrap operator-authored space-y-3 boxes that carry extra chrome', () => {
    expect(isDesignerGeneratedRootClass('space-y-3 rounded-lg border p-4')).toBe(false);
    expect(isDesignerGeneratedRootClass('w-full h-full')).toBe(false);
    expect(isDesignerGeneratedRootClass('')).toBe(false);
  });
});
