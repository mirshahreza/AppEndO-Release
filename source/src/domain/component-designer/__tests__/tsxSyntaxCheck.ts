import ts from 'typescript';

/**
 * Syntax-only TSX validity check, in-process, no child process or shared service.
 *
 * Previously these tests used esbuild's `transform`/`transformSync`, which routes through
 * esbuild's long-lived service process (shared with Vite/Vitest's own internal transforms).
 * Under this suite's parallel test load, that shared service intermittently corrupted a single
 * byte of a large payload — same fixed offset, different garbled character every time,
 * reproducing even with `transformSync` (proving the corruption was in the shared service
 * Vite itself uses to transform test files, not in how these tests called esbuild). See
 * CLAUDE-FULL-AUDIT-LOG.md for the full investigation.
 *
 * `ts.transpileModule` runs entirely in-process (no IPC, no child process, no shared native
 * service) and is syntax-only when used without a full Program (matching what these tests
 * actually want to assert — that generated code is syntactically valid TSX, not that it
 * type-checks).
 */
export const assertValidTsxSyntax = (label: string, tsx: string): void => {
  const { diagnostics } = ts.transpileModule(tsx, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
  });

  const syntaxErrors = (diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );

  if (syntaxErrors.length > 0) {
    const messages = syntaxErrors
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
      .join('\n');
    throw new Error(`Generated TSX for "${label}" is not syntactically valid:\n${messages}\n\n${tsx}`);
  }
};
