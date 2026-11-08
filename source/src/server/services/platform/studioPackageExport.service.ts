import crypto from 'crypto';
import AdmZip from 'adm-zip';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { validateManifest } from '../../../core/packages/PackageManifestValidator';
import type {
  VerticalAppDeploymentRoute,
  VerticalAppDesignerLayoutCapability,
  VerticalAppDesignerShellCapability,
  VerticalAppExperienceBlock,
  VerticalAppManifest,
  VerticalAppPageCapability,
} from '../../../shared/api/contracts/package-manifest/verticalApp';
import { resolveFunctionAccessMode } from '../../../shared/api/contracts/server-functions/accessControl';
import { parsePlatformRouteBindingAuth } from '../../../shared/api/contracts/platform/platformAccessControl';
import type {
  StudioMountExportDiscover,
  StudioMountExportInclude,
  StudioMountExportPreview,
  StudioMountExportRequest,
} from '../../../shared/api/contracts/platform/studioMountExport';
import type { PlatformMount, PlatformRouteBinding, PlatformRouteBindingAuth } from '../../../shared/api/contracts/platform/types';
import { buildNavigationManifestFromBindings } from '../../../shared/api/contracts/platform/navigation';
import {
  findManagedFunctionByIdFromStore,
  listManagedFunctionsFromStore,
} from '../../../core/functions/FunctionFileStore';
import {
  allocateUniquePackageApiRouteSuffix,
  buildManagedFunctionPackageApiMapping,
  buildPackageApiSlug,
  buildPluginApiMetaSidecar,
  parseFunctionTagsFromMetadata,
  resolveApiMetaEntryPath,
  validatePluginApiMetaSidecar,
} from '../../../core/packages/packageApiMetaSidecar';
import { getDesignerDraft, readDraftRecordByPath } from '../../domain/component-designer/draftIo';
import { draftJsonPath } from '../../domain/component-designer/draftFolderPaths';
import { parseDesignerShellEntry, SHELL_DRAFT_FOLDER } from '../../../shared/lib/designerShellEntry';
import {
  findPlatformMountById,
  findPlatformShellByKey,
  findPlatformPageModuleByKey,
  listPlatformRouteBindingRows,
  listPlatformShellRuleRows,
} from '../../domain/platform';
import { validateVerticalAppManifest } from '../../../core/packages/verticalAppManifestValidator';
import {
  buildExtensionManifestDraft,
  filterOwnerDbObjects,
  filterOwnerMcpServers,
  filterOwnerStaticAssets,
  resolveOwnerPluginSources,
  resolveShellExportContent,
  resolveSuggestedExportKind,
  type MountExportZipEntry,
} from '../package/mountExportSources';
import { buildExperienceManifestFromMountContext } from './compileExperienceManifest';

const RESERVED_MOUNT_IDS = new Set(['studio']);
const PLUGIN_ID_RE = /^[a-z][a-z0-9-]{2,63}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const DEFAULT_INCLUDE: Required<StudioMountExportInclude> = {
  routes: true,
  apis: true,
  dbObjects: true,
  mcpServers: true,
  staticAssets: true,
  shell: true,
  navigation: true,
};

export type StudioMountExportBuildResult =
  | {
      ok: true;
      buffer: Buffer;
      fileName: string;
      kind: 'extension' | 'vertical-app';
      manifest: VerticalAppManifest | PackageManifest;
      warnings: string[];
      skippedRoutes: string[];
    }
  | { ok: false; error: string; details?: string[] };

function normalizeRoutePattern(value: string): string {
  return String(value || '').trim().replace(/^\/+/, '');
}

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63) || 'item';
}

function buildPackagePageModuleSource(pageKey: string, packageId: string): string {
  const safeName = pageKey.replace(/[^A-Za-z0-9_]/g, '_');
  return `export default function ${safeName}Page() {
  return {
    type: 'div',
    props: { 'data-page': '${pageKey}', 'data-package': '${packageId}' },
    children: '${pageKey}',
  };
}
`;
}

