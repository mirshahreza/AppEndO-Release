import * as ts from 'typescript';
import type { StructuralSymbolKind, StructuralSymbolRef } from '../../api/contracts/appendoo/codebaseIntelligence.types';

/**
 * V5 Phase P05 § 7.2/V5-7 Stage B/C — real, syntax-aware symbol and reference extraction using
 * the TypeScript compiler API (`ts.createSourceFile` + AST traversal), replacing the doc's cited
 * evidence: `ingestStructuralSymbolsFromFile` (6 line-regexes) and `findReferences`
 * (`content.includes`). Scope: single-file AST analysis (no `ts.Program`/`ts.TypeChecker` —
 * that needs a full project build and is out of this phase's budget; see
 * PHASE-EVIDENCE-REPORT-P05.md § Remaining). This is real syntax-position awareness (definition
 * vs import vs call vs type reference, correct multi-line spans), not full type-checked
 * cross-file resolution.
 */

const isExported = (node: ts.Node): boolean => (
  Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
);

const isPascalCase = (name: string): boolean => /^[A-Z]/.test(name);

const lineOf = (sourceFile: ts.SourceFile, pos: number): number => (
  sourceFile.getLineAndCharacterOfPosition(pos).line + 1
);

/** Real syntax-aware symbol extraction — drop-in for `ingestStructuralSymbolsFromFile`'s contract. */
export const extractSymbolsFromSourceAst = (path: string, content: string): StructuralSymbolRef[] => {
  const sourceFile = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const symbols: StructuralSymbolRef[] = [];

  const pushSymbol = (name: string, kind: StructuralSymbolKind, node: ts.Node) => {
    symbols.push({
      symbolId: `${path}:${name}:${lineOf(sourceFile, node.getStart(sourceFile))}`,
      name,
      kind,
      path,
      startLine: lineOf(sourceFile, node.getStart(sourceFile)),
      endLine: lineOf(sourceFile, node.getEnd()),
    });
  };

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name && isExported(node)) {
      pushSymbol(node.name.text, isPascalCase(node.name.text) ? 'component' : 'function', node);
    } else if (ts.isClassDeclaration(node) && node.name && isExported(node)) {
      pushSymbol(node.name.text, 'class', node);
    } else if (ts.isInterfaceDeclaration(node) && isExported(node)) {
      pushSymbol(node.name.text, 'type', node);
    } else if (ts.isTypeAliasDeclaration(node) && isExported(node)) {
      pushSymbol(node.name.text, 'type', node);
    } else if (ts.isVariableStatement(node) && isExported(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const name = decl.name.text;
        const isFn = decl.initializer
          && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer));
        const kind: StructuralSymbolKind = isFn
          ? (isPascalCase(name) ? 'component' : 'function')
          : 'const';
        pushSymbol(name, kind, node);
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return symbols;
};

export type AstReferenceKind = 'definition' | 'import' | 'call' | 'type_reference' | 'usage';

export type AstReference = {
  kind: AstReferenceKind;
  startLine: number;
  endLine: number;
};

/**
 * Real per-file reference scan: finds every AST identifier node matching `symbolName` and
 * classifies it by syntax position — the exact distinction (doc § 7.2) `content.includes` cannot
 * make (definition / import / call / type reference / plain usage).
 */
export const extractReferencesFromSourceAst = (
  path: string,
  content: string,
  symbolName: string,
): AstReference[] => {
  if (!symbolName.trim()) return [];
  const sourceFile = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const refs: AstReference[] = [];

  const classify = (node: ts.Identifier): AstReferenceKind => {
    const parent = node.parent;
    if (!parent) return 'usage';
    if (ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent)) return 'import';
    if (
      (ts.isFunctionDeclaration(parent) || ts.isClassDeclaration(parent) || ts.isInterfaceDeclaration(parent)
        || ts.isTypeAliasDeclaration(parent) || ts.isVariableDeclaration(parent))
      && parent.name === node
    ) {
      return 'definition';
    }
    if (ts.isCallExpression(parent) && parent.expression === node) return 'call';
    if (ts.isTypeReferenceNode(parent)) return 'type_reference';
    return 'usage';
  };

  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && node.text === symbolName) {
      const line = lineOf(sourceFile, node.getStart(sourceFile));
      refs.push({ kind: classify(node), startLine: line, endLine: line });
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return refs;
};
