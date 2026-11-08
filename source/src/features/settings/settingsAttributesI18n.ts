import type { TranslationFn } from '../../core/culture/TranslationRuntime';

function attrKey(suffix: string): string {
  return `settings.attributes.${suffix}`;
}

export function attributeText(suffix: string, t: TranslationFn): string {
  return t(attrKey(suffix));
}

export function attributeFormText(suffix: string, t: TranslationFn): string {
  return t(attrKey(`form.${suffix}`));
}

export function getAttributeDataTypeOptions(t: TranslationFn) {
  return [
    { value: 'string' as const, label: attributeFormText('dataType.string', t) },
    { value: 'number' as const, label: attributeFormText('dataType.number', t) },
    { value: 'boolean' as const, label: attributeFormText('dataType.boolean', t) },
    { value: 'json' as const, label: attributeFormText('dataType.json', t) },
  ];
}

export function getAttributeVisibilityOptions(t: TranslationFn) {
  return [
    { value: 'SERVER' as const, label: attributeFormText('visibility.server', t) },
    { value: 'CLIENT' as const, label: attributeFormText('visibility.client', t) },
    { value: 'BOTH' as const, label: attributeFormText('visibility.both', t) },
  ];
}