function computeArtifactHash(entries: MountExportZipEntry[]): string {
  const payload = entries
    .filter((entry) => entry.path !== 'package.json')
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((entry) => `${entry.path}\0${entry.content.toString('base64')}`)
    .join('\n');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function resolveInclude(input?: StudioMountExportInclude): Required<StudioMountExportInclude> {
  return {
    routes: input?.routes ?? DEFAULT_INCLUDE.routes,
    apis: input?.apis ?? DEFAULT_INCLUDE.apis,
    dbObjects: input?.dbObjects ?? DEFAULT_INCLUDE.dbObjects,
    mcpServers: input?.mcpServers ?? DEFAULT_INCLUDE.mcpServers,
    staticAssets: input?.staticAssets ?? DEFAULT_INCLUDE.staticAssets,
    shell: input?.shell ?? DEFAULT_INCLUDE.shell,
    navigation: input?.navigation ?? DEFAULT_INCLUDE.navigation,
  };
}

function verticalAppRouteAuth(
  auth: PlatformRouteBindingAuth | null | undefined,
): VerticalAppDeploymentRoute['auth'] {
  const acl = parsePlatformRouteBindingAuth(auth);
  const mode = resolveFunctionAccessMode(acl);
  if (mode === 'public') {
    return undefined;
  }
  if (mode === 'authenticated') {
    return { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] };
  }
  if (acl.allowRoles.length > 0) {
    return { roles: acl.allowRoles };
  }
  return undefined;
}

function resolveDefaultRoute(
  mount: PlatformMount,
  routes: VerticalAppDeploymentRoute[],
): string {
  if (routes.length === 0) return 'home';

  const trimmedDefault = mount.defaultRoute.trim();
  if (routes.some((route) => route.pageKey === trimmedDefault)) {
    return trimmedDefault;
  }

  const indexRoute = routes.find((route) => !normalizeRoutePattern(route.routePattern));
  if (indexRoute) return indexRoute.pageKey;

  if (trimmedDefault.startsWith('/')) {
    const suffix = trimmedDefault.slice(mount.pathPrefix.length).replace(/^\/+/, '');
    const matched = routes.find((route) => normalizeRoutePattern(route.routePattern) === suffix);
    if (matched) return matched.pageKey;
  }

  return routes[0].pageKey;
}

function validateExportRequest(mountId: string, input: StudioMountExportRequest): string[] {
  const errors: string[] = [];

  if (!mountId.trim()) {
    errors.push('mountId is required.');
  }
  if (RESERVED_MOUNT_IDS.has(mountId.trim())) {
    errors.push(`Mount "${mountId}" is reserved and cannot be exported as a package.`);
  }
  if (!input.packageId?.trim() || !PLUGIN_ID_RE.test(input.packageId.trim())) {
    errors.push('packageId must match ^[a-z][a-z0-9-]{2,63}$.');
  }
  if (input.version !== undefined && !SEMVER_RE.test(input.version.trim())) {
    errors.push('version must be valid SemVer (x.y.z).');
  }
  if (input.kind && input.kind !== 'extension' && input.kind !== 'vertical-app') {
    errors.push('kind must be extension or vertical-app.');
  }

  return errors;
}

async function collectMountExportContext(mountId: string) {
  const mount = await findPlatformMountById(mountId);
  if (!mount) {
    return { ok: false as const, error: `Mount "${mountId}" was not found.` };
  }

  const shellRules = (await listPlatformShellRuleRows())
    .filter((rule) => rule.mountId === mountId && rule.enabled)
    .sort((left, right) => right.priority - left.priority || left.id - right.id);
  const shellRule = shellRules[0];
  if (!shellRule) {
    return { ok: false as const, error: `Mount "${mountId}" has no enabled shell rule.` };
  }

  const shell = await findPlatformShellByKey(shellRule.shellKey);
  if (!shell) {
    return { ok: false as const, error: `Shell "${shellRule.shellKey}" was not found.` };
  }

  const bindings = (await listPlatformRouteBindingRows())
    .filter((binding) => binding.mountId === mountId && binding.enabled);

  return {
    ok: true as const,
    mount,
    shellRule,
    shell,
    bindings,
  };
}

