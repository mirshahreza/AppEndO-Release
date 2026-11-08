import { describe, expect, it } from 'vitest';
import {
  buildDesignerImaskOptions,
  normalizeDesignerMaskInputKind,
  resolveDesignerMaskInputPreview,
  shouldDesignerMaskInputUnmask,
} from '../designerMaskInputConfig';

describe('designerMaskInputConfig', () => {
  it('builds preset pattern masks for Iran mobile numbers', () => {
    const options = buildDesignerImaskOptions({
      maskKind: 'pattern',
      maskPreset: 'phone-ir-mobile',
    });

    expect(options).toMatchObject({
      mask: '00000000000',
      lazy: true,
    });
  });

  it('builds number masks with scale and bounds', () => {
    const options = buildDesignerImaskOptions({
      maskKind: 'number',
      maskNumberScale: '2',
      maskNumberMin: '0',
      maskNumberMax: '100',
    });

    expect(options).toMatchObject({
      mask: Number,
      scale: 2,
      min: 0,
      max: 100,
    });
  });

  it('builds custom json mask options with regexp revival', () => {
    const options = buildDesignerImaskOptions({
      maskKind: 'custom',
      maskOptionsJson: '{"mask":"/^\\\\d+$/" }',
    });

    expect((options as { mask: RegExp }).mask.test('123')).toBe(true);
  });

  it('builds dynamic mask blocks from json array', () => {
    const options = buildDesignerImaskOptions({
      maskKind: 'dynamic',
      maskBlocks: '[{"mask":"000-0000"},{"mask":"(000) 000-0000"}]',
    });

    expect(Array.isArray((options as { mask: unknown[] }).mask)).toBe(true);
    expect((options as { mask: Array<{ mask: string }> }).mask).toHaveLength(2);
  });

  it('resolves dynamic preview from block patterns', () => {
    const preview = resolveDesignerMaskInputPreview({
      maskKind: 'dynamic',
      maskBlocks: '[{"mask":"000-0000"},{"mask":"(000) 000-0000"}]',
      maskPlaceholderChar: '_',
    });

    expect(preview.template).toContain('___-____');
    expect(preview.example).toBe('000-0000');
  });

  it('parses regexp mask sources', () => {
    const options = buildDesignerImaskOptions({
      maskKind: 'regexp',
      maskRegExp: '/^[A-Za-z0-9_-]*$/',
    });

    expect((options as { mask: RegExp }).mask.test('abc_123')).toBe(true);
  });

  it('merges preset and custom pattern definitions', () => {
    const options = buildDesignerImaskOptions({
      maskKind: 'pattern',
      maskPreset: 'hex-color',
      maskDefinitions: '{"X":"[0-9]"}',
    }) as { definitions?: Record<string, RegExp> };

    expect(options.definitions?.H).toBeDefined();
    expect(options.definitions?.X).toBeDefined();
  });

  it('resolves preview template and example for presets and custom patterns', () => {
    const mobilePreview = resolveDesignerMaskInputPreview({
      maskKind: 'pattern',
      maskPreset: 'phone-ir-mobile',
      maskPlaceholderChar: '_',
    });
    expect(mobilePreview.template).toBe('___________');
    expect(mobilePreview.example).toBe('09123456789');

    const customPreview = resolveDesignerMaskInputPreview({
      maskKind: 'pattern',
      maskPreset: 'custom',
      maskPattern: '0000-0000',
      maskPlaceholderChar: '_',
    });
    expect(customPreview.template).toBe('____-____');
    expect(customPreview.example).toBe('0000-0000');
  });

  it('normalizes mask kind and unmask flag', () => {
    expect(normalizeDesignerMaskInputKind('number')).toBe('number');
    expect(normalizeDesignerMaskInputKind('unknown')).toBe('pattern');
    expect(shouldDesignerMaskInputUnmask({ unmask: true })).toBe(true);
  });
});
