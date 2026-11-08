import { listPageModuleFiles } from '../../../core/platform-registry/PlatformRegistryFileStore';
import { parsePinnedDesignerLoaderRef } from '../../../domain/component-designer/publishLoaderRef';
import { parsePackagePageLoaderRef } from '../../../shared/api/contracts/package-manifest/extensionUiRoutes';
import {
  isClientComponentEditSlug,
  resolvePackagePageKeyToEditSlug,
} from '../../../shared/lib/clientComponentEditSlug';
import type {
  AccessAssistantContextResponse,
  AccessAssistantEligibility,
  AccessAssistantFunctionRow,
  AccessAssistantPageManifest,
  AccessAssistantSavePayload,
  AccessAssistantSurfaceContext,
} from '../../../shared/api/contracts/access-assistant/types';
import type { FunctionAccessEntityKind } from '../../../shared/api/contracts/server-functions/entityAccess';
import { buildManifestScopedAccessDecisions } from '../../../shared/lib/access-assistant/mergeManifestAccessDecisions';
import {
  accessAssistantIneligibleReason,
  isAccessAssistantPageEligible,
} from '../../../shared/lib/access-assistant/pageEligibility';
import { resolveFunctionBlurbFromMetadata } from '../../../shared/lib/access-assistant/functionBlurb';
import {
  deriveDesignerAccessManifest,
} from '../../domain/access-assistant/designerAccessManifestDeriver';
import {
  listAccessAssistantManifestFunctionIds,
  readAccessAssistantPageManifest,
} from '../../domain/access-assistant/accessAssistantManifestStore';
import { HttpError } from '../../errors/HttpError';
import {
  getEntityFunctionAccess,
  replaceEntityFunctionAccess,
  type EntityFunctionAccessServiceDeps,
} from '../entityFunctionAccess.service';
import { buildMergedServerFunctionsCatalog } from '../serverFunctionsCatalog.service';

const resolvePageModule = (pageKey: string) => {
  const trimmed = pageKey.trim();
  return listPageModuleFiles().find((module) => module.pageKey === trimmed) ?? null;
};

const resolvePageManifest = async (
  pageKey: string,
  deps: EntityFunctionAccessServiceDeps,
): Promise<AccessAssistantPageManifest | null> => {
  const fromFile = readAccessAssistantPageManifest(pageKey);
  if (fromFile) {
    return fromFile;
  }

  const pageModule = resolvePageModule(pageKey);
  if (!pageModule) {
    return null;
  }

  if (pageModule.loaderKind === 'designer' || pageModule.loaderKind === 'package') {
    const catalog = await buildMergedServerFunctionsCatalog(deps);
    const catalogIds = catalog.map((fn) => fn.id);
    return deriveDesignerAccessManifest(pageModule, catalogIds);
  }

  return null;
};

export function resolveAccessAssistantEligibility(pageKey: string): AccessAssistantEligibility {
  const trimmed = pageKey.trim();
  const ineligibleReason = accessAssistantIneligibleReason(trimmed);
  if (ineligibleReason) {
    return {
      eligible: false,
      reason: ineligibleReason,
      editComponent: { enabled: false, reason: ineligibleReason },
    };
  }

  const pageModule = resolvePageModule(trimmed);
  const editComponent = resolveEditComponentEligibility(trimmed, pageModule);

  return {
    eligible: true,
    editComponent,
  };
}

function resolveEditComponentEligibility(
  pageKey: string,
  pageModule: ReturnType<typeof resolvePageModule>,
): AccessAssistantEligibility['editComponent'] {
  if (!pageModule) {
    return { enabled: false, reason: 'Page module not found.' };
  }

  if (pageModule.loaderKind === 'core') {
    return { enabled: false, reason: 'Core module — edit in codebase.' };
  }

  if (pageModule.loaderKind === 'package') {
    const slug = resolveEditComponentSlug(pageKey);
    return slug
      ? { enabled: true, componentSlug: slug }
      : { enabled: false, reason: 'No Client Components name for this package page.' };
  }

  if (pageModule.loaderKind === 'designer') {
    if (!pageModule.loaderRef?.trim()) {
      return { enabled: false, reason: 'No component reference.' };
    }
    const slug = resolveEditComponentSlug(pageKey);
    return slug
      ? { enabled: true, componentSlug: slug }
      : { enabled: false, reason: 'Component not found.' };
  }

  return { enabled: false, reason: 'Edit is not available for this page type.' };
}

export function resolveEditComponentSlug(pageKey: string): string | null {
  const pageModule = resolvePageModule(pageKey);
  if (!pageModule?.loaderRef?.trim()) {
    return null;
  }
  if (pageModule.loaderKind === 'package') {
    const parsed = parsePackagePageLoaderRef(pageModule.loaderRef);
    if (!parsed?.pageKey.trim()) {
      return null;
    }
    const slug = resolvePackagePageKeyToEditSlug(parsed.pageKey);
    return isClientComponentEditSlug(slug) ? slug : null;
  }

  if (pageModule.loaderKind !== 'designer') {
    return null;
  }
  const { componentPath } = parsePinnedDesignerLoaderRef(pageModule.loaderRef);
  const segments = componentPath.split('/').filter(Boolean);
  const slug = segments[segments.length - 1] ?? null;
  return slug && isClientComponentEditSlug(slug) ? slug : null;
}