async function resolveExportableRoute(
  binding: PlatformRouteBinding,
  warnings: string[],
  skippedRoutes: string[],
): Promise<{
  route: VerticalAppDeploymentRoute;
  designerLayout?: VerticalAppDesignerLayoutCapability;
  pluginPage?: VerticalAppPageCapability;
  zipEntries: MountExportZipEntry[];
} | null> {
  const pageModule = await findPlatformPageModuleByKey(binding.pageKey);
  if (!pageModule || !pageModule.enabled) {
    skippedRoutes.push(binding.routePattern || binding.pageKey);
    warnings.push(`Route "${binding.routePattern || binding.pageKey}" skipped — page module is missing or disabled.`);
    return null;
  }

  const routePattern = normalizeRoutePattern(binding.routePattern);
  const route: VerticalAppDeploymentRoute = {
    routePattern,
    pageKey: binding.pageKey,
    auth: verticalAppRouteAuth(binding.auth),
    nav: binding.nav ?? undefined,
  };

  if (pageModule.loaderKind === 'designer') {
    const slug = pageModule.loaderRef.trim() || pageModule.pageKey;
    const draft = getDesignerDraft(slug);
    if (!draft) {
      skippedRoutes.push(routePattern || binding.pageKey);
      warnings.push(`Designer layout "${slug}" was not found — route skipped.`);
      return null;
    }

    const entry = `designer/${slug}.json`;
    return {
      route,
      designerLayout: {
        slug,
        title: pageModule.title,
        entry,
      },
      zipEntries: [{
        path: entry,
        content: Buffer.from(`${JSON.stringify(draft, null, 2)}\n`, 'utf8'),
      }],
    };
  }

  if (pageModule.loaderKind === 'package') {
    skippedRoutes.push(routePattern || binding.pageKey);
    warnings.push(`Route "${routePattern || binding.pageKey}" uses package page "${binding.pageKey}" — re-export is not supported.`);
    return null;
  }

  skippedRoutes.push(routePattern || binding.pageKey);
  warnings.push(`Route "${routePattern || binding.pageKey}" uses core page "${pageModule.loaderRef}" — core pages are not packaged.`);
  return null;
}

function listTaggedFunctionIds(mountId: string, packageId: string): string[] {
  const ids: string[] = [];
  for (const fn of listManagedFunctionsFromStore()) {
    const tags = parseFunctionTagsFromMetadata(fn.metadata_json);
    if (tags.includes(mountId) || tags.includes(packageId)) {
      ids.push(fn.id);
    }
  }
  return ids;
}

function collectSelectedServerFunctions(
  mountId: string,
  packageId: string,
  functionIds: string[] | undefined,
  warnings: string[],
): {
  apis: VerticalAppManifest['capabilities']['apis'];
  zipEntries: MountExportZipEntry[];
} {
  const apis: VerticalAppManifest['capabilities']['apis'] = [];
  const zipEntries: MountExportZipEntry[] = [];
  const usedSlugs = new Set<string>();
  const selectedIds = functionIds?.length
    ? [...new Set(functionIds.map((id) => String(id).trim()).filter(Boolean))]
    : listTaggedFunctionIds(mountId, packageId);

  for (const functionId of selectedIds) {
    const fn = findManagedFunctionByIdFromStore(functionId);
    if (!fn) {
      warnings.push(`Managed function "${functionId}" was not found — skipped.`);
      continue;
    }

    const apiSlug = allocateUniquePackageApiRouteSuffix(
      buildPackageApiSlug({
        folder: fn.folder,
        name: fn.name,
        path: fn.path,
      }),
      usedSlugs,
    );
    const mapping = buildManagedFunctionPackageApiMapping({
      packageId,
      folder: fn.folder,
      name: fn.name,
      method: fn.method,
      path: fn.path,
      apiSlug,
    });
    const entry = mapping.entry;
    const metaEntry = resolveApiMetaEntryPath(entry);
    const sidecar = buildPluginApiMetaSidecar(fn);
    const sidecarValidation = validatePluginApiMetaSidecar(sidecar);
    if (!sidecarValidation.valid) {
      warnings.push(`Function "${functionId}" meta sidecar invalid — skipped.`);
      continue;
    }

    apis.push({
      id: mapping.apiId,
      method: fn.method,
      path: mapping.manifestPath,
      entry,
      timeoutMs: sidecar.timeoutMs,
      auth: sidecar.auth,
    });
    zipEntries.push({
      path: entry,
      content: Buffer.from(`${fn.code.trim()}\n`, 'utf8'),
    });
    zipEntries.push({
      path: metaEntry,
      content: Buffer.from(`${JSON.stringify(sidecar, null, 2)}\n`, 'utf8'),
    });
  }

  return { apis, zipEntries };
}

