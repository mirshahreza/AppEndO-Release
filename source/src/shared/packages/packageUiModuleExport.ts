export function resolvePackageUiModuleExport(
  moduleRef: Record<string, unknown>,
): unknown {
  if (typeof moduleRef.default === 'function') {
    return moduleRef.default;
  }

  if (typeof moduleRef.GeneratedComponent === 'function') {
    return moduleRef.GeneratedComponent;
  }

  for (const value of Object.values(moduleRef)) {
    if (typeof value === 'function') {
      return value;
    }
  }

  return null;
}

/** `export { default } from '@/…'` when the target only has a named export (common Hawiety stubs). */
export function rewriteDefaultReExportFromNamedOnlyModule(
  source: string,
  resolveTargetSource: (importPath: string) => string | null,
): string {
  const trimmed = source.trim();
  const match = trimmed.match(/^export\s+\{\s*default\s*\}\s+from\s+(['"])([^'"]+)\1\s*;?$/);
  if (!match) {
    return source;
  }

  const importPath = match[2];
  const targetSource = resolveTargetSource(importPath);
  if (!targetSource || /\bexport\s+default\b/.test(targetSource)) {
    return source;
  }

  const namedExport = targetSource.match(/\bexport\s+(?:const|function)\s+([A-Za-z_$][\w$]*)/);
  if (!namedExport?.[1]) {
    return source;
  }

  const quote = match[1];
  return `export { ${namedExport[1]} as default } from ${quote}${importPath}${quote};\n`;
}

export function ensurePackageUiModuleDefaultExport(source: string): string {
  if (/\bexport\s+default\b/.test(source)) {
    return source;
  }

  if (/\bexport\s+const\s+GeneratedComponent\b/.test(source)) {
    return `${source.trimEnd()}\nexport default GeneratedComponent;\n`;
  }

  const namedExport = source.match(/\bexport\s+(?:const|function)\s+([A-Za-z_$][\w$]*)/);
  if (namedExport?.[1]) {
    return `${source.trimEnd()}\nexport default ${namedExport[1]};\n`;
  }

  return source;
}
