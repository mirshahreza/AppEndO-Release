import type {
  CodebaseIntelligenceHealth,
  IncrementalIndexFileRecord,
  SourceSlice,
  StructuralQueryResult,
  StructuralSymbolRef,
} from '../../api/contracts/appendoo/codebaseIntelligence.types';
import { CODEBASE_INTELLIGENCE_VERSION } from '../../api/contracts/appendoo/codebaseIntelligence.types';
import {
  detectExtractorSignals,
  getCodebaseExtractorRegistry,
  ingestStructuralSymbolsFromFile,
} from './codebaseExtractorRegistry';
import { extractReferencesFromSourceAst } from './tsAstSymbolExtractor';
import { logger } from '../../../core/logging/Logger';

const TS_SOURCE_PATTERN = /\.tsx?$/i;

const symbolIndex = new Map<string, StructuralSymbolRef[]>();
const fileRecords = new Map<string, IncrementalIndexFileRecord>();
const fileContents = new Map<string, string>();

const hashContent = (content: string): string => {
  let hash = 0;
  for (let index = 0; index < content.length; index += 1) {
    hash = ((hash << 5) - hash) + content.charCodeAt(index);
    hash |= 0;
  }
  return `h${Math.abs(hash)}`;
};

export const resetCodebaseStructuralIndexForTests = (): void => {
  symbolIndex.clear();
  fileRecords.clear();
  fileContents.clear();
};

export const indexStructuralFile = (path: string, content: string): {
  skipped: boolean;
  symbols: StructuralSymbolRef[];
  extractors: ReturnType<typeof detectExtractorSignals>;
} => {
  const contentHash = hashContent(content);
  const existing = fileRecords.get(path);
  if (existing?.contentHash === contentHash) {
    return {
      skipped: true,
      symbols: symbolIndex.get(path) ?? [],
      extractors: [],
    };
  }

  const symbols = ingestStructuralSymbolsFromFile(path, content);
  symbolIndex.set(path, symbols);
  fileContents.set(path, content);
  fileRecords.set(path, {
    path,
    contentHash,
    indexedAt: new Date().toISOString(),
    symbolCount: symbols.length,
  });

  return {
    skipped: false,
    symbols,
    extractors: detectExtractorSignals(path, content),
  };
};

export const findSymbol = (name: string, scopePaths?: string[]): StructuralSymbolRef[] => {
  const needle = name.trim();
  if (!needle) return [];

  const scoped = scopePaths?.length
    ? scopePaths.map((scope) => scope.replace(/\\/g, '/'))
    : undefined;

  return [...symbolIndex.values()]
    .flat()
    .filter((symbol) => {
      if (symbol.name !== needle) return false;
      if (!scoped) return true;
      return scoped.some((scope) => symbol.path.startsWith(scope));
    });
};

/**
 * V5 Phase P05 § 7.2/V5-7 Stage C — real AST-based reference finding for `.ts`/`.tsx` files
 * (via `extractReferencesFromSourceAst`), replacing `content.includes` for those files. Falls
 * back to the old substring-match behavior for non-TS files or on a parse error. Output stays
 * `StructuralSymbolRef[]` (the existing contract) — one entry per real AST reference found,
 * `kind` fixed at `'const'` because `StructuralSymbolKind` doesn't have a "reference" kind of
 * its own (out of this phase's blast radius to widen that shared enum); the real
 * definition/import/call/type_reference/usage distinction is still computed internally and
 * available via `extractReferencesFromSourceAst` directly for callers that need it (e.g. a
 * future Code Graph builder — see `codeGraphBuilder.ts`).
 */
export const findReferences = (symbolName: string, scopePaths?: string[]): StructuralSymbolRef[] => {
  const needle = symbolName.trim();
  if (!needle) return [];

  const references: StructuralSymbolRef[] = [];
  for (const [path, content] of fileContents.entries()) {
    if (scopePaths?.length && !scopePaths.some((scope) => path.startsWith(scope))) continue;

    if (TS_SOURCE_PATTERN.test(path)) {
      try {
        const astRefs = extractReferencesFromSourceAst(path, content, needle);
        for (const ref of astRefs) {
          references.push({
            symbolId: `${path}:ref:${needle}:${ref.startLine}:${ref.kind}`,
            name: needle,
            kind: 'const',
            path,
            startLine: ref.startLine,
            endLine: ref.endLine,
          });
        }
        continue;
      } catch (error) {
        logger.warn('codebaseStructuralScaffold', 'AST reference extraction failed — falling back to substring match', {
          path,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!content.includes(needle)) continue;
    references.push({
      symbolId: `${path}:ref:${needle}`,
      name: needle,
      kind: 'const',
      path,
      startLine: content.split(/\r?\n/).findIndex((line) => line.includes(needle)) + 1,
      endLine: content.split(/\r?\n/).findIndex((line) => line.includes(needle)) + 1,
    });
  }

  return references;
};

export const getSourceSlice = (
  path: string,
  startLine: number,
  endLine: number,
): SourceSlice | null => {
  const content = fileContents.get(path);
  if (!content) return null;

  const lines = content.split(/\r?\n/);
  const slice = lines.slice(Math.max(0, startLine - 1), endLine);
  if (slice.length === 0) return null;

  return {
    path,
    startLine,
    endLine,
    text: slice.join('\n'),
  };
};

export const queryStructuralIntelligence = (
  query: string,
  scopePaths?: string[],
): StructuralQueryResult => ({
  query,
  symbols: findSymbol(query, scopePaths),
  references: findReferences(query, scopePaths),
});

export const getCodebaseIntelligenceHealth = (): CodebaseIntelligenceHealth => {
  const registry = getCodebaseExtractorRegistry();
  const indexedSymbolCount = [...symbolIndex.values()].reduce((total, symbols) => total + symbols.length, 0);

  return {
    intelligenceVersion: CODEBASE_INTELLIGENCE_VERSION,
    extractorRegistryVersion: registry.registryVersion,
    extractorCount: registry.extractors.length,
    indexedSymbolCount,
    staleFileCount: 0,
  };
};

export const listIndexedStructuralFiles = (): IncrementalIndexFileRecord[] => (
  [...fileRecords.values()]
);
