import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import * as esbuild from 'esbuild';
import type { PackageUiInternalModuleSpecifier } from '../../../core/packages/packageUiRuntimeGlobals';
import {
  ensurePackageUiModuleDefaultExport,
  rewriteDefaultReExportFromNamedOnlyModule,
} from '../../../shared/packages/packageUiModuleExport';
import { unwrapPackageUiPrebuiltModule } from '../../../shared/packages/packageUiPrebuilt';

export { ensurePackageUiModuleDefaultExport, resolvePackageUiModuleExport } from '../../../shared/packages/packageUiModuleExport';

const PACKAGE_UI_GLOBAL_NS = 'appendo-package-ui-global';

const GLOBAL_REACT_MODULE = `
const __runtime = globalThis.__APPENDO_PACKAGE_RUNTIME__;
if (!__runtime?.React) {
  throw new Error('Package UI runtime is not initialized. Reload the app and try again.');
}
const React = __runtime.React;
export default React;
export const {
  Children,
  Component,
  Fragment,
  Profiler,
  PureComponent,
  StrictMode,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  createFactory,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  startTransition,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  use,
  version,
} = React;
`.trim();

const GLOBAL_JSX_RUNTIME_MODULE = `
const __runtime = globalThis.__APPENDO_PACKAGE_RUNTIME__;
if (!__runtime?.ReactJSXRuntime) {
  throw new Error('Package UI JSX runtime is not initialized. Reload the app and try again.');
}
export const jsx = __runtime.ReactJSXRuntime.jsx;
export const jsxs = __runtime.ReactJSXRuntime.jsxs;
export const Fragment = __runtime.ReactJSXRuntime.Fragment;
`.trim();

const GLOBAL_JSX_DEV_RUNTIME_MODULE = `
const __runtime = globalThis.__APPENDO_PACKAGE_RUNTIME__;
if (!__runtime?.ReactJSXRuntime) {
  throw new Error('Package UI JSX runtime is not initialized. Reload the app and try again.');
}
export const jsxDEV = __runtime.ReactJSXRuntime.jsxDEV;
export const Fragment = __runtime.ReactJSXRuntime.Fragment;
`.trim();

/**
 * Package UI modules render inside the host admin shell, which already has react-dom,
 * react-router-dom, and the HeroUI kit loaded — Designer-authored pages and host-backed package
 * pages (Remote Hubs) routinely import them. Redirecting them to the host's own instances (like
 * React above) avoids esbuild bundling a second copy. A second react-dom next to the host
 * renderer throws invalid-hook errors on every page that calls createPortal. The named-export
 * list is computed once from the real package here (not hand-maintained) so it can't silently drift.
 */
function buildGlobalReexportModule(runtimeKey: string, sourceModule: Record<string, unknown>): string {
  const namedExports = Object.keys(sourceModule).filter((key) => key !== 'default');
  const lines = [
    'const __runtime = globalThis.__APPENDO_PACKAGE_RUNTIME__;',
    `if (!__runtime?.${runtimeKey}) {`,
    "  throw new Error('Package UI runtime is not initialized. Reload the app and try again.');",
    '}',
    `const __mod = __runtime.${runtimeKey};`,
  ];
  if ('default' in sourceModule) {
    lines.push('export default __mod.default;');
  }
  if (namedExports.length > 0) {
    lines.push(`export const {\n  ${namedExports.join(',\n  ')},\n} = __mod;`);
  }
  return lines.join('\n');
}

const GLOBAL_MODULE_BY_SPECIFIER = new Map<string, string>([
  ['react', GLOBAL_REACT_MODULE],
  ['react/jsx-runtime', GLOBAL_JSX_RUNTIME_MODULE],
  ['react/jsx-dev-runtime', GLOBAL_JSX_DEV_RUNTIME_MODULE],
]);

// react-router-dom/@heroui/react are ESM-only (no CJS `require` entry), so their shim source has
// to be computed via a real dynamic import — done lazily+once, awaited before every compile, never
// as top-level await (the esbuild-bundled CJS production server output can't execute that).
let libraryGlobalModulesReady: Promise<void> | null = null;

