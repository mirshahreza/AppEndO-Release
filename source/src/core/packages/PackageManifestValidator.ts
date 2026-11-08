/**
 * PackageManifestValidator
 *
 * Validates a parsed package.json object against the MVP contract defined in
 * docs/architecture/artifacts.md
 *
 * Returns { valid, errors, manifest } — no side effects, pure function.
 */

import { appendMarketplaceIdentityProviderManifestErrors } from '../identity/marketplaceIdentityProviderPolicy';
import { appendPackageLibrariesFieldErrors, type PackageLibraryRequirement } from './developerLibraries';
import { appendMarketplaceCulturePackManifestErrors } from '../culture/marketplaceCulturePackPolicy';
import type { ExtensionUiRouteCapability } from '../../shared/api/contracts/package-manifest/extensionUiRoutes';
import type { VerticalAppManifest } from '../../shared/api/contracts/package-manifest/verticalApp';
import { validatePackageMcpGlobalId } from './mcpServerIds';
import { validateVerticalAppManifest } from './verticalAppManifestValidator';

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

export interface CapabilityApi {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  entry: string;
  timeoutMs?: number;
  auth?: 'public' | 'authenticated' | 'admin';
}

export interface CapabilityUiComponent {
  componentKey: string;
  slotId: string;
  entry: string;
  order?: number;
  propsSchemaRef?: string;
  draftEntry?: string;
}

export interface CapabilityUiRoute {
  pageKey: string;
  entry: string;
  suggestedRoutePattern?: string;
  suggestedMountId?: string;
}

export interface CapabilityPortal {
  segment: string;
  entry: string;
}

export interface CapabilityNavigation {
  id: string;
  entry: string;
}

export interface CapabilityDbObject {
  objectType: 'table' | 'view' | 'index' | 'function' | 'trigger' | 'seed';
  objectName: string;
  installScript: string;
  uninstallScript?: string;
  seedScript?: string;
  targetDataSource?: string;
  /** Required seed/schema always installs. Optional seed is installer-chosen initial records. */
  installMode?: 'required' | 'optional';
}

export interface CapabilityEdgeModel {
  id: string;
  entry: string;
}

export interface CapabilityEdgeApi {
  id: string;
  edgeModelId: string;
  entry: string;
}

export interface CapabilityEdgeModelStudioMeta {
  edgeModelId: string;
  entry: string;
}

export interface CapabilityScopeDimension {
  key: string;
  entry: string;
}

export interface CapabilityRecordPolicy {
  id: string;
  edgeModelId: string;
  entry: string;
}

export interface CapabilityRecordPolicyBinding {
  edgeModelId: string;
  entry: string;
}

export interface CapabilityQuerySurfaceBinding {
  edgeModelId: string;
  entry: string;
}

export interface CapabilityWorkflow {
  scopeKey: string;
  key: string;
  entry: string;
}

/**
 * p-99/WFT-1 — a package-contributed workflow Action. `definitionEntry` points to a JSON
 * `ActionDefinition` (validated + `contributor`/`availability` forced server-side, never trusted
 * from the package); `scriptEntry` points to a TS/JS source whose default export is
 * `async (ctx: {config, input}) => output` — executed in the same `vm` sandbox as install hooks
 * and package API handlers (see `packageActionSandboxExecutor.ts`), never `require()`d natively.
 */
export interface CapabilityWorkflowAction {
  key: string;
  version: string;
  definitionEntry: string;
  scriptEntry: string;
}

export interface CapabilityInstallHook {
  id: string;
  entry: string;
  timeoutMs?: number;
}

export interface CapabilityNavigationPatch {
  navigationId: string;
  entry: string;
}

export interface CapabilityCultureKeys {
  entry: string;
}

export interface CapabilityHomePortal {
  entry: string;
}

export interface CapabilityMcpServer {
  id: string;
  label: string;
  enabled?: boolean;
  transport: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  allowedTools?: string[];
  note?: string;
}

export interface PackageManifest {
  $schemaVersion: string;
  id: string;
  name: string;
  version: string;
  description?: string;
  createdAt?: string;
  createdBy?: string;
  requiredAppVersion: string;
  dependencies?: Array<{ packageId: string; versionRange?: string }>;
  libraries?: PackageLibraryRequirement[];
  capabilities: {
    apis: CapabilityApi[];
    ui_components: CapabilityUiComponent[];
    ui_routes?: CapabilityUiRoute[];
    portals?: CapabilityPortal[];
    navigations?: CapabilityNavigation[];
    designer_shells?: Array<{ shellKey: string; title: string; entry: string }>;
    db_objects: CapabilityDbObject[];
    mcp_servers: CapabilityMcpServer[];
    edge_models: CapabilityEdgeModel[];
    edge_apis: CapabilityEdgeApi[];
    edge_model_studio_meta: CapabilityEdgeModelStudioMeta[];
    scope_dimensions?: CapabilityScopeDimension[];
    record_policies?: CapabilityRecordPolicy[];
    record_policy_bindings?: CapabilityRecordPolicyBinding[];
    query_surface_bindings?: CapabilityQuerySurfaceBinding[];
    workflows?: CapabilityWorkflow[];
    workflow_actions?: CapabilityWorkflowAction[];
    install_hooks: CapabilityInstallHook[];
    navigation_patches?: CapabilityNavigationPatch[];
    culture_keys?: CapabilityCultureKeys[];
    home_portal?: CapabilityHomePortal[];
  };
  overridePolicy: {
    apis: 'allow' | 'deny';
    ui_components: 'allow' | 'deny';
    db_objects: 'allow' | 'deny';
    mcp_servers?: 'allow' | 'deny';
  };
  integrity: {
    algorithm: 'sha256';
    artifactHash: string;
  };
}

export type AnyPackageManifest = PackageManifest | VerticalAppManifest;

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
  manifest: AnyPackageManifest | null;
}

export function isVerticalAppManifest(manifest: AnyPackageManifest): manifest is VerticalAppManifest {
  return (manifest as VerticalAppManifest).kind === 'vertical-app'
    || manifest.$schemaVersion === '1.1'
    || manifest.$schemaVersion === '1.2';
}

// ---------------------------------------------------------------------------
// Constant rule sets
// ---------------------------------------------------------------------------

const PLUGIN_ID_RE = /^[a-z][a-z0-9-]{2,63}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const OBJECT_NAME_RE = /^[a-z][a-z0-9_]{1,127}$/;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

