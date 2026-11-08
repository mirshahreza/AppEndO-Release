import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { runtimeDirs } from '../../../core/runtime/runtimePaths';
import {
  EMPTY_PLATFORM_WEB_FONTS_CONFIG,
  WEB_FONT_ID_PATTERN,
  WEB_FONT_ID_PREFIX,
  isWebFontScript,
  type PackageEligiblePlatformWebFont,
  type PlatformWebFont,
  type PlatformWebFontsConfig,
  type WebFontFileFormat,
  type WebFontScript,
} from '../../../shared/api/contracts/platform/webFonts';
import {
  toWebFontPlatformAssetUrl,
  webFontPlatformAssetUrlToRelativePath,
} from '../../../shared/lib/platformWebFonts';
import { applyPlatformWebFontsRuntime } from './platformWebFontsRuntime';
import { SETTINGS_PATH } from '../../config/settingsFile';
import { readPlatformBlob, writePlatformBlob } from '../settings/platformSettingsStore';

const PLATFORM_WEB_FONTS_SETTINGS_KEY = 'platformWebFonts' as const;

const ALLOWED_EXTENSIONS = new Set<WebFontFileFormat>(['woff2', 'woff', 'ttf', 'otf']);

const MAX_FONT_FILE_BYTES = 10 * 1024 * 1024;
const MAX_LICENSE_NOTICE_BYTES = 256 * 1024;
const HASH_RE = /^[a-f0-9]{64}$/;

const FONT_MIME_BY_FORMAT: Record<WebFontFileFormat, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

function hashFontContent(content: Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function isValidLicenseUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function hasExpectedFontSignature(format: WebFontFileFormat, content: Buffer): boolean {
  if (content.length < 4) return false;
  const signature = content.subarray(0, 4).toString('latin1');
  if (format === 'woff2') return signature === 'wOF2';
  if (format === 'woff') return signature === 'wOFF';
  if (format === 'otf') return signature === 'OTTO';
  return signature === '\u0000\u0001\u0000\u0000' || signature === 'true';
}

function extensionFromFileName(fileName: string): WebFontFileFormat | null {
  const extension = path.extname(fileName).toLowerCase().slice(1);
  return ALLOWED_EXTENSIONS.has(extension as WebFontFileFormat)
    ? extension as WebFontFileFormat
    : null;
}

function slugifyWebFontSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized.slice(0, 40);
}

function deriveWebFontLabel(fileName: string): string {
  const stem = path.basename(fileName, path.extname(fileName)).trim();
  if (!stem) {
    return 'Custom Font';
  }

  return stem
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function deriveWebFontFamily(label: string): string {
  const trimmed = label.trim();
  return trimmed || 'Custom Font';
}

function normalizePlatformWebFont(raw: unknown): PlatformWebFont | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const input = raw as Record<string, unknown>;
  const id = typeof input.id === 'string' ? input.id.trim() : '';
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  const family = typeof input.family === 'string' ? input.family.trim() : '';
  const format = typeof input.format === 'string' ? input.format.trim() : '';
  const fileName = typeof input.fileName === 'string' ? input.fileName.trim() : '';
  const url = typeof input.url === 'string' ? input.url.trim() : '';
  const uploadedAt = typeof input.uploadedAt === 'string' ? input.uploadedAt.trim() : '';
  const scriptRaw = typeof input.script === 'string' ? input.script.trim() : '';
  const contentHash = typeof input.contentHash === 'string' ? input.contentHash.trim().toLowerCase() : '';
  const mime = typeof input.mime === 'string' ? input.mime.trim().toLowerCase() : '';
  const fileSize = typeof input.fileSize === 'number' ? input.fileSize : 0;
  const packagePolicy = typeof input.packagePolicy === 'string' ? input.packagePolicy.trim() : '';
  const licenseName = typeof input.licenseName === 'string' ? input.licenseName.trim() : '';
  const licenseUrl = typeof input.licenseUrl === 'string' ? input.licenseUrl.trim() : '';
  const licenseNotice = typeof input.licenseNotice === 'string' ? input.licenseNotice.trim() : '';

  if (!id || !WEB_FONT_ID_PATTERN.test(id)) {
    return null;
  }

  if (!label || !family || !fileName || !url || !uploadedAt) {
    return null;
  }

  if (!ALLOWED_EXTENSIONS.has(format as WebFontFileFormat)) {
    return null;
  }

  const font: PlatformWebFont = {
    id,
    label,
    family,
    format: format as WebFontFileFormat,
    fileName,
    url,
    uploadedAt,
    script: isWebFontScript(scriptRaw) ? scriptRaw : 'en',
  };
  if (
    HASH_RE.test(contentHash)
    && mime === FONT_MIME_BY_FORMAT[format as WebFontFileFormat]
    && Number.isSafeInteger(fileSize)
    && fileSize > 0
    && fileSize <= MAX_FONT_FILE_BYTES
  ) {
    font.contentHash = contentHash;
    font.mime = mime;
    font.fileSize = fileSize;
  }
  if (packagePolicy === 'embed' || packagePolicy === 'reference-only') {
    font.packagePolicy = packagePolicy;
  }
  if (licenseName) font.licenseName = licenseName;
  if (licenseUrl && isValidLicenseUrl(licenseUrl)) font.licenseUrl = licenseUrl;
  if (licenseNotice && Buffer.byteLength(licenseNotice, 'utf8') <= MAX_LICENSE_NOTICE_BYTES) {
    font.licenseNotice = licenseNotice;
  }
  return font;
}

