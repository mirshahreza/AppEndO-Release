import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OPS_DASHBOARD_PAGE_KEYS,
  OPS_DASHBOARD_ROUTES,
} from '../../../../shared/lib/opsDashboardCatalog';

const registryRoot = path.join(process.cwd(), 'src/config/platform-registry');

describe('ops dashboard registry', () => {
  it('binds Insights pages as ADMIN with nav null', () => {
    for (const pageKey of OPS_DASHBOARD_PAGE_KEYS) {
      const route = OPS_DASHBOARD_ROUTES[pageKey];
      const modulePath = path.join(registryRoot, 'page-modules', `${pageKey}.json`);
      const pageModule = JSON.parse(fs.readFileSync(modulePath, 'utf8')) as {
        loaderKind: string;
        defaultRoles: string[];
        nav?: unknown;
      };
      expect(pageModule.loaderKind).toBe('designer');
      expect(pageModule.defaultRoles).toEqual(['ADMIN']);

      const bindingsDir = path.join(registryRoot, 'route-bindings');
      const binding = fs.readdirSync(bindingsDir)
        .map((fileName) => JSON.parse(fs.readFileSync(path.join(bindingsDir, fileName), 'utf8')) as {
          pageKey: string;
          routePattern: string;
          nav: unknown;
          auth: { allowRoles?: string[] } | null;
        })
        .find((item) => item.pageKey === pageKey && item.routePattern === route.pattern);

      expect(binding).toBeDefined();
      expect(binding?.nav).toBeNull();
      expect(binding?.auth?.allowRoles).toEqual(['ADMIN']);
    }
  });
});
