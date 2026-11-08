import ts from 'typescript';

const unwrapJsxExpression = (expression: ts.Expression): ts.Expression => {
  if (ts.isParenthesizedExpression(expression)) {
    return unwrapJsxExpression(expression.expression);
  }

  return expression;
};

const readStringLiteral = (expression: ts.Expression): string | null => {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }

  return null;
};

const isCultureTranslationCallee = (expression: ts.Expression): boolean => {
  if (ts.isIdentifier(expression) && expression.text === 't') {
    return true;
  }

  if (
    ts.isPropertyAccessExpression(expression)
    && ts.isIdentifier(expression.expression)
    && expression.expression.text === 'culture'
    && expression.name.text === 't'
  ) {
    return true;
  }

  return false;
};

/** Reverse-parse `culture.t("key")` / `t("key")` from a TSX expression (designer import path only). */
export const extractCultureTranslationKeyFromExpression = (
  expression: ts.Expression,
): string | null => {
  const unwrapped = unwrapJsxExpression(expression);
  if (!ts.isCallExpression(unwrapped) || unwrapped.arguments.length !== 1) {
    return null;
  }

  if (!isCultureTranslationCallee(unwrapped.expression)) {
    return null;
  }

  return readStringLiteral(unwrapped.arguments[0]);
};
