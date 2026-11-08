import ts from 'typescript';
import {
  extractDataContextPathFromExpression,
  extractStorePathFromExpression,
} from './bindingExpressionParser';
import { EVALUATE_DESIGNER_CONDITION_FN } from './visibilityConditionEngine';
import { LOGIC_REPEATER_PALETTE_ITEM_ID } from './repeaterEngine';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import type { ParsedDesignerNodeDraft } from './jsxNodeReconciler';

const unwrapExpression = (expression: ts.Expression): ts.Expression => {
  if (ts.isParenthesizedExpression(expression)) {
    return unwrapExpression(expression.expression);
  }

  return expression;
};

const readStringLiteral = (expression: ts.Expression | undefined): string | null => {
  if (!expression) {
    return null;
  }

  const unwrapped = unwrapExpression(expression);
  if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.text;
  }

  return null;
};

const extractArrayPathFromMapExpression = (expression: ts.Expression): string | null => {
  const unwrapped = unwrapExpression(expression);

  if (ts.isBinaryExpression(unwrapped) && unwrapped.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
    return extractArrayPathFromMapExpression(unwrapped.left)
      ?? extractArrayPathFromMapExpression(unwrapped.right);
  }

  if (!ts.isCallExpression(unwrapped)) {
    return null;
  }

  const callee = unwrapped.expression;
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'map') {
    return null;
  }

  const storePath = extractStorePathFromExpression(callee.expression);
  if (storePath) {
    return `store.${storePath}`;
  }

  const dataPath = extractDataContextPathFromExpression(callee.expression);
  if (dataPath) {
    return dataPath;
  }

  return null;
};

const parseArrowFunctionBodyExpression = (
  expression: ts.Expression,
  parseChild: (node: ts.JsxChild) => ParsedDesignerNodeDraft | ParsedDesignerNodeDraft[] | null,
): ParsedDesignerNodeDraft[] => {
  const unwrapped = unwrapExpression(expression);

  if (ts.isJsxElement(unwrapped) || ts.isJsxSelfClosingElement(unwrapped) || ts.isJsxFragment(unwrapped)) {
    const parsed = parseChild(unwrapped as unknown as ts.JsxChild);
    if (!parsed) {
      return [];
    }

    return Array.isArray(parsed) ? parsed : [parsed];
  }

  if (ts.isParenthesizedExpression(unwrapped)) {
    return parseArrowFunctionBodyExpression(unwrapped.expression, parseChild);
  }

  return [];
};

const extractVisibilityConditionFromExpression = (expression: ts.Expression): string | null => {
  const unwrapped = unwrapExpression(expression);

  if (ts.isCallExpression(unwrapped) && ts.isIdentifier(unwrapped.expression)) {
    if (unwrapped.expression.text === EVALUATE_DESIGNER_CONDITION_FN) {
      return readStringLiteral(unwrapped.arguments[3]);
    }
  }

  return null;
};

const attachVisibleCondition = (
  draft: ParsedDesignerNodeDraft,
  visibleCondition: string,
): ParsedDesignerNodeDraft => ({
  ...draft,
  layout: {
    ...draft.layout,
    visibleCondition,
  },
});

const parseMapCallbackBody = (
  body: ts.ConciseBody,
  parseChild: (node: ts.JsxChild) => ParsedDesignerNodeDraft | ParsedDesignerNodeDraft[] | null,
): ParsedDesignerNodeDraft[] => {
  if (ts.isBlock(body)) {
    for (const statement of body.statements) {
      if (ts.isReturnStatement(statement) && statement.expression) {
        const conditional = parseConditionalWrappedExpression(statement.expression, parseChild);
        if (conditional) {
          return conditional;
        }

        return parseArrowFunctionBodyExpression(statement.expression, parseChild);
      }
    }

    return [];
  }

  const conditional = parseConditionalWrappedExpression(body, parseChild);
  if (conditional) {
    return conditional;
  }

  return parseArrowFunctionBodyExpression(body, parseChild);
};

const parseConditionalWrappedExpression = (
  expression: ts.Expression,
  parseChild: (node: ts.JsxChild) => ParsedDesignerNodeDraft | ParsedDesignerNodeDraft[] | null,
): ParsedDesignerNodeDraft[] | null => {
  const unwrapped = unwrapExpression(expression);

  if (ts.isBinaryExpression(unwrapped) && unwrapped.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    const visibleCondition = extractVisibilityConditionFromExpression(unwrapped.left);
    if (!visibleCondition) {
      return null;
    }

    const parsedRight = parseArrowFunctionBodyExpression(unwrapped.right, parseChild);
    if (parsedRight.length === 0) {
      const single = parseChild(unwrapped.right as unknown as ts.JsxChild);
      if (!single) {
        return null;
      }

      const normalized = Array.isArray(single) ? single : [single];
      return normalized.map((draft) => attachVisibleCondition(draft, visibleCondition));
    }

    return parsedRight.map((draft) => attachVisibleCondition(draft, visibleCondition));
  }

  return null;
};

export const parseLogicJsxExpression = (
  expression: ts.Expression,
  parseChild: (node: ts.JsxChild) => ParsedDesignerNodeDraft | ParsedDesignerNodeDraft[] | null,
): ParsedDesignerNodeDraft | ParsedDesignerNodeDraft[] | null => {
  const unwrapped = unwrapExpression(expression);

  if (ts.isBinaryExpression(unwrapped) && unwrapped.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    const visibleCondition = extractVisibilityConditionFromExpression(unwrapped.left);
    if (!visibleCondition) {
      return null;
    }

    const parsedRight = parseArrowFunctionBodyExpression(unwrapped.right, parseChild);
    if (parsedRight.length === 0) {
      const single = parseChild(unwrapped.right as unknown as ts.JsxChild);
      if (!single) {
        return null;
      }

      const normalized = Array.isArray(single) ? single : [single];
      return normalized.map((draft) => attachVisibleCondition(draft, visibleCondition));
    }

    return parsedRight.map((draft) => attachVisibleCondition(draft, visibleCondition));
  }

  if (!ts.isCallExpression(unwrapped)) {
    return null;
  }

  const dataPath = extractArrayPathFromMapExpression(unwrapped);
  if (!dataPath) {
    return null;
  }

  const callback = unwrapped.arguments[0];
  if (!callback || !ts.isArrowFunction(callback)) {
    return null;
  }

  const itemAlias = callback.parameters[0]?.name.getText() ?? 'item';
  const indexAlias = callback.parameters[1]?.name.getText() ?? 'index';
  const bodyDrafts = callback.body
    ? parseMapCallbackBody(callback.body, parseChild)
    : [];

  return {
    type: 'container',
    paletteItemId: LOGIC_REPEATER_PALETTE_ITEM_ID,
    props: {
      className: 'flex flex-col gap-3 rounded-md border border-dashed border-default-200 bg-content1 p-3',
      dataPath,
      itemAlias,
      indexAlias,
      [DESIGNER_PALETTE_ITEM_ID_PROP]: LOGIC_REPEATER_PALETTE_ITEM_ID,
    },
    layout: {},
    binding: {},
    children: bodyDrafts,
    signature: '',
  };
};
