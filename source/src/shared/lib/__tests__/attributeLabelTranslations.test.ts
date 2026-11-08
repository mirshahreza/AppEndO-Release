import { describe, expect, it } from 'vitest';
import {
  attributeLabelTranslationKey,
  resolveAttributeLabel,
} from '../attributeLabelTranslations';

describe('attributeLabelTranslations', () => {
  it('builds the culture-translations key', () => {
    expect(attributeLabelTranslationKey('Department')).toBe('settings.attributes.label.department');
  });

  it('prefers t() when a real translation exists', () => {
    const t = (key: string) => (key.endsWith('.department') ? 'واحد' : key);
    expect(resolveAttributeLabel({
      attributeKey: 'department',
      fallbackLabel: 'Department',
      t,
    })).toBe('واحد');
  });

  it('falls back to label then key when t returns the key', () => {
    const t = (key: string) => key;
    expect(resolveAttributeLabel({
      attributeKey: 'department',
      fallbackLabel: 'Department',
      t,
    })).toBe('Department');
    expect(resolveAttributeLabel({
      attributeKey: 'department',
      fallbackLabel: null,
      t,
    })).toBe('department');
  });
});
