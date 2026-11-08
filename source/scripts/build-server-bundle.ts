import esbuild from 'esbuild';
import path from 'node:path';

const root = process.cwd();
const shims = path.join(root, 'scripts', 'server-bundle-shims');
const genericStub = path.join(shims, 'generic-stub.cjs');

/** ESM-only or browser-only deps pulled in by bundled designer/runtime TSX — never executed on the server process. */
const CLIENT_STUB_PACKAGES = new Set([
  '@heroui/react',
  '@heroui/styles',
  'react-router-dom',
  'tiptap-markdown',
  '@tiptap/react',
  '@tiptap/starter-kit',
  '@monaco-editor/react',
  'monaco-editor',
  '@fortune-sheet/react',
  'echarts',
  'echarts/core',
  'react-dom/client',
]);

const CLIENT_STUB_PREFIXES = [
  '@tiptap/',
  '@fullcalendar/',
  '@fortune-sheet/',
];

const isClientStubPackage = (name: string): boolean => {
  if (CLIENT_STUB_PACKAGES.has(name)) {
    return true;
  }
  return CLIENT_STUB_PREFIXES.some((prefix) => name.startsWith(prefix));
};

const run = async (): Promise<void> => {
  await esbuild.build({
    entryPoints: [path.join(root, 'src', 'server', 'index.ts')],
    outfile: path.join(root, 'dist', 'server.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    sourcemap: true,
    logLevel: 'info',
    alias: {
      '@heroui/react': path.join(shims, 'heroui-react.cjs'),
      '@heroui/styles': path.join(shims, 'heroui-react.cjs'),
      'react-router-dom': path.join(shims, 'react-router-dom.cjs'),
    },
    loader: {
      '.css': 'empty',
      '.png': 'file',
      '.jpg': 'file',
      '.jpeg': 'file',
      '.gif': 'file',
      '.webp': 'file',
      '.svg': 'file',
    },
    define: {
      'import.meta.env.PROD': 'true',
      'import.meta.env.DEV': 'false',
    },
    plugins: [
      {
        name: 'client-package-stubs',
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            if (args.namespace !== 'file' && args.namespace !== '') {
              return undefined;
            }
            if (args.path.startsWith('.') || args.path.startsWith('/')) {
              return undefined;
            }
            if (!isClientStubPackage(args.path)) {
              return undefined;
            }
            return { path: genericStub };
          });
        },
      },
    ],
  });
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[build-server-bundle] Failed:', message);
  process.exit(1);
});