function ensureLibraryGlobalModulesReady(): Promise<void> {
  if (!libraryGlobalModulesReady) {
    libraryGlobalModulesReady = Promise.all([
      import('react-dom'),
      import('react-router-dom'),
      import('@heroui/react'),
      import('@tanstack/react-query'),
    ]).then(([reactDom, reactRouterDom, heroUiReact, reactQuery]) => {
      GLOBAL_MODULE_BY_SPECIFIER.set(
        'react-dom',
        buildGlobalReexportModule('ReactDOM', reactDom as Record<string, unknown>),
      );
      GLOBAL_MODULE_BY_SPECIFIER.set(
        'react-router-dom',
        buildGlobalReexportModule('ReactRouterDOM', reactRouterDom as Record<string, unknown>),
      );
      GLOBAL_MODULE_BY_SPECIFIER.set(
        '@heroui/react',
        buildGlobalReexportModule('HeroUIReact', heroUiReact as Record<string, unknown>),
      );
      GLOBAL_MODULE_BY_SPECIFIER.set(
        '@tanstack/react-query',
        buildGlobalReexportModule('ReactQuery', reactQuery as Record<string, unknown>),
      );
    });
  }
  return libraryGlobalModulesReady;
}

/**
 * Collect runtime value export names from a TS barrel. Type-only exports are skipped so the
 * generated `export const { … } = __mod` shim stays valid JavaScript.
 */
export function collectValueExportNamesFromBarrel(source: string): string[] {
  const names = new Set<string>();

  const blockRe = /export\s+(type\s+)?\{([^}]+)\}/g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(source))) {
    if (block[1]) continue;
    for (const raw of block[2].split(',')) {
      const part = raw.trim();
      if (!part) continue;
      if (/^type\s+/.test(part)) continue;
      const asMatch = part.match(/^(\S+)\s+as\s+(\S+)$/);
      const exported = (asMatch ? asMatch[2] : part).trim();
      if (/^[A-Za-z_$][\w$]*$/.test(exported) && exported !== 'default') {
        names.add(exported);
      }
    }
  }

  const declRe = /export\s+(?:async\s+)?(?:const|let|var|function|class|enum)\s+([A-Za-z_$][\w$]*)/g;
  let decl: RegExpExecArray | null;
  while ((decl = declRe.exec(source))) {
    names.add(decl[1]);
  }

  return [...names].sort();
}

function namedExportsFromSourceFile(relPath: string, fallback: string[]): string[] {
  const absPath = path.join(process.cwd(), relPath);
  try {
    if (!fs.existsSync(absPath)) return fallback;
    const parsed = collectValueExportNamesFromBarrel(fs.readFileSync(absPath, 'utf8'));
    return parsed.length > 0 ? [...new Set([...parsed, ...fallback])].sort() : fallback;
  } catch {
    return fallback;
  }
}

/**
 * `@/` internal specifiers that are known to transitively pull in something huge (mermaid,
 * tiptap/prosemirror, the TypeScript compiler, katex, multiple icon sets — all live behind
 * `@/shared/ui`'s barrel and a couple of Component Designer runtime helpers) — bundling them
 * standalone blew a single page module up past 50MB. Redirected to the host app's own already-
 * loaded instance instead (like react-router-dom/@heroui/react above). Named exports are read
 * from the live source barrel (plus a fallback) so CMS/Designer pages can import CreateEditModalShell
 * and friends. `ensurePackageUiRuntime()` must keep matching `AppInternalModules` keys.
 */
