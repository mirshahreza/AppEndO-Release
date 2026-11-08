import { describe, expect, it } from 'vitest';
import {
  fromJsxAttributeName,
  isDesignerInternalPropKey,
  isDesignerSystemMetadataPropKey,
  isGlobalWebAttributeKey,
  shouldPassthroughRuntimePropKey,
  shouldSkipTsxPropKey,
  toJsxAttributeName,
} from '../propRegistry';

describe('propRegistry', () => {
  it('separates system metadata from passthrough web attributes', () => {
    expect(isDesignerSystemMetadataPropKey('_designerPaletteItemId')).toBe(true);
    expect(isDesignerSystemMetadataPropKey('_jsxSourceTag')).toBe(true);
    expect(isDesignerSystemMetadataPropKey('title')).toBe(false);
    expect(isDesignerSystemMetadataPropKey('ariaLabel')).toBe(false);
    expect(isDesignerInternalPropKey('twPadding')).toBe(true);
    expect(isDesignerInternalPropKey('hint')).toBe(true);
    expect(isDesignerInternalPropKey('className')).toBe(false);
  });

  it('never drops global web attributes through TSX skip filters', () => {
    for (const key of [
      'title', 'id', 'dir', 'ariaLabel', 'className', 'role',
      'description', 'startContent', 'endContent', 'isClearable', 'closeOnSelect',
      'allowCustomValue', 'backdrop', 'scrollBehavior', 'isKeyboardDismissDisabled',
      'isStriped', 'isHeaderSticky', 'emptyContent', 'inputMode', 'autoFocus',
    ]) {
      expect(shouldSkipTsxPropKey(key), key).toBe(false);
      expect(isGlobalWebAttributeKey(key), key).toBe(true);
    }

    expect(shouldSkipTsxPropKey('minViewport')).toBe(true);
    expect(shouldSkipTsxPropKey('belowMin')).toBe(true);
    expect(isDesignerInternalPropKey('minViewport')).toBe(true);
  });

  it('maps aria and data attributes bidirectionally', () => {
    expect(toJsxAttributeName('ariaLabel')).toBe('aria-label');
    expect(toJsxAttributeName('dataTestId')).toBe('data-testid');
    // Bug found (parity audit item 47, re-verified): `closeOnSelect` is no longer renamed to
    // `shouldCloseOnSelect` — that isn't a real prop on Select/Autocomplete (only Menu/DatePicker
    // support it, per the installed react-aria-components type defs), so the rename was just as
    // inert as the original name. The field was removed from Inspector entirely; the generic
    // name-override mapping for it was removed too (no rename left to assert).
    expect(toJsxAttributeName('closeOnSelect')).toBe('closeOnSelect');
    // Bug found (parity audit item 54): slider min/max are palette-scoped (number-input keeps min/max).
    expect(toJsxAttributeName('min', 'heroui.slider')).toBe('minValue');
    expect(toJsxAttributeName('max', 'heroui.slider')).toBe('maxValue');
    expect(toJsxAttributeName('min', 'heroui.number-input')).toBe('min');
    expect(fromJsxAttributeName('aria-label')).toBe('ariaLabel');
    expect(fromJsxAttributeName('aria-describedby')).toBe('ariaDescribedby');
    expect(fromJsxAttributeName('data-testid')).toBe('dataTestId');
    expect(fromJsxAttributeName('data-split-direction')).toBe('direction');
    expect(fromJsxAttributeName('data-default-split')).toBe('defaultSplit');
  });

  it('allows runtime passthrough for standard props but blocks metadata', () => {
    expect(shouldPassthroughRuntimePropKey('isDisabled')).toBe(true);
    expect(shouldPassthroughRuntimePropKey('title')).toBe(true);
    expect(shouldPassthroughRuntimePropKey('_jsxSourceTag')).toBe(false);
    expect(shouldPassthroughRuntimePropKey('twGap')).toBe(false);
    expect(shouldPassthroughRuntimePropKey('className')).toBe(false);
  });
});
