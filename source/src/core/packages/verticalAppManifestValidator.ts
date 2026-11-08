/**
 * Validates vertical-app package manifests ($schemaVersion 1.1).
 */

import { appendMarketplaceIdentityProviderManifestErrors } from '../identity/marketplaceIdentityProviderPolicy';
import { appendMarketplaceCulturePackManifestErrors } from '../culture/marketplaceCulturePackPolicy';
import { validatePackageMcpGlobalId } from './mcpServerIds';
import { validateExperienceManifest } from '../../shared/api/contracts/platform/experienceManifest';
import type { VerticalAppManifest } from '../../shared/api/contracts/package-manifest/verticalApp';
import {
  appendManifestAuditFieldErrors,
  type AnyPackageManifest,
  type ManifestValidationResult,
} from './PackageManifestValidator';
import { appendPackageLibrariesFieldErrors } from './developerLibraries';

const PLUGIN_ID_RE = /^[a-z][a-z0-9-]{2,63}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const OBJECT_NAME_RE = /^[a-z][a-z0-9_]{1,127}$/;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
const PAGE_KEY_RE = /^[a-z][a-z0-9-]{1,63}$/;
const SHELL_KEY_RE = /^[a-z][a-z0-9-]{1,63}$/;
const ASSET_KEY_RE = /^[a-z][a-z0-9-]{1,63}$/;

const VALID_HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const VALID_AUTH_VALUES = new Set(['public', 'authenticated', 'admin']);
const VALID_OVERRIDE_VALUES = new Set(['allow', 'deny']);
const VALID_OBJ_TYPES = new Set(['table', 'view', 'index', 'function', 'trigger', 'seed']);
const VALID_MCP_TRANSPORTS = new Set(['stdio', 'sse', 'http']);
const MCP_LOCAL_ID_RE = /^[a-z0-9][a-z0-9-]{0,30}$/;

const KNOWN_TOP_LEVEL_KEYS = new Set([
  '$schemaVersion', 'kind', 'id', 'name', 'version', 'description',
  'createdAt', 'createdBy',
  'requiredAppVersion', 'dependencies', 'libraries', 'branding', 'experience', 'capabilities', 'deployment',
  'overridePolicy', 'integrity', 'extensionType', 'systemExtensionType',
]);

function isSafeRelativePath(p: unknown): p is string {
  if (typeof p !== 'string' || !p.trim()) return false;
  if (p.includes('..')) return false;
  if (p.startsWith('/') || /^[a-zA-Z]:/.test(p)) return false;
  return true;
}

function normalizePathPrefix(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return null;
  if (trimmed.length > 1 && trimmed.endsWith('/')) return null;
  return trimmed;
}