const buildFunctionRow = (
  entry: {
    id: string;
    name: string;
    method: string;
    path: string;
    decision: 'allow' | 'deny' | 'none';
    editable: boolean;
  },
  metadataJson: string | null | undefined,
): AccessAssistantFunctionRow => ({
  id: entry.id,
  name: entry.name,
  method: entry.method,
  path: entry.path,
  blurb: resolveFunctionBlurbFromMetadata(metadataJson, entry.name),
  allowed: entry.decision === 'allow',
  editable: entry.editable,
});

const buildSurfaces = (
  manifest: AccessAssistantPageManifest,
  entryById: Map<string, {
    id: string;
    name: string;
    method: string;
    path: string;
    decision: 'allow' | 'deny' | 'none';
    editable: boolean;
  }>,
  metadataById: Map<string, string | null>,
): AccessAssistantSurfaceContext[] => {
  const toSurface = (surface: AccessAssistantPageManifest['root']): AccessAssistantSurfaceContext => ({
    surfaceId: surface.surfaceId,
    title: surface.title,
    functions: surface.functionIds
      .map((id) => entryById.get(id))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map((entry) => buildFunctionRow(entry, metadataById.get(entry.id))),
  });

  return [
    toSurface(manifest.root),
    ...manifest.linkedSurfaces.map(toSurface),
  ];
};

export async function getAccessAssistantContext(
  deps: EntityFunctionAccessServiceDeps,
  input: {
    pageKey: string;
    entityKind?: FunctionAccessEntityKind;
    entityKey?: string;
  },
): Promise<AccessAssistantContextResponse> {
  const pageKey = input.pageKey.trim();
  const pageModule = resolvePageModule(pageKey);
  const eligibility = resolveAccessAssistantEligibility(pageKey);

  if (!eligibility.eligible) {
    return {
      success: true,
      pageKey,
      pageTitle: pageModule?.title ?? pageKey,
      eligibility,
      surfaces: [],
      adminBypass: false,
    };
  }

  const manifest = await resolvePageManifest(pageKey, deps);
  if (!manifest) {
    return {
      success: true,
      pageKey,
      pageTitle: pageModule?.title ?? pageKey,
      eligibility: {
        eligible: false,
        reason: 'No access map for this page. Use Server Functions.',
        editComponent: eligibility.editComponent,
      },
      surfaces: [],
      adminBypass: false,
    };
  }

  const catalog = await buildMergedServerFunctionsCatalog(deps);
  const metadataById = new Map(
    catalog.map((fn) => [
      fn.id,
      fn.metadataJson ? JSON.stringify(fn.metadataJson) : null,
    ]),
  );

  let entityKind = input.entityKind;
  let entityKey = input.entityKey?.trim();
  let entityLabel: string | undefined;
  let adminBypass = false;
  let entryById = new Map<string, {
    id: string;
    name: string;
    method: string;
    path: string;
    decision: 'allow' | 'deny' | 'none';
    editable: boolean;
  }>();

  if (entityKind && entityKey) {
    const access = await getEntityFunctionAccess(deps, entityKind, entityKey);
    adminBypass = access.adminBypass;
    entityLabel = access.entityLabel;
    entityKey = access.entityKey;
    entryById = new Map(access.entries.map((entry) => [entry.id, entry]));
  } else {
    entryById = new Map(
      catalog.map((fn) => [fn.id, {
        id: fn.id,
        name: fn.name,
        method: fn.method,
        path: fn.path,
        decision: 'none' as const,
        editable: true,
      }]),
    );
  }

  const surfaces = buildSurfaces(manifest, entryById, metadataById);

  return {
    success: true,
    pageKey,
    pageTitle: pageModule?.title ?? pageKey,
    eligibility,
    surfaces,
    entityKind,
    entityKey,
    entityLabel,
    adminBypass,
  };
}

export async function saveAccessAssistantContext(
  deps: EntityFunctionAccessServiceDeps,
  payload: AccessAssistantSavePayload,
  pageKey: string,
  actorEmail: string | null,
): Promise<{ success: true }> {
  const trimmedPageKey = pageKey.trim();
  const eligibility = resolveAccessAssistantEligibility(trimmedPageKey);
  if (!eligibility.eligible) {
    throw new HttpError(400, eligibility.reason ?? 'Page is not eligible.');
  }

  const manifest = await resolvePageManifest(trimmedPageKey, deps);
  if (!manifest) {
    throw new HttpError(404, 'No access map for this page.');
  }

  const manifestIds = listAccessAssistantManifestFunctionIds(manifest);
  const access = await getEntityFunctionAccess(deps, payload.entityKind, payload.entityKey);
  const currentDecisions = Object.fromEntries(
    access.entries.map((entry) => [entry.id, entry.decision]),
  );

  const decisions = buildManifestScopedAccessDecisions({
    manifestFunctionIds: manifestIds,
    allowedByFunctionId: Object.fromEntries(
      manifestIds.map((id) => [id, Boolean(payload.allowedByFunctionId[id])]),
    ),
    currentDecisions,
  });

  await replaceEntityFunctionAccess(
    deps,
    payload.entityKind,
    payload.entityKey,
    { decisions },
    actorEmail,
  );

  return { success: true };
}
