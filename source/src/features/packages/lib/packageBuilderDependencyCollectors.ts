import {
  isPackageWorkspaceAssetUrl,
} from '../../../shared/lib/packageWorkspaceAssets';
import { isWebFontPlatformAssetUrl } from '../../../shared/lib/platformWebFonts';
import type { PackageBuilderCatalogShellItem, PackageBuilderCatalogUiComponentItem } from './packageBuilderCatalog';

const WORKSPACE_ASSET_IN_STRING_RE = /\/assets\/workspace\/[^\s"'`)]+/gi;
const PLATFORM_FONT_IN_STRING_RE = /\/assets\/platform\/fonts\/[^\s"'`)]+/gi;

export function extractDesignerAssetPaths(source: string): string[] {
  const paths = new Set<string>();
  const patterns = [
    /(?:src|href|url)\s*[:=]\s*["']([^"']+)["']/gi,
    /["'](\/(?:assets|uploads|media|static)[^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(source);
    while (match) {
      const candidate = match[1]?.trim();
      if (candidate && isPackableAssetPath(candidate)) {
        paths.add(candidate);
      }
      match = pattern.exec(source);
    }
  }

  return [...paths].sort((left, right) => left.localeCompare(right));
}

function isPackableAssetPath(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  if (normalized === '/placeholder.svg' || normalized.startsWith('data:')) {
    return false;
  }

  return normalized.startsWith('/')
    || /\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|otf)(\?|$)/i.test(normalized);
}

export function isPackablePackageAssetUrl(value: string): boolean {
  return isPackageWorkspaceAssetUrl(value) || isWebFontPlatformAssetUrl(value);
}

/** Walk any JSON-like value and collect packable workspace + platform-font URL strings. */
export function collectWorkspaceAssetUrlsFromValue(
  value: unknown,
  output = new Set<string>(),
): Set<string> {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (isPackablePackageAssetUrl(trimmed)) {
      output.add(trimmed);
      return output;
    }
    let match = WORKSPACE_ASSET_IN_STRING_RE.exec(trimmed);
    while (match) {
      const candidate = match[0]?.trim();
      if (candidate && isPackageWorkspaceAssetUrl(candidate)) {
        output.add(candidate);
      }
      match = WORKSPACE_ASSET_IN_STRING_RE.exec(trimmed);
    }
    match = PLATFORM_FONT_IN_STRING_RE.exec(trimmed);
    while (match) {
      const candidate = match[0]?.trim();
      if (candidate && isWebFontPlatformAssetUrl(candidate)) {
        output.add(candidate);
      }
      match = PLATFORM_FONT_IN_STRING_RE.exec(trimmed);
    }
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectWorkspaceAssetUrlsFromValue(item, output));
    return output;
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectWorkspaceAssetUrlsFromValue(item, output));
  }

  return output;
}

export function collectWorkspaceAssetUrlsFromShell(
  shell: PackageBuilderCatalogShellItem,
): string[] {
  try {
    const parsed = JSON.parse(shell.draftJson) as unknown;
    return [...collectWorkspaceAssetUrlsFromValue(parsed)].sort((a, b) => a.localeCompare(b));
  } catch {
    return extractDesignerAssetPaths(shell.draftJson).filter(isPackageWorkspaceAssetUrl);
  }
}

export function collectWorkspaceAssetUrlsFromComponents(
  components: readonly PackageBuilderCatalogUiComponentItem[],
): string[] {
  const paths = new Set<string>();
  for (const component of components) {
    const code = component.exportBundle?.code;
    if (code) collectWorkspaceAssetUrlsFromValue(code, paths);
    const draftJson = component.exportBundle?.draftJson;
    if (draftJson) collectWorkspaceAssetUrlsFromValue(draftJson, paths);
  }
  return [...paths].sort((a, b) => a.localeCompare(b));
}

type ShellDraftLike = {
  document?: {
    metadata?: {
      shellDesigner?: {
        starterLanding?: { pageKey?: string; routePath?: string };
        recipe?: {
          navigation?: {
            primaryNavigationRef?: string;
            side?: { navigationRef?: string };
            top?: { navigationRef?: string };
            footer?: { navigationRef?: string };
          };
        };
      };
    };
    nodes?: Record<string, {
      componentRef?: { refType?: string; refId?: string };
    }>;
  };
};

function parseShellDraft(shell: PackageBuilderCatalogShellItem): ShellDraftLike | null {
  try {
    return JSON.parse(shell.draftJson) as ShellDraftLike;
  } catch {
    return null;
  }
}