const VALID_HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const VALID_AUTH_VALUES = new Set(['public', 'authenticated', 'admin']);
const VALID_OVERRIDE_VALUES = new Set(['allow', 'deny']);
const VALID_OBJ_TYPES = new Set(['table', 'view', 'index', 'function', 'trigger', 'seed']);
const VALID_MCP_TRANSPORTS = new Set(['stdio', 'sse', 'http']);
const MCP_LOCAL_ID_RE = /^[a-z0-9][a-z0-9-]{0,30}$/;
const UI_ROUTE_PAGE_KEY_RE = /^[a-z][a-z0-9._-]{2,63}$/;
const EDGE_ID_RE = /^[a-z][a-z0-9_]{1,63}$/;
const KNOWN_CAPABILITY_KEYS = new Set([
  'apis', 'ui_components', 'ui_routes', 'portals', 'navigations', 'db_objects', 'mcp_servers',
  'edge_models', 'edge_apis', 'edge_model_studio_meta',
  'scope_dimensions', 'record_policies', 'record_policy_bindings', 'query_surface_bindings',
  'workflows', 'workflow_actions', 'install_hooks', 'designer_shells', 'navigation_patches',
  'culture_keys', 'home_portal',
]);
const KNOWN_DESIGNER_SHELL_KEYS = new Set(['shellKey', 'title', 'entry']);
const KNOWN_PORTAL_KEYS = new Set(['segment', 'entry']);
const KNOWN_NAVIGATION_KEYS = new Set(['id', 'entry']);
const KNOWN_UI_ROUTE_KEYS = new Set([
  'pageKey', 'entry', 'suggestedRoutePattern', 'suggestedMountId',
]);
const KNOWN_EDGE_MODEL_KEYS = new Set(['id', 'entry']);
const KNOWN_EDGE_API_KEYS = new Set(['id', 'edgeModelId', 'entry']);
const KNOWN_EDGE_MODEL_STUDIO_META_KEYS = new Set(['edgeModelId', 'entry']);
const KNOWN_SCOPE_DIMENSION_KEYS = new Set(['key', 'entry']);
const KNOWN_RECORD_POLICY_KEYS = new Set(['id', 'edgeModelId', 'entry']);
const KNOWN_RECORD_POLICY_BINDING_KEYS = new Set(['edgeModelId', 'entry']);
const KNOWN_QUERY_SURFACE_BINDING_KEYS = new Set(['edgeModelId', 'entry']);
const KNOWN_WORKFLOW_KEYS = new Set(['scopeKey', 'key', 'entry']);
const KNOWN_WORKFLOW_ACTION_KEYS = new Set(['key', 'version', 'definitionEntry', 'scriptEntry']);
const ACTION_KEY_RE = /^[a-z][a-z0-9.-]{1,127}$/;
const ACTION_VERSION_RE = /^\d+(\.\d+){0,2}$/;
const DIMENSION_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const KNOWN_INSTALL_HOOK_KEYS = new Set(['id', 'entry', 'timeoutMs']);
const KNOWN_NAVIGATION_PATCH_KEYS = new Set(['navigationId', 'entry']);
const KNOWN_CULTURE_KEYS_KEYS = new Set(['entry']);
const KNOWN_HOME_PORTAL_KEYS = new Set(['entry']);
const KNOWN_TOP_LEVEL_KEYS = new Set([
  '$schemaVersion', 'id', 'name', 'version', 'description',
  'createdAt', 'createdBy',
  'requiredAppVersion', 'dependencies', 'libraries', 'capabilities', 'overridePolicy', 'integrity',
  'extensionType', 'systemExtensionType',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSafeRelativePath(p: unknown): p is string {
  if (typeof p !== 'string' || !p.trim()) return false;
  if (p.includes('..')) return false;
  if (p.startsWith('/') || /^[a-zA-Z]:/.test(p)) return false;
  return true;
}

export function normalizeArtifactManifestForValidation(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const m = { ...(raw as Record<string, unknown>) };
  delete m.createdAt;
  delete m.createdBy;
  delete m.author;
  return m;
}

function isIsoDateTimeString(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  return Number.isFinite(Date.parse(value.trim()));
}

export function appendManifestAuditFieldErrors(m: Record<string, unknown>, errors: string[]): void {
  if (m.createdAt !== undefined) {
    if (!isIsoDateTimeString(m.createdAt)) {
      errors.push('createdAt must be a valid ISO-8601 date-time string.');
    }
  }
  if (m.createdBy !== undefined) {
    if (typeof m.createdBy !== 'string' || m.createdBy.length > 200) {
      errors.push('createdBy must be a string up to 200 characters.');
    }
  }
}

export function stampManifestAuditFields<T extends { createdAt?: string; createdBy?: string }>(
  manifest: T,
  actor: string,
  uploadedAt: string,
  options?: { createdBy?: string | null },
): T & { createdAt: string; createdBy: string } {
  const createdAt = manifest.createdAt?.trim() && isIsoDateTimeString(manifest.createdAt)
    ? manifest.createdAt.trim()
    : uploadedAt;
  const createdBy = options?.createdBy?.trim() || manifest.createdBy?.trim() || actor;
  return { ...manifest, createdAt, createdBy };
}

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

export function validateManifest(raw: unknown): ManifestValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['package.json must be a JSON object.'], manifest: null };
  }

  const m = raw as Record<string, unknown>;
  const kind = typeof m.kind === 'string' ? m.kind : 'extension';
  if (kind === 'vertical-app' || m.$schemaVersion === '1.1' || m.$schemaVersion === '1.2') {
    return validateVerticalAppManifest(raw);
  }

  return validateExtensionManifest(raw);
}

