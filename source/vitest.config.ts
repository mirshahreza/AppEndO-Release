import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';
import { remoteHubClientLibsPlugin } from './scripts/vite/remoteHubClientLibsPlugin';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: repoRoot,
  plugins: [remoteHubClientLibsPlugin()],
  resolve: {
    alias: {
      'virtual:pwa-register': path.join(repoRoot, 'src/test/mocks/virtualPwaRegister.ts'),
    },
  },
  test: {
    setupFiles: ['src/test/vitest.setup.ts'],
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.tsx',
      'scripts/release-cut/__tests__/**/*.test.ts',
    ],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