export function normalizePlatformWebFontsConfig(raw: Record<string, unknown>): PlatformWebFontsConfig {
  const fontsRaw = raw.fonts;
  if (!Array.isArray(fontsRaw)) {
    return { ...EMPTY_PLATFORM_WEB_FONTS_CONFIG };
  }

  const fonts: PlatformWebFont[] = [];
  const seenIds = new Set<string>();

  for (const item of fontsRaw) {
    const font = normalizePlatformWebFont(item);
    if (!font || seenIds.has(font.id)) {
      continue;
    }
    seenIds.add(font.id);
    fonts.push(font);
  }

  return { fonts };
}

export function getWebFontsAssetsRootPath(): string {
  return path.join(process.cwd(), runtimeDirs.platformFonts);
}

export function ensureWebFontsAssetsDir(root: string = getWebFontsAssetsRootPath()): string {
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function readPlatformWebFontsConfig(settingsPath: string): PlatformWebFontsConfig {
  const raw = readPlatformBlob(
    settingsPath,
    PLATFORM_WEB_FONTS_SETTINGS_KEY,
    () => ({ ...EMPTY_PLATFORM_WEB_FONTS_CONFIG }),
    normalizePlatformWebFontsConfig,
  );
  return normalizePlatformWebFontsConfig(raw);
}

function writePlatformWebFontsConfig(
  settingsPath: string,
  config: PlatformWebFontsConfig,
): PlatformWebFontsConfig {
  const normalized = normalizePlatformWebFontsConfig(config as unknown as Record<string, unknown>);
  writePlatformBlob(
    settingsPath,
    PLATFORM_WEB_FONTS_SETTINGS_KEY,
    normalized as unknown as Record<string, unknown>,
    () => normalized as unknown as Record<string, unknown>,
  );
  return normalized;
}

function deriveWebFontIdFromLabel(label: string): string {
  const base = slugifyWebFontSegment(label) || 'font';
  const id = `${WEB_FONT_ID_PREFIX}${base}`;
  return WEB_FONT_ID_PATTERN.test(id) ? id : `${WEB_FONT_ID_PREFIX}font`;
}

function findExistingFontForUpload(
  fonts: PlatformWebFont[],
  label: string,
  family: string,
): { index: number; id: string } | null {
  const idFromLabel = deriveWebFontIdFromLabel(label);
  const byId = fonts.findIndex((font) => font.id === idFromLabel);
  if (byId >= 0) {
    return { index: byId, id: fonts[byId]!.id };
  }

  const normalizedFamily = family.trim().toLowerCase();
  const byFamily = fonts.findIndex(
    (font) => font.family.trim().toLowerCase() === normalizedFamily,
  );
  if (byFamily >= 0) {
    return { index: byFamily, id: fonts[byFamily]!.id };
  }

  return null;
}

function writeFontAssetFile(rootPath: string, fontId: string, format: WebFontFileFormat, content: Buffer): void {
  const root = ensureWebFontsAssetsDir(rootPath);
  const fontDir = path.join(root, fontId);
  fs.mkdirSync(fontDir, { recursive: true });

  for (const entry of fs.readdirSync(fontDir)) {
    fs.rmSync(path.join(fontDir, entry), { force: true });
  }

  fs.writeFileSync(path.join(fontDir, `font.${format}`), content);
}

function readFontAssetFile(
  rootPath: string,
  font: Pick<PlatformWebFont, 'id' | 'url'>,
): Buffer | null {
  const relative = webFontPlatformAssetUrlToRelativePath(font.url);
  if (!relative || relative.split('/').some((segment) => !segment || segment === '.' || segment === '..')) {
    return null;
  }
  const target = path.resolve(rootPath, ...relative.split('/'));
  const root = `${path.resolve(rootPath)}${path.sep}`;
  if (!target.startsWith(root) || !fs.existsSync(target) || !fs.statSync(target).isFile()) return null;
  return fs.readFileSync(target);
}

function validatePackageMetadata(input: {
  packagePolicy?: string;
  licenseName?: string;
  licenseUrl?: string;
  licenseNotice?: string;
}): string | null {
  const supplied = [input.packagePolicy, input.licenseName, input.licenseUrl, input.licenseNotice]
    .some((value) => typeof value === 'string' && value.trim().length > 0);
  if (!supplied) return null;
  if (input.packagePolicy !== 'embed' && input.packagePolicy !== 'reference-only') {
    return 'Font package policy must be embed or reference-only.';
  }
  if (!input.licenseName?.trim()) return 'Font license name is required for package use.';
  if (!input.licenseNotice?.trim()) return 'Font license notice is required for package use.';
  if (Buffer.byteLength(input.licenseNotice.trim(), 'utf8') > MAX_LICENSE_NOTICE_BYTES) {
    return 'Font license notice must be 256 KB or smaller.';
  }
  if (input.licenseUrl?.trim() && !isValidLicenseUrl(input.licenseUrl.trim())) {
    return 'Font license URL must be HTTPS and must not contain credentials.';
  }
  return null;
}

function isPackageEligibleFont(font: PlatformWebFont): font is PackageEligiblePlatformWebFont {
  return Boolean(
    font.contentHash
    && HASH_RE.test(font.contentHash)
    && font.mime === FONT_MIME_BY_FORMAT[font.format]
    && Number.isSafeInteger(font.fileSize)
    && font.fileSize! > 0
    && font.fileSize! <= MAX_FONT_FILE_BYTES
    && (font.packagePolicy === 'embed' || font.packagePolicy === 'reference-only')
    && font.licenseName?.trim()
    && font.licenseNotice?.trim()
    && (!font.licenseUrl || isValidLicenseUrl(font.licenseUrl)),
  );
}

function deleteFontDirectory(rootPath: string, fontId: string): void {
  const fontDir = path.join(rootPath, fontId);
  if (!fs.existsSync(fontDir)) {
    return;
  }

  fs.rmSync(fontDir, { recursive: true, force: true });
}

export class PlatformWebFontsService {
  constructor(
    private readonly settingsPath: string = SETTINGS_PATH,
    private readonly assetsRoot: string = getWebFontsAssetsRootPath(),
    private readonly configStore?: {
      read(): PlatformWebFontsConfig;
      write(config: PlatformWebFontsConfig): PlatformWebFontsConfig;
    },
  ) {}

  private readConfig(): PlatformWebFontsConfig {
    return this.configStore
      ? normalizePlatformWebFontsConfig(this.configStore.read() as unknown as Record<string, unknown>)
      : readPlatformWebFontsConfig(this.settingsPath);
  }

  private writeConfig(config: PlatformWebFontsConfig): PlatformWebFontsConfig {
    const normalized = normalizePlatformWebFontsConfig(config as unknown as Record<string, unknown>);
    return this.configStore ? this.configStore.write(normalized) : writePlatformWebFontsConfig(this.settingsPath, normalized);
  }

  private applyRuntime(): void {
    if (!this.configStore) applyPlatformWebFontsRuntime(this.settingsPath);
  }

  listFonts(): PlatformWebFontsConfig {
    return this.readConfig();
  }

  resolvePackageFont(id: string): { font: PackageEligiblePlatformWebFont; content: Buffer } | null {
    if (!WEB_FONT_ID_PATTERN.test(id)) return null;
    const font = this.readConfig().fonts.find((item) => item.id === id);
    if (!font || !isPackageEligibleFont(font)) return null;
    const content = readFontAssetFile(this.assetsRoot, font);
    if (
      !content
      || content.length !== font.fileSize
      || hashFontContent(content) !== font.contentHash
      || !hasExpectedFontSignature(font.format, content)
    ) {
      return null;
    }
    return { font, content };
  }

  getStoredFontContentHash(id: string): string | null {
    if (!WEB_FONT_ID_PATTERN.test(id)) return null;
    const font = this.readConfig().fonts.find((item) => item.id === id);
    if (!font) return null;
    const content = readFontAssetFile(this.assetsRoot, font);
    if (
      !content
      || content.length > MAX_FONT_FILE_BYTES
      || !hasExpectedFontSignature(font.format, content)
    ) {
      return null;
    }
    return hashFontContent(content);
  }

  installPackageFont(
    incoming: PackageEligiblePlatformWebFont,
    content?: Buffer,
  ): { ok: true; font: PackageEligiblePlatformWebFont; installed: boolean } | { ok: false; error: string } {
    if (!WEB_FONT_ID_PATTERN.test(incoming.id) || !isPackageEligibleFont(incoming)) {
      return { ok: false, error: 'Packaged font profile or license metadata is invalid.' };
    }
    const existing = this.resolvePackageFont(incoming.id);
    if (incoming.packagePolicy === 'reference-only') {
      if (!existing || existing.font.contentHash !== incoming.contentHash) {
        return { ok: false, error: `Reference-only font "${incoming.id}" requires an exact installed content hash.` };
      }
      return { ok: true, font: existing.font, installed: false };
    }
    if (
      !content
      || content.length !== incoming.fileSize
      || content.length > MAX_FONT_FILE_BYTES
      || hashFontContent(content) !== incoming.contentHash
      || !hasExpectedFontSignature(incoming.format, content)
      || incoming.mime !== FONT_MIME_BY_FORMAT[incoming.format]
    ) {
      return { ok: false, error: `Embedded font "${incoming.id}" failed format, MIME, size, or hash validation.` };
    }
    if (existing) {
      if (existing.font.contentHash === incoming.contentHash) {
        return { ok: true, font: existing.font, installed: false };
      }
      return { ok: false, error: `Font "${incoming.id}" already exists with different content.` };
    }
    const config = this.readConfig();
    if (config.fonts.some((font) => font.id === incoming.id)) {
      return { ok: false, error: `Font "${incoming.id}" already exists but is not package-eligible.` };
    }
    const font: PackageEligiblePlatformWebFont = {
      ...incoming,
      fileName: `font.${incoming.format}`,
      url: toWebFontPlatformAssetUrl(`${incoming.id}/font.${incoming.format}`),
      uploadedAt: incoming.uploadedAt || new Date().toISOString(),
    };
    try {
      writeFontAssetFile(this.assetsRoot, font.id, font.format, content);
      this.writeConfig({ fonts: [...config.fonts, font] });
      this.applyRuntime();
      return { ok: true, font, installed: true };
    } catch (error) {
      deleteFontDirectory(this.assetsRoot, font.id);
      return { ok: false, error: (error as Error).message || 'Failed to install packaged font.' };
    }
  }

  uploadFont(
    fileName: string,
    content: Buffer,
    input: {
      label?: string;
      family?: string;
      packagePolicy?: string;
      licenseName?: string;
      licenseUrl?: string;
      licenseNotice?: string;
    },
  ): { ok: true; font: PlatformWebFont } | { ok: false; error: string } {
    if (!content.length) {
      return { ok: false, error: 'Uploaded file is empty.' };
    }

    if (content.length > MAX_FONT_FILE_BYTES) {
      return { ok: false, error: 'Font file must be 10 MB or smaller.' };
    }

    const format = extensionFromFileName(fileName);
    if (!format) {
      return { ok: false, error: 'Fonts must be WOFF2, WOFF, TTF, or OTF files.' };
    }
    if (!hasExpectedFontSignature(format, content)) {
      return { ok: false, error: `Uploaded file content is not a valid ${format.toUpperCase()} font.` };
    }
    const packageMetadataError = validatePackageMetadata(input);
    if (packageMetadataError) return { ok: false, error: packageMetadataError };

    const label = input.label?.trim() || deriveWebFontLabel(fileName);
    const family = input.family?.trim() || deriveWebFontFamily(label);
    if (!label || !family) {
      return { ok: false, error: 'Font label and family are required.' };
    }

    const config = this.readConfig();
    const existingMatch = findExistingFontForUpload(config.fonts, label, family);
    const existingIndex = existingMatch?.index ?? -1;
    const existingFont = existingIndex >= 0 ? config.fonts[existingIndex] : null;
    const id = existingMatch?.id ?? deriveWebFontIdFromLabel(label);
    const safeFileName = `font.${format}`;
    const relativePath = `${id}/${safeFileName}`;

    try {
      writeFontAssetFile(this.assetsRoot, id, format, content);
    } catch (error) {
      if (!existingFont) {
        deleteFontDirectory(this.assetsRoot, id);
      }
      return { ok: false, error: (error as Error).message || 'Failed to store font file.' };
    }

    const font: PlatformWebFont = {
      id,
      label,
      family,
      format,
      fileName: safeFileName,
      url: toWebFontPlatformAssetUrl(relativePath),
      uploadedAt: new Date().toISOString(),
      script: existingFont?.script ?? 'en',
      contentHash: hashFontContent(content),
      mime: FONT_MIME_BY_FORMAT[format],
      fileSize: content.length,
      ...(input.packagePolicy === 'embed' || input.packagePolicy === 'reference-only'
        ? { packagePolicy: input.packagePolicy }
        : {}),
      ...(input.licenseName?.trim() ? { licenseName: input.licenseName.trim() } : {}),
      ...(input.licenseUrl?.trim() ? { licenseUrl: input.licenseUrl.trim() } : {}),
      ...(input.licenseNotice?.trim() ? { licenseNotice: input.licenseNotice.trim() } : {}),
    };

    const nextFonts = existingFont
      ? config.fonts.map((entry, index) => (index === existingIndex ? font : entry))
      : [...config.fonts, font];

    this.writeConfig({ fonts: nextFonts });
    this.applyRuntime();

    return { ok: true, font };
  }

  updateFontScript(
    fontId: string,
    script: WebFontScript,
  ): { ok: true; font: PlatformWebFont } | { ok: false; error: string } {
    const normalizedId = fontId.trim();
    if (!WEB_FONT_ID_PATTERN.test(normalizedId)) {
      return { ok: false, error: 'Invalid web font id.' };
    }

    if (!isWebFontScript(script)) {
      return { ok: false, error: 'Font script must be en, fa, or ar.' };
    }

    const config = this.readConfig();
    const index = config.fonts.findIndex((font) => font.id === normalizedId);
    if (index < 0) {
      return { ok: false, error: 'Web font not found.' };
    }

    const current = config.fonts[index];
    if (current.script === script) {
      return { ok: true, font: current };
    }

    const nextFont: PlatformWebFont = { ...current, script };
    const nextFonts = config.fonts.map((font, fontIndex) => (
      fontIndex === index ? nextFont : font
    ));

    this.writeConfig({ fonts: nextFonts });
    this.applyRuntime();

    return { ok: true, font: nextFont };
  }

  deleteFont(fontId: string): { ok: true } | { ok: false; error: string } {
    const normalizedId = fontId.trim();
    if (!WEB_FONT_ID_PATTERN.test(normalizedId)) {
      return { ok: false, error: 'Invalid web font id.' };
    }

    const config = this.readConfig();
    const nextFonts = config.fonts.filter((font) => font.id !== normalizedId);
    if (nextFonts.length === config.fonts.length) {
      return { ok: false, error: 'Web font not found.' };
    }

    try {
      deleteFontDirectory(this.assetsRoot, normalizedId);
      this.writeConfig({ fonts: nextFonts });
      this.applyRuntime();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message || 'Failed to delete web font.' };
    }
  }
}

