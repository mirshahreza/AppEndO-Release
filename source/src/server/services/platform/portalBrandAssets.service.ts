import fs from 'fs';
import path from 'path';
import { runtimeDirs } from '../../../core/runtime/runtimePaths';
import { PACKAGE_WORKSPACE_ASSETS_URL_PREFIX } from '../../../shared/lib/packageWorkspaceAssets';
import { isAllowedPortalBrandLogoUrl } from '../../../shared/api/contracts/platform/portalBrand';
import { PORTAL_SEGMENT_SLUG_RE } from '../../../shared/api/contracts/platform/experienceManifest';

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif']);

export function portalBrandLogoRelativePath(segment: string, extension: string): string {
  return `portals/${segment.trim()}/logo${extension}`;
}

export function portalBrandLogoPublicUrl(segment: string, extension: string): string {
  return `${PACKAGE_WORKSPACE_ASSETS_URL_PREFIX}/${portalBrandLogoRelativePath(segment, extension)}`;
}

function workspaceAssetsRoot(): string {
  return path.join(process.cwd(), runtimeDirs.workspaceAssets);
}

function extensionFromFileName(fileName: string): string | null {
  const extension = path.extname(fileName).toLowerCase();
  return ALLOWED_EXTENSIONS.has(extension) ? extension : null;
}

function portalLogoDirectory(segment: string): string {
  return path.join(workspaceAssetsRoot(), 'portals', segment.trim());
}

function listPortalLogoFiles(directoryPath: string): string[] {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs.readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^logo\./i.test(entry.name))
    .map((entry) => entry.name);
}

export function writePortalBrandLogo(
  segment: string,
  fileName: string,
  content: Buffer,
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = segment.trim();
  if (!PORTAL_SEGMENT_SLUG_RE.test(trimmed)) {
    return { ok: false, error: 'Invalid portal segment.' };
  }

  const extension = extensionFromFileName(fileName);
  if (!extension) {
    return { ok: false, error: 'Logo must be a PNG, JPEG, WebP, SVG, or GIF image.' };
  }

  const directoryPath = portalLogoDirectory(trimmed);
  fs.mkdirSync(directoryPath, { recursive: true });

  for (const existing of listPortalLogoFiles(directoryPath)) {
    fs.unlinkSync(path.join(directoryPath, existing));
  }

  const absPath = path.join(directoryPath, `logo${extension}`);
  fs.writeFileSync(absPath, content);

  const url = portalBrandLogoPublicUrl(trimmed, extension);
  if (!isAllowedPortalBrandLogoUrl(url)) {
    return { ok: false, error: 'Failed to store portal logo.' };
  }

  return { ok: true, url };
}

export function copyPortalBrandLogo(
  sourceUrl: string,
  targetSegment: string,
): string | null {
  const trimmedSource = sourceUrl.trim().split('?')[0] ?? '';
  if (!isAllowedPortalBrandLogoUrl(trimmedSource)) {
    return null;
  }

  const relative = trimmedSource.slice(`${PACKAGE_WORKSPACE_ASSETS_URL_PREFIX}/`.length);
  const sourceAbs = path.resolve(workspaceAssetsRoot(), relative);
  const root = path.resolve(workspaceAssetsRoot());
  if (!sourceAbs.startsWith(root) || !fs.existsSync(sourceAbs) || !fs.statSync(sourceAbs).isFile()) {
    return null;
  }

  const extension = path.extname(sourceAbs).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return null;
  }

  const written = writePortalBrandLogo(
    targetSegment,
    `logo${extension}`,
    fs.readFileSync(sourceAbs),
  );
  return written.ok ? written.url : null;
}