const PACKAGE_UI_INTERNAL_SHIMS: Record<PackageUiInternalModuleSpecifier, { sourceFile: string; fallback: string[] }> = {
  '@/shared/ui': {
    sourceFile: 'src/shared/ui/index.ts',
    fallback: [
      'AppTableGrid',
      'GridPagingFooter',
      'AppButton',
      'ConfirmDialogShell',
      'CreateEditModalShell',
      'PhoneBadgeCircleButton',
      'PhoneNumberDisplay',
      'ToolbarFilterSelect',
      'WorkspaceBackIcon',
    ],
  },
  '@/shared/ui/HeroFieldControls': {
    sourceFile: 'src/shared/ui/HeroFieldControls.tsx',
    fallback: ['UiInput', 'UiSelect', 'UiTextarea'],
  },
  '@/shared/ui/DesignerFormFields': {
    sourceFile: 'src/shared/ui/DesignerFormFields.tsx',
    fallback: ['DesignerCodeEditorField', 'DesignerHtmlEditorField', 'DesignerMarkdownEditorField'],
  },
  '@/domain/component-designer/DesignerRuntimeAppTableGrid': {
    sourceFile: 'src/domain/component-designer/DesignerRuntimeAppTableGrid.tsx',
    fallback: ['buildAppTableGridColumns'],
  },
  '@/domain/component-designer/designerGridToolbarConfig': {
    sourceFile: 'src/domain/component-designer/designerGridToolbarConfig.ts',
    fallback: ['applyDesignerGridToolbarClientFilters'],
  },
  '@/domain/component-designer/previewFieldValidation': {
    sourceFile: 'src/domain/component-designer/previewFieldValidation.ts',
    fallback: ['validateDesignerFieldNode'],
  },
  '@/app/platform/PlatformMountContext': {
    sourceFile: 'src/app/platform/PlatformMountContext.tsx',
    fallback: ['PlatformMountProvider', 'useOptionalPlatformMount', 'usePlatformMount'],
  },
  '@/app/platform/PortalContext': {
    sourceFile: 'src/app/platform/PortalContext.tsx',
    fallback: ['PortalContextProvider', 'useOptionalPortal', 'usePortal'],
  },
  '@/app/platform/PlatformConfigProvider': {
    sourceFile: 'src/app/platform/PlatformConfigProvider.tsx',
    fallback: ['PlatformConfigProvider', 'usePlatformConfig'],
  },
  '@/contexts/AuthContext': {
    sourceFile: 'src/contexts/AuthContext.tsx',
    fallback: ['AuthProvider', 'useAuth', 'useClientContext', 'usePatchClientContext'],
  },
  '@/contexts/AccentThemeContext': {
    sourceFile: 'src/contexts/AccentThemeContext.tsx',
    fallback: ['AccentThemeProvider', 'useAccentTheme', 'bootstrapAccentTheme', 'getAccentPreviewTokens'],
  },
  '@/contexts/GridColumnLayoutsContext': {
    sourceFile: 'src/contexts/GridColumnLayoutsContext.tsx',
    fallback: ['GridColumnLayoutsProvider', 'useGridColumnLayouts', 'useOptionalGridColumnLayouts'],
  },
  '@/shared/lib/useViewportTier': {
    sourceFile: 'src/shared/lib/useViewportTier.ts',
    fallback: ['ViewportTierProvider', 'useViewportTier'],
  },
  '@/core/culture/CultureContext': {
    sourceFile: 'src/core/culture/CultureContext.tsx',
    fallback: ['CultureContext', 'CultureProvider', 'useCulture', 'useOptionalCulture', 'useCultureT', 'useOptionalCultureT'],
  },
  '@/layouts/adminShell/ShellHeaderOverrideContext': {
    sourceFile: 'src/layouts/adminShell/ShellHeaderOverrideContext.tsx',
    fallback: ['ShellHeaderOverrideProvider', 'useShellHeaderOverrideState', 'useShellHeaderOverride'],
  },
  '@/shared/ui/hwy/hwyGeoResponsibilityInlineListDialogApi': {
    sourceFile: 'src/shared/ui/hwy/hwyGeoResponsibilityInlineListDialogApi.tsx',
    fallback: [
      'HwyGeoResponsibilityInlineListDialogProvider',
      'useOpenHwyGeoResponsibilityInlineListDialog',
    ],
  },
};

const KNOWN_HEAVY_INTERNAL_MODULES: Record<string, string[]> = Object.fromEntries(
  Object.entries(PACKAGE_UI_INTERNAL_SHIMS).map(([specifier, spec]) => [
    specifier,
    namedExportsFromSourceFile(spec.sourceFile, spec.fallback),
  ]),
);

for (const [specifier, namedExports] of Object.entries(KNOWN_HEAVY_INTERNAL_MODULES)) {
  const lines = [
    'const __runtime = globalThis.__APPENDO_PACKAGE_RUNTIME__;',
    `const __mod = __runtime?.AppInternalModules?.[${JSON.stringify(specifier)}];`,
    'if (!__mod) {',
    "  throw new Error('Package UI runtime is not initialized. Reload the app and try again.');",
    '}',
    `export const {\n  ${namedExports.join(',\n  ')},\n} = __mod;`,
  ];
  GLOBAL_MODULE_BY_SPECIFIER.set(specifier, lines.join('\n'));
}

function buildHeavyInternalShimPathIndex(): Map<string, string> {
  const index = new Map<string, string>();
  const projectRoot = process.cwd();
  for (const [specifier, spec] of Object.entries(PACKAGE_UI_INTERNAL_SHIMS)) {
    const absPath = path.resolve(projectRoot, spec.sourceFile);
    index.set(path.normalize(absPath), specifier);
    if (/[/\\]index\.[cm]?[jt]sx?$/i.test(spec.sourceFile)) {
      index.set(path.normalize(path.dirname(absPath)), specifier);
    }
  }
  return index;
}