/** Navigation manifest ids referenced by a Shell Designer recipe. */
export function collectShellRecipeNavigationIds(
  shell: PackageBuilderCatalogShellItem,
): string[] {
  const draft = parseShellDraft(shell);
  const navigation = draft?.document?.metadata?.shellDesigner?.recipe?.navigation;
  if (!navigation) return [];

  const ids = new Set<string>();
  for (const id of [
    navigation.primaryNavigationRef,
    navigation.side?.navigationRef,
    navigation.top?.navigationRef,
    navigation.footer?.navigationRef,
  ]) {
    const trimmed = id?.trim();
    if (trimmed) ids.add(trimmed);
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

export function collectShellStarterLandingPageKeys(
  shell: PackageBuilderCatalogShellItem,
): string[] {
  const pageKey = parseShellDraft(shell)
    ?.document
    ?.metadata
    ?.shellDesigner
    ?.starterLanding
    ?.pageKey
    ?.trim();
  return pageKey ? [pageKey] : [];
}

function collectReusableComponentRefsFromDraftValue(value: unknown, output: Set<string>): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectReusableComponentRefsFromDraftValue(item, output));
    return;
  }

  const record = value as Record<string, unknown>;
  const componentRef = record.componentRef;
  if (componentRef && typeof componentRef === 'object' && !Array.isArray(componentRef)) {
    const ref = componentRef as { refType?: unknown; refId?: unknown };
    if (ref.refType === 'reusable' && typeof ref.refId === 'string' && ref.refId.trim()) {
      output.add(ref.refId.trim());
    }
  }

  Object.values(record).forEach((item) => collectReusableComponentRefsFromDraftValue(item, output));
}

export function collectReusableComponentRefsFromDraftJson(draftJson: string): string[] {
  try {
    const parsed = JSON.parse(draftJson) as unknown;
    const refs = new Set<string>();
    collectReusableComponentRefsFromDraftValue(parsed, refs);
    return [...refs].sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/** Reusable designer component keys referenced from a shell draft document. */
export function collectReusableComponentRefsFromShell(
  shell: PackageBuilderCatalogShellItem,
): string[] {
  return collectReusableComponentRefsFromDraftJson(shell.draftJson);
}

export function collectBindingEndpointsFromDraftJson(draftJson: string): string[] {
  const endpoints = new Set<string>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.endpoint === 'string' && record.endpoint.trim()) {
      endpoints.add(record.endpoint.trim());
    }
    Object.values(record).forEach(visit);
  };

  try {
    visit(JSON.parse(draftJson) as unknown);
  } catch {
    return [];
  }
  return [...endpoints].sort((left, right) => left.localeCompare(right));
}

export function collectFontProfileIdsFromDraftJson(draftJson: string): string[] {
  const ids = new Set<string>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.fontProfileId === 'string') {
      const id = record.fontProfileId.trim();
      if (id && id !== 'inherit') ids.add(id);
    }
    Object.values(record).forEach(visit);
  };

  try {
    visit(JSON.parse(draftJson) as unknown);
  } catch {
    return [];
  }
  return [...ids].sort((left, right) => left.localeCompare(right));
}

const REUSABLE_PATH_RE = /['"`]([a-z0-9][a-z0-9._-]{0,63}\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,63})['"`]/g;

/** Best-effort reusable component paths mentioned in generated TSX. */
export function collectReusableComponentPathsFromCode(source: string): string[] {
  const paths = new Set<string>();
  let match = REUSABLE_PATH_RE.exec(source);
  while (match) {
    const candidate = match[1]?.trim();
    if (candidate && !candidate.startsWith('http') && candidate.includes('/')) {
      paths.add(candidate);
    }
    match = REUSABLE_PATH_RE.exec(source);
  }
  return [...paths].sort((a, b) => a.localeCompare(b));
}

const API_PATH_RE = /['"`](\/api\/[^'"`?\s]+)['"`]/g;

export function extractApiPathsFromDesignerCode(source: string): string[] {
  const paths = new Set<string>();
  let match = API_PATH_RE.exec(source);
  while (match) {
    const candidate = match[1]?.trim();
    if (candidate) {
      paths.add(candidate);
    }
    match = API_PATH_RE.exec(source);
  }
  return [...paths].sort((left, right) => left.localeCompare(right));
}

export function resolveComponentsByKeysOrIds(
  keys: readonly string[],
  uiComponents: readonly PackageBuilderCatalogUiComponentItem[],
): PackageBuilderCatalogUiComponentItem[] {
  const seen = new Set<string>();
  const items: PackageBuilderCatalogUiComponentItem[] = [];

  for (const raw of keys) {
    const key = raw.trim();
    if (!key) continue;

    const match = uiComponents.find((item) => (
      item.componentKey === key
      || item.id === key
      || item.componentKey.endsWith(`/${key}`)
      || item.componentKey.split('/').pop() === key
    ));
    if (!match || seen.has(match.componentKey)) continue;
    seen.add(match.componentKey);
    items.push(match);
  }

  return items;
}