export function validateVerticalAppManifest(raw: unknown): ManifestValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['package.json must be a JSON object.'], manifest: null };
  }

  const m = raw as Record<string, unknown>;

  for (const key of Object.keys(m)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
      if (key === 'author') {
        errors.push('author is no longer supported; use createdBy instead.');
      } else {
        errors.push(`Unknown top-level field: "${key}".`);
      }
    }
  }

  if (m.$schemaVersion !== '1.1' && m.$schemaVersion !== '1.2' && m.$schemaVersion !== '1.3') {
    errors.push('$schemaVersion must be "1.1", "1.2", or "1.3" for vertical-app manifests.');
  }

  if (m.kind !== 'vertical-app') {
    errors.push('kind must be "vertical-app".');
  }

  if (typeof m.id !== 'string' || !PLUGIN_ID_RE.test(m.id)) {
    errors.push('id must match ^[a-z][a-z0-9-]{2,63}$.');
  }

  appendMarketplaceIdentityProviderManifestErrors(m, errors);
  appendMarketplaceCulturePackManifestErrors(m, errors);

  if (m.experience !== undefined) {
    if (m.$schemaVersion !== '1.2' && m.$schemaVersion !== '1.3') {
      errors.push('experience block requires $schemaVersion "1.2" or "1.3".');
    } else {
      // This file validates vertical-app PACKAGE manifests exclusively (kind must be
      // 'vertical-app', enforced above) — never a full platform manifest. The built-in
      // home/studio/component-alone portal requirement is documented on
      // ValidateExperienceManifestOptions as "Full manifests require [them]. Package
      // extensions do not." — matches the existing validatePackageExtensionPortals() helper
      // used for the same purpose elsewhere in experienceManifest.ts.
      const experienceValidation = validateExperienceManifest(m.experience, { requireBuiltInPortals: false });
      if (!experienceValidation.valid) {
        errors.push(...('errors' in experienceValidation
          ? experienceValidation.errors.map((item) => `experience.${item}`)
          : ['experience.validation failed']));
      }
    }
  }

  if (typeof m.name !== 'string' || m.name.trim().length < 3 || m.name.length > 100) {
    errors.push('name must be 3–100 characters.');
  }

  if (typeof m.version !== 'string' || !SEMVER_RE.test(m.version)) {
    errors.push('version must be valid SemVer (x.y.z).');
  }

  appendManifestAuditFieldErrors(m, errors);

  if (typeof m.requiredAppVersion !== 'string' || !m.requiredAppVersion.trim()) {
    errors.push('requiredAppVersion is required and must be a non-empty string.');
  }

  appendPackageLibrariesFieldErrors(m.libraries, errors);

  const pageKeys = new Set<string>();
  const designerSlugs = new Set<string>();
  const designerShellKeys = new Set<string>();
  const assetKeys = new Set<string>();
  let shellKey: string | null = null;

  if (!m.capabilities || typeof m.capabilities !== 'object' || Array.isArray(m.capabilities)) {
    errors.push('capabilities must be an object.');
  } else {
    const cap = m.capabilities as Record<string, unknown>;

    if (!cap.shell || typeof cap.shell !== 'object' || Array.isArray(cap.shell)) {
      errors.push('capabilities.shell is required.');
    } else {
      const shell = cap.shell as Record<string, unknown>;
      if (typeof shell.key !== 'string' || !SHELL_KEY_RE.test(shell.key)) {
        errors.push('capabilities.shell.key must match ^[a-z][a-z0-9-]{1,63}$.');
      } else {
        shellKey = shell.key;
      }
      if (typeof shell.name !== 'string' || !shell.name.trim()) {
        errors.push('capabilities.shell.name is required.');
      }
      if (!isSafeRelativePath(shell.entry)) {
        errors.push('capabilities.shell.entry must be a safe relative path.');
      }
      if (typeof shell.surface !== 'string' || !shell.surface.trim()) {
        errors.push('capabilities.shell.surface is required.');
      }
    }

    if (cap.pages !== undefined) {
      if (!Array.isArray(cap.pages)) {
        errors.push('capabilities.pages must be an array.');
      } else {
        (cap.pages as unknown[]).forEach((page, i) => {
          if (!page || typeof page !== 'object' || Array.isArray(page)) {
            errors.push(`capabilities.pages[${i}] must be an object.`);
            return;
          }
          const p = page as Record<string, unknown>;
          if (typeof p.pageKey !== 'string' || !PAGE_KEY_RE.test(p.pageKey)) {
            errors.push(`capabilities.pages[${i}].pageKey must match ^[a-z][a-z0-9-]{1,63}$.`);
          } else if (pageKeys.has(p.pageKey)) {
            errors.push(`capabilities.pages[${i}].pageKey "${p.pageKey}" is duplicated.`);
          } else {
            pageKeys.add(p.pageKey);
          }
          if (typeof p.title !== 'string' || !p.title.trim()) {
            errors.push(`capabilities.pages[${i}].title is required.`);
          }
          if (!isSafeRelativePath(p.entry)) {
            errors.push(`capabilities.pages[${i}].entry must be a safe relative path.`);
          }
        });
      }
    }

    if (cap.designer_layouts !== undefined) {
      if (!Array.isArray(cap.designer_layouts)) {
        errors.push('capabilities.designer_layouts must be an array.');
      } else {
        (cap.designer_layouts as unknown[]).forEach((layout, i) => {
          if (!layout || typeof layout !== 'object' || Array.isArray(layout)) {
            errors.push(`capabilities.designer_layouts[${i}] must be an object.`);
            return;
          }
          const l = layout as Record<string, unknown>;
          if (typeof l.slug !== 'string' || !PAGE_KEY_RE.test(l.slug)) {
            errors.push(`capabilities.designer_layouts[${i}].slug must match ^[a-z][a-z0-9-]{1,63}$.`);
          } else if (designerSlugs.has(l.slug)) {
            errors.push(`capabilities.designer_layouts[${i}].slug "${l.slug}" is duplicated.`);
          } else {
            designerSlugs.add(l.slug);
          }
          if (typeof l.title !== 'string' || !l.title.trim()) {
            errors.push(`capabilities.designer_layouts[${i}].title is required.`);
          }
          if (!isSafeRelativePath(l.entry)) {
            errors.push(`capabilities.designer_layouts[${i}].entry must be a safe relative path.`);
          }
        });
      }
    }

    if (cap.designer_shells !== undefined) {
      if (m.$schemaVersion !== '1.3') {
        errors.push('capabilities.designer_shells requires $schemaVersion "1.3".');
      }
      if (!Array.isArray(cap.designer_shells)) {
        errors.push('capabilities.designer_shells must be an array.');
      } else {
        (cap.designer_shells as unknown[]).forEach((designerShell, i) => {
          if (!designerShell || typeof designerShell !== 'object' || Array.isArray(designerShell)) {
            errors.push(`capabilities.designer_shells[${i}] must be an object.`);
            return;
          }
          const item = designerShell as Record<string, unknown>;
          if (typeof item.shellKey !== 'string' || !SHELL_KEY_RE.test(item.shellKey)) {
            errors.push(`capabilities.designer_shells[${i}].shellKey must match ^[a-z][a-z0-9-]{1,63}$.`);
          } else if (designerShellKeys.has(item.shellKey)) {
            errors.push(`capabilities.designer_shells[${i}].shellKey "${item.shellKey}" is duplicated.`);
          } else {
            designerShellKeys.add(item.shellKey);
          }
          if (typeof item.title !== 'string' || !item.title.trim()) {
            errors.push(`capabilities.designer_shells[${i}].title is required.`);
          }
          if (!isSafeRelativePath(item.entry)) {
            errors.push(`capabilities.designer_shells[${i}].entry must be a safe relative path.`);
          }
        });
      }
    }

    if (pageKeys.size === 0 && designerSlugs.size === 0 && designerShellKeys.size === 0) {
      errors.push('At least one pages, designer_layouts, or designer_shells capability is required.');
    }

    if (cap.static_assets !== undefined) {
      if (!Array.isArray(cap.static_assets)) {
        errors.push('capabilities.static_assets must be an array.');
      } else {
        (cap.static_assets as unknown[]).forEach((asset, i) => {
          if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
            errors.push(`capabilities.static_assets[${i}] must be an object.`);
            return;
          }
          const a = asset as Record<string, unknown>;
          if (typeof a.assetKey !== 'string' || !ASSET_KEY_RE.test(a.assetKey)) {
            errors.push(`capabilities.static_assets[${i}].assetKey must match ^[a-z][a-z0-9-]{1,63}$.`);
          } else if (assetKeys.has(a.assetKey)) {
            errors.push(`capabilities.static_assets[${i}].assetKey "${a.assetKey}" is duplicated.`);
          } else {
            assetKeys.add(a.assetKey);
          }
          if (!isSafeRelativePath(a.path)) {
            errors.push(`capabilities.static_assets[${i}].path must be a safe relative path.`);
          }
        });
      }
    }

    if (!Array.isArray(cap.apis)) {
      errors.push('capabilities.apis must be an array.');
    } else {
      const apiKeys = new Set<string>();
      (cap.apis as unknown[]).forEach((api, i) => {
        if (!api || typeof api !== 'object' || Array.isArray(api)) {
          errors.push(`capabilities.apis[${i}] must be an object.`);
          return;
        }
        const a = api as Record<string, unknown>;
        if (typeof a.id !== 'string' || !a.id.trim()) {
          errors.push(`capabilities.apis[${i}].id is required.`);
        }
        if (typeof a.method !== 'string' || !VALID_HTTP_METHODS.has(a.method)) {
          errors.push(`capabilities.apis[${i}].method must be GET|POST|PUT|PATCH|DELETE.`);
        }
        if (
          typeof a.path !== 'string'
          || (!a.path.startsWith('/packages/') && !a.path.startsWith('/api/'))
        ) {
          errors.push(`capabilities.apis[${i}].path must start with /packages/ or /api/.`);
        }
        if (!isSafeRelativePath(a.entry)) {
          errors.push(`capabilities.apis[${i}].entry must be a safe relative path.`);
        }
        if (a.auth !== undefined && (typeof a.auth !== 'string' || !VALID_AUTH_VALUES.has(a.auth))) {
          errors.push(`capabilities.apis[${i}].auth must be public|authenticated|admin.`);
        }
        const key = `${a.method}:${a.path}`;
        if (apiKeys.has(key)) errors.push(`capabilities.apis[${i}]: duplicate method+path "${key}".`);
        apiKeys.add(key);
      });
    }

    if (!Array.isArray(cap.db_objects)) {
      errors.push('capabilities.db_objects must be an array.');
    } else {
      const dbKeys = new Set<string>();
      (cap.db_objects as unknown[]).forEach((obj, i) => {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
          errors.push(`capabilities.db_objects[${i}] must be an object.`);
          return;
        }
        const o = obj as Record<string, unknown>;
        if (typeof o.objectType !== 'string' || !VALID_OBJ_TYPES.has(o.objectType)) {
          errors.push(`capabilities.db_objects[${i}].objectType must be table|view|index|function|trigger|seed.`);
        }
        if (typeof o.objectName !== 'string' || !OBJECT_NAME_RE.test(o.objectName)) {
          errors.push(`capabilities.db_objects[${i}].objectName must match ^[a-z][a-z0-9_]{1,127}$.`);
        }
        if (!isSafeRelativePath(o.installScript)) {
          errors.push(`capabilities.db_objects[${i}].installScript is required and must be a safe relative path.`);
        }
        const key = `${o.objectType}::${o.objectName}`;
        if (dbKeys.has(key)) errors.push(`capabilities.db_objects[${i}]: duplicate objectType+objectName "${key}".`);
        dbKeys.add(key);
      });
    }

    if (cap.mcp_servers !== undefined && !Array.isArray(cap.mcp_servers)) {
      errors.push('capabilities.mcp_servers must be an array.');
    } else {
      const mcpServers = Array.isArray(cap.mcp_servers) ? cap.mcp_servers as unknown[] : [];
      const mcpLocalIds = new Set<string>();
      const packageIdForMcp = typeof m.id === 'string' ? m.id : '';
      mcpServers.forEach((server, i) => {
        if (!server || typeof server !== 'object' || Array.isArray(server)) {
          errors.push(`capabilities.mcp_servers[${i}] must be an object.`);
          return;
        }
        const s = server as Record<string, unknown>;
        const localId = typeof s.id === 'string' ? s.id.trim() : '';
        if (!localId || !MCP_LOCAL_ID_RE.test(localId)) {
          errors.push(`capabilities.mcp_servers[${i}].id must match ^[a-z0-9][a-z0-9-]{0,30}$.`);
        } else {
          if (mcpLocalIds.has(localId)) {
            errors.push(`capabilities.mcp_servers[${i}].id "${localId}" is duplicated.`);
          }
          mcpLocalIds.add(localId);
          if (packageIdForMcp) {
            const globalIdError = validatePackageMcpGlobalId(
              packageIdForMcp,
              localId,
              `capabilities.mcp_servers[${i}]`,
            );
            if (globalIdError) errors.push(globalIdError);
          }
        }
        if (typeof s.label !== 'string' || !s.label.trim()) {
          errors.push(`capabilities.mcp_servers[${i}].label is required.`);
        }
        const transport = typeof s.transport === 'string' ? s.transport : '';
        if (!VALID_MCP_TRANSPORTS.has(transport)) {
          errors.push(`capabilities.mcp_servers[${i}].transport must be stdio, sse, or http.`);
        }
      });
    }
  }

  if (m.branding !== undefined) {
    if (!m.branding || typeof m.branding !== 'object' || Array.isArray(m.branding)) {
      errors.push('branding must be an object.');
    } else {
      const branding = m.branding as Record<string, unknown>;
      if (branding.logoAssetKey !== undefined) {
        const logoKey = typeof branding.logoAssetKey === 'string' ? branding.logoAssetKey : '';
        if (!assetKeys.has(logoKey)) {
          errors.push('branding.logoAssetKey must reference a capabilities.static_assets.assetKey.');
        }
      }
    }
  }

  if (!m.deployment || typeof m.deployment !== 'object' || Array.isArray(m.deployment)) {
    errors.push('deployment is required.');
  } else {
    const deployment = m.deployment as Record<string, unknown>;
    if (deployment.applyPolicy !== 'propose' && deployment.applyPolicy !== 'auto') {
      errors.push('deployment.applyPolicy must be "propose" or "auto".');
    }

    if (!deployment.mount || typeof deployment.mount !== 'object' || Array.isArray(deployment.mount)) {
      errors.push('deployment.mount is required.');
    } else {
      const mount = deployment.mount as Record<string, unknown>;
      if (typeof mount.id !== 'string' || !PLUGIN_ID_RE.test(mount.id)) {
        errors.push('deployment.mount.id must match ^[a-z][a-z0-9-]{2,63}$.');
      }
      if (typeof mount.pathPrefix !== 'string' || !normalizePathPrefix(mount.pathPrefix)) {
        errors.push('deployment.mount.pathPrefix must start with / and must not end with /.');
      }
      if (typeof mount.name !== 'string' || !mount.name.trim()) {
        errors.push('deployment.mount.name is required.');
      }
      if (typeof mount.defaultRoute !== 'string' || !mount.defaultRoute.trim()) {
        errors.push('deployment.mount.defaultRoute is required.');
      }
    }

    if (!deployment.shellRule || typeof deployment.shellRule !== 'object' || Array.isArray(deployment.shellRule)) {
      errors.push('deployment.shellRule is required.');
    } else {
      const shellRule = deployment.shellRule as Record<string, unknown>;
      if (typeof shellRule.shellKey !== 'string' || !SHELL_KEY_RE.test(shellRule.shellKey)) {
        errors.push('deployment.shellRule.shellKey must match ^[a-z][a-z0-9-]{1,63}$.');
      } else if (shellKey && shellRule.shellKey !== shellKey) {
        errors.push('deployment.shellRule.shellKey must equal capabilities.shell.key.');
      }
      if (typeof shellRule.pathPrefix !== 'string' || !normalizePathPrefix(shellRule.pathPrefix)) {
        errors.push('deployment.shellRule.pathPrefix must start with / and must not end with /.');
      }
    }

    if (!Array.isArray(deployment.routes)) {
      errors.push('deployment.pages must be an array.');
    } else if ((deployment.routes as unknown[]).length === 0 && designerShellKeys.size === 0) {
      errors.push('deployment.pages must contain at least one route.');
    } else {
      const routeKeys = new Set<string>();
      (deployment.routes as unknown[]).forEach((route, i) => {
        if (!route || typeof route !== 'object' || Array.isArray(route)) {
          errors.push(`deployment.pages[${i}] must be an object.`);
          return;
        }
        const r = route as Record<string, unknown>;
        if (typeof r.routePattern !== 'string' || !r.routePattern.trim()) {
          errors.push(`deployment.pages[${i}].routePattern is required.`);
        }
        if (typeof r.pageKey !== 'string' || !PAGE_KEY_RE.test(r.pageKey)) {
          errors.push(`deployment.pages[${i}].pageKey must match ^[a-z][a-z0-9-]{1,63}$.`);
        } else if (!pageKeys.has(r.pageKey) && !designerSlugs.has(r.pageKey)) {
          errors.push(`deployment.pages[${i}].pageKey "${r.pageKey}" must exist in pages or designer_layouts.`);
        }
        const routeKey = String(r.routePattern);
        if (routeKeys.has(routeKey)) {
          errors.push(`deployment.pages[${i}].routePattern "${routeKey}" is duplicated.`);
        }
        routeKeys.add(routeKey);
      });
    }
  }

  if (!m.overridePolicy || typeof m.overridePolicy !== 'object' || Array.isArray(m.overridePolicy)) {
    errors.push('overridePolicy must be an object.');
  } else {
    const op = m.overridePolicy as Record<string, unknown>;
    for (const key of ['apis', 'db_objects'] as const) {
      if (!VALID_OVERRIDE_VALUES.has(op[key] as string)) {
        errors.push(`overridePolicy.${key} must be "allow" or "deny".`);
      }
    }
    if (op.mcp_servers !== undefined && !VALID_OVERRIDE_VALUES.has(op.mcp_servers as string)) {
      errors.push('overridePolicy.mcp_servers must be "allow" or "deny".');
    }
  }

  if (!m.integrity || typeof m.integrity !== 'object' || Array.isArray(m.integrity)) {
    errors.push('integrity must be an object.');
  } else {
    const integ = m.integrity as Record<string, unknown>;
    if (integ.algorithm !== 'sha256') {
      errors.push('integrity.algorithm must be "sha256".');
    }
    if (typeof integ.artifactHash !== 'string' || !SHA256_HEX_RE.test(integ.artifactHash)) {
      errors.push('integrity.artifactHash must be a 64-character lowercase hex string.');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, manifest: null };
  }

  const cap = m.capabilities as Record<string, unknown>;
  const normalizedCapabilities: VerticalAppManifest['capabilities'] = {
    shell: cap.shell as VerticalAppManifest['capabilities']['shell'],
    pages: Array.isArray(cap.pages) ? (cap.pages as VerticalAppManifest['capabilities']['pages']) : [],
    apis: Array.isArray(cap.apis) ? (cap.apis as VerticalAppManifest['capabilities']['apis']) : [],
    db_objects: Array.isArray(cap.db_objects)
      ? (cap.db_objects as VerticalAppManifest['capabilities']['db_objects'])
      : [],
    mcp_servers: Array.isArray(cap.mcp_servers)
      ? (cap.mcp_servers as VerticalAppManifest['capabilities']['mcp_servers'])
      : [],
  };
  if (Array.isArray(cap.designer_layouts)) {
    normalizedCapabilities.designer_layouts = cap.designer_layouts as VerticalAppManifest['capabilities']['designer_layouts'];
  }
  if (Array.isArray(cap.designer_shells)) {
    normalizedCapabilities.designer_shells = cap.designer_shells as VerticalAppManifest['capabilities']['designer_shells'];
  }
  if (Array.isArray(cap.static_assets)) {
    normalizedCapabilities.static_assets = cap.static_assets as VerticalAppManifest['capabilities']['static_assets'];
  }

  const normalizedManifest: VerticalAppManifest = {
    ...(m as unknown as VerticalAppManifest),
    capabilities: normalizedCapabilities,
  };

  return { valid: true, errors: [], manifest: normalizedManifest as AnyPackageManifest };
}