function filterBindings(
  bindings: PlatformRouteBinding[],
  routeBindingIds?: number[],
): PlatformRouteBinding[] {
  if (!routeBindingIds?.length) return bindings;
  const allowed = new Set(routeBindingIds);
  return bindings.filter((binding) => allowed.has(binding.id));
}

export async function discoverStudioMountExport(mountId: string): Promise<
  StudioMountExportDiscover | { ok: false; error: string; details?: string[] }
> {
  if (RESERVED_MOUNT_IDS.has(mountId.trim())) {
    return { ok: false, error: `Mount "${mountId}" is reserved and cannot be exported.` };
  }

  const context = await collectMountExportContext(mountId);
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const warnings: string[] = [];
  const skippedRoutes: string[] = [];
  const routes: StudioMountExportDiscover['routes'] = [];

  for (const binding of context.bindings) {
    const resolved = await resolveExportableRoute(binding, warnings, skippedRoutes);
    routes.push({
      bindingId: binding.id,
      routePattern: binding.routePattern,
      pageKey: binding.pageKey,
      exportable: Boolean(resolved),
      reason: resolved ? undefined : 'Not exportable (core/package page or missing designer draft).',
    });
  }

  const ownerPackageId = context.mount.ownerPackageId?.trim() || null;
  const ownerSources = resolveOwnerPluginSources(ownerPackageId);
  const shellResolved = resolveShellExportContent(
    context.shell.entry,
    context.mount.id,
    ownerPackageId,
  );

  const apis = listManagedFunctionsFromStore().map((fn) => ({
    functionId: fn.id,
    name: fn.name || fn.path || fn.id,
    method: fn.method,
    tagged: parseFunctionTagsFromMetadata(fn.metadata_json).includes(mountId),
  }));

  const exportableRouteCount = routes.filter((route) => route.exportable).length;
  const taggedApiCount = apis.filter((api) => api.tagged).length;

  return {
    schema: 'studio-mount-export-discover',
    schemaVersion: '1.0.0',
    mountId,
    ownerPackageId,
    suggestedKind: resolveSuggestedExportKind({
      routeCount: exportableRouteCount,
      apiCount: taggedApiCount,
      dbObjectCount: ownerSources?.dbObjects.length ?? 0,
      mcpServerCount: ownerSources?.mcpServers.length ?? 0,
    }),
    routes,
    apis,
    dbObjects: (ownerSources?.dbObjects ?? []).map((item) => ({
      objectName: item.objectName,
      objectType: item.objectType,
      source: 'owner-package' as const,
    })),
    mcpServers: (ownerSources?.mcpServers ?? []).map((item) => ({
      id: item.id,
      label: item.label,
      source: 'owner-package' as const,
    })),
    staticAssets: (ownerSources?.staticAssets ?? []).map((item) => ({
      assetKey: item.assetKey,
      path: item.path,
      source: 'owner-package' as const,
    })),
    shell: {
      shellKey: context.shell.shellKey,
      entry: context.shell.entry,
      exportable: Boolean(shellResolved),
      source: shellResolved?.source ?? 'core-bridge',
    },
  };
}

