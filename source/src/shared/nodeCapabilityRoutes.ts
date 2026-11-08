import type { NodeCapability } from './nodeCapabilities';
import { hasNodeCapability } from './nodeCapabilities';

const normalizeApiRelativePath = (path: string): string => {
  const withoutQuery = path.split('?')[0] || '/';
  const trimmed = withoutQuery.startsWith('/api')
    ? withoutQuery.slice(4) || '/'
    : withoutQuery;
  if (trimmed.length > 1 && trimmed.endsWith('/')) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
};

type CapabilityRouteRule = {
  test: (apiRelativePath: string, method: string) => boolean;
  capabilities: NodeCapability[];
};

const matchesPrefix = (apiRelativePath: string, prefix: string): boolean => (
  apiRelativePath === prefix || apiRelativePath.startsWith(`${prefix}/`)
);

const PACKAGE_RUNTIME_PATH = /^\/packages\/[^/]+\/(assets|ui)(\/|$)/;

/** Routes that every node serves regardless of capabilities. */
const isUniversalApiRoute = (apiRelativePath: string, method: string): boolean => {
  if (
    apiRelativePath === '/health'
    || apiRelativePath === '/ready'
    || apiRelativePath === '/boot'
    || apiRelativePath.startsWith('/install')
    || apiRelativePath === '/project-standards'
    || apiRelativePath === '/pwa/config'
    || apiRelativePath.startsWith('/auth/')
  ) {
    return true;
  }

  if (apiRelativePath === '/platform/runtime-config') {
    return true;
  }

  if (apiRelativePath === '/platform/cultures' && method === 'GET') {
    return true;
  }

  if (method === 'GET' && matchesPrefix(apiRelativePath, '/cms-site')) {
    return true;
  }

  return false;
};

const CAPABILITY_ROUTE_RULES: CapabilityRouteRule[] = [
  {
    test: (path) => matchesPrefix(path, '/jobs'),
    capabilities: ['worker'],
  },
  {
    test: (path) => matchesPrefix(path, '/scheduler'),
    capabilities: ['worker'],
  },
  {
    test: (path) => PACKAGE_RUNTIME_PATH.test(path),
    capabilities: ['service', 'platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/packages'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/package'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/platform'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/settings'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/settings-attributes'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/users'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/data-api'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/functions'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/core'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/component-designer'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/appearance'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/workflows'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/cache'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/git'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/logs'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/docs'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/slots'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/dashboard'),
    capabilities: ['platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/profile'),
    capabilities: ['service', 'platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/base-info'),
    capabilities: ['service', 'platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/ai'),
    capabilities: ['service', 'platform'],
  },
  {
    test: (path) => matchesPrefix(path, '/mcp'),
    capabilities: ['platform'],
  },
];

export type ApiRouteCapabilityResolution = {
  required: NodeCapability[];
} | {
  required: null;
};

export const resolveApiRouteCapabilities = (
  pathname: string,
  method = 'GET',
): ApiRouteCapabilityResolution => {
  const apiRelativePath = normalizeApiRelativePath(pathname);
  const normalizedMethod = method.toUpperCase();

  if (isUniversalApiRoute(apiRelativePath, normalizedMethod)) {
    return { required: null };
  }

  for (const rule of CAPABILITY_ROUTE_RULES) {
    if (rule.test(apiRelativePath, normalizedMethod)) {
      return { required: rule.capabilities };
    }
  }

  return { required: ['service'] };
};

export const nodeSatisfiesRouteCapabilities = (
  activeCapabilities: readonly NodeCapability[],
  required: readonly NodeCapability[] | null,
): boolean => {
  if (!required || required.length === 0) {
    return true;
  }

  return required.some((capability) => hasNodeCapability(activeCapabilities, capability));
};

export const buildNodeCapabilityDeniedMessage = (
  required: readonly NodeCapability[],
): string => (
  `This node does not provide the required capability (${required.join(' or ')}). `
  + 'Configure APPENDO_NODE_CAPABILITIES on the correct node.'
);