const HEAVY_INTERNAL_SHIM_PATHS = buildHeavyInternalShimPathIndex();

function resolveAppImportFromAlias(specifier: string): string | null {
  if (!specifier.startsWith('@/')) {
    return null;
  }
  const srcRoot = path.join(process.cwd(), 'src');
  return resolveExistingModulePath(path.join(srcRoot, specifier.slice(2)));
}

function resolveExistingModulePath(basePath: string): string | null {
  const extensions = ['', '.tsx', '.ts', '.jsx', '.js'];
  for (const ext of extensions) {
    const candidate = ext ? `${basePath}${ext}` : basePath;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.normalize(candidate);
    }
  }
  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
      const indexCandidate = path.join(basePath, `index${ext}`);
      if (fs.existsSync(indexCandidate)) {
        return path.normalize(indexCandidate);
      }
    }
    return path.normalize(basePath);
  }
  return null;
}

function shimSpecifierForResolvedPath(resolvedPath: string): string | undefined {
  return HEAVY_INTERNAL_SHIM_PATHS.get(path.normalize(resolvedPath));
}

const COMPILE_CACHE_EPOCH = 9;
const compileCache = new Map<string, { epoch: number; inputs: Record<string, number>; code: string }>();

export function clearPackageUiCompileCache(): void {
  compileCache.clear();
}

function collectInputMtimes(metafile: esbuild.Metafile | undefined): Record<string, number> {
  const inputs: Record<string, number> = {};
  if (!metafile) {
    return inputs;
  }
  for (const file of Object.keys(metafile.inputs)) {
    const absPath = path.resolve(file);
    try {
      inputs[absPath] = fs.statSync(absPath).mtimeMs;
    } catch {
      // Missing inputs invalidate on the next lookup.
    }
  }
  return inputs;
}

function isCompileCacheFresh(epoch: number, inputs: Record<string, number>): boolean {
  if (epoch !== COMPILE_CACHE_EPOCH || Object.keys(inputs).length === 0) {
    return false;
  }
  for (const [file, mtimeMs] of Object.entries(inputs)) {
    try {
      if (fs.statSync(file).mtimeMs !== mtimeMs) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

function createPackageUiCssInjectPlugin(): esbuild.Plugin {
  return {
    name: 'appendo-package-ui-css-inject',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, (args) => {
        const css = fs.readFileSync(args.path, 'utf8');
        const id = `pkg-css-${createHash('sha1').update(args.path).digest('hex').slice(0, 12)}`;
        return {
          loader: 'js',
          contents: [
            `const id = ${JSON.stringify(id)};`,
            'if (typeof document !== "undefined" && !document.getElementById(id)) {',
            '  const el = document.createElement("style");',
            '  el.id = id;',
            `  el.textContent = ${JSON.stringify(css)};`,
            '  document.head.appendChild(el);',
            '}',
            'export default {};',
          ].join('\n'),
        };
      });
    },
  };
}

function createPackageUiAliasPlugin(): esbuild.Plugin {
  const srcRoot = path.join(process.cwd(), 'src');
  const extensions = ['.tsx', '.ts', '.jsx', '.js'];

  return {
    name: 'appendo-package-ui-alias',
    setup(build) {
      build.onResolve({ filter: /^\./ }, (args) => {
        const resolved = resolveExistingModulePath(path.resolve(args.resolveDir, args.path));
        if (!resolved) {
          return undefined;
        }
        const specifier = shimSpecifierForResolvedPath(resolved);
        if (!specifier) {
          return undefined;
        }
        return { path: specifier, namespace: PACKAGE_UI_GLOBAL_NS };
      });

      build.onResolve({ filter: /^@\// }, (args) => {
        if (args.path in KNOWN_HEAVY_INTERNAL_MODULES) {
          return { path: args.path, namespace: PACKAGE_UI_GLOBAL_NS };
        }

        const basePath = path.join(srcRoot, args.path.slice(2));
        for (const ext of extensions) {
          const candidate = `${basePath}${ext}`;
          if (fs.existsSync(candidate)) {
            return { path: candidate };
          }
        }

        if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
          for (const ext of extensions) {
            const indexCandidate = path.join(basePath, `index${ext}`);
            if (fs.existsSync(indexCandidate)) {
              return { path: indexCandidate };
            }
          }
        }

        return { path: basePath };
      });
    },
  };
}

