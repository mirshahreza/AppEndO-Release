import type { DesignerNode } from './types';
import {
  renderBoundJsxTextExpression,
  resolveNodePropertyBindingExpression,
  type TsxBindingRenderContext,
} from './bindingCodegen';
import { renderJsxTextContent } from './tsxPropMapper';
import {
  isTranslationTextContentMode,
  readTranslationKey,
} from './translatableTextContent';

/** Emit TSX text content for designer codegen — keep off the runtime preview boot graph. */
export const renderTranslatableJsxTextContent = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  fallback: string,
): string => {
  const textBindingExpr = bindingContext
    ? resolveNodePropertyBindingExpression(node.id, 'text', bindingContext)
    : null;

  if (textBindingExpr) {
    return renderBoundJsxTextExpression(textBindingExpr, fallback);
  }

  if (isTranslationTextContentMode(node)) {
    const key = readTranslationKey(node);
    if (key) {
      return `{culture.t(${JSON.stringify(key)})}`;
    }
  }

  return renderJsxTextContent(node.props.text, fallback);
};