function validateExtensionManifest(raw: unknown): ManifestValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['package.json must be a JSON object.'], manifest: null };
  }

  const m = raw as Record<string, unknown>;

  // --- No unknown top-level keys ---
  for (const key of Object.keys(m)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
      if (key === 'author') {
        errors.push('author is no longer supported; use createdBy instead.');
      } else {
        errors.push(`Unknown top-level field: "${key}".`);
      }
    }
  }

  // --- $schemaVersion ---
  if (m.$schemaVersion !== '1.0') {
    errors.push('$schemaVersion must be "1.0".');
  }

  // --- id ---
  if (typeof m.id !== 'string' || !PLUGIN_ID_RE.test(m.id)) {
    errors.push('id must match ^[a-z][a-z0-9-]{2,63}$.');
  }

  appendMarketplaceIdentityProviderManifestErrors(m, errors);
  appendMarketplaceCulturePackManifestErrors(m, errors);

  // --- name ---
  if (typeof m.name !== 'string' || m.name.trim().length < 3 || m.name.length > 100) {
    errors.push('name must be 3–100 characters.');
  }

  // --- version ---
  if (typeof m.version !== 'string' || !SEMVER_RE.test(m.version)) {
    errors.push('version must be valid SemVer (x.y.z).');
  }

  // --- description (optional) ---
  if (m.description !== undefined) {
    if (typeof m.description !== 'string' || m.description.length > 1000) {
      errors.push('description must be a string up to 1000 characters.');
    }
  }

  appendManifestAuditFieldErrors(m, errors);

  // --- requiredAppVersion (optional — empty means no app version constraint) ---
  if (m.requiredAppVersion !== undefined && typeof m.requiredAppVersion !== 'string') {
    errors.push('requiredAppVersion must be a string when provided.');
  }

  // --- dependencies (optional) ---
  if (m.dependencies !== undefined) {
    if (!Array.isArray(m.dependencies)) {
      errors.push('dependencies must be an array.');
    } else {
      const depIds = new Set<string>();
      (m.dependencies as unknown[]).forEach((dep, i) => {
        if (!dep || typeof dep !== 'object' || Array.isArray(dep)) {
          errors.push(`dependencies[${i}] must be an object.`);
          return;
        }
        const d = dep as Record<string, unknown>;
        if (typeof d.packageId !== 'string' || !PLUGIN_ID_RE.test(d.packageId)) {
          errors.push(`dependencies[${i}].packageId must match ^[a-z][a-z0-9-]{2,63}$.`);
        } else {
          if (depIds.has(d.packageId)) {
            errors.push(`dependencies[${i}].packageId "${d.packageId}" is duplicated.`);
          }
          depIds.add(d.packageId);
        }
        if (d.versionRange !== undefined && typeof d.versionRange !== 'string') {
          errors.push(`dependencies[${i}].versionRange must be a string when provided.`);
        }
      });
    }
  }

  appendPackageLibrariesFieldErrors(m.libraries, errors);

  // --- capabilities ---
  if (!m.capabilities || typeof m.capabilities !== 'object' || Array.isArray(m.capabilities)) {
    errors.push('capabilities must be an object.');
  } else {
    const cap = m.capabilities as Record<string, unknown>;

    for (const key of Object.keys(cap)) {
      if (!KNOWN_CAPABILITY_KEYS.has(key)) {
        errors.push(`Unknown capabilities field: "${key}".`);
      }
    }

    // apis
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
          errors.push(`capabilities.apis[${i}].entry must be a safe relative path (no ".." or absolute).`);
        }
        if (a.timeoutMs !== undefined) {
          if (typeof a.timeoutMs !== 'number' || a.timeoutMs < 1000 || a.timeoutMs > 60000) {
            errors.push(`capabilities.apis[${i}].timeoutMs must be between 1000 and 60000.`);
          }
        }
        if (a.auth !== undefined) {
          if (typeof a.auth !== 'string' || !VALID_AUTH_VALUES.has(a.auth)) {
            errors.push(`capabilities.apis[${i}].auth must be public|authenticated|admin.`);
          }
        }
        const key = `${a.method}:${a.path}`;
        if (apiKeys.has(key)) errors.push(`capabilities.apis[${i}]: duplicate method+path "${key}".`);
        apiKeys.add(key);
      });
    }

    // ui_components
    if (!Array.isArray(cap.ui_components)) {
      errors.push('capabilities.ui_components must be an array.');
    } else {
      const uiKeys = new Set<string>();
      (cap.ui_components as unknown[]).forEach((comp, i) => {
        if (!comp || typeof comp !== 'object' || Array.isArray(comp)) {
          errors.push(`capabilities.ui_components[${i}] must be an object.`);
          return;
        }
        const c = comp as Record<string, unknown>;
        if (typeof c.componentKey !== 'string' || !c.componentKey.trim()) {
          errors.push(`capabilities.ui_components[${i}].componentKey is required.`);
        }
        if (typeof c.slotId !== 'string' || !c.slotId.trim()) {
          errors.push(`capabilities.ui_components[${i}].slotId is required.`);
        }
        if (!isSafeRelativePath(c.entry)) {
          errors.push(`capabilities.ui_components[${i}].entry must be a safe relative path.`);
        }
        if (c.order !== undefined) {
          if (typeof c.order !== 'number' || !Number.isInteger(c.order) || c.order < 0 || c.order > 10000) {
            errors.push(`capabilities.ui_components[${i}].order must be an integer 0–10000.`);
          }
        }
        if (c.propsSchemaRef !== undefined && !isSafeRelativePath(c.propsSchemaRef)) {
          errors.push(`capabilities.ui_components[${i}].propsSchemaRef must be a safe relative path.`);
        }
        if (c.draftEntry !== undefined && !isSafeRelativePath(c.draftEntry)) {
          errors.push(`capabilities.ui_components[${i}].draftEntry must be a safe relative path.`);
        }
        const key = `${c.slotId}::${c.componentKey}`;
        if (uiKeys.has(key)) errors.push(`capabilities.ui_components[${i}]: duplicate slotId+componentKey "${key}".`);
        uiKeys.add(key);
      });
    }

    // ui_routes
    if (cap.ui_routes !== undefined && !Array.isArray(cap.ui_routes)) {
      errors.push('capabilities.ui_pages must be an array.');
    } else if (Array.isArray(cap.ui_routes)) {
      const routeKeys = new Set<string>();
      (cap.ui_routes as unknown[]).forEach((route, i) => {
        if (!route || typeof route !== 'object' || Array.isArray(route)) {
          errors.push(`capabilities.ui_routes[${i}] must be an object.`);
          return;
        }
        const r = route as Record<string, unknown>;
        for (const key of Object.keys(r)) {
          if (!KNOWN_UI_ROUTE_KEYS.has(key)) {
            errors.push(`capabilities.ui_routes[${i}]: unknown field "${key}".`);
          }
        }
        if (typeof r.pageKey !== 'string' || !UI_ROUTE_PAGE_KEY_RE.test(r.pageKey)) {
          errors.push(`capabilities.ui_routes[${i}].pageKey must match ^[a-z][a-z0-9._-]{2,63}$.`);
        } else if (routeKeys.has(r.pageKey)) {
          errors.push(`capabilities.ui_routes[${i}].pageKey "${r.pageKey}" is duplicated.`);
        } else {
          routeKeys.add(r.pageKey);
        }
        if (!isSafeRelativePath(r.entry)) {
          errors.push(`capabilities.ui_routes[${i}].entry must be a safe relative path.`);
        }
        if (r.suggestedRoutePattern !== undefined) {
          const pattern = typeof r.suggestedRoutePattern === 'string' ? r.suggestedRoutePattern.trim() : '';
          if (!pattern || pattern.includes('..')) {
            errors.push(`capabilities.ui_routes[${i}].suggestedRoutePattern must be a non-empty safe path.`);
          }
        }
        if (r.suggestedMountId !== undefined) {
          if (typeof r.suggestedMountId !== 'string' || !PLUGIN_ID_RE.test(r.suggestedMountId)) {
            errors.push(`capabilities.ui_routes[${i}].suggestedMountId must match mount id pattern.`);
          }
        }
      });
    }

    // portals
    if (cap.portals !== undefined && !Array.isArray(cap.portals)) {
      errors.push('capabilities.portals must be an array.');
    } else if (Array.isArray(cap.portals)) {
      const portalSegments = new Set<string>();
      (cap.portals as unknown[]).forEach((portal, i) => {
        if (!portal || typeof portal !== 'object' || Array.isArray(portal)) {
          errors.push(`capabilities.portals[${i}] must be an object.`);
          return;
        }
        const p = portal as Record<string, unknown>;
        for (const key of Object.keys(p)) {
          if (!KNOWN_PORTAL_KEYS.has(key)) {
            errors.push(`capabilities.portals[${i}]: unknown field "${key}".`);
          }
        }
        const segment = typeof p.segment === 'string' ? p.segment.trim() : '';
        if (!segment) {
          errors.push(`capabilities.portals[${i}].segment is required.`);
        } else if (portalSegments.has(segment)) {
          errors.push(`capabilities.portals[${i}].segment "${segment}" is duplicated.`);
        } else {
          portalSegments.add(segment);
        }
        if (!isSafeRelativePath(p.entry)) {
          errors.push(`capabilities.portals[${i}].entry must be a safe relative path.`);
        }
      });
    }

    // navigations
    if (cap.navigations !== undefined && !Array.isArray(cap.navigations)) {
      errors.push('capabilities.navigations must be an array.');
    } else if (Array.isArray(cap.navigations)) {
      const navigationIds = new Set<string>();
      (cap.navigations as unknown[]).forEach((navigation, i) => {
        if (!navigation || typeof navigation !== 'object' || Array.isArray(navigation)) {
          errors.push(`capabilities.navigations[${i}] must be an object.`);
          return;
        }
        const n = navigation as Record<string, unknown>;
        for (const key of Object.keys(n)) {
          if (!KNOWN_NAVIGATION_KEYS.has(key)) {
            errors.push(`capabilities.navigations[${i}]: unknown field "${key}".`);
          }
        }
        const id = typeof n.id === 'string' ? n.id.trim() : '';
        if (!id) {
          errors.push(`capabilities.navigations[${i}].id is required.`);
        } else if (navigationIds.has(id)) {
          errors.push(`capabilities.navigations[${i}].id "${id}" is duplicated.`);
        } else {
          navigationIds.add(id);
        }
        if (!isSafeRelativePath(n.entry)) {
          errors.push(`capabilities.navigations[${i}].entry must be a safe relative path.`);
        }
      });
    }

    // designer_shells (Shell Designer–owned portal-layout drafts)
    if (cap.designer_shells !== undefined && !Array.isArray(cap.designer_shells)) {
      errors.push('capabilities.designer_shells must be an array.');
    } else if (Array.isArray(cap.designer_shells)) {
      const shellKeys = new Set<string>();
      (cap.designer_shells as unknown[]).forEach((shell, i) => {
        if (!shell || typeof shell !== 'object' || Array.isArray(shell)) {
          errors.push(`capabilities.designer_shells[${i}] must be an object.`);
          return;
        }
        const s = shell as Record<string, unknown>;
        for (const key of Object.keys(s)) {
          if (!KNOWN_DESIGNER_SHELL_KEYS.has(key)) {
            errors.push(`capabilities.designer_shells[${i}]: unknown field "${key}".`);
          }
        }
        const shellKey = typeof s.shellKey === 'string' ? s.shellKey.trim() : '';
        const title = typeof s.title === 'string' ? s.title.trim() : '';
        if (!shellKey) {
          errors.push(`capabilities.designer_shells[${i}].shellKey is required.`);
        } else if (shellKeys.has(shellKey)) {
          errors.push(`capabilities.designer_shells[${i}].shellKey "${shellKey}" is duplicated.`);
        } else {
          shellKeys.add(shellKey);
        }
        if (!title) {
          errors.push(`capabilities.designer_shells[${i}].title is required.`);
        }
        if (!isSafeRelativePath(s.entry)) {
          errors.push(`capabilities.designer_shells[${i}].entry must be a safe relative path.`);
        }
      });
    }

    // edge_models
    const edgeModelIds = new Set<string>();
    if (cap.edge_models !== undefined && !Array.isArray(cap.edge_models)) {
      errors.push('capabilities.edge_models must be an array.');
    } else if (Array.isArray(cap.edge_models)) {
      (cap.edge_models as unknown[]).forEach((item, i) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`capabilities.edge_models[${i}] must be an object.`);
          return;
        }
        const e = item as Record<string, unknown>;
        for (const key of Object.keys(e)) {
          if (!KNOWN_EDGE_MODEL_KEYS.has(key)) {
            errors.push(`capabilities.edge_models[${i}]: unknown field "${key}".`);
          }
        }
        const id = typeof e.id === 'string' ? e.id.trim() : '';
        if (!id || !EDGE_ID_RE.test(id)) {
          errors.push(`capabilities.edge_models[${i}].id is required and must match ^[a-z][a-z0-9_]{1,63}$.`);
        } else if (edgeModelIds.has(id)) {
          errors.push(`capabilities.edge_models[${i}].id "${id}" is duplicated.`);
        } else {
          edgeModelIds.add(id);
        }
        if (!isSafeRelativePath(e.entry)) {
          errors.push(`capabilities.edge_models[${i}].entry must be a safe relative path.`);
        }
      });
    }

    // edge_apis
    if (cap.edge_apis !== undefined && !Array.isArray(cap.edge_apis)) {
      errors.push('capabilities.edge_apis must be an array.');
    } else if (Array.isArray(cap.edge_apis)) {
      const edgeApiIds = new Set<string>();
      (cap.edge_apis as unknown[]).forEach((item, i) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`capabilities.edge_apis[${i}] must be an object.`);
          return;
        }
        const e = item as Record<string, unknown>;
        for (const key of Object.keys(e)) {
          if (!KNOWN_EDGE_API_KEYS.has(key)) {
            errors.push(`capabilities.edge_apis[${i}]: unknown field "${key}".`);
          }
        }
        const id = typeof e.id === 'string' ? e.id.trim() : '';
        if (!id || !EDGE_ID_RE.test(id)) {
          errors.push(`capabilities.edge_apis[${i}].id is required and must match ^[a-z][a-z0-9_]{1,63}$.`);
        } else if (edgeApiIds.has(id)) {
          errors.push(`capabilities.edge_apis[${i}].id "${id}" is duplicated.`);
        } else {
          edgeApiIds.add(id);
        }
        const edgeModelId = typeof e.edgeModelId === 'string' ? e.edgeModelId.trim() : '';
        if (!edgeModelId || !EDGE_ID_RE.test(edgeModelId)) {
          errors.push(`capabilities.edge_apis[${i}].edgeModelId is required and must match ^[a-z][a-z0-9_]{1,63}$.`);
        } else if (!edgeModelIds.has(edgeModelId)) {
          errors.push(`capabilities.edge_apis[${i}].edgeModelId "${edgeModelId}" must reference a capabilities.edge_models[].id declared in this manifest.`);
        }
        if (!isSafeRelativePath(e.entry)) {
          errors.push(`capabilities.edge_apis[${i}].entry must be a safe relative path.`);
        }
      });
    }

    // edge_model_studio_meta
    if (cap.edge_model_studio_meta !== undefined && !Array.isArray(cap.edge_model_studio_meta)) {
      errors.push('capabilities.edge_model_studio_meta must be an array.');
    } else if (Array.isArray(cap.edge_model_studio_meta)) {
      const metaModelIds = new Set<string>();
      (cap.edge_model_studio_meta as unknown[]).forEach((item, i) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`capabilities.edge_model_studio_meta[${i}] must be an object.`);
          return;
        }
        const e = item as Record<string, unknown>;
        for (const key of Object.keys(e)) {
          if (!KNOWN_EDGE_MODEL_STUDIO_META_KEYS.has(key)) {
            errors.push(`capabilities.edge_model_studio_meta[${i}]: unknown field "${key}".`);
          }
        }
        const edgeModelId = typeof e.edgeModelId === 'string' ? e.edgeModelId.trim() : '';
        if (!edgeModelId || !EDGE_ID_RE.test(edgeModelId)) {
          errors.push(`capabilities.edge_model_studio_meta[${i}].edgeModelId is required and must match ^[a-z][a-z0-9_]{1,63}$.`);
        } else if (metaModelIds.has(edgeModelId)) {
          errors.push(`capabilities.edge_model_studio_meta[${i}].edgeModelId "${edgeModelId}" is duplicated.`);
        } else if (!edgeModelIds.has(edgeModelId)) {
          errors.push(`capabilities.edge_model_studio_meta[${i}].edgeModelId "${edgeModelId}" must reference a capabilities.edge_models[].id declared in this manifest.`);
        } else {
          metaModelIds.add(edgeModelId);
        }
        if (!isSafeRelativePath(e.entry)) {
          errors.push(`capabilities.edge_model_studio_meta[${i}].entry must be a safe relative path.`);
        }
      });
    }

    // scope_dimensions (RPE-9)
    if (cap.scope_dimensions !== undefined && !Array.isArray(cap.scope_dimensions)) {
      errors.push('capabilities.scope_dimensions must be an array.');
    } else if (Array.isArray(cap.scope_dimensions)) {
      const dimKeys = new Set<string>();
      (cap.scope_dimensions as unknown[]).forEach((item, i) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`capabilities.scope_dimensions[${i}] must be an object.`);
          return;
        }
        const e = item as Record<string, unknown>;
        for (const key of Object.keys(e)) {
          if (!KNOWN_SCOPE_DIMENSION_KEYS.has(key)) {
            errors.push(`capabilities.scope_dimensions[${i}]: unknown field "${key}".`);
          }
        }
        const key = typeof e.key === 'string' ? e.key.trim() : '';
        if (!key || !DIMENSION_KEY_RE.test(key)) {
          errors.push(`capabilities.scope_dimensions[${i}].key is required and must be an identifier.`);
        } else if (dimKeys.has(key)) {
          errors.push(`capabilities.scope_dimensions[${i}].key "${key}" is duplicated.`);
        } else {
          dimKeys.add(key);
        }
        if (!isSafeRelativePath(e.entry)) {
          errors.push(`capabilities.scope_dimensions[${i}].entry must be a safe relative path.`);
        }
      });
    }

    // record_policies (RPE-9) — memberships are never packaged
    if (cap.record_policies !== undefined && !Array.isArray(cap.record_policies)) {
      errors.push('capabilities.record_policies must be an array.');
    } else if (Array.isArray(cap.record_policies)) {
      const policyIds = new Set<string>();
      (cap.record_policies as unknown[]).forEach((item, i) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`capabilities.record_policies[${i}] must be an object.`);
          return;
        }
        const e = item as Record<string, unknown>;
        for (const key of Object.keys(e)) {
          if (!KNOWN_RECORD_POLICY_KEYS.has(key)) {
            errors.push(`capabilities.record_policies[${i}]: unknown field "${key}".`);
          }
        }
        const id = typeof e.id === 'string' ? e.id.trim() : '';
        const edgeModelId = typeof e.edgeModelId === 'string' ? e.edgeModelId.trim() : '';
        if (!id) {
          errors.push(`capabilities.record_policies[${i}].id is required.`);
        } else if (policyIds.has(id)) {
          errors.push(`capabilities.record_policies[${i}].id "${id}" is duplicated.`);
        } else {
          policyIds.add(id);
        }
        if (!edgeModelId || !EDGE_ID_RE.test(edgeModelId)) {
          errors.push(`capabilities.record_policies[${i}].edgeModelId is required and must match edge model id pattern.`);
        } else if (edgeModelIds.size > 0 && !edgeModelIds.has(edgeModelId)) {
          errors.push(`capabilities.record_policies[${i}].edgeModelId "${edgeModelId}" must reference a capabilities.edge_models[].id declared in this manifest.`);
        }
        if (!isSafeRelativePath(e.entry)) {
          errors.push(`capabilities.record_policies[${i}].entry must be a safe relative path.`);
        }
      });
    }

    if (cap.record_policy_bindings !== undefined && !Array.isArray(cap.record_policy_bindings)) {
      errors.push('capabilities.record_policy_bindings must be an array.');
    } else if (Array.isArray(cap.record_policy_bindings)) {
      const bindingModels = new Set<string>();
      (cap.record_policy_bindings as unknown[]).forEach((item, i) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`capabilities.record_policy_bindings[${i}] must be an object.`);
          return;
        }
        const e = item as Record<string, unknown>;
        for (const key of Object.keys(e)) {
          if (!KNOWN_RECORD_POLICY_BINDING_KEYS.has(key)) {
            errors.push(`capabilities.record_policy_bindings[${i}]: unknown field "${key}".`);
          }
        }
        const edgeModelId = typeof e.edgeModelId === 'string' ? e.edgeModelId.trim() : '';
        if (!edgeModelId || !EDGE_ID_RE.test(edgeModelId)) {
          errors.push(`capabilities.record_policy_bindings[${i}].edgeModelId is required and must match edge model id pattern.`);
        } else if (bindingModels.has(edgeModelId)) {
          errors.push(`capabilities.record_policy_bindings[${i}].edgeModelId "${edgeModelId}" is duplicated.`);
        } else if (edgeModelIds.size > 0 && !edgeModelIds.has(edgeModelId)) {
          errors.push(`capabilities.record_policy_bindings[${i}].edgeModelId "${edgeModelId}" must reference a capabilities.edge_models[].id declared in this manifest.`);
        } else {
          bindingModels.add(edgeModelId);
        }
        if (!isSafeRelativePath(e.entry)) {
          errors.push(`capabilities.record_policy_bindings[${i}].entry must be a safe relative path.`);
        }
      });
    }

    if (cap.query_surface_bindings !== undefined && !Array.isArray(cap.query_surface_bindings)) {
      errors.push('capabilities.query_surface_bindings must be an array.');
    } else if (Array.isArray(cap.query_surface_bindings)) {
      const bindingModels = new Set<string>();
      (cap.query_surface_bindings as unknown[]).forEach((item, i) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`capabilities.query_surface_bindings[${i}] must be an object.`);
          return;
        }
        const e = item as Record<string, unknown>;
        for (const key of Object.keys(e)) {
          if (!KNOWN_QUERY_SURFACE_BINDING_KEYS.has(key)) {
            errors.push(`capabilities.query_surface_bindings[${i}]: unknown field "${key}".`);
          }
        }
        const edgeModelId = typeof e.edgeModelId === 'string' ? e.edgeModelId.trim() : '';
        if (!edgeModelId || !EDGE_ID_RE.test(edgeModelId)) {
          errors.push(`capabilities.query_surface_bindings[${i}].edgeModelId is required and must match edge model id pattern.`);
        } else if (bindingModels.has(edgeModelId)) {
          errors.push(`capabilities.query_surface_bindings[${i}].edgeModelId "${edgeModelId}" is duplicated.`);
        } else if (edgeModelIds.size > 0 && !edgeModelIds.has(edgeModelId)) {
          errors.push(`capabilities.query_surface_bindings[${i}].edgeModelId "${edgeModelId}" must reference a capabilities.edge_models[].id declared in this manifest.`);
        } else {
          bindingModels.add(edgeModelId);
        }
        if (!isSafeRelativePath(e.entry)) {
          errors.push(`capabilities.query_surface_bindings[${i}].entry must be a safe relative path.`);
        }
      });
    }

    // workflows (WFV2-23)
    if (cap.workflows !== undefined && !Array.isArray(cap.workflows)) {
      errors.push('capabilities.workflows must be an array.');
    } else if (Array.isArray(cap.workflows)) {
      const workflowKeys = new Set<string>();
      (cap.workflows as unknown[]).forEach((item, i) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`capabilities.workflows[${i}] must be an object.`);
          return;
        }
        const w = item as Record<string, unknown>;
        for (const key of Object.keys(w)) {
          if (!KNOWN_WORKFLOW_KEYS.has(key)) {
            errors.push(`capabilities.workflows[${i}]: unknown field "${key}".`);
          }
        }
        const scopeKey = typeof w.scopeKey === 'string' && w.scopeKey.trim() ? w.scopeKey.trim() : 'global';
        const key = typeof w.key === 'string' ? w.key.trim() : '';
        if (!key || !/^[a-z0-9._-]+$/.test(key)) {
          errors.push(`capabilities.workflows[${i}].key must be a lowercase Latin slug.`);
        } else {
          const conflictKey = `${scopeKey}::${key}`;
          if (workflowKeys.has(conflictKey)) {
            errors.push(`capabilities.workflows[${i}]: duplicate scopeKey+key "${conflictKey}".`);
          } else {
            workflowKeys.add(conflictKey);
          }
        }
        if (!isSafeRelativePath(w.entry)) {
          errors.push(`capabilities.workflows[${i}].entry must be a safe relative path.`);
        }
      });
    }

    // workflow_actions (p-99/WFT-1)
    if (cap.workflow_actions !== undefined && !Array.isArray(cap.workflow_actions)) {
      errors.push('capabilities.workflow_actions must be an array.');
    } else if (Array.isArray(cap.workflow_actions)) {
      const actionKeys = new Set<string>();
      (cap.workflow_actions as unknown[]).forEach((item, i) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`capabilities.workflow_actions[${i}] must be an object.`);
          return;
        }
        const a = item as Record<string, unknown>;
        for (const key of Object.keys(a)) {
          if (!KNOWN_WORKFLOW_ACTION_KEYS.has(key)) {
            errors.push(`capabilities.workflow_actions[${i}]: unknown field "${key}".`);
          }
        }
        const key = typeof a.key === 'string' ? a.key.trim() : '';
        if (!key || !ACTION_KEY_RE.test(key)) {
          errors.push(`capabilities.workflow_actions[${i}].key must be a lowercase dotted slug, e.g. "namespace.do-thing".`);
        }
        const version = typeof a.version === 'string' ? a.version.trim() : '';
        if (!version || !ACTION_VERSION_RE.test(version)) {
          errors.push(`capabilities.workflow_actions[${i}].version must be a numeric version, e.g. "1".`);
        }
        if (key && version) {
          const conflictKey = `${key}@${version}`;
          if (actionKeys.has(conflictKey)) {
            errors.push(`capabilities.workflow_actions[${i}]: duplicate key+version "${conflictKey}".`);
          } else {
            actionKeys.add(conflictKey);
          }
        }
        if (!isSafeRelativePath(a.definitionEntry)) {
          errors.push(`capabilities.workflow_actions[${i}].definitionEntry must be a safe relative path.`);
        }
        if (!isSafeRelativePath(a.scriptEntry)) {
          errors.push(`capabilities.workflow_actions[${i}].scriptEntry must be a safe relative path.`);
        }
      });
    }

    // install_hooks
    if (cap.install_hooks !== undefined && !Array.isArray(cap.install_hooks)) {
      errors.push('capabilities.install_hooks must be an array.');
    } else if (Array.isArray(cap.install_hooks)) {
      const hooks = cap.install_hooks as unknown[];
      if (hooks.length > 1) {
        errors.push('capabilities.install_hooks may declare at most 1 hook.');
      }
      const hookIds = new Set<string>();
      hooks.forEach((item, i) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`capabilities.install_hooks[${i}] must be an object.`);
          return;
        }
        const h = item as Record<string, unknown>;
        for (const key of Object.keys(h)) {
          if (!KNOWN_INSTALL_HOOK_KEYS.has(key)) {
            errors.push(`capabilities.install_hooks[${i}]: unknown field "${key}".`);
          }
        }
        const id = typeof h.id === 'string' ? h.id.trim() : '';
        if (!id || !EDGE_ID_RE.test(id)) {
          errors.push(`capabilities.install_hooks[${i}].id is required and must match ^[a-z][a-z0-9_]{1,63}$.`);
        } else if (hookIds.has(id)) {
          errors.push(`capabilities.install_hooks[${i}].id "${id}" is duplicated.`);
        } else {
          hookIds.add(id);
        }
        if (!isSafeRelativePath(h.entry) || !(h.entry as string).endsWith('.ts')) {
          errors.push(`capabilities.install_hooks[${i}].entry must be a safe relative path ending in ".ts".`);
        }
        if (h.timeoutMs !== undefined) {
          if (typeof h.timeoutMs !== 'number' || h.timeoutMs < 1000 || h.timeoutMs > 60000) {
            errors.push(`capabilities.install_hooks[${i}].timeoutMs must be between 1000 and 60000.`);
          }
        }
      });
    }

    // navigation_patches (declarative Studio/nav group extras — not an install hook)
    if (cap.navigation_patches !== undefined && !Array.isArray(cap.navigation_patches)) {
      errors.push('capabilities.navigation_patches must be an array.');
    } else if (Array.isArray(cap.navigation_patches)) {
      const seenNavIds = new Set<string>();
      (cap.navigation_patches as unknown[]).forEach((item, i) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`capabilities.navigation_patches[${i}] must be an object.`);
          return;
        }
        const patch = item as Record<string, unknown>;
        for (const key of Object.keys(patch)) {
          if (!KNOWN_NAVIGATION_PATCH_KEYS.has(key)) {
            errors.push(`capabilities.navigation_patches[${i}]: unknown field "${key}".`);
          }
        }
        const navigationId = typeof patch.navigationId === 'string' ? patch.navigationId.trim() : '';
        if (!navigationId) {
          errors.push(`capabilities.navigation_patches[${i}].navigationId is required.`);
        } else if (seenNavIds.has(navigationId)) {
          errors.push(`capabilities.navigation_patches[${i}].navigationId "${navigationId}" is duplicated.`);
        } else {
          seenNavIds.add(navigationId);
        }
        if (!isSafeRelativePath(patch.entry)) {
          errors.push(`capabilities.navigation_patches[${i}].entry must be a safe relative path.`);
        }
      });
    }

    // culture_keys (English overlay for this package — not a culture-pack plugin)
    if (cap.culture_keys !== undefined && !Array.isArray(cap.culture_keys)) {
      errors.push('capabilities.culture_keys must be an array.');
    } else if (Array.isArray(cap.culture_keys)) {
      if (cap.culture_keys.length > 1) {
        errors.push('capabilities.culture_keys may declare at most 1 entry.');
      }
      (cap.culture_keys as unknown[]).forEach((item, i) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`capabilities.culture_keys[${i}] must be an object.`);
          return;
        }
        const row = item as Record<string, unknown>;
        for (const key of Object.keys(row)) {
          if (!KNOWN_CULTURE_KEYS_KEYS.has(key)) {
            errors.push(`capabilities.culture_keys[${i}]: unknown field "${key}".`);
          }
        }
        if (!isSafeRelativePath(row.entry)) {
          errors.push(`capabilities.culture_keys[${i}].entry must be a safe relative path.`);
        }
      });
    }

    // home_portal (claim built-in home-shell while installed — not capabilities.portals)
    if (cap.home_portal !== undefined && !Array.isArray(cap.home_portal)) {
      errors.push('capabilities.home_portal must be an array.');
    } else if (Array.isArray(cap.home_portal)) {
      if (cap.home_portal.length > 1) {
        errors.push('capabilities.home_portal may declare at most 1 entry.');
      }
      (cap.home_portal as unknown[]).forEach((item, i) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`capabilities.home_portal[${i}] must be an object.`);
          return;
        }
        const row = item as Record<string, unknown>;
        for (const key of Object.keys(row)) {
          if (!KNOWN_HOME_PORTAL_KEYS.has(key)) {
            errors.push(`capabilities.home_portal[${i}]: unknown field "${key}".`);
          }
        }
        if (!isSafeRelativePath(row.entry)) {
          errors.push(`capabilities.home_portal[${i}].entry must be a safe relative path.`);
        }
      });
    }

    // mcp_servers
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
        const command = typeof s.command === 'string' ? s.command.trim() : '';
        const url = typeof s.url === 'string' ? s.url.trim() : '';
        if (transport === 'stdio' && !command) {
          errors.push(`capabilities.mcp_servers[${i}] requires command for stdio transport.`);
        }
        if ((transport === 'sse' || transport === 'http') && !url) {
          errors.push(`capabilities.mcp_servers[${i}] requires url for ${transport} transport.`);
        }
        if (s.args !== undefined) {
          if (!Array.isArray(s.args) || s.args.some((arg) => typeof arg !== 'string')) {
            errors.push(`capabilities.mcp_servers[${i}].args must be a string array.`);
          }
        }
        if (s.allowedTools !== undefined) {
          if (!Array.isArray(s.allowedTools) || s.allowedTools.some((tool) => typeof tool !== 'string')) {
            errors.push(`capabilities.mcp_servers[${i}].allowedTools must be a string array.`);
          }
        }
        if (s.env !== undefined) {
          if (!s.env || typeof s.env !== 'object' || Array.isArray(s.env)) {
            errors.push(`capabilities.mcp_servers[${i}].env must be an object.`);
          }
        }
      });
    }

    // db_objects
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
        if (o.uninstallScript !== undefined && !isSafeRelativePath(o.uninstallScript)) {
          errors.push(`capabilities.db_objects[${i}].uninstallScript must be a safe relative path.`);
        }
        if (o.seedScript !== undefined && !isSafeRelativePath(o.seedScript)) {
          errors.push(`capabilities.db_objects[${i}].seedScript must be a safe relative path.`);
        }
        if (o.installMode !== undefined && o.installMode !== 'required' && o.installMode !== 'optional') {
          errors.push(`capabilities.db_objects[${i}].installMode must be required|optional.`);
        } else if (o.installMode === 'optional' && o.objectType !== 'seed') {
          errors.push(`capabilities.db_objects[${i}].installMode "optional" is only allowed when objectType is seed.`);
        }
        const key = `${o.objectType}::${o.objectName}`;
        if (dbKeys.has(key)) errors.push(`capabilities.db_objects[${i}]: duplicate objectType+objectName "${key}".`);
        dbKeys.add(key);
      });
    }

    // at least one non-empty capability
    const apisOk = Array.isArray(cap.apis);
    const uiOk = Array.isArray(cap.ui_components);
    const dbOk = Array.isArray(cap.db_objects);
    const mcpOk = cap.mcp_servers === undefined || Array.isArray(cap.mcp_servers);
    const mcpCount = mcpOk && Array.isArray(cap.mcp_servers) ? cap.mcp_servers.length : 0;
    const uiRoutesOk = cap.ui_routes === undefined || Array.isArray(cap.ui_routes);
    const uiRoutesCount = uiRoutesOk && Array.isArray(cap.ui_routes) ? cap.ui_routes.length : 0;
    const portalsOk = cap.portals === undefined || Array.isArray(cap.portals);
    const portalsCount = portalsOk && Array.isArray(cap.portals) ? cap.portals.length : 0;
    const navigationsOk = cap.navigations === undefined || Array.isArray(cap.navigations);
    const navigationsCount = navigationsOk && Array.isArray(cap.navigations) ? cap.navigations.length : 0;
    const edgeModelsOk = cap.edge_models === undefined || Array.isArray(cap.edge_models);
    const edgeModelsCount = edgeModelsOk && Array.isArray(cap.edge_models) ? cap.edge_models.length : 0;
    const edgeApisOk = cap.edge_apis === undefined || Array.isArray(cap.edge_apis);
    const edgeApisCount = edgeApisOk && Array.isArray(cap.edge_apis) ? cap.edge_apis.length : 0;
    const edgeModelStudioMetaOk = cap.edge_model_studio_meta === undefined || Array.isArray(cap.edge_model_studio_meta);
    const edgeModelStudioMetaCount = edgeModelStudioMetaOk && Array.isArray(cap.edge_model_studio_meta)
      ? cap.edge_model_studio_meta.length
      : 0;
    const installHooksOk = cap.install_hooks === undefined || Array.isArray(cap.install_hooks);
    const installHooksCount = installHooksOk && Array.isArray(cap.install_hooks) ? cap.install_hooks.length : 0;
    const workflowsOk = cap.workflows === undefined || Array.isArray(cap.workflows);
    const workflowsCount = workflowsOk && Array.isArray(cap.workflows) ? cap.workflows.length : 0;
    const workflowActionsOk = cap.workflow_actions === undefined || Array.isArray(cap.workflow_actions);
    const workflowActionsCount = workflowActionsOk && Array.isArray(cap.workflow_actions) ? cap.workflow_actions.length : 0;
    const navigationPatchesOk = cap.navigation_patches === undefined || Array.isArray(cap.navigation_patches);
    const navigationPatchesCount = navigationPatchesOk && Array.isArray(cap.navigation_patches)
      ? cap.navigation_patches.length
      : 0;
    const cultureKeysOk = cap.culture_keys === undefined || Array.isArray(cap.culture_keys);
    const cultureKeysCount = cultureKeysOk && Array.isArray(cap.culture_keys) ? cap.culture_keys.length : 0;
    const homePortalOk = cap.home_portal === undefined || Array.isArray(cap.home_portal);
    const homePortalCount = homePortalOk && Array.isArray(cap.home_portal) ? cap.home_portal.length : 0;
    if (
      apisOk && uiOk && dbOk && mcpOk && uiRoutesOk && portalsOk && navigationsOk &&
      edgeModelsOk && edgeApisOk && edgeModelStudioMetaOk && installHooksOk && workflowsOk &&
      workflowActionsOk && navigationPatchesOk && cultureKeysOk && homePortalOk &&
      (cap.apis as unknown[]).length === 0 &&
      (cap.ui_components as unknown[]).length === 0 &&
      (cap.db_objects as unknown[]).length === 0 &&
      mcpCount === 0 &&
      uiRoutesCount === 0 &&
      portalsCount === 0 &&
      navigationsCount === 0 &&
      edgeModelsCount === 0 &&
      edgeApisCount === 0 &&
      edgeModelStudioMetaCount === 0 &&
      installHooksCount === 0 &&
      workflowsCount === 0 &&
      workflowActionsCount === 0 &&
      navigationPatchesCount === 0 &&
      cultureKeysCount === 0 &&
      homePortalCount === 0
    ) {
      errors.push('At least one capability (apis, ui_components, ui_routes, portals, navigations, db_objects, mcp_servers, edge_models, edge_apis, edge_model_studio_meta, install_hooks, workflows, workflow_actions, navigation_patches, culture_keys, or home_portal) must be non-empty.');
    }
  }

  // --- overridePolicy ---
  if (!m.overridePolicy || typeof m.overridePolicy !== 'object' || Array.isArray(m.overridePolicy)) {
    errors.push('overridePolicy must be an object.');
  } else {
    const op = m.overridePolicy as Record<string, unknown>;
    for (const key of ['apis', 'ui_components', 'db_objects'] as const) {
      if (!VALID_OVERRIDE_VALUES.has(op[key] as string)) {
        errors.push(`overridePolicy.${key} must be "allow" or "deny".`);
      }
    }
    if (op.mcp_servers !== undefined && !VALID_OVERRIDE_VALUES.has(op.mcp_servers as string)) {
      errors.push('overridePolicy.mcp_servers must be "allow" or "deny".');
    }
  }

  // --- integrity ---
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
  const normalizedManifest: PackageManifest = {
    ...(m as unknown as PackageManifest),
    capabilities: {
      apis: Array.isArray(cap.apis) ? cap.apis as PackageManifest['capabilities']['apis'] : [],
      ui_components: Array.isArray(cap.ui_components)
        ? cap.ui_components as PackageManifest['capabilities']['ui_components']
        : [],
      ui_routes: Array.isArray(cap.ui_routes)
        ? cap.ui_routes as ExtensionUiRouteCapability[]
        : undefined,
      portals: Array.isArray(cap.portals)
        ? cap.portals as PackageManifest['capabilities']['portals']
        : undefined,
      navigations: Array.isArray(cap.navigations)
        ? cap.navigations as PackageManifest['capabilities']['navigations']
        : undefined,
      db_objects: Array.isArray(cap.db_objects)
        ? cap.db_objects as PackageManifest['capabilities']['db_objects']
        : [],
      mcp_servers: Array.isArray(cap.mcp_servers)
        ? cap.mcp_servers as PackageManifest['capabilities']['mcp_servers']
        : [],
      edge_models: Array.isArray(cap.edge_models)
        ? cap.edge_models as CapabilityEdgeModel[]
        : [],
      edge_apis: Array.isArray(cap.edge_apis)
        ? cap.edge_apis as CapabilityEdgeApi[]
        : [],
      edge_model_studio_meta: Array.isArray(cap.edge_model_studio_meta)
        ? cap.edge_model_studio_meta as CapabilityEdgeModelStudioMeta[]
        : [],
      scope_dimensions: Array.isArray(cap.scope_dimensions)
        ? cap.scope_dimensions as CapabilityScopeDimension[]
        : undefined,
      record_policies: Array.isArray(cap.record_policies)
        ? cap.record_policies as CapabilityRecordPolicy[]
        : undefined,
      record_policy_bindings: Array.isArray(cap.record_policy_bindings)
        ? cap.record_policy_bindings as CapabilityRecordPolicyBinding[]
        : undefined,
      query_surface_bindings: Array.isArray(cap.query_surface_bindings)
        ? cap.query_surface_bindings as CapabilityQuerySurfaceBinding[]
        : undefined,
      workflows: Array.isArray(cap.workflows)
        ? cap.workflows as CapabilityWorkflow[]
        : undefined,
      workflow_actions: Array.isArray(cap.workflow_actions)
        ? cap.workflow_actions as CapabilityWorkflowAction[]
        : undefined,
      install_hooks: Array.isArray(cap.install_hooks)
        ? cap.install_hooks as CapabilityInstallHook[]
        : [],
      designer_shells: Array.isArray(cap.designer_shells)
        ? cap.designer_shells as PackageManifest['capabilities']['designer_shells']
        : undefined,
      navigation_patches: Array.isArray(cap.navigation_patches)
        ? cap.navigation_patches as CapabilityNavigationPatch[]
        : undefined,
      culture_keys: Array.isArray(cap.culture_keys)
        ? cap.culture_keys as CapabilityCultureKeys[]
        : undefined,
      home_portal: Array.isArray(cap.home_portal)
        ? cap.home_portal as CapabilityHomePortal[]
        : undefined,
    },
  };

  return { valid: true, errors: [], manifest: normalizedManifest };
}