let defaultPlatformWebFontsService: PlatformWebFontsService | null = null;

export function getDefaultPlatformWebFontsService(): PlatformWebFontsService {
  if (!defaultPlatformWebFontsService) {
    defaultPlatformWebFontsService = new PlatformWebFontsService();
  }
  return defaultPlatformWebFontsService;
}

export function bootstrapPlatformWebFontsFromSettings(
  settingsPath: string = SETTINGS_PATH,
): PlatformWebFontsConfig {
  return readPlatformWebFontsConfig(settingsPath);
}

type BundledWorkspaceWebFontSpec = {
  id: string;
  label: string;
  family: string;
  format: WebFontFileFormat;
  script: WebFontScript;
};

/** Self-hosted fonts shipped under `workspace/platform/fonts/` (Settings → Web Fonts). */
const BUNDLED_WORKSPACE_WEB_FONT_SPECS: readonly BundledWorkspaceWebFontSpec[] = [
  {
    id: 'web-tajawal-regular',
    label: 'Tajawal Regular',
    family: 'Tajawal Regular',
    format: 'woff',
    script: 'ar',
  },
  {
    id: 'web-tajawal-bold',
    label: 'Tajawal Bold',
    family: 'Tajawal Bold',
    format: 'woff',
    script: 'ar',
  },
];