function createPackageUiGlobalReactPlugin(): esbuild.Plugin {
  return {
    name: 'appendo-package-ui-globals',
    setup(build) {
      build.onResolve({ filter: /^(react(?:\/jsx(?:-dev)?-runtime)?|react-dom|react-router-dom|@heroui\/react|@tanstack\/react-query)$/ }, (args) => ({
        path: args.path,
        namespace: PACKAGE_UI_GLOBAL_NS,
      }));

      build.onLoad({ filter: /.*/, namespace: PACKAGE_UI_GLOBAL_NS }, (args) => {
        const contents = GLOBAL_MODULE_BY_SPECIFIER.get(args.path);
        if (!contents) {
          return {
            errors: [{ text: `Unsupported package UI global module "${args.path}".` }],
          };
        }
        return { contents, loader: 'js' };
      });
    },
  };
}

export async function compilePackageUiModuleSource(
  source: string,
  options: { entryPath: string; resolveDir: string },
): Promise<string> {
  const compiled = await compilePackageUiModuleSourceWithInputs(source, options);
  return compiled.code;
}

async function compilePackageUiModuleSourceWithInputs(
  source: string,
  options: { entryPath: string; resolveDir: string },
): Promise<{ code: string; inputs: Record<string, number> }> {
  await ensureLibraryGlobalModulesReady();

  const prepared = rewriteDefaultReExportFromNamedOnlyModule(
    ensurePackageUiModuleDefaultExport(source),
    (importPath) => {
      const resolved = resolveAppImportFromAlias(importPath);
      if (!resolved) {
        return null;
      }
      try {
        return fs.readFileSync(resolved, 'utf8');
      } catch {
        return null;
      }
    },
  );
  const loader = options.entryPath.endsWith('.tsx')
    ? 'tsx'
    : options.entryPath.endsWith('.ts')
      ? 'ts'
      : 'js';

  const result = await esbuild.build({
    stdin: {
      contents: prepared,
      loader,
      resolveDir: options.resolveDir,
      sourcefile: path.basename(options.entryPath),
    },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    jsx: 'automatic',
    write: false,
    metafile: true,
    // Package modules load via blob URL (not Vite); `import.meta.env` is otherwise undefined at runtime.
    define: {
      'import.meta.env.DEV': 'false',
      'import.meta.env.PROD': 'true',
      'import.meta.env.MODE': '"production"',
    },
    // Font files stay empty (binary @font-face). CSS is inlined as a style tag so
    // package widgets like xterm can ship their own stylesheet.
    loader: {
      '.woff': 'empty',
      '.woff2': 'empty',
      '.ttf': 'empty',
      '.eot': 'empty',
      '.otf': 'empty',
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.jpeg': 'dataurl',
      '.gif': 'dataurl',
      '.webp': 'dataurl',
      '.svg': 'dataurl',
    },
    plugins: [
      createPackageUiCssInjectPlugin(),
      createPackageUiAliasPlugin(),
      createPackageUiGlobalReactPlugin(),
    ],
    nodePaths: [path.join(process.cwd(), 'packages-storage', 'libs', 'node_modules')],
  });

  const output = result.outputFiles[0]?.text;
  if (!output) {
    throw new Error('Package UI module compilation produced no output.');
  }

  return {
    code: output,
    inputs: collectInputMtimes(result.metafile),
  };
}

export async function compilePackageUiModuleFile(
  absPath: string,
  mtimeMs: number,
): Promise<string> {
  const cacheKey = absPath;
  const cached = compileCache.get(cacheKey);
  if (cached && isCompileCacheFresh(cached.epoch, cached.inputs)) {
    return cached.code;
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const prebuilt = unwrapPackageUiPrebuiltModule(source);
  if (prebuilt) {
    const fileMtimeMs = mtimeMs || fs.statSync(absPath).mtimeMs;
    compileCache.set(cacheKey, { epoch: COMPILE_CACHE_EPOCH, inputs: { [absPath]: fileMtimeMs }, code: prebuilt });
    return prebuilt;
  }

  const compiled = await compilePackageUiModuleSourceWithInputs(source, {
    entryPath: absPath,
    resolveDir: path.dirname(absPath),
  });
  compileCache.set(cacheKey, { epoch: COMPILE_CACHE_EPOCH, inputs: compiled.inputs, code: compiled.code });
  return compiled.code;
}
