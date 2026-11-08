import type {
  CodebaseExtractorDescriptor,
  StructuralSymbolKind,
  StructuralSymbolRef,
} from '../../api/contracts/appendoo/codebaseIntelligence.types';
import { CODEBASE_EXTRACTOR_REGISTRY_VERSION } from '../../api/contracts/appendoo/codebaseIntelligence.types';
import { extractSymbolsFromSourceAst } from './tsAstSymbolExtractor';
import { logger } from '../../../core/logging/Logger';

/** AE-4.1 — versioned AppEndO-aware extractor registry (scaffold). */
export const APPENDOO_CODEBASE_EXTRACTORS: CodebaseExtractorDescriptor[] = [
  {
    extractorId: 'appendoo.extractor.server-function',
    kind: 'server_function_registration',
    version: '1.0.0',
    description: 'Detect managed server function registration and proxy usage.',
  },
  {
    extractorId: 'appendoo.extractor.experience-route',
    kind: 'experience_route',
    version: '1.0.0',
    description: 'Detect experience route and registry references.',
  },
  {
    extractorId: 'appendoo.extractor.designer-binding',
    kind: 'designer_binding',
    version: '1.0.0',
    description: 'Detect Component Designer published artifact bindings.',
  },
  {
    extractorId: 'appendoo.extractor.api-query',
    kind: 'api_query_usage',
    version: '1.0.0',
    description: 'Detect shared API query client usage patterns.',
  },
  {
    extractorId: 'appendoo.extractor.permission-check',
    kind: 'permission_check',
    version: '1.0.0',
    description: 'Detect RBAC and permission guard checks.',
  },
  {
    extractorId: 'appendoo.extractor.package-dependency',
    kind: 'package_dependency',
    version: '1.0.0',
    description: 'Detect package manifest dependency references.',
  },
  {
    extractorId: 'appendoo.extractor.edge-db-router',
    kind: 'edge_db_router',
    version: '1.0.0',
    description: 'Detect EdgeDbRouter data access calls.',
  },
  {
    extractorId: 'appendoo.extractor.control-plane-repo',
    kind: 'control_plane_repository',
    version: '1.0.0',
    description: 'Detect control-plane repository access patterns.',
  },
];

export const getCodebaseExtractorRegistry = (): {
  registryVersion: string;
  extractors: CodebaseExtractorDescriptor[];
} => ({
  registryVersion: CODEBASE_EXTRACTOR_REGISTRY_VERSION,
  extractors: APPENDOO_CODEBASE_EXTRACTORS,
});

const SYMBOL_PATTERNS: Array<{ kind: StructuralSymbolKind; pattern: RegExp }> = [
  { kind: 'function', pattern: /^\s*export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/ },
  { kind: 'function', pattern: /^\s*(?:async\s+)?function\s+([A-Za-z0-9_]+)/ },
  { kind: 'const', pattern: /^\s*export\s+const\s+([A-Za-z0-9_]+)\s*=/ },
  { kind: 'class', pattern: /^\s*export\s+class\s+([A-Za-z0-9_]+)/ },
  { kind: 'type', pattern: /^\s*export\s+type\s+([A-Za-z0-9_]+)/ },
  { kind: 'component', pattern: /^\s*export\s+(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(/ },
];

const ingestStructuralSymbolsFromFileRegex = (
  path: string,
  content: string,
): StructuralSymbolRef[] => {
  const lines = content.split(/\r?\n/);
  const symbols: StructuralSymbolRef[] = [];

  lines.forEach((line, index) => {
    for (const entry of SYMBOL_PATTERNS) {
      const match = line.match(entry.pattern);
      if (!match?.[1]) continue;

      symbols.push({
        symbolId: `${path}:${match[1]}:${index + 1}`,
        name: match[1],
        kind: entry.kind,
        path,
        startLine: index + 1,
        endLine: index + 1,
      });
      break;
    }
  });

  return symbols;
};

const TS_SOURCE_PATTERN = /\.tsx?$/i;

/**
 * V5 Phase P05 § V5-7 Stage B — real syntax-aware extraction (`tsAstSymbolExtractor.ts`) for
 * `.ts`/`.tsx` files, replacing the line-regex extractor's known gaps (doc § 7.2; see
 * `tsAstSymbolExtractor.test.ts` for the proven multi-declarator gap). Falls back to the regex
 * extractor on a parse error or for non-TS files — same output contract either way, so every
 * existing caller (`indexStructuralFile` → `queryStructuralIntelligence` → `hybridRetrieve`,
 * the real `search_codebase` hybrid-mode production path) is unaffected in shape, only more
 * accurate for TS/TSX source.
 */
export const ingestStructuralSymbolsFromFile = (
  path: string,
  content: string,
): StructuralSymbolRef[] => {
  if (!TS_SOURCE_PATTERN.test(path)) {
    return ingestStructuralSymbolsFromFileRegex(path, content);
  }
  try {
    return extractSymbolsFromSourceAst(path, content);
  } catch (error) {
    logger.warn('codebaseExtractorRegistry', 'AST symbol extraction failed — falling back to regex extractor', {
      path,
      error: error instanceof Error ? error.message : String(error),
    });
    return ingestStructuralSymbolsFromFileRegex(path, content);
  }
};

export const detectExtractorSignals = (
  path: string,
  content: string,
): CodebaseExtractorDescriptor[] => {
  const signals: CodebaseExtractorDescriptor[] = [];
  const registry = getCodebaseExtractorRegistry();

  const matchers: Array<{ kind: CodebaseExtractorDescriptor['kind']; pattern: RegExp }> = [
    { kind: 'server_function_registration', pattern: /registerManagedFunction|managedFunction/i },
    { kind: 'experience_route', pattern: /experienceRoute|registerExperience/i },
    { kind: 'designer_binding', pattern: /ComponentDesigner|publishedArtifact/i },
    { kind: 'api_query_usage', pattern: /useQuery\(|useMutation\(|server-functions\.execute/i },
    { kind: 'permission_check', pattern: /requiresPermission|hasRole|authorize/i },
    { kind: 'package_dependency', pattern: /ownerPackageId|packageId/i },
    { kind: 'edge_db_router', pattern: /EdgeDbRouter/i },
    { kind: 'control_plane_repository', pattern: /control-plane|repository/i },
  ];

  for (const matcher of matchers) {
    if (!matcher.pattern.test(content)) continue;
    const extractor = registry.extractors.find((candidate) => candidate.kind === matcher.kind);
    if (extractor) signals.push(extractor);
  }

  return signals;
};