export async function buildStudioMountExport(
  mountId: string,
  input: StudioMountExportRequest,
): Promise<StudioMountExportBuildResult> {
  const requestErrors = validateExportRequest(mountId, input);
  if (requestErrors.length > 0) {
    return { ok: false, error: 'Export request validation failed.', details: requestErrors };
  }

  const context = await collectMountExportContext(mountId);
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const packageId = input.packageId.trim();
  const version = input.version?.trim() || '0.1.0';
  const name = input.name?.trim() || context.mount.name;
  const include = resolveInclude(input.include);
  const warnings: string[] = [];
  const skippedRoutes: string[] = [];
  const zipEntries: MountExportZipEntry[] = [];

  const designerLayouts: VerticalAppDesignerLayoutCapability[] = [];
  const pluginPages: VerticalAppPageCapability[] = [];
  const deploymentRoutes: VerticalAppDeploymentRoute[] = [];

  if (include.routes) {
    const bindings = filterBindings(context.bindings, input.routeBindingIds);
    for (const binding of bindings) {
      const resolved = await resolveExportableRoute(binding, warnings, skippedRoutes);
      if (!resolved) continue;

      deploymentRoutes.push(resolved.route);
      zipEntries.push(...resolved.zipEntries);
      if (resolved.designerLayout) {
        designerLayouts.push(resolved.designerLayout);
      }
      if (resolved.pluginPage) {
        pluginPages.push(resolved.pluginPage);
      }
    }
  }

  const { apis, zipEntries: apiEntries } = include.apis
    ? collectSelectedServerFunctions(mountId, packageId, input.functionIds, warnings)
    : { apis: [], zipEntries: [] as MountExportZipEntry[] };
  zipEntries.push(...apiEntries);

  const ownerPackageId = context.mount.ownerPackageId?.trim() || null;
  const ownerSources = include.dbObjects || include.mcpServers || include.staticAssets
    ? resolveOwnerPluginSources(ownerPackageId)
    : null;

  const dbObjects = include.dbObjects
    ? filterOwnerDbObjects(ownerSources?.dbObjects ?? [], input.dbObjectNames)
    : [];
  const mcpServers = include.mcpServers
    ? filterOwnerMcpServers(ownerSources?.mcpServers ?? [], input.mcpServerIds)
    : [];
  const staticAssets = include.staticAssets
    ? filterOwnerStaticAssets(ownerSources?.staticAssets ?? [], input.staticAssetKeys)
    : [];

  if (ownerSources && (include.dbObjects || include.staticAssets)) {
    const allowedPaths = new Set<string>();
    for (const dbObject of dbObjects) {
      for (const scriptPath of [dbObject.installScript, dbObject.uninstallScript, dbObject.seedScript]) {
        if (scriptPath?.trim()) allowedPaths.add(scriptPath.replace(/\\/g, '/'));
      }
    }
    for (const asset of staticAssets) {
      allowedPaths.add(asset.path.replace(/\\/g, '/'));
    }
    for (const entry of ownerSources.zipEntries) {
      if (allowedPaths.has(entry.path)) {
        zipEntries.push(entry);
      }
    }
  }

  if (ownerSources && !ownerPackageId) {
    warnings.push('Mount has no owner package — db_objects, mcp_servers, and static_assets were not sourced.');
  } else if (ownerPackageId && !ownerSources) {
    warnings.push(`Owner package "${ownerPackageId}" is not installed — workspace db/mcp/assets were not included.`);
  }

  const kind = resolveSuggestedExportKind({
    routeCount: deploymentRoutes.length,
    apiCount: apis.length,
    dbObjectCount: dbObjects.length,
    mcpServerCount: mcpServers.length,
    explicitKind: input.kind,
  });

  if (kind === 'vertical-app' && deploymentRoutes.length === 0) {
    return {
      ok: false,
      error: 'Vertical-app export requires at least one exportable route, or switch to kind "extension".',
      details: skippedRoutes.length > 0 ? [`Skipped routes: ${skippedRoutes.join(', ')}`] : undefined,
    };
  }

  if (kind === 'extension' && apis.length === 0 && dbObjects.length === 0 && mcpServers.length === 0) {
    return {
      ok: false,
      error: 'Extension export requires at least one API, db_object, or mcp_server capability.',
      details: skippedRoutes.length > 0 ? [`Skipped routes: ${skippedRoutes.join(', ')}`] : undefined,
    };
  }

  if (kind === 'extension') {
    const manifestWithoutHash = buildExtensionManifestDraft(
      packageId,
      name,
      version,
      {
        apis,
        ui_components: [],
        db_objects: dbObjects,
        mcp_servers: mcpServers,
        edge_models: [],
        edge_apis: [],
        edge_model_studio_meta: [],
        install_hooks: [],
      },
      {
        description: input.description?.trim() || undefined,
        createdBy: input.createdBy?.trim() || undefined,
        requiredAppVersion: input.requiredAppVersion?.trim(),
      },
    );

    const artifactHash = computeArtifactHash([
      ...zipEntries,
      {
        path: 'package.json',
        content: Buffer.from(`${JSON.stringify(manifestWithoutHash, null, 2)}\n`, 'utf8'),
      },
    ]);

    const manifest: PackageManifest = {
      ...manifestWithoutHash,
      integrity: { algorithm: 'sha256', artifactHash },
    };

    const validation = validateManifest(manifest);
    if (!validation.valid || !validation.manifest) {
      return {
        ok: false,
        error: 'Generated extension manifest failed validation.',
        details: validation.errors,
      };
    }

    const zip = new AdmZip();
    for (const entry of zipEntries) {
      zip.addFile(entry.path, entry.content);
    }
    zip.addFile('package.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));

    return {
      ok: true,
      buffer: zip.toBuffer(),
      fileName: `${packageId}-${version}.zip`,
      kind: 'extension',
      manifest,
      warnings,
      skippedRoutes,
    };
  }

  const shellKey = `${packageId}-shell`;
  const shellEntry = 'ui/shell/AppShell.js';
  const navigationEntry = 'navigation/navigation.json';
  const experienceEntry = 'experience/experience.json';
  const navigationManifest = buildNavigationManifestFromBindings({
    bindings: context.bindings.filter((binding) => binding.enabled),
    id: packageId,
  });
  const experienceBlock: VerticalAppExperienceBlock = buildExperienceManifestFromMountContext({
    manifestId: packageId,
    cultureId: 'us',
    shell: context.shell,
    bindings: context.bindings,
  });
  if (include.shell) {
    const designerShellRef = parseDesignerShellEntry(context.shell.entry);
    if (designerShellRef) {
      const shellDraft = readDraftRecordByPath(
        draftJsonPath(designerShellRef.shellKey, SHELL_DRAFT_FOLDER),
      );
      if (shellDraft) {
        const shellEntry = `designer/${SHELL_DRAFT_FOLDER}/${designerShellRef.shellKey}.json`;
        zipEntries.push({
          path: shellEntry,
          content: Buffer.from(`${JSON.stringify(shellDraft, null, 2)}\n`, 'utf8'),
        });
      } else {
        warnings.push(`Designer shell "${designerShellRef.shellKey}" was not found — shell JSON omitted.`);
      }
    }

    const shellResolved = resolveShellExportContent(context.shell.entry, packageId, ownerPackageId);
    if (!shellResolved) {
      return { ok: false, error: 'Shell export failed — source shell could not be resolved.' };
    }
    zipEntries.push({
      path: shellResolved.entry,
      content: shellResolved.content,
    });
    if (shellResolved.source === 'core-bridge') {
      warnings.push(`Shell exported as core bridge referencing "${context.shell.entry}".`);
    }
  } else {
    return { ok: false, error: 'Vertical-app export requires shell capability.' };
  }

  if (include.navigation) {
    zipEntries.push({
      path: navigationEntry,
      content: Buffer.from(`${JSON.stringify(navigationManifest, null, 2)}\n`, 'utf8'),
    });
    zipEntries.push({
      path: experienceEntry,
      content: Buffer.from(`${JSON.stringify(experienceBlock, null, 2)}\n`, 'utf8'),
    });
  }

  for (const page of pluginPages) {
    zipEntries.push({
      path: page.entry,
      content: Buffer.from(buildPackagePageModuleSource(page.pageKey, packageId), 'utf8'),
    });
  }

  const designerShells: VerticalAppDesignerShellCapability[] = [];
  const exportedDesignerShell = parseDesignerShellEntry(context.shell.entry);
  if (exportedDesignerShell && include.shell) {
    const shellEntry = `designer/${SHELL_DRAFT_FOLDER}/${exportedDesignerShell.shellKey}.json`;
    if (zipEntries.some((entry) => entry.path === shellEntry)) {
      designerShells.push({
        shellKey: exportedDesignerShell.shellKey,
        title: context.shell.name,
        entry: shellEntry,
      });
    }
  }

  const defaultRoute = resolveDefaultRoute(context.mount, deploymentRoutes);
  const branding = ownerSources?.branding?.logoAssetKey
    && staticAssets.some((asset) => asset.assetKey === ownerSources.branding?.logoAssetKey)
    ? ownerSources.branding
    : undefined;
  const manifestWithoutHash: Omit<VerticalAppManifest, 'integrity'> & {
    integrity: { algorithm: 'sha256'; artifactHash: string };
  } = {
    $schemaVersion: designerShells.length > 0 ? '1.3' : '1.2',
    kind: 'vertical-app',
    id: packageId,
    name,
    version,
    description: input.description?.trim() || undefined,
    createdBy: input.createdBy?.trim() || undefined,
    requiredAppVersion: input.requiredAppVersion?.trim() || '>=1.0.0',
    dependencies: [],
    branding,
    experience: include.navigation ? experienceBlock : undefined,
    capabilities: {
      shell: {
        key: shellKey,
        name: `${name} Shell`,
        entry: shellEntry,
        surface: context.shell.surface || 'portal',
        navigationEntry: include.navigation ? navigationEntry : undefined,
      },
      pages: pluginPages.length > 0 ? pluginPages : undefined,
      designer_layouts: designerLayouts.length > 0 ? designerLayouts : undefined,
      designer_shells: designerShells.length > 0 ? designerShells : undefined,
      static_assets: staticAssets.length > 0 ? staticAssets : undefined,
      apis,
      db_objects: dbObjects,
      mcp_servers: mcpServers.length > 0 ? mcpServers : undefined,
    },
    deployment: {
      applyPolicy: input.applyPolicy ?? 'propose',
      mount: {
        id: packageId,
        pathPrefix: context.mount.pathPrefix,
        name: context.mount.name,
        defaultRoute,
        authProfile: context.mount.authProfile,
        experienceConfig: context.mount.experienceConfig ?? undefined,
      },
      shellRule: {
        pathPrefix: context.shellRule.pathPrefix,
        shellKey,
        priority: context.shellRule.priority,
      },
      routes: deploymentRoutes,
    },
    overridePolicy: {
      apis: 'deny',
      db_objects: 'deny',
      mcp_servers: 'deny',
    },
    integrity: {
      algorithm: 'sha256',
      artifactHash: '0'.repeat(64),
    },
  };

  const artifactHash = computeArtifactHash([
    ...zipEntries,
    {
      path: 'package.json',
      content: Buffer.from(`${JSON.stringify({ ...manifestWithoutHash, integrity: { algorithm: 'sha256', artifactHash: '0'.repeat(64) } }, null, 2)}\n`, 'utf8'),
    },
  ]);

  const manifest: VerticalAppManifest = {
    ...manifestWithoutHash,
    integrity: {
      algorithm: 'sha256',
      artifactHash,
    },
  };

  const validation = validateVerticalAppManifest(manifest);
  if (!validation.valid || !validation.manifest) {
    return {
      ok: false,
      error: 'Generated manifest failed validation.',
      details: validation.errors,
    };
  }

  const zip = new AdmZip();
  for (const entry of zipEntries) {
    zip.addFile(entry.path, entry.content);
  }
  zip.addFile('package.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));

  return {
    ok: true,
    buffer: zip.toBuffer(),
    fileName: `${packageId}-${version}.zip`,
    kind: 'vertical-app',
    manifest,
    warnings,
    skippedRoutes,
  };
}

export async function previewStudioMountExport(
  mountId: string,
  input: StudioMountExportRequest,
): Promise<StudioMountExportPreview | { ok: false; error: string; details?: string[] }> {
  const built = await buildStudioMountExport(mountId, input);
  if (!built.ok) {
    return built;
  }

  return {
    schema: 'studio-mount-export-preview',
    schemaVersion: '1.0.0',
    mountId,
    packageId: input.packageId.trim(),
    kind: built.kind,
    fileName: built.fileName,
    manifest: built.manifest,
    warnings: built.warnings,
    skippedRoutes: built.skippedRoutes,
    generatedAt: new Date().toISOString(),
  };
}
