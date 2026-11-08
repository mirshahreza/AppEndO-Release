import type { DesignerDocument, DesignerNode } from './types';

export const TEXT_CONTENT_MODE_LITERAL = 'literal' as const;
export const TEXT_CONTENT_MODE_TRANSLATION = 'translation' as const;

export type DesignerTextContentMode =
  | typeof TEXT_CONTENT_MODE_LITERAL
  | typeof TEXT_CONTENT_MODE_TRANSLATION;

export const TEXT_CONTENT_MODE_PROP = 'textContentMode';
export const TRANSLATION_KEY_PROP = 'translationKey';

const TRANSLATABLE_NODE_TYPES = new Set<DesignerNode['type']>(['text', 'heading']);

export const isTranslatableTextNode = (node: DesignerNode): boolean =>
  TRANSLATABLE_NODE_TYPES.has(node.type);

export const isTranslationTextContentMode = (node: DesignerNode): boolean =>
  node.props[TEXT_CONTENT_MODE_PROP] === TEXT_CONTENT_MODE_TRANSLATION;

export const readTranslationKey = (node: DesignerNode): string => {
  const key = node.props[TRANSLATION_KEY_PROP];
  return typeof key === 'string' ? key.trim() : '';
};

export const documentUsesTranslationKeys = (document: DesignerDocument): boolean =>
  Object.values(document.nodes).some(
    (node) => isTranslatableTextNode(node)
      && isTranslationTextContentMode(node)
      && readTranslationKey(node).length > 0,
  );

export const resolveTranslatableTextPreview = (
  node: DesignerNode,
  translate: (key: string) => string,
  fallback: string,
): string => {
  if (!isTranslationTextContentMode(node)) {
    const literal = node.props.text;
    if (typeof literal === 'string' && literal.trim().length > 0) {
      return literal;
    }
    return fallback;
  }

  const key = readTranslationKey(node);
  if (!key) {
    return fallback;
  }

  const translated = translate(key);
  return translated.trim().length > 0 ? translated : key;
};
