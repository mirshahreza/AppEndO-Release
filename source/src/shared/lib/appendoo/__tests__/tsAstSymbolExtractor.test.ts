import { describe, expect, it } from 'vitest';
import { extractSymbolsFromSourceAst, extractReferencesFromSourceAst } from '../tsAstSymbolExtractor';
import { ingestStructuralSymbolsFromFile } from '../codebaseExtractorRegistry';

const MULTI_LINE_SOURCE = `
import { helper } from './helper';

export function processRequest(
  input: string,
  options: { retry: boolean },
): string {
  return helper(input);
}

export const resolveModelTier = (
  actionClass: string,
): string => {
  return actionClass;
};

export class AgentOrchestrator {
  run() {}
}

export interface TaskContract {
  taskContractId: string;
}

export type AgentActionClass = 'EDIT' | 'VERIFY';

// A comment mentioning processRequest should not count as a reference.
const notExported = () => processRequest('x', { retry: true });
`;

describe('V5 P05 § V5-7 Stage B — extractSymbolsFromSourceAst (real AST vs regex)', () => {
  it('extracts a multi-line exported function signature with the correct real declaration line', () => {
    const astSymbols = extractSymbolsFromSourceAst('test.ts', MULTI_LINE_SOURCE);
    const processRequestSymbol = astSymbols.find((s) => s.name === 'processRequest');
    expect(processRequestSymbol).toBeDefined();
    expect(processRequestSymbol?.kind).toBe('function');
    expect(processRequestSymbol?.startLine).toBe(4);
  });

  it('extracts every declarator in a multi-declarator export const (the pre-existing line-regex extractor only found the first)', () => {
    const source = 'export const alpha = 1, beta = 2, gamma = 3;';
    const astSymbols = extractSymbolsFromSourceAst('test.ts', source);
    expect(astSymbols.map((s) => s.name)).toEqual(['alpha', 'beta', 'gamma']);

    // ingestStructuralSymbolsFromFile is the real, wired production entry point
    // (codebaseExtractorRegistry.ts) — it now uses AST extraction for .ts/.tsx files, so it
    // should match the AST extractor's improved result, not the old regex-only behavior.
    const wiredSymbols = ingestStructuralSymbolsFromFile('test.ts', source);
    expect(wiredSymbols.map((s) => s.name)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('falls back to regex extraction for non-TS files (e.g. .md) via the wired production entry point', () => {
    // Regex patterns are TS-syntax-shaped, so a non-.ts/.tsx path is routed to the regex path
    // unconditionally — this just proves the routing itself, not regex accuracy.
    const symbols = ingestStructuralSymbolsFromFile('README.md', 'export const alpha = 1;');
    expect(symbols.map((s) => s.name)).toEqual(['alpha']);
  });

  it('extracts an arrow-function const across multiple lines with correct kind classification', () => {
    const symbols = extractSymbolsFromSourceAst('test.ts', MULTI_LINE_SOURCE);
    const resolveModelTier = symbols.find((s) => s.name === 'resolveModelTier');
    expect(resolveModelTier?.kind).toBe('function');
  });

  it('classifies a class, interface, and type alias correctly', () => {
    const symbols = extractSymbolsFromSourceAst('test.ts', MULTI_LINE_SOURCE);
    expect(symbols.find((s) => s.name === 'AgentOrchestrator')?.kind).toBe('class');
    expect(symbols.find((s) => s.name === 'TaskContract')?.kind).toBe('type');
    expect(symbols.find((s) => s.name === 'AgentActionClass')?.kind).toBe('type');
  });

  it('does not extract non-exported declarations (matches the existing contract)', () => {
    const symbols = extractSymbolsFromSourceAst('test.ts', MULTI_LINE_SOURCE);
    expect(symbols.find((s) => s.name === 'notExported')).toBeUndefined();
  });

  it('classifies a PascalCase exported function as a component (matches existing kind semantics)', () => {
    const source = 'export function SumTwoNumbersForm() { return null; }';
    const symbols = extractSymbolsFromSourceAst('test.tsx', source);
    expect(symbols[0]?.kind).toBe('component');
  });
});

describe('V5 P05 § V5-7 Stage C — extractReferencesFromSourceAst (real AST vs content.includes)', () => {
  it('distinguishes definition from usage/call, unlike content.includes', () => {
    const refs = extractReferencesFromSourceAst('test.ts', MULTI_LINE_SOURCE, 'processRequest');
    expect(refs.some((r) => r.kind === 'definition')).toBe(true);
    expect(refs.some((r) => r.kind === 'call')).toBe(true);
    // content.includes would also match the comment line — AST-based matching only finds real
    // identifier nodes, so the comment mention does not appear as a separate identifier ref.
    const commentLine = MULTI_LINE_SOURCE.split('\n').findIndex((l) => l.includes('A comment mentioning')) + 1;
    expect(refs.some((r) => r.startLine === commentLine)).toBe(false);
  });

  it('classifies an import specifier as kind "import"', () => {
    const refs = extractReferencesFromSourceAst('test.ts', MULTI_LINE_SOURCE, 'helper');
    expect(refs.some((r) => r.kind === 'import')).toBe(true);
  });

  it('classifies a type reference correctly', () => {
    const source = `
      export interface Box { value: string; }
      export function wrap(input: Box): Box { return input; }
    `;
    const refs = extractReferencesFromSourceAst('test.ts', source, 'Box');
    expect(refs.some((r) => r.kind === 'type_reference')).toBe(true);
    expect(refs.some((r) => r.kind === 'definition')).toBe(true);
  });

  it('returns no references for a symbol name that does not appear', () => {
    const refs = extractReferencesFromSourceAst('test.ts', MULTI_LINE_SOURCE, 'doesNotExist');
    expect(refs).toEqual([]);
  });
});