/**
 * Registers workspace font files into `platformWebFonts` settings when missing.
 * Keeps Hawiety / Iraq culture typography aligned with legacy Tajawal without page-level @font-face.
 */
export function ensureBundledWorkspaceWebFontsInSettings(
  settingsPath: string = SETTINGS_PATH,
  assetsRoot: string = getWebFontsAssetsRootPath(),
): PlatformWebFontsConfig {
  const current = readPlatformWebFontsConfig(settingsPath);
  const fontsById = new Map(current.fonts.map((font) => [font.id, font]));
  let changed = false;

  for (const spec of BUNDLED_WORKSPACE_WEB_FONT_SPECS) {
    if (fontsById.has(spec.id)) {
      continue;
    }

    const fileName = `font.${spec.format}`;
    const relativePath = `${spec.id}/${fileName}`;
    const absolutePath = path.join(assetsRoot, spec.id, fileName);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const content = fs.readFileSync(absolutePath);
    if (!hasExpectedFontSignature(spec.format, content)) {
      continue;
    }

    const uploadedAt = new Date(0).toISOString();
    fontsById.set(spec.id, {
      id: spec.id,
      label: spec.label,
      family: spec.family,
      format: spec.format,
      fileName,
      url: toWebFontPlatformAssetUrl(relativePath),
      uploadedAt,
      script: spec.script,
      contentHash: hashFontContent(content),
      mime: FONT_MIME_BY_FORMAT[spec.format],
      fileSize: content.length,
    });
    changed = true;
  }

  if (!changed) {
    return current;
  }

  return writePlatformWebFontsConfig(settingsPath, { fonts: [...fontsById.values()] });
}
