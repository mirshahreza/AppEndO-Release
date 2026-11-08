import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import {
  extractDataContextPathFromExpression,
  parseDataContextBindingFromJsxAttribute,
  resolveTargetPropFromJsxBoundAttribute,
} from '../bindingExpressionParser';

const parseExpression = (code: string): ts.Expression => {
  const sourceFile = ts.createSourceFile('expr.ts', `const _ = ${code};`, ts.ScriptTarget.Latest, true);
  const statement = sourceFile.statements[0];
  if (!ts.isVariableStatement(statement)) {
    throw new Error('Expected variable statement.');
  }

  const declaration = statement.declarationList.declarations[0];
  if (!declaration.initializer) {
    throw new Error('Expected initializer.');
  }

  return declaration.initializer;
};

describe('bindingExpressionParser', () => {
  it('extracts dotted and optional-chained dataContext paths', () => {
    expect(extractDataContextPathFromExpression(parseExpression('dataContext?.user?.email'))).toBe('user.email');
    expect(extractDataContextPathFromExpression(parseExpression('dataContext.title'))).toBe('title');
    expect(extractDataContextPathFromExpression(parseExpression('dataContext?.page.title'))).toBe('page.title');
  });

  it('extracts paths from nullish-coalesced binding expressions', () => {
    expect(extractDataContextPathFromExpression(parseExpression('dataContext?.pageTitle ?? "Draft"'))).toBe('pageTitle');
  });

  it('ignores non-dataContext expressions', () => {
    expect(extractDataContextPathFromExpression(parseExpression('props.title'))).toBeNull();
    expect(extractDataContextPathFromExpression(parseExpression('"static"'))).toBeNull();
  });

  it('maps JSX bound attributes back to designer target props', () => {
    expect(resolveTargetPropFromJsxBoundAttribute('defaultValue', { paletteItemId: 'heroui.input-text' })).toBe('placeholder');
    expect(resolveTargetPropFromJsxBoundAttribute('defaultValue', { nodeType: 'heading' })).toBe('text');
    expect(resolveTargetPropFromJsxBoundAttribute('value', {})).toBe('value');
  });

  it('builds property binding definitions from JSX attribute expressions', () => {
    const parsed = parseDataContextBindingFromJsxAttribute(
      'defaultValue',
      parseExpression('dataContext?.user?.email'),
      { paletteItemId: 'heroui.input-text' },
    );

    expect(parsed?.targetProp).toBe('placeholder');
    expect(parsed?.definition.bindingRole).toBe('property');
    expect(parsed?.definition.dataPath).toBe('user.email');
    expect(parsed?.definition.sourceType).toBe('expression');
  });
});
